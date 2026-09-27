// ブラウザ統合テストには、使い捨てのコピーと分離した保存先名を使う。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function polishQa() {
  const lines = [];
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => { await _storedStateSaveQueue; await _indexedDbWriteQueue; await frame(); };
  const key = (element, options = {}) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, cancelable: true, ...options
  }));
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([{ id: 'original', text: '最初のタスク' }]);
    await save();
    navigate('tasks');
    await frame();
    render();

    const backup = createBackupPayload();
    const imported = normalizeBackupPayload({ ...backup, data: { ...backup.data,
      tasks: [{ id: 'replacement', text: '復元タスク' }] } });
    await performImportBackup(imported);
    await settle();
    const undo = qs('.toast-action-btn', toastLayer);
    setStateSaveOperationPending(true);
    undo.click();
    // 回帰テストでは、トーストを閉じる180ミリ秒のアニメーションも待つ。
    await new Promise(resolve => setTimeout(resolve, 220));
    await frame();
    check(!!_importUndoState.snapshot && toastLayer.contains(undo) && !!getTask('replacement'),
      'Undo during a save lock keeps the snapshot and existing button');
    setStateSaveOperationPending(false);
    undo.click();
    await settle();
    check(!!getTask('original') && !getTask('replacement'), 'Undo still works after the save lock ends');
    // 旧版アプリで実行する場合も、後続の検証が前の結果に影響されないようにする。
    tasks = normalizeTasks(backup.data.tasks);
    await save();
    render();

    let calls = 0, release;
    const action = new Promise(resolve => { release = resolve; });
    showToast('検証', { actionLabel: '検証', onAction: () => { calls++; return action; } });
    const actionButton = qs('.toast-action-btn', toastLayer);
    actionButton.click();
    actionButton.click();
    check(calls === 1, 'two rapid clicks run one pending action');
    release();
    await frame();

    navigate('memo');
    await frame();
    organizeMemoInput.focus();
    organizeMemoInput.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    organizeMemoInput.value = '変換中から移動したメモ';
    organizeMemoInput.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    organizeMemoInput.blur();
    await settle();
    check(!organizeMemoComposing && !activeCompositionTarget && !isStateSaveOperationPending(),
      'blur without compositionend releases both composition and save locks');
    check(localStorage.getItem(ORGANIZE_MEMO_KEY) === '変換中から移動したメモ'
      && (await _readManyFromIndexedDb([ORGANIZE_MEMO_KEY]))[ORGANIZE_MEMO_KEY] === organizeMemo,
      'final memo value reaches both native storage backends');
    check(memoSaveStatus.textContent.startsWith('保存済み'), 'memo status returns to saved');
    organizeMemoComposing = false;
    activeCompositionTarget = null;
    await flushOrganizeMemoSave();

    navigate('tasks');
    await frame();
    openParentModal('original');
    await frame();
    parentEditInput.value = 'ショートカット保存';
    modalSubtaskInput.value = '未確定の子タスク';
    modalSubtaskInput.focus();
    key(modalSubtaskInput, { ctrlKey: true });
    await settle();
    check(getTask('original').text === 'ショートカット保存'
      && getTask('original').subtasks.length === 0 && !parentModalOverlay.classList.contains('show'),
      'Ctrl+Enter saves the parent without adding the child draft');
    if (parentModalOverlay.classList.contains('show')) closeParentModal();
    openParentModal('original');
    await frame();
    modalSubtaskInput.value = '通常の子タスク';
    key(modalSubtaskInput);
    await settle();
    check(getTask('original').subtasks.some(sub => sub.text === '通常の子タスク'), 'plain Enter still adds a child');
    closeParentModal();
    await frame();

    focusTaskInputWithRoute();
    openParentModal('original');
    await new Promise(resolve => setTimeout(resolve, 30));
    await frame();
    check(parentModalOverlay.contains(document.activeElement), 'delayed task shortcut does not steal modal focus');
    closeParentModal();
    await frame();
    focusMemoInputWithRoute();
    navigate('settings');
    await new Promise(resolve => setTimeout(resolve, 30));
    await frame();
    check(getRouteFromHash() === 'settings' && document.activeElement !== organizeMemoInput,
      'superseded memo shortcut does not focus the hidden page');

    navigate('tasks');
    await frame();
    render();
    const observer = new MutationObserver(() => {});
    observer.observe(taskList, { attributes: true, subtree: true });
    for (const button of qsa('button[aria-label]', taskList)) {
      _extractTooltipText(button);
      _isIconOnlyButton(button);
    }
    check(observer.takeRecords().length === 0, 'unchanged task tooltips generate zero attribute mutations');
    observer.disconnect();
    const childId = getTask('original').subtasks[0].id;
    await openFocusModal('subtask', 'original', childId);
    await pauseOrResumeFocus();
    await pauseOrResumeFocus();
    await completeFocus();
    await settle();
    check(getTask('original').done && getSubtask('original', childId).done, 'focus start, pause, resume and completion remain functional');
    const stored = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(stored[TASKS_KEY] === JSON.stringify(tasks) && stored[TASKS_KEY] === localStorage.getItem(TASKS_KEY),
      'final task data matches both native persistence backends');
  } catch (error) { lines.push('ERROR ' + error.stack); }
  lines.push(`${lines.filter(line => line.startsWith('PASS')).length} PASSED / ${lines.filter(line => /^(FAIL|ERROR)/.test(line)).length} FAILED`);
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-polish-qa-'));
const original = readFileSync(process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url), 'utf8');
const isolated = original.replaceAll('yatta-spa-', `yaruyan-polish-${randomUUID()}-`);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker)) throw new Error('Initialization marker missing');
writeFileSync(join(directory, 'index.html'), isolated.replace(marker,
  '      navigate(getRouteFromHash());\nawait (' + polishQa.toString() + ')();\n    })();'));
writeFileSync(join(directory, 'app.html'), isolated.replaceAll('yaruyan-polish-', 'yaruyan-polish-preview-'));
console.log(directory);
