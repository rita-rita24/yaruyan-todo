import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const expected = {
  before: sha('performance/round5/baseline.html'),
  after: sha('performance/round5/child-v4-candidate.html'),
};
const rows = [];
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: values.length,
    median: sorted[2],
    min: sorted[0],
    max: sorted.at(-1),
    samples: values,
  };
};
for (const [operation, value, count] of [
  ['search', 'a', '5000件'],
  ['search-clear', '', '10000件'],
])
  for (const field of [
    'eventToNextPaintMs',
    'eventInputDelayMs',
    'eventToDomReadyMs',
  ]) {
    const sides = {};
    for (const side of ['before', 'after']) {
      const samples = [];
      for (let trial = 0; trial < 5; trial++) {
        const record = JSON.parse(
          readFileSync(
            `performance/round5/native-${side}-${trial}.json`,
            'utf8',
          ),
        );
        assert.equal(record.sourceSha256, expected[side]);
        assert.equal(record.fixturePreparationRevision, 2);
        assert.ok(!record.seedError);
        assert.equal(record.inputs.length, 2);
        const input = record.inputs.find((input) => input.value === value);
        assert.ok(input.isTrusted);
        assert.ok(input.status.startsWith(count));
        const entry = record.events.find(
          (entry) =>
            entry.name === 'input' &&
            Math.abs(entry.startTime - input.startTime) < 1,
        );
        assert.ok(
          entry,
          'Browser event timing entry must exist; absent/under-threshold entries are not zero',
        );
        samples.push(
          field === 'eventToNextPaintMs'
            ? entry.duration
            : field === 'eventInputDelayMs'
              ? entry.inputDelayMs
              : input.domReadyMs,
        );
      }
      sides[side] = stats(samples);
    }
    rows.push({
      operation,
      field,
      ...sides,
      shorterMs: sides.before.median - sides.after.median,
      shorterPercent:
        field === 'eventInputDelayMs'
          ? null
          : ((sides.before.median - sides.after.median) / sides.before.median) *
            100,
    });
  }
writeFileSync(
  'performance/round5/native-comparison.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      condition:
        'Chrome154 native key events; parent200 x child50; iframe1280x900; fresh namespace; a key then BackSpace after reading search state; alternating source order',
      trials: 10,
      inputs: 20,
      entryThresholdMs: 16,
      durationGranularityMs: 8,
      caveats: [
        'Local controlled native automation, not production RUM or INP',
        'EventTiming estimates next paint; not first pixel of every item',
        'Only discrete search input and clearing; not continuous drag/scroll FPS',
        'Preparation-v1, calibration and quota-failed records excluded',
        'Host CPU/GC/background workload and display refresh not controlled',
        'Input timestamps and values verified; absent entries never treated as zero',
      ],
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(rows, null, 2));
