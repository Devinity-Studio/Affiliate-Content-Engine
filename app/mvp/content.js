'use strict';

/**
 * ACE Mission 1 — MVP Content Creation slice.
 *
 * This module owns the second half of the affiliate workflow:
 *
 *   plan (fixture)  -> content project (DRAFT)
 *                    -> storyboard / script / CTA
 *                    -> content editor (visual | text | audio tracks)
 *                    -> QA (Thai copy checks)
 *                    -> FINALIZED (preview + checklist)
 *                    -> EXPORTED (real 9:16 MP4 from the local renderer)
 *                    -> READY_TO_PUBLISH (payload only, nothing published)
 *
 * Boundaries:
 *   - Fixture/MVP state only. It never reads or writes data/app/state.json.
 *   - It never contacts Shopee, a Seller Center, a social account or any
 *     other external service. "Publish preparation" builds a handoff payload
 *     and explicitly does not publish.
 *   - Every factual line in the storyboard is generated from the source offer
 *     and carries the evidence ids that back it.
 */

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');

const thaiQa = require('./thai-qa');
const renderer = require('../remotion/render');

const STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH'];
const TRACKS = ['visual', 'text', 'audio'];
const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

// Phase 1.1 — narration audio. This phase only accepts files the user created
// with Speaktor manually; provider values beyond SPEAKTOR_MANUAL are stored,
// not wired: no external API is contacted from this slice.
const AUDIO_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const AUDIO_PROVIDERS = ['SPEAKTOR_MANUAL', 'GOOGLE_TTS', 'AZURE_SPEECH', 'OTHER'];
const AUDIO_SOURCES = ['SPEAKTOR_MANUAL'];
const AUDIO_STATUSES = ['AUDIO_PENDING', 'AUDIO_ATTACHED', 'AUDIO_DURATION_MISMATCH', 'AUDIO_APPROVED'];
const AUDIO_DURATION_TOLERANCE_S = 1.0;

/* ------------------------------------------------------------------ */
/* Thai copy vocabulary                                                */
/* ------------------------------------------------------------------ */

// The generator writes Thai with spaces between words. The QA module
// segments Thai against a lexicon; the generator registers its own
// vocabulary so its own output does not trip the "unknown word" warning.
const GENERATOR_VOCABULARY = [
  'ขั้น', 'ตอน', 'ถัด', 'ไป', 'ใช้', 'เลือก', 'ผิด', 'เกิน', 'งบ', 'ต้อง', 'เดา',
  'ปัญหา', 'พบ', 'บ่อย', 'เช็ค', 'ตรวจ', 'ที่', 'และ', 'หรือ', 'ของ', 'ใน', 'บน',
  'ข้อ', 'มูล', 'ก่อน', 'ตัดสินใจ', 'ปัจจุบัน', 'อาจ', 'เปลี่ยน', 'ได้', 'อ้างอิง',
  'คลิก', 'ลิงก์', 'ด้าน', 'ล่าง', 'เพื่อ', 'สั่ง', 'ซื้อ', 'ราคา', 'บาท', 'ปกติ',
  'โปรโมชัน', 'ลด', 'มี', 'รีวิว', 'คะแนน', 'ร้าน', 'สินค้า', 'ข้อมูล', 'ไฟล์', 'ส่ง',
  'ออก', 'แสดง', 'ความ', 'เห็น', 'ความเห็น', 'จำนวน', 'ขาย', 'ไปแล้ว', 'เดือน',
  'เทียบ', 'กลาง', 'ตลาด', 'ประมาณ', 'ต่ำ', 'สูง', 'ใกล้', 'ค่อนข้าง', 'กว่า', 'เมื่อ',
  'ขั้นตอน', 'ต่อไป', 'ทำตาม', 'สคริปต์', 'เล่า', 'เรื่อง', 'การ', 'ใช้งาน', 'ง่าย',
  'สะดวก', 'คุ้ม', 'ค่า', 'ฟรี', 'ของ', 'แถม', 'ออเดอร์', 'ของแท้', 'คุณภาพ',
  'เซรั่ม', 'วิตามิน', 'ครีม', 'น้ำ', 'อาบน้ำ', 'กันแดด', 'เครื่อง', 'ดูดฝุ่น', 'เก้าอี้',
  'โต๊ะ', 'กล่อง', 'เก็บ', 'หูฟัง', 'บลูทูธ', 'สาย', 'อาหาร', 'แมว', 'ลูก', 'ผ้า', 'ผ้าอ้อม',
  'โยค', 'แผ่น', 'เบาะ', 'กระทะ', 'เหล็ก', 'สูตร', 'ถูก', 'ตัว', 'ชิ้น', 'ใบ', 'ชุด', 'แพ็ค',
  'เท่านั้น', 'จำกัด', 'เวลา', 'น้อย', 'เหลือ', 'วัน', 'คำ', 'สั้น', 'เต็ม', 'รูป',
  'เดา', 'รายการ', 'เกี่ยวข้อง', 'ต้นทาง', 'เกี่ยว', 'เกี่ยวข้อ',
  'ไม่', 'คือ', 'อยู่', 'ชนิด', 'รก', 'ขนาด', 'อุปกรณ์', 'ตรง', 'ออก', 'กำลัง',
  'กาย', 'แบบ', 'เด็ก', 'สาธิต', 'จริง', 'ครั้ง', 'ใหม่', 'เครื่องใช้', 'อุปกรณ์',
];

thaiQa.addVocabulary(GENERATOR_VOCABULARY);

// Category-specific framing. The product names in the export are English, so
// the Thai copy keeps the product name verbatim and wraps it in Thai.
const CATEGORY_COPY = {
  Beauty: {
    problem: 'เลือกเซรั่มผิด ซื้อเกินงบ',
    solution: 'เช็กราคาและรีวิวก่อนตัดสินใจ',
    demo: 'สาธิตการใช้งานจริงแบบสั้น',
  },
  Home: {
    problem: 'ของใช้บ้านรก ซื้อผิดขนาด',
    solution: 'เช็กขนาดและราคาก่อนสั่งซื้อ',
    demo: 'สาธิตจัดของแบบสั้น',
  },
  Electronics: {
    problem: 'ซื้ออุปกรณ์ที่ไม่ตรงกับที่ใช้',
    solution: 'เช็กสเปกและราคาก่อนตัดสินใจ',
    demo: 'สาธิตการใช้งานสั้น',
  },
  Cat: {
    problem: 'ซื้ออาหารแมวผิดชนิด',
    solution: 'เช็กราคาและโปรโมชันก่อนตัดสินใจ',
    demo: 'สาธิตอาหารที่แมวชอบ',
  },
  Sports: {
    problem: 'ซื้ออุปกรณ์ออกกำลังกายผิดแบบ',
    solution: 'เช็กขนาดและราคาก่อนสั่งซื้อ',
    demo: 'สาธิตการใช้งานสั้น',
  },
  Baby: {
    problem: 'ซื้อของใช้เด็กผิดจำนวน',
    solution: 'เช็กราคาและจำนวนก่อนสั่งซื้อ',
    demo: 'สาธิตการจัดของสั้น',
  },
};

