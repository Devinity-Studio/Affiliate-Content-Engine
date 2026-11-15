'use strict';

/**
 * ACE — Research & Content Generation through OpenRouter.
 *
 * One job: turn the imported product pool into an advisory shortlist — which
 * five items to make, why, what the risks are, and a Thai hook plus a short
 * script for each. It never writes the pool itself; the deterministic scoring
 * keeps ownership of ranks and claims, and a human still picks what to produce.
 *
 * The request path, credential handling, timeout and refusal vocabulary all go
 * through `provider/openrouter.js`, so this module adds prompts and parsing, not
 * a second way to reach the network.
 */

const provider = require('./provider/gateway');
const aiEnv = require('./env');

const MAX_PICKS = 5;
// One shortlist run reads at most this many pool items. The provider prompt is
// hard-capped at 8000 characters; 12 lines of real offer data plus the fixed
// instructions stay well inside that budget.
const MAX_CANDIDATES_IN_PROMPT = 12;
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2400;

const SYSTEM_PROMPT = [
  'คุณเป็นนักวิเคราะห์สินค้า Shopee Affiliate และนักเขียนคอนเทนต์วิดีโอสั้นภาษาไทย',
  'ใช้เฉพาะข้อมูลที่ให้มา ห้ามแต่งราคา โปรโมชัน คะแนน หรือตัวเลขใหม่',
  'ถ้าข้อมูลไม่พอ ให้บอกว่าไม่พอในช่อง risks แทนการเดา',
  'ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON และห้ามใส่ ``` ในคำตอบ',
].join(' ');

