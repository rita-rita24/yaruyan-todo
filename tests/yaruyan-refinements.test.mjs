import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { run, inputKeydownSource } = loadAppSource();

test('a truncated corrupt backup never authorizes deleting the full recovery source', () => {
  const raw = '{' + 'recoverable task data '.repeat(5000);
  const values = new Map([['tasks', raw]]);
  const api = run(
    [
      '_safeStorageGet',
      '_safeStorageSet',
      '_safeStorageRemove',
      '_createCorruptStorageBackupValue',
      '_backupCorruptStorageValue',
    ],
    {
      MAX_CORRUPT_STORAGE_BACKUP_CHARS: 65536,
      CORRUPT_STORAGE_BACKUP_SUFFIX: '__corrupt',
    },
  );
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  api._backupCorruptStorageValue({ storage, key: 'tasks', raw });
  assert.equal(values.get('tasks'), raw);
  assert.ok(values.get('tasks__corrupt').length <= 65536);
  api._backupCorruptStorageValue({ storage, key: 'tasks', raw });
  assert.equal(
    values.get('tasks'),
    raw,
    'An existing truncated backup is still incomplete',
  );
});

for (const [input, action, extra = {}] of [
  ['taskInput', 'addTask'],
  ['messageInput', 'saveMessage'],
  ['parentEditInput', 'saveParentEdit'],
  ['modalSubtaskInput', 'addSubtaskFromModal'],
  ['subtaskEditInput', 'saveSubtaskEdit'],
  [
    'messageList',
    'saveEditedMessage',
    { target: { closest: () => ({ dataset: { index: '0' } }) } },
  ],
]) {
  test(`holding Enter does not submit ${input} repeatedly`, () => {
    const handlerSource = inputKeydownSource(input);
    let handler,
      actions = 0,
      prevented = 0;
    vm.runInNewContext(handlerSource, {
      [input]: {
        addEventListener: (_, callback) => {
          handler = callback;
        },
        blur() {},
      },
      [action]: () => actions++,
      messageEditorState: {},
      renderMessages() {},
    });
    const event = {
      key: 'Enter',
      repeat: true,
      preventDefault() {
        prevented++;
      },
      ...extra,
    };
    handler(event);
    assert.equal(actions, 0);
    assert.equal(prevented, 1, 'Suppress default button activation as well');
    handler({ ...event, repeat: false });
    assert.equal(actions, 1, 'A fresh Enter still submits');
    handler({ ...event, repeat: false, isComposing: true });
    assert.equal(actions, 1, 'IME confirmation still never submits');
  });
}

for (const phase of ['focus', 'break']) {
  test(`${phase} duration saves on change and Enter, ignoring held keys and IME`, () => {
    const handlers = {},
      commits = [];
    let blurs = 0,
      prevented = 0;
    const input = {
      addEventListener: (event, handler) => {
        handlers[event] = handler;
      },
      blur: () => blurs++,
    };
    const { bindPomodoroMinutesInput } = run(
      ['bindInputEnter', 'bindPomodoroMinutesInput'],
      {
        commitPomodoroMinutesFromInput: (value) => commits.push(value),
      },
    );
    bindPomodoroMinutesInput(input, phase);
    const event = {
      key: 'Enter',
      preventDefault() {
        prevented++;
      },
    };
    handlers.keydown({ ...event, repeat: true });
    handlers.keydown({ ...event, isComposing: true });
    handlers.keydown({ ...event, keyCode: 229 });
    handlers.keydown({ ...event, key: 'Escape' });
    assert.deepEqual(commits, []);
    assert.equal(blurs, 0);
    assert.equal(prevented, 1);
    handlers.keydown(event);
    assert.deepEqual(commits, [phase]);
    assert.equal(blurs, 1);
    handlers.change();
    assert.deepEqual(commits, [phase, phase]);
  });
}

