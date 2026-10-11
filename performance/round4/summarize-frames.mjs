import { readFileSync, writeFileSync } from 'node:fs';
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.floor(sorted.length / 2)]) /
        2
    : null;
};
const rows = [];
for (const side of ['before', 'after']) {
  const records = JSON.parse(
    readFileSync(
      `performance/round4/browser-round4-${side}-paths-profile-frames-raw.json`,
      'utf8',
    ),
  );
  for (const cache of ['initial', 'repeat']) {
    const trials = records.filter((record) => record.cache === cache);
    const values = trials.map((record) => ({
      group: record.group,
      count: record.frames.length,
      maxDuration: record.frames.length
        ? Math.max(...record.frames.map((frame) => frame.duration))
        : null,
      totalBlocking: record.frames.length
        ? record.frames.reduce((sum, frame) => sum + frame.blockingDuration, 0)
        : null,
      renderToPaint: record.frames
        .filter(
          (frame) =>
            frame.renderStart > 0 && frame.paintTime >= frame.renderStart,
        )
        .map((frame) => frame.paintTime - frame.renderStart),
    }));
    rows.push({
      side,
      cache,
      trials: trials.length,
      sourceSha256: [...new Set(trials.map((record) => record.sourceSha256))],
      observedTrials: values.filter((value) => value.count > 0).length,
      observedFrameCount: values.reduce((sum, value) => sum + value.count, 0),
      medianObservedMaxDuration: median(
        values.map((value) => value.maxDuration),
      ),
      medianObservedTotalBlocking: median(
        values.map((value) => value.totalBlocking),
      ),
      samples: values,
    });
  }
}
writeFileSync(
  'performance/round4/frame-summary.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      rows,
      limitations: [
        'Top-level PerformanceObserver; whole navigation trial, not a continuous input trace',
        'Only reported frames longer than 50ms; missing entries are not proof of no blocking',
        'Zero-entry trials are excluded from duration medians, and their counts are explicit',
        'Only Chrome154 diagnostics; draft API is not adopted into the shipped app',
        'No FPS, first user response, or production improvement claim',
      ],
    },
    null,
    2,
  ),
);
console.log(rows.map(({ samples, ...row }) => row));