/** Where the connection stands — names and flags only, never the credential. */
function status(env = process.env, meta = {}, activeProvider) {
  const summary = provider.status(env, activeProvider);
  const active = summary.providers[summary.active_provider];
  return {
    provider: summary.active_provider,
    endpoint: active.endpoint,
    configured: active.configured,
    // The resolver decides whether the key is a runtime override, from `.env`,
    // or from the process environment.
    key_source: meta.key_source || active.key_source,
    key_var: active.key_var,
    model: active.model,
    model_source: meta.model_source || active.model_source,
    model_var: active.model_var,
    live_interlock: summary.live_interlock,
    // Research calls are user-initiated from the panel, so they do not wait for
    // the Gate 4 interlock that guards the script-draft path.
    ready: active.configured,
    max_output_tokens: active.max_output_tokens,
    prompt_char_limit: 8000,
    picks_target: MAX_PICKS,
    active_provider: summary.active_provider,
    any_configured: summary.any_configured,
    providers: summary.providers,
  };
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function offerLines(state) {
  const candidates = (state.candidateOrder || [])
    .map((id) => state.candidates[id])
    .filter(Boolean)
    .slice(0, MAX_CANDIDATES_IN_PROMPT);
  const lines = [];
  for (const candidate of candidates) {
    const offer = state.offers[candidate.offer_id] || {};
    const product = state.products[candidate.product_id] || {};
    const promo = offer.promo && typeof offer.promo === 'object' ? offer.promo : null;
    const reviews = offer.reviews && typeof offer.reviews === 'object' ? offer.reviews : null;
    const parts = [
      `- ${candidate.id} | ${product.name || candidate.title} | shop ${candidate.shop ? candidate.shop.name : '?'}`,
      `ราคา ${num(offer.price_thb) ?? '?'} บาท`,
      num(offer.list_price_thb) ? `ราคาปกติ ${offer.list_price_thb} บาท` : null,
      num(offer.commission_rate) ? `ค่าคอมมิชชัน ${Math.round(offer.commission_rate * 100)}%` : null,
      promo && promo.label ? `โปร ${promo.label}` : null,
      reviews && num(reviews.rating) ? `คะแนน ${reviews.rating}/5 (${reviews.rating_count ?? '?'} รีวิว)` : null,
      candidate.scores ? `คะแนนคัดกรองในระบบ ${candidate.scores.ranking_score}` : null,
      candidate.claims && candidate.claims.length ? `ข้ออ้างที่มีหลักฐาน: ${candidate.claims.slice(0, 3).map((claim) => claim.text).join(' · ')}` : null,
    ].filter(Boolean);
    lines.push(parts.join(' | '));
  }
  return lines;
}

function buildPrompt(state, dataLabel) {
  const lines = offerLines(state);
  const pool = lines.length ? lines.join('\n') : '(ไม่มีข้อมูลสินค้า)';
  // Provenance must be told to the model honestly: the server fixture path
  // keeps the synthetic label, the MVP client pool passes the real-data label.
  const label = typeof dataLabel === 'string' && dataLabel.trim() !== ''
    ? dataLabel.trim().slice(0, 200)
    : 'ข้อมูลสังเคราะห์สำหรับทดสอบ';
  return [
    'นี่คือสินค้าที่นำเข้าจาก Shopee Affiliate (' + label + '):',
    pool,
    '',
    `งาน: คัดเลือก ${MAX_PICKS} รายการที่เหมาะทำวิดีโอสั้นแนวตั้ง 9:16 ภาษาไทยมากที่สุด`,
    'เกณฑ์: ความน่าเชื่อถือของข้อมูล, ค่าคอมมิชชัน, โปรโมชัน, รีวิว, และความเสี่ยงในการกล่าวอ้างเกินจริง',
    'แต่ละรายการต้องมี hook เปิดคลิป 1 ประโยค และสคริปต์ 3–5 บรรทัดที่พูดได้จริงใน 25–30 วินาที',
    'ห้ามใส่ราคาหรือโปรที่ไม่มีในข้อมูลด้านบน',
    '',
    'ตอบเป็น JSON หน้าตาแบบนี้เท่านั้น:',
    'ข้อบังคับ: candidate_id ต้องเป็น id ที่ต้นบรรทัดของรายการด้านบน คัดลอกให้ตรงตัว — ห้ามแต่ง id ใหม่ ห้ามใช้ id จากตัวอย่างด้านล่าง',
    '{"summary":"สรุปภาพรวม 1–2 ประโยค",'
    + '"picks":[{"candidate_id":"ใส่ id จากรายการด้านบน","title":"ชื่อสินค้าจากรายการด้านบน","fit_score":0,"why":"เหตุผลสั้น ๆ",'
    + '"risks":"ความเสี่ยงหรือข้อมูลที่ยังขาด","hook":"ประโยคเปิดคลิป",'
    + '"script":["บรรทัดที่ 1","บรรทัดที่ 2","บรรทัดที่ 3"]}],'
    + '"notes":["ข้อสังเกตเพิ่มเติม"]}',
  ].join('\n');
}

function cleanText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

/** Strips code fences and any chatter around the JSON object. */
function parseJsonBlock(text) {
  if (typeof text !== 'string') return null;
  let body = text.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) body = fenced[1].trim();
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first === -1 || last <= first) return null;
  try {
    const parsed = JSON.parse(body.slice(first, last + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Keeps only picks that name a real candidate, so a hallucinated id can never
 * point the workflow at something that does not exist.
 */
function normalise(parsed, state, maxPicks = MAX_PICKS) {
  const known = new Set((state.candidateOrder || []).map(String));
  // Models do not always echo the id faithfully, so a pick that names the
  // product title (or a close form of it) still resolves to the real item.
  const byTitle = new Map();
  (state.candidateOrder || []).forEach((candidateId) => {
    const candidate = state.candidates[candidateId] || {};
    const product = state.products[candidate.product_id] || {};
    const title = String(product.name || candidate.title || '').toLowerCase().trim();
    if (title && !byTitle.has(title)) byTitle.set(title, String(candidateId));
  });
  const rawPicks = Array.isArray(parsed.picks) ? parsed.picks : [];
  const picks = [];
  const droppedIds = [];
  for (const raw of rawPicks) {
    if (picks.length >= maxPicks) break;
    const rawId = cleanText(raw && raw.candidate_id, 32);
    let id = rawId && known.has(rawId) ? rawId : null;
    if (!id) {
      const rawTitle = cleanText(raw && (raw.title || raw.name), 200).toLowerCase().trim();
      if (rawTitle && byTitle.has(rawTitle)) {
        id = byTitle.get(rawTitle);
      } else if (rawTitle) {
        for (const [title, candidateId] of byTitle.entries()) {
          if (rawTitle.indexOf(title) !== -1 || title.indexOf(rawTitle) !== -1) {
            id = candidateId;
            break;
          }
        }
      }
    }
    if (!id || !known.has(id)) {
      if (rawId) droppedIds.push(rawId);
      continue;
    }
    if (picks.some((pick) => pick.candidate_id === id)) continue;
    const candidate = state.candidates[id] || {};
    const product = state.products[candidate.product_id] || {};
    const script = Array.isArray(raw.script)
      ? raw.script.map((line) => cleanText(line, 200)).filter(Boolean).slice(0, 6)
      : [];
    picks.push({
      candidate_id: id,
      title: product.name || candidate.title || id,
      fit_score: Number.isFinite(Number(raw.fit_score)) ? Math.max(0, Math.min(100, Math.round(Number(raw.fit_score)))) : null,
      why: cleanText(raw.why, 400),
      risks: cleanText(raw.risks, 400),
      hook: cleanText(raw.hook, 200),
      script,
    });
  }
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.map((note) => cleanText(note, 240)).filter(Boolean).slice(0, 6)
    : [];
  return {
    summary: cleanText(parsed.summary, 600),
    picks,
    notes,
    dropped_candidate_ids: droppedIds.slice(0, 10),
  };
}

/**
 * Asks the model for the shortlist. Returns a result object; refusals are
 * normal results with `ok: false`, never thrown errors.
 */
async function analyzePool(state, options = {}) {
  const env = options.env || process.env;
  const prompt = buildPrompt(state, options.dataLabel);
  const result = await provider.generateScriptDraft({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    model: options.model,
    provider: options.provider,
    timeoutMs: options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs,
    maxOutputTokens: options.maxOutputTokens === undefined ? DEFAULT_MAX_OUTPUT_TOKENS : options.maxOutputTokens,
    allowNetwork: options.allowNetwork === true,
    fetchImpl: options.fetchImpl,
    env,
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.message,
      model: result.model || null,
      network_attempted: result.networkAttempted === true,
      latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    };
  }
  const parsed = parseJsonBlock(result.text);
  if (!parsed) {
    return {
      ok: false,
      status: 'invalid_response',
      message: 'the model answered, but not with usable JSON',
      model: result.model || null,
      network_attempted: result.networkAttempted === true,
      latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    };
  }
  return {
    ok: true,
    status: provider.SUCCESS,
    model: result.model || null,
    network_attempted: result.networkAttempted === true,
    latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    usage: result.usage || null,
    analysis: normalise(parsed, state, options.maxPicks === undefined ? MAX_PICKS : options.maxPicks),
  };
}

/** Cheap round-trip used by the settings panel's connection test. */
async function ping(options = {}) {
  const env = options.env || process.env;
  const result = await provider.generateScriptDraft({
    prompt: 'ตอบด้วยคำว่า OK เท่านั้น',
    systemPrompt: 'ตอบสั้นที่สุดเท่าที่เป็นไปได้',
    model: options.model,
    provider: options.provider,
    timeoutMs: options.timeoutMs === undefined ? 30000 : options.timeoutMs,
    // Reasoning-style models (GLM 5.3, thinking Gemini) can burn a tiny
    // completion budget before writing anything — a 32-token ping returns
    // empty text. 256 tokens on a free model still costs nothing.
    maxOutputTokens: 256,
    allowNetwork: options.allowNetwork === true,
    fetchImpl: options.fetchImpl,
    env,
  });
  return {
    ok: result.ok === true,
    status: result.status,
    message: result.message,
    model: result.model || null,
    latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    usage: result.usage || null,
  };
}

module.exports = {
  MAX_PICKS,
  SYSTEM_PROMPT,
  status,
  buildPrompt,
  parseJsonBlock,
  normalise,
  analyzePool,
  ping,
};