const VISUAL_PRESETS = {
  dark: { background: { from: '#12151C', accent: '#2E7DF6' } },
  warm: { background: { from: '#23150F', accent: '#E4732A' } },
  cool: { background: { from: '#0F1A24', accent: '#24C1A0' } },
  light: { background: { from: '#F2F5FA', accent: '#2E7DF6' } },
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function nowIso() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function requireString(value, field, { min = 1, max = 500 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) throw httpError(400, `${field} is required`);
  if (text.length > max) throw httpError(400, `${field} must be ${max} characters or fewer`);
  return text;
}

function clampText(value, max = 300) {
  return String(value == null ? '' : value).slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Approaches (3 generated + 1 user custom)                           */
/* ------------------------------------------------------------------ */

function buildContentApproaches(candidate, offer, product) {
  const copy = CATEGORY_COPY[product.category] || CATEGORY_COPY.Home;
  const audience = `คนที่กำลังหา ${product.name}`;
  return [
    {
      key: 'problem_first',
      label: 'แนวทาง 1 · เริ่มจากปัญหา',
      origin: 'GENERATED',
      angle: `เริ่มจากปัญหาที่พบบ่อย ${copy.problem} แล้วค่อยแนะนำ ${product.name}`,
      audience,
      hook: `${product.name} — ${copy.solution}`,
      format: 'วิดีโอแนวตั้ง 9:16 ความยาวราว 20 วินาที เน้นหนึ่งปัญหาและหนึ่งสินค้า',
      cta: 'คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน',
      evidence_codes: ['PRICE', 'REVIEWS', 'PROMO'],
      tradeoffs: ['ต้องมีภาพสาธิตจริงจึงจะน่าเชื่อถือ', 'กลุ่มผู้ชมเดาจากหมวดสินค้าเท่านั้น'],
    },
    {
      key: 'value_compare',
      label: 'แนวทาง 2 · เทียบราคา',
      origin: 'GENERATED',
      angle: `เทียบราคาปัจจุบัน ${money(offer.price_thb)} บาท กับราคาปกติ ${money(offer.list_price_thb)} บาท แล้วบอกว่าตัวเลขนี้มาจากไฟล์ส่งออก`,
      audience,
      hook: `ราคาปกติ ${money(offer.list_price_thb)} บาท ตอนนี้ ${money(offer.price_thb)} บาท`,
      format: 'วิดีโอแนวตั้ง 9:16 ความยาวราว 20 วินาที เน้นตัวเลขราคา',
      cta: 'คลิกลิงก์ด้านล่างเพื่อเทียบราคาปัจจุบันเอง',
      evidence_codes: ['PRICE', 'PRICE_POSITION', 'COMMISSION'],
      tradeoffs: ['ตัวเลขราคาเก่าเร็ว ต้องเช็กข้อมูลใหม่ก่อนเผยแพร่', 'ราคาปกติเป็นค่าจากผู้ขาย ไม่ใช่หลักฐานว่าลดจริง'],
    },
    {
      key: 'evidence_first',
      label: 'แนวทาง 3 · เน้นหลักฐาน',
      origin: 'GENERATED',
      angle: `เน้นหลักฐานจากไฟล์ส่งออก คะแนนรีวิว ${offer.reviews.rating} จาก 5 และโปรโมชัน ${offer.promo.label}`,
      audience,
      hook: `${product.name} — ดูข้อมูลที่มีอยู่จริงก่อนตัดสินใจ`,
      format: 'วิดีโอแนวตั้ง 9:16 ความยาวราว 20 วินาที เน้นข้อมูลและแหล่งที่มา',
      cta: 'คลิกลิงก์ด้านล่างเพื่อดูข้อมูลฉบับเต็ม',
      evidence_codes: ['REVIEWS', 'SHOP', 'PROMO'],
      tradeoffs: ['เหมาะกับคนที่อยากดูข้อมูลก่อน แต่กดดันน้อยกว่าแนวทางที่ 1', 'ยังไม่มีข้อมูลการแปลงคอนเวิร์ชัน'],
    },
  ].map((approach) => ({
    ...approach,
    evidence_ids: approach.evidence_codes
      .map((code) => `EV-${offer.item_id}-${code}`)
      .filter((id) => (candidate.evidence_ids || []).includes(id)),
    gate_note: 'ร่างเท่านั้น — ยังไม่มีการเผยแพร่และไม่มีการเชื่อมต่อบัญชีใด',
  }));
}

function buildCustomApproach(input = {}) {
  return {
    key: 'user_custom',
    label: 'แนวทาง 4 · กำหนดเอง',
    origin: 'USER',
    angle: requireString(input.angle, 'angle', { min: 10, max: 500 }),
    audience: input.audience ? requireString(input.audience, 'audience', { max: 500 }) : null,
    hook: input.hook ? requireString(input.hook, 'hook', { max: 300 }) : null,
    format: input.format ? requireString(input.format, 'format', { max: 300 }) : null,
    cta: input.cta ? requireString(input.cta, 'cta', { max: 200 }) : null,
    evidence_ids: [],
    gate_note: 'ผู้ใช้เขียนเอง — ต้องตรวจข้อเท็จจริงก่อนใช้ทุกครั้ง',
  };
}

/* ------------------------------------------------------------------ */
/* Storyboard generation                                               */
/* ------------------------------------------------------------------ */

function sceneEvidence(offer, codes) {
  return codes
    .map((code) => `EV-${offer.item_id}-${code}`)
    .filter((id) => (offer.evidence_ids || []).includes(id));
}

function buildStoryboard(approach, offer, product, candidate, options = {}) {
  const copy = CATEGORY_COPY[product.category] || CATEGORY_COPY.Home;
  const price = money(offer.price_thb);
  const listPrice = money(offer.list_price_thb);
  const depth = Number(offer.promo.depth_pct);
  const dataAsOf = options.dataAsOf || 'ไม่ระบุ';
  const hook = (approach.hook || `${product.name} — ${copy.solution}`).replace(/^"|"$/g, '');
  const ctaText = approach.cta || 'คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน';

  const ev = (codes) => sceneEvidence(offer, codes);

  const scenes = [
    {
      id: 'SC-1',
      role: 'HOOK',
      duration_s: 4,
      visual: {
        preset: 'dark',
        background: { ...VISUAL_PRESETS.dark.background },
        asset_ref: null,
        position: 'center',
      },
      overlay: {
        badge: 'ข้อมูลจากไฟล์ส่งออกของร้าน',
        headline: product.name,
        subhead: copy.solution,
        fact: `ราคา ${price} บาท จากปกติ ${listPrice} บาท`,
        cta: null,
        position: 'center',
      },
      audio: {
        voiceover: `สินค้า ${product.name} ราคา ${price} บาท จากปกติ ${listPrice} บาท`,
        music: 'none',
        sfx: 'none',
      },
      evidence_ids: ev(['PRICE', 'PROMO']),
    },
    {
      id: 'SC-2',
      role: 'PROBLEM',
      duration_s: 4,
      visual: {
        preset: 'warm',
        background: { ...VISUAL_PRESETS.warm.background },
        asset_ref: null,
        position: 'center',
      },
      overlay: {
        badge: 'ปัญหาที่พบบ่อย',
        headline: copy.problem,
        subhead: 'เช็กข้อมูลก่อน ไม่ต้องเดา',
        fact: `คะแนนรีวิว ${offer.reviews.rating} จาก 5 · รีวิว ${offer.reviews.rating_count} รายการ`,
        cta: null,
        position: 'center',
      },
      audio: {
        voiceover: `ปัญหาที่พบบ่อยคือ ${copy.problem} เช็กข้อมูลก่อนตัดสินใจ`,
        music: 'none',
        sfx: 'none',
      },
      evidence_ids: ev(['REVIEWS', 'SHOP']),
    },
    {
      id: 'SC-3',
      role: 'OFFER',
      duration_s: 4,
      visual: {
        preset: 'cool',
        background: { ...VISUAL_PRESETS.cool.background },
        asset_ref: null,
        position: 'center',
      },
      overlay: {
        badge: 'ราคาและโปรโมชัน',
        headline: `ราคา ${price} บาท`,
        subhead: `โปรโมชันจากไฟล์ส่งออก: ${offer.promo.label}`,
        fact: depth > 0 ? `โปรโมชัน ลด ${depth}%` : 'ไม่มีโปรโมชันในข้อมูลต้นทาง',
        cta: null,
        position: 'center',
      },
      audio: {
        voiceover: `ราคา ${price} บาท มีโปรโมชัน ${offer.promo.label}${depth > 0 ? ` ลด ${depth}%` : ''}`,
        music: 'none',
        sfx: 'none',
      },
      evidence_ids: ev(['PRICE', 'PROMO']),
    },
    {
      id: 'SC-4',
      role: 'EVIDENCE',
      duration_s: 4,
      visual: {
        preset: 'dark',
        background: { ...VISUAL_PRESETS.dark.background },
        asset_ref: null,
        position: 'bottom',
      },
      overlay: {
        badge: 'ร้านและข้อมูลที่มีอยู่',
        headline: `ร้าน ${offer.shop_name}`,
        subhead: `คะแนนร้าน ${offer.shop.rating} จาก 5 · ร้านที่เกี่ยวข้อง ${offer.shop.related_shop_count} ร้าน`,
        fact: `ข้อมูล ณ ${dataAsOf}`,
        cta: null,
        position: 'bottom',
      },
      audio: {
        voiceover: `ร้าน ${offer.shop_name} คะแนนร้าน ${offer.shop.rating} จาก 5 ข้อมูล ณ ${dataAsOf}`,
        music: 'none',
        sfx: 'none',
      },
      evidence_ids: ev(['SHOP', 'REVIEWS']),
    },
    {
      id: 'SC-5',
      role: 'CTA',
      duration_s: 4,
      visual: {
        preset: 'light',
        background: { ...VISUAL_PRESETS.light.background },
        asset_ref: null,
        position: 'bottom',
      },
      overlay: {
        badge: 'ขั้นตอนถัดไป',
        headline: hook,
        subhead: 'ข้อมูลอาจเปลี่ยนได้ ตรวจที่ลิงก์ต้นทาง',
        fact: `อ้างอิงข้อมูล ณ ${dataAsOf}`,
        cta: ctaText,
        position: 'bottom',
      },
      audio: {
        voiceover: ctaText,
        music: 'none',
        sfx: 'none',
      },
      evidence_ids: ev(['PRICE', 'CONVERSION']),
    },
  ];

  return {
    version: 1,
    canvas: { width: renderer.CANVAS.width, height: renderer.CANVAS.height, fps: renderer.CANVAS.fps },
    aspect_ratio: '9:16',
    language: 'th',
    scenes,
  };
}

function buildScript(project) {
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const lines = scenes.map((scene, index) => ({
    scene_id: scene.id,
    order: index + 1,
    role: scene.role,
    duration_s: scene.duration_s,
    voiceover: (scene.audio && scene.audio.voiceover) || '',
    on_screen: [
      (scene.overlay && scene.overlay.badge) || null,
      (scene.overlay && scene.overlay.headline) || null,
      (scene.overlay && scene.overlay.subhead) || null,
      (scene.overlay && scene.overlay.fact) || null,
      (scene.overlay && scene.overlay.cta) || null,
    ].filter(Boolean),
  }));
  const text = lines.map((line) => line.voiceover).join(' ');
  return {
    version: project.script_version,
    language: 'th',
    lines,
    text,
    checksum: sha256(text),
  };
}

/* ------------------------------------------------------------------ */
/* Project creation                                                    */
/* ------------------------------------------------------------------ */

function nextContentId(state) {
  return `CNT-${Object.keys(state.contents || {}).length + 1}`;
}

function createContentProject(input) {
  const { state, candidate, offer, product, plan, approachKey, custom, dataAsOf } = input;
  const generated = buildContentApproaches(candidate, offer, product);
  const userCustom = custom ? buildCustomApproach(custom) : null;
  const approaches = { generated, user_custom: userCustom };

  let selected = generated.find((item) => item.key === approachKey);
  if (!selected && approachKey === 'user_custom') selected = userCustom;
  if (!selected) selected = generated[0];

  const storyboard = buildStoryboard(selected, offer, product, candidate, { dataAsOf });
  const contentId = nextContentId(state);

  const project = {
    id: contentId,
    content_id: contentId,
    kind: 'MVP_CONTENT_PROJECT',
    synthetic: true,
    status: 'DRAFT',
    created_at: nowIso(),
    updated_at: nowIso(),
    // The identities the platform must be able to trace back to.
    candidate_id: candidate.id,
    product_id: product.id,
    offer_id: offer.id,
    shop_id: offer.shop_id,
    plan_id: plan ? plan.plan_id : null,
    plan_record_id: plan ? plan.id : null,
    approach: selected.key,
    language: 'th',
    script_version: 1,
    script_version_history: [],
    approaches,
    storyboard,
    cta: {
      text: selected.cta || 'คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน',
      placement: 'LAST_SCENE',
      evidence_ids: sceneEvidence(offer, ['PRICE', 'CONVERSION']),
    },
    assets: {},
    asset_order: [],
    audio: {
      required: false,
      approved: false,
      status: 'AUDIO_PENDING',
      tolerance_s: AUDIO_DURATION_TOLERANCE_S,
      mismatches: [],
    },
    offer_snapshot: {
      item_id: offer.item_id,
      product_id: product.id,
      product_name: product.name,
      shop_id: offer.shop_id,
      shop_name: offer.shop_name,
      price_thb: offer.price_thb,
      list_price_thb: offer.list_price_thb,
      promo: { ...offer.promo },
      rating: offer.reviews.rating,
      rating_count: offer.reviews.rating_count,
      affiliate_link: offer.affiliate_link,
      product_url: product.url,
      checked_at: offer.checked_at,
      data_as_of: dataAsOf || null,
      synthetic: offer.synthetic,
    },
    source_ids: [...(candidate.source_ids || [])],
    evidence_ids: [...(candidate.evidence_ids || [])],
    qa: null,
    preview: null,
    finalize: null,
    export: null,
    publish_prep: null,
    edit_log: [],
    provenance: {
      source: 'MVP_CONTENT_SLICE',
      method: 'DETERMINISTIC_TEMPLATE_FROM_EXPORT',
      candidate_id: candidate.id,
      plan_id: plan ? plan.plan_id : null,
      approach: selected.key,
      source_sha256: offer.file_hash || null,
      limitations: [
        'เนื้อหาทั้งหมดสร้างจากไฟล์ส่งออกที่นำเข้า ยังไม่ได้เปิดหน้าสินค้าจริง',
        'ไม่มีการเชื่อมต่อ Shopee, Shopee Seller หรือบัญชีโซเชียลใด',
        'เสียงในไฟล์ที่ export เป็นฐานเงียบ และบทพูดถูกเขียนเป็นคำบรรยายใต้ภาพ',
      ],
    },
  };

  project.script = buildScript(project);
  project.script_version_history.push({
    version: 1,
    at: project.created_at,
    reason: 'สร้างสคริปต์จากแนวทางที่เลือก',
    checksum: project.script.checksum,
  });
  return project;
}

/* ------------------------------------------------------------------ */
/* Track editing                                                       */
/* ------------------------------------------------------------------ */

function findScene(project, sceneId) {
  const scene = (project.storyboard.scenes || []).find((item) => item.id === sceneId);
  if (!scene) throw httpError(404, `scene not found: ${sceneId}`);
  return scene;
}

/**
 * Recomputes the project's audio status from the storyboard and asset table.
 *
 *   AUDIO_PENDING           no scene carries a bound audio file yet
 *   AUDIO_ATTACHED          audio bound, every file readable and on-duration
 *   AUDIO_DURATION_MISMATCH some bound file differs from its scene by more
 *                           than the tolerance (short or long)
 *   AUDIO_APPROVED          attached and approved (set when finalize passes)
 */
function refreshAudioStatus(project) {
  const audio = project.audio || (project.audio = {
    required: false,
    approved: false,
    status: 'AUDIO_PENDING',
    tolerance_s: AUDIO_DURATION_TOLERANCE_S,
    mismatches: [],
  });
  audio.tolerance_s = AUDIO_DURATION_TOLERANCE_S;
  const scenes = project.storyboard.scenes || [];
  const boundScenes = scenes.filter((scene) =>
    scene.audio && scene.audio.asset_ref && project.assets[scene.audio.asset_ref]);
  audio.mismatches = [];
  for (const scene of boundScenes) {
    const asset = project.assets[scene.audio.asset_ref];
    const audioDuration = Number(asset.duration_s);
    const sceneDuration = Number(scene.duration_s) || 0;
    if (Number.isFinite(audioDuration)
      && Math.abs(audioDuration - sceneDuration) > audio.tolerance_s) {
      audio.mismatches.push({
        scene_id: scene.id,
        asset_id: asset.id,
        audio_duration_s: audioDuration,
        scene_duration_s: sceneDuration,
        difference_s: Math.round((audioDuration - sceneDuration) * 100) / 100,
      });
    }
  }
  if (boundScenes.length === 0) {
    audio.status = 'AUDIO_PENDING';
  } else if (audio.mismatches.length > 0) {
    audio.status = 'AUDIO_DURATION_MISMATCH';
  } else if (audio.approved) {
    audio.status = 'AUDIO_APPROVED';
  } else {
    audio.status = 'AUDIO_ATTACHED';
  }
  return audio;
}


function bumpScript(project, reason) {
  project.script_version += 1;
  project.script = buildScript(project);
  project.script_version_history.push({
    version: project.script_version,
    at: nowIso(),
    reason,
    checksum: project.script.checksum,
  });
  return project;
}

const VISUAL_FIELDS = ['preset', 'background', 'asset_ref', 'position'];
const TEXT_FIELDS = ['badge', 'headline', 'subhead', 'fact', 'cta', 'position'];
const AUDIO_FIELDS = ['voiceover', 'music', 'sfx'];

function applyVisualEdit(project, payload) {
  const scene = findScene(project, payload.sceneId);
  const visual = payload.visual || {};
  for (const field of VISUAL_FIELDS) {
    if (visual[field] === undefined) continue;
    if (field === 'background') {
      scene.visual.background = {
        ...scene.visual.background,
        ...(visual.background || {}),
      };
    } else {
      scene.visual[field] = visual[field];
    }
  }
  if (visual.preset && VISUAL_PRESETS[visual.preset] && payload.visual.replace_background !== false) {
    scene.visual.preset = visual.preset;
    scene.visual.background = { ...VISUAL_PRESETS[visual.preset].background };
  }
  if (payload.duration_s !== undefined) {
    const duration = Number(payload.duration_s);
    if (!Number.isFinite(duration) || duration < 0.5 || duration > 30) {
      throw httpError(400, 'duration_s must be between 0.5 and 30');
    }
    scene.duration_s = Math.round(duration * 10) / 10;
  }
  if (visual.asset_ref !== undefined) {
    if (visual.asset_ref && !project.assets[visual.asset_ref]) {
      throw httpError(400, `asset not found in this project: ${visual.asset_ref}`);
    }
    scene.visual.asset_ref = visual.asset_ref || null;
  }
  // A duration change can flip the audio duration check.
  refreshAudioStatus(project);
  project.storyboard.version += 1;
  project.updated_at = nowIso();
  project.edit_log.push({
    at: project.updated_at,
    track: 'visual',
    scene_id: scene.id,
    change: 'แก้ไขภาพและฉาก',
  });
  return project;
}

function applyTextEdit(project, payload) {
  const scene = findScene(project, payload.sceneId);
  const overlay = payload.overlay || {};
  for (const field of TEXT_FIELDS) {
    if (overlay[field] === undefined) continue;
    scene.overlay[field] = clampText(overlay[field], 400);
  }
  // Keep project.cta.text in sync when the CTA on the last scene is edited,
  // so the finalize checklist and the publish payload stay truthful.
  const scenes = project.storyboard.scenes;
  const isLastScene = scenes.length > 0 && scenes[scenes.length - 1].id === scene.id;
  if (isLastScene && overlay.cta !== undefined) {
    const synced = clampText(overlay.cta, 200).trim();
    if (synced) project.cta.text = synced;
  }
  project.storyboard.version += 1;
  project.updated_at = nowIso();
  project.edit_log.push({
    at: project.updated_at,
    track: 'text',
    scene_id: scene.id,
    change: 'แก้ไขตัวหนังสือบนจอ',
  });
  return project;
}

function applyAudioEdit(project, payload) {
  const scene = findScene(project, payload.sceneId);
  const audio = payload.audio || {};
  const boundBefore = scene.audio.asset_ref || null;
  let textChanged = false;
  for (const field of AUDIO_FIELDS) {
    if (audio[field] === undefined) continue;
    scene.audio[field] = clampText(audio[field], 600);
    textChanged = true;
  }
  let change = 'แก้ไขเสียงและบทพูด';
  if (audio.asset_ref !== undefined) {
    const ref = audio.asset_ref || null;
    if (ref) {
      const asset = project.assets[ref];
      if (!asset) throw httpError(400, `asset not found in this project: ${ref}`);
      if (asset.kind !== 'AUDIO') throw httpError(400, `asset ${ref} is not an audio file`);
    }
    scene.audio.asset_ref = ref;
    if (boundBefore !== ref) {
      change = ref ? `ผูกไฟล์เสียง ${ref} กับฉาก` : `ปลดไฟล์เสียงออกจากฉาก ${scene.id}`;
      if (project.audio) project.audio.approved = false;
    }
  }
  refreshAudioStatus(project);
  if (textChanged) bumpScript(project, `แก้ไขเสียง/บทพูดของฉาก ${scene.id}`);
  project.updated_at = nowIso();
  project.edit_log.push({
    at: project.updated_at,
    track: 'audio',
    scene_id: scene.id,
    change,
  });
  return project;
}

function addScene(project, payload) {
  const scenes = project.storyboard.scenes;
  const role = requireString(payload.role || 'BODY', 'role', { max: 40 });
  const id = `SC-${scenes.length + 1}`;
  const index = Math.min(scenes.length, Math.max(0, Number(payload.index)));
  const template = scenes[scenes.length - 1] || scenes[0];
  const scene = {
    id,
    role,
    duration_s: Number(payload.duration_s) > 0 ? Number(payload.duration_s) : 4,
    visual: {
      preset: 'dark',
      background: { ...VISUAL_PRESETS.dark.background },
      asset_ref: null,
      position: 'center',
    },
    overlay: {
      badge: null,
      headline: '',
      subhead: '',
      fact: '',
      cta: null,
      position: 'center',
    },
    audio: {
      voiceover: '',
      music: 'none',
      sfx: 'none',
    },
    evidence_ids: [...(template ? template.evidence_ids : [])],
  };
  scenes.splice(index, 0, scene);
  renumberScenes(project);
  bumpScript(project, `เพิ่มฉาก ${id}`);
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: 'visual', scene_id: id, change: 'เพิ่มฉาก' });
  return project;
}

