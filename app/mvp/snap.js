'use strict';

/**
 * ACE — Snap assistant.
 *
 * Turns the product text a user copies from a Shopee / Shopee Affiliate page
 * (or types by hand after snapping a screenshot) into structured product facts,
 * and turns those facts into a Thai short-video content draft.
 *
 * Boundaries:
 *   - The only external call is the configured LLM provider through
 *     `provider.generateScriptDraft` (same gate/live interlock as the rest of
 *     the app). No Shopee account, API or scraper is contacted.
 *   - The model may only return what the supplied text contains: the prompt
 *     forbids inventing prices, promotions or commission numbers, and every
 *     number is re-validated here before it reaches the UI.
 *   - Nothing is persisted by this module.
 */

const provider = require('./provider/gateway');

const MAX_INPUT_CHARS = 4000;
const TIMEOUT_MS = 30000;

const EXTRACT_SYSTEM = [
  'คุณเป็นผู้ช่วยดึงข้อมูลสินค้าจากข้อความที่คัดลอกมาจากหน้า Shopee หรือ Shopee Affiliate',
  'ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON',
  'ห้ามเดาข้อมูลที่ไม่มีในข้อความ ให้ใส่ null แทน',
  'ราคาและค่าคอมมิชชันให้เป็นตัวเลขล้วน (บาท) ไม่ต้องมีสัญลักษณ์หรือ comma',
  'รูปแบบ: {"name":string,"price":number|null,"commission_rate":number|null,',
  '"commission_amount":number|null,"shop_name":string|null,"rating":number|null,',
  '"sold":string|null,"category":string|null,"promo":string|null}',
].join(' ');

const CONTENT_SYSTEM = [
  'คุณเป็นครีเอเตอร์คลิปสั้นภาษาไทยที่ขายสินค้าออนไลน์แบบ affiliate',
  'เขียนจากข้อมูลสินค้าที่ให้เท่านั้น ห้ามแต่งราคา โปรโมชัน หรือตัวเลขที่ไม่มีในข้อมูล',
  'โทนเป็นกันเอง พูดจริงใจ ไม่โอเวอร์ และต้องมีคำเตือนให้ตรวจสอบราคาก่อนซื้อ',
  'ตอบเป็น JSON เท่านั้น รูปแบบ:',
  '{"hook":string,"script":string,"caption":string,"hashtags":[string]}',
  'hook ไม่เกิน 60 ตัวอักษร, script เป็นบทพูด 4 วรรค (Hook, Action, Payoff, CTA) รวมไม่เกิน 1200 ตัวอักษร,',
  'caption ไม่เกิน 400 ตัวอักษร, hashtags 5-8 อัน ขึ้นต้นด้วย #',
].join(' ');

const OFFERS_SYSTEM = [
  'คุณเป็นผู้ช่วยดึงรายการข้อเสนอผลิตภัณฑ์จากข้อความที่คัดลอกมาจากหน้า Shopee Affiliate',
  'เมนู “ข้อเสนอ ผลิตภัณฑ์” (affiliate.shopee.co.th/offer/product_offer)',
  'ตอบเป็น JSON เท่านั้น: {"offers":[{"name":string,"price":number|null,',
  '"sold":string|null,"commission_rate":number|null,"commission_amount":number|null,"link":string|null}]}',
  'หนึ่งรายการต่อหนึ่งสินค้าที่พบในข้อความ สูงสุด 20 รายการ',
  'ห้ามเดาข้อมูลที่ไม่มีในข้อความ ให้ใส่ null แทน ราคาและค่าคอมให้เป็นตัวเลขล้วน (บาท)',
  'commission_rate คือเปอร์เซ็นต์ค่าคอมมิชชัน (ตัวเลข ไม่ต้องมี % เครื่องหมาย)',
  'link ใส่เฉพาะเมื่อข้อความมีการลิงก์ (เช่น s.shopee.co.th) เท่านั้น',
].join(' ');

const MAX_OFFERS = 20;

function fail(status, message) {
  return { ok: false, status, message };
}

function parseJsonBlock(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const candidates = [trimmed];
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function cleanNumber(value, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(number) || number < 0 || number > max) return null;
  return Math.round(number * 100) / 100;
}

function normalizeProduct(parsed) {
  return {
    name: cleanText(parsed.name, 200),
    price: cleanNumber(parsed.price, 10000000),
    commission_rate: cleanNumber(parsed.commission_rate, 100),
    commission_amount: cleanNumber(parsed.commission_amount, 10000000),
    shop_name: cleanText(parsed.shop_name, 120),
    rating: cleanNumber(parsed.rating, 5),
    sold: cleanText(parsed.sold, 40),
    category: cleanText(parsed.category, 80),
    promo: cleanText(parsed.promo, 160),
  };
}

/**
 * Extracts product facts from pasted Shopee page text (or typed notes).
 */
async function extractProduct(text, options = {}) {
  const input = typeof text === 'string' ? text.trim() : '';
  if (!input) return fail('invalid_request', 'text is required');
  if (input.length > MAX_INPUT_CHARS) return fail('invalid_request', 'text is too long');

  const result = await provider.generateScriptDraft({
    prompt: 'ข้อความจากหน้า Shopee:\n"""\n' + input + '\n"""',
    systemPrompt: EXTRACT_SYSTEM,
    model: options.model,
    provider: options.provider,
    allowNetwork: true,
    timeoutMs: TIMEOUT_MS,
    env: options.env,
  });

  if (!result.ok) return { ok: false, status: result.status, message: result.message };

  const parsed = parseJsonBlock(result.text);
  if (!parsed) return fail('invalid_response', 'the model did not answer with usable JSON');

  const product = normalizeProduct(parsed);
  if (!product.name && product.price === null) {
    return fail('invalid_response', 'no product name or price found in that text');
  }

  return {
    ok: true,
    status: 'success',
    model: result.model || null,
    latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    product,
  };
}

