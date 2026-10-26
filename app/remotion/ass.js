'use strict';

/**
 * ACE — ASS (Advanced SubStation Alpha) builder for the local 9:16 renderer.
 *
 * The Content Editor keeps three independent tracks — visual/scene, on-screen
 * text, and audio/script — so this builder is deliberately the *text* half
 * only. The visual track is expressed as background and accent colours that
 * the renderer turns into boxes; the audio track becomes the silent audio
 * bed and the burned-in caption.
 *
 * ASS is used instead of `drawtext` because libass performs real text shaping
 * (HarfBuzz), which is what Thai combining marks need. A `drawtext` layer
 * renders Thai glyphs but does not shape them.
 *
 * Pure module: no I/O, no dependencies, no network.
 */

// ASS colour literals are &HAABBGGRR — alpha first, then blue, green, red.
function argb(hex, alpha = 0) {
  const clean = String(hex || '#000000').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const r = full.slice(0, 2);
  const g = full.slice(2, 4);
  const b = full.slice(4, 6);
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, '0');
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

function assTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  const carry = cs === 100 ? { cs: 0, s: s + 1 } : { cs, s };
  const sec = carry.s % 60;
  const min = m + Math.floor(carry.s / 60);
  return `${h}:${String(min % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(carry.cs).padStart(2, '0')}`;
}

// ASS reads "{", "}", "\n" and "\" as control characters.
function escapeAss(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

// libass measures with the font it loaded, so long lines have to be broken
// before they are handed over. The break is applied on Thai spaces and on
// ASCII spaces; Thai text without spaces is left alone rather than cut in the
// middle of a word. The result keeps real newlines, which escapeAss turns
// into libass line breaks.
function wrapText(text, maxChars) {
  const limit = Math.max(8, Number(maxChars) || 26);
  const paragraphs = String(text == null ? '' : text).split(/\r?\n/);
  const wrapped = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/(\s+)/).filter((w) => w !== '');
    let line = '';
    for (const word of words) {
      if (word.trim() === '') {
        line += word;
        continue;
      }
      if (line.length === 0) {
        line = word;
        continue;
      }
      if (line.length + word.length + 1 > limit) {
        wrapped.push(line.trimEnd());
        line = word;
      } else {
        line += word;
      }
    }
    wrapped.push(line.trimEnd());
  }
  return wrapped.join('\n');
}

const STYLES = [
  // name, fontSize, primary, outline, bold, alignment, marginV
  { name: 'Badge', size: 34, colour: '#8FD4FF', outline: '#0B0D11', bold: 0, align: 7, marginV: 96 },
  { name: 'Head', size: 74, colour: '#FFFFFF', outline: '#0B0D11', bold: -1, align: 8, marginV: 230 },
  { name: 'Sub', size: 46, colour: '#D7DEEA', outline: '#0B0D11', bold: 0, align: 8, marginV: 560 },
  { name: 'Cta', size: 44, colour: '#08121A', outline: '#08121A', bold: -1, align: 2, marginV: 104 },
  { name: 'Caption', size: 36, colour: '#EAF0F8', outline: '#0B0D11', bold: 0, align: 2, marginV: 330 },
  { name: 'Fact', size: 38, colour: '#9FE8B6', outline: '#0B0D11', bold: 0, align: 8, marginV: 1090 },
];

// Where a scene's headline sits depends on the role of the scene, so the
// vertical rhythm stays consistent between scenes. Each slot has its own
// band so the headline, subhead and fact line never collide.
function layoutFor(scene) {
  const position = String((scene.overlay && scene.overlay.position) || 'center').toLowerCase();
  if (position === 'top') return { head: 230, sub: 500, fact: 700 };
  if (position === 'bottom') return { head: 1120, sub: 1380, fact: 1560 };
  return { head: 520, sub: 880, fact: 1090 };
}

/**
 * @param {object} input
 * @param {Array} input.scenes   storyboard scenes (visual + overlay + audio tracks)
 * @param {number} input.width    canvas width (1080)
 * @param {number} input.height   canvas height (1920)
 * @param {string} input.fontFamily  family name libass should use
 */
function buildAss(input) {
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  const width = Number(input.width) || 1080;
  const height = Number(input.height) || 1920;
  const fontFamily = input.fontFamily || 'Leelawadee UI';

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  ];

  for (const style of STYLES) {
    header.push([
      `Style: ${style.name}`,
      fontFamily,
      style.size,
      argb(style.colour, 0),
      argb(style.colour, 0),
      argb(style.outline, 0),
      argb('#000000', 0.55),
      style.bold,
      0,
      0,
      0,
      100,
      100,
      0,
      0,
      1,
      style.name === 'Head' ? 5 : 3,
      style.name === 'Cta' ? 0 : 2,
      style.align,
      70,
      70,
      style.marginV,
      1,
    ].join(','));
  }

  const events = [
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  let cursor = 0;
  for (const scene of scenes) {
    const duration = Math.max(0.5, Number(scene.duration_s) || 3);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;

    const overlay = scene.overlay || {};
    const audio = scene.audio || {};
    const layout = layoutFor(scene);

    const push = (style, text, marginV) => {
      const body = String(text == null ? '' : text).trim();
      if (!body) return;
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,${marginV},,${body}`);
    };

    push('Badge', overlay.badge, STYLES.find((s) => s.name === 'Badge').marginV);

    const headline = wrapText(overlay.headline, overlay.headline_max_chars || 22);
    if (headline) {
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Head,,0,0,${layout.head},,${escapeAss(headline)}`);
    }

    const subhead = wrapText(overlay.subhead, overlay.subhead_max_chars || 30);
    if (subhead) {
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Sub,,0,0,${layout.sub},,${escapeAss(subhead)}`);
    }

    if (overlay.fact) {
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Fact,,0,0,${layout.fact},,${escapeAss(String(overlay.fact).trim())}`);
    }

    if (overlay.cta) {
      const ctaText = wrapText(overlay.cta, 24);
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Cta,,0,0,${STYLES.find((s) => s.name === 'Cta').marginV},,${escapeAss(ctaText)}`);
    }

    if (audio.voiceover) {
      const caption = wrapText(audio.voiceover, 30);
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,${STYLES.find((s) => s.name === 'Caption').marginV},,${escapeAss(caption)}`);
    }
  }

  return `${header.join('\n')}\n${events.join('\n')}\n`;
}

module.exports = { buildAss, argb, assTime, escapeAss, wrapText };
