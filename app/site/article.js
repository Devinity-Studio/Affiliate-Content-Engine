'use strict';

/**
 * ACE A1 — deterministic article synthesis.
 *
 * Turns one synthetic MVP content record into a document model. The rules this
 * module enforces:
 *
 *   · Five sections, ordered exactly like content.storyboard.scenes[].
 *   · The only prose facts are the scene voiceovers already authored in the
 *     record; connective template copy adds no new facts and no new numbers.
 *   · Every scene evidence id must resolve to a real evidence entry, otherwise
 *     the build fails closed (no page is produced).
 *   · A content record whose QA summary has FAIL > 0 never produces a page.
 *
 * No clock, no randomness: identical input yields an identical document.
 */

const publication = require('./publication');

const SECTION_COPY = Object.freeze({
  HOOK: {
    heading: 'ภาพรวมสินค้า',
    paragraphs: [
      'หน้านี้สรุปเฉพาะข้อมูลที่ตรวจสอบย้อนกลับได้จากไฟล์ส่งออกของร้าน และแยกข้อจำกัดของข้อมูลไว้อย่างชัดเจน ใช้เป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำส่วนตัว',
    ],
  },
  PROBLEM: {
    heading: 'ปัญหาที่พบบ่อย',
    paragraphs: [
      'การเลือกอาหารสัตว์จากความคุ้นเคยโดยไม่ตรวจชนิด ปริมาณ และราคาต่อหน่วย อาจทำให้ได้ของที่ไม่ตรงกับความต้องการ หน้านี้จึงรวบรวมข้อมูลที่เทียบได้จริงไว้ในที่เดียว',
    ],
  },
  OFFER: {
    heading: 'ราคาและโปรโมชัน',
    paragraphs: [
      'ราคาและโปรโมชันอ้างอิงจากแถวข้อมูลเดียวกับที่ใช้ตรวจสอบ โปรโมชันอาจสิ้นสุดหรือเปลี่ยนเงื่อนไขได้ ควรตรวจสอบราคาล่าสุดก่อนตัดสินใจ',
    ],
  },
  EVIDENCE: {
    heading: 'ร้านและข้อมูลที่มี',
    paragraphs: [
      'ข้อมูลร้านและคะแนนรีวิวมาจากแหล่งเดียวกับราคา จึงเทียบกันได้โดยตรง บทความนี้ไม่แสดงความคิดเห็นของผู้เขียนและไม่สรุปแทนประสบการณ์ของผู้ใช้จริง',
    ],
  },
  CTA: {
    heading: 'สรุปและขั้นตอนถัดไป',
    paragraphs: [
      'บทความนี้สร้างจากข้อมูล synthetic ทั้งหมด ไม่เชื่อมต่อไปยังร้านจริง และยังไม่เปิดใช้งานลิงก์ในขั้นนี้',
      'เมื่อข้อมูลผ่านการตรวจโดยคนแล้ว ขั้นถัดไปคือการเพิ่มลิงก์ไปยังร้านและการวัดผลการคลิก ซึ่งอยู่นอกขอบเขตของขั้นนี้',
    ],
  },
});

const FALLBACK_SECTION = Object.freeze({
  heading: 'ข้อมูลเพิ่มเติม',
  paragraphs: ['หัวข้อนี้สรุปข้อมูลที่เหลืออยู่ในบันทึกเนื้อหา โดยไม่เพิ่มข้อเท็จจริงใหม่'],
});

const HERO_CAPTION = 'ภาพตัวอย่างจากวิดีโอ (เฟรมตัวอย่าง ไม่ใช่ภาพสินค้าจริง)';
const HERO_ALT = 'เฟรมตัวอย่างจากวิดีโอรีวิว';
const CTA_LABEL = 'ลิงก์ไปยังร้านยังไม่เปิดใช้งานในขั้นนี้';
const CTA_NOTE = 'ตัวอย่าง (synthetic) — หน้านี้ไม่มีการเชื่อมต่อออกไปภายนอก';
const QA_NOTE = 'ต้องตรวจซ้ำโดยคน';

function asString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function sceneList(content) {
  const storyboard = content ? content.storyboard : null;
  const scenes = storyboard ? storyboard.scenes : null;
  return Array.isArray(scenes) ? scenes : [];
}

