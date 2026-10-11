import { readFileSync, writeFileSync } from 'node:fs';
import { svgShapeMatches } from '../../tests/helpers/browser-icons.mjs';
async function qa(svgShapeMatches) {
  const checks = [];
  const check = (value, label) => {
    checks.push({ label, pass: !!value });
    if (!value) throw Error(label);
  };
  const paint = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([
      {
        id: 'p0',
        text: '親プロジェクト',
        subtasks: [
          { id: 's0', text: 'ＡＰＩ テスト' },
          { id: 's1', text: '完了済み', done: true },
        ],
      },
      { id: 'p1', text: '単独タスク' },
      { id: 'p2', text: '<script>文字列</script>', done: true },
    ]);
    taskViewState.filter = 'all';
    resetTaskSearch();
    check(await save(), 'isolated fixture commits');
    render();
    navigate('tasks');
    await paint();
    const icons = () =>
      qsa('.material-symbols-outlined').every((el) =>
        svgShapeMatches(el.firstElementChild, el.dataset.icon),
      );
    check(
      icons(),
      'all static and new dynamic icons have their expected SVG symbol',
    );
    const first = taskList.firstElementChild;
    const firstIcon = first.querySelector('svg');
    render();
    check(
      taskList.firstElementChild === first &&
        first.querySelector('svg') === firstIcon,
      'unchanged task and SVG identity retained',
    );
    const a = _createMaterialIconSvg('play_circle'),
      b = _createMaterialIconSvg('play_circle');
    check(
      a !== b && a.firstElementChild !== b.firstElementChild,
      'each icon owns independent SVG nodes',
    );
    a.firstElementChild.setAttribute('href', '#modified');
    check(
      svgShapeMatches(_createMaterialIconSvg('play_circle'), 'play_circle'),
      'mutating one icon does not corrupt cached templates',
    );
    taskSearchInput.value = 'api';
    taskSearchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    check(
      taskList.children.length === 1 &&
        qsa('.subtask-item', taskList).length === 1,
      'NFKC search retains exact matching child and parent',
    );
    check(
      clearAllBtn.disabled && clearCompletedBtn.disabled,
      'bulk delete remains blocked during search',
    );
    await setTaskFilter('completed');
    check(
      taskList.children.length === 0,
      'search and completion filter intersect',
    );
    resetTaskSearch();
    await setTaskFilter('all');
    check(
      taskList.children.length === 3 &&
        qsa('.subtask-item', taskList).length === 2,
      'search reset restores all data',
    );
    check(
      taskList.textContent.includes('<script>文字列</script>') &&
        !taskList.querySelector('script'),
      'task text remains escaped',
    );
    openParentModal('p0');
    check(
      parentEditInput.value === '親プロジェクト' &&
        modalSubtaskList.children.length === 2,
      'parent editor includes full child list',
    );
    check(icons(), 'parent editor icons correct');
    closeParentModal({ force: true });
    openSubtaskModal('p0', 's0');
    check(
      subtaskEditInput.value === 'ＡＰＩ テスト',
      'child editor has correct target',
    );
    closeSubtaskModal({ force: true });
    const beforeFailedFocus = _createAppStateSnapshot(),
      realSave = save;
    save = async () => false;
    try {
      await openFocusModal('subtask', 'p0', 's0');
    } finally {
      save = realSave;
    }
    await paint();
    check(
      !isStateSaveOperationPending() &&
        !isFocusOperationPending() &&
        !focusOverlay.classList.contains('show') &&
        getSubtask('p0', 's0').focus.focusState === 'idle',
      'failed focus save restores state and releases all operation locks',
    );
    check(
      JSON.stringify(tasks) === JSON.stringify(beforeFailedFocus.tasks),
      'failed focus save preserves exact task data',
    );
    await openFocusModal('subtask', 'p0', 's0');
    check(
      focusOverlay.classList.contains('show') && focusState.subtaskId === 's0',
      'focus starts on selected child',
    );
    await paint();
    check(
      document.activeElement === focusPauseBtn &&
        !isStateSaveOperationPending() &&
        !isFocusOperationPending(),
      'focus transition releases locks and places keyboard focus on pause',
    );
    await pauseOrResumeFocus();
    check(
      focusOverlay.classList.contains('show') &&
        getSubtask('p0', 's0').focus.focusState === 'paused',
      'pause keeps the same focus overlay',
    );
    await completeFocus();
    check(
      getSubtask('p0', 's0').done && !focusOverlay.classList.contains('show'),
      'completion saves and closes focus',
    );
    check(icons(), 'icons stay correct after focus updates');
    taskInput.value = '更新確認';
    await addTask();
    check(
      tasks.length === 4 && taskList.textContent.includes('更新確認'),
      'new task is saved and immediately displayed',
    );
    const backup = createBackupPayload();
    check(backup.data.tasks.length === 4, 'backup preserves full task count');
    check(
      await importBackupFile(
        new File([JSON.stringify(backup)], 'qa.json', {
          type: 'application/json',
        }),
      ),
      'backup file opens confirmation',
    );
    closeConfirmModal();
    check(
      await performImportBackup(normalizeBackupPayload(backup)),
      'backup import commits',
    );
    check(
      tasks.length === 4 && taskList.children.length === 4,
      'import restores exact task count',
    );
    check(icons(), 'icons stay correct after import');
    tasks = [];
    render();
    check(
      emptyState.hidden === false && taskList.children.length === 0,
      'empty data remains usable',
    );
    tasks = normalizeTasks(backup.data.tasks);
    render();
    navigate('settings');
    await paint();
    tasks[0].text = '非表示中の更新';
    check(await save(), 'hidden-page update commits');
    render();
    navigate('tasks');
    await paint();
    check(
      taskList.textContent.includes('非表示中の更新') &&
        taskList.children.length === 4,
      'returning to tasks shows the latest committed hidden-page update',
    );
    navigate('settings');
    await paint();
    check(
      await performImportBackup(normalizeBackupPayload(backup)),
      'hidden-page import commits',
    );
    navigate('tasks');
    await paint();
    check(
      taskList.textContent.includes('親プロジェクト') &&
        !taskList.textContent.includes('非表示中の更新') &&
        taskList.children.length === 4,
      'returning after hidden-page import shows exact restored content',
    );
    const smallBackup = createBackupPayload();
    tasks = normalizeTasks(
      Array.from({ length: 200 }, (_, i) => ({
        id: 'large-p' + i,
        text:
          '親' +
          i +
          ' ' +
          (i === 0 || i === 199 ? '長い文字列'.repeat(12) : 'データ'),
        subtasks: Array.from({ length: 50 }, (_, j) => ({
          id: 'large-s' + i + '_' + j,
          text:
            '子' +
            i +
            '-' +
            j +
            ' ' +
            (i === 0 || i === 199 ? '長い文字列'.repeat(12) : 'データ'),
        })),
      })),
    );
    resetTaskSearch();
    render();
    await paint();
    check(
      taskList.children.length === 200 &&
        qsa('.subtask-item', taskList).length === 10000,
      'all maximum-size task DOM remains available',
    );
    const last = taskList.lastElementChild,
      lastChild = last.querySelector('.subtask-item:last-child');
    lastChild.scrollIntoView({ block: 'end' });
    await paint();
    const lastRect = lastChild.getBoundingClientRect();
    check(
      lastRect.height > 0 &&
        lastRect.bottom <= innerHeight + 2 &&
        lastChild.textContent.includes('子199-49'),
      'last offscreen row is fully rendered after scrolling',
    );
    const edit = last.querySelector('.edit-parent-btn');
    edit.focus();
    await paint();
    const editRect = edit.getBoundingClientRect();
    check(
      document.activeElement === edit &&
        editRect.top >= 0 &&
        editRect.bottom <= innerHeight,
      'offscreen parent control remains keyboard-focusable and visible',
    );
    edit.click();
    await paint();
    check(
      parentEditInput.value === tasks[199].text &&
        modalSubtaskList.children.length === 50,
      'offscreen parent edit keeps exact target and children',
    );
    closeParentModal({ force: true });
    await paint();
    const childEdit = lastChild.querySelector('.edit-subtask-btn');
    childEdit.scrollIntoView({ block: 'center' });
    await paint();
    childEdit.click();
    await paint();
    check(
      subtaskEditInput.value === tasks[199].subtasks[49].text,
      'offscreen child edit keeps exact target',
    );
    closeSubtaskModal({ force: true });
    await paint();
    const handle = last.querySelector('.parent-drag-handle');
    handle.focus();
    await paint();
    await _moveFocusedTaskRowByOffset(-1);
    await paint();
    check(
      tasks[198].id === 'large-p199' &&
        taskList.children[198].dataset.id === 'large-p199' &&
        document.activeElement.closest('.task-item')?.dataset.id ===
          'large-p199',
      'offscreen keyboard reorder saves exact order and retains focus',
    );
    const transfer = new DataTransfer(),
      sourceHandle = last.querySelector('.parent-drag-handle');
    sourceHandle.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }),
    );
    const targetRow = taskList.children[197];
    targetRow.scrollIntoView({ block: 'start' });
    await paint();
    let targetRect = targetRow.getBoundingClientRect();
    const dropPoint = {
      bubbles: true,
      dataTransfer: transfer,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + 1,
    };
    targetRow.dispatchEvent(new DragEvent('dragover', dropPoint));
    await paint();
    check(
      taskList.querySelector('.drag-insertion-slot')?.getBoundingClientRect()
        .height > 0 && dragState.intentTargetId === 'large-p197',
      'parent drag insertion indicator remains visible and targets the correct row',
    );
    targetRow.dispatchEvent(new DragEvent('drop', dropPoint));
    while (isStateSaveOperationPending()) await paint();
    await paint();
    check(
      tasks[197].id === 'large-p199' &&
        taskList.children[197].dataset.id === 'large-p199' &&
        !dragState.type,
      'offscreen parent drag saves exact order',
    );
    const parentRow = taskList.children[197],
      childSource = parentRow.querySelector(
        '[data-sub-id="large-s199_49"].subtask-drag-handle',
      ),
      childTarget = parentRow.querySelector(
        '.subtask-item[data-sub-id="large-s199_48"]',
      );
    childSource.scrollIntoView({ block: 'center' });
    await paint();
    childSource.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }),
    );
    targetRect = childTarget.getBoundingClientRect();
    const childPoint = {
      bubbles: true,
      dataTransfer: transfer,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + 1,
    };
    childTarget.dispatchEvent(new DragEvent('dragover', childPoint));
    childTarget.dispatchEvent(new DragEvent('drop', childPoint));
    while (isStateSaveOperationPending()) await paint();
    await paint();
    check(
      tasks[197].subtasks[48].id === 'large-s199_49' &&
        taskList.children[197].querySelectorAll('.subtask-item')[48].dataset
          .subId === 'large-s199_49' &&
        !dragState.type,
      'offscreen child drag saves exact order',
    );
    tasks = normalizeTasks(smallBackup.data.tasks);
    render();
    window.scrollTo(0, 0);
    await paint();
  } catch (error) {
    checks.push({ label: error.stack, pass: false });
  }
  const out = document.createElement('pre');
  out.id = 'functional-results';
  out.textContent = JSON.stringify(
    { checks, failed: checks.filter((c) => !c.pass).length },
    null,
    2,
  );
  document.body.prepend(out);
  document.title = checks.every((c) => c.pass)
    ? 'PASS functional QA'
    : 'FAIL functional QA';
  if (location.protocol === 'http:')
    await fetch('/result', {
      method: 'POST',
      body: JSON.stringify({
        version: 'round2-adopted-functional',
        date: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: [innerWidth, innerHeight],
        checks,
        failed: checks.filter((c) => !c.pass).length,
      }),
    });
}
const marker = '      navigate(getRouteFromHash());\n    })();';
const html = readFileSync(
  process.argv[2] || 'yaruyan-todo.html',
  'utf8',
).replaceAll('yatta-spa', 'perf-functional-' + Date.now());
writeFileSync(
  process.argv[3] || 'performance/functional-qa.html',
  html.replace(
    marker,
    '      navigate(getRouteFromHash());\nawait (' +
      qa.toString().replaceAll('</script>', '<\\/script>') +
      ')(' +
      svgShapeMatches.toString() +
      ');\n    })();',
  ),
);
