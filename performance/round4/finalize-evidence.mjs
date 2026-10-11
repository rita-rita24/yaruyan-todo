import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'performance/round4';
const fingerprint = (path) => {
  const bytes = readFileSync(path);
  return {
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};
const sources = [
  'baseline',
  'adopted',
  'icons-candidate',
  'cache-candidate',
  'paths-candidate',
  'svg-html-candidate',
].map((name) => fingerprint(`${directory}/${name}.html`));
const current = fingerprint('yaruyan-todo.html');
if (current.sha256 !== sources[1].sha256)
  throw Error('Current source differs from adopted snapshot');
const records = readdirSync(directory)
  .filter((name) => /^browser-.+-raw\.json$/.test(name))
  .map((name) => {
    const data = JSON.parse(readFileSync(`${directory}/${name}`, 'utf8'));
    const final = name.includes('html-final');
    if (final && !name.includes('functional')) {
      const expected = name.includes('-before-')
        ? sources[0].sha256
        : current.sha256;
      if (data.some((trial) => trial.sourceSha256 !== expected || trial.error))
        throw Error(`Invalid final trial in ${name}`);
    }
    return {
      path: `${directory}/${name}`,
      count: data.length,
      errors: data.filter((trial) => trial.error || trial.failed).length,
      versions: [
        ...new Set(data.map((trial) => trial.sourceSha256).filter(Boolean)),
      ],
      dates: data.map((trial) => trial.date).filter(Boolean),
      final,
    };
  });
const rows = JSON.parse(
  readFileSync(`${directory}/comparison.json`, 'utf8'),
).rows.filter((row) => row.suite.startsWith('html-final-'));
if (rows.some((row) => row.before.n < 5 || row.after.n < 5))
  throw Error('Incomplete final condition');
const fmt = (value) => (value === null ? '未計測' : value.toFixed(1));
writeFileSync(
  `${directory}/final-comparison.md`,
  '# 最終採用版のローカル比較\n\nreadyMs・displayMsは代理指標。開始点・終了条件・制約はreport.md参照。負は悪化、差は観測中央値であり、全体の改善認定や統計的有意差ではない。各行の前後は同じ条件で、各条件の個別値はcomparison.jsonに保存する。\n\n|系列 / route / データ / 保存状態|操作|指標|前 ms|後 ms|短縮 ms|短縮率 %|前/後 n|前 最小–最大 ms|後 最小–最大 ms|\n|---|---|---|---:|---:|---:|---:|---|---|---|\n' +
    rows
      .map(
        (r) =>
          `|${r.suite} / ${r.route} / ${r.parents}×${r.children} / ${r.cache}|${r.operation}|${r.metric}|${fmt(r.before.median)}|${fmt(r.after.median)}|${fmt(r.delta)}|${fmt(r.percent)}|${r.before.n}/${r.after.n}|${fmt(r.before.min)}–${fmt(r.before.max)}|${fmt(r.after.min)}–${fmt(r.after.max)}|`,
      )
      .join('\n') +
    '\n',
);
writeFileSync(
  `${directory}/versions.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      node: process.version,
      gitHead: '1d3ac50',
      production: { url: null, deployed: false, measurements: 0 },
      current,
      sources,
      records,
      finalRows: rows.length,
      finalTrials: records
        .filter(
          (r) =>
            r.final &&
            !r.path.includes('functional') &&
            !r.path.includes('-frames-raw'),
        )
        .reduce((n, r) => n + r.count, 0),
      finalOperationLabels: [...new Set(rows.map((r) => r.operation))],
      finalConditionGroups: [
        ...new Set(
          rows.map((r) =>
            JSON.stringify([r.suite, r.route, r.parents, r.children, r.cache]),
          ),
        ),
      ].length,
      note: 'final-large/final-large-repeat/final-small contain rejected svg-html-candidate, not current production or adopted source; html-final-* contains current adopted source',
    },
    null,
    2,
  ),
);
console.log(
  `${rows.length} final metric rows; ${records.filter((r) => r.final && !r.path.includes('functional') && !r.path.includes('-frames-raw')).reduce((n, r) => n + r.count, 0)} final paired trials recorded`,
);
