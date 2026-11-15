'use strict';

/**
 * ACE — Actor Studio generator.
 *
 * Plan can ask Actor Studio to cast a new AI actor, and the resulting persona
 * goes straight into the roster for reuse. Only the configured LLM provider is
 * contacted (`provider.generateScriptDraft`); no image or video model is
 * available in this project, so what is generated is a casting sheet — the
 * identity fields apply everywhere, the reference image stays a manual upload.
 */

const provider = require('./provider/gateway');

const MAX_ACTORS = 3;
const MAX_BRIEF = 1200;
const TYPES = ['human', 'cartoon_2d', 'cartoon_3d', 'mascot', 'product'];
const TYPE_LABELS = {
  human: 'มนุษย์',
  cartoon_2d: 'การ์ตูน 2D',
  cartoon_3d: 'การ์ตูน 3D',
  mascot: 'มาสคอต',
  product: 'สินค้า / วัตถุ',
};

const SYSTEM = [
  'You are a casting director for a Thai affiliate content studio.',
  'Create reusable AI-actor personas ("casting sheets") for short vertical videos.',
  'Answer with JSON only:',
  '{"actors":[{"name":string,"type":"human"|"cartoon_2d"|"cartoon_3d"|"mascot"|"product",',
  '"role":string,"language":string,"voice":string,"look":string,"wardrobe":string,',
  '"tags":string,"notes":string}]}',
  'Rules: unique memorable Thai names; role is one of Presenter, Reviewer, Model, Character, Voice only;',
  'look and wardrobe are concrete visual descriptions useful for image generation;',
  'voice describes gender, age range and tone; tags are 2-4 comma separated lowercase keywords;',
  'never invent brand names or product claims. Answer in Thai for text fields.',
].join(' ');

function fail(status, message) {
  return { ok: false, status, message };
}

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseJsonBlock(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim(),
  ];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (error) {
      /* try the next shape */
    }
  }
  return null;
}

async function generateActors(brief, options = {}) {
  const input = typeof brief === 'string' ? brief.trim() : '';
  if (!input) return fail('invalid_request', 'brief is required');
  if (input.length > MAX_BRIEF) return fail('invalid_request', 'brief is too long');

  const count = Math.min(MAX_ACTORS, Math.max(1, Number(options.count) || 1));
  const type = TYPES.includes(options.type) ? options.type : 'human';

  const prompt = [
    'สร้าง casting sheet จำนวน ' + count + ' คน',
    'หมวดหมู่ที่ต้องการ: ' + type + ' (' + TYPE_LABELS[type] + ')',
    'โจทย์จากผู้ใช้: """' + input + '"""',
  ].join('\n');

  const result = await provider.generateScriptDraft({
    prompt: prompt,
    systemPrompt: SYSTEM,
    model: options.model,
    provider: options.provider,
    allowNetwork: true,
    timeoutMs: 60000,
    maxOutputTokens: 1600,
    env: options.env,
  });

  if (!result.ok) return fail(result.status, result.message);

  const parsed = parseJsonBlock(result.text);
  if (!parsed) return fail('invalid_response', 'the model did not answer with usable JSON');

  const raw = Array.isArray(parsed) ? parsed : Array.isArray(parsed.actors) ? parsed.actors : [];
  const actors = raw.slice(0, count).map(function(item) {
    if (!item || typeof item !== 'object') return null;
    const name = clean(item.name, 80);
    if (!name) return null;
    const itemType = TYPES.includes(item.type) ? item.type : type;
    return {
      name: name,
      type: itemType,
      role: clean(item.role, 40) || 'Presenter',
      language: clean(item.language, 40) || 'ไทย',
      voice: clean(item.voice, 160),
      look: clean(item.look, 260),
      wardrobe: clean(item.wardrobe, 200),
      tags: clean(item.tags, 120),
      notes: clean(item.notes, 300),
    };
  }).filter(Boolean);

  if (!actors.length) return fail('invalid_response', 'no actor persona found in the answer');

  return {
    ok: true,
    status: 'success',
    model: result.model || null,
    latency_ms: Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : null,
    actors: actors,
  };
}

module.exports = { generateActors, TYPES, TYPE_LABELS, MAX_ACTORS };
