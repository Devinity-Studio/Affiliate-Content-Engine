// Read-only link checker for the review documents edited this round.
// Usage: node verification/check-md-links.js <file.md> [...]
// Verifies that every relative link resolves to an existing path and, for #L<n>
// anchors, that the target file has at least n lines.

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node verification/check-md-links.js <file.md> [...]');
  process.exit(2);
}

const linkRe = /\]\(([^)\s]+)\)/g;
let checked = 0;
const failures = [];

function lineCount(file) {
  return fs.readFileSync(file, 'utf8').split('\n').length;
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: source file not found`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = linkRe.exec(text)) !== null) {
    const target = match[1];
    if (/^(https?:|mailto:)/.test(target)) continue;

    const [rawPath, anchor] = target.split('#');
    const resolved = rawPath
      ? path.resolve(path.dirname(file), rawPath)
      : path.resolve(file);

    checked += 1;

    if (!fs.existsSync(resolved)) {
      failures.push(`${file} -> ${target}: file missing (${path.relative(process.cwd(), resolved)})`);
      continue;
    }

    if (anchor && /^L\d+$/.test(anchor)) {
      const want = Number(anchor.slice(1));
      const have = lineCount(resolved);
      if (have < want) {
        failures.push(`${file} -> ${target}: anchor L${want} exceeds ${have} lines`);
      }
    }
  }
}

for (const failure of failures) console.log(`FAIL  ${failure}`);
console.log(`${failures.length === 0 ? 'PASS' : 'FAIL'}  ${checked} relative links checked in ${files.length} files, ${failures.length} problems`);
process.exit(failures.length === 0 ? 0 : 1);
