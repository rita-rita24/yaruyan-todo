import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();

function corruptApi() {
  return run(
    [
      '_safeStorageGet',
      '_safeStorageSet',
      '_safeStorageRemove',
      '_createCorruptStorageBackupValue',
      '_backupCorruptStorageValue',
    ],
    {
      CORRUPT_STORAGE_BACKUP_SUFFIX: '__corrupt',
      MAX_CORRUPT_STORAGE_BACKUP_CHARS: 65536,
    },
  );
}

test('round 2: corrupt recovery never removes a newer value written by another tab', () => {
  const values = new Map([['tasks', '{broken']]);
  corruptApi()._backupCorruptStorageValue({
    key: 'tasks',
    raw: '{broken',
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
        values.set('tasks', '[{"text":"New task"}]');
      },
      removeItem: (key) => values.delete(key),
    },
  });
  assert.equal(values.get('tasks'), '[{"text":"New task"}]');
});

test('round 2: an older corrupt backup cannot authorize deletion of different current data', () => {
  const values = new Map([
    ['tasks', '{new broken'],
    ['tasks__corrupt', '{old broken'],
  ]);
  corruptApi()._backupCorruptStorageValue({
    key: 'tasks',
    raw: '{new broken',
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: () => assert.fail('Preserve the original recovery copy'),
      removeItem: (key) => values.delete(key),
    },
  });
  assert.equal(values.get('tasks'), '{new broken');
  assert.equal(values.get('tasks__corrupt'), '{old broken');
});

function undoContext(state, active = false) {
  const parent = {
    id: 'p',
    done: true,
    subtasks: [],
    focus: { focusState: state, elapsedMs: 5000, startedAt: 100 },
  };
  const context = {
    tasks: [parent],
    MAX_PARENT_TASK_COUNT: 200,
    MAX_SUBTASK_COUNT_PER_PARENT: 50,
    structuredClone,
    getTask: (id) => (id === 'p' ? parent : null),
    getActiveFocusTarget: () => (active ? parent : null),
    showErrorToast: () =>
      assert.fail('Undo should not introduce an error notification'),
  };
  const api = run(
    [
      '_copyTaskSnapshot',
      '_isValidDeleteUndoPayload',
      '_createDeleteUndoRestorePlan',
      '_applyDeleteUndoPayload',
      'syncParentStatus',
      'hasSubtasks',
      'createFocusMeta',
      'normalizeNonNegativeNumber',
    ],
    context,
  );
  const payload = {
    removedSubtasks: [
      {
        parentId: 'p',
        index: 0,
        subtask: {
          id: 's',
          text: 'Restored child',
          done: false,
          focus: { elapsedMs: 700 },
        },
      },
    ],
  };
  return { parent, api, payload };
}

test('round 1: undo cannot turn an active leaf focus session into a container', () => {
  for (const state of ['running', 'paused']) {
    const { parent, api, payload } = undoContext(state, true);
    assert.equal(api._applyDeleteUndoPayload(payload), false);
    assert.equal(parent.subtasks.length, 0);
    assert.equal(parent.focus.elapsedMs, 5000);
  }
});

test('round 1: restoring a child clears obsolete container focus and preserves child progress', () => {
  const { parent, api, payload } = undoContext('idle');
  assert.equal(api._applyDeleteUndoPayload(payload), true);
  assert.equal(parent.focus.elapsedMs, 0);
  assert.equal(parent.focus.startedAt, null);
  assert.equal(parent.subtasks[0].focus.elapsedMs, 700);
  assert.equal(parent.done, false);
});

test('round 3: clock rollback never double-counts already checkpointed parent or child work', () => {
  for (const child of [false, true]) {
    const target = {
      focus: { focusState: 'running', elapsedMs: 0, startedAt: 10000 },
      subtasks: [],
    };
    const tasks = child
      ? [{ focus: { focusState: 'idle' }, subtasks: [target] }]
      : [target];
    const api = run(['syncRunningFocusElapsedForPersist'], {
      tasks,
      syncActivePomodoroPhaseProgress: () => 0,
    });
    api.syncRunningFocusElapsedForPersist(12000);
    api.syncRunningFocusElapsedForPersist(9000);
    api.syncRunningFocusElapsedForPersist(12000);
    assert.equal(target.focus.elapsedMs, 2000);
    api.syncRunningFocusElapsedForPersist(13000);
    assert.equal(target.focus.elapsedMs, 3000);
  }
});

