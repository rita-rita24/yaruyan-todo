import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'performance/round5';
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const baselineSha = hash(dir + '/baseline.html'),
  finalSha = hash(dir + '/child-v4-candidate.html');
assert.equal(hash('yaruyan-todo.html'), finalSha);
assert.equal(hash(dir + '/adopted.html'), finalSha);
const trials = readdirSync(dir)
  .filter((name) =>
    /^browser-round4-(before|after)-child-v4-.*-raw.json$/.test(name),
  )
  .flatMap((name) => JSON.parse(readFileSync(dir + '/' + name, 'utf8')));
assert.equal(trials.length, 220, 'All final comparison conditions must finish');
for (const trial of trials) {
  assert.ok(!trial.error);
  assert.equal(
    trial.sourceSha256,
    trial.version.startsWith('round4-before') ? baselineSha : finalSha,
  );
}
const rows = JSON.parse(readFileSync(dir + '/comparison.json', 'utf8')).filter(
  (row) => row.series.startsWith('child-v4-'),
);
assert.ok(rows.length);
for (const row of rows) {
  assert.equal(row.before.n, 5);
  assert.equal(row.after.n, 5);
}
writeFileSync(
  dir + '/final-comparison.json',
  JSON.stringify(rows, null, 2) + '\n',
);
const number = (value) =>
  Number.isFinite(value) ? value.toFixed(1) : '算出不可';
const lines = [
  '# 最終版のローカル比較',
  '',
  'readyMsは処理・検証完了、displayMsは検証後の二重requestAnimationFrameまでの代理値。実画素表示、ネイティブ入力待ち、INP、本番時間ではない。initial/repeatは保存状態の差で、ネットワークキャッシュのcold/warmではない。系列ごとに比較し、異なる系列を平均しない。',
  '',
  '|系列・親×子・画面・保存状態|操作|指標|前の中央値 [最小–最大] ms|後の中央値 [最小–最大] ms|短縮 ms|短縮率 %|n 前/後|',
  '|---|---|---|---:|---:|---:|---:|---|',
];
for (const row of rows)
  lines.push(
    `|${row.series}・${row.parents}×${row.children}・${row.route}・${row.cache}|${row.operation}|${row.metric}|${number(row.before.median)} [${number(row.before.min)}–${number(row.before.max)}]|${number(row.after.median)} [${number(row.after.min)}–${number(row.after.max)}]|${number(row.before.median - row.after.median)}|${number(row.shorterPercent)}|${row.before.n}/${row.after.n}|`,
  );
writeFileSync(dir + '/final-comparison.md', lines.join('\n') + '\n');
const candidates = [
  'baseline',
  'compact-candidate',
  'child-candidate',
  'child-v2-candidate',
  'child-v3-candidate',
  'child-v4-first-candidate',
  'child-v4-candidate',
  'adopted',
];
const metadata = {
  date: new Date().toISOString(),
  gitHead: '1d3ac50',
  baselineSha256: baselineSha,
  finalSha256: finalSha,
  finalTrials: trials.length,
  beforeTrials: trials.filter((trial) =>
    trial.version.startsWith('round4-before'),
  ).length,
  afterTrials: trials.filter((trial) =>
    trial.version.startsWith('round4-after'),
  ).length,
  metricRows: rows.length,
  operationLabels: [
    ...new Set(
      trials.flatMap((trial) =>
        trial.measured.map((metric) => metric.operation),
      ),
    ),
  ],
  conditions: [
    ...new Set(
      trials.map((trial) =>
        JSON.stringify([
          trial.version.replace(/^round4-(before|after)-/, ''),
          trial.parents,
          trial.children,
          trial.route,
          trial.cache,
        ]),
      ),
    ),
  ].length,
  firstTrial: trials.map((trial) => trial.date).sort()[0],
  lastTrial: trials
    .map((trial) => trial.date)
    .sort()
    .at(-1),
  sources: candidates.map((name) => ({
    path: dir + '/' + name + '.html',
    sha256: hash(dir + '/' + name + '.html'),
    bytes: readFileSync(dir + '/' + name + '.html').length,
  })),
  caveats: [
    'No production URL or release procedure found',
    'Native search input EventTiming is recorded separately in native-comparison.json; no first-pixel, production INP or continuous FPS measured',
    'Host CPU/GC/background activity not controlled',
    'n=5 does not establish statistical significance',
    'large and large-repeat are separate series; no merged claim',
    'Filtering retains detached DOM for existing model children, capped by model size; heap bytes were not measured',
  ],
};
writeFileSync(dir + '/versions.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(
  JSON.stringify({
    trials: metadata.finalTrials,
    rows: metadata.metricRows,
    operations: metadata.operationLabels.length,
    conditions: metadata.conditions,
  }),
);
