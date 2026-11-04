'use strict';

/**
 * Test harness for docs/mission1/schemas/content-work-item.schema.json
 *
 * The app has no dependencies on purpose, so this harness implements the
 * JSON Schema subset the contract actually uses instead of pulling in ajv:
 *   type (including type arrays), required, properties, additionalProperties,
 *   enum, pattern, minLength, and if/then.
 *
 * It asserts the two behaviours the contract exists for:
 *   1. the BASE schema accepts product_id = null (nullable by design), and
 *   2. the if/then branch REJECTS null / missing / empty product_id for
 *      type PRODUCT and type REVIEW.
 *
 * Usage:  node docs/mission1/schemas/validate-content-work-item.js
 * Exit:   0 = every case passed, 1 = at least one case failed.
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, 'content-work-item.schema.json');

function typeOk(value, type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case 'string': return typeof value === 'string';
      case 'null': return value === null;
      case 'number': return typeof value === 'number' && Number.isFinite(value);
      case 'integer': return Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
      default: return false;
    }
  });
}

function validate(schema, data, at = '$') {
  const errors = [];
  if (!schema) return errors;

  if (schema.type && !typeOk(data, schema.type)) {
    errors.push(`${at}: expected type ${JSON.stringify(schema.type)}, got ${JSON.stringify(data)}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${at}: ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (typeof data === 'string') {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push(`${at}: length ${data.length} < minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${at}: "${data}" does not match ${schema.pattern}`);
    }
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of schema.required || []) {
      if (!(key in data)) errors.push(`${at}: missing required property "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in data) errors.push(...validate(sub, data[key], `${at}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in (schema.properties || {}))) {
          errors.push(`${at}: additional property "${key}" not allowed`);
        }
      }
    }
  }
  return errors;
}

function validateWithIfThen(schema, data) {
  const errors = validate(schema, data);
  if (schema.if) {
    const ifErrors = validate(schema.if, data);
    if (ifErrors.length === 0) errors.push(...validate(schema.then, data));
  }
  return errors;
}

// --- load ------------------------------------------------------------------
let schema;
try {
  schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  console.log(`schema file parses as JSON: OK (${path.relative(process.cwd(), SCHEMA_PATH)})`);
} catch (err) {
  console.error(`FAIL: schema file is not valid JSON: ${err.message}`);
  process.exit(1);
}

console.log(`base product_id type : ${JSON.stringify(schema.properties.product_id.type)}`);
console.log(`if branch            : ${JSON.stringify(schema.if)}`);
console.log(`then branch          : ${JSON.stringify(schema.then)}`);

// --- base-only behaviour ---------------------------------------------------
const baseOnly = JSON.parse(JSON.stringify(schema));
delete baseOnly.if;
delete baseOnly.then;
const baseErrors = validate(baseOnly, {
  id: 'CWI-1',
  type: 'PRODUCT',
  plan_id: 'PLAN-1-1',
  plan_version: 'v1',
  product_id: null,
});
console.log(`\nbase schema alone, product_id: null -> ${baseErrors.length ? 'INVALID ' + JSON.stringify(baseErrors) : 'valid (base is nullable)'}`);
if (baseErrors.length) {
  console.error('FAIL: the base schema must accept product_id = null');
  process.exit(1);
}

// --- behavioural matrix ----------------------------------------------------
const cases = [
  ['PRODUCT + product_id string', { id: 'CWI-1', type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: 'P-1001' }, true],
  ['REVIEW + product_id string', { id: 'CWI-2', type: 'REVIEW', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: 'P-1001' }, true],
  ['METHOD + no product_id', { id: 'CWI-12', type: 'METHOD', plan_id: 'PLAN-1-1', plan_version: 'v1' }, true],
  ['WORKFLOW + product_id null', { id: 'CWI-13', type: 'WORKFLOW', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: null }, true],
  ['PRODUCT + product_id null', { id: 'CWI-3', type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: null }, false],
  ['PRODUCT + product_id missing', { id: 'CWI-4', type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1' }, false],
  ['PRODUCT + product_id empty string', { id: 'CWI-5', type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: '' }, false],
  ['PRODUCT + product_id number', { id: 'CWI-6', type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: 1001 }, false],
  ['PRODUCT + unknown extra field', { id: 'CWI-7', type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: 'P-1001', oops: 1 }, false],
  ['type outside the enum', { id: 'CWI-8', type: 'PROMO', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: 'P-1001' }, false],
  ['missing required id', { type: 'PRODUCT', plan_id: 'PLAN-1-1', plan_version: 'v1', product_id: 'P-1001' }, false],
];

console.log('');
let failed = 0;
for (const [label, instance, expectValid] of cases) {
  const errors = validateWithIfThen(schema, instance);
  const valid = errors.length === 0;
  const ok = valid === expectValid;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> ${valid ? 'valid' : 'invalid'}${ok ? '' : ` (expected ${expectValid ? 'valid' : 'invalid'})`}`);
  if (!ok) errors.forEach((e) => console.log(`        ${e}`));
}

console.log(`\n${cases.length - failed}/${cases.length} behavioural cases passed`);
if (failed) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
