import fs from 'node:fs';
async function probe() {
  const paint = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  settings.sound = false;
  settings.celebration = false;
  tasks = normalizeTasks(
    Array.from({ length: 200 }, (_, i) => ({
      id: 'probe-p' + i,
      text: '親' + i,
      subtasks: Array.from({ length: 50 }, (_, j) => ({
        id: 'probe-s' + i + '_' + j,
        text:
          (j === 0 ? '一致' : '除外') +
          ' ' +
          i +
          '-' +
          j +
          ' ' +
          (i === 199 ? '長い文字列'.repeat(15) : '項目'),
      })),
    })),
  );
  resetTaskSearch();
  render();
  navigate('tasks');
  await paint();
  let last = taskList.lastElementChild;
  last
    .querySelector('.subtask-item:last-child')
    .scrollIntoView({ block: 'end' });
  await paint();
  const fullHeight = last.getBoundingClientRect().height;
  window.scrollTo(0, 0);
  await paint();
  taskSearchInput.value = '一致';
  taskSearchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await paint();
  last = taskList.lastElementChild;
  const skippedHeight = last.getBoundingClientRect().height;
  const intrinsic = getComputedStyle(last).containIntrinsicBlockSize;
  last.querySelector('.subtask-item').scrollIntoView({ block: 'end' });
  await paint();
  const renderedHeight = last.getBoundingClientRect().height;
  const result = {
    version: 'round2-intrinsic-probe',
    date: new Date().toISOString(),
    viewport: [innerWidth, innerHeight],
    fullHeight,
    skippedHeight,
    renderedHeight,
    intrinsic,
    children: taskList.querySelectorAll('.subtask-item').length,
    failed: skippedHeight >= fullHeight / 2,
  };
  const out = document.createElement('pre');
  out.id = 'probe-results';
  out.textContent = JSON.stringify(result);
  document.body.prepend(out);
  await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
}
const source = fs
  .readFileSync(process.argv[2] || 'yaruyan-todo.html', 'utf8')
  .replaceAll('yatta-spa', 'perf-intrinsic-' + Date.now());
fs.writeFileSync(
  'performance/round2/intrinsic-probe.html',
  source.replace(
    '      navigate(getRouteFromHash());\n    })();',
    '      navigate(getRouteFromHash());\n await (' +
      probe.toString() +
      ')();\n    })();',
  ),
);
