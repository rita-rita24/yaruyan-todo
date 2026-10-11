import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'espree';
const paths = [
  'performance/round5/baseline.html',
  'performance/round5/candidate.html',
];
const html = paths.map((path) => readFileSync(path, 'utf8'));
const scripts = html.map(
  (value) => value.match(/<script>([\s\S]*?)<\/script>/)[1],
);
const trees = scripts.map((source) => parse(source, { ecmaVersion: 2026 }));
let changedSegments = 0;
function compare(before, after) {
  if (before && before.type === 'TemplateElement') {
    if (before.value.raw === after.value.raw) return;
    changedSegments++;
    assert.equal(
      after.value.raw,
      before.value.raw.replace(/\n[ \t]*/g, ' ').replace(/> +</g, '><'),
    );
    return;
  }
  if (Array.isArray(before)) {
    assert.equal(before.length, after.length);
    before.forEach((value, i) => compare(value, after[i]));
    return;
  }
  if (before && typeof before === 'object') {
    assert.deepEqual(Object.keys(before), Object.keys(after));
    for (const key of Object.keys(before))
      if (!['start', 'end'].includes(key)) compare(before[key], after[key]);
    return;
  }
  assert.deepEqual(before, after);
}
compare(trees[0], trees[1]);
assert.equal(html[0].replace(scripts[0], ''), html[1].replace(scripts[1], ''));
writeFileSync(
  'performance/round5/source-evidence.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      changedSegments,
      expressionsAndStatementsUnchanged: true,
      outsideScriptUnchanged: true,
      sources: paths.map((path, i) => ({
        path,
        sha256: createHash('sha256').update(html[i]).digest('hex'),
        bytes: Buffer.byteLength(html[i]),
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log('Template-only changes verified: ' + changedSegments);
