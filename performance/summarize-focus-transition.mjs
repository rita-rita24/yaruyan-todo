import fs from 'node:fs';
const before = JSON.parse(
  fs.readFileSync('performance/browser-lazy-focus-comparison-raw.json', 'utf8'),
);
const after = JSON.parse(
  fs.readFileSync(
    'performance/browser-focus-transition-candidate-raw.json',
    'utf8',
  ),
);
const quantile = (xs, p) => {
  const a = [...xs].sort((a, b) => a - b),
    i = (a.length - 1) * p;
  return a[Math.floor(i)] + (a[Math.ceil(i)] - a[Math.floor(i)]) * (i % 1);
};
const median = (xs) => quantile(xs, 0.5);
const describe = (xs) => ({
  n: xs.length,
  medianMs: median(xs),
  minMs: Math.min(...xs),
  maxMs: Math.max(...xs),
  q1Ms: quantile(xs, 0.25),
  q3Ms: quantile(xs, 0.75),
  rawMs: xs,
});
let randomState = 42;
const random = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
};
function interval(a, b) {
  const deltas = [];
  for (let i = 0; i < 5000; i++) {
    const sample = (x) =>
      Array.from(
        { length: x.length },
        () => x[Math.floor(random() * x.length)],
      );
    deltas.push(median(sample(a)) - median(sample(b)));
  }
  return [quantile(deltas, 0.025), quantile(deltas, 0.975)];
}
const group = (r) => `${r.parents}x${r.children}|${r.route}|${r.cache}`;
const rows = [];
for (const key of new Set(before.filter((r) => !r.error).map(group))) {
  const a = before.filter((r) => !r.error && group(r) === key),
    b = after.filter((r) => !r.error && group(r) === key);
  if (!b.length) continue;
  for (const operation of a[0].measured.map((x) => x.operation)) {
    const av = a
        .map(
          (r) => r.measured.find((x) => x.operation === operation)?.displayMs,
        )
        .filter((x) => Number.isFinite(x)),
      bv = b
        .map(
          (r) => r.measured.find((x) => x.operation === operation)?.displayMs,
        )
        .filter((x) => Number.isFinite(x));
    if (!av.length || !bv.length) continue;
    const ci = interval(av, bv),
      reductionPercent = ((median(av) - median(bv)) / median(av)) * 100;
    for (const metric of [
      'search',
      'search-clear',
      'backup-read-confirm',
      'backup-confirm-import',
      'filter-completed',
      'filter-all',
    ].includes(operation)
      ? ['主要内容の表示', '操作可能', '必要な結果']
      : ['主要内容の表示', '操作可能'])
      rows.push({
        condition: key,
        operation,
        metric,
        before: describe(av),
        after: describe(bv),
        reductionPercent,
        medianDifference95CI: ci,
        judgement:
          av.length < 5 || bv.length < 5
            ? '測定回数不足'
            : ci[0] > 0
              ? '改善'
              : ci[1] < 0
                ? '悪化'
                : '改善未確認',
      });
  }
}
const result = {
  scope: 'ローカルHTTP・本番比較ではない',
  date: new Date().toISOString(),
  metricDefinition:
    'displayMs=結果のDOM/件数/状態を検証した後の二重requestAnimationFrame完了。操作可能も表示後に主操作の準備が整った同じ完了点を採用。raw readyMsは描画前のJS処理完了であり利用者の操作可能時間として報告しない。',
  cacheDefinition:
    'HTTPは全件Cache-Control:no-store。initialは新規名前空間・localStorage fixture・空IndexedDB、repeatは同名前空間で保存済みlocalStorage/IndexedDB。HTTP cold/warm、CDN、本番負荷は未計測。',
  warnings: [
    'iframe1280x900、同じCodex IAB Chrome155/Mac上。実機スマホ未計測。',
    'fixture生成・保存準備時間(seedMs)も直接表示の生値に含む。各条件で前後同じ方法。',
    'repeatには前回試行の集中実績(一時停止状態)が含まれる。件数・名称・順序は同じで、initialと分離。',
    '中央値差の95%bootstrap区間は標本5回の探索的判断。小差・区間が0を含むものは改善未確認。',
    '外部CPU負荷やGCは完全制御できない。全画面の改善率の単純平均はしない。',
  ],
  beforeRuns: before.length,
  afterRuns: after.length,
  errors: {
    before: before.filter((x) => x.error),
    after: after.filter((x) => x.error),
  },
  rows,
};
fs.writeFileSync(
  'performance/focus-transition-results.json',
  JSON.stringify(result, null, 2) + '\n',
);
const lines = [
  'ローカル計測結果（本番比較ではない）',
  result.metricDefinition,
  result.cacheDefinition,
  ...result.warnings,
  '',
  '条件（親x子/直接アクセス先/保存状態） | 操作 | 指標 | 前中央値ms | 後中央値ms | 短縮率% | 前/後回数 | 判定 | 前min-max | 後min-max',
  ...rows.map(
    (r) =>
      `${r.condition} | ${r.operation} | ${r.metric} | ${r.before.medianMs.toFixed(1)} | ${r.after.medianMs.toFixed(1)} | ${r.reductionPercent.toFixed(1)} | ${r.before.n}/${r.after.n} | ${r.judgement} | ${r.before.minMs.toFixed(1)}-${r.before.maxMs.toFixed(1)} | ${r.after.minMs.toFixed(1)}-${r.after.maxMs.toFixed(1)}`,
  ),
];
fs.writeFileSync(
  'performance/focus-transition-results.txt',
  lines.join('\n') + '\n',
);
console.log(
  JSON.stringify(
    rows.filter(
      (r) =>
        r.metric === '主要内容の表示' &&
        r.condition.startsWith('200x50|tasks|initial'),
    ),
    null,
    2,
  ),
);
