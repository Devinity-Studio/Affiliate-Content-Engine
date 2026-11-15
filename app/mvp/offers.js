'use strict';

/**
 * Parser for text copied out of the Shopee Affiliate dashboard:
 * Offers → ข้อเสนอ ผลิตภัณฑ์ (affiliate.shopee.co.th/offer/product_offer).
 *
 * That page is the only data source for this app. Its cards are uniform:
 *
 *   ชื่อสินค้า …
 *   EXTRA COMM
 *   ฿119.00
 *   ขายได้ 23 ชิ้น
 *   ค่าคอมมิชชัน 32%
 *   เอา ลิงก์
 *
 * Every card ends with a "ค่าคอมมิชชัน N%" line, so we split the text on that
 * marker and read price / sold / link from the block in front of it. This keeps
 * 100-item pages instant and free instead of sending the page to a model.
 */

const MAX_OFFERS = 400;
const MAX_NAME = 200;

const NOISE = [
  /^extra\s*comm$/i,
  /^เอา\s*ลิงก์$/,
  /^ลิงก์$/,
  /^คัดลอก$/,
  /^เลือก$/,
  /^แต้ม$/,
  /^ของแถม$/,
  /^สินค้า$/,
  /^เลือกผลิตภัณฑ์ทั้งหมดในหน้านี้$/,
  /^\d+\s*\/\s*\d+\s*เลือก$/,
  /^รับลิงก์สินค้าที่เลือกทั้งหมด$/,
];

function isNoise(line) {
  const value = line.trim();
  if (!value) return true;
  if (/^[☐□◻◼▢\u2610\u25a1]+$/.test(value)) return true;
  return NOISE.some(function(re) { return re.test(value); });
}

function toNumber(raw) {
  if (!raw) return null;
  const value = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function parseCardBody(body, rate) {
  const priceMatch = body.match(/[฿]\s*([\d,]+(?:\.\d{1,2})?)/);
  const price = priceMatch ? toNumber(priceMatch[1]) : null;

  const soldMatch = body.match(/ขายได้\s*([^\n]{1,24}?)\s*ชิ้น/);
  const sold = soldMatch ? soldMatch[1].trim() + ' ชิ้น' : null;

  const linkMatch = body.match(/https?:\/\/[^\s"'<>]*shopee[^\s"'<>]*/i);
  const link = linkMatch ? linkMatch[0] : null;

  const name = body
    .split('\n')
    .map(function(line) {
      return line
        .replace(/[฿]\s*[\d,]+(?:\.\d{1,2})?/g, ' ')
        .replace(/ขายได้[^\n]*?ชิ้น/g, ' ')
        .replace(/ค่าคอมมิชชัน[^\n]*/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .trim();
    })
    .filter(function(line) { return !isNoise(line); })
    .sort(function(a, b) { return b.length - a.length; })[0];

  if (!name || !price) return null;

  const commission = rate !== null ? Math.round(price * rate) / 100 : null;

  return {
    name: name.slice(0, MAX_NAME),
    price: price,
    sold: sold,
    commission_rate: rate,
    commission_amount: commission,
    link: link,
  };
}

function parseOfferText(text, options) {
  const limit = options && Number.isFinite(options.limit) ? options.limit : MAX_OFFERS;
  const input = typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
  if (!input.trim()) {
    return { ok: false, status: 'invalid_request', message: 'text is required' };
  }

  const offers = [];
  const seen = new Set();
  const rateRe = /ค่าคอมมิชชัน\s*([\d.]+)\s*%/g;
  let cursor = 0;
  let match;
  let skipped = 0;

  while ((match = rateRe.exec(input)) !== null) {
    const body = input.slice(cursor, match.index);
    cursor = rateRe.lastIndex;
    const rate = toNumber(match[1]);
    const card = parseCardBody(body, rate);
    if (!card) {
      skipped += 1;
      continue;
    }
    const key = card.name.toLowerCase() + '|' + card.price;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push(card);
    if (offers.length >= limit) break;
  }

  return {
    ok: true,
    status: 'success',
    source: 'rule',
    count: offers.length,
    skipped: skipped,
    offers: offers,
  };
}

module.exports = { parseOfferText, MAX_OFFERS };
