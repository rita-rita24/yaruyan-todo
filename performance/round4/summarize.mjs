import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const median = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return a.length
    ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2
    : null;
};
const rows = [];
for (const suite of [
  'icons-large',
  'icons-small',
  'icons-profile',
  'icons-coverage',
  'cache-large',
  'cache-small',
  'cache-profile',
  'cache-coverage',
  'paths-profile',
  'paths-large',
  'paths-small',
  'paths-coverage',
  'final-large',
  'final-large-repeat',
  'final-small',
  'final-coverage',
  'final-extended',
  'final-backup',
  'final-empty',
  'html-final-large',
  'html-final-large-repeat',
  'html-final-small',
  'html-final-direct',
  'html-final-coverage',
  'html-final-extended',
  'html-final-backup',
  'html-final-empty',
]) {
  const paths = ['before', 'after'].map(
    (version) =>
      `performance/round4/browser-round4-${version}-${suite}-raw.json`,
  );
  if (!paths.every(existsSync)) continue;
  const [before, after] = paths.map((path) =>
    JSON.parse(readFileSync(path, 'utf8')),
  );
  if ([...before, ...after].some((result) => result.error))
    throw new Error(`Invalid trial in ${suite}`);
  const conditions = new Set(
    before.map((result) =>
      JSON.stringify([
        result.cache,
        result.route,
        result.parents,
        result.children,
      ]),
    ),
  );
  for (const condition of conditions) {
    const [cache, route, parents, children] = JSON.parse(condition);
    const matches = (result) =>
      result.cache === cache &&
      result.route === route &&
      result.parents === parents &&
      result.children === children;
    const b = before.filter(matches),
      a = after.filter(matches);
    for (const operation of new Set(
      b.flatMap((result) => result.measured.map((item) => item.operation)),
    )) {
      for (const metric of ['readyMs', 'displayMs']) {
        const values = (data) =>
          data
            .map(
              (result) =>
                result.measured.find((item) => item.operation === operation)?.[
                  metric
                ],
            )
            .filter(Number.isFinite);
        const bv = values(b),
          av = values(a),
          bm = median(bv),
          am = median(av);
        rows.push({
          suite,
          route,
          cache,
          parents: b[0]?.parents,
          children: b[0]?.children,
          operation,
          metric,
          before: {
            n: bv.length,
            median: bm,
            min: Math.min(...bv),
            max: Math.max(...bv),
            samples: bv,
          },
          after: {
            n: av.length,
            median: am,
            min: Math.min(...av),
            max: Math.max(...av),
            samples: av,
          },
          delta: bm !== null && am !== null ? bm - am : null,
          percent: bm > 0 && am !== null ? ((bm - am) / bm) * 100 : null,
          verdict:
            bv.length < 5 || av.length < 5
              ? 'insufficient trials'
              : 'observed median difference; no statistical significance claim',
        });
      }
    }
  }
}
writeFileSync(
  'performance/round4/comparison.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      rows,
      limitations: [
        'localhost results, not production',
        'readyMs is handler/model/save-contract completion proxy, not first visual response',
        'displayMs uses two animation callbacks after verification, not a rendering trace',
        'child-save and parent-save include opening the editor',
        'Initial/repeat refer to storage state; HTTP cache disabled',
        'No INP or real-user-data claim',
        'Host CPU, memory pressure and GC uncontrolled',
      ],
    },
    null,
    2,
  ),
);
const fmt = (value) => (value === null ? 'unmeasured' : value.toFixed(1));
writeFileSync(
  'performance/round4/comparison.md',
  '|Suite / route / storage|Operation|Metric|Before ms|After ms|Delta ms|Change %|n before/after|\n|---|---|---|---:|---:|---:|---:|---|\n' +
    rows
      .map(
        (row) =>
          `|${row.suite} / ${row.route} / ${row.parents}×${row.children} / ${row.cache}|${row.operation}|${row.metric}|${fmt(row.before.median)}|${fmt(row.after.median)}|${fmt(row.delta)}|${fmt(row.percent)}|${row.before.n}/${row.after.n}|`,
      )
      .join('\n') +
    '\n',
);
console.log(`${rows.length} condition/operation/metric rows summarized`);
