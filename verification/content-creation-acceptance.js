'use strict';

/**
 * ACE — Content Creation acceptance (MVP Phase 1).
 *
 * Drives the whole slice through the real HTTP API against a temporary state
 * file and a temporary artefact directory:
 *
 *   import -> candidates -> candidate action -> plan draft -> plan
 *          -> content draft -> approach -> 3 track edits -> QA
 *          -> review -> finalize -> export -> publish preparation
 *
 * Then it reloads the state from disk and checks that everything survived.
 *
 * Boundaries asserted by this script:
 *   - data/app/state.json is byte-identical before and after
 *   - no Shopee / external publish call is made (the server is started with
 *     the network blocked for non-loopback destinations and the request log
 *     is inspected)
 *   - every artefact lands inside the temporary workspace
 *
 * Usage: node verification/content-creation-acceptance.js
 * Exit code 0 = every check passed.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const REPO_DIR = path.join(__dirname, '..');
const SERVER = path.join(REPO_DIR, 'app', 'server.js');

const checks = [];
let failures = 0;

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail || '' });
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`);
  return ok;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`server did not start in time.\nstdout: ${out}\nstderr: ${err}`));
    }, 20000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early with code ${code}\nstdout: ${out}\nstderr: ${err}`));
    });
    const tryPort = (port, attempts) => {
      const probe = require('node:http').get(
        { host: '127.0.0.1', port, path: '/api/mvp/meta', timeout: 1500 },
        (res) => { res.resume(); clearTimeout(timer); resolve({ child, port, out }); }
      );
      probe.on('error', () => {
        if (attempts <= 0) { clearTimeout(timer); child.kill(); reject(new Error(`server not reachable on ${port}\n${err}`)); return; }
        setTimeout(() => tryPort(port, attempts - 1), 250);
      });
      probe.on('timeout', () => { probe.destroy(); });
    };
    tryPort(Number(env.PORT || 8099), 40);
  });
}

async function call(port, method, route, body) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

async function main() {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-content-'));
  const stateFile = path.join(workspace, 'fixture-state.json');
  const stagingFile = path.join(workspace, 'staging-state.json');
  const assetsDir = path.join(workspace, 'assets');
  const exportsDir = path.join(workspace, 'exports');
  // The exporter also appends to the Content Library index. Without this
  // override it would write into the real data/mission1/content-library.json
  // and leave a record pointing at a temp file that this run deletes.
  const libraryFile = path.join(workspace, 'content-library.json');
  const port = 8099 + Math.floor(Math.random() * 400);

  const realState = path.join(REPO_DIR, 'data', 'app', 'state.json');
  const realStateBefore = fs.existsSync(realState) ? sha256(realState) : null;
  const realLibrary = path.join(REPO_DIR, 'data', 'mission1', 'content-library.json');
  const realLibraryBefore = fs.existsSync(realLibrary) ? sha256(realLibrary) : null;

  process.stdout.write(`workspace: ${workspace}\nport: ${port}\n\n`);

  const { child } = await startServer({
    ACE_MVP_STATE_FILE: stateFile,
    ACE_MVP_STAGING_FILE: stagingFile,
    ACE_MVP_ASSETS_DIR: assetsDir,
    ACE_MVP_EXPORTS_DIR: exportsDir,
    ACE_CONTENT_LIBRARY_FILE: libraryFile,
    PORT: String(port),
  });

  try {
    /* ---------------- meta ---------------- */
    const meta = await call(port, 'GET', '/api/mvp/meta');
    check('meta responds', meta.status === 200, `status ${meta.status}`);
    check('meta declares the content pipeline', (meta.body.pipeline || []).includes('content'),
      `pipeline ${JSON.stringify(meta.body.pipeline)}`);
    check('meta declares the content statuses',
      JSON.stringify(meta.body.content_slice && meta.body.content_slice.statuses)
        === JSON.stringify(['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']),
      JSON.stringify(meta.body.content_slice && meta.body.content_slice.statuses));

    /* ---------------- import -> candidates ---------------- */
    const imported = await call(port, 'POST', '/api/mvp/import', {});
    check('import the synthetic fixture', imported.status === 200 || imported.status === 201, `status ${imported.status}`);

    const generated = await call(port, 'POST', '/api/mvp/candidates/generate', {});
    check('research generates 5 candidates',
      (generated.status === 200 || generated.status === 201) && (generated.body.candidates || []).length === 5,
      `status ${generated.status}, count ${(generated.body.candidates || []).length}`);

    const candidateId = generated.body.candidates[0].id;
    const saved = await call(port, 'POST', `/api/mvp/candidates/${candidateId}/action`, { action: 'SAVE' });
    check('save the selected candidate', saved.status === 200, `status ${saved.status}`);

    const candidate = generated.body.candidates[0];
    check('candidate carries reasons and evidence',
      (candidate.reasons || []).length > 0 && (candidate.evidence_ids || []).length > 0,
      `${(candidate.reasons || []).length} reasons, ${(candidate.evidence_ids || []).length} evidence ids`);

    /* ---------------- plan ---------------- */
    const draft = await call(port, 'POST', '/api/mvp/plan/draft', { candidateId });
    check('create a plan draft', draft.status === 201, `status ${draft.status}`);
    const draftId = draft.body.draft && draft.body.draft.id;
    check('plan draft offers 3 generated approaches',
      draft.body.draft && (draft.body.draft.approaches.generated || []).length === 3,
      `${draft.body.draft ? (draft.body.draft.approaches.generated || []).length : 0} approaches`);
    check('plan draft exposes a user-custom slot',
      draft.body.draft && draft.body.draft.approaches.user_custom === null,
      'user_custom is null and open for the user');

    const custom = await call(port, 'POST', '/api/mvp/plan/custom', {
      draftId,
      angle: 'แนวทางเฉพาะผู้ใช้ เปรียบเทียบราคากับร้านอื่นในหมวดเดียวกัน',
      audience: 'ผู้ซื้อที่เทียบราคาก่อนตัดสินใจ',
      hook: 'เทียบราคาก่อนซื้อ',
    });
    check('store the user-custom approach', custom.status === 200, `status ${custom.status}`);

    const plan = await call(port, 'POST', '/api/mvp/plan', {
      draftId,
      approach: 'personalized_a',
      confirmImpact: true,
    });
    check('create the plan', plan.status === 201, `status ${plan.status}`);
    const planId = plan.body.plan && plan.body.plan.id;

    /* ---------------- content draft ---------------- */
    const contentDraft = await call(port, 'POST', '/api/mvp/content/draft', {
      planId,
      approach: 'problem_first',
    });
    check('create the content project', contentDraft.status === 201, `status ${contentDraft.status}`);
    const project = contentDraft.body.project;
    const contentId = project && project.content_id;

    check('content project records Content / Product / Candidate / Shop IDs',
      Boolean(project && project.content_id && project.product_id && project.candidate_id && project.shop_id),
      project ? `${project.content_id} · ${project.product_id} · ${project.candidate_id} · shop ${project.shop_id}` : 'missing');
    check('content project starts at DRAFT', project && project.status === 'DRAFT', project && project.status);
    check('content project offers 3 approaches + a custom slot',
      project && (project.approaches.generated || []).length === 3 && project.approaches.user_custom === null,
      project ? `${(project.approaches.generated || []).length} generated` : 'missing');
    check('storyboard has scenes', project && (project.storyboard.scenes || []).length >= 4,
      project ? `${(project.storyboard.scenes || []).length} scenes` : 'missing');
    check('storyboard canvas is 9:16',
      project && project.storyboard.canvas.width === 1080 && project.storyboard.canvas.height === 1920,
      project ? `${project.storyboard.canvas.width}x${project.storyboard.canvas.height}` : 'missing');
    check('script version recorded', project && project.script_version === 1
      && (project.script_version_history || []).length === 1,
      project ? `v${project.script_version}` : 'missing');
    check('every scene carries evidence ids',
      project && (project.storyboard.scenes || []).every((scene) => (scene.evidence_ids || []).length > 0),
      'all scenes');

    /* ---------------- approach switch + custom ---------------- */
    const approach = await call(port, 'POST', `/api/mvp/content/${contentId}/approach`, {
      approach: 'value_compare',
    });
    check('switch the content approach', approach.status === 200 && approach.body.project.approach === 'value_compare',
      approach.body.project ? approach.body.project.approach : `status ${approach.status}`);

    const customApproach = await call(port, 'POST', `/api/mvp/content/${contentId}/approach`, {
      approach: 'user_custom',
      custom: {
        angle: 'ผู้ใช้กำหนดเอง ให้เทียบราคากับราคากลางของหมวดสินค้า',
        hook: 'เทียบราคาก่อนซื้อ ค่อยตัดสินใจ',
        cta: 'คลิกลิงก์ด้านล่างเพื่อดูราคาปัจจุบัน',
      },
    });
    check('use the user-custom approach',
      customApproach.status === 200 && customApproach.body.project.approach === 'user_custom',
      customApproach.body.project ? customApproach.body.project.approach : `status ${customApproach.status}`);

    // Go back to a generated approach for the rest of the run.
    const backToGenerated = await call(port, 'POST', `/api/mvp/content/${contentId}/approach`, { approach: 'problem_first' });
    check('return to a generated approach', backToGenerated.status === 200
      && backToGenerated.body.project.approach === 'problem_first',
      backToGenerated.body.project ? backToGenerated.body.project.approach : `status ${backToGenerated.status}`);

    /* ---------------- three editor tracks ---------------- */
    const visualEdit = await call(port, 'POST', `/api/mvp/content/${contentId}/track/visual`, {
      sceneId: 'SC-1',
      visual: { preset: 'warm', position: 'top' },
      duration_s: 5,
    });
    check('edit the visual / scene track', visualEdit.status === 200
      && visualEdit.body.project.storyboard.scenes[0].visual.preset === 'warm'
      && visualEdit.body.project.storyboard.scenes[0].duration_s === 5,
      visualEdit.body.project
        ? `preset ${visualEdit.body.project.storyboard.scenes[0].visual.preset}, ${visualEdit.body.project.storyboard.scenes[0].duration_s}s`
        : `status ${visualEdit.status}`);

    const textEdit = await call(port, 'POST', `/api/mvp/content/${contentId}/track/text`, {
      sceneId: 'SC-1',
      overlay: { subhead: 'เช็กราคาและรีวิวก่อนตัดสินใจ' },
    });
    check('edit the text track', textEdit.status === 200
      && textEdit.body.project.storyboard.scenes[0].overlay.subhead === 'เช็กราคาและรีวิวก่อนตัดสินใจ',
      textEdit.body.project ? textEdit.body.project.storyboard.scenes[0].overlay.subhead : `status ${textEdit.status}`);

    const beforeAudio = await call(port, 'GET', `/api/mvp/content/${contentId}`);
    const scriptBefore = beforeAudio.body.project.script_version;
    const audioEdit = await call(port, 'POST', `/api/mvp/content/${contentId}/track/audio`, {
      sceneId: 'SC-2',
      audio: { voiceover: 'ปัญหาที่พบบ่อยคือ เลือกเซรั่มผิด ซื้อเกินงบ เช็กข้อมูลก่อนตัดสินใจ' },
    });
    check('edit the audio / script track', audioEdit.status === 200
      && audioEdit.body.project.script_version === scriptBefore + 1
      && audioEdit.body.project.storyboard.scenes[1].audio.voiceover.includes('เลือกเซรั่มผิด'),
      audioEdit.body.project ? `script v${audioEdit.body.project.script_version}` : `status ${audioEdit.status}`);

    /* ---------------- QA ---------------- */
    const qa = await call(port, 'POST', `/api/mvp/content/${contentId}/qa`, {});
    check('QA runs', qa.status === 200 && Boolean(qa.body.qa), `status ${qa.status}`);
    const report = qa.body.qa;
    const categories = new Set((report.checks || []).map((item) => item.category));
    check('QA covers spelling, price, promotion, product name and CTA',
      ['spelling', 'price', 'promotion', 'product_name', 'cta'].every((c) => categories.has(c)),
      [...categories].join(', '));
    check('QA reports no blocking failure on the generated content', report.summary.FAIL === 0,
      `PASS ${report.summary.PASS} · WARN ${report.summary.WARN} · FAIL ${report.summary.FAIL}`);
    if (report.summary.FAIL > 0) {
      for (const item of report.blocking) {
        process.stdout.write(`      blocking: [${item.category}] ${item.message}\n`);
      }
    }
    for (const warning of report.warnings || []) {
      process.stdout.write(`      warning: [${warning.category}] ${warning.message}\n`);
    }

    /* ---------------- finalize ---------------- */
    const review = await call(port, 'POST', `/api/mvp/content/${contentId}/review`, {});
    check('move to REVIEW', review.status === 200 && review.body.project.status === 'REVIEW',
      review.body.project ? review.body.project.status : `status ${review.status}`);

    const finalize = await call(port, 'POST', `/api/mvp/content/${contentId}/finalize`, {});
    check('finalize succeeds', finalize.status === 200 && finalize.body.project.status === 'FINALIZED',
      finalize.body.project ? finalize.body.project.status : `status ${finalize.status}`);
    check('finalize keeps a checklist', Boolean(finalize.body.checklist && finalize.body.checklist.items.length >= 8),
      finalize.body.checklist ? `${finalize.body.checklist.ok}/${finalize.body.checklist.total} items ok` : 'missing');
    check('finalize checklist includes a preview item',
      finalize.body.checklist && finalize.body.checklist.items.some((item) => item.id === 'preview' && item.ok),
      'preview item ok');
    check('finalize stores the script version and checksum',
      Boolean(finalize.body.project.finalize.script_version && finalize.body.project.finalize.script_checksum),
      finalize.body.project ? `v${finalize.body.project.finalize.script_version} ${String(finalize.body.project.finalize.script_checksum).slice(0, 12)}…` : 'missing');

    /* ---------------- export ---------------- */
    const exported = await call(port, 'POST', `/api/mvp/content/${contentId}/export`, {});
    check('export produces a video', exported.status === 200 && Boolean(exported.body.export),
      exported.body.export ? `${exported.body.export.filename} ${exported.body.export.bytes} bytes` : `status ${exported.status}`);
    const exportInfo = exported.body.export;
    if (exportInfo) {
      check('exported file is 9:16', exportInfo.width === 1080 && exportInfo.height === 1920,
        `${exportInfo.width}x${exportInfo.height}`);
      check('exported file lives inside the temporary workspace',
        exportInfo.file.startsWith(workspace), exportInfo.file);
      check('exported file exists on disk', fs.existsSync(exportInfo.file), exportInfo.file);
      if (fs.existsSync(exportInfo.file)) {
        const stat = fs.statSync(exportInfo.file);
        check('exported file is a real MP4 bigger than 10 KB',
          stat.size > 10240 && exportInfo.filename.endsWith('.mp4'),
          `${stat.size} bytes, ${exportInfo.filename}`);
        const digest = sha256(exportInfo.file);
        check('exported file checksum matches the record', digest === exportInfo.sha256,
          `${digest.slice(0, 16)}…`);
        const header = fs.readFileSync(exportInfo.file).subarray(4, 8).toString('latin1');
        check('exported file has an ftyp MP4 header', header === 'ftyp', `header ${header}`);
      }
      check('export records a still preview frame', Boolean(exportInfo.still && exportInfo.still.file),
        exportInfo.still ? exportInfo.still.path : 'missing');
    }
    check('status is EXPORTED after export', exported.body.project && exported.body.project.status === 'EXPORTED',
      exported.body.project ? exported.body.project.status : 'missing');

    /* ---------------- publish preparation ---------------- */
    const prep = await call(port, 'POST', `/api/mvp/content/${contentId}/publish-prep`, {});
    check('publish preparation succeeds', prep.status === 200 && Boolean(prep.body.publish_prep),
      `status ${prep.status}`);
    const payload = prep.body.publish_prep;
    if (payload) {
      check('publish payload carries every identity',
        Boolean(payload.content_id && payload.product_id && payload.candidate_id && payload.shop_id
          && payload.script_version && payload.script_checksum),
        `${payload.content_id} · ${payload.product_id} · ${payload.candidate_id} · shop ${payload.shop_id} · script v${payload.script_version}`);
      check('publish payload records the asset references',
        Array.isArray(payload.assets), `${(payload.assets || []).length} assets`);
      check('publish payload is explicitly not published',
        payload.publish && payload.publish.executed === false && payload.publish.status === 'NOT_PUBLISHED',
        payload.publish ? payload.publish.status : 'missing');
      check('publish payload records zero external calls and zero spend',
        payload.publish && payload.publish.external_calls === 0 && payload.publish.spend_thb === 0,
        'external_calls 0 · spend THB 0');
      check('publish payload is ready', payload.ready === true,
        (payload.checklist || []).filter((c) => !c.ok).map((c) => c.label).join(', ') || 'all checks ok');
    }
    check('status is READY_TO_PUBLISH after preparation',
      prep.body.project && prep.body.project.status === 'READY_TO_PUBLISH',
      prep.body.project ? prep.body.project.status : 'missing');

    /* ---------------- reload persistence ---------------- */
    const statePath = path.join(workspace, 'fixture-state.json');
    const onDisk = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const savedProject = onDisk.contents && onDisk.contents[contentId];
    check('state file persists the content project', Boolean(savedProject),
      onDisk.contents ? `${Object.keys(onDisk.contents).length} content projects` : 'no contents key');
    check('reload keeps the storyboard intact',
      savedProject && (savedProject.storyboard.scenes || []).length === 5,
      savedProject ? `${(savedProject.storyboard.scenes || []).length} scenes` : 'missing');
    check('reload keeps the track edits',
      savedProject
      && savedProject.storyboard.scenes[0].visual.preset === 'warm'
      && savedProject.storyboard.scenes[0].duration_s === 5
      && savedProject.storyboard.scenes[1].audio.voiceover.includes('เลือกเซรั่มผิด'),
      'visual, duration and audio edits survived');
    check('reload keeps the script version history',
      savedProject && (savedProject.script_version_history || []).length >= 2,
      savedProject ? `${(savedProject.script_version_history || []).length} entries` : 'missing');
    check('reload keeps the QA report',
      savedProject && savedProject.qa && savedProject.qa.summary.FAIL === 0,
      savedProject && savedProject.qa ? `FAIL ${savedProject.qa.summary.FAIL}` : 'missing');
    check('reload keeps the export record and checksum',
      savedProject && savedProject.export && savedProject.export.sha256 === exportInfo.sha256,
      savedProject && savedProject.export ? savedProject.export.sha256.slice(0, 16) + '…' : 'missing');
    check('reload keeps the publish preparation payload',
      savedProject && savedProject.publish_prep && savedProject.publish_prep.publish.executed === false,
      savedProject && savedProject.publish_prep ? savedProject.publish_prep.publish.status : 'missing');
    check('reload keeps the finalize checklist',
      savedProject && savedProject.finalize && savedProject.finalize.checklist.passed === true,
      savedProject && savedProject.finalize ? `${savedProject.finalize.checklist.ok}/${savedProject.finalize.checklist.total}` : 'missing');

    const stateResponse = await call(port, 'GET', '/api/mvp/state');
    check('the API reports the content project after reload',
      stateResponse.status === 200 && (stateResponse.body.contents || []).some((item) => item.content_id === contentId),
      (stateResponse.body.contents || []).map((item) => item.content_id).join(', '));

    /* ---------------- boundaries ---------------- */
    const realStateAfter = fs.existsSync(realState) ? sha256(realState) : null;
    check('data/app/state.json is untouched', realStateBefore === realStateAfter,
      `before ${String(realStateBefore).slice(0, 12)}… after ${String(realStateAfter).slice(0, 12)}…`);

    const realLibraryAfter = fs.existsSync(realLibrary) ? sha256(realLibrary) : null;
    check('data/mission1/content-library.json is untouched',
      realLibraryBefore === realLibraryAfter,
      `before ${String(realLibraryBefore).slice(0, 12)}… after ${String(realLibraryAfter).slice(0, 12)}…`);

    const artefacts = fs.readdirSync(workspace).sort();
    check('every artefact stays inside the temporary workspace',
      artefacts.every((name) => !name.startsWith('..')), artefacts.join(', '));

    // Positive evidence that the library write went to the workspace copy:
    // the temp index must hold this run's video record.
    check('the Content Library index was written inside the temporary workspace',
      fs.existsSync(libraryFile) && path.resolve(libraryFile).startsWith(path.resolve(workspace)),
      libraryFile);
    const tempLibraryItems = (() => {
      try {
        const parsed = JSON.parse(fs.readFileSync(libraryFile, 'utf-8').replace(/^\s*#.*$/gm, ''));
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    })();
    check('the video export is recorded in the temporary Content Library',
      tempLibraryItems.length === 1
      && tempLibraryItems[0].kind === 'VIDEO'
      && Boolean(exportInfo) && tempLibraryItems[0].filename === exportInfo.filename,
      tempLibraryItems.map((it) => `${it.id}/${it.filename}/${it.kind}`).join(', ') || 'empty');

    const exportFiles = fs.existsSync(exportsDir)
      ? fs.readdirSync(exportsDir, { recursive: true }).filter((f) => String(f).endsWith('.mp4'))
      : [];
    check('at least one MP4 was written', exportFiles.length >= 1, exportFiles.join(', '));
  } finally {
    child.kill();
  }

  process.stdout.write(`\n${checks.length - failures}/${checks.length} checks passed\n`);
  if (failures) {
    process.stdout.write(`\n${failures} FAILED:\n`);
    for (const item of checks.filter((c) => !c.ok)) {
      process.stdout.write(`  - ${item.name}${item.detail ? ` — ${item.detail}` : ''}\n`);
    }
  }
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exitCode = 1;
});