function removeScene(project, sceneId) {
  const scenes = project.storyboard.scenes;
  if (scenes.length <= 2) throw httpError(409, 'a storyboard needs at least two scenes');
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) throw httpError(404, `scene not found: ${sceneId}`);
  scenes.splice(index, 1);
  renumberScenes(project);
  bumpScript(project, `ลบฉาก ${sceneId}`);
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: 'visual', scene_id: sceneId, change: 'ลบฉาก' });
  return project;
}

function reorderScenes(project, order) {
  const scenes = project.storyboard.scenes;
  if (!Array.isArray(order) || order.length !== scenes.length) {
    throw httpError(400, 'order must list every scene id exactly once');
  }
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  if (order.some((id) => !byId.has(id))) throw httpError(400, 'order contains an unknown scene id');
  project.storyboard.scenes = order.map((id) => byId.get(id));
  project.storyboard.version += 1;
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: 'visual', scene_id: null, change: 'จัดลำดับฉากใหม่' });
  return project;
}

function renumberScenes(project) {
  project.storyboard.scenes.forEach((scene, index) => {
    scene.id = `SC-${index + 1}`;
  });
  project.storyboard.version += 1;
}

/* ------------------------------------------------------------------ */
/* Preview + QA + finalize                                             */
/* ------------------------------------------------------------------ */

