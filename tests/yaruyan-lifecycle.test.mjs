import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();

test('failed unrelated saves preserve running focus metadata when restoring an internal snapshot', () => {
  let restored;
  const api = run(['_restoreStateAfterFailedSave'], {
    _canRestoreFailedSaveSnapshot: () => true,
    _applyAppStateSnapshot(snapshot, options) {
      restored = {
        ...snapshot.focus,
        focusState: options?.preserveRunningFocus
          ? snapshot.focus.focusState
          : 'paused',
      };
    },
    _markAppStateChanged() {},
    render() {},
    showErrorToast() {},
  });
  const focus = { focusState: 'running', startedAt: 1000, elapsedMs: 2000 };
  assert.equal(api._restoreStateAfterFailedSave({ focus }), true);
  assert.deepEqual(restored, focus);
});

test('unrelated save rollback restores the matching pomodoro phase after a timer transition', () => {
  const focusState = {
    type: 'parent',
    parentId: 'p',
    subtaskId: null,
    lastCheckpointAt: 1000,
    pomodoroEnabled: true,
    pomodoroPhase: 'focus',
    pomodoroPhaseEndsAt: 2000,
    pomodoroPhaseRemainingMs: 1000,
    pomodoroFocusMs: 1000,
    pomodoroBreakMs: 1000,
  };
  const api = run(
    [
      '_createAppStateSnapshot',
      '_createFocusRuntimeSnapshot',
      '_restoreStateAfterFailedSave',
      '_applyFocusRuntimeSnapshot',
    ],
    {
      focusState,
      _appStateVersion: 0,
      tasks: [],
      settings: {},
      isSidebarCollapsed: false,
      organizeMemo: '',
      taskViewState: { filter: 'all' },
      _copyTaskSnapshot: structuredClone,
      _canRestoreFailedSaveSnapshot: () => true,
      _applyAppStateSnapshot() {},
      _markAppStateChanged() {},
      render() {},
      showErrorToast() {},
      syncFocusPauseButton() {},
      updateFocusTimer() {},
    },
  );
  const snapshot = api._createAppStateSnapshot();
  focusState.pomodoroPhase = 'break';
  focusState.pomodoroPhaseEndsAt = 3000;
  api._restoreStateAfterFailedSave(snapshot);
  assert.equal(focusState.pomodoroPhase, 'focus');
  assert.equal(focusState.pomodoroPhaseEndsAt, 2000);
});

test('rapid memo checkpoints share the pending write and capture the latest input', async () => {
  let release,
    reads = 0,
    writes = 0,
    memo = '',
    stored;
  const statuses = [];
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const api = run(['persistOrganizeMemoLocalCheckpoint'], {
    _getPersistedStateEntries() {
      reads++;
      return memo;
    },
    async _enqueueStoredStateSave(readEntries) {
      await gate;
      stored = readEntries();
      writes++;
      return true;
    },
    setMemoSaveStatus: (status) => statuses.push(status),
  });
  const pending = [];
  for (let i = 0; i < 100; i++) {
    memo = `memo-${i}`;
    pending.push(api.persistOrganizeMemoLocalCheckpoint());
  }
  release();
  assert.ok((await Promise.all(pending)).every(Boolean));
  assert.equal(stored, 'memo-99');
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  assert.deepEqual(statuses, ['saving']);
  memo = 'next input';
  assert.equal(await api.persistOrganizeMemoLocalCheckpoint(), true);
  assert.equal(stored, memo);
  assert.equal(writes, 2);
});

test('memo checkpoint failures settle without unhandled rejection and permit retry', async () => {
  let attempt = 0;
  const statuses = [];
  const api = run(
    ['persistOrganizeMemoLocalCheckpoint', '_enqueueStoredStateSave'],
    {
      _storedStateSaveQueue: Promise.resolve(),
      STATE_META_KEY: 'meta',
      async _saveLocalStorageCheckpoint() {
        if (++attempt === 1) throw new Error('storage unavailable');
        return true;
      },
      _getPersistedStateEntries: () => [],
      _handlePersistentStorageError() {},
      ORGANIZE_MEMO_KEY: 'memo',
      setMemoSaveStatus: (status) => statuses.push(status),
    },
  );
  assert.equal(await api.persistOrganizeMemoLocalCheckpoint(), false);
  assert.equal(await api.persistOrganizeMemoLocalCheckpoint(), true);
  assert.deepEqual(statuses, ['error', 'saving']);
});

test('the save queue handles synchronous serialization failure and continues with the next save', async () => {
  const errors = [];
  let saves = 0;
  const api = run(['_enqueueStoredStateSave'], {
    _storedStateSaveQueue: Promise.resolve(),
    STATE_META_KEY: 'meta',
    _handlePersistentStorageError: (...args) => errors.push(args),
    async _saveStoredState() {
      saves++;
      return true;
    },
  });
  assert.equal(
    await api._enqueueStoredStateSave(() => {
      throw new Error('serialization failed');
    }),
    false,
  );
  assert.equal(errors.length, 1);
  assert.equal(await api._enqueueStoredStateSave(() => []), true);
  assert.equal(saves, 1);
});

test('unchanged parent editor rows retain their DOM while edits and parent switches refresh it', () => {
  let writes = 0,
    pendingUpdates = 0;
  const list = {
    contains: () => false,
    set innerHTML(value) {
      writes++;
      this.html = value;
    },
    replaceChildren() {
      this.innerHTML = '';
    },
  };
  const api = run(['renderParentModalSubtasks', 'escapeHtml'], {
    document: { activeElement: null },
    modalSubtaskList: list,
    updateParentModalPendingState: () => pendingUpdates++,
    hydrateMaterialIcons() {},
  });
  const parent = {
    id: 'p',
    subtasks: [{ id: 's', text: 'original', done: false }],
  };
  api.renderParentModalSubtasks(parent);
  api.renderParentModalSubtasks(structuredClone(parent));
  assert.equal(writes, 1);
  assert.equal(pendingUpdates, 2);
  parent.subtasks[0].text = 'changed';
  api.renderParentModalSubtasks(parent);
  assert.equal(writes, 2);
  assert.match(list.html, /changed/);
  parent.subtasks[0].done = true;
  api.renderParentModalSubtasks(parent);
  assert.equal(writes, 3);
  parent.id = 'other-parent';
  api.renderParentModalSubtasks(parent);
  assert.equal(writes, 4);
  assert.match(list.html, /other-parent/);
  parent.subtasks = [];
  api.renderParentModalSubtasks(parent);
  api.renderParentModalSubtasks(parent);
  assert.equal(writes, 5);
});
