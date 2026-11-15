#!/usr/bin/env node
'use strict';

/*
 * ACE — E1 Baseline Manifest tool (Addendum D1)
 *
 * Purpose: hold the full 64-hexadecimal-character SHA-256 values for the
 * State Baseline Manifest and Writable Path Inventory, and re-verify the
 * manifest against the bytes actually on disk.
 *
 * Hashing method: SHA-256 over raw file bytes. No JSON canonicalisation, no
 * LF/CRLF normalisation, no trimming — identical to `sha256sum <path>`.
 *
 * Usage:
 *   node verification/baseline-manifest-check-2026-11-03.js --write   # (re)generate manifest
 *   node verification/baseline-manifest-check-2026-11-03.js           # verify manifest vs disk
 *
 * --write overwrites the manifest. It is a baseline-capture action, not a
 * routine operation: run it only when a new baseline is intended.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'verification', 'baseline-manifest-2026-11-03.json');

const STATE_STORES = [
  {
    id: 'S1',
    role: 'Legacy State Store (Addendum D1) — app-level persisted state',
    path: 'data/app/state.json',
    notes: 'D1 legacy state store; write target of the app runtime.'
  },
  {
    id: 'S2',
    role: 'MVP runtime fixture state — MVP workflow slice store',
    path: 'data/mvp/fixture-state.json',
    notes: 'Second state store; baseline kept separately from S1.'
  }
];

// Writable paths E1 must observe. Directories are expanded to a recursive,
// hashed file listing so the footprint is pinned by content, not by count.
const WRITABLE_PATHS = [
  {
    id: 'W1',
    role: 'Legacy state store directory',
    path: 'data/app',
    notes: 'Includes state.json.backup; both files are part of the write footprint.'
  },
  {
    id: 'W2',
    role: 'MVP fixture state directory',
    path: 'data/mvp',
    notes: ''
  },
  {
    id: 'W3',
    role: 'Content Library store',
    path: 'data/mission1',
    notes: 'Library holds no structured script_version field; filename is a traceability link only.'
  },
  {
    id: 'W4',
    role: 'Export output root (MP4, preview, render work files)',
    path: 'app/exports',
    notes: 'Production export root. work/ subdirectory counts as part of the write footprint when no deletion evidence exists.'
  },
  {
    id: 'W5',
    role: 'Render work area (visual verification)',
    path: '.tmp/visual-verify',
    notes: 'Work-area copy used for render rehearsal; carries preview.png and work/ intermediates.'
  }
];

const IDENTITY_TARGETS = [
  {
    id: 'I1',
    kind: 'mp4',
    role: 'Exported MP4 (version-bound filename)',
    path: 'app/exports/CNT-1/CNT-1-v5.mp4',
    notes: 'Filename carries the version token (v5) — MP4 identity is version-bound.'
  },
  {
    id: 'I2',
    kind: 'mp4',
    role: 'Exported MP4 (version-bound filename, work area)',
    path: '.tmp/visual-verify/exports/CNT-1/CNT-1-v2.mp4',
    notes: 'Filename carries the version token (v2).'
  },
  {
    id: 'I3',
    kind: 'preview',
    role: 'Preview image (NOT version-bound)',
    path: '.tmp/visual-verify/exports/CNT-1/CNT-1-preview.png',
    notes: 'Filename carries no version token. This file alone cannot prove which MP4 version it belongs to; E1 must store this hash and path as the identity evidence.'
  },
  {
    id: 'I4',
    kind: 'work_file',
    role: 'Render work file — subtitle track',
    path: '.tmp/visual-verify/exports/CNT-1/work/subtitle.ass',
    notes: 'Render intermediate; no deletion evidence exists, so it counts as write footprint.'
  },
  {
    id: 'I5',
    kind: 'work_file',
    role: 'Render work file — filter graph',
    path: '.tmp/visual-verify/exports/CNT-1/work/filter.txt',
    notes: 'Render intermediate; no deletion evidence exists, so it counts as write footprint.'
  },
  {
    id: 'I6',
    kind: 'library',
    role: 'Content Library index',
    path: 'data/mission1/content-library.json',
    notes: 'No structured script_version field. Filename references are traceability links only; this manifest must not be read as evidence of a direct Library version identity.'
  }
];

function sha256File(absPath) {
  const buf = fs.readFileSync(absPath);
  return {
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length
  };
}

function statIso(absPath) {
  return fs.statSync(absPath).mtime.toISOString();
}

function describeFile(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return { path: relPath, present: false };
  }
  const info = sha256File(abs);
  return {
    path: relPath,
    present: true,
    bytes: info.bytes,
    sha256: info.sha256,
    mtime_utc: statIso(abs)
  };
}

function listFilesRecursive(relDir) {
  const absDir = path.join(ROOT, relDir);
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return null;
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
      }
    }
  };
  walk(absDir);
  return out.sort();
}

function describePathEntry(entry) {
  const abs = path.join(ROOT, entry.path);
  const present = fs.existsSync(abs);
  const record = {
    id: entry.id,
    role: entry.role,
    path: entry.path,
    kind: present ? (fs.statSync(abs).isDirectory() ? 'directory' : 'file') : 'absent',
    present,
    notes: entry.notes
  };
  if (!present) return record;
  const files = fs.statSync(abs).isDirectory() ? listFilesRecursive(entry.path) : [entry.path];
  record.file_count = files.length;
  record.files = files.map(describeFile);
  return record;
}

function buildManifest() {
  return {
    manifest_id: 'ACE-E1-BASELINE-2026-11-03',
    schema: 'ace.baseline-manifest/v1',
    addendum: 'Addendum D1 — Legacy State Store',
    gate: 'E1 — first export + guard observation',
    hash_algorithm: 'sha256',
    hash_encoding: 'lowercase hexadecimal',
    hash_length: 64,
    hash_method:
      'SHA-256 over raw file bytes; no canonicalisation, no newline normalisation, no trimming (identical to sha256sum <path>)',
    generated_at_utc: new Date().toISOString(),
    generated_by: 'verification/baseline-manifest-check-2026-11-03.js --write',
    repo_root_relative: true,
    state_baseline: {
      stores: STATE_STORES.map((s) => {
        const described = describeFile(s.path);
        return {
          id: s.id,
          role: s.role,
          path: s.path,
          present: described.present,
          bytes: described.bytes,
          sha256: described.sha256,
          mtime_utc: described.mtime_utc,
          notes: s.notes
        };
      })
    },
    writable_path_inventory: WRITABLE_PATHS.map(describePathEntry),
    identity_findings: {
      statement:
        'MP4 filenames are version-bound; preview.png is not; the Content Library has no structured script_version field; render work files have no deletion evidence.',
      targets: IDENTITY_TARGETS.map((t) => {
        const described = describeFile(t.path);
        return {
          id: t.id,
          kind: t.kind,
          role: t.role,
          path: t.path,
          present: described.present,
          bytes: described.bytes,
          sha256: described.sha256,
          mtime_utc: described.mtime_utc,
          notes: t.notes
        };
      })
    }
  };
}

function collectExpected(manifest) {
  const expected = [];
  const push = (label, relPath, sha, bytes) => {
    expected.push({ label, path: relPath, sha256: sha, bytes });
  };
  for (const s of manifest.state_baseline.stores) push(`${s.id} state store`, s.path, s.sha256, s.bytes);
  for (const w of manifest.writable_path_inventory) {
    for (const f of w.files || []) push(`${w.id} inventory file`, f.path, f.sha256, f.bytes);
  }
  for (const t of manifest.identity_findings.targets) push(`${t.id} identity target`, t.path, t.sha256, t.bytes);
  return expected;
}

function verify() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`FAIL  manifest not found: ${path.relative(ROOT, MANIFEST_PATH)}`);
    console.error('      run with --write to capture a baseline first');
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const expected = collectExpected(manifest);
  const failures = [];
  let checked = 0;

  console.log('=== ACE E1 Baseline Manifest — sha256 verification ===');
  console.log(`manifest : ${path.relative(ROOT, MANIFEST_PATH).split(path.sep).join('/')}`);
  console.log(`manifest_id: ${manifest.manifest_id}`);
  console.log(`algorithm: ${manifest.hash_algorithm} (${manifest.hash_length} hex chars)`);
  console.log('');

  for (const exp of expected) {
    if (!exp.sha256) continue;
    if (!/^[0-9a-f]{64}$/.test(exp.sha256)) {
      failures.push({ ...exp, reason: `manifest value is not 64 lowercase hex chars (len=${String(exp.sha256).length})` });
      console.log(`FAIL  ${exp.label} :: ${exp.path}\n      ${exp.reason}`);
      continue;
    }
    const abs = path.join(ROOT, exp.path);
    if (!fs.existsSync(abs)) {
      failures.push({ ...exp, reason: 'file missing on disk' });
      console.log(`FAIL  ${exp.label} :: ${exp.path}\n      file missing on disk`);
      continue;
    }
    const actual = sha256File(abs);
    checked += 1;
    const hashOk = actual.sha256 === exp.sha256;
    const sizeOk = exp.bytes === undefined || actual.bytes === exp.bytes;
    if (hashOk && sizeOk) {
      console.log(`OK    ${exp.label} :: ${exp.path}`);
      console.log(`      ${actual.sha256}  (${actual.bytes} bytes)`);
    } else {
      failures.push({ ...exp, reason: 'hash or size mismatch', actual });
      console.log(`FAIL  ${exp.label} :: ${exp.path}`);
      console.log(`      manifest sha256: ${exp.sha256}  (${exp.bytes} bytes)`);
      console.log(`      actual   sha256: ${actual.sha256}  (${actual.bytes} bytes)`);
    }
  }

  console.log('');
  console.log(`checked ${checked} file(s); failures ${failures.length}`);
  if (failures.length > 0) {
    console.log('');
    console.log('RESULT: FAIL — manifest does not match the files on disk.');
    process.exitCode = 1;
    return;
  }
  console.log('RESULT: PASS — every manifest hash and size matches the file on disk.');
}

function write() {
  const manifest = buildManifest();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`wrote ${path.relative(ROOT, MANIFEST_PATH).split(path.sep).join('/')}`);
  for (const s of manifest.state_baseline.stores) {
    console.log(`  ${s.id} ${s.path}\n     sha256 ${s.sha256}\n     bytes  ${s.bytes}`);
  }
}

const arg = process.argv[2];
if (arg === '--write') write();
else verify();
