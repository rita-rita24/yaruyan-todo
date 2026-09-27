// ブラウザ統合テストは、保存キーを分離したコピーで実行する。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function tenPassQa() {
  const lines = [];
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => { await _storedStateSaveQueue; await _indexedDbWriteQueue; await frame(); };
  const key = (element, options = {}) => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([{ id: 'p', text: '親テスト', subtasks: [
      { id: 's', text: '子テスト', focus: { elapsedMs: 700 } }
    ] }]);
    taskViewState.filter = 'all';
    await save();
    navigate('tasks');
    await frame();
    render();
    const undo = _createSubtaskDeleteUndoPayload('p', 's');
    await performDeleteSubtask('p', 's');
    await openFocusModal('parent', 'p');
    await settle();
    check(!_applyDeleteUndoPayload(undo) && tasks[0].subtasks.length === 0, 'child Undo preserves the running parent focus session');
    check(key(focusPauseBtn, { repeat: true }), 'repeated Enter on focus button suppresses native activation');
    await pauseOrResumeFocus();
    check(!_applyDeleteUndoPayload(undo), 'child Undo also preserves the paused parent focus session');
    await completeFocus();
    await settle();
    check(_applyDeleteUndoPayload(undo) && tasks[0].focus.elapsedMs === 0
      && tasks[0].subtasks[0].focus.elapsedMs === 700, 'Undo works after focus completion and preserves child progress');
    await save();
    render();

    openConfirmModal(buildDeleteParentConfirmMessage('p'), 'delete-parent', { parentId: 'p' });
    await frame();
    for (const modifier of ['repeat', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
      check(key(confirmDeleteBtn, { [modifier]: true }) && confirmState.action === 'delete-parent'
        && tasks.length === 1, `${modifier} Enter leaves the confirmation and tasks intact`);
    }
    closeConfirmModal();
    await frame();

    // 背面のオーバーレイを開いても、表示中の前面オーバーレイからフォーカスを奪わない。
    openParentModal('p');
    openSubtaskModal('p', 's');
    _focusWithinOverlay(parentModalOverlay, parentEditInput);
    await frame();
    check(document.activeElement === subtaskEditInput, 'nested editor keeps focus in the top modal');
    closeSubtaskModal();
    openSubtaskModal('p', 's');
    await frame();
    check(document.activeElement === subtaskEditInput, 'reopened editor ignores the previous close callback');
    closeSubtaskModal();
    closeParentModal();
    await frame();

    settings.pomodoro.enabled = true;
    navigate('settings');
    await frame();
    render();
    pomodoroFocusMinutesInput.focus();
    pomodoroFocusMinutesInput.value = '';
    render();
    check(pomodoroFocusMinutesInput.value === '' && document.activeElement === pomodoroFocusMinutesInput,
      'full render retains an empty focused duration draft');
    pomodoroFocusMinutesInput.value = '29';
    await commitPomodoroSettingsFromControls();
    check(settings.pomodoro.focusMinutes === 29 && pomodoroFocusMinutesInput.value === '29', 'duration draft commits to native persistence');

    setMemoSaveStatus('saving');
    const statusNode = memoSaveStatus.firstChild;
    setMemoSaveStatus('saving');
    check(memoSaveStatus.firstChild === statusNode, 'unchanged memo status retains the live-region text node');
    setMemoSaveStatus('saved');
    check(memoSaveStatus.firstChild !== statusNode, 'changed memo status updates the live region');

    const writes = [];
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { writes.push(key); return originalSet.call(this, key, value); };
    try {
      organizeMemo = '今回の検証メモ';
      await persistOrganizeMemoLocalCheckpoint();
    } finally { Storage.prototype.setItem = originalSet; }
    check(writes.includes(ORGANIZE_MEMO_KEY) && !writes.includes(TASKS_KEY) && !writes.includes(SETTINGS_KEY),
      'memo checkpoint does not rewrite unchanged native localStorage task and settings values');
    await save();
    await settle();
    const stored = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(stored[TASKS_KEY] === JSON.stringify(tasks) && stored[ORGANIZE_MEMO_KEY] === organizeMemo,
      'final tasks and memo agree with native IndexedDB');
  } catch (error) { lines.push('ERROR ' + error.stack); }
  await settle();
  lines.push(`${lines.filter(line => line.startsWith('PASS')).length} PASSED / ${lines.filter(line => /^(FAIL|ERROR)/.test(line)).length} FAILED`);
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-ten-pass-qa-'));
const original = readFileSync(process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url), 'utf8');
const isolated = original.replaceAll('yatta-spa-', `yaruyan-ten-pass-${randomUUID()}-`);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker)) throw new Error('Initialization marker missing');
writeFileSync(join(directory, 'index.html'), isolated.replace(marker,
  '      navigate(getRouteFromHash());\nawait (' + tenPassQa.toString() + ')();\n    })();'));
console.log(directory);