test('round 3: checkpoint retry interval recovers after a backwards wall-clock adjustment', async () => {
  let saves = 0;
  const context = {
    focusState: { lastCheckpointAt: 50000 },
    FOCUS_CHECKPOINT_INTERVAL_MS: 2000,
    isStateSaveOperationPending: () => false,
    getActiveFocusTarget: () => ({ focus: { focusState: 'running' } }),
    _createAppStateSnapshot: () => ({}),
    _createFocusRuntimeSnapshot: () => ({}),
    syncRunningFocusElapsedForPersist: () => true,
    _commitFocusStateSave: async () => {
      saves++;
      return true;
    },
  };
  const api = run(['checkpointActiveFocusElapsed'], context);
  await api.checkpointActiveFocusElapsed(10000);
  await api.checkpointActiveFocusElapsed(11000);
  await api.checkpointActiveFocusElapsed(12000);
  assert.equal(saves, 2);
  assert.equal(context.focusState.lastCheckpointAt, 12000);
});

test('round 4: delayed focus for a lower modal cannot escape the top modal', () => {
  let focused = 0;
  const lower = { classList: { contains: () => true }, contains: () => true };
  const input = { focus: () => focused++ };
  const api = run(['_focusWithinOverlay'], {
    _getActiveModalOverlay: () => ({}),
    _isFocusableElement: () => true,
  });
  api._focusWithinOverlay(lower, input);
  assert.equal(focused, 0);
});

test('round 4: stale close callbacks do not steal focus after a modal reopens', () => {
  let shown = true,
    focused = 0;
  const callbacks = [];
  const overlay = {
    classList: {
      remove: () => {
        shown = false;
      },
      contains: () => shown,
    },
    setAttribute() {},
  };
  const context = {
    syncModalInteractivity() {},
    _modalFocusStack: [{ overlay }],
    requestAnimationFrame: (fn) => callbacks.push(fn),
    _getActiveModalOverlay: () => overlay,
    _resolveModalReturnFocus: () => ({ focus: () => focused++ }),
    _focusWithinOverlay: () => focused++,
  };
  const api = run(['_closeModalOverlay'], context);
  api._closeModalOverlay(overlay);
  shown = true;
  callbacks.forEach((fn) => fn());
  assert.equal(focused, 0);
});

test('round 5: unrelated settings renders preserve the focused duration draft', () => {
  for (const active of ['focus', 'break']) {
    const focus = { value: active === 'focus' ? '' : '25' },
      rest = { value: active === 'break' ? '12' : '5' };
    const context = {
      pomodoroToggle: {},
      pomodoroFocusMinutesInput: focus,
      pomodoroBreakMinutesInput: rest,
      pomodoroRhythmCard: null,
      _pomodoroSettingsControlsSynced: true,
      settings: {
        pomodoro: { enabled: true, focusMinutes: 25, breakMinutes: 5 },
      },
      normalizePomodoroSettings: (value) => value,
      document: { activeElement: active === 'focus' ? focus : rest },
    };
    const api = run(
      ['syncPomodoroSettingsControls', 'renderPomodoroSettings'],
      context,
    );
    api.renderPomodoroSettings();
    assert.equal(
      active === 'focus' ? focus.value : rest.value,
      active === 'focus' ? '' : '12',
    );
    api.syncPomodoroSettingsControls({
      enabled: true,
      focusMinutes: 30,
      breakMinutes: 10,
    });
    assert.equal(focus.value, '30');
    assert.equal(rest.value, '10');
  }
});

test('round 6: oversized message imports stop work once the supported messages are recovered', () => {
  let normalized = 0;
  const api = run(['normalizeMessageList'], {
    MAX_MESSAGE_COUNT: 30,
    MAX_MESSAGE_TEXT_LENGTH: 80,
    normalizeInputText: (value) => {
      normalized++;
      return value;
    },
  });
  const messages = api.normalizeMessageList(Array(100000).fill('Message'));
  assert.equal(messages.length, 30);
  assert.equal(normalized, 30);
});

test('round 6: invalid messages do not consume the import limit and retained order stays stable', () => {
  const api = run(['normalizeMessageList', 'normalizeInputText'], {
    MAX_MESSAGE_COUNT: 30,
    MAX_MESSAGE_TEXT_LENGTH: 80,
  });
  const input = [
    null,
    {},
    '',
    ...Array.from({ length: 31 }, (_, i) => ` Message ${i} `),
  ];
  assert.deepEqual(
    Array.from(api.normalizeMessageList(input)),
    Array.from({ length: 30 }, (_, i) => `Message ${i}`),
  );
});

