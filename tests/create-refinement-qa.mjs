// localStorageとIndexedDBの名前を分離した、使い捨てのアプリコピーを生成する。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function refinementQa() {
  const lines = [];
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => { await _storedStateSaveQueue; await _indexedDbWriteQueue; await frame(); };
  const key = (element, repeat = false) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', repeat, bubbles: true, cancelable: true
  }));
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([{ id: 'original', text: '元のタスク' }]);
    await save();
    navigate('tasks');
    await frame();
    render();

    taskInput.value = 'Enter操作';
    taskInput.focus();
    const repeated = key(taskInput, true);
    await settle();
    check(!repeated && tasks.length === 1 && taskInput.value === 'Enter操作', 'repeated Enter neither adds nor clears a draft');
    taskInput.value = '通常Enter操作';
    key(taskInput);
    await settle();
    check(tasks[0].text === '通常Enter操作' && taskInput.value === '', 'fresh Enter adds once and clears the input');

    const editButton = qs('.edit-parent-btn[data-id="original"]', taskList);
    editButton.focus();
    openParentModal('original');
    await frame();
    parentEditInput.value = '編集済み';
    key(parentEditInput);
    await settle();
    check(getTask('original').text === '編集済み' && !parentModalOverlay.classList.contains('show'), 'fresh Enter saves and closes the parent editor');
    check(!key(document.activeElement, true), 'held Enter cannot reactivate the restored edit button');

    // ユーザーが別の入力欄へ移動した後も、メモの保存待機タイマーが残る場合がある。
    taskInput.focus();
    taskInput.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const beforeCompositionSave = await persistOrganizeMemoCheckpoint();
    check(beforeCompositionSave === false && !appShell.hasAttribute('inert') && document.activeElement === taskInput,
      'memo autosave defers without locking a composing task input');
    taskInput.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await flushOrganizeMemoSave();
    check(memoSaveStatus.textContent.startsWith('保存済み') && !isStateSaveOperationPending(), 'saving recovers after composition ends');
    await settle();

    const observer = new MutationObserver(() => {});
    observer.observe(taskViewStatus, { subtree: true, childList: true, characterData: true });
    render();
    render();
    check(observer.takeRecords().length === 0, 'unchanged renders leave the filter live region untouched');
    taskViewState.filter = 'completed';
    render();
    check(observer.takeRecords().length > 0 && taskViewStatus.textContent.includes('0件'), 'a changed filter still updates its result announcement');
    observer.disconnect();
    await setTaskFilter('all');

    const recoveryKey = TASKS_KEY + '-recovery-check';
    const raw = '{' + '復元対象'.repeat(20000);
    localStorage.setItem(recoveryKey, raw);
    _backupCorruptStorageValue({ storage: localStorage, key: recoveryKey, raw });
    check(localStorage.getItem(recoveryKey) === raw
      && localStorage.getItem(recoveryKey + CORRUPT_STORAGE_BACKUP_SUFFIX).length <= MAX_CORRUPT_STORAGE_BACKUP_CHARS,
      'a capped recovery preview preserves the full corrupt original');

    const backup = createBackupPayload();
    const normalized = normalizeBackupPayload({ ...backup, data: { ...backup.data,
      tasks: [{ id: 'imported', text: '復元したタスク' }] } });
    await performImportBackup(normalized);
    await settle();
    check(taskList.textContent.includes('復元したタスク'), 'successful import displays restored tasks');
    qs('.toast-action-btn', toastLayer).click();
    await settle();
    check(!!getTask('original') && !getTask('imported'), 'import Undo still restores the previous task state');

    await openFocusModal('parent', 'original');
    await settle();
    const result = await importBackupFile(new File([JSON.stringify(backup)], 'test.json'));
    check(result === false && !confirmModalOverlay.classList.contains('show'), 'backup read cannot claim success when focus mode blocks confirmation');
    await completeFocus();
    await settle();
    check(getTask('original').done && !focusOverlay.classList.contains('show'), 'focus completion and persistence still work');

    // 実時間のタイマーを待たずに、アニメーションを続けて発火させる。
    const setTimer = window.setTimeout, clearTimer = window.clearTimeout;
    const timers = new Map();
    let timerId = 0, staleHide;
    settings.celebration = true;
    try {
      window.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
      window.clearTimeout = id => timers.delete(id);
      showCelebration('A');
      staleHide = [...timers.values()][0];
      showCelebration('B');
      await frame();
      staleHide();
      check(celebrationText.classList.contains('show') && timers.size === 1,
        'an earlier animation timeout cannot hide the latest celebration');
      [...timers.values()].at(-1)();
      check(!celebrationText.classList.contains('show'), 'the latest celebration still ends');
      showCelebration('C');
      settings.celebration = false;
      await frame();
      check(!celebrationText.classList.contains('show'), 'disabling celebration before its frame prevents a delayed flash');
    } finally { window.setTimeout = setTimer; window.clearTimeout = clearTimer; }
    settings.celebration = false;
    await save();
    await settle();
    const stored = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(stored[TASKS_KEY] === JSON.stringify(tasks) && localStorage.getItem(TASKS_KEY) === stored[TASKS_KEY],
      'localStorage and native IndexedDB retain identical final task state');
  } catch (error) { lines.push('ERROR ' + error.stack); }
  lines.push(`${lines.filter(line => line.startsWith('PASS')).length} PASSED / ${lines.filter(line => /^(FAIL|ERROR)/.test(line)).length} FAILED`);
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-refinement-qa-'));
const original = readFileSync(process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url), 'utf8');
const isolated = original.replaceAll('yatta-spa-', `yaruyan-refinement-${randomUUID()}-`);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker)) throw new Error('Initialization marker missing');
writeFileSync(join(directory, 'index.html'), isolated.replace(marker,
  '      navigate(getRouteFromHash());\nawait (' + refinementQa.toString() + ')();\n    })();'));
writeFileSync(join(directory, 'app.html'), isolated.replaceAll('yaruyan-refinement-', 'yaruyan-preview-'));
console.log(directory);
