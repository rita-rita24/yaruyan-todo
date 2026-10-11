// Disposable native-browser regression checks. Storage keys and DB are isolated.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function seedUsabilityPreview() {
  settings.sound = false;
  settings.celebration = false;
  tasks = normalizeTasks([
    {
      id: 'project',
      text: 'サイトを公開する',
      subtasks: [
        { id: 'test', text: 'スマートフォンで動作を確認する' },
        { id: 'design', text: '画面デザインを仕上げる', done: true },
      ],
    },
    { id: 'mail', text: '問い合わせのメールを返す' },
    { id: 'docs', text: '使い方の説明を更新する' },
  ]);
  taskViewState.filter = 'all';
  render();
}

async function usabilityQa() {
  const lines = [];
  const check = (condition, label) => {
    lines.push(`${condition ? 'PASS' : 'FAIL'} ${label}`);
    if (!condition) throw new Error(label);
  };
  const frame = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  const settle = async () => {
    await _storedStateSaveQueue;
    await _indexedDbWriteQueue;
    await frame();
  };
  try {
    navigate('tasks');
    await frame();
    check(await save(), 'fixture saved to isolated storage');
    check(
      qsa('.subtask-wrap', taskList).every((wrap) => !wrap.hidden) &&
        qsa('.subtask-item', taskList).every(
          (row) => row.getClientRects().length > 0,
        ),
      'children are visible by default without expanding their parent',
    );
    check(
      !qs('.toggle-subtasks-btn', taskList),
      'child collapse and expand controls are removed',
    );
    check(
      !qs('.task-group-hint', taskList),
      'parent rows have no child-start explanation',
    );
    check(
      !qs('.task-focus-wrap', qs('.task-item[data-id="project"]')),
      'group parent does not reserve space for an absent start control',
    );
    check(
      getComputedStyle(qs('.open-focus-subtask-btn > span:last-child'))
        .display === 'none' &&
        qs('.open-focus-subtask-btn').getAttribute('aria-label') === '開始',
      'start is icon-only and retains its accessible name',
    );
    check(
      getComputedStyle(qs('.undo-subtask-btn > span:last-child')).display ===
        'none' &&
        qs('.undo-subtask-btn').getAttribute('aria-label') === '完了を取り消す',
      'undo is icon-only and retains its accessible name',
    );
    check(
      !qs('.add-child-btn', taskList),
      'child addition is removed from the list',
    );
    check(
      getComputedStyle(qs('#saveParentEditBtn > span:last-child')).display !==
        'none',
      'save has a visible text label',
    );
    taskInput.value = 'あ'.repeat(120) + '残すべき末尾';
    taskInput.dispatchEvent(new Event('input'));
    check(
      taskInput.maxLength === -1,
      'draft input does not silently truncate a paste',
    );
    await addTask();
    check(
      tasks.length === 3 &&
        taskInput.value.endsWith('残すべき末尾') &&
        taskInput.getAttribute('aria-invalid') === 'true',
      'over-limit addition keeps the full draft and blocks saving',
    );
    taskInput.value = '';
    taskInput.dispatchEvent(new Event('input'));

    bulkActions.open = true;
    bulkActionsSummary.focus();
    bulkActionsSummary.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    check(
      !bulkActions.open && document.activeElement === bulkActionsSummary,
      'Escape dismisses the bulk menu and keeps its summary focused',
    );
    bulkActions.open = true;
    taskInput.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 8, bubbles: true }),
    );
    taskInput.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 8, bubbles: true }),
    );
    check(!bulkActions.open, 'outside pointer interaction dismisses the menu');
    bulkActions.open = true;
    clearAllBtn.focus();
    taskSearchInput.focus();
    check(
      !bulkActions.open && document.activeElement === taskSearchInput,
      'tabbing out closes the menu without stealing focus',
    );
    bulkActions.open = true;
    clearAllBtn.focus();
    clearAllBtn.click();
    await frame();
    check(
      !bulkActions.open &&
        confirmModalOverlay.classList.contains('show') &&
        appShell.inert,
      'bulk action opens its confirmation with the menu closed and the shell inert',
    );
    closeConfirmModal();
    await frame();
    check(
      document.activeElement === bulkActionsSummary && !appShell.inert,
      'cancel returns to the visible bulk-menu summary',
    );

    openParentModal('project');
    await frame();
    check(
      appShell.inert &&
        !parentModalOverlay.inert &&
        parentModalOverlay.contains(document.activeElement),
      'parent editor isolates the shell and receives focus',
    );
    taskInput.focus();
    check(
      parentModalOverlay.contains(document.activeElement),
      'programmatic background focus cannot escape the dialog',
    );
    parentEditInput.value = '未保存の親名';
    await moveEditorTask('parent', 1);
    await settle();
    check(
      tasks.map((p) => p.id).join(',') === 'mail,project,docs' &&
        parentEditInput.value === '未保存の親名' &&
        getTask('project').text === 'サイトを公開する',
      'pointer reorder saves order and preserves the unsaved name',
    );
    openSubtaskModal('project', 'test');
    await frame();
    check(
      appShell.inert && parentModalOverlay.inert && !subtaskModalOverlay.inert,
      'nested editor isolates the parent dialog',
    );
    subtaskEditInput.value = '未保存の子名';
    await moveEditorTask('subtask', 1);
    await settle();
    check(
      getTask('project')
        .subtasks.map((c) => c.id)
        .join(',') === 'design,test' &&
        subtaskEditInput.value === '未保存の子名',
      'child reorder preserves its draft and moves to the last position',
    );
    check(
      qs('[data-reorder-kind="subtask"][data-reorder-offset="1"]').disabled,
      'last-position move is disabled',
    );
    const realSave = _saveStoredState;
    try {
      _saveStoredState = async () => false;
      check(
        (await moveEditorTask('subtask', -1)) === false,
        'failed movement reports failure',
      );
      await settle();
      check(
        getTask('project')
          .subtasks.map((c) => c.id)
          .join(',') === 'design,test' &&
          subtaskEditInput.value === '未保存の子名' &&
          parentModalOverlay.inert &&
          !subtaskModalOverlay.inert,
        'save failure restores order and keeps nested isolation and draft',
      );
    } finally {
      _saveStoredState = realSave;
    }
    closeSubtaskModal({ force: true });
    await frame();
    check(
      appShell.inert &&
        !parentModalOverlay.inert &&
        parentModalOverlay.contains(document.activeElement),
      'closing a nested editor restores the parent dialog',
    );
    closeParentModal({ force: true });
    await frame();
    check(!appShell.inert, 'closing the last dialog restores the shell');
    check(
      !qs('#openHelpBtn') && !qs('#helpModalOverlay'),
      'help button and dialog are removed',
    );
    const helpKey = new KeyboardEvent('keydown', {
      key: '?',
      code: 'Slash',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(helpKey);
    check(
      !helpKey.defaultPrevented && !_getActiveModalOverlay() && !appShell.inert,
      'question-mark key no longer opens a help dialog or locks the app',
    );
    navigate('memo');
    await frame();
    check(
      document.activeElement === qs('#page-memo h1'),
      'navigation focuses the destination heading',
    );
    organizeMemoInput.focus();
    render();
    check(
      document.activeElement === organizeMemoInput,
      'ordinary renders preserve input focus',
    );
    qs('#skipToContent').focus();
    await settle();
    qs('#skipToContent').click();
    check(
      document.activeElement === qs('#mainContent') &&
        getRouteFromHash() === 'memo',
      'skip link focuses content without changing the route',
    );
    navigate('tasks');
    await frame();
    await openFocusModal('parent', 'mail');
    await settle();
    check(
      appShell.inert && !focusOverlay.inert,
      'focus timer also isolates the shell',
    );
    check(!qs('#focusReturnBtn'), 'focus has no return-to-list control');
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    focusPauseBtn.dispatchEvent(escape);
    check(
      escape.defaultPrevented &&
        focusOverlay.classList.contains('show') &&
        getTask('mail').focus.focusState === 'running' &&
        appShell.inert,
      'Escape keeps the focus session running and the list unavailable',
    );
    await pauseOrResumeFocus();
    await settle();
    check(
      focusOverlay.classList.contains('show') &&
        appShell.inert &&
        getTask('mail').focus.focusState === 'paused',
      'pausing keeps the focus screen active',
    );
    await openFocusModal('parent', 'docs');
    check(
      focusState.parentId === 'mail',
      'another task cannot replace the paused active task',
    );
    abortFocus();
    await frame();
    check(
      confirmModalOverlay.classList.contains('show'),
      'abort still asks for confirmation',
    );
    closeConfirmModal();
    await frame();
    check(
      focusOverlay.classList.contains('show') && appShell.inert,
      'canceling abort returns to the same focus screen',
    );
    await completeFocus();
    await settle();
    check(
      !appShell.inert &&
        getTask('mail').done &&
        !focusOverlay.classList.contains('show'),
      'completion saves the task and releases isolation',
    );
    await openFocusModal('parent', 'docs');
    await settle();
    abortFocus();
    await executeConfirmedAction();
    await settle();
    check(
      !focusOverlay.classList.contains('show') &&
        !appShell.inert &&
        !getTask('docs').done &&
        getTask('docs').focus.focusState === 'idle' &&
        getTask('docs').focus.elapsedMs === 0 &&
        getTask('docs').focus.startedAt === null,
      'confirmed abort still resets work time and releases focus without completing the task',
    );
  } catch (error) {
    lines.push(`ERROR ${error.stack}`);
  }
  const failures = lines.filter((line) => /^(FAIL|ERROR)/.test(line)).length;
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent =
    lines.join('\n') +
    `\n${lines.filter((line) => line.startsWith('PASS')).length} PASSED / ${failures} FAILED`;
  document.body.replaceChildren(output);
  document.title = failures
    ? 'FAIL: usability followup QA'
    : 'PASS: usability followup QA';
}
const directory = mkdtempSync(join(tmpdir(), 'yaruyan-usability-followup-qa-'));
const original = readFileSync(
  new URL('../yaruyan-todo.html', import.meta.url),
  'utf8',
);
const namespace = `usability-qa-${randomUUID()}`;
const isolated = original.replaceAll('yatta-spa-', `${namespace}-`);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker))
  throw new Error('Initialization marker missing');
for (const [name, code] of [
  ['index.html', `(${seedUsabilityPreview})(); await (${usabilityQa})();`],
  ['app.html', `(${seedUsabilityPreview})();`],
]) {
  writeFileSync(
    join(directory, name),
    isolated
      .replaceAll(namespace, `${namespace}-${name}`)
      .replace(
        marker,
        `      navigate(getRouteFromHash());\n${code}\n    })();`,
      ),
  );
}
console.log(directory);