test('a repeated activation cannot reopen an editor through its restored button', () => {
  class Button {
    closest() {
      return this;
    }
  }
  let prevented = false;
  const api = run(['handleDocumentShortcuts'], {
    HTMLElement: Button,
    _getActiveModalOverlay: () => null,
    confirmModalOverlay: {},
    subtaskModalOverlay: {},
    parentModalOverlay: {},
    focusOverlay: {},
  });
  api.handleDocumentShortcuts({
    key: 'Enter',
    repeat: true,
    target: new Button(),
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
});

test('a leftover memo autosave defers during composition in another input', async () => {
  let saves = 0,
    scheduled = 0;
  const context = {
    organizeMemoComposing: false,
    activeCompositionTarget: { isConnected: true },
    activePointerIds: new Set(),
    isStateSaveOperationPending: () => false,
    scheduleOrganizeMemoSave: () => scheduled++,
    setStateSaveOperationPending() {},
    _getPersistedStateEntries: () => [],
    setMemoSaveStatus() {},
    _enqueueStoredStateSave: async () => {
      saves++;
      return true;
    },
  };
  const api = run(['persistOrganizeMemoCheckpoint'], context);
  assert.equal(await api.persistOrganizeMemoCheckpoint(), false);
  assert.equal(saves, 0);
  assert.equal(scheduled, 1);
  context.activeCompositionTarget = null;
  assert.equal(await api.persistOrganizeMemoCheckpoint(), true);
  assert.equal(saves, 1);
});

test('consecutive celebrations get a full display interval and ignore stale callbacks', () => {
  const timers = new Map(),
    frames = [],
    classes = new Set();
  let nextId = 0;
  const api = run(['showCelebration'], {
    settings: { celebration: true },
    getMessages: () => ['A', 'B'],
    wordIndex: 0,
    celebrationText: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => {
      timers.set(++nextId, callback);
      return nextId;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  api.showCelebration();
  const oldHide = [...timers.values()][0];
  api.showCelebration();
  frames.forEach((callback) => callback());
  oldHide();
  assert.equal(classes.has('show'), true);
  assert.equal(timers.size, 1, 'Only the latest hide timer remains');
  [...timers.values()][0]();
  assert.equal(classes.has('show'), false);
});

test('backup replacement updates the editor and Undo only after a successful commit', async () => {
  let invalidated = 0,
    undoRegistered = 0,
    renders = 0,
    saveOk = false;
  const messageEditorState = { editIndex: 1, draft: '編集中' };
  const api = run(['performImportBackup'], {
    isStateSaveOperationPending: () => false,
    _createAppStateSnapshot: () => ({}),
    _applyNormalizedBackupPayload() {},
    _commitStateSave: async () => saveOk,
    _invalidateDeleteUndo: () => invalidated++,
    messageEditorState,
    render: () => renders++,
    _registerImportUndoToast: () => undoRegistered++,
  });
  assert.equal(await api.performImportBackup({ tasks: [] }), false);
  assert.deepEqual(messageEditorState, { editIndex: 1, draft: '編集中' });
  assert.deepEqual([invalidated, undoRegistered, renders], [0, 0, 0]);
  saveOk = true;
  assert.equal(await api.performImportBackup({ tasks: [] }), true);
  assert.deepEqual(messageEditorState, { editIndex: null, draft: null });
  assert.deepEqual([invalidated, undoRegistered, renders], [1, 1, 1]);
});

test('reading a backup reports failure when an intervening modal prevents confirmation', async () => {
  const api = run(['importBackupFile'], {
    isStateSaveOperationPending: () => false,
    backupImportRequestId: 0,
    MAX_BACKUP_FILE_BYTES: 1000,
    normalizeBackupPayload: (value) => value,
    buildImportBackupConfirmMessage: () => '',
    openConfirmModal: () => false,
    backupFileInput: { value: 'chosen' },
    showErrorToast: () => assert.fail('No new notification'),
  });
  assert.equal(
    await api.importBackupFile({ size: 2, text: async () => '{}' }),
    false,
  );
});
