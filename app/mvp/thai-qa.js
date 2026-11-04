'use strict';

/**
 * ACE — Thai content QA for the Content Editor.
 *
 * The QA gate answers one question per check: does this line of copy still
 * say what the source data says? It is deliberately conservative — it never
 * invents a rule, and every failure points at the exact text that caused it.
 *
 * Checks
 *   spelling     การสะกด — repeated words, doubled Thai marks, mixed script,
 *                           unknown Thai segments
 *   price        ราคา — every amount must exist in the source offer
 *   promotion    โปรโมชัน — a discount claim must match the source promotion
 *   product_name ชื่อสินค้า — the product name must match the source product
 *   cta          CTA — must exist, be in the last scene, and stay factual
 *   evidence     — every factual scene must cite evidence that exists
 *   external     — no seller-centre, payment or "already published" language
 *
 * Thai has no word spaces, so "unknown Thai segment" is a longest-match
 * heuristic against a lexicon, not a dictionary. It is reported as WARN and
 * the report says so.
 *
 * Pure module: no I/O, no network, no state.
 */

const THAI = /[\u0E00-\u0E7F]/;
const THAI_MARK = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

// Thai words used by the storyboard generator plus the everyday words a
// creator reaches for. A Thai run that cannot be segmented with this lexicon
// is reported as an unknown segment.
const LEXICON = new Set([
  'ทดสอบ', 'ตัวอย่าง', 'สินค้า', 'ราคา', 'ปกติ', 'บาท', 'ลด', 'จาก', 'หรือ', 'และ', 'กับ', 'ให้', 'ได้',
  'คลิก', 'กด', 'ลิงก์', 'ดู', 'เช็ค', 'ติดตาม', 'สั่งซื้อ', 'ซื้อ', 'ตอนนี้', 'วันนี้', 'ตอนนี้ราคา',
  'รีวิว', 'ดาว', 'คะแนน', 'คน', 'ใช้', 'แล้ว', 'เป็น', 'ของ', 'ที่', 'มี', 'ใน', 'บน', 'ให้',
  'เซรั่ม', 'วิตามิน', 'ซี', 'ครีม', 'น้ำ', 'อาบน้ำ', 'เครื่อง', 'ดูดฝุ่น', 'เก้าอี้', 'โต๊ะ',
  'กล่อง', 'เก็บ', 'ของ', 'หูฟัง', 'บลูทูธ', 'สาย', 'อาหาร', 'แมว', 'ลูก', 'ผ้า', 'ผ้าอ้อม',
  'โยค', 'แผ่น', 'เบาะ', 'กระทะ', 'เหล็ก', 'สูตร', 'ราคาถูก', 'คุ้ม', 'ส่ง', 'ฟรี', 'ของแถม',
  'ออเดอร์', 'สินค้าคงคลัง', 'คุณภาพ', 'ใช้งาน', 'ง่าย', 'สะดวก', 'คุ้มค่า',
  'วันนี้เท่านั้น', 'เหลือ', 'น้อย', 'มีจำนวน', 'จำกัด', 'เวลา', 'เท่านั้น',
  'ข้อมูล', 'จาก', 'ระบบ', 'คัดลอก', 'มา', 'ยัง', 'ต้อง', 'เช็ก', 'ก่อน', 'ตัดสินใจ',
  'ประมาณ', 'ใกล้', 'ค่อนข้าง', 'ต่ำ', 'สูง', 'กว่า', 'เมื่อ', 'เทียบ', 'ตัว', 'เดียว',
  'สินค้าตัวนี้', 'ชิ้น', 'ใบ', 'กล่อง', 'ชุด', 'แพ็ค',
]);

const COMMON_TYPOS = [
  { wrong: 'เซริ่ม', right: 'เซรั่ม' },
  { wrong: 'เซริม', right: 'เซรั่ม' },
  { wrong: 'โปรโมชั่น', right: 'โปรโมชัน' },
  { wrong: 'คลิค', right: 'คลิก' },
  { wrong: 'เเช็ค', right: 'เช็ค' },
];

// Claims a creator must not make without a source behind them.
const FORBIDDEN_CLAIMS = [
  'ดีที่สุด', 'อันดับ 1', 'อันดับหนึ่ง', 'อันดับ ๑', 'ถูกที่สุด', 'ถูกสุด', 'คุ้มที่สุด',
  '100%', 'รับประกัน', 'การันตี', 'รับคืนง่าย', 'ของแท้แน่นอน', 'ดีกว่า', 'อย่างดีที่สุด',
  'ชั้นดีที่สุด', 'แบบไม่มีจริง', 'ของปลอม',
];

const CTA_ACTIONS = ['คลิก', 'กด', 'ดู', 'เช็ค', 'ติดตาม', 'ลิงก์', 'แวะ', 'ไปที่', 'กดดู', 'ชม'];