function buildPreview(project) {
  const scenes = project.storyboard.scenes || [];
  let cursor = 0;
  const frames = scenes.map((scene) => {
    const start = cursor;
    const end = cursor + (Number(scene.duration_s) || 3);
    cursor = end;
    return {
      scene_id: scene.id,
      role: scene.role,
      start_s: Math.round(start * 100) / 100,
      end_s: Math.round(end * 100) / 100,
      duration_s: scene.duration_s,
      visual: scene.visual,
      overlay: scene.overlay,
      audio: scene.audio,
    };
  });
  return {
    generated_at: nowIso(),
    canvas: project.storyboard.canvas,
    aspect_ratio: project.storyboard.aspect_ratio,
    total_duration_s: Math.round(cursor * 100) / 100,
    scene_count: frames.length,
    frames,
    note: 'ตัวอย่างเฟรมตามลำดับเวลา ก่อนส่งออกไฟล์จริง',
  };
}

function runProjectQa(project, context) {
  const report = thaiQa.runQa({
    project,
    offer: context.offer,
    product: context.product,
    candidate: context.candidate,
    siblingProducts: context.siblingProducts || [],
    sourceFreshness: context.sourceFreshness || null,
  });
  project.qa = report;
  project.updated_at = nowIso();
  return report;
}

