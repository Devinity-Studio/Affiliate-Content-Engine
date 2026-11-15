'use strict';

/**
 * ACE — Shopee product link reader.
 *
 * Turns a pasted Shopee / Shopee Affiliate product URL into a preview record
 * (name, price, image, shop id, item id) so it can be added to the Source
 * Library and Candidate Pool.
 *
 * Boundaries:
 *   - Reads one public product page over HTTPS. No Shopee account, no API key,
 *     no cookies, no login and no affiliate credentials are used or stored.
 *   - Only allow-listed Shopee hosts are contacted; redirects are re-checked.
 *   - When Shopee blocks the request the caller still gets the shop/item ids
 *     parsed from the URL so the product can be filled in manually.
 */

const TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;

const ALLOWED_HOST = /^(?:[a-z0-9-]+\.)*(?:shopee\.co\.th|shopee\.com|shp\.ee)$/i;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function parseShopeeUrl(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) throw badRequest('url is required');
  if (raw.length > 2048) throw badRequest('url is too long');

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('url is not a valid absolute URL');
  }

  if (url.protocol !== 'https:') throw badRequest('url must use https');
  if (!ALLOWED_HOST.test(url.hostname)) {
    throw badRequest('url must point at a Shopee domain (shopee.co.th, shopee.com or shp.ee)');
  }

  return { url, ...idsFromUrl(url) };
}

function idsFromUrl(url) {
  const text = url.pathname + (url.search || '');
  const dotted = text.match(/-i\.(\d+)\.(\d+)/);
  if (dotted) return { shopId: dotted[1], itemId: dotted[2] };

  const segmented = url.pathname.match(/\/product\/(\d+)\/(\d+)/);
  if (segmented) return { shopId: segmented[1], itemId: segmented[2] };

  // PWA/user route the short links redirect to: /{username}/{shopId}/{itemId}
  // (e.g. /opaanlp/1031169224/25309221594). Digit-length guard avoids
  // matching ordinary shop pages.
  const userRoute = url.pathname.match(/^\/[^/]+\/(\d{6,})\/(\d{6,})/);
  if (userRoute) return { shopId: userRoute[1], itemId: userRoute[2] };

  return { shopId: null, itemId: null };
}

function metaContent(html, property) {
  const name = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]);
  }
  return null;
}

function jsonLdProduct(html) {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      const list = Array.isArray(node?.['@graph']) ? node['@graph'] : [node];
      for (const item of list) {
        const type = item?.['@type'];
        const isProduct = Array.isArray(type)
          ? type.some((t) => String(t).toLowerCase() === 'product')
          : String(type || '').toLowerCase() === 'product';
        if (isProduct) return item;
      }
    }
  }
  return null;
}

function numeric(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function extractProduct(html) {
  const product = jsonLdProduct(html);
  const offers = product?.offers && (Array.isArray(product.offers) ? product.offers[0] : product.offers);

  const titleHtml = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return {
    title:
      decodeEntities(product?.name || '') ||
      metaContent(html, 'og:title') ||
      (titleHtml ? decodeEntities(titleHtml[1]) : null),
    price:
      numeric(offers?.price) ??
      numeric(metaContent(html, 'og:price:amount')) ??
      numeric(metaContent(html, 'product:price:amount')) ??
      numeric(metaContent(html, 'og:price')),
    currency:
      offers?.priceCurrency || metaContent(html, 'og:price:currency') || metaContent(html, 'product:price:currency') || null,
    image: (() => {
      const raw = product?.image || metaContent(html, 'og:image');
      if (Array.isArray(raw)) return raw[0] || null;
      return raw || null;
    })(),
    shopName: product?.brand?.name || metaContent(html, 'og:site_name') || null,
  };
}

async function readPage(url, redirects = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.href, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
      },
    });

    const finalUrl = new URL(response.url || url.href);
    if (!ALLOWED_HOST.test(finalUrl.hostname)) {
      throw new Error('redirected to a non-Shopee host');
    }
    if (!response.ok) {
      return { ok: false, finalUrl, reason: `http_${response.status}` };
    }

    const declared = Number(response.headers.get('content-length') || 0);
    if (declared && declared > MAX_BYTES) {
      return { ok: false, finalUrl, reason: 'page_too_large' };
    }

    const html = (await response.text()).slice(0, MAX_BYTES);
    return { ok: true, finalUrl, html };
  } catch (error) {
    if (redirects < MAX_REDIRECTS && /redirect/i.test(String(error?.message || ''))) {
      return readPage(url, redirects + 1);
    }
    const reason = error?.name === 'AbortError' ? 'timeout' : 'unreachable';
    return { ok: false, finalUrl: url, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} input pasted Shopee / affiliate product URL
 * @returns {Promise<object>} preview record; never throws for a blocked page
 */
async function preview(input) {
  const { url } = parseShopeeUrl(input);

  const page = await readPage(url);
  const resolved = page.finalUrl || url;
  const ids = idsFromUrl(resolved);
  const base = {
    url: url.href,
    finalUrl: resolved.href,
    shopId: ids.shopId,
    itemId: ids.itemId,
    // The canonical product URL is derivable whenever both ids resolved — it
    // opens the real product page in the user's logged-in browser even when
    // the script-less fetch is blocked.
    canonicalUrl: ids.shopId && ids.itemId
      ? 'https://shopee.co.th/product/' + ids.shopId + '/' + ids.itemId
      : null,
  };

  if (!page.ok) {
    return {
      ...base,
      fetched: false,
      reason: page.reason,
      title: null,
      price: null,
      currency: null,
      image: null,
      shopName: null,
    };
  }

  const product = extractProduct(page.html || '');
  return {
    ...base,
    fetched: true,
    reason: null,
    title: product.title || null,
    price: product.price,
    currency: product.currency,
    image: product.image,
    shopName: product.shopName,
  };
}

module.exports = { preview, parseShopeeUrl, extractProduct, MAX_BYTES, TIMEOUT_MS };