function qaSummary(content) {
  const summary = content && content.qa ? content.qa.summary : null;
  const fail = summary && Number.isFinite(Number(summary.FAIL)) ? Number(summary.FAIL) : 0;
  const warn = summary && Number.isFinite(Number(summary.WARN)) ? Number(summary.WARN) : 0;
  const pass = summary && Number.isFinite(Number(summary.PASS)) ? Number(summary.PASS) : 0;
  return { pass, warn, fail };
}

function qaWarnings(content) {
  const warnings = content && content.qa ? content.qa.warnings : null;
  if (!Array.isArray(warnings)) return [];
  return warnings
    .filter((item) => item && typeof item.message === 'string')
    .map((item) => ({ id: asString(item.id), message: item.message }));
}

function productNameOf(content, offer, offerSnapshot) {
  const candidates = [
    offerSnapshot ? offerSnapshot.product_name : '',
    offer ? offer.product_name : '',
    content ? content.product_name : '',
  ];
  const found = candidates.map(asString).find((value) => value.length > 0);
  return found || 'สินค้า';
}

function basenameOf(value) {
  const raw = asString(value);
  if (!raw) return '';
  return raw.split(/[\\/]/).filter(Boolean).pop() || '';
}

function heroImage(content, publicationRecord) {
  const still = content && content.export ? content.export.still : null;
  const file = basenameOf(still ? still.path || still.file : '');
  if (!file) return null;
  return {
    src: `/media/${encodeURIComponent(publicationRecord.content_id)}/${encodeURIComponent(file)}`,
    alt: HERO_ALT,
    caption: HERO_CAPTION,
  };
}

function factRows(offerSnapshot, offer) {
  const rows = [];
  const price = offerSnapshot ? offerSnapshot.price_thb : null;
  const listPrice = offerSnapshot ? offerSnapshot.list_price_thb : null;
  const promo = (offerSnapshot && offerSnapshot.promo) || (offer && offer.promo) || null;
  const reviews = (offer && offer.reviews) || null;
  const shopName = asString(offerSnapshot ? offerSnapshot.shop_name : '') || asString(offer ? offer.shop_name : '');
  const dataAsOf = asString(offerSnapshot ? offerSnapshot.data_as_of : '');

  if (Number.isFinite(Number(price)) && asString(price) !== '') rows.push({ label: 'ราคา', value: `${price} บาท` });
  if (Number.isFinite(Number(listPrice)) && asString(listPrice) !== '') {
    rows.push({ label: 'ราคาปกติ', value: `${listPrice} บาท` });
  }
  if (promo && Number.isFinite(Number(promo.depth_pct))) {
    rows.push({ label: 'ส่วนลดจากราคาปกติ', value: `${promo.depth_pct}%` });
  }
  if (promo && asString(promo.label)) rows.push({ label: 'โปรโมชัน', value: asString(promo.label) });
  if (reviews && Number.isFinite(Number(reviews.rating))) {
    rows.push({ label: 'คะแนนรีวิว', value: `${reviews.rating} จาก 5` });
  }
  if (reviews && Number.isFinite(Number(reviews.rating_count))) {
    rows.push({ label: 'จำนวนรีวิว', value: `${reviews.rating_count} รายการ` });
  }
  if (reviews && Number.isFinite(Number(reviews.units_sold))) {
    rows.push({ label: 'ยอดขาย', value: `${reviews.units_sold} ชิ้น` });
  }
  if (shopName) rows.push({ label: 'ร้าน', value: shopName });
  if (dataAsOf) rows.push({ label: 'ข้อมูล ณ', value: dataAsOf });
  return rows;
}

function resolveSceneEvidence(scene, evidenceMap) {
  const ids = Array.isArray(scene.evidence_ids) ? scene.evidence_ids : [];
  const resolved = [];
  const missing = [];
  for (const id of ids) {
    const entry = evidenceMap.get(id);
    if (!entry) {
      missing.push(id);
      continue;
    }
    resolved.push({
      id,
      statement: asString(entry.statement),
      source_ids: Array.isArray(entry.source_ids) ? entry.source_ids.map(asString).filter(Boolean) : [],
      checked_at: asString(entry.checked_at),
      synthetic: entry.synthetic === true,
      claim_class: asString(entry.claim_class),
      limitations: Array.isArray(entry.limitations) ? entry.limitations.map(asString).filter(Boolean) : [],
    });
  }
  return { resolved, missing };
}