/**
 * Drafts Thai short-video content from the confirmed product facts.
 * The product object is built by the caller from what the user confirmed, so
 * the model never sees or invents numbers the user did not accept.
 */
async function draftContent(product, options = {}) {
  if (!product || typeof product !== 'object') return fail('invalid_request', 'product is required');

  const name = cleanText(product.name, 200);
  if (!name) return fail('invalid_request', 'product.name is required');

  const facts = [
    'ชื่อสินค้า: ' + name,
    'แพลตฟอร์ม: ' + (cleanText(product.platform, 40) || 'Shopee'),
    'ราคา (บาท): ' + (cleanNumber(product.price, 10000000) ?? 'ไม่ทราบ'),
    'ค่าคอมมิชชันโดยประมาณ (บาท): ' + (cleanNumber(product.commission, 10000000) ?? 'ไม่ทราบ'),
    'คะแนนร้าน (เต็ม 5): ' + (cleanNumber(product.rating, 5) ?? 'ไม่ทราบ'),
    'ยอดขาย: ' + (cleanText(product.sold, 40) || 'ไม่ทราบ'),
    'จุดเด่น/โปรโมชัน: ' + (cleanText(product.promo, 160) || 'ไม่มีข้อมูล'),
    'Call to Action ที่ต้องการ: ' + (cleanText(product.cta, 160) || 'ไม่มีข้อมูล'),
    'สไตล์การผลิต: ' + (cleanText(product.preset, 160) || 'ไม่มีข้อมูล'),
    'ลิงก์ affiliate: ' + (cleanText(product.affiliateLink, 500) || 'ไม่มีข้อมูล'),
  ].join('\n');

  const result = await provider.generateScriptDraft({
    prompt: facts,
    systemPrompt: CONTENT_SYSTEM,
    model: options.model,
    provider: options.provider,
    allowNetwork: true,
    timeoutMs: TIMEOUT_MS,
    env: options.env,
  });

  if (!result.ok) return { ok: false, status: result.status, message: result.message };

  const parsed = parseJsonBlock(result.text);
  if (!parsed) return fail('invalid_response', 'the model did not answer with usable JSON');

  let hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags
      .map((tag) => cleanText(String(tag), 40))
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : '#' + tag))
      .slice(0, 8)
    : [];

  if (hashtags.length === 0) {
    // Deterministic fallback so the draft is always postable.
    hashtags = ['#Shopee', '#ของดีบอกต่อ', '#รีวิวจริง', '#ช้อปออนไลน์', '#affiliate'];
    const firstWord = name.split(/[\s/|]+/).find((word) => word.length >= 3);
    if (firstWord) hashtags.push('#' + firstWord.replace(/[^\p{L}\p{N}]/gu, ''));
  }

  return {
    ok: true,
    status: 'success',
    model: result.model || null,
    latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    content: {
      hook: cleanText(parsed.hook, 120),
      script: cleanText(parsed.script, 1600),
      caption: cleanText(parsed.caption, 500),
      hashtags,
    },
  };
}

/**
 * Extracts the whole Product Offer list copied from the Shopee Affiliate
 * dashboard (Offers → Product Offer page). One call, many products.
 */
async function extractOffers(text, options = {}) {
  const input = typeof text === 'string' ? text.trim() : '';
  if (!input) return fail('invalid_request', 'text is required');
  if (input.length > MAX_INPUT_CHARS) return fail('invalid_request', 'text is too long');

  const result = await provider.generateScriptDraft({
    prompt: 'ข้อความจากหน้า Shopee Affiliate > ข้อเสนอ ผลิตภัณฑ์:\n"""\n' + input + '\n"""',
    systemPrompt: OFFERS_SYSTEM,
    model: options.model,
    provider: options.provider,
    allowNetwork: true,
    timeoutMs: TIMEOUT_MS,
    maxOutputTokens: 3000,
    env: options.env,
  });

  if (!result.ok) return { ok: false, status: result.status, message: result.message };

  const parsed = parseJsonBlock(result.text);
  if (!parsed) return fail('invalid_response', 'the model did not answer with usable JSON');

  const raw = Array.isArray(parsed) ? parsed : Array.isArray(parsed.offers) ? parsed.offers : [];
  const offers = raw.slice(0, MAX_OFFERS).map(function(item) {
    if (!item || typeof item !== 'object') return null;
    const name = cleanText(item.name, 200);
    if (!name) return null;
    return {
      name: name,
      price: cleanNumber(item.price, 10000000),
      sold: cleanText(item.sold, 40),
      commission_rate: cleanNumber(item.commission_rate, 100),
      commission_amount: cleanNumber(item.commission_amount, 10000000),
      link: cleanText(item.link, 500),
    };
  }).filter(Boolean);

  if (!offers.length) return fail('invalid_response', 'no product offers found in that text');

  return {
    ok: true,
    status: 'success',
    model: result.model || null,
    latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    offers: offers,
  };
}

module.exports = { extractProduct, extractOffers, draftContent, MAX_INPUT_CHARS, MAX_OFFERS };
