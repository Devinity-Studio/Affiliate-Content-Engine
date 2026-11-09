'use strict';

/**
 * ACE A1 — publication seed CLI.
 *
 * Creates or updates one PREVIEW publication record for a synthetic content
 * record so the article page can be reviewed locally. This is a command-line
 * tool only: it adds no HTTP surface and cannot publish anything.
 *
 * Usage:
 *   node app/site/seed.js --content CNT-1 [--state PREVIEW|DRAFT]
 *                         [--mvp <state file>] [--out <publications file>]
 *
 * Exit codes: 0 written · 2 refused (missing content, QA FAIL, bad input).
 */

const path = require('node:path');
const publication = require('./publication');

function parseArgs(argv) {
  const args = { content: '', state: 'PREVIEW', mvp: '', out: '', env: 'local' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      return argv[index] || '';
    };
    switch (token) {
      case '--content': args.content = next(); break;
      case '--state': args.state = next().toUpperCase(); break;
      case '--mvp': args.mvp = next(); break;
      case '--out': args.out = next(); break;
      case '--env': args.env = next(); break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        args.unknown = token;
    }
  }
  return args;
}

function fail(message, details) {
  const payload = { ok: false, error: message };
  if (details) payload.details = details;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 2;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'node app/site/seed.js --content <CONTENT_ID> [--state PREVIEW|DRAFT] [--mvp <file>] [--out <file>]\n',
    );
    return;
  }
  if (args.unknown) return fail(`unknown argument: ${args.unknown}`);
  if (!args.content) return fail('--content is required');
  if (!publication.STATES.includes(args.state)) return fail(`--state must be one of ${publication.STATES.join(', ')}`);

  const mvpFile = args.mvp ? path.resolve(process.cwd(), args.mvp) : publication.mvpStateFile();
  const outFile = args.out ? path.resolve(process.cwd(), args.out) : publication.publicationsFile();

  let state;
  try {
    state = await publication.loadMvpState(mvpFile);
  } catch (err) {
    return fail(`cannot read the MVP state file: ${err.message}`);
  }

  const source = await publication.loadArticleSource(args.content, mvpFile);
  if (!source.ok) return fail(`content "${args.content}" is not available (${source.reason})`);

  const qa = source.content.qa && source.content.qa.summary ? source.content.qa.summary : {};
  const failCount = Number.isFinite(Number(qa.FAIL)) ? Number(qa.FAIL) : 0;
  if (failCount > 0) return fail('refusing to seed: QA reports FAIL items', [`FAIL=${failCount}`]);
  if (!state || !state.synthetic) {
    // Not fatal in itself, but the record must declare itself synthetic: A1 only
    // ever renders synthetic material.
    const contentSynthetic = source.content.synthetic === true;
    if (!contentSynthetic) return fail('refusing to seed: content record is not marked synthetic');
  }

  const productName = (source.offerSnapshot && source.offerSnapshot.product_name)
    || (source.offer && source.offer.product_name)
    || source.content.product_name
    || '';

  let record;
  try {
    record = publication.buildPublication({
      content: source.content,
      productName,
      state: args.state,
      env: args.env,
    });
  } catch (err) {
    return fail(`cannot build the publication record: ${err.message}`);
  }

  let store;
  try {
    store = await publication.loadStore(outFile);
  } catch (err) {
    return fail(`cannot read the publications store: ${err.message}`);
  }

  store.publications[record.pub_id] = record;
  await publication.saveStore(store, outFile);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    written: outFile,
    publication: record,
    note: 'Loopback preview only. Open with the ACE_PREVIEW_TOKEN bearer header; DRAFT is never served.',
  }, null, 2)}\n`);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: 'unexpected failure', message: err && err.message }, null, 2)}\n`);
  process.exitCode = 1;
});