function proseParagraphs(scene, role, copy) {
  const paragraphs = [];
  if (role !== 'CTA') {
    const voiceover = asString(scene.audio ? scene.audio.voiceover : '');
    if (voiceover) paragraphs.push(voiceover);
  }
  for (const line of copy.paragraphs) {
    if (asString(line)) paragraphs.push(asString(line));
  }
  return paragraphs;
}

function countProseChars(sections, lead) {
  const pieces = [lead];
  for (const section of sections) {
    for (const paragraph of section.paragraphs) pieces.push(paragraph);
  }
  return pieces.join('').length;
}

/**
 * @returns {{ok: true, doc: object} | {ok: false, reason: string, details?: string[]}}
 */
function buildArticle({ content, offer, offerSnapshot, evidence, publication: publicationRecord }) {
  if (!content) return { ok: false, reason: 'CONTENT_MISSING' };
  if (!publicationRecord || !publicationRecord.content_id) return { ok: false, reason: 'PUBLICATION_MISSING' };

  const scenes = sceneList(content);
  if (scenes.length === 0) return { ok: false, reason: 'SCENES_MISSING' };

  const qa = qaSummary(content);
  if (qa.fail > 0) return { ok: false, reason: 'QA_BLOCKED', details: [`FAIL=${qa.fail}`] };

  const evidenceMap = evidence instanceof Map ? evidence : new Map();
  const resolvedSnapshot = offerSnapshot || content.offer_snapshot || {};
  const name = productNameOf(content, offer, resolvedSnapshot);
  const publicationSlug = asString(publicationRecord.slug);
  if (!publicationSlug) return { ok: false, reason: 'PUBLICATION_SLUG_MISSING' };

  const missingEvidence = [];
  const sections = scenes.map((scene) => {
    const role = asString(scene.role).toUpperCase() || 'OTHER';
    const copy = SECTION_COPY[role] || FALLBACK_SECTION;
    const { resolved, missing } = resolveSceneEvidence(scene, evidenceMap);
    for (const id of missing) missingEvidence.push(id);
    return {
      id: asString(scene.id),
      role,
      heading: copy.heading,
      paragraphs: proseParagraphs(scene, role, copy),
      evidence: resolved,
    };
  });

  if (missingEvidence.length > 0) {
    return { ok: false, reason: 'EVIDENCE_UNRESOLVED', details: Array.from(new Set(missingEvidence)) };
  }

  const lead = `บทความนี้สรุปข้อมูลของ ${name} จากไฟล์ส่งออกของร้าน โดยอ้างอิงหลักฐานทุกข้อที่แสดงไว้ด้านล่าง`;
  const disclosure = asString(content.publish_prep ? content.publish_prep.disclosure : '');

  const sources = [];
  const seen = new Set();
  for (const section of sections) {
    for (const entry of section.evidence) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      sources.push(entry);
    }
  }

  const doc = {
    content_id: publicationRecord.content_id,
    slug: publicationSlug,
    lang: 'th',
    title: `รีวิว ${name}`,
    h1: `รีวิว ${name}`,
    lead,
    hero: heroImage(content, publicationRecord),
    disclosure,
    facts: factRows(resolvedSnapshot, offer),
    qa: {
      ...qa,
      banner: `ผ่าน ${qa.pass} · เตือน ${qa.warn} · ผิดพลาด ${qa.fail}`,
      note: QA_NOTE,
      warnings: qaWarnings(content),
    },
    sections,
    sources,
    cta: { label: CTA_LABEL, note: CTA_NOTE },
    data_as_of: asString(resolvedSnapshot.data_as_of),
    body_char_count: countProseChars(sections, lead),
  };

  return { ok: true, doc };
}

/** Convenience wrapper used by the server: load, then build. */
async function buildForContentId(contentId, publicationRecord) {
  const source = await publication.loadArticleSource(contentId);
  if (!source.ok) return { ok: false, reason: source.reason };
  const built = buildArticle({
    content: source.content,
    offer: source.offer,
    offerSnapshot: source.offerSnapshot,
    evidence: source.evidence,
    publication: publicationRecord,
  });
  // The caller may need the record itself (for example to inline the hero
  // image); the document model stays pure and free of file paths.
  if (built.ok) built.content = source.content;
  return built;
}

module.exports = {
  SECTION_COPY,
  HERO_CAPTION,
  CTA_LABEL,
  buildArticle,
  buildForContentId,
  countProseChars,
};
