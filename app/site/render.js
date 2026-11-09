'use strict';

/**
 * ACE A1 — article HTML renderer.
 *
 * Rules:
 *   · Every interpolated value is escaped; no raw HTML reaches the output.
 *   · The page uses an external stylesheet only. The server's CSP forbids
 *     inline scripts, inline styles and inline event handlers, so none are
 *     emitted here.
 *   · The output is deterministic: no clock, no timestamps, no randomness.
 *   · Nothing internal leaks: no absolute paths, no hashes, no environment.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function renderFacts(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return '';
  const rows = facts
    .map((row) => `        <div class="fact">\n          <dt>${esc(row.label)}</dt>\n          <dd>${esc(row.value)}</dd>\n        </div>`)
    .join('\n');
  return `      <section class="facts" aria-label="ข้อมูลสำคัญ">\n        <dl>\n${rows}\n        </dl>\n      </section>\n`;
}

function renderQa(qa) {
  if (!qa) return '';
  const warnings = Array.isArray(qa.warnings) && qa.warnings.length > 0
    ? `\n          <ul class="qa-warnings">\n${qa.warnings
        .map((item) => `            <li>${esc(item.message)}</li>`)
        .join('\n')}\n          </ul>`
    : '';
  return (
    `      <aside class="qa" aria-label="ผลตรวจคุณภาพ">\n` +
    `        <p class="qa-title">ผลตรวจคุณภาพภาษา: ${esc(qa.banner)}</p>\n` +
    `        <p class="qa-note">${esc(qa.note)}</p>${warnings}\n` +
    `      </aside>\n`
  );
}

function renderSections(sections) {
  return sections
    .map((section) => {
      const paragraphs = section.paragraphs
        .map((text) => `        <p class="prose">${esc(text)}</p>`)
        .join('\n');
      const chips = section.evidence.length > 0
        ? `        <p class="evidence-refs">หลักฐาน: ${section.evidence
          .map((entry) => `<span class="chip">${esc(entry.id)}</span>`)
          .join(' ')}</p>`
        : '';
      return (
        `      <section class="article-section" data-role="${esc(section.role)}">\n` +
        `        <h2>${esc(section.heading)}</h2>\n` +
        `${paragraphs}${chips ? `\n${chips}` : ''}\n` +
        `      </section>`
      );
    })
    .join('\n');
}

function renderSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return '';
  const items = sources
    .map((entry) => {
      const meta = [
        entry.source_ids.length > 0 ? `แหล่งอ้างอิง: ${entry.source_ids.join(', ')}` : '',
        entry.checked_at ? `ตรวจเมื่อ ${entry.checked_at}` : '',
        entry.synthetic ? 'ข้อมูล synthetic' : '',
      ].filter(Boolean).join(' · ');
      const limitations = entry.limitations.length > 0
        ? `\n            <p class="evidence-limit">ข้อจำกัด: ${esc(entry.limitations.join(' / '))}</p>`
        : '';
      return (
        `          <li class="evidence-item">\n` +
        `            <p class="evidence-id">${esc(entry.id)} <span class="tag">ต้นฉบับ (EN)</span></p>\n` +
        `            <p class="evidence-statement" lang="en">${esc(entry.statement)}</p>` +
        `${limitations}\n` +
        `            <p class="evidence-meta">${esc(meta)}</p>\n` +
        `          </li>`
      );
    })
    .join('\n');
  return (
    `      <section class="sources" aria-label="ที่มาของข้อมูล">\n` +
    `        <details>\n` +
    `          <summary>ที่มาของข้อมูล (${sources.length})</summary>\n` +
    `          <ul class="evidence-list">\n${items}\n          </ul>\n` +
    `        </details>\n` +
    `      </section>\n`
  );
}

function renderHero(hero) {
  if (!hero || !hero.src) return '';
  return (
    `      <figure class="hero">\n` +
    `        <img src="${esc(hero.src)}" alt="${esc(hero.alt)}" width="1080" height="1920" loading="lazy">\n` +
    `        <figcaption>${esc(hero.caption)}</figcaption>\n` +
    `      </figure>\n`
  );
}

function renderArticle(doc) {
  const disclosure = doc.disclosure
    ? `      <section class="disclosure" aria-label="ข้อความเปิดเผย">\n        <p>${esc(doc.disclosure)}</p>\n      </section>\n`
    : '';

  const stamp = doc.data_as_of
    ? `      <p class="stamp">ข้อมูล ณ ${esc(doc.data_as_of)}</p>\n`
    : '';

  return (
    `<!DOCTYPE html>\n` +
    `<html lang="${esc(doc.lang || 'th')}">\n` +
    `<head>\n` +
    `  <meta charset="utf-8">\n` +
    `  <meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `  <title>${esc(doc.title)}</title>\n` +
    `  <link rel="stylesheet" href="/review.css">\n` +
    `</head>\n` +
    `<body>\n` +
    `  <p class="synthetic-banner">ตัวอย่าง (synthetic) · Local Synthetic Article Prototype</p>\n` +
    `  <main class="page">\n` +
    `    <header class="article-header">\n` +
    `      <p class="eyebrow">รีวิวจากข้อมูลไฟล์ส่งออกของร้าน</p>\n` +
    `      <h1>${esc(doc.h1)}</h1>\n` +
    `${stamp}` +
    `    </header>\n` +
    `${renderHero(doc.hero)}` +
    `${renderQa(doc.qa)}` +
    `${disclosure}` +
    `${renderFacts(doc.facts)}` +
    `    <article id="article-body" class="article-body">\n` +
    `      <p class="prose lead">${esc(doc.lead)}</p>\n` +
    `${renderSections(doc.sections)}\n` +
    `    </article>\n` +
    `    <section class="cta" aria-label="ขั้นตอนถัดไป">\n` +
    `      <p class="cta-label">${esc(doc.cta.label)}</p>\n` +
    `      <p class="cta-note">${esc(doc.cta.note)}</p>\n` +
    `    </section>\n` +
    `${renderSources(doc.sources)}` +
    `    <footer class="article-footer">\n` +
    `      <p>หน้านี้เป็นตัวอย่างภายในเครื่อง ไม่เผยแพร่สู่สาธารณะ และไม่ใช่คำแนะนำจากผู้เชี่ยวชาญ</p>\n` +
    `    </footer>\n` +
    `  </main>\n` +
    `</body>\n` +
    `</html>\n`
  );
}

/** Generic, non-identifying page used for every not-found / blocked response. */
function renderUnavailable() {
  return (
    `<!DOCTYPE html>\n` +
    `<html lang="th">\n` +
    `<head>\n` +
    `  <meta charset="utf-8">\n` +
    `  <meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `  <title>ไม่พบหน้าที่ต้องการ</title>\n` +
    `  <link rel="stylesheet" href="/review.css">\n` +
    `</head>\n` +
    `<body>\n` +
    `  <main class="page">\n` +
    `    <h1>ไม่พบหน้าที่ต้องการ</h1>\n` +
    `    <p class="prose">หน้านี้ไม่มีอยู่ในระบบ หรือยังไม่พร้อมสำหรับการดูตัวอย่าง</p>\n` +
    `  </main>\n` +
    `</body>\n` +
    `</html>\n`
  );
}

module.exports = { esc, renderArticle, renderUnavailable };