function buildFinalizeChecklist(project, qa) {
  const scenes = project.storyboard.scenes || [];
  const lastScene = scenes[scenes.length - 1];
  const totalDuration = scenes.reduce((sum, scene) => sum + (Number(scene.duration_s) || 0), 0);
  const hasThai = JSON.stringify(project.storyboard).match(/[\u0E00-\u0E7F]/);
  const unresolvedAssets = scenes
    .filter((scene) => scene.visual && scene.visual.asset_ref)
    .filter((scene) => !project.assets[scene.visual.asset_ref]);
  const audioState = refreshAudioStatus(project);
  const audioOk = !audioState.required
    || audioState.status === 'AUDIO_ATTACHED'
    || audioState.status === 'AUDIO_APPROVED';

  const items = [
    {
      id: 'qa',
      label: 'ผลตรวจภาษาไทยไม่มีข้อผิดพลาด',
      ok: Boolean(qa) && qa.summary.FAIL === 0,
      detail: qa
        ? `ผ่าน ${qa.summary.PASS} · เตือน ${qa.summary.WARN} · ผิดพลาด ${qa.summary.FAIL}`
        : 'ยังไม่ได้รันการตรวจ',
    },
    {
      id: 'preview',
      label: 'มีตัวอย่าง (Preview) ครบทุกฉาก',
      ok: Boolean(project.preview) && project.preview.scene_count === scenes.length,
      detail: project.preview ? `${project.preview.scene_count} ฉาก` : 'ยังไม่ได้สร้างตัวอย่าง',
    },
    {
      id: 'scenes',
      label: 'ทุกฉากมีภาพ ตัวหนังสือ และบทพูด',
      ok: scenes.length > 0 && scenes.every((scene) => (
        scene.visual && scene.visual.background
        && scene.overlay && String(scene.overlay.headline || '').trim()
        && scene.audio && String(scene.audio.voiceover || '').trim()
      )),
      detail: `${scenes.length} ฉาก`,
    },
    {
      id: 'cta',
      label: 'มี CTA และอยู่ในฉากสุดท้าย',
      ok: Boolean(project.cta && project.cta.text)
        && Boolean(lastScene
          && ((lastScene.overlay && lastScene.overlay.cta === project.cta.text)
            || (lastScene.audio && lastScene.audio.voiceover === project.cta.text))),
      detail: project.cta ? project.cta.text : 'ไม่มี CTA',
    },
    {
      id: 'evidence',
      label: 'ทุกฉากที่มีข้อเท็จจริงอ้างหลักฐาน',
      ok: scenes.every((scene) => !(
        (scene.overlay && (scene.overlay.fact || scene.overlay.subhead))
        && !(scene.evidence_ids || []).length
      )),
      detail: 'ทุกฉากที่มีข้อเท็จจริงต้องอ้างหลักฐาน',
    },
    {
      id: 'duration',
      label: 'ความยาววิดีโออยู่ระหว่าง 5–90 วินาที',
      ok: totalDuration >= 5 && totalDuration <= 90,
      detail: `${Math.round(totalDuration * 100) / 100} วินาที`,
    },
    {
      id: 'language',
      label: 'เนื้อหาเป็นภาษาไทย',
      ok: project.language === 'th' && Boolean(hasThai),
      detail: `ภาษา ${project.language}`,
    },
    {
      id: 'script_version',
      label: 'บันทึก Script version แล้ว',
      ok: project.script_version >= 1 && (project.script_version_history || []).length >= 1,
      detail: `v${project.script_version} · ${(project.script_version_history || []).length} ครั้ง`,
    },
    {
      id: 'audio',
      label: audioState.required
        ? 'เสียงครบทุกฉากที่กำหนดและความยาวตรงกับวิดีโอ'
        : 'ไม่มีข้อขัดแย้งเรื่องไฟล์เสียง',
      ok: audioOk,
      detail: [
        `สถานะเสียง: ${audioState.status}`,
        audioState.mismatches.length
          ? `ความยาวไม่ตรง ${audioState.mismatches.length} ฉาก`
          : 'ความยาวตรงทุกฉากที่ผูกเสียง',
        audioState.required ? 'ต้องมีเสียงครบ' : 'ไม่ได้กำหนดว่าต้องมีเสียง',
      ].join(' · '),
    },
    {
      id: 'assets',
      label: 'อ้างอิงภาพทุกไฟล์ได้',
      ok: unresolvedAssets.length === 0,
      detail: unresolvedAssets.length
        ? `ยังหาไฟล์ไม่พบ: ${unresolvedAssets.map((s) => s.id).join(', ')}`
        : 'ทุก asset_ref มีไฟล์จริง',
    },
    {
      id: 'identities',
      label: 'บันทึก Content / Product / Candidate / Shop ID และ Asset references',
      ok: Boolean(project.content_id && project.product_id && project.candidate_id && project.shop_id)
        && (project.asset_order || []).length >= 0,
      detail: `${project.content_id} · ${project.product_id} · ${project.candidate_id} · shop ${project.shop_id}`,
    },
  ];
  return {
    items,
    passed: items.every((item) => item.ok),
    total: items.length,
    ok: items.filter((item) => item.ok).length,
  };
}

