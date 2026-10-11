import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
const fixture = Array.from({ length: 200 }, (_, i) => ({
  id: `p${i}`,
  text: `親タスク ${i} プロジェクト`,
  done: false,
  subtasks: Array.from({ length: 50 }, (_, j) => ({
    id: `s${i}_${j}`,
    text: `子タスク ${j} ${j % 2 ? '資料' : 'ＡＰＩ'}検証`,
    done: j % 3 === 1,
  })),
}));
function setup(version, sourceSha256, data, prefix) {
  const out = document.createElement('output');
  out.id = 'native-results';
  out.hidden = true;
  document.addEventListener(
    'DOMContentLoaded',
    () => document.body.append(out),
    { once: true },
  );
  const records = {
    version,
    sourceSha256,
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: [innerWidth, innerHeight],
    devicePixelRatio,
    observerSupported:
      PerformanceObserver.supportedEntryTypes.includes('event'),
    fixturePreparationRevision: 2,
    entryThresholdMs: 16,
    durationGranularityMs: 8,
    events: [],
    inputs: [],
  };
  const publish = () => {
    out.textContent = JSON.stringify(records);
  };
  if (records.observerSupported) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.target?.id === 'taskSearchInput')
          records.events.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
            processingStart: entry.processingStart,
            processingEnd: entry.processingEnd,
            interactionId: entry.interactionId,
            inputDelayMs: entry.processingStart - entry.startTime,
          });
      publish();
    });
    observer.observe({ type: 'event', durationThreshold: 16 });
  }
  document.addEventListener('input', (event) => {
    if (event.target.id !== 'taskSearchInput') return;
    records.inputs.push({
      isTrusted: event.isTrusted,
      value: event.target.value,
      startTime: event.timeStamp,
      domReadyMs: performance.now() - event.timeStamp,
      status: document.getElementById('taskViewStatus').textContent,
    });
    publish();
  });
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('perf-native-')) localStorage.removeItem(key);
    }
    localStorage.setItem(prefix + '-tasks-v8', JSON.stringify(data));
    localStorage.setItem(
      prefix + '-settings-v8',
      JSON.stringify({ sound: false, celebration: false }),
    );
    localStorage.setItem(
      prefix + '-task-view-v1',
      JSON.stringify({ filter: 'all' }),
    );
    localStorage.setItem(prefix + '-organize-memo-v1', '性能検証用メモ');
    localStorage.setItem(prefix + '-sidebar-collapsed-v3', 'false');
  } catch (error) {
    records.seedError = error.name + ': ' + error.message;
    publish();
    throw error;
  }
  publish();
  return prefix;
}
export function createNativePage(version) {
  if (!['before', 'after'].includes(version))
    throw Error('Unknown native comparison version');
  const path =
    version === 'before'
      ? 'performance/round5/baseline.html'
      : 'performance/round5/child-v4-candidate.html';
  const source = readFileSync(path, 'utf8');
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  const prefix = 'perf-native-' + version + '-' + randomUUID();
  const pre = `<script>(${setup.toString().replaceAll('</script>', '<\\/script>')})(${JSON.stringify(version)},${JSON.stringify(sourceSha256)},${JSON.stringify(fixture)},${JSON.stringify(prefix)});</script>`;
  return source
    .replaceAll('yatta-spa', prefix)
    .replace('<script>', pre + '<script>');
}
