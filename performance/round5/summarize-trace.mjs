import { readFileSync, writeFileSync } from 'node:fs';
const result = [];
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[(s.length - 1) / 2];
};
for (const cache of ['initial', 'repeat'])
  for (const field of [
    'renderTasks',
    'commitStateSave',
    'renderParentModalSubtasks',
  ])
    for (const operation of [
      'search',
      'search-clear',
      'child-save',
      'parent-save',
    ]) {
      const values = {};
      for (const side of ['before', 'after']) {
        const trials = JSON.parse(
          readFileSync(
            `performance/round5/browser-round4-${side}-trace-child-v4-raw.json`,
            'utf8',
          ),
        ).filter((trial) => trial.cache === cache);
        const samples = trials.map((trial) =>
          (trial.profile[field] || [])
            .filter((entry) => entry.operation === operation)
            .reduce((sum, entry) => sum + entry.durationMs, 0),
        );
        const calls = trials.map(
          (trial) =>
            (trial.profile[field] || []).filter(
              (entry) => entry.operation === operation,
            ).length,
        );
        values[side] = {
          callsPerTrial: calls,
          observedTrials: calls.filter((count) => count > 0).length,
          n: samples.length,
          median: median(samples),
          min: Math.min(...samples),
          max: Math.max(...samples),
          samples,
        };
      }
      result.push({ cache, field, operation, ...values });
    }
writeFileSync(
  'performance/round5/trace-summary.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    result.filter((row) => row.operation === 'parent-save'),
    null,
    2,
  ),
);