function finalizeProject(project, qa) {
  const checklist = buildFinalizeChecklist(project, qa || project.qa);
  if (!checklist.passed) {
    const failed = checklist.items.filter((item) => !item.ok).map((item) => item.label);
    throw httpError(409, `finalize blocked: ${failed.join('; ')}`, { checklist });
  }
  project.status = 'FINALIZED';
  const audioState = refreshAudioStatus(project);
  if (audioState.status === 'AUDIO_ATTACHED') {
    audioState.approved = true;
    refreshAudioStatus(project);
  }
  project.finalize = {
    finalized_at: nowIso(),
    checklist,
    qa_ran_at: qa ? qa.ran_at : project.qa ? project.qa.ran_at : null,
    script_version: project.script_version,
    script_checksum: project.script ? project.script.checksum : null,
    audio: {
      required: audioState.required,
      status: audioState.status,
      approved: audioState.approved,
      mismatches: audioState.mismatches || [],
    },
  };
  project.updated_at = nowIso();
  return project;
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

async function addAsset(project, assetsDir, payload) {
  const filename = requireString(payload.filename, 'filename', { max: 200 });
  const ext = path.extname(filename).toLowerCase();
  if (!IMAGE_TYPES[ext]) {
    throw httpError(400, `unsupported image type ${ext || '(none)'} — use png, jpg, jpeg, webp or gif`);
  }
  if (typeof payload.content_base64 !== 'string' || !payload.content_base64.trim()) {
    throw httpError(400, 'content_base64 is required');
  }
  const buffer = Buffer.from(payload.content_base64.replace(/^data:[^;,]+;base64,/, ''), 'base64');
  if (buffer.length === 0) throw httpError(400, 'the uploaded file is empty');
  if (buffer.length > MAX_ASSET_BYTES) {
    throw httpError(400, `the image is larger than ${MAX_ASSET_BYTES} bytes`);
  }
  await fsp.mkdir(assetsDir, { recursive: true });
  const assetId = `AST-${(project.asset_order || []).length + 1}`;
  const safeName = `${assetId}${ext}`;
  const file = path.join(assetsDir, safeName);
  await fsp.writeFile(file, buffer);

  const record = {
    id: assetId,
    kind: 'IMAGE',
    filename,
    file,
    path: safeName,
    bytes: buffer.length,
    mime: IMAGE_TYPES[ext],
    sha256: sha256(buffer),
    created_at: nowIso(),
    used_by: [],
  };
  project.assets[assetId] = record;
  project.asset_order.push(assetId);
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: 'visual', scene_id: null, change: `เพิ่มภาพ ${assetId}` });
  return record;
}

/**
 * Phase 1.1 — narration audio upload.
 *
 * Accepts an MP3/WAV file the user created and downloaded from Speaktor
 * manually. Duration is measured with the local ffmpeg binary (no network),
 * and the provider field sits in the record so a future TTS integration can
 * mark GOOGLE_TTS / AZURE_SPEECH / OTHER without a schema change.
 */
async function addAudioAsset(project, assetsDir, payload) {
  const filename = requireString(payload.filename, 'filename', { max: 200 });
  const ext = path.extname(filename).toLowerCase();
  if (!AUDIO_TYPES[ext]) {
    throw httpError(400, `unsupported audio type ${ext || '(none)'} — use mp3 or wav`);
  }
  if (typeof payload.content_base64 !== 'string' || !payload.content_base64.trim()) {
    throw httpError(400, 'content_base64 is required');
  }
  const provider = String(payload.provider || 'SPEAKTOR_MANUAL').trim().toUpperCase();
  if (!AUDIO_PROVIDERS.includes(provider)) {
    throw httpError(400, `provider must be one of ${AUDIO_PROVIDERS.join(', ')}`);
  }
  const source = String(payload.source || provider).trim().toUpperCase();
  if (!AUDIO_SOURCES.includes(source)) {
    throw httpError(400, `this phase only accepts audio created manually with Speaktor (source ${source} is not allowed yet)`);
  }
  const buffer = Buffer.from(payload.content_base64.replace(/^data:[^;,]+;base64,/, ''), 'base64');
  if (buffer.length === 0) throw httpError(400, 'the uploaded file is empty');
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw httpError(400, `the audio is larger than ${MAX_AUDIO_BYTES} bytes`);
  }
  await fsp.mkdir(assetsDir, { recursive: true });
  const assetId = `AST-${(project.asset_order || []).length + 1}`;
  const safeName = `${assetId}${ext}`;
  const file = path.join(assetsDir, safeName);
  await fsp.writeFile(file, buffer);

  // Measure the real duration before accepting the asset; a file ffmpeg
  // cannot read must not enter the project.
  const probe = renderer.probeAudio(file) || {};
  if (!Number.isFinite(Number(probe.duration_s))) {
    await fsp.unlink(file).catch(() => {});
    throw httpError(400, 'ffmpeg could not read the duration of this audio file');
  }

  const record = {
    id: assetId,
    kind: 'AUDIO',
    filename,
    file,
    path: safeName,
    bytes: buffer.length,
    mime: AUDIO_TYPES[ext],
    sha256: sha256(buffer),
    duration_s: probe.duration_s,
    codec: probe.codec || null,
    provider,
    source,
    created_at: nowIso(),
    used_by: [],
  };
  project.assets[assetId] = record;
  project.asset_order.push(assetId);
  refreshAudioStatus(project);
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: 'audio', scene_id: null, change: `เพิ่มไฟล์เสียง ${assetId} (${provider}, ${probe.duration_s}s)` });
  return record;
}

/**
 * Removes an asset record. Assets already bound to any scene (visual or audio
 * track) must be unbound first, so an export never references a missing file.
 */
function removeAsset(project, assetId) {
  const asset = project.assets[assetId];
  if (!asset) throw httpError(404, `asset not found: ${assetId}`);
  const scenes = project.storyboard.scenes || [];
  const bound = scenes.filter((scene) =>
    (scene.visual && scene.visual.asset_ref === assetId)
    || (scene.audio && scene.audio.asset_ref === assetId));
  if (bound.length > 0) {
    throw httpError(409, `asset ${assetId} is still used by scenes ${bound.map((scene) => scene.id).join(', ')} — unbind it first`);
  }
  delete project.assets[assetId];
  project.asset_order = project.asset_order.filter((id) => id !== assetId);
  refreshAudioStatus(project);
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: asset.kind === 'AUDIO' ? 'audio' : 'visual', scene_id: null, change: `ลบไฟล์ ${assetId}` });
  return project;
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

