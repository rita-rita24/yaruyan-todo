// キーボード・IME・フォーカス・保存の回帰テスト用に、分離したブラウザ環境を生成する。
// 省略可能な引数で、現在の実装と比較するアプリのHTMLを指定できる。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function boundaryQa() {
  const lines = [];
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const key = (element, name, options = {}) => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: name, bubbles: true, cancelable: true, ...options
  }));
  const settle = async () => {
    await _storedStateSaveQueue;
    await _indexedDbWriteQueue;
    await frame();
  };
  try {
    settings.sound = false;
    settings.celebration = false;
    settings.messages = ['First', 'Second', 'Third'];
    tasks = normalizeTasks([{ id: 'parent', text: '親タスク', subtasks: [
      { id: 'a', text: '子 A', done: true }, { id: 'b', text: '子 B' }, { id: 'c', text: '子 C' }
    ] }]);
    await save();
    navigate('settings');
    await frame();
    render();
    check(qs('[aria-current="page"]')?.dataset.route === 'settings', 'current route is available to assistive technology');
    editMessage(1);
    let editor = qs('.message-edit-input', messageList);
    editor.value = '編集中の文 😀';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    editor.setSelectionRange(2, 5, 'backward');
    renderMessages();
    check(qs('.message-edit-input', messageList) === editor && document.activeElement === editor,
      'unchanged message render retains the actual input and focus');
    editor = qs('.message-edit-input', messageList);
    check(editor.selectionStart === 2 && editor.selectionEnd === 5 && editor.selectionDirection === 'backward',
      'message selection survives an unchanged render');
    editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    key(editor, 'Escape', { isComposing: true });
    check(messageEditorState.editIndex === 1 && messageEditorState.draft === '編集中の文 😀', 'IME Escape keeps message editor and draft');
    key(editor, 'Escape', { keyCode: 229 });
    check(messageEditorState.editIndex === 1, 'legacy IME Escape keeps message editor');
    let selectionWrites = 0;
    const setSelection = editor.setSelectionRange.bind(editor);
    editor.setSelectionRange = (...args) => { selectionWrites++; setSelection(...args); };
    render();
    check(qs('.message-edit-input', messageList) === editor, 'unrelated full render preserves composing message input');
    check(selectionWrites === 0, 'rerender does not reset selection during composition');
    editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    key(editor, 'Escape');
    check(messageEditorState.editIndex === null && document.activeElement === qs('.edit-message-btn[data-index="1"]', messageList),
      'normal Escape cancels edit and returns focus to the same message');

    editMessage(1);
    editor = qs('.message-edit-input', messageList);
    editor.value = '保存済みの編集';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await saveEditedMessage(1);
    check(settings.messages[1] === '保存済みの編集' && document.activeElement === qs('.edit-message-btn[data-index="1"]', messageList),
      'saving an edit returns keyboard focus to its edit button');

    const deleteButton = qs('.delete-message-btn[data-index="1"]', messageList);
    deleteButton.focus();
    await deleteMessage(1);
    check(settings.messages.join(',') === 'First,Third'
      && document.activeElement === qs('.delete-message-btn[data-index="1"]', messageList),
      'deleting a message focuses the next message at the same position');
    await deleteMessage(1);
    check(settings.messages.length === 1 && document.activeElement === qs('.edit-message-btn[data-index="0"]', messageList),
      'deleting the last deletable message focuses an enabled control');

    messageInput.value = '追加した文';
    messageInput.focus();
    await saveMessage();
    check(messageInput.value === '' && settings.messages[1] === '追加した文' && document.activeElement === messageInput,
      'adding a message retains input focus');
    editMessage(1);
    editor = qs('.message-edit-input', messageList);
    editor.value = '失敗後も残る下書き';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    const saveNormally = save;
    save = async () => { await frame(); return false; };
    await saveEditedMessage(1);
    save = saveNormally;
    check(settings.messages[1] === '追加した文' && qs('.message-edit-input', messageList)?.value === '失敗後も残る下書き'
      && document.activeElement === qs('.message-edit-input', messageList), 'failed message save retains the draft and focus');
    key(qs('.message-edit-input', messageList), 'Escape');

    navigate('tasks');
    await frame();
    render();
    save = async () => { await frame(); return false; };
    taskInput.value = '失敗後も残るタスク';
    taskInput.focus();
    await addTask();
    check(taskInput.value === '失敗後も残るタスク' && tasks.length === 1 && document.activeElement === taskInput,
      'failed task addition preserves its draft and input focus');
    save = saveNormally;
    openParentModal('parent');
    await frame();
    save = async () => { await frame(); return false; };
    parentEditInput.value = '失敗後も残る親の編集';
    parentEditInput.focus();
    await saveParentEdit();
    check(parentEditInput.value === '失敗後も残る親の編集' && getTask('parent').text === '親タスク'
      && document.activeElement === parentEditInput, 'failed parent edit preserves its draft and input focus');
    modalSubtaskInput.value = '失敗後も残る子の追加';
    modalSubtaskInput.focus();
    await addSubtaskFromModal();
    check(modalSubtaskInput.value === '失敗後も残る子の追加' && getTask('parent').subtasks.length === 3
      && document.activeElement === modalSubtaskInput, 'failed child addition preserves its draft and input focus');
    openSubtaskModal('parent', 'b');
    await frame();
    subtaskEditInput.value = '失敗後も残る子の編集';
    subtaskEditInput.focus();
    await saveSubtaskEdit();
    check(subtaskEditInput.value === '失敗後も残る子の編集' && getSubtask('parent', 'b').text === '子 B'
      && document.activeElement === subtaskEditInput, 'failed child edit preserves its draft and input focus');
    save = saveNormally;
    closeSubtaskModal();
    await frame();
    let childButton = qs('.modal-edit-subtask-btn[data-sub-id="b"]', modalSubtaskList);
    childButton.focus();
    parentEditInput.value = '親の未保存の下書き';
    renderParentModalSubtasks(getTask('parent'));
    check(document.activeElement === qs('.modal-edit-subtask-btn[data-sub-id="b"]', modalSubtaskList),
      'rebuilding modal children retains the selected child action');
    key(document.activeElement, 'ArrowDown', { altKey: true });
    await settle();
    check(getTask('parent').subtasks.map(sub => sub.id).join(',') === 'a,c,b', 'keyboard reorder works inside the parent editor');
    check(document.activeElement === qs('.modal-edit-subtask-btn[data-sub-id="b"]', modalSubtaskList)
      && parentEditInput.value === '親の未保存の下書き', 'modal reorder preserves focus and the unsaved parent draft');
    taskViewState.filter = 'pending';
    key(document.activeElement, 'ArrowUp', { altKey: true });
    await settle();
    key(document.activeElement, 'ArrowUp', { altKey: true });
    await settle();
    check(getTask('parent').subtasks.map(sub => sub.id).join(',') === 'b,a,c', 'modal reorder includes completed children shown in the editor');
    for (const id of ['c', 'b', 'a']) {
      qs(`.modal-delete-subtask-btn[data-sub-id="${id}"]`, modalSubtaskList).focus();
      await performDeleteSubtask('parent', id);
    }
    check(getTask('parent').subtasks.length === 0 && document.activeElement === modalSubtaskInput,
      'removing the last modal child returns focus to the child input');
    closeParentModal();
    await frame();
    await settle();
    await save();
    await _indexedDbWriteQueue;
    const stored = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(stored[TASKS_KEY] === JSON.stringify(tasks) && stored[SETTINGS_KEY] === JSON.stringify(settings),
      'native IndexedDB commits and reads the final tasks and settings together');
  } catch (error) {
    lines.push('ERROR ' + error.stack);
  }
  await settle();
  lines.push(`${lines.filter(line => line.startsWith('PASS')).length} PASSED / ${lines.filter(line => /^(FAIL|ERROR)/.test(line)).length} FAILED`);
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-boundary-qa-'));
const original = readFileSync(process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url), 'utf8');
const isolated = original.replaceAll('yatta-spa-', `yaruyan-boundary-${randomUUID()}-`);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker)) throw new Error('Initialization marker missing');
writeFileSync(join(directory, 'index.html'), isolated.replace(marker,
  '      navigate(getRouteFromHash());\nawait (' + boundaryQa.toString() + ')();\n    })();'));
writeFileSync(join(directory, 'app.html'), isolated.replaceAll('yaruyan-boundary-', 'yaruyan-preview-'));
console.log(directory);
