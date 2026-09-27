// 分離したブラウザ環境で、実際のDOM・保存処理・イベントハンドラーを検証する。
// 省略可能な第1引数で、変更前後の比較に使う別のアプリファイルを選択できる。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const directory = mkdtempSync(join(tmpdir(), 'yaruyan-interaction-qa-'));
const original = readFileSync(process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url), 'utf8');

async function interactionQa() {
  const output = document.createElement('pre');
  output.id = 'qa-results';
  const lines = [];
  const check = (condition, name) => { lines.push((condition ? 'PASS ' : 'FAIL ') + name); };
  const editDraft = text => {
    const editor = messageList.querySelector('.message-edit-input');
    editor.value = text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return editor;
  };
  try {
    navigate('tasks');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks(Array.from({ length: 100 }, (_, parent) => ({
      id: 'p' + parent, text: '親 <>&" 😀 ' + parent, done: false,
      subtasks: Array.from({ length: 10 }, (_, child) => ({
        id: 's' + child, text: '子 <>&" 😀 ' + child, done: child % 2 === 0
      }))
    })));
    const firstStart = performance.now();
    render();
    lines.push('PERF first render 100 parents / 1,000 children: ' + Math.round(performance.now() - firstStart) + ' ms');
    const row = taskList.firstElementChild;
    const button = row.querySelector('.edit-parent-btn');
    const icon = button.querySelector('svg');
    button.focus();
    const secondStart = performance.now();
    render();
    lines.push('PERF unchanged render: ' + Math.round(performance.now() - secondStart) + ' ms');
    check(taskList.firstElementChild === row && button.querySelector('svg') === icon, 'unchanged rows and SVG retained');
    check(document.activeElement === button, 'task keyboard focus retained');
    tasks[1].text = '更新された親';
    render();
    check(taskList.firstElementChild === row && taskList.children[1].textContent.includes('更新された親'), 'only edited row refreshed');
    const oldRows = Array.from(taskList.children);
    tasks.reverse();
    render();
    check(Array.from(taskList.children).every((element, index) => element === oldRows[oldRows.length - 1 - index]), 'reorder preserves row identity and order');
    taskViewState.filter = 'completed';
    render();
    check(taskList.querySelectorAll('.subtask-item').length === 500, 'completed filter has exactly 500 children');
    taskViewState.filter = 'all';
    render();
    const completedButton = taskList.querySelector('.undo-subtask-btn');
    const completedParent = completedButton.dataset.parentId;
    const completedChild = completedButton.dataset.subId;
    completedButton.focus();
    await undoCompleted('subtask', completedParent, completedChild);
    check(document.activeElement?.classList.contains('open-focus-subtask-btn')
      && document.activeElement.dataset.subId === completedChild, 'undo completion retains the corresponding task control focus');
    check(taskList.querySelector('.task-title').textContent === tasks[0].text
      && taskList.querySelectorAll('img, script').length === 0, 'literal markup renders as safe text');

    location.hash = '#/settings';
    renderRoute('settings');
    settings.messages = ['First', 'Second', 'Third'];
    renderMessages();
    editMessage(1);
    let editor = editDraft('編集中の文章 😀');
    editor.setSelectionRange(2, 5, 'backward');
    renderMessages();
    editor = messageList.querySelector('.message-edit-input');
    check(editor.value === '編集中の文章 😀' && editor.selectionStart === 2 && editor.selectionEnd === 5
      && editor.selectionDirection === 'backward' && document.activeElement === editor, 'message draft, selection and focus survive rerender');
    const themeButton = themeColorGrid.querySelector('.theme-btn');
    themeButton.focus();
    await setThemeColor(themeButton.dataset.themeColor);
    check(document.activeElement === themeButton && themeButton.isConnected, 'theme selection retains keyboard focus');
    check(messageList.querySelector('.message-edit-input').value === '編集中の文章 😀', 'theme change retains message draft');
    messageInput.value = '未追加の下書き';
    await deleteMessage(0);
    check(messageEditorState.editIndex === 0 && messageList.querySelector('.message-edit-input').value === '編集中の文章 😀', 'deleting earlier message retains edited draft');
    const saveNormally = _commitStateSave;
    _commitStateSave = async snapshot => { _applyAppStateSnapshot(snapshot); return false; };
    await deleteMessage(0);
    _commitStateSave = saveNormally;
    check(messageList.querySelector('.message-edit-input').value === '編集中の文章 😀', 'failed deletion restores editor draft');
    await saveEditedMessage(0);
    check(settings.messages[0] === '編集中の文章 😀', 'edited message saves correctly');
    editMessage(0);
    await deleteMessage(0);
    check(messageInput.value === '未追加の下書き', 'deleting an edited message retains the separate add draft');

    location.hash = '#/memo';
    renderRoute('memo');
    organizeMemoInput.focus();
    organizeMemoInput.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    organizeMemoInput.value = 'にほんご';
    organizeMemoInput.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    await _storedStateSaveQueue;
    const mutations = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(appShell, { attributes: true, attributeFilter: ['inert'] });
    await persistOrganizeMemoCheckpoint();
    await Promise.resolve();
    observer.disconnect();
    check(mutations.length === 0 && document.activeElement === organizeMemoInput, 'IME composition is not interrupted by autosave inert lock');
    organizeMemoInput.value = '日本語を確定';
    organizeMemoInput.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await flushOrganizeMemoSave();
    await _indexedDbWriteQueue;
    const saved = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(saved[ORGANIZE_MEMO_KEY] === '日本語を確定', 'composition result saved to native IndexedDB');

    lines.push(lines.some(line => line.startsWith('FAIL')) ? 'BROWSER CHECKS FAILED' : 'ALL 16 BROWSER CHECKS PASSED');
  } catch (error) { lines.push('ERROR ' + error.stack); }
  await _storedStateSaveQueue;
  await _indexedDbWriteQueue;
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const marker = '      navigate(getRouteFromHash());\n    })();';
if (!original.includes(marker)) throw new Error('Initialization marker missing');
const fixture = original.replaceAll('yatta-spa-', 'yaruyan-interaction-' + randomUUID() + '-')
  .replace(marker, '      navigate(getRouteFromHash());\nawait (' + interactionQa.toString() + ')();\n    })();');
writeFileSync(join(directory, 'index.html'), fixture);
console.log(directory);