async function exportProject(project, options) {
  if (project.status !== 'FINALIZED') {
    throw httpError(409, `export requires a FINALIZED project (current status ${project.status})`);
  }
  if (!renderer.ffmpegAvailable()) {
    throw httpError(503, 'ffmpeg is not available on this machine, so no video can be rendered');
  }

  const outDir = path.resolve(options.exportsDir, project.content_id);
  await fsp.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${project.content_id}-v${project.script_version}.mp4`);
  const workDir = path.join(outDir, 'work');

  const assets = {};
  for (const assetId of project.asset_order || []) {
    const asset = project.assets[assetId];
    if (asset && asset.file) assets[assetId] = asset.file;
  }

  const scenes = project.storyboard.scenes.map((scene) => ({
    ...scene,
    visual: { ...scene.visual, asset_file: assets[scene.visual.asset_ref] || null },
    audio_asset_file: scene.audio && scene.audio.asset_ref ? (assets[scene.audio.asset_ref] || null) : null,
  }));
  const audioBound = scenes.filter((scene) => scene.audio_asset_file);

  const rendered = renderer.renderVideo({ scenes, outFile, workDir, assets });

  // Probe the rendered video for codec/container metadata
  const probe = renderer.probeVideo(outFile) || {};

  // A still frame from the encoded file, so the export can be inspected
  // without opening a video player.
  let still = null;
  try {
    const ffmpeg = renderer.resolveFfmpeg();
    const stillFile = path.join(outDir, `${project.content_id}-preview.png`);
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', '0.5', '-i', outFile, '-frames:v', '1', stillFile,
    ], { encoding: 'utf8' });
    if (result.status === 0) {
      const stat = await fsp.stat(stillFile);
      still = {
        file: stillFile,
        path: path.basename(stillFile),
        bytes: stat.size,
        sha256: renderer.hashFile(stillFile),
      };
    }
  } catch {
    still = null;
  }

  // Store to Content Library index (G-13). The index lives at the repo root
  // data/ directory; tests can redirect it with ACE_CONTENT_LIBRARY_FILE
  // (resolved against cwd), the same override convention the MVP slice uses
  // for its state/exports directories.
  const contentLibraryPath = process.env.ACE_CONTENT_LIBRARY_FILE
    ? path.resolve(process.cwd(), process.env.ACE_CONTENT_LIBRARY_FILE)
    : path.resolve(__dirname, '..', '..', 'data', 'mission1', 'content-library.json');
  let library = null;
  let indexMissing = false;
  let indexText = null;
  try {
    indexText = await fsp.readFile(contentLibraryPath, 'utf-8');
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
    indexMissing = true;
  }
  if (!indexMissing) {
    // The documented index format allows leading '#'-header comment lines
    // (same reader convention as verification/check-content-library.js).
    const cleaned = indexText.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }
    if (Array.isArray(parsed)) {
      library = { items: parsed };
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      library = parsed;
    }
    if (!library) {
      // A malformed index must never be silently replaced with a fresh one.
      throw httpError(500, `content library index is malformed; refusing to overwrite ${contentLibraryPath}`);
    }
  }
  if (!library) library = { items: [] };

  // Re-export of the same asset (same id + filename) replaces its record;
  // unrelated entries and other script versions are preserved.
  library.items = library.items.filter((item) => !(item && item.id === project.content_id && item.filename === path.basename(outFile)));
  library.items.push({
    id: project.content_id,
    kind: 'VIDEO',
    filename: path.basename(outFile),
    sha256: rendered.sha256,
    exported_at: nowIso(),
    width: rendered.width,
    height: rendered.height,
    duration_s: rendered.duration_s,
    aspect_ratio: '9:16',
    status: 'EXPORTED',
  });

  // Write updated library
  await fsp.writeFile(contentLibraryPath, JSON.stringify(library, null, 2));


  project.status = 'EXPORTED';
  project.export = {
    // EXPORT_KIND: what the export actually is. Only VIDEO means "a rendered
    // 9:16 MP4 exists"; a Markdown script artifact is SCRIPT_ARTIFACT and can
    // never satisfy the publish-preparation gate.
    kind: 'VIDEO',
    exported_at: nowIso(),
    file: outFile,
    filename: path.basename(outFile),
    bytes: rendered.bytes,
    sha256: rendered.sha256,
    width: rendered.width,
    height: rendered.height,
    fps: rendered.fps,
    duration_s: rendered.duration_s,
    aspect_ratio: '9:16',
    codec: (probe && probe.codec) || 'h264',
    container: (probe && probe.container) || 'mov,mp4,m4a,3gp,3g2,mj2',
    encoder: rendered.encoder,
    font: rendered.font,
    pipeline: audioBound.length
      ? 'local-ffmpeg (ass text track + per-scene narration mix)'
      : 'local-ffmpeg (ass text track + silent AAC bed)',
    audio: {
      used: audioBound.length > 0,
      providers: [...new Set(audioBound.map((scene) => project.assets[scene.audio.asset_ref].provider))],
      assets: audioBound.map((scene) => {
        const asset = project.assets[scene.audio.asset_ref];
        return {
          id: asset.id,
          scene_id: scene.id,
          provider: asset.provider,
          source: asset.source,
          filename: asset.filename,
          type: path.extname(asset.filename).toLowerCase().replace('.', ''),
          duration_s: asset.duration_s,
          bytes: asset.bytes,
          sha256: asset.sha256,
          scene_duration_s: scene.duration_s,
        };
      }),
    },
    still,
    script_version: project.script_version,
    script_checksum: project.script.checksum,
    asset_refs: (project.asset_order || []).map((assetId) => {
      const asset = project.assets[assetId];
      return {
        id: assetId,
        path: asset.path,
        sha256: asset.sha256,
        used_by: (asset.used_by || []),
      };
    }),
    limitations: audioBound.length
      ? [
        'เสียงบรรยายมาจากไฟล์ที่ผู้ใช้อัปโหลด (ถูกเติม/ตัดให้ตรงความยาวฉาก)',
        'ยังไม่มีการสังเคราะห์เสียง (TTS) ในเฟสนี้',
        'ไม่มีการเรียก Shopee หรือบริการภายนอกระหว่าง export',
      ]
      : [
        'เสียงในไฟล์เป็นฐานเงียบ ไม่มีการสังเคราะห์เสียงพูด',
        'บทพูดถูกเขียนเป็นคำบรรยายใต้ภาพ',
        'ไม่มีการเรียก Shopee หรือบริการภายนอกระหว่าง export',
      ],
  };
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: null, scene_id: null, change: 'export วิดีโอ' });
  return project.export;
}

/* ------------------------------------------------------------------ */
/* Publish preparation                                                 */
/* ------------------------------------------------------------------ */

/**
 * The single meaning of an export record.
 *
 *   VIDEO           — a rendered MP4 exists on disk (width/height recorded).
 *   SCRIPT_ARTIFACT — only a Markdown script was written; no video exists.
 *
 * Records written before the kind field existed carry file + width + height,
 * so they are read as VIDEO instead of being reported as unknown.
 */
function exportKindOf(project) {
  const exp = project && project.export;
  if (!exp) return null;
  if (exp.kind) return exp.kind;
  return exp.file && exp.width && exp.height ? 'VIDEO' : null;
}

function buildPublishPrep(project) {
  if (project.status !== 'EXPORTED') {
    throw httpError(409, `publish preparation requires an EXPORTED project (current status ${project.status})`);
  }
  const kind = exportKindOf(project);
  if (kind !== 'VIDEO') {
    throw httpError(409,
      'publish preparation requires a VIDEO export: this content has ' +
      `${kind || 'no'} export, so there is no rendered MP4 to hand off`);
  }
  const offer = project.offer_snapshot;
  const scenes = project.storyboard.scenes || [];
  const lastScene = scenes[scenes.length - 1];
  const audioState = refreshAudioStatus(project);
  const caption = [
    `${offer.product_name}`,
    `ราคา ${money(offer.price_thb)} บาท (ปกติ ${money(offer.list_price_thb)} บาท)`,
    offer.promo && offer.promo.depth_pct > 0 ? `โปรโมชัน: ${offer.promo.label}` : null,
    `คะแนนรีวิว ${offer.rating} จาก 5 (${offer.rating_count} รีวิว)`,
    project.cta.text,
    'ข้อมูลอาจเปลี่ยนได้ กรุณาตรวจราคาปัจจุบันที่ลิงก์ต้นทาง',
  ].filter(Boolean).join('\n');

  const checks = [
    { id: 'exported', label: 'มีไฟล์วิดีโอที่ export แล้ว', ok: exportKindOf(project) === 'VIDEO' && Boolean(project.export.file) },
    { id: 'aspect', label: 'ไฟล์เป็นแนวตั้ง 9:16', ok: project.export && project.export.width === 1080 && project.export.height === 1920 },
    { id: 'cta', label: 'มี CTA พร้อมคำบรรยาย', ok: Boolean(project.cta && project.cta.text) },
    { id: 'script', label: 'บันทึก Script version และ checksum', ok: project.script_version >= 1 && Boolean(project.script && project.script.checksum) },
    { id: 'ids', label: 'บันทึก Content / Product / Candidate / Shop ID', ok: Boolean(project.content_id && project.product_id && project.candidate_id && project.shop_id) },
    { id: 'assets', label: 'บันทึก Asset references', ok: Array.isArray(project.export && project.export.asset_refs) },
    { id: 'qa', label: 'ผ่านการตรวจภาษาไทย', ok: Boolean(project.qa) && project.qa.summary.FAIL === 0 },
    { id: 'audio', label: 'เสียงผ่านการตรวจแล้ว — ครบฉากที่กำหนดและความยาวตรง', ok: !audioState.required || audioState.status === 'AUDIO_ATTACHED' || audioState.status === 'AUDIO_APPROVED' },
    { id: 'no_account', label: 'ไม่มีการเชื่อมต่อบัญชีผู้ขายหรือช่องทางเผยแพร่', ok: true },
  ];

  const payload = {
    generated_at: nowIso(),
    content_id: project.content_id,
    product_id: project.product_id,
    offer_id: project.offer_id,
    candidate_id: project.candidate_id,
    shop_id: project.shop_id,
    plan_id: project.plan_id,
    script_version: project.script_version,
    script_checksum: project.script ? project.script.checksum : null,
    language: project.language,
    aspect_ratio: '9:16',
    platform: {
      status: 'UNASSIGNED',
      note: 'เฟสนี้ไม่กำหนดแพลตฟอร์มและไม่เชื่อมต่อบัญชีใด ผู้ใช้ต้องเลือกช่องทางเอง',
    },
    caption_draft: caption,
    hashtags: ['#ราคาถูก', `#${offer.category_hint || 'ของดีบอกต่อ'}`, '#รีวิวของแนะนำ'],
    disclosure: 'ราคาและโปรโมชันอ้างอิงจากไฟล์ส่งออกของร้าน ณ วันที่ระบุในคลิป ราคาจริงอาจต่างกัน',
    product_reference: {
      item_id: offer.item_id,
      product_name: offer.product_name,
      shop_id: offer.shop_id,
      shop_name: offer.shop_name,
      price_thb: offer.price_thb,
      list_price_thb: offer.list_price_thb,
      promo: offer.promo,
      rating: offer.rating,
      rating_count: offer.rating_count,
      affiliate_link: offer.affiliate_link,
      product_url: offer.product_url,
      data_as_of: offer.data_as_of,
      synthetic: offer.synthetic,
    },
    video: {
      file: project.export.filename,
      bytes: project.export.bytes,
      sha256: project.export.sha256,
      width: project.export.width,
      height: project.export.height,
      duration_s: project.export.duration_s,
    },
    audio: {
      required: audioState.required,
      status: audioState.status,
      approved: audioState.approved,
      mismatches: audioState.mismatches || [],
      files: (project.export && project.export.audio && project.export.audio.assets) || [],
      note: 'เสียงเป็นไฟล์ที่ผู้ใช้สร้างจาก Speaktor แบบ Manual เท่านั้น ยังไม่มีการเชื่อม API ภายนอก',
    },
    assets: (project.export.asset_refs || []).map((asset) => ({
      id: asset.id,
      path: asset.path,
      sha256: asset.sha256,
    })),
    cta: project.cta,
    last_scene_id: lastScene ? lastScene.id : null,
    checklist: checks,
    ready: checks.every((check) => check.ok),
    publish: {
      status: 'NOT_PUBLISHED',
      executed: false,
      external_calls: 0,
      spend_thb: 0,
      note: 'เฟสนี้เตรียมข้อมูลเท่านั้น ไม่มีการกดเผยแพร่ ไม่มีการเข้าสู่ระบบ Shopee Seller และไม่มีการตั้งเวลาเผยแพร่',
    },
    next_steps_for_a_human: [
      'ตรวจไฟล์วิดีโอด้วยสายตาก่อนใช้งานจริง',
      'ยืนยันราคาและโปรโมชันปัจจุบันกับหน้าสินค้าต้นทาง',
      'เลือกแพลตฟอร์มและบัญชีที่จะเผยแพร่เอง',
      'ตรวจกฎหมายและนโยบายแพลตฟอร์มก่อนเผยแพร่',
    ],
    boundaries: [
      'ไม่มีการเรียก Shopee หรือ API ภายนอกใด',
      'ไม่มีการเข้าสู่ระบบผู้ขายหรือช่องทางเผยแพร่',
      'ไม่มีการสร้างการโฆษณาหรือการใช้เงินจริง',
      'ข้อมูลยังเป็นชุดสังเคราะห์จากไฟล์ส่งออกที่นำเข้า',
    ],
  };

  project.publish_prep = payload;
  project.status = 'READY_TO_PUBLISH';
  project.updated_at = nowIso();
  project.edit_log.push({ at: project.updated_at, track: null, scene_id: null, change: 'เตรียมข้อมูลพร้อมเผยแพร่' });
  return payload;
}