test('round 7: repeated or modified Enter cannot activate a destructive confirmation', () => {
  let executions = 0;
  const overlay = {};
  class Element {
    closest() {
      return this;
    }
  }
  const button = new Element();
  const api = run(['handleDocumentShortcuts'], {
    HTMLElement: Element,
    confirmModalOverlay: overlay,
    _getActiveModalOverlay: () => overlay,
    closeConfirmModalBtn: {},
    executeConfirmedAction: () => executions++,
  });
  for (const modifier of [
    'repeat',
    'altKey',
    'ctrlKey',
    'metaKey',
    'shiftKey',
  ]) {
    let prevented = false;
    api.handleDocumentShortcuts({
      key: 'Enter',
      target: button,
      [modifier]: true,
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(executions, 0, modifier);
    assert.equal(
      prevented,
      true,
      `${modifier}: also suppress the native button click`,
    );
  }
});

test('round 7: ordinary Enter confirms while Enter on cancel retains the native action', () => {
  let executions = 0,
    prevented = 0;
  const overlay = {};
  class Element {
    closest() {
      return this;
    }
  }
  const cancel = new Element();
  const api = run(['handleDocumentShortcuts'], {
    HTMLElement: Element,
    confirmModalOverlay: overlay,
    _getActiveModalOverlay: () => overlay,
    closeConfirmModalBtn: cancel,
    executeConfirmedAction: () => executions++,
  });
  api.handleDocumentShortcuts({
    key: 'Enter',
    target: new Element(),
    preventDefault: () => prevented++,
  });
  api.handleDocumentShortcuts({
    key: 'Enter',
    target: cancel,
    preventDefault: () => prevented++,
  });
  assert.equal(executions, 1);
  assert.equal(prevented, 1);
});

test('round 8: memo live status changes only when its state or limit text changes', () => {
  let value = '',
    writes = 0,
    limit = '';
  const classes = new Set();
  const status = {
    get textContent() {
      return value;
    },
    set textContent(text) {
      writes++;
      value = text;
    },
    classList: {
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      add: (name) => classes.add(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
    },
  };
  const api = run(['setMemoSaveStatus'], {
    memoSaveStatus: status,
    getMemoLimitStatusText: () => limit,
  });
  for (const mode of ['saving', 'saved', 'error']) {
    api.setMemoSaveStatus(mode);
    const before = writes;
    api.setMemoSaveStatus(mode);
    api.setMemoSaveStatus(mode);
    assert.equal(writes, before, mode);
    assert.equal(classes.has('is-saving'), mode === 'saving');
    assert.equal(classes.has('is-error'), mode === 'error');
  }
  limit = '9000 / 10000';
  api.setMemoSaveStatus('error');
  assert.equal(writes, 4);
  assert.ok(value.includes(limit));
});

function writeStorageApi() {
  return run([
    '_writeManyToStorage',
    '_snapshotStorageEntry',
    '_safeStorageSet',
    '_rollbackStorageWrites',
    '_restoreStorageEntry',
  ]);
}

test('round 9: saving a changed memo does not rewrite unchanged task and settings payloads', () => {
  const values = new Map([
    ['tasks', 'large-task-payload'],
    ['settings', '{}'],
    ['memo', 'old'],
    ['meta', '1'],
  ]);
  const writes = [];
  assert.equal(
    writeStorageApi()._writeManyToStorage({
      storage: {
        getItem: (key) => values.get(key),
        setItem: (key, value) => {
          writes.push(key);
          values.set(key, value);
        },
      },
      entries: [
        ['tasks', 'large-task-payload'],
        ['settings', '{}'],
        ['memo', 'new'],
        ['meta', '2'],
      ],
    }),
    true,
  );
  assert.deepEqual(writes, ['memo', 'meta']);
  assert.equal(values.get('memo'), 'new');
});

test('round 9: duplicate keys retain order and a later failure rolls all changed keys back', () => {
  for (const fail of [false, true]) {
    const values = new Map([
      ['memo', 'original'],
      ['meta', '1'],
    ]);
    const entries = [
      ['memo', 'original'],
      ['memo', 'new'],
      ['memo', 'original'],
      ['memo', 'final'],
      ['meta', '2'],
    ];
    const ok = writeStorageApi()._writeManyToStorage({
      entries,
      storage: {
        getItem: (key) => values.get(key),
        setItem: (key, value) => {
          if (fail && key === 'meta' && value === '2') throw new Error('Quota');
          values.set(key, value);
        },
        removeItem: (key) => values.delete(key),
      },
    });
    assert.equal(ok, !fail);
    assert.equal(values.get('memo'), fail ? 'original' : 'final');
    assert.equal(values.get('meta'), fail ? '1' : '2');
  }
});

test('round 10: holding Enter on focus controls cannot repeatedly toggle or complete work', () => {
  const overlay = {};
  class Element {
    closest() {
      return this;
    }
  }
  const api = run(['handleDocumentShortcuts'], {
    HTMLElement: Element,
    focusOverlay: overlay,
    confirmModalOverlay: {},
    parentModalOverlay: {},
    subtaskModalOverlay: {},
    _getActiveModalOverlay: () => overlay,
  });
  for (const key of ['Enter', ' ']) {
    for (const repeat of [false, true]) {
      let prevented = false;
      api.handleDocumentShortcuts({
        key,
        repeat,
        target: new Element(),
        preventDefault: () => {
          prevented = true;
        },
      });
      assert.equal(prevented, repeat, `${key}: ${repeat}`);
    }
  }
});