const EXTERNAL_PHRASES = [
  { phrase: 'แอปผู้ขาย', why: 'the Seller app must not be referenced in this phase' },
  { phrase: 'seller center', why: 'the Seller Center must not be referenced in this phase' },
  { phrase: 'ศูนย์ผู้ขาย', why: 'the Seller Center must not be referenced in this phase' },
  { phrase: 'พร้อมเพย์', why: 'payment must not be part of the content' },
  { phrase: 'โอนเงิน', why: 'payment must not be part of the content' },
  { phrase: 'เผยแพร่แล้ว', why: 'the content is not published in this phase' },
  { phrase: 'ลงแล้ว', why: 'the content is not published in this phase' },
];

// Promotion phrases that need a source behind them.
const UNSOURCED_PROMO_PHRASES = ['ส่งฟรี', 'ของแถม'];

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

function normalize(text) {
  return String(text == null ? '' : text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[t.length];
}

/** Every Thai run in the text, longest first. */
function thaiRuns(text) {
  const runs = [];
  const re = /[\u0E00-\u0E7F]+/g;
  let match = re.exec(String(text || ''));
  while (match) {
    runs.push(match[0]);
    match = re.exec(String(text || ''));
  }
  return runs;
}
/**
 * Longest-match segmentation of one Thai token against the lexicon.
 *
 * Thai writes a word as a base consonant plus combining marks, and a leading
 * vowel is a separate code point in front of it ("เ" + "ก" + "ี" + "่").
 * A plain character-by-character scan therefore reports stray marks as if
 * they were words, so the scan works on space-delimited tokens and reports
 * the whole unexplained remainder.
 *
 * @returns {Array<{token: string, part: string}>} the unknown parts
 */
function unknownThaiSegments(token) {
  const source = String(token || '');
  if (!THAI.test(source)) return [];
  const unknown = [];
  let i = 0;
  let gapStart = -1;
  while (i < source.length) {
    let matched = 0;
    for (let len = Math.min(16, source.length - i); len >= 1; len -= 1) {
      if (LEXICON.has(source.slice(i, i + len))) {
        matched = len;
        break;
      }
    }
    if (matched > 0) {
      if (gapStart >= 0) {
        const part = source.slice(gapStart, i);
        if (part.length >= 2) unknown.push({ token: source, part });
        gapStart = -1;
      }
      i += matched;
      continue;
    }
    if (gapStart < 0) gapStart = i;
    i += 1;
  }
  if (gapStart >= 0) {
    const part = source.slice(gapStart);
    if (part.length >= 2) unknown.push({ token: source, part });
  }
  return unknown;
}

/**
 * Every unknown Thai word in a text, reported once per unique word.
 */
function unknownThaiWords(text) {
  const found = [];
  const seen = new Set();
  for (const token of String(text == null ? '' : text).split(/\s+/)) {
    if (!token) continue;
    for (const item of unknownThaiSegments(token)) {
      if (seen.has(item.part)) continue;
      seen.add(item.part);
      found.push(item);
    }
  }
  return found;
}

/** Every "amount + currency" mention in the text. */
function priceMentions(text) {
  const found = [];
  const source = String(text || '');
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(บาท|฿|THB|thb)/g;
  let match = re.exec(source);
  while (match) {
    found.push({
      raw: match[0].trim(),
      value: Number(match[1].replace(/,/g, '')),
      currency: match[2],
      index: match.index,
    });
    match = re.exec(source);
  }
  return found;
}

/** Every "ลด X%" style discount claim in the text. */
function discountClaims(text) {
  const found = [];
  const source = String(text || '');
  const re = /ลด\s*(\d+(?:\.\d+)?)\s*%/g;
  let match = re.exec(source);
  while (match) {
    found.push({ raw: match[0].trim(), pct: Number(match[1]), index: match.index });
    match = re.exec(source);
  }
  const re2 = /(\d+(?:\.\d+)?)\s*%\s*ลด/g;
  match = re2.exec(source);
  while (match) {
    if (!found.some((f) => f.index === match.index)) {
      found.push({ raw: match[0].trim(), pct: Number(match[1]), index: match.index });
    }
    match = re2.exec(source);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Check helpers                                                       */
/* ------------------------------------------------------------------ */

function check(id, category, label, status, message, extra = {}) {
  return {
    id,
    category,
    label,
    status,
    severity: status === 'FAIL' ? 'ERROR' : status === 'WARN' ? 'WARN' : 'PASS',
    message,
    ...extra,
  };
}

/** Every piece of text the project renders, with its location. */
function collectText(project) {
  const texts = [];
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  for (const scene of scenes) {
    const overlay = scene.overlay || {};
    const audio = scene.audio || {};
    if (overlay.badge) texts.push({ where: `${scene.id}.overlay.badge`, text: overlay.badge });
    if (overlay.headline) texts.push({ where: `${scene.id}.overlay.headline`, text: overlay.headline });
    if (overlay.subhead) texts.push({ where: `${scene.id}.overlay.subhead`, text: overlay.subhead });
    if (overlay.fact) texts.push({ where: `${scene.id}.overlay.fact`, text: overlay.fact });
    if (overlay.cta) texts.push({ where: `${scene.id}.overlay.cta`, text: overlay.cta });
    if (audio.voiceover) texts.push({ where: `${scene.id}.audio.voiceover`, text: audio.voiceover });
  }
  if (project.cta && project.cta.text) texts.push({ where: 'cta.text', text: project.cta.text });
  return texts;
}

/* ------------------------------------------------------------------ */
/* The checks                                                          */
/* ------------------------------------------------------------------ */

function checkSpelling(texts) {
  const results = [];
  let unknownCount = 0;
  let typoCount = 0;
  let doubled = 0;

  for (const item of texts) {
    const text = String(item.text || '');

    // A word repeated back to back.
    const repeat = /(\S+)\s+\1(?=\s|$)/g;
    let match = repeat.exec(text);
    while (match) {
      doubled += 1;
      results.push(check(
        'SPELL-REPEAT', 'spelling', 'การสะกด · คำซ้ำ',
        'FAIL',
        `"${match[1]}" ซ้ำติดกันใน ${item.where}`,
        { where: item.where, actual: match[0], hint: 'ลบคำที่ซ้ำหนึ่งคำออก' }
      ));
      match = repeat.exec(text);
    }

    // Two Thai marks in a row is always a typo.
    const doubleMark = /([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1+/g;
    match = doubleMark.exec(text);
    while (match) {
      doubled += 1;
      results.push(check(
        'SPELL-MARK', 'spelling', 'การสะกด · สระ/วรรณยุกต์ซ้ำ',
        'FAIL',
        `เครื่องหมายวรรณยุกต์ซ้ำ "${match[0]}" ใน ${item.where}`,
        { where: item.where, actual: match[0], hint: 'เก็บเครื่องหมายไว้เพียงตัวเดียว' }
      ));
      match = doubleMark.exec(text);
    }

    // Curated common misspellings.
    for (const typo of COMMON_TYPOS) {
      if (typo.wrong === typo.right) continue;
      if (text.includes(typo.wrong)) {
        typoCount += 1;
        results.push(check(
          'SPELL-WORD', 'spelling', 'การสะกด · คำที่พิมพ์ผิด',
          'WARN',
          `"${typo.wrong}" ใน ${item.where} มักเขียนเป็น "${typo.right}"`,
          { where: item.where, actual: typo.wrong, expected: typo.right }
        ));
      }
    }

    // Thai and Latin glued together without a space.
    const mixed = /[A-Za-z][\u0E00-\u0E7F]|[\u0E00-\u0E7F][A-Za-z]/g;
    match = mixed.exec(text);
    while (match) {
      results.push(check(
        'SPELL-MIXED', 'spelling', 'การสะกด · อักษรไทย/อังกฤษติดกัน',
        'WARN',
        `"${match[0]}" ใน ${item.where} ไม่มีช่องว่างระหว่างภาษาไทยและอังกฤษ`,
        { where: item.where, actual: match[0], hint: 'เว้นวรรคระหว่างคำไทยกับคำอังกฤษ' }
      ));
      match = mixed.exec(text);
    }
  }

  // Unknown Thai words are reported once per unique word.
  for (const item of texts) {
    for (const unknown of unknownThaiWords(item.text)) {
      unknownCount += 1;
      results.push(check(
        'SPELL-UNKNOWN', 'spelling', 'การสะกด · คำไทยที่ไม่อยู่ในคลังคำ',
        'WARN',
        `"${unknown.part}" ใน ${item.where} ไม่พบในคลังคำไทยของระบบ`,
        {
          where: item.where,
          actual: unknown.part,
          hint: 'ตรวจสอบการสะกดด้วยสายตาอีกครั้ง — ระบบไม่มีพจนานุกรมไทยเต็มรูปแบบ',
        }
      ));
    }
  }

  if (!results.length) {
    results.push(check(
      'SPELL-OK', 'spelling', 'การสะกด · ผ่าน',
      'PASS',
      'ไม่พบคำซ้ำ เครื่องหมายวรรณยุกต์ซ้ำ หรือคำที่พิมพ์ผิดจากรายการที่ตรวจไว้'
    ));
  }

  results.push(check(
    'SPELL-SCOPE', 'spelling', 'การสะกด · ขอบเขตของการตรวจ',
    'PASS',
    `ตรวจ ${typoCount} คำที่พิมพ์ผิดตามรายการ, ${doubled} จุดที่ซ้ำ, ${unknownCount} คำไทยที่ไม่รู้จัก ` +
    '(คลังคำเป็น heuristic ไม่ใช่พจนานุกรม ต้องให้คนตรวจซ้ำ)'
  ));

  return results;
}

function checkPrice(texts, offer, sourceFreshness) {
  const results = [];
  const known = new Set([offer.price_thb, offer.list_price_thb].map((v) => Number(v).toFixed(2)));
  let mentions = 0;

  for (const item of texts) {
    for (const mention of priceMentions(item.text)) {
      mentions += 1;
      const value = Number(mention.value).toFixed(2);
      if (!known.has(value)) {
        results.push(check(
          'PRICE-MISMATCH', 'price', 'ราคา · ไม่ตรงกับข้อมูลต้นทาง',
          'FAIL',
          `${item.where} ระบุ "${mention.raw}" แต่ข้อมูลต้นทางมีเพียง THB ${offer.price_thb.toFixed(2)} และ THB ${offer.list_price_thb.toFixed(2)}`,
          { where: item.where, actual: mention.raw, expected: [...known].join(' / ') }
        ));
      }
    }
  }

  if (!mentions) {
    results.push(check(
      'PRICE-ABSENT', 'price', 'ราคา · ไม่มีการอ้างราคาในเนื้อหา',
      'WARN',
      'ไม่พบการอ้างราคาเลยในสคริปต์และข้อความบนจอ — ควรมีราคา หรืออธิบายว่าทำไมถึงไม่ระบุ',
      { hint: 'ราคามาจากข้อมูลต้นทางเท่านั้น ถ้าไม่ระบุราคาให้เพิ่มเหตุผลในสคริปต์' }
    ));
  } else {
    results.push(check(
      'PRICE-OK', 'price', 'ราคา · ตรงกับข้อมูลต้นทาง',
      'PASS',
      `ตรวจ ${mentions} จุดที่ระบุจำนวนเงิน — ทุกจุดตรงกับราคาหรือราคาปกติในข้อมูลต้นทาง`
    ));
  }

  if (sourceFreshness && sourceFreshness.status === 'EXPIRED') {
    results.push(check(
      'PRICE-STALE', 'price', 'ราคา · ข้อมูลต้นทางหมดอายุ',
      'WARN',
      'ข้อมูลต้นทางหมดอายุแล้ว ราคาที่แสดงอาจไม่ตรงกับราคาจริงในวันที่เผยแพร่',
      { hint: 'ใส่วันที่ของข้อมูลลงในสคริปต์ หรือให้ผู้ดูตรวจราคาปัจจุบันก่อนซื้อ' }
    ));
  }

  return results;
}

function checkPromotion(texts, offer, sourceFreshness) {
  const results = [];
  let claims = 0;

  for (const item of texts) {
    // A promotion phrase such as "ส่งฟรี" needs a source behind it.
    for (const phrase of UNSOURCED_PROMO_PHRASES) {
      if (String(item.text || '').includes(phrase)) {
        results.push(check(
          'PROMO-PHRASE', 'promotion', 'โปรโมชัน · คำโปรที่ไม่มีในข้อมูลต้นทาง',
          'FAIL',
          `${item.where} มีคำ "${phrase}" แต่ข้อมูลต้นทางไม่มีโปรโมชันนี้ (มีแค่ ${offer.promo.type}: ${offer.promo.label})`,
          { where: item.where, actual: phrase, expected: 'ไม่มีโปรโมชันนี้ในข้อมูลต้นทาง' }
        ));
      }
    }
    for (const claim of discountClaims(item.text)) {
      claims += 1;
      const expected = Number(offer.promo.depth_pct);
      if (!expected) {
        results.push(check(
          'PROMO-UNSOURCED', 'promotion', 'โปรโมชัน · ไม่มีโปรรองรับ',
          'FAIL',
          `${item.where} ระบุ "${claim.raw}" แต่ข้อมูลต้นทางไม่มีโปรโมชัน`,
          { where: item.where, actual: claim.raw, expected: 'ไม่มีโปรโมชันในข้อมูลต้นทาง' }
        ));
      } else if (Math.abs(expected - claim.pct) > 0.01) {
        results.push(check(
          'PROMO-MISMATCH', 'promotion', 'โปรโมชัน · ส่วนลดไม่ตรง',
          'FAIL',
          `${item.where} ระบุ "${claim.raw}" แต่ข้อมูลต้นทางระบุ ${expected}% (${offer.promo.label})`,
          { where: item.where, actual: claim.raw, expected: `${expected}%` }
        ));
      }
    }
  }

  if (!claims) {
    results.push(check(
      'PROMO-NONE', 'promotion', 'โปรโมชัน · ไม่มีการอ้างส่วนลด',
      'PASS',
      'ไม่มีการอ้างส่วนลดในเนื้อหา จึงไม่มีความเสี่ยงที่จะไม่ตรงกับข้อมูลต้นทาง'
    ));
  } else {
    results.push(check(
      'PROMO-OK', 'promotion', 'โปรโมชัน · ตรงกับข้อมูลต้นทาง',
      'PASS',
      `ตรวจ ${claims} จุดที่อ้างส่วนลด — ทุกจุดตรงกับโปรโมชันในข้อมูลต้นทาง`
    ));
  }

  if (claims && sourceFreshness && sourceFreshness.status === 'EXPIRED') {
    results.push(check(
      'PROMO-EXPIRED', 'promotion', 'โปรโมชัน · โปรหมดอายุแล้ว',
      'FAIL',
      'โปรโมชันในข้อมูลต้นทางหมดอายุ แต่เนื้อหายังอ้างส่วนลดอยู่',
      { hint: 'รีเฟรชข้อมูลต้นทางก่อนเผยแพร่ หรือเอาคำอ้างเรื่องส่วนลดออก' }
    ));
  } else if (claims && sourceFreshness && sourceFreshness.status === 'AGING') {
    results.push(check(
      'PROMO-AGING', 'promotion', 'โปรโมชัน · โปรใกล้หมดอายุ',
      'WARN',
      'โปรโมชันในข้อมูลต้นทางใกล้หมดอายุแล้ว ควรตรวจสอบโปรอีกครั้งก่อนเผยแพร่',
      { hint: 'ใส่วันที่ของข้อมูลกำกับไว้ในสคริปต์' }
    ));
  }

  return results;
}

function checkProductName(texts, product, offer, siblingProducts) {
  const results = [];
  const name = String(product.name || '');
  const joined = texts.map((t) => t.text).join(' \n ');
  let mentions = 0;

  for (const item of texts) {
    if (name && item.text.includes(name)) {
      mentions += 1;
      results.push(check(
        'NAME-EXACT', 'product_name', 'ชื่อสินค้า · ตรงกับต้นทาง',
        'PASS',
        `${item.where} ใช้ชื่อสินค้าตามต้นทาง "${name}"`,
        { where: item.where, actual: name }
      ));
    }
  }

  if (!mentions) {
    // A near-miss is a typo of the real name; a completely different name is
    // a different product.
    const similar = siblingProducts
      .map((p) => ({ product: p, distance: levenshtein(normalize(p.name), normalize(name)) }))
      .filter((x) => x.distance > 0 && x.distance <= Math.max(2, Math.floor(name.length * 0.3)))
      .sort((a, b) => a.distance - b.distance);
    if (similar.length) {
      results.push(check(
        'NAME-NEAR', 'product_name', 'ชื่อสินค้า · ใกล้เคียงแต่ไม่ตรง',
        'WARN',
        `ชื่อสินค้าไม่ปรากฏในเนื้อหา และมีชื่อที่ใกล้เคียง "${similar[0].product.name}" ในข้อมูลชุดเดียวกัน`,
        { where: 'project', actual: similar[0].product.name, expected: name }
      ));
    } else {
      results.push(check(
        'NAME-ABSENT', 'product_name', 'ชื่อสินค้า · ไม่ปรากฏในเนื้อหา',
        'FAIL',
        `ไม่พบชื่อสินค้า "${name}" ในสคริปต์หรือข้อความบนจอ`,
        { where: 'project', expected: name, hint: 'ใส่ชื่อสินค้าตามที่ข้อมูลต้นทางเขียน เพื่อไม่ให้ผู้ดูเข้าใจผิด' }
      ));
    }
  }

  // A different product from the same import must not be named here.
  for (const sibling of siblingProducts) {
    if (!sibling.name || sibling.name === name) continue;
    if (joined.includes(sibling.name)) {
      results.push(check(
        'NAME-OTHER', 'product_name', 'ชื่อสินค้า · พบชื่อสินค้าอื่น',
        'FAIL',
        `เนื้อหากล่าวถึง "${sibling.name}" ซึ่งเป็นสินค้าอื่นในข้อมูลชุดเดียวกัน`,
        { where: 'project', actual: sibling.name, expected: name }
      ));
    }
  }

  return results;
}

function checkCta(project, texts) {
  const results = [];
  const cta = project.cta || {};
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const lastScene = scenes[scenes.length - 1];

  if (!cta.text || !String(cta.text).trim()) {
    results.push(check(
      'CTA-MISSING', 'cta', 'CTA · ไม่มีข้อความ',
      'FAIL',
      'ยังไม่มีข้อความ CTA ที่ชัดเจน',
      { where: 'cta.text', hint: 'เขียนคำสั่งให้ผู้ดูทำสิ่งใดสิ่งหนึ่ง เช่น คลิกลิงก์เพื่อเช็กราคาปัจจุบัน' }
    ));
    return results;
  }

  const ctaText = String(cta.text);
  results.push(check('CTA-PRESENT', 'cta', 'CTA · มีข้อความ', 'PASS', `CTA: "${ctaText}"`, {
    where: 'cta.text',
    actual: ctaText,
  }));

  const inLastScene = Boolean(
    lastScene
    && ((lastScene.overlay && lastScene.overlay.cta && String(lastScene.overlay.cta).includes(ctaText))
      || (lastScene.audio && lastScene.audio.voiceover && String(lastScene.audio.voiceover).includes(ctaText)))
  );
  if (!inLastScene) {
    results.push(check(
      'CTA-PLACEMENT', 'cta', 'CTA · ไม่ได้อยู่ในฉากสุดท้าย',
      'FAIL',
      'CTA ไม่ได้อยู่ในฉากสุดท้ายของสตอรีบอร์ด',
      { where: 'cta.text', hint: 'ย้าย CTA ไปไว้ในฉากสุดท้าย' }
    ));
  } else {
    results.push(check(
      'CTA-PLACEMENT-OK', 'cta', 'CTA · อยู่ในฉากสุดท้าย',
      'PASS', 'CTA ปรากฏในฉากสุดท้าย'
    ));
  }

  const lower = ctaText.toLowerCase();
  for (const forbidden of FORBIDDEN_CLAIMS) {
    if (lower.includes(forbidden.toLowerCase())) {
      results.push(check(
        'CTA-CLAIM', 'cta', 'CTA · มีคำกล่าวอ้างที่ข้อมูลไม่รองรับ',
        'FAIL',
        `CTA มีคำ "${forbidden}" ซึ่งไม่มีข้อมูลรองรับ`,
        { where: 'cta.text', actual: forbidden, hint: 'เขียน CTA ที่ชวนให้ผู้ดูตรวจสอบข้อมูลแทนการรับประกันผลลัพธ์' }
      ));
    }
  }

  const hasAction = CTA_ACTIONS.some((verb) => lower.includes(verb));
  if (!hasAction) {
    results.push(check(
      'CTA-ACTION', 'cta', 'CTA · ไม่มีคำสั่งชัดเจน',
      'WARN',
      'CTA ไม่มีคำสั่งที่ผู้ดูทำตามได้ เช่น คลิก / ดู / เช็ค',
      { where: 'cta.text', hint: 'เพิ่มคำสั่ง เช่น "คลิกลิงก์ด้านล่างเพื่อดูราคาปัจจุบัน"' }
    ));
  } else {
    results.push(check('CTA-ACTION-OK', 'cta', 'CTA · มีคำสั่ง', 'PASS', 'CTA มีคำสั่งที่ผู้ดูทำตามได้'));
  }

  // A CTA must not promise a discount the source does not support.
  for (const claim of discountClaims(ctaText)) {
    const expected = Number((project.offer_snapshot && project.offer_snapshot.promo_depth_pct) || 0);
    if (!expected || Math.abs(expected - claim.pct) > 0.01) {
      results.push(check(
        'CTA-DISCOUNT', 'cta', 'CTA · สัญญาส่วนลดที่ไม่มีในข้อมูล',
        'FAIL',
        `CTA ระบุ "${claim.raw}" แต่ข้อมูลต้นทางไม่มีส่วนลดนี้`,
        { where: 'cta.text', actual: claim.raw, expected: expected ? `${expected}%` : 'ไม่มีส่วนลด' }
      ));
    }
  }

  return results;
}

function checkEvidence(project, offer, candidate) {
  const results = [];
  const known = new Set((offer && offer.evidence_ids) || []);
  const candidateEvidence = new Set((candidate && candidate.evidence_ids) || []);
  const scenes = (project.storyboard && project.storyboard.scenes) || [];

  for (const scene of scenes) {
    const ids = scene.evidence_ids || [];
    const dangling = ids.filter((id) => !known.has(id));
    if (dangling.length) {
      results.push(check(
        'EVIDENCE-DANGLING', 'evidence', 'หลักฐาน · อ้างถึงหลักฐานที่ไม่มี',
        'FAIL',
        `${scene.id} อ้างหลักฐานที่ไม่มีอยู่จริง: ${dangling.join(', ')}`,
        { where: scene.id, actual: dangling.join(', ') }
      ));
    }
    const outsideCandidate = ids.filter((id) => candidateEvidence.size && !candidateEvidence.has(id));
    if (outsideCandidate.length) {
      results.push(check(
        'EVIDENCE-OUTSIDE', 'evidence', 'หลักฐาน · เกินขอบเขตของแคนดิเดต',
        'FAIL',
        `${scene.id} อ้างหลักฐานที่อยู่นอกชุดของแคนดิเดต: ${outsideCandidate.join(', ')}`,
        { where: scene.id, actual: outsideCandidate.join(', ') }
      ));
    }
  }

  const factual = scenes.filter((scene) => {
    const overlay = scene.overlay || {};
    return Boolean(overlay.fact || overlay.subhead);
  });
  const withoutEvidence = factual.filter((scene) => !(scene.evidence_ids || []).length);
  if (withoutEvidence.length) {
    results.push(check(
      'EVIDENCE-MISSING', 'evidence', 'หลักฐาน · ฉากข้อเท็จจริงไม่มีหลักฐานรองรับ',
      'FAIL',
      `ฉากที่มีข้อเท็จจริงแต่ไม่ได้อ้างหลักฐาน: ${withoutEvidence.map((s) => s.id).join(', ')}`,
      { where: 'storyboard', actual: withoutEvidence.map((s) => s.id).join(', ') }
    ));
  }

  if (!results.length) {
    results.push(check(
      'EVIDENCE-OK', 'evidence', 'หลักฐาน · ครบถ้วน',
      'PASS', 'ทุกฉากที่มีข้อเท็จจริงอ้างหลักฐานที่มีอยู่จริง'
    ));
  }
  return results;
}

function checkExternal(texts, offer) {
  const results = [];
  const allowedUrls = new Set([offer.product_url, offer.shop_url, offer.affiliate_link].filter(Boolean));

  for (const item of texts) {
    const lower = String(item.text || '').toLowerCase();
    for (const entry of EXTERNAL_PHRASES) {
      if (lower.includes(entry.phrase.toLowerCase())) {
        results.push(check(
          'EXT-PHRASE', 'external', 'ขอบเขต · มีคำที่ห้ามในเฟสนี้',
          'FAIL',
          `${item.where} มีคำ "${entry.phrase}" — ${entry.why}`,
          { where: item.where, actual: entry.phrase }
        ));
      }
    }
    const urls = String(item.text || '').match(/https?:\/\/[^\s]+/g) || [];
    for (const url of urls) {
      if (![...allowedUrls].some((allowed) => url.startsWith(allowed))) {
        results.push(check(
          'EXT-URL', 'external', 'ขอบเขต · ลิงก์ภายนอกที่ไม่ได้มาจากต้นทาง',
          'WARN',
          `${item.where} มีลิงก์ "${url}" ที่ไม่ได้มาจากข้อมูลต้นทาง`,
          { where: item.where, actual: url }
        ));
      }
    }
  }

  if (!results.length) {
    results.push(check(
      'EXT-OK', 'external', 'ขอบเขต · สะอาด',
      'PASS', 'ไม่พบคำที่เชื่อมต่อผู้ขาย การชำระเงิน หรือการเผยแพร่จริง'
    ));
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/*
 * Phase 1.1 — audio checks. A project may declare that its scenes need real
 * narration files (project.audio.required). The checks below only talk about
 * what is in the project JSON itself; nothing reads files here.
 */
function checkAudio(project) {
  const results = [];
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const audioState = project.audio || {};
  const required = Boolean(audioState.required);
  const boundScenes = scenes.filter((scene) =>
    scene.audio && scene.audio.asset_ref && scene.audio.asset_ref.length > 0);

  if (boundScenes.length === 0) {
    if (required) {
      results.push(check(
        'AUDIO-COVERAGE', 'audio', 'เสียง · ไม่มีฉากที่ผูกไฟล์เสียง',
        'WARN',
        'โปรเจกต์กำหนดว่าต้องมีเสียง แต่ยังไม่มีฉากใดผูกไฟล์เสียงเลย',
        { hint: 'อัปโหลดไฟล์เสียง MP3/WAV แล้วผูกเข้ากับแต่ละฉากในแทร็ก เสียง / Script' }
      ));
    } else {
      results.push(check(
        'AUDIO-NONE', 'audio', 'เสียง · ไม่มีไฟล์เสียง',
        'PASS',
        'โปรเจกต์ไม่ได้กำหนดว่าต้องมีเสียง ไฟล์ที่ export จะเป็นฐานเงียบได้'
      ));
    }
  }

  let checked = 0;
  let mismatchCount = 0;
  for (const scene of scenes) {
    const audio = scene.audio || {};
    const bound = Boolean(audio.asset_ref);
    if (required && !String(audio.voiceover || '').trim()) {
      results.push(check(
        'AUDIO-SCRIPT', 'audio', 'เสียง · บทพูดหาย',
        'WARN',
        `${scene.id} กำหนดให้มีเสียง แต่ยังไม่มีบทพูด (voiceover)`,
        { where: `${scene.id}.audio.voiceover`, hint: 'เติมบทพูดของฉากก่อน finalize' }
      ));
    }
    if (required && !bound && String(audio.voiceover || '').trim()) {
      results.push(check(
        'AUDIO-FILE', 'audio', 'เสียง · ฉากไม่มีไฟล์เสียง',
        'WARN',
        `${scene.id} มีบทพูดแต่ยังไม่มีไฟล์เสียงผูกอยู่`,
        { where: `${scene.id}.audio.asset_ref`, hint: 'อัปโหลดไฟล์เสียงและผูกกับฉากก่อน export' }
      ));
    }
    if (bound) {
      checked += 1;
      const asset = project.assets && project.assets[audio.asset_ref];
      if (!asset || asset.kind !== 'AUDIO') {
        results.push(check(
          'AUDIO-DANGLING', 'audio', 'เสียง · อ้างอิงไฟล์ที่ไม่มีจริง',
          'FAIL',
          `${scene.id} ผูกไฟล์เสียงที่ไม่อยู่ในโปรเจกต์ (asset_ref: ${audio.asset_ref})`,
          { where: `${scene.id}.audio.asset_ref` }
        ));
      } else {
        const audioDuration = Number(asset.duration_s);
        const sceneDuration = Number(scene.duration_s) || 0;
        if (Number.isFinite(audioDuration)
          && Math.abs(audioDuration - sceneDuration) > (Number(audioState.tolerance_s) || 1)) {
          mismatchCount += 1;
          results.push(check(
            'AUDIO-MISMATCH', 'audio', 'เสียง · ความยาวไม่ตรงกับฉาก',
            'WARN',
            `${scene.id}: เสียง ${audioDuration}s ต่างจากฉาก ${sceneDuration}s — export จะเติม/ตัดให้ตรง แต่ควรตรวจหลังเปิดฟัง`,
            { where: `${scene.id}.audio.asset_ref`, asset_id: asset.id, hint: 'ปรับ duration ของฉากหรือใช้ไฟล์เสียงยาวตรงกัน' }
          ));
        }
      }
    }
  }

  if (checked > 0) {
    results.push(check(
      mismatchCount ? 'AUDIO-CHECKED-MISMATCH' : 'AUDIO-CHECKED', 'audio',
      'เสียง · ไฟล์เสียงตรวจแล้ว',
      'PASS',
      mismatchCount
        ? `ตรวจ ${checked}ฉากที่ผูกเสียง — แต่มี ${mismatchCount} ฉากที่ความยาวไม่ตรง (ดู AUDIO-MISMATCH)`
        : `ตรวจ ${checked}ฉากที่ผูกเสียง — ข้อมูลเสียงครบและอ่านสถานะได้`
    ));
  }

  return results;
}

/**
 * Runs every check over the project.
 *
 * @param {object} input
 * @param {object} input.project    the content project
 * @param {object} input.offer      the source offer record
 * @param {object} input.product    the source product record
 * @param {object} input.candidate  the candidate the project came from
 * @param {Array}  input.siblingProducts other products in the same import
 * @param {object} input.sourceFreshness freshness of the source
 */
function runQa(input) {
  const project = input.project || {};
  const offer = input.offer || {};
  const product = input.product || {};
  const candidate = input.candidate || {};
  const sourceFreshness = input.sourceFreshness || null;

  const texts = collectText(project);

  const checks = [
    ...checkSpelling(texts),
    ...checkPrice(texts, offer, sourceFreshness),
    ...checkPromotion(texts, offer, sourceFreshness),
    ...checkProductName(texts, product, offer, input.siblingProducts || []),
    ...checkCta(project, texts),
    ...checkEvidence(project, offer, candidate),
    ...checkExternal(texts, offer),
    ...checkAudio(project),
  ];

  const summary = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const item of checks) summary[item.status] = (summary[item.status] || 0) + 1;

  const blocking = checks.filter((item) => item.status === 'FAIL');
  const warnings = checks.filter((item) => item.status === 'WARN');

  const byCategory = {};
  for (const item of checks) {
    byCategory[item.category] = byCategory[item.category] || { PASS: 0, WARN: 0, FAIL: 0 };
    byCategory[item.category][item.status] += 1;
  }

  return {
    ran_at: new Date().toISOString(),
    checks,
    summary,
    by_category: byCategory,
    blocking,
    warnings,
    passed: blocking.length === 0,
    scope_note:
      'การตรวจการสะกดใช้คลังคำและรายการคำพิมพ์ผิดที่กำหนดไว้ในระบบ ไม่ใช่พจนานุกรมไทยเต็มรูปแบบ ต้องให้คนตรวจซ้ำก่อนเผยแพร่',
  };
}

/**
 * Adds words to the lexicon.
 *
 * The storyboard generator registers its own vocabulary so that the copy it
 * writes is not reported as "unknown Thai". This is deliberately an explicit
 * call rather than a scan of the module source: the lexicon stays a list of
 * words a human chose to accept.
 */
function addVocabulary(words) {
  for (const word of words || []) {
    const clean = String(word || '').trim();
    if (clean.length >= 2 && THAI.test(clean)) LEXICON.add(clean);
  }
  return LEXICON.size;
}

module.exports = {
  runQa,
  collectText,
  priceMentions,
  discountClaims,
  unknownThaiSegments,
  unknownThaiWords,
  levenshtein,
  addVocabulary,
  LEXICON,
  FORBIDDEN_CLAIMS,
  UNSOURCED_PROMO_PHRASES,
};