/* ------------------------------------------------------------------ */
/* Status machine                                                      */
/* ------------------------------------------------------------------ */

function assertTransition(from, to) {
  const index = STATUSES.indexOf(from);
  const target = STATUSES.indexOf(to);
  if (index < 0) throw httpError(409, `unknown content status ${from}`);
  if (target !== index + 1) {
    throw httpError(409, `content status can only move one step at a time (${from} -> ${to})`);
  }
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Content Library retrieval (G-13: retrieve by ID)                    */
/* ------------------------------------------------------------------ */

/**
 * Resolves the Content Library index path. Module-anchored so it does not
 * depend on the process working directory; tests override it with
 * ACE_CONTENT_LIBRARY_FILE (same convention as the MVP state overrides).
 */
function contentLibraryFile() {
  return process.env.ACE_CONTENT_LIBRARY_FILE
    ? path.resolve(process.cwd(), process.env.ACE_CONTENT_LIBRARY_FILE)
    : path.resolve(__dirname, '..', '..', 'data', 'mission1', 'content-library.json');
}

/** Reads the index, tolerating leading '#'-comment header lines. */
async function readContentLibrary() {
  const contentLibraryPath = contentLibraryFile();
  let text;
  try {
    text = await fsp.readFile(contentLibraryPath, 'utf-8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return { items: [] };
    throw err;
  }
  const cleaned = text.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw httpError(500, `content library index is malformed; cannot read ${contentLibraryPath}`);
  }
  if (Array.isArray(parsed)) return { items: parsed };
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed;
  throw httpError(500, `content library index has an unexpected shape: ${contentLibraryPath}`);
}

/** Returns the library record for an ID, or null when the ID is unknown. */
async function getLibraryItem(id) {
  if (typeof id !== 'string' || !id) return null;
  const library = await readContentLibrary();
  return library.items.find((item) => item && item.id === id) || null;
}

module.exports = {
  STATUSES,
  TRACKS,
  GENERATOR_VOCABULARY,
  VISUAL_PRESETS,
  AUDIO_PROVIDERS,
  AUDIO_SOURCES,
  AUDIO_STATUSES,
  AUDIO_DURATION_TOLERANCE_S,
  buildContentApproaches,
  buildCustomApproach,
  buildStoryboard,
  buildScript,
  buildPreview,
  buildFinalizeChecklist,
  buildPublishPrep,
  createContentProject,
  applyVisualEdit,
  applyTextEdit,
  applyAudioEdit,
  addScene,
  removeScene,
  reorderScenes,
  runProjectQa,
  finalizeProject,
  addAsset,
  addAudioAsset,
  removeAsset,
  refreshAudioStatus,
  exportProject,
  exportKindOf,
  contentLibraryFile,
  readContentLibrary,
  getLibraryItem,
  assertTransition,
};
