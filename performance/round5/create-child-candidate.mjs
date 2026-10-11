import { readFileSync, writeFileSync } from 'node:fs';
let source = readFileSync('performance/round5/baseline.html', 'utf8');
const marker = '      function reconcileTaskRows(rows) {';
const helper = `      // One node per cached child; filtered children are detached, never duplicated.
      function reconcileCachedTaskRow(cached, task, visibleSubtasks, key) {
        if (!cached?.childRows || cached.element.contains(document.activeElement)
          || cached.element.classList.contains('dragging') || cached.element.querySelector('.dragging')) return false;
        const previous = JSON.parse(cached.key);
        const next = JSON.parse(key);
        if (previous[1] !== next[1] || previous[0].some((value, index) => value !== next[0][index])) return false;
        const list = cached.element.querySelector('.subtask-list');
        if (!list) return false;
        const rows = visibleSubtasks.map((sub, index) => {
          const childKey = JSON.stringify(next[2][index]);
          const child = cached.childRows.get(sub.id);
          if (child?.key === childKey) return child.element;
          const template = document.createElement('template');
          template.innerHTML = createSubtaskRowMarkup(task.id, sub);
          const element = template.content.firstElementChild;
          hydrateMaterialIcons(element);
          cached.childRows.set(sub.id, { key: childKey, element });
          return element;
        });
        reconcileChildren(list, rows);
        cached.element.style.setProperty('--task-estimated-size', \`\${4 + visibleSubtasks.length * 3.25}rem\`);
        cached.key = key;
        return true;
      }

`;
source = source.replace(marker, helper + marker);
source = source.replace(
  '          if (!shouldRenderTask) return;',
  `          const retained = taskRowCache.get(task.id);
          if (retained?.childRows) {
            const liveIds = new Set(task.subtasks.map(sub => sub.id));
            for (const id of retained.childRows.keys()) {
              if (!liveIds.has(id)) retained.childRows.delete(id);
            }
          }
          if (!shouldRenderTask) {
            if (retained) nextRowCache.set(task.id, retained);
            return;
          }`,
);
source = source.replace(
  '          if (cached?.key === key) {',
  '          if (cached?.key === key || reconcileCachedTaskRow(cached, task, visibleSubtasks, key)) {',
);
source = source.replace(
  '          nextRowCache.set(task.id, { key, element: li });',
  `          const childFields = JSON.parse(key)[2];
          const childRows = new Map([...li.querySelectorAll('.subtask-item')].map((element, index) =>
            [visibleSubtasks[index].id, { key: JSON.stringify(childFields[index]), element }]));
          nextRowCache.set(task.id, { key, element: li, childRows });`,
);
writeFileSync('performance/round5/child-candidate.html', source);
