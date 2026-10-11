import fs from 'node:fs';
for (const [base, extra] of [
  ['baseline-fresh-backup', 'baseline-backup-extra20'],
  ['optimized-final-backup', 'optimized-backup-extra20'],
]) {
  const read = (name) =>
    JSON.parse(fs.readFileSync(`performance/browser-${name}-raw.json`, 'utf8'));
  const rows = [...read(base), ...read(extra)];
  if (rows.some((row) => row.error))
    throw Error('Invalid runs must be inspected before merge');
  fs.writeFileSync(
    `performance/browser-${base}-combined-raw.json`,
    JSON.stringify(rows, null, 2) + '\n',
  );
}
