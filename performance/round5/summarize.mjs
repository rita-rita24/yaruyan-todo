import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const rows = [];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};
const groups = new Map();
for (const file of readdirSync('performance/round5').filter((name) =>
  name.endsWith('-raw.json'),
)) {
  for (const trial of JSON.parse(
    readFileSync('performance/round5/' + file, 'utf8'),
  )) {
    if (trial.error) throw Error(trial.error);
    for (const metric of trial.measured || [])
      for (const field of ['readyMs', 'displayMs']) {
        const key = JSON.stringify([
          trial.version.replace(/^round4-(before|after)-/, ''),
          trial.parents,
          trial.children,
          trial.route,
          trial.cache,
          metric.operation,
          field,
        ]);
        if (!groups.has(key)) groups.set(key, { before: [], after: [] });
        groups
          .get(key)
          [trial.version.startsWith('round4-before') ? 'before' : 'after'].push(
            metric[field],
          );
      }
  }
}
for (const [key, group] of groups) {
  const [series, parents, children, route, cache, operation, metric] =
    JSON.parse(key);
  const stats = (values) =>
    values.length
      ? {
          n: values.length,
          median: median(values),
          min: Math.min(...values),
          max: Math.max(...values),
          samples: values,
        }
      : null;
  const before = stats(group.before),
    after = stats(group.after);
  rows.push({
    series,
    parents,
    children,
    route,
    cache,
    operation,
    metric,
    before,
    after,
    shorterPercent:
      before && after && before.n >= 5 && after.n >= 5 && before.median > 0
        ? ((before.median - after.median) / before.median) * 100
        : null,
  });
}
writeFileSync(
  'performance/round5/comparison.json',
  JSON.stringify(rows, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    rows.filter(
      (row) =>
        ['direct', 'search', 'search-clear', 'parent-save'].includes(
          row.operation,
        ) && row.metric === 'displayMs',
    ),
    null,
    2,
  ),
);
