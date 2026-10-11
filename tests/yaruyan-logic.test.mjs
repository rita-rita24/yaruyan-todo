import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { html, source: extractFunctionSource } = loadAppSource();

function createLogicApi() {
  const names = [
    '_safeStorageGet',
    '_safeStorageSet',
    '_safeStorageRemove',
    '_createCorruptStorageBackupValue',
    '_backupCorruptStorageValue',
    '_snapshotStorageEntry',
    '_restoreStorageEntry',
    '_rollbackStorageWrites',
    '_readJsonFromStorage',
    '_writeManyToStorage',
    '_markAppStateChanged',
    '_commitStateSave',
    '_getDataEntries',
    '_hasPersistedDataChanges',
    '_rememberPersistedDataEntries',
    '_isObjectRecord',
    'normalizeOrganizeMemo',
    'normalizeInputText',
    'normalizeNonNegativeNumber',
    'normalizeEntityId',
    'normalizeMessageList',
    'normalizePomodoroMinutes',
    'normalizePomodoroSettings',
    'createFocusMeta',
    'normalizeFocusMeta',
    'normalizeSettings',
    'normalizeTaskViewState',
    'normalizeBackupPayload',
    'normalizeTasks',
    'hasSubtasks',
    'syncParentStatus',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const TASKS_KEY = 'tasks';
    const SETTINGS_KEY = 'settings';
    const SIDEBAR_KEY = 'sidebar';
    const ORGANIZE_MEMO_KEY = 'memo';
    const TASK_VIEW_KEY = 'task-view';
    const PERSISTED_DATA_KEYS = [TASKS_KEY, SETTINGS_KEY, SIDEBAR_KEY, ORGANIZE_MEMO_KEY, TASK_VIEW_KEY];
    const BACKUP_APP_ID = 'yaruyan-todo';
    const BACKUP_SCHEMA_VERSION = 1;
    const MAX_TASK_TEXT_LENGTH = 120;
    const MAX_SUBTASK_TEXT_LENGTH = 120;
    const MAX_PARENT_TASK_COUNT = 200;
    const MAX_SUBTASK_COUNT_PER_PARENT = 50;
    const MAX_MESSAGE_TEXT_LENGTH = 80;
    const MAX_MESSAGE_COUNT = 30;
    const MAX_ORGANIZE_MEMO_LENGTH = 10000;
    const MAX_BACKUP_FILE_BYTES = 8 * 1024 * 1024;
    const CORRUPT_STORAGE_BACKUP_SUFFIX = '__corrupt';
    const MAX_CORRUPT_STORAGE_BACKUP_CHARS = 64 * 1024;
    const SAFE_ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
    const MIN_POMODORO_MINUTES = 1;
    const MAX_POMODORO_FOCUS_MINUTES = 180;
    const MAX_POMODORO_BREAK_MINUTES = 120;
    const DEFAULT_POMODORO_FOCUS_MINUTES = 25;
    const DEFAULT_POMODORO_BREAK_MINUTES = 5;
    const defaultMessages = ['やるやん！', 'すごい！', 'えらい！'];
    const THEME_IDS = new Set(['theme-1', 'theme-2', 'theme-3']);
    const DEFAULT_THEME_COLOR = 'theme-2';
    const TASK_FILTER_IDS = new Set(['all', 'pending', 'completed']);
    let _persistedDataValuesReady = false;
    const _persistedDataValues = new Map();
    let _appStateVersion = 0;
    let uidCounter = 0;
    let saveResult = true;
    let restored = null;
    function uid() {
      uidCounter += 1;
      return 'uid-' + uidCounter;
    }
    function save() {
      return saveResult;
    }
    function setStateSaveOperationPending() {}
    function _restoreStateAfterFailedSave(snapshot, message) {
      restored = { snapshot, message };
    }
    ${extracted}
    globalThis.__api = {
      MAX_PARENT_TASK_COUNT,
      MAX_SUBTASK_COUNT_PER_PARENT,
      MAX_TASK_TEXT_LENGTH,
      MAX_SUBTASK_TEXT_LENGTH,
      MAX_MESSAGE_TEXT_LENGTH,
      MAX_MESSAGE_COUNT,
      MAX_ORGANIZE_MEMO_LENGTH,
      MAX_BACKUP_FILE_BYTES,
      CORRUPT_STORAGE_BACKUP_SUFFIX,
      MAX_CORRUPT_STORAGE_BACKUP_CHARS,
      createFocusMeta,
      normalizeFocusMeta,
      _readJsonFromStorage,
      _writeManyToStorage,
      _commitStateSave,
      _hasPersistedDataChanges,
      _rememberPersistedDataEntries,
      normalizePomodoroSettings,
      normalizeSettings,
      normalizeBackupPayload,
      normalizeTasks,
      syncParentStatus,
      setSaveResult(value) {
        saveResult = value;
        restored = null;
      },
      getRestored() {
        return restored;
      }
    };
  `;

  const context = { Map, Set, Number, String, Array, Math, RegExp, Error };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createStorageSaveApi(options = {}) {
  const {
    indexedDbAvailable = true,
    failLocalKeys = [],
    indexedResults = [true],
    indexedValues = {},
  } = options;
  const names = [
    '_safeStorageGet',
    '_safeStorageSet',
    '_snapshotStorageEntry',
    '_restoreStorageEntry',
    '_rollbackStorageWrites',
    '_writeManyToStorage',
    '_createStorageWriteId',
    '_normalizeStorageMeta',
    '_normalizeStorageMetaRecord',
    '_createStorageMetaIdentity',
    '_compareStorageMeta',
    '_isEmptyStorageMeta',
    '_isSameStorageMeta',
    '_hasStorageMetaConflictSince',
    '_isVerifiedCheckpointAncestor',
    '_getCurrentStorageMeta',
    '_getStorageMetaFromEntries',
    '_hasCurrentStorageMetaChangedSince',
    '_createStorageMetaRecord',
    '_setCurrentStorageMeta',
    '_getDataEntries',
    '_hasPersistedDataChanges',
    '_rememberPersistedDataEntries',
    '_createNextStorageMeta',
    '_restoreStorageMeta',
    '_readLocalStorageMeta',
    '_isNewerThanPersistedMeta',
    '_readIndexedDbStorageMeta',
    '_hasNewerPersistedStorageState',
    '_saveLocalStorageCheckpoint',
    '_saveStoredState',
    '_enqueueStoredStateSave',
    '_saveLocalStorageForUnload',
    '_getPersistedStateEntries',
    'save',
    'persistOrganizeMemoLocalCheckpoint',
    'persistOrganizeMemoCheckpoint',
    'flushOrganizeMemoSave',
    'persistRuntimeStateForUnload',
    '_mirrorPersistentStorageState',
    '_hasAnySnapshotData',
    '_validatePersistentStateSnapshot',
    '_readLocalStateSnapshot',
    '_createIndexedStateSnapshot',
    '_shouldUseIndexedState',
    '_adoptStorageMeta',
    '_initializePersistentStorageState',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const TASKS_KEY = 'tasks';
    const SETTINGS_KEY = 'settings';
    const SIDEBAR_KEY = 'sidebar';
    const ORGANIZE_MEMO_KEY = 'memo';
    const TASK_VIEW_KEY = 'task-view';
    const STATE_META_KEY = 'meta';
    const PERSISTED_DATA_KEYS = [TASKS_KEY, SETTINGS_KEY, SIDEBAR_KEY, ORGANIZE_MEMO_KEY, TASK_VIEW_KEY];
    const PERSISTED_STATE_KEYS = [...PERSISTED_DATA_KEYS, STATE_META_KEY];
    const STORAGE_TAB_ID = 'test-tab';
    let _persistedStateRevision = 0;
    let _persistedStateUpdatedAt = 0;
    let _persistedStateWriteId = '';
    let _persistedStateWriterId = '';
    let _persistedStateUnloadBase = null;
    let _persistedDataValuesReady = false;
    const _persistedDataValues = new Map();
    let _storedStateSaveQueue = Promise.resolve();
    let _lastIndexedDbWriteError = null;
    function isStateSaveOperationPending() {
      return false;
    }
    function setStateSaveOperationPending() {}
    let tasks = [{ id: 'new-task' }];
    let settings = {};
    let isSidebarCollapsed = false;
    let organizeMemo = 'new-memo';
    let taskViewState = { filter: 'all' };
    let _persistentStorageInitialized = true;
    let organizeMemoComposing = false;
    let organizeMemoSaveTimerId = null;
    let warningVisible = false;
    const localValues = new Map([
      [TASKS_KEY, 'old-tasks'],
      [STATE_META_KEY, JSON.stringify({ version: 1, revision: 0, updatedAt: 0 })]
    ]);
    const failKeys = new Set(globalThis.__config.failLocalKeys);
    const indexedResults = [...globalThis.__config.indexedResults];
    const indexedValues = new Map(Object.entries(globalThis.__config.indexedValues));
    const indexedReadDelays = [...globalThis.__config.indexedReadDelays];
    const indexedReadFailures = [...globalThis.__config.indexedReadFailures];
    const indexedReadResolvers = [];
    const indexedWriteDelays = [...globalThis.__config.indexedWriteDelays];
    const indexedWriteResolvers = [];
    const indexedReads = [];
    const indexedWrites = [];
    const indexedWriteSkips = [];
    const localWrites = [];
    const warnings = [];
    const memoStatuses = [];
    const LOCAL_STORAGE = {
      getItem(key) {
        return localValues.has(key) ? localValues.get(key) : null;
      },
      setItem(key, value) {
        if (failKeys.has('*') || failKeys.has(key)) {
          throw new Error('local quota exceeded');
        }
        const stringValue = String(value);
        localWrites.push([key, stringValue]);
        localValues.set(key, stringValue);
      },
      removeItem(key) {
        localValues.delete(key);
      }
    };
    if (globalThis.__config.indexedDbAvailable) {
      globalThis.indexedDB = {};
    } else {
      globalThis.indexedDB = undefined;
    }
    function _reportStorageError(mode, key, error) {
      warnings.push({ kind: 'report', mode, key, message: error?.message || String(error) });
    }
    function _handlePersistentStorageError(mode, key, error) {
      warningVisible = true;
      warnings.push({ kind: 'persistent', mode, key, message: error?.message || String(error) });
    }
    function _setStorageWarning(visible) {
      warningVisible = !!visible;
      warnings.push({ kind: 'visible', visible: !!visible });
    }
    function _readManyFromIndexedDb(keys) {
      indexedReads.push([...keys]);
      if (indexedReadFailures.shift()) return Promise.reject(new Error('indexedDB read failed'));
      const values = {};
      keys.forEach((key) => {
        values[key] = indexedValues.has(key) ? indexedValues.get(key) : null;
      });
      if (indexedReadDelays.shift()) {
        return new Promise((resolve) => {
          indexedReadResolvers.push(() => resolve(values));
        });
      }
      return Promise.resolve(values);
    }
    function _enqueueIndexedDbWrite(entries, options = {}) {
      const executeWrite = () => {
        const writeEntries = entries.map(([key, value]) => [key, value]);
        const writeMeta = _getStorageMetaFromEntries(writeEntries);
        const currentMeta = _normalizeStorageMeta(indexedValues.get(STATE_META_KEY));
        const hasTargetConflict = writeMeta && _hasStorageMetaConflictSince(currentMeta, writeMeta);
        const hasBaselineConflict = options?.preventBaselineOverwrite !== false
          && writeMeta?.base
          && _hasStorageMetaConflictSince(currentMeta, writeMeta.base);
        if (options?.preventNewerOverwrite !== false && writeMeta && (hasTargetConflict || (hasBaselineConflict
          && !_isVerifiedCheckpointAncestor(currentMeta, options?.checkpointMeta)))) {
          indexedWriteSkips.push(writeEntries);
          if (options?.allowNewerMetaSkip === true) {
            _lastIndexedDbWriteError = null;
            return true;
          }
          _lastIndexedDbWriteError = new Error('indexedDB has newer state; skipped stale write');
          _lastIndexedDbWriteError.code = 'storage-conflict';
          return false;
        }

        indexedWrites.push(writeEntries);
        const result = indexedResults.length > 0 ? indexedResults.shift() : true;
        if (!result) {
          _lastIndexedDbWriteError = new Error('indexedDB write failed');
          return false;
        }
        writeEntries.forEach(([key, value]) => {
          indexedValues.set(key, String(value));
        });
        _lastIndexedDbWriteError = null;
        return true;
      };

      if (indexedWriteDelays.shift()) {
        return new Promise((resolve) => {
          indexedWriteResolvers.push(() => resolve(executeWrite()));
        });
      }
      return Promise.resolve(executeWrite());
    }
    function setMemoSaveStatus(mode) {
      memoStatuses.push(mode);
    }
    function syncRunningFocusElapsedForPersist() {
      return false;
    }
    function _applyPersistentStateRawValues(values) {
      tasks = JSON.parse(values[TASKS_KEY]);
      settings = JSON.parse(values[SETTINGS_KEY]);
      isSidebarCollapsed = values[SIDEBAR_KEY] === 'true';
      organizeMemo = values[ORGANIZE_MEMO_KEY];
      taskViewState = JSON.parse(values[TASK_VIEW_KEY]);
    }
    ${extracted}
    globalThis.__api = {
      TASKS_KEY,
      SETTINGS_KEY,
      SIDEBAR_KEY,
      ORGANIZE_MEMO_KEY,
      TASK_VIEW_KEY,
      STATE_META_KEY,
      _saveStoredState,
      save,
      persistOrganizeMemoLocalCheckpoint,
      _rememberPersistedDataEntries,
      _hasPersistedDataChanges,
      persistRuntimeStateForUnload,
      setStorageInitialized(value) {
        _persistentStorageInitialized = value;
      },
      setRuntimeState(nextState) {
        if ('tasks' in nextState) tasks = nextState.tasks;
        if ('settings' in nextState) settings = nextState.settings;
        if ('isSidebarCollapsed' in nextState) isSidebarCollapsed = nextState.isSidebarCollapsed;
        if ('organizeMemo' in nextState) organizeMemo = nextState.organizeMemo;
        if ('taskViewState' in nextState) taskViewState = nextState.taskViewState;
      },
      getIndexedReads() {
        return indexedReads;
      },
      releaseIndexedRead() {
        const resolve = indexedReadResolvers.shift();
        if (resolve) resolve();
      },
      getIndexedWrites() {
        return indexedWrites;
      },
      getIndexedWriteSkips() {
        return indexedWriteSkips;
      },
      releaseIndexedWrite() {
        const resolve = indexedWriteResolvers.shift();
        if (resolve) resolve();
      },
      getLocalWrites() {
        return localWrites;
      },
      getMemoStatuses() {
        return memoStatuses;
      },
      getLocalValue(key) {
        return localValues.get(key);
      },
      setLocalValue(key, value) {
        localValues.set(key, String(value));
      },
      getIndexedValue(key) {
        return indexedValues.get(key);
      },
      setIndexedValue(key, value) {
        indexedValues.set(key, String(value));
      },
      getWarnings() {
        return warnings;
      },
      isWarningVisible() {
        return warningVisible;
      },
      getMeta() {
        return {
          revision: _persistedStateRevision,
          updatedAt: _persistedStateUpdatedAt,
          writeId: _persistedStateWriteId
        };
      },
      _mirrorPersistentStorageState,
      async initialize() {
        _setCurrentStorageMeta(_readLocalStorageMeta());
        await _initializePersistentStorageState();
        _rememberPersistedDataEntries(_getPersistedStateEntries());
      },
      getRuntimeEntries() { return _getPersistedStateEntries(); },
      async flushAsyncStorage() {
        for (let index = 0; index < 8; index += 1) {
          await Promise.resolve();
        }
      }
    };
  `;

  const context = {
    Map,
    Set,
    Number,
    String,
    Array,
    Math,
    Error,
    JSON,
    Promise,
    Date,
    __config: {
      indexedDbAvailable,
      failLocalKeys,
      indexedResults,
      indexedValues,
      indexedReadDelays: options.indexedReadDelays || [],
      indexedReadFailures: options.indexedReadFailures || [],
      indexedWriteDelays: options.indexedWriteDelays || [],
    },
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createPomodoroApi() {
  const names = [
    'getElapsedMs',
    'isPomodoroEnabledForSession',
    'getPomodoroPhaseDurationMs',
    'getPomodoroPhaseRemainingMs',
    'syncPomodoroPhaseProgress',
    'syncActivePomodoroPhaseProgress',
    'syncRunningFocusElapsedForPersist',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const focusState = {
      type: 'parent',
      parentId: 'parent',
      subtaskId: null,
      pomodoroEnabled: true,
      pomodoroPhase: 'focus',
      pomodoroPhaseEndsAt: 1000,
      pomodoroPhaseRemainingMs: 1000,
      pomodoroFocusMs: 1000,
      pomodoroBreakMs: 1000
    };
    const tasks = [];
    function getActiveFocusTarget() {
      return tasks[0] || null;
    }
    ${extracted}
    globalThis.__api = {
      focusState,
      setActiveTask(task) {
        tasks.length = 0;
        tasks.push(task);
      },
      syncRunningFocusElapsedForPersist,
      syncPomodoroPhaseProgress
    };
  `;

  const context = { Date, Math, Number };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

test('same-generation IndexedDB conflicts cannot hide behind a later local timestamp', async () => {
  for (const localCheckpoint of [false, true]) {
    const api = createStorageSaveApi();
    assert.equal(await api.save(), true);
    const originalLocalTasks = api.getLocalValue(api.TASKS_KEY);
    const originalMeta = api.getMeta();
    api.setIndexedValue(api.TASKS_KEY, 'concurrent indexed-only tasks');
    api.setIndexedValue(
      api.STATE_META_KEY,
      JSON.stringify({
        ...originalMeta,
        updatedAt: originalMeta.updatedAt - 1000,
        writeId: 'other-writer',
      }),
    );
    api.setRuntimeState({
      tasks: [{ id: 'stale-followup' }],
      organizeMemo: 'stale followup',
    });
    const saved = localCheckpoint
      ? await api.persistOrganizeMemoLocalCheckpoint()
      : await api.save();
    assert.equal(saved, false);
    assert.equal(api.getLocalValue(api.TASKS_KEY), originalLocalTasks);
    assert.equal(
      api.getIndexedValue(api.TASKS_KEY),
      'concurrent indexed-only tasks',
    );
    assert.equal(api.getMeta().revision, originalMeta.revision);
  }
});

function createFocusRollbackApi() {
  const names = [
    '_copyTaskSnapshot',
    '_markAppStateChanged',
    '_canRestoreFailedSaveSnapshot',
    '_showSkippedRollbackToast',
    'normalizeOrganizeMemo',
    'normalizeInputText',
    'normalizeNonNegativeNumber',
    'normalizeEntityId',
    'normalizeMessageList',
    'normalizePomodoroMinutes',
    'normalizePomodoroSettings',
    'createFocusMeta',
    'normalizeFocusMeta',
    'normalizeSettings',
    'normalizeTaskViewState',
    'normalizeTasks',
    '_createAppStateSnapshot',
    '_applyAppStateSnapshot',
    '_createFocusRuntimeSnapshot',
    '_applyFocusRuntimeSnapshot',
    '_restoreFocusStateAfterFailedSave',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const MAX_ORGANIZE_MEMO_LENGTH = 10000;
    const MAX_TASK_TEXT_LENGTH = 120;
    const MAX_SUBTASK_TEXT_LENGTH = 120;
    const MAX_PARENT_TASK_COUNT = 200;
    const MAX_SUBTASK_COUNT_PER_PARENT = 50;
    const MAX_MESSAGE_TEXT_LENGTH = 80;
    const MAX_MESSAGE_COUNT = 30;
    const SAFE_ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
    const MIN_POMODORO_MINUTES = 1;
    const MAX_POMODORO_FOCUS_MINUTES = 180;
    const MAX_POMODORO_BREAK_MINUTES = 120;
    const DEFAULT_POMODORO_FOCUS_MINUTES = 25;
    const DEFAULT_POMODORO_BREAK_MINUTES = 5;
    const defaultMessages = ['やるやん！'];
    const THEME_IDS = new Set(['theme-1', 'theme-2', 'theme-3']);
    const DEFAULT_THEME_COLOR = 'theme-2';
    const TASK_FILTER_IDS = new Set(['all', 'pending', 'completed']);
    let _appStateVersion = 0;
    let uidCounter = 0;
    let tasks = [{
      id: 'parent',
      text: 'Parent',
      done: false,
      focus: { focusState: 'running', elapsedMs: 500, startedAt: 1000 },
      subtasks: []
    }];
    let settings = {};
    let isSidebarCollapsed = false;
    let organizeMemo = '';
    const taskViewState = { filter: 'all' };
    const focusState = {
      type: 'parent',
      parentId: 'parent',
      subtaskId: null,
      lastCheckpointAt: 1000,
      pomodoroEnabled: true,
      pomodoroPhase: 'focus',
      pomodoroPhaseEndsAt: 2000,
      pomodoroPhaseRemainingMs: 1000,
      pomodoroFocusMs: 1500,
      pomodoroBreakMs: 500
    };
    const errors = [];
    function uid() {
      uidCounter += 1;
      return 'uid-' + uidCounter;
    }
    function applySidebarState() {}
    function setMemoSaveStatus() {}
    function syncPomodoroSettingsControls() {}
    function syncFocusPauseButton() {}
    function updateFocusTimer() {}
    function render() {}
    function showErrorToast(message) {
      errors.push(message);
    }
    const organizeMemoInput = null;
    ${extracted}
    globalThis.__api = {
      focusState,
      _createAppStateSnapshot,
      _createFocusRuntimeSnapshot,
      _restoreFocusStateAfterFailedSave,
      mutateAfterSnapshot() {
        tasks[0].focus.focusState = 'paused';
        tasks[0].focus.startedAt = null;
        focusState.type = null;
        focusState.parentId = null;
        focusState.lastCheckpointAt = 0;
      },
      getTaskFocus() {
        return tasks[0].focus;
      },
      getErrors() {
        return errors;
      }
    };
  `;

  const context = {
    structuredClone,
    JSON,
    Map,
    Set,
    Number,
    String,
    Array,
    Math,
    RegExp,
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createClearCompletedApi(filter = 'all') {
  const names = [
    'normalizeTaskSearchText',
    'isTaskSearchActive',
    '_copyTaskSnapshot',
    '_markAppStateChanged',
    '_commitStateSave',
    'hasSubtasks',
    'matchesTaskFilter',
    'shouldClearCompletedItem',
    'getClearCompletedDeleteCounts',
    'formatBulkDeleteCountText',
    'getClearCompletedScopeText',
    'buildClearCompletedConfirmMessage',
    '_isValidDeleteUndoPayload',
    '_createClearCompletedUndoPayload',
    'performClearCompleted',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    let taskSearchQuery = '';
    let tasks = [
      { id: 'pending-leaf', text: 'Pending leaf', done: false, focus: {}, subtasks: [] },
      { id: 'done-leaf', text: 'Done leaf', done: true, focus: {}, subtasks: [] },
      {
        id: 'mixed-parent',
        text: 'Mixed parent',
        done: false,
        focus: {},
        subtasks: [
          { id: 'done-sub', text: 'Done sub', done: true, focus: {} },
          { id: 'pending-sub', text: 'Pending sub', done: false, focus: {} }
        ]
      },
      {
        id: 'done-parent',
        text: 'Done parent',
        done: true,
        focus: {},
        subtasks: [
          { id: 'done-sub-a', text: 'Done sub A', done: true, focus: {} },
          { id: 'done-sub-b', text: 'Done sub B', done: true, focus: {} }
        ]
      }
    ];
    const taskViewState = { filter: globalThis.__filter };
    let _appStateVersion = 0;
    let undoToast = null;
    let stateSavePending = false;
    function isStateSaveOperationPending() {
      return stateSavePending;
    }
    function setStateSaveOperationPending() {}
    function _createAppStateSnapshot() {
      return { tasks: _copyTaskSnapshot(tasks), taskView: _copyTaskSnapshot(taskViewState) };
    }
    function _restoreStateAfterFailedSave(snapshot) {
      tasks = _copyTaskSnapshot(snapshot.tasks);
      taskViewState.filter = snapshot.taskView.filter;
    }
    function save() {
      return true;
    }
    function playDeleteSound() {}
    function render() {}
    function _registerDeleteUndoToast(message, payload) {
      undoToast = { message, payload };
    }
    ${extracted}
    globalThis.__api = {
      getClearCompletedDeleteCounts,
      buildClearCompletedConfirmMessage,
      _createClearCompletedUndoPayload,
      performClearCompleted,
      getTasks() {
        return _copyTaskSnapshot(tasks);
      },
      getUndoToast() {
        return undoToast;
      },
      setStateSavePending(value) {
        stateSavePending = !!value;
      }
    };
  `;

  const context = { structuredClone, JSON, __filter: filter };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createDeleteUndoApi(initialTasks) {
  const names = [
    '_copyTaskSnapshot',
    '_isValidDeleteUndoPayload',
    '_createDeleteUndoRestorePlan',
    '_applyDeleteUndoPayload',
    'createFocusMeta',
    'normalizeNonNegativeNumber',
    'syncParentStatus',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const MAX_PARENT_TASK_COUNT = 200;
    const MAX_SUBTASK_COUNT_PER_PARENT = 50;
    let tasks = globalThis.__initialTasks;
    const errors = [];
    function getActiveFocusTarget() { return null; }
    function getTask(parentId) {
      return tasks.find(task => task.id === parentId) || null;
    }
    function showErrorToast(message) {
      errors.push(message);
    }
    ${extracted}
    globalThis.__api = {
      MAX_PARENT_TASK_COUNT,
      MAX_SUBTASK_COUNT_PER_PARENT,
      _applyDeleteUndoPayload,
      getTasks() {
        return _copyTaskSnapshot(tasks);
      },
      getErrors() {
        return [...errors];
      }
    };
  `;

  const context = {
    structuredClone,
    JSON,
    Set,
    Map,
    Number,
    Array,
    __initialTasks: structuredClone(initialTasks),
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createCommitRollbackApi() {
  const names = [
    '_markAppStateChanged',
    '_canRestoreFailedSaveSnapshot',
    '_showSkippedRollbackToast',
    '_restoreStateAfterFailedSave',
    '_commitStateSave',
    'normalizeOrganizeMemo',
    'handleOrganizeMemoInput',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const MAX_ORGANIZE_MEMO_LENGTH = 10000;
    let _appStateVersion = 0;
    let tasks = [{ id: 'base' }, { id: 'first-change' }];
    let organizeMemo = '';
    let _persistentStorageInitialized = true;
    let organizeMemoComposing = false;
    let _organizeMemoEditedBeforeStorageInit = false;
    const organizeMemoInput = { value: '' };
    let pendingSaveResolve = null;
    let stateSavePendingCount = 0;
    const stateSaveTransitions = [];
    const errors = [];
    const memoCheckpoints = [];
    const memoSchedules = [];
    const memoStatuses = [];
    function save() {
      return new Promise((resolve) => {
        pendingSaveResolve = resolve;
      });
    }
    function setStateSaveOperationPending(isPending) {
      stateSavePendingCount = Math.max(0, stateSavePendingCount + (isPending ? 1 : -1));
      stateSaveTransitions.push(stateSavePendingCount > 0);
    }
    function _applyAppStateSnapshot(snapshot) {
      tasks = structuredClone(snapshot.tasks);
    }
    function render() {}
    function showErrorToast(message) {
      errors.push(message);
    }
    function persistOrganizeMemoLocalCheckpoint() {
      memoCheckpoints.push(organizeMemo);
      return Promise.resolve(true);
    }
    function scheduleOrganizeMemoSave() {
      memoSchedules.push(organizeMemo);
    }
    function setMemoSaveStatus(mode) {
      memoStatuses.push(mode);
    }
    ${extracted}
    globalThis.__api = {
      _commitStateSave,
      resolveSave(value) {
        pendingSaveResolve(value);
      },
      mutateAfterCommitStarted() {
        tasks.push({ id: 'later-change' });
        _markAppStateChanged();
      },
      editMemoAfterCommitStarted(value) {
        organizeMemoInput.value = value;
        handleOrganizeMemoInput();
      },
      getTasks() {
        return structuredClone(tasks);
      },
      getMemo() {
        return organizeMemo;
      },
      getMemoCheckpoints() {
        return [...memoCheckpoints];
      },
      getMemoSchedules() {
        return [...memoSchedules];
      },
      getMemoStatuses() {
        return [...memoStatuses];
      },
      getErrors() {
        return [...errors];
      },
      isStateSavePending() {
        return stateSavePendingCount > 0;
      },
      getStateSaveTransitions() {
        return [...stateSaveTransitions];
      }
    };
  `;

  const context = { structuredClone, Promise, Number, String };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createMemoInitApi() {
  const names = [
    '_markAppStateChanged',
    'normalizeOrganizeMemo',
    'handleOrganizeMemoInput',
    'finishPersistentStorageInitialization',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const MAX_ORGANIZE_MEMO_LENGTH = 10000;
    let _appStateVersion = 0;
    let organizeMemo = 'local memo';
    let _persistentStorageInitialized = false;
    let organizeMemoComposing = false;
    let _organizeMemoEditedBeforeStorageInit = false;
    const organizeMemoInput = {
      value: 'local memo',
      readOnly: true,
      ariaBusy: 'true',
      removeAttribute(name) {
        if (name === 'aria-busy') this.ariaBusy = null;
      }
    };
    const memoCheckpoints = [];
    const memoSchedules = [];
    const memoStatuses = [];
    const preInitWrites = [];
    function _getPersistedStateEntries() {
      return [['memo', organizeMemo]];
    }
    function _saveLocalStorageForUnload(entries) {
      preInitWrites.push(entries.map(([key, value]) => [key, value]));
      return { ok: true, wrote: true };
    }
    function persistOrganizeMemoLocalCheckpoint() {
      memoCheckpoints.push(organizeMemo);
      return Promise.resolve(true);
    }
    function scheduleOrganizeMemoSave() {
      memoSchedules.push(organizeMemo);
    }
    function setMemoSaveStatus(mode) {
      memoStatuses.push(mode);
    }
    ${extracted}
    globalThis.__api = {
      handleOrganizeMemoInput,
      finishPersistentStorageInitialization,
      simulatePersistedMemo(value) {
        organizeMemo = value;
      },
      setInputValue(value) {
        organizeMemoInput.value = value;
      },
      getInputValue() {
        return organizeMemoInput.value;
      },
      getInputState() {
        return { readOnly: organizeMemoInput.readOnly, ariaBusy: organizeMemoInput.ariaBusy };
      },
      getMemo() {
        return organizeMemo;
      },
      getVersion() {
        return _appStateVersion;
      },
      getMemoCheckpoints() {
        return [...memoCheckpoints];
      },
      getMemoSchedules() {
        return [...memoSchedules];
      },
      getMemoStatuses() {
        return [...memoStatuses];
      },
      getPreInitWrites() {
        return preInitWrites.map(entries => entries.map(([key, value]) => [key, value]));
      }
    };
  `;

  const context = { Promise, Number, String };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createAddOperationApi() {
  const names = [
    'resetTaskSearch',
    'normalizeInputText',
    'normalizeMessageList',
    'setInputActionPending',
    'setActionControlPending',
    'setAddOperationPending',
    'isAddOperationPending',
    'isMessageOperationPending',
    'updateMessageListPendingState',
    'setMessageOperationPending',
    'isEditOperationPending',
    'getMessages',
    'addTask',
    'addSubtaskFromModal',
    'saveMessage',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    let taskSearchQuery = '';
    const taskSearchInput = { value: '' };
    const taskViewState = { filter: 'all' };
    const MAX_TASK_TEXT_LENGTH = 120;
    const MAX_SUBTASK_TEXT_LENGTH = 120;
    const MAX_PARENT_TASK_COUNT = 200;
    const MAX_SUBTASK_COUNT_PER_PARENT = 50;
    const MAX_MESSAGE_TEXT_LENGTH = 80;
    const MAX_MESSAGE_COUNT = 30;
    const defaultMessages = ['default'];
    const messageOperationState = { pending: false };
    const document = { activeElement: null, body: null };
    const addOperationState = {
      task: false,
      subtask: false,
      message: false
    };
    const editOperationState = {
      parent: false,
      subtask: false
    };
    let uidCounter = 0;
    let tasks = [{
      id: 'parent',
      text: 'Parent',
      done: false,
      focus: createFocusMeta(),
      subtasks: []
    }];
    let settings = { messages: [] };
    const modalState = { parentId: 'parent' };
    const saveResolvers = [];
    const errors = [];
    const sounds = [];
    const renders = [];
    const messageRenders = [];
    const modalRenders = [];
    function isStateSaveOperationPending() {
      return false;
    }

    function createControl(value = '') {
      return {
        value,
        disabled: false,
        attrs: {},
        focused: 0,
        focus() {
          this.focused += 1;
        },
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        }
      };
    }

    const taskInput = createControl();
    const addBtn = createControl();
    const modalSubtaskInput = createControl();
    const modalAddSubtaskBtn = createControl();
    const messageInput = createControl();
    const messageSaveBtn = createControl();
    const messageList = {};

    function qsa() {
      return [];
    }

    function uid() {
      uidCounter += 1;
      return 'uid-' + uidCounter;
    }
    function createFocusMeta() {
      return { focusState: 'idle', elapsedMs: 0, startedAt: null };
    }
    function hasSubtasks(task) {
      return Array.isArray(task.subtasks) && task.subtasks.length > 0;
    }
    function syncParentStatus(task) {
      if (!hasSubtasks(task)) return task.done;
      task.done = task.subtasks.every(sub => sub.done);
      return task.done;
    }
    function getTask(id) {
      return tasks.find(task => task.id === id) || null;
    }
    function _createAppStateSnapshot() {
      return {
        tasks: structuredClone(tasks),
        settings: structuredClone(settings)
      };
    }
    function _commitStateSave(previousState) {
      return new Promise((resolve) => {
        saveResolvers.push((value) => {
          const ok = !!value;
          if (!ok) {
            tasks = structuredClone(previousState.tasks);
            settings = structuredClone(previousState.settings);
          }
          resolve(ok);
        });
      });
    }
    function showErrorToast(message) {
      errors.push(message);
    }
    function playAddSound() {
      sounds.push('add');
    }
    function render() {
      renders.push(structuredClone(tasks));
    }
    function renderMessages() {
      messageRenders.push(structuredClone(settings.messages));
    }
    function renderParentModalSubtasks(parent) {
      modalRenders.push(parent.subtasks.map(sub => sub.id));
    }

    ${extracted}
    globalThis.__api = {
      addTask,
      addSubtaskFromModal,
      saveMessage,
      resolveNextSave(value) {
        const resolve = saveResolvers.shift();
        if (!resolve) throw new Error('no pending save');
        resolve(value);
      },
      getPendingSaveCount() {
        return saveResolvers.length;
      },
      setTaskInput(value) {
        taskInput.value = value;
      },
      setSubtaskInput(value) {
        modalSubtaskInput.value = value;
      },
      setMessageInput(value) {
        messageInput.value = value;
      },
      getControls() {
        return {
          taskInput: { value: taskInput.value, disabled: taskInput.disabled },
          addBtn: { disabled: addBtn.disabled, ariaDisabled: addBtn.attrs['aria-disabled'] },
          modalSubtaskInput: { value: modalSubtaskInput.value, disabled: modalSubtaskInput.disabled },
          modalAddSubtaskBtn: { disabled: modalAddSubtaskBtn.disabled, ariaDisabled: modalAddSubtaskBtn.attrs['aria-disabled'] },
          messageInput: { value: messageInput.value, disabled: messageInput.disabled },
          messageSaveBtn: { disabled: messageSaveBtn.disabled, ariaDisabled: messageSaveBtn.attrs['aria-disabled'] }
        };
      },
      getTasks() {
        return structuredClone(tasks);
      },
      getMessages() {
        return structuredClone(settings.messages);
      },
      getErrors() {
        return [...errors];
      },
      getSounds() {
        return [...sounds];
      },
      getRenders() {
        return structuredClone(renders);
      },
      getMessageRenders() {
        return structuredClone(messageRenders);
      },
      getModalRenders() {
        return structuredClone(modalRenders);
      }
    };
  `;

  const context = {
    structuredClone,
    Promise,
    Number,
    String,
    Array,
    Object,
    Error,
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createMessageOperationApi(initialMessages = ['A', 'B', 'C']) {
  const names = [
    'normalizeInputText',
    'normalizeMessageList',
    'setInputActionPending',
    'setActionControlPending',
    'setAddOperationPending',
    'isAddOperationPending',
    'isMessageOperationPending',
    'updateMessageListPendingState',
    'setMessageOperationPending',
    'getMessages',
    'editMessage',
    'saveEditedMessage',
    'deleteMessage',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const MAX_MESSAGE_TEXT_LENGTH = 80;
    const MAX_MESSAGE_COUNT = 30;
    const defaultMessages = ['default'];
    const messageOperationState = { pending: false };
    const document = { activeElement: null, body: null };
    const addOperationState = {
      task: false,
      subtask: false,
      message: false
    };
    let settings = { messages: structuredClone(globalThis.__initialMessages) };
    const messageEditorState = { editIndex: null };
    const saveResolvers = [];
    const errors = [];
    const messageRenders = [];
    const messageEditInputs = new Map();
    function isStateSaveOperationPending() {
      return false;
    }

    function createControl(value = '', classes = []) {
      return {
        value,
        disabled: false,
        attrs: {},
        focused: 0,
        selected: 0,
        classList: {
          contains(name) {
            return classes.includes(name);
          }
        },
        focus() {
          this.focused += 1;
        },
        select() {
          this.selected += 1;
        },
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        }
      };
    }

    const messageInput = createControl();
    const messageSaveBtn = createControl('', ['message-save-btn']);
    const editMessageBtn = createControl('', ['edit-message-btn']);
    const saveMessageEditBtn = createControl('', ['save-message-edit-btn']);
    const deleteMessageBtn = createControl('', ['delete-message-btn']);
    const messageList = {};
    const taskInput = createControl();
    const addBtn = createControl();
    const modalSubtaskInput = createControl();
    const modalAddSubtaskBtn = createControl();

    function syncEditInputs() {
      messageEditInputs.clear();
      settings.messages.forEach((message, index) => {
        messageEditInputs.set(index, createControl(message, ['message-edit-input']));
      });
    }
    syncEditInputs();

    function qs(selector, root = null) {
      if (root !== messageList) return null;
      const match = String(selector).match(/data-index="(\\d+)"/);
      if (!match) return null;
      return messageEditInputs.get(Number(match[1])) || null;
    }

    function qsa(selector, root = null) {
      if (root !== messageList) return [];
      if (selector === '.edit-message-btn, .save-message-edit-btn') {
        return [editMessageBtn, saveMessageEditBtn];
      }
      if (selector === '.delete-message-btn') return [deleteMessageBtn];
      if (selector === '.message-edit-input') return [...messageEditInputs.values()];
      return [];
    }

    function _createAppStateSnapshot() {
      return { settings: structuredClone(settings) };
    }
    function _commitStateSave(previousState) {
      return new Promise((resolve) => {
        saveResolvers.push((value) => {
          const ok = !!value;
          if (!ok) settings = structuredClone(previousState.settings);
          resolve(ok);
        });
      });
    }
    function showErrorToast(message) {
      errors.push(message);
    }
    function renderMessages() {
      messageRenders.push({
        messages: structuredClone(settings.messages),
        editIndex: messageEditorState.editIndex
      });
      syncEditInputs();
      updateMessageListPendingState();
    }

    ${extracted}
    globalThis.__api = {
      editMessage,
      saveEditedMessage,
      deleteMessage,
      resolveNextSave(value) {
        const resolve = saveResolvers.shift();
        if (!resolve) throw new Error('no pending save');
        resolve(value);
      },
      getPendingSaveCount() {
        return saveResolvers.length;
      },
      getMessages() {
        return structuredClone(settings.messages);
      },
      getMessageEditIndex() {
        return messageEditorState.editIndex;
      },
      setEditInput(index, value) {
        const input = messageEditInputs.get(index);
        if (!input) throw new Error('edit input not found');
        input.value = value;
      },
      getEditInput(index) {
        const input = messageEditInputs.get(index);
        return input ? {
          value: input.value,
          disabled: input.disabled,
          focused: input.focused,
          selected: input.selected
        } : null;
      },
      getControls() {
        return {
          messageInput: { disabled: messageInput.disabled },
          messageSaveBtn: { disabled: messageSaveBtn.disabled, ariaDisabled: messageSaveBtn.attrs['aria-disabled'] },
          editMessageBtn: { disabled: editMessageBtn.disabled, ariaDisabled: editMessageBtn.attrs['aria-disabled'] },
          saveMessageEditBtn: { disabled: saveMessageEditBtn.disabled, ariaDisabled: saveMessageEditBtn.attrs['aria-disabled'] },
          deleteMessageBtn: { disabled: deleteMessageBtn.disabled, ariaDisabled: deleteMessageBtn.attrs['aria-disabled'] }
        };
      },
      getRenders() {
        return structuredClone(messageRenders);
      },
      getErrors() {
        return [...errors];
      }
    };
  `;

  const context = {
    structuredClone,
    Promise,
    Number,
    String,
    Array,
    Object,
    Error,
    __initialMessages: structuredClone(initialMessages),
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createEditOperationApi() {
  const names = [
    'normalizeInputText',
    'setInputActionPending',
    'setActionControlPending',
    'isAddOperationPending',
    'isEditOperationPending',
    'updateParentModalPendingState',
    'updateSubtaskModalPendingState',
    'setEditOperationPending',
    'closeParentModal',
    'saveParentEdit',
    'closeSubtaskModal',
    'saveSubtaskEdit',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const document = { activeElement: null, body: null };
    const MAX_TASK_TEXT_LENGTH = 120;
    const MAX_SUBTASK_TEXT_LENGTH = 120;
    const addOperationState = {
      task: false,
      subtask: false,
      message: false
    };
    const editOperationState = {
      parent: false,
      subtask: false
    };
    let tasks = [{
      id: 'parent',
      text: 'Parent',
      done: false,
      focus: {},
      subtasks: [{
        id: 'sub',
        text: 'Subtask',
        done: false,
        focus: {}
      }]
    }];
    const modalState = {
      parentId: 'parent',
      subtaskParentId: 'parent',
      subtaskId: 'sub'
    };
    const saveResolvers = [];
    const errors = [];
    const renders = [];
    const modalRenders = [];
    const closedOverlays = [];
    function isStateSaveOperationPending() {
      return false;
    }

    function createControl(value = '', classes = []) {
      return {
        value,
        disabled: false,
        draggable: true,
        attrs: {},
        focused: 0,
        classList: {
          contains(name) {
            return classes.includes(name);
          }
        },
        focus() {
          this.focused += 1;
        },
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        }
      };
    }

    const parentEditInput = createControl('Parent edited');
    const saveParentEditBtn = createControl();
    const closeParentModalBtn = createControl();
    const modalSubtaskInput = createControl();
    const modalAddSubtaskBtn = createControl();
    const subtaskEditInput = createControl('Subtask edited');
    const saveSubtaskEditBtn = createControl();
    const closeSubtaskModalBtn = createControl();
    const modalEditSubtaskBtn = createControl('', ['modal-edit-subtask-btn']);
    const modalDeleteSubtaskBtn = createControl('', ['modal-delete-subtask-btn']);
    const modalDragHandle = createControl('', ['modal-subtask-drag-handle']);
    const modalSubtaskList = {};
    const parentModalOverlay = { name: 'parent' };
    const subtaskModalOverlay = { name: 'subtask' };

    function qsa(selector, root = null) {
      if (root !== modalSubtaskList) return [];
      if (selector === '.modal-edit-subtask-btn, .modal-delete-subtask-btn, .modal-subtask-drag-handle') {
        return [modalEditSubtaskBtn, modalDeleteSubtaskBtn, modalDragHandle];
      }
      return [];
    }
    function resetModalSubtaskDragState() {}
    function _closeModalOverlay(overlay) {
      closedOverlays.push(overlay?.name || 'unknown');
    }
    function getTask(id) {
      return tasks.find(task => task.id === id) || null;
    }
    function getSubtask(parentId, subId) {
      const parent = getTask(parentId);
      return parent?.subtasks.find(sub => sub.id === subId) || null;
    }
    function _createAppStateSnapshot() {
      return { tasks: structuredClone(tasks) };
    }
    function _commitStateSave(previousState) {
      return new Promise((resolve) => {
        saveResolvers.push((value) => {
          const ok = !!value;
          if (!ok) tasks = structuredClone(previousState.tasks);
          resolve(ok);
        });
      });
    }
    function showErrorToast(message) {
      errors.push(message);
    }
    function render() {
      renders.push(structuredClone(tasks));
    }
    function renderParentModalSubtasks(parent) {
      modalRenders.push(parent.subtasks.map(sub => sub.text));
    }

    ${extracted}
    globalThis.__api = {
      saveParentEdit,
      closeParentModal,
      saveSubtaskEdit,
      closeSubtaskModal,
      resolveNextSave(value) {
        const resolve = saveResolvers.shift();
        if (!resolve) throw new Error('no pending save');
        resolve(value);
      },
      getPendingSaveCount() {
        return saveResolvers.length;
      },
      getTasks() {
        return structuredClone(tasks);
      },
      getModalState() {
        return { ...modalState };
      },
      getControls() {
        return {
          parentEditInput: { value: parentEditInput.value, disabled: parentEditInput.disabled },
          saveParentEditBtn: { disabled: saveParentEditBtn.disabled, ariaDisabled: saveParentEditBtn.attrs['aria-disabled'] },
          closeParentModalBtn: { disabled: closeParentModalBtn.disabled, ariaDisabled: closeParentModalBtn.attrs['aria-disabled'] },
          modalSubtaskInput: { disabled: modalSubtaskInput.disabled },
          modalAddSubtaskBtn: { disabled: modalAddSubtaskBtn.disabled, ariaDisabled: modalAddSubtaskBtn.attrs['aria-disabled'] },
          modalEditSubtaskBtn: { disabled: modalEditSubtaskBtn.disabled, ariaDisabled: modalEditSubtaskBtn.attrs['aria-disabled'] },
          modalDeleteSubtaskBtn: { disabled: modalDeleteSubtaskBtn.disabled, ariaDisabled: modalDeleteSubtaskBtn.attrs['aria-disabled'] },
          modalDragHandle: { disabled: modalDragHandle.disabled, ariaDisabled: modalDragHandle.attrs['aria-disabled'], draggable: modalDragHandle.draggable },
          subtaskEditInput: { value: subtaskEditInput.value, disabled: subtaskEditInput.disabled },
          saveSubtaskEditBtn: { disabled: saveSubtaskEditBtn.disabled, ariaDisabled: saveSubtaskEditBtn.attrs['aria-disabled'] },
          closeSubtaskModalBtn: { disabled: closeSubtaskModalBtn.disabled, ariaDisabled: closeSubtaskModalBtn.attrs['aria-disabled'] }
        };
      },
      getClosedOverlays() {
        return [...closedOverlays];
      },
      getRenders() {
        return structuredClone(renders);
      },
      getModalRenders() {
        return structuredClone(modalRenders);
      },
      getErrors() {
        return [...errors];
      }
    };
  `;

  const context = {
    structuredClone,
    Promise,
    Number,
    String,
    Array,
    Object,
    Error,
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createFocusOperationApi() {
  const names = [
    'setActionControlPending',
    'isFocusOperationPending',
    'setFocusStartControlPending',
    'setFocusOperationPending',
    'openFocusModal',
    'pauseOrResumeFocus',
    'performAbortFocus',
    'abortFocus',
    'completeFocus',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    let nowMs = 1000;
    const Date = {
      now() {
        return nowMs;
      }
    };
    const focusOperationState = { pending: false };
    let tasks = [
      {
        id: 'a',
        text: 'A',
        done: false,
        focus: { focusState: 'idle', elapsedMs: 0, startedAt: null },
        subtasks: []
      },
      {
        id: 'b',
        text: 'B',
        done: false,
        focus: { focusState: 'idle', elapsedMs: 0, startedAt: null },
        subtasks: []
      }
    ];
    const focusState = {
      type: null,
      parentId: null,
      subtaskId: null,
      tickerId: null,
      lastCheckpointAt: 0,
      pomodoroEnabled: false,
      pomodoroPhase: 'focus',
      pomodoroPhaseEndsAt: null,
      pomodoroPhaseRemainingMs: 0,
      pomodoroFocusMs: 0,
      pomodoroBreakMs: 0
    };
    const saveResolvers = [];
    const renders = [];
    const sounds = [];
    const openedOverlays = [];
    const closedOverlays = [];
    const confirmations = [];
    const celebrations = [];
    let stateSavePendingCount = 0;
    function isStateSaveOperationPending() {
      return stateSavePendingCount > 0;
    }
    function setStateSaveOperationPending(pending) {
      stateSavePendingCount = Math.max(0, stateSavePendingCount + (pending ? 1 : -1));
    }

    function createClassList() {
      const values = new Set();
      return {
        add(name) {
          values.add(name);
        },
        remove(name) {
          values.delete(name);
        },
        contains(name) {
          return values.has(name);
        },
        toggle(name, force) {
          const shouldAdd = force === undefined ? !values.has(name) : !!force;
          if (shouldAdd) values.add(name);
          else values.delete(name);
          return shouldAdd;
        }
      };
    }
    function createControl() {
      return {
        disabled: false,
        dataset: {},
        attrs: {},
        classList: createClassList(),
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        }
      };
    }
    function createOverlay() {
      return {
        classList: createClassList()
      };
    }

    const focusCompleteBtn = createControl();
    const focusPauseBtn = createControl();
    const focusAbortBtn = createControl();
    const startAButton = createControl();
    const startBButton = createControl();
    const blockedStartButton = createControl();
    blockedStartButton.disabled = true;
    blockedStartButton.attrs['aria-disabled'] = 'true';
    const taskList = {};
    const focusOverlay = createOverlay();
    const confirmModalOverlay = createOverlay();
    const parentModalOverlay = createOverlay();
    const subtaskModalOverlay = createOverlay();
    const focusTaskTitle = { textContent: '' };
    const document = {
      body: { classList: createClassList() },
      querySelector() {
        return null;
      }
    };

    function qsa(selector, root = null) {
      if (root === taskList && selector === '.open-focus-parent-btn, .open-focus-subtask-btn') {
        return [startAButton, startBButton, blockedStartButton];
      }
      return [];
    }
    async function commitPomodoroSettingsFromControls() {
      return true;
    }
    function getTask(id) {
      return tasks.find(task => task.id === id) || null;
    }
    function getSubtask(parentId, subId) {
      const parent = getTask(parentId);
      return parent?.subtasks.find(sub => sub.id === subId) || null;
    }
    function getTarget(type, parentId, subtaskId = null) {
      if (type === 'parent') return getTask(parentId);
      if (type === 'subtask') return getSubtask(parentId, subtaskId);
      return null;
    }
    function hasSubtasks(task) {
      return Array.isArray(task.subtasks) && task.subtasks.length > 0;
    }
    function canOpenFocusForParent(task) {
      return !!task && !hasSubtasks(task);
    }
    function canOpenFocusForSubtask(subtask) {
      return !!subtask;
    }
    function clearRunningAcrossAllTargets() {
      tasks.forEach((task) => {
        if (task.focus.focusState === 'running') {
          task.focus.elapsedMs = getElapsedMs(task.focus);
          task.focus.focusState = 'paused';
          task.focus.startedAt = null;
        }
      });
    }
    function getElapsedMs(focusMeta, time = nowMs) {
      if (!focusMeta) return 0;
      if (focusMeta.focusState === 'running' && typeof focusMeta.startedAt === 'number') {
        return focusMeta.elapsedMs + Math.max(0, time - focusMeta.startedAt);
      }
      return focusMeta.elapsedMs;
    }
    function startFocusPomodoroSession() {}
    function syncFocusPauseButton() {}
    function updateFocusTimer() {}
    function _openModalOverlay(overlay) {
      overlay.classList.add('show');
      openedOverlays.push('focus');
    }
    function _closeModalOverlay(overlay) {
      overlay.classList.remove('show');
      closedOverlays.push('focus');
    }
    function playFocusStartSound() {
      sounds.push('start');
    }
    function playFocusShiftSound(mode) {
      sounds.push(mode);
    }
    function playFocusAbortSound() {
      sounds.push('abort');
    }
    function render() {
      renders.push(structuredClone(tasks));
    }
    function getActiveFocusTarget() {
      if (!focusState.type) return null;
      return getTarget(focusState.type, focusState.parentId, focusState.subtaskId);
    }
    function _createAppStateSnapshot() {
      return { tasks: structuredClone(tasks) };
    }
    function _createFocusRuntimeSnapshot() {
      return { ...focusState };
    }
    function _commitFocusStateSave(previousState, previousFocusState) {
      return new Promise((resolve) => {
        saveResolvers.push((value) => {
          const ok = !!value;
          if (!ok) {
            tasks = structuredClone(previousState.tasks);
            Object.assign(focusState, previousFocusState);
          }
          resolve(ok);
        });
      });
    }
    function isPomodoroEnabledForSession() {
      return false;
    }
    function syncPomodoroPhaseProgress() {
      return 0;
    }
    function getPomodoroPhaseRemainingMs() {
      return 0;
    }
    function getPomodoroPhaseDurationMs() {
      return 0;
    }
    function syncParentStatus(parent) {
      if (!hasSubtasks(parent)) return parent.done;
      parent.done = parent.subtasks.every(sub => sub.done);
      return parent.done;
    }
    function buildAbortFocusConfirmMessage() {
      return 'abort?';
    }
    function openConfirmModal(message, action, payload) {
      confirmations.push({ message, action, payload });
    }
    function celebrateElement(target, options) {
      celebrations.push({ target, options });
    }
    function closeFocusModal() {
      _closeModalOverlay(focusOverlay);
      focusState.type = null;
      focusState.parentId = null;
      focusState.subtaskId = null;
      focusState.lastCheckpointAt = 0;
    }

    ${extracted}
    globalThis.__api = {
      openFocusModal,
      pauseOrResumeFocus,
      performAbortFocus,
      abortFocus,
      completeFocus,
      setNow(value) {
        nowMs = value;
      },
      resolveNextSave(value) {
        const resolve = saveResolvers.shift();
        if (!resolve) throw new Error('no pending save');
        resolve(value);
      },
      getPendingSaveCount() {
        return saveResolvers.length;
      },
      getTasks() {
        return structuredClone(tasks);
      },
      getFocusState() {
        return { ...focusState };
      },
      getControls() {
        return {
          focusCompleteBtn: { disabled: focusCompleteBtn.disabled, ariaDisabled: focusCompleteBtn.attrs['aria-disabled'] },
          focusPauseBtn: { disabled: focusPauseBtn.disabled, ariaDisabled: focusPauseBtn.attrs['aria-disabled'] },
          focusAbortBtn: { disabled: focusAbortBtn.disabled, ariaDisabled: focusAbortBtn.attrs['aria-disabled'] },
          startAButton: { disabled: startAButton.disabled, ariaDisabled: startAButton.attrs['aria-disabled'] },
          startBButton: { disabled: startBButton.disabled, ariaDisabled: startBButton.attrs['aria-disabled'] },
          blockedStartButton: { disabled: blockedStartButton.disabled, ariaDisabled: blockedStartButton.attrs['aria-disabled'] }
        };
      },
      getConfirmations() {
        return structuredClone(confirmations);
      },
      getClosedOverlays() {
        return [...closedOverlays];
      },
      getRenders() {
        return structuredClone(renders);
      },
      getSounds() {
        return [...sounds];
      },
      getCelebrations() {
        return structuredClone(celebrations);
      }
    };
  `;

  const context = {
    structuredClone,
    Promise,
    Number,
    Math,
    Array,
    Set,
    Object,
    Error,
    setInterval() {
      return 1;
    },
    clearInterval() {},
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createKeyboardReorderApi(initialTasks, filter, activeRow) {
  const names = [
    'normalizeTaskSearchText',
    'matchesTaskSearch',
    'matchesTaskFilter',
    'isTaskVisible',
    'getFilteredSubtasks',
    'getVisibleParentTaskIds',
    'getVisibleSubtaskIds',
    'getVisibleMoveTargetId',
    'moveArrayItem',
    'reorderParentTasks',
    'reorderSubtasks',
    '_moveFocusedTaskRowByOffset',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    let taskSearchQuery = '';
    let tasks = structuredClone(globalThis.__initialTasks);
    const taskViewState = { filter: globalThis.__filter };
    const taskList = {
      contains(row) {
        return !!row?._inTaskList;
      }
    };
    const renders = [];
    let restoredFocus = null;
    function isStateSaveOperationPending() {
      return false;
    }

    class HTMLElement {
      constructor(row) {
        this._row = row;
      }
      closest(selector) {
        if (selector === '.subtask-item' && this._row?._type === 'subtask') return this._row;
        if (selector === '.task-item' && this._row?._type === 'parent') return this._row;
        return null;
      }
    }

    const activeRow = globalThis.__activeRow.type === 'subtask'
      ? {
        _type: 'subtask',
        _inTaskList: true,
        dataset: {
          parentId: globalThis.__activeRow.parentId,
          subId: globalThis.__activeRow.subId
        }
      }
      : {
        _type: 'parent',
        _inTaskList: true,
        dataset: {
          id: globalThis.__activeRow.parentId
        }
      };

    const document = {
      activeElement: new HTMLElement(activeRow)
    };

    function hasSubtasks(task) {
      return Array.isArray(task.subtasks) && task.subtasks.length > 0;
    }
    function getTask(id) {
      return tasks.find(task => task.id === id) || null;
    }
    function _createAppStateSnapshot() {
      return { tasks: structuredClone(tasks) };
    }
    async function _commitStateSave() {
      return true;
    }
    function render() {
      renders.push(structuredClone(tasks));
    }
    function _restoreFocusToTaskRow(type, parentId, subId = null) {
      restoredFocus = { type, parentId, subId };
    }

    ${extracted}
    globalThis.__api = {
      _moveFocusedTaskRowByOffset,
      getVisibleParentTaskIds,
      getVisibleSubtaskIds,
      getVisibleMoveTargetId,
      getTasks() {
        return structuredClone(tasks);
      },
      getRenders() {
        return structuredClone(renders);
      },
      getRestoredFocus() {
        return restoredFocus ? { ...restoredFocus } : null;
      }
    };
  `;

  const context = {
    structuredClone,
    Number,
    Math,
    Array,
    __initialTasks: structuredClone(initialTasks),
    __filter: filter,
    __activeRow: activeRow,
  };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createSnapshotSelectionApi() {
  const names = [
    '_normalizeStorageMeta',
    '_normalizeStorageMetaRecord',
    '_createStorageMetaIdentity',
    '_compareStorageMeta',
    '_isEmptyStorageMeta',
    '_isSameStorageMeta',
    '_hasStorageMetaConflictSince',
    '_hasAnySnapshotData',
    '_validatePersistentStateSnapshot',
    '_createIndexedStateSnapshot',
    '_shouldUseIndexedState',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const TASKS_KEY = 'tasks';
    const SETTINGS_KEY = 'settings';
    const SIDEBAR_KEY = 'sidebar';
    const ORGANIZE_MEMO_KEY = 'memo';
    const TASK_VIEW_KEY = 'task-view';
    const STATE_META_KEY = 'meta';
    const PERSISTED_DATA_KEYS = [TASKS_KEY, SETTINGS_KEY, SIDEBAR_KEY, ORGANIZE_MEMO_KEY, TASK_VIEW_KEY];
    function _reportStorageError() {}
    ${extracted}
    function createSnapshot(source, values) {
      return _validatePersistentStateSnapshot({
        source,
        values,
        meta: _normalizeStorageMeta(values[STATE_META_KEY]),
        hasAnyData: _hasAnySnapshotData(values)
      });
    }
    globalThis.__api = {
      createSnapshot,
      _shouldUseIndexedState
    };
  `;
  const context = { JSON, Number, Array, Set };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createIndexedDbTimeoutApi() {
  const names = [
    '_requestIndexedDbOpen',
    '_waitForIndexedDbTransaction',
    '_waitForIndexedDbRequest',
    '_readManyFromIndexedDb',
  ];
  const harness = `
    const INDEXED_DB_NAME = 'test-db';
    const INDEXED_DB_VERSION = 1;
    const INDEXED_DB_STORE_NAME = 'test-store';
    const STORAGE_OPERATION_TIMEOUT_MS = 4000;
    let _indexedDbPromise = null;
    const timers = new Map();
    let nextTimerId = 0;
    const requests = [];
    const indexedDB = {
      open() {
        const request = {};
        requests.push(request);
        return request;
      }
    };
    globalThis.indexedDB = indexedDB;
    const window = {
      setTimeout(callback) {
        const id = ++nextTimerId;
        timers.set(id, callback);
        return id;
      }
    };
    function clearTimeout(id) { timers.delete(id); }
    ${names.map(extractFunctionSource).join('\n\n')}
    globalThis.__api = {
      open: _requestIndexedDbOpen,
      waitTransaction: _waitForIndexedDbTransaction,
      read: _readManyFromIndexedDb,
      requests,
      expireTimers() {
        const pending = [...timers.values()];
        timers.clear();
        pending.forEach(callback => callback());
      },
      getTimerCount() { return timers.size; }
    };
  `;
  const context = { Map, Promise, Error, String };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

function createImportUndoApi() {
  const names = [
    '_copyTaskSnapshot',
    '_markAppStateChanged',
    '_registerImportUndoToast',
    '_invalidateDeleteUndo',
    'performImportBackup',
  ];
  const extracted = names.map(extractFunctionSource).join('\n\n');
  const harness = `
    const DELETE_UNDO_WINDOW_MS = 5000;
    let _appStateVersion = 0;
    let tasks = [{ id: 'before' }];
    const _importUndoState = { snapshot: null, version: 0, appStateVersion: null };
    const messageEditorState = { editIndex: null, draft: null };
    const _deleteUndoState = { payload: { removedParents: [{ id: 'old' }] }, version: 1 };
    let _deleteUndoToastSessionId = 1;
    let _deleteUndoToastHideTimerId = 1;
    const deleteUndoToastLayer = {
      innerHTML: '<div>undo</div>',
      replaceChildren() { this.innerHTML = ''; }
    };
    let importUndoAction = null;
    let commits = 0;
    const errors = [];
    function clearTimeout() {}
    function isStateSaveOperationPending() { return false; }
    function _createAppStateSnapshot() { return { tasks: structuredClone(tasks) }; }
    function _applyAppStateSnapshot(snapshot) { tasks = structuredClone(snapshot.tasks); }
    function _applyNormalizedBackupPayload(normalized) { tasks = structuredClone(normalized.tasks); }
    async function _commitStateSave() { commits += 1; _markAppStateChanged(); return true; }
    function render() {}
    function showErrorToast(message) { errors.push(message); }
    function showToast(message, options = {}) {
      if (options.onAction) importUndoAction = options.onAction;
    }
    ${extracted}
    globalThis.__api = {
      performImportBackup,
      async runImportUndo() {
        const action = importUndoAction;
        return action ? action() : undefined;
      },
      mutateAfterImport() {
        tasks.push({ id: 'later' });
        _markAppStateChanged();
      },
      getTasks() { return structuredClone(tasks); },
      getErrors() { return [...errors]; },
      getCommits() { return commits; },
      getDeleteUndoState() {
        return {
          payload: _deleteUndoState.payload,
          version: _deleteUndoState.version,
          toastHtml: deleteUndoToastLayer.innerHTML,
          timerId: _deleteUndoToastHideTimerId
        };
      }
    };
  `;
  const context = { structuredClone, JSON, Number, Array };
  context.globalThis = context;
  vm.runInNewContext(harness, context);
  return context.__api;
}

test('normalizeTasks caps task counts, syncs parent status, and resets container focus', () => {
  const api = createLogicApi();
  const source = Array.from(
    { length: api.MAX_PARENT_TASK_COUNT + 5 },
    (_, parentIndex) => ({
      id: `parent-${parentIndex}`,
      text: `Parent ${parentIndex}`,
      done: parentIndex === 0,
      focus: { focusState: 'idle', elapsedMs: 12345, startedAt: null },
      subtasks: Array.from(
        { length: api.MAX_SUBTASK_COUNT_PER_PARENT + 5 },
        (_, subtaskIndex) => ({
          id: `sub-${subtaskIndex}`,
          text: `Subtask ${subtaskIndex}`,
          done: subtaskIndex !== 0,
          focus: { focusState: 'idle', elapsedMs: 99, startedAt: null },
        }),
      ),
    }),
  );

  const normalized = api.normalizeTasks(source);

  assert.equal(normalized.length, api.MAX_PARENT_TASK_COUNT);
  assert.equal(normalized[0].subtasks.length, api.MAX_SUBTASK_COUNT_PER_PARENT);
  assert.equal(normalized[0].done, false);
  assert.equal(normalized[0].focus.elapsedMs, 0);

  const allDone = api.normalizeTasks([
    {
      id: 'all-done-parent',
      text: 'All done parent',
      done: false,
      focus: { focusState: 'idle', elapsedMs: 5000, startedAt: null },
      subtasks: [
        { id: 'sub-a', text: 'A', done: true, focus: {} },
        { id: 'sub-b', text: 'B', done: true, focus: {} },
      ],
    },
  ]);

  assert.equal(allDone[0].done, true);
  assert.equal(allDone[0].focus.elapsedMs, 0);
});

test('normalizeTasks ignores invalid entries before applying count caps', () => {
  const api = createLogicApi();
  const invalidParents = Array.from(
    { length: api.MAX_PARENT_TASK_COUNT },
    (_, index) =>
      index % 2 === 0 ? null : { id: `invalid-parent-${index}`, text: '' },
  );
  const invalidSubtasks = Array.from(
    { length: api.MAX_SUBTASK_COUNT_PER_PARENT },
    (_, index) =>
      index % 2 === 0 ? 'invalid' : { id: `invalid-sub-${index}`, text: '   ' },
  );
  const validSubtasks = Array.from(
    { length: api.MAX_SUBTASK_COUNT_PER_PARENT },
    (_, index) => ({
      id: `valid-sub-${index}`,
      text: `Valid Subtask ${index}`,
      done: true,
      focus: { elapsedMs: 200 },
    }),
  );
  const validParents = Array.from(
    { length: api.MAX_PARENT_TASK_COUNT },
    (_, index) => ({
      id: `valid-parent-${index}`,
      text: `Valid Parent ${index}`,
      done: false,
      subtasks: index === 0 ? [...invalidSubtasks, ...validSubtasks] : [],
    }),
  );

  const normalized = api.normalizeTasks([...invalidParents, ...validParents]);

  assert.equal(normalized.length, api.MAX_PARENT_TASK_COUNT);
  assert.equal(normalized[0].text, 'Valid Parent 0');
  assert.equal(
    normalized.at(-1).text,
    `Valid Parent ${api.MAX_PARENT_TASK_COUNT - 1}`,
  );
  assert.equal(normalized[0].subtasks.length, api.MAX_SUBTASK_COUNT_PER_PARENT);
  assert.equal(normalized[0].subtasks[0].text, 'Valid Subtask 0');
  assert.equal(
    normalized[0].subtasks.at(-1).text,
    `Valid Subtask ${api.MAX_SUBTASK_COUNT_PER_PARENT - 1}`,
  );
  assert.equal(normalized[0].done, true);
});

test('delete undo refuses to restore parents or subtasks beyond count caps', () => {
  const fullParentApi = createDeleteUndoApi(
    Array.from({ length: 200 }, (_, index) => ({
      id: `parent-${index}`,
      text: `Parent ${index}`,
      done: false,
      focus: {},
      subtasks: [],
    })),
  );

  assert.equal(
    fullParentApi._applyDeleteUndoPayload({
      removedParents: [
        {
          index: 0,
          task: {
            id: 'deleted-parent',
            text: 'Deleted parent',
            done: false,
            focus: {},
            subtasks: [],
          },
        },
      ],
      removedSubtasks: [],
    }),
    false,
  );
  assert.equal(fullParentApi.getTasks().length, 200);
  assert.match(fullParentApi.getErrors().at(-1), /親タスクは最大200件/);

  const fullSubtaskApi = createDeleteUndoApi([
    {
      id: 'parent',
      text: 'Parent',
      done: false,
      focus: {},
      subtasks: Array.from({ length: 50 }, (_, index) => ({
        id: `sub-${index}`,
        text: `Sub ${index}`,
        done: false,
        focus: {},
      })),
    },
  ]);

  assert.equal(
    fullSubtaskApi._applyDeleteUndoPayload({
      removedParents: [],
      removedSubtasks: [
        {
          parentId: 'parent',
          index: 0,
          subtask: {
            id: 'deleted-sub',
            text: 'Deleted sub',
            done: false,
            focus: {},
          },
        },
      ],
    }),
    false,
  );
  assert.equal(fullSubtaskApi.getTasks()[0].subtasks.length, 50);
  assert.match(
    fullSubtaskApi.getErrors().at(-1),
    /子タスクは親タスクごとに最大50件/,
  );
});

test('normalizeBackupPayload applies the same task and memo normalization before save', () => {
  const api = createLogicApi();
  const payload = {
    app: 'yaruyan-todo',
    schemaVersion: 1,
    data: {
      tasks: [
        {
          id: 'parent',
          text: 'Parent',
          done: true,
          focus: { focusState: 'idle', elapsedMs: 8000, startedAt: null },
          subtasks: [
            { id: 'sub-a', text: 'A', done: true, focus: {} },
            { id: 'sub-b', text: 'B', done: false, focus: {} },
          ],
        },
      ],
      settings: {
        colorMode: 'dark',
        themeColor: 'theme-1',
        sound: true,
        celebration: false,
        messages: Array.from({ length: 40 }, (_, index) => `message-${index}`),
        pomodoro: { enabled: true, focusMinutes: 999, breakMinutes: 0 },
      },
      sidebarCollapsed: true,
      organizeMemo: 'x'.repeat(api.MAX_ORGANIZE_MEMO_LENGTH + 10),
      taskView: { filter: 'completed' },
    },
  };

  const normalized = api.normalizeBackupPayload(payload);

  assert.equal(normalized.tasks[0].done, false);
  assert.equal(normalized.tasks[0].focus.elapsedMs, 0);
  assert.equal(normalized.organizeMemo.length, api.MAX_ORGANIZE_MEMO_LENGTH);
  assert.equal(normalized.settings.messages.length, 30);
  assert.equal(normalized.settings.pomodoro.focusMinutes, 180);
  assert.equal(normalized.settings.pomodoro.breakMinutes, 1);
});

test('maximum UI backup stays within the import file size cap', () => {
  const api = createLogicApi();
  const taskText = 'あ'.repeat(api.MAX_TASK_TEXT_LENGTH);
  const subtaskText = 'あ'.repeat(api.MAX_SUBTASK_TEXT_LENGTH);
  const messageText = 'あ'.repeat(api.MAX_MESSAGE_TEXT_LENGTH);
  const uuid = (prefix, index) =>
    `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const payload = {
    app: 'yaruyan-todo',
    schemaVersion: 1,
    exportedAt: '2026-06-04T00:00:00.000Z',
    data: {
      tasks: Array.from(
        { length: api.MAX_PARENT_TASK_COUNT },
        (_, parentIndex) => ({
          id: uuid('00000000', parentIndex),
          text: taskText,
          done: false,
          focus: { focusState: 'idle', elapsedMs: 0, startedAt: null },
          subtasks: Array.from(
            { length: api.MAX_SUBTASK_COUNT_PER_PARENT },
            (_, subtaskIndex) => ({
              id: uuid(
                '10000000',
                parentIndex * api.MAX_SUBTASK_COUNT_PER_PARENT + subtaskIndex,
              ),
              text: subtaskText,
              done: false,
              focus: { focusState: 'idle', elapsedMs: 0, startedAt: null },
            }),
          ),
        }),
      ),
      settings: {
        colorMode: 'dark',
        themeColor: 'theme-1',
        sound: true,
        celebration: true,
        messages: Array.from(
          { length: api.MAX_MESSAGE_COUNT },
          () => messageText,
        ),
        pomodoro: { enabled: true, focusMinutes: 180, breakMinutes: 120 },
      },
      sidebarCollapsed: true,
      organizeMemo: 'あ'.repeat(api.MAX_ORGANIZE_MEMO_LENGTH),
      taskView: { filter: 'all' },
    },
  };
  const byteLength = Buffer.byteLength(
    JSON.stringify(payload, null, 2),
    'utf8',
  );

  assert.ok(byteLength > 2 * 1024 * 1024);
  assert.ok(
    byteLength <= api.MAX_BACKUP_FILE_BYTES,
    `maximum backup was ${byteLength} bytes, cap is ${api.MAX_BACKUP_FILE_BYTES}`,
  );
});

test('backup import help text is generated from the file size cap', () => {
  assert.match(html, /id="backupImportLimitText"/);
  assert.doesNotMatch(html, /読み込みは2MBまでです。/);
  assert.match(
    extractFunctionSource('updateBackupImportLimitText'),
    /formatFileSize\(MAX_BACKUP_FILE_BYTES\)/,
  );
});

test('focus metadata normalization rejects invalid states and negative timing', () => {
  const api = createLogicApi();
  const assertFocus = (actual, expected) => {
    assert.equal(actual.focusState, expected.focusState);
    assert.equal(actual.elapsedMs, expected.elapsedMs);
    assert.equal(actual.startedAt, expected.startedAt);
  };

  assertFocus(
    api.createFocusMeta({
      focusState: 'running',
      elapsedMs: '1200',
      startedAt: '900',
    }),
    {
      focusState: 'running',
      elapsedMs: 1200,
      startedAt: 900,
    },
  );
  assertFocus(
    api.createFocusMeta({
      focusState: 'unknown',
      elapsedMs: -1,
      startedAt: 100,
    }),
    {
      focusState: 'idle',
      elapsedMs: 0,
      startedAt: null,
    },
  );
  assertFocus(
    api.normalizeFocusMeta({
      focusState: 'running',
      elapsedMs: 500,
      startedAt: 100,
    }),
    {
      focusState: 'paused',
      elapsedMs: 500,
      startedAt: null,
    },
  );

  const normalized = api.normalizeBackupPayload({
    app: 'yaruyan-todo',
    schemaVersion: 1,
    data: {
      tasks: [
        {
          id: 'leaf',
          text: 'Leaf',
          done: false,
          focus: { focusState: 'done', elapsedMs: -500, startedAt: -1 },
          subtasks: [],
        },
        {
          id: 'container',
          text: 'Container',
          done: false,
          focus: { focusState: 'running', elapsedMs: 999, startedAt: 1 },
          subtasks: [
            {
              id: 'sub-a',
              text: 'Sub A',
              done: false,
              focus: { focusState: 'running', elapsedMs: -250, startedAt: -99 },
            },
            {
              id: 'sub-b',
              text: 'Sub B',
              done: false,
              focus: {
                focusState: 'paused',
                elapsedMs: Infinity,
                startedAt: 10,
              },
            },
          ],
        },
      ],
      settings: { messages: ['ok'], pomodoro: {} },
      sidebarCollapsed: false,
      organizeMemo: '',
      taskView: { filter: 'all' },
    },
  });

  assertFocus(normalized.tasks[0].focus, {
    focusState: 'idle',
    elapsedMs: 0,
    startedAt: null,
  });
  assertFocus(normalized.tasks[1].focus, {
    focusState: 'idle',
    elapsedMs: 0,
    startedAt: null,
  });
  assertFocus(normalized.tasks[1].subtasks[0].focus, {
    focusState: 'paused',
    elapsedMs: 0,
    startedAt: null,
  });
  assertFocus(normalized.tasks[1].subtasks[1].focus, {
    focusState: 'paused',
    elapsedMs: 0,
    startedAt: null,
  });
});

test('settings normalization treats null pomodoro settings as defaults', () => {
  const api = createLogicApi();

  const normalizedPomodoro = api.normalizePomodoroSettings(null);
  assert.equal(normalizedPomodoro.enabled, false);
  assert.equal(normalizedPomodoro.focusMinutes, 25);
  assert.equal(normalizedPomodoro.breakMinutes, 5);

  const normalizedSettings = api.normalizeSettings({
    colorMode: 'dark',
    themeColor: 'theme-1',
    sound: false,
    celebration: false,
    messages: ['保存済み'],
    pomodoro: null,
  });
  assert.equal(normalizedSettings.colorMode, 'dark');
  assert.equal(normalizedSettings.themeColor, 'theme-1');
  assert.equal(normalizedSettings.sound, false);
  assert.equal(normalizedSettings.celebration, false);
  assert.deepEqual(Array.from(normalizedSettings.messages), ['保存済み']);
  assert.equal(normalizedSettings.pomodoro.enabled, false);
  assert.equal(normalizedSettings.pomodoro.focusMinutes, 25);
  assert.equal(normalizedSettings.pomodoro.breakMinutes, 5);

  const backup = api.normalizeBackupPayload({
    app: 'yaruyan-todo',
    schemaVersion: 1,
    data: {
      tasks: [],
      settings: {
        messages: ['バックアップ'],
        pomodoro: null,
      },
      sidebarCollapsed: false,
      organizeMemo: '',
      taskView: { filter: 'all' },
    },
  });
  assert.equal(backup.settings.pomodoro.enabled, false);
  assert.equal(backup.settings.pomodoro.focusMinutes, 25);
  assert.equal(backup.settings.pomodoro.breakMinutes, 5);
});

test('syncParentStatus derives parent completion from subtasks', () => {
  const api = createLogicApi();
  const parent = {
    done: false,
    subtasks: [{ done: true }, { done: true }],
  };

  assert.equal(api.syncParentStatus(parent), true);
  assert.equal(parent.done, true);

  parent.subtasks[1].done = false;
  assert.equal(api.syncParentStatus(parent), false);
  assert.equal(parent.done, false);
});

test('commitStateSave rolls state back when save fails', async () => {
  const api = createLogicApi();
  const snapshot = { tasks: [{ id: 'parent', text: 'Parent' }] };

  api.setSaveResult(true);
  assert.equal(await api._commitStateSave(snapshot, 'failed'), true);
  assert.equal(api.getRestored(), null);

  api.setSaveResult(false);
  assert.equal(await api._commitStateSave(snapshot, 'failed'), false);
  assert.equal(api.getRestored().snapshot, snapshot);
  assert.equal(api.getRestored().message, 'failed');
});

test('commitStateSave skips stale rollback after a later state change', async () => {
  const api = createCommitRollbackApi();
  const snapshot = { tasks: [{ id: 'base' }] };
  const commit = api._commitStateSave(snapshot, 'failed');

  await Promise.resolve();
  api.mutateAfterCommitStarted();
  api.resolveSave(false);

  assert.equal(await commit, false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getTasks().map((task) => task.id))),
    ['base', 'first-change', 'later-change'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.getErrors())), [
    '保存できませんでした。後続の変更があるため画面状態は維持しました',
  ]);
});

test('commitStateSave holds the shared UI lock until persistence settles', async () => {
  const api = createCommitRollbackApi();
  const commit = api._commitStateSave({ tasks: [{ id: 'base' }] });

  await Promise.resolve();
  assert.equal(api.isStateSavePending(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getStateSaveTransitions())), [
    true,
  ]);

  api.resolveSave(true);
  assert.equal(await commit, true);
  assert.equal(api.isStateSavePending(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getStateSaveTransitions())), [
    true,
    false,
  ]);
});

test('organize memo input advances state version so stale save rollback is skipped', async () => {
  const api = createCommitRollbackApi();
  const snapshot = { tasks: [{ id: 'base' }] };
  const commit = api._commitStateSave(snapshot, 'failed');

  await Promise.resolve();
  api.editMemoAfterCommitStarted('later memo');
  api.resolveSave(false);

  assert.equal(await commit, false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getTasks().map((task) => task.id))),
    ['base', 'first-change'],
  );
  assert.equal(api.getMemo(), 'later memo');
  assert.deepEqual(JSON.parse(JSON.stringify(api.getMemoCheckpoints())), [
    'later memo',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getMemoSchedules())), [
    'later memo',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getErrors())), [
    '保存できませんでした。後続の変更があるため画面状態は維持しました',
  ]);
});

test('organize memo stays read-only until storage selection completes, then accepts edits', () => {
  const editedApi = createMemoInitApi();
  editedApi.setInputValue('typed before indexedDB');
  editedApi.handleOrganizeMemoInput();
  assert.equal(editedApi.getInputValue(), 'local memo');
  assert.equal(editedApi.getVersion(), 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(editedApi.getPreInitWrites())),
    [],
  );

  editedApi.simulatePersistedMemo('indexed memo');
  editedApi.finishPersistentStorageInitialization();
  assert.equal(editedApi.getInputValue(), 'indexed memo');
  assert.deepEqual(JSON.parse(JSON.stringify(editedApi.getInputState())), {
    readOnly: false,
    ariaBusy: null,
  });
  editedApi.setInputValue('typed after initialization');
  editedApi.handleOrganizeMemoInput();
  assert.equal(editedApi.getMemo(), 'typed after initialization');
  assert.equal(editedApi.getVersion(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(editedApi.getMemoCheckpoints())), [
    'typed after initialization',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(editedApi.getMemoSchedules())), [
    'typed after initialization',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(editedApi.getMemoStatuses())), [
    'saved',
  ]);

  const untouchedApi = createMemoInitApi();
  untouchedApi.simulatePersistedMemo('indexed memo');
  untouchedApi.finishPersistentStorageInitialization();

  assert.equal(untouchedApi.getInputValue(), 'indexed memo');
  assert.equal(untouchedApi.getMemo(), 'indexed memo');
  assert.deepEqual(
    JSON.parse(JSON.stringify(untouchedApi.getMemoCheckpoints())),
    [],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(untouchedApi.getMemoStatuses())), [
    'saved',
  ]);
});

test('storage lifecycle listeners are registered before indexedDB initialization is awaited', () => {
  const initAwaitIndex = html.indexOf(
    'await _initializePersistentStorageState();',
  );
  const pagehideIndex = html.indexOf(
    "window.addEventListener('pagehide', persistRuntimeStateForUnload);",
  );
  const visibilityIndex = html.indexOf(
    "document.addEventListener('visibilitychange'",
  );

  assert.ok(pagehideIndex >= 0 && pagehideIndex < initAwaitIndex);
  assert.ok(visibilityIndex >= 0 && visibilityIndex < initAwaitIndex);
  assert.match(
    html,
    /finally\s*\{\s*_rememberPersistedDataEntries\(_getPersistedStateEntries\(\)\);\s*finishPersistentStorageInitialization\(\);/,
  );
});

test('unload before initialization never publishes the stale local snapshot', async () => {
  const api = createStorageSaveApi({
    indexedValues: {
      meta: JSON.stringify({ version: 1, revision: 1, updatedAt: 10 }),
    },
  });
  api.setStorageInitialized(false);
  api.persistRuntimeStateForUnload();
  await api.flushAsyncStorage();
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');
  assert.equal(api.getMeta().revision, 0);
  assert.equal(api.getLocalWrites().length, 0);
  assert.equal(api.getIndexedWrites().length, 0);
});

test('indexedDB open times out and closes a connection that arrives after timeout', async () => {
  const api = createIndexedDbTimeoutApi();
  const open = api.open();
  const rejected = assert.rejects(open, /open timed out/);
  api.expireTimers();
  await rejected;
  let closed = false;
  api.requests[0].result = {
    close() {
      closed = true;
    },
  };
  api.requests[0].onsuccess();
  assert.equal(closed, true);
  const retry = api.open();
  assert.equal(api.requests.length, 2);
  const db = { close() {} };
  api.requests[1].result = db;
  api.requests[1].onsuccess();
  assert.equal(await retry, db);
  assert.equal(api.getTimerCount(), 0);
});

test('an unresponsive indexedDB read times out and aborts its transaction', async () => {
  const api = createIndexedDbTimeoutApi();
  let aborted = false;
  const tx = {
    objectStore() {
      return {
        get() {
          return {};
        },
      };
    },
    abort() {
      aborted = true;
    },
  };
  const read = api.read(['tasks']);
  api.requests[0].result = {
    transaction() {
      return tx;
    },
    close() {},
  };
  api.requests[0].onsuccess();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(api.getTimerCount(), 1);
  const rejected = assert.rejects(read, /transaction timed out/);
  api.expireTimers();
  await rejected;
  assert.equal(aborted, true);
});

test('newer invalid storage snapshots never outrank an older valid snapshot', () => {
  const api = createSnapshotSelectionApi();
  const values = (revision) => ({
    tasks: JSON.stringify([{ id: 'task' }]),
    settings: JSON.stringify({ sound: true }),
    sidebar: 'false',
    memo: '',
    'task-view': JSON.stringify({ filter: 'all' }),
    meta: JSON.stringify({ version: 1, revision, updatedAt: revision }),
  });
  const validLocal = api.createSnapshot('local', values(1));
  const invalidTypeValues = values(2);
  invalidTypeValues.tasks = JSON.stringify({ not: 'an array' });
  const invalidTypeIndexed = api.createSnapshot('indexeddb', invalidTypeValues);
  const missingKeyValues = values(3);
  delete missingKeyValues['task-view'];
  const missingKeyIndexed = api.createSnapshot('indexeddb', missingKeyValues);

  assert.equal(validLocal.isValid, true);
  assert.equal(invalidTypeIndexed.isValid, false);
  assert.deepEqual([...invalidTypeIndexed.invalidKeys], ['tasks']);
  assert.equal(missingKeyIndexed.isValid, false);
  assert.ok(missingKeyIndexed.invalidKeys.includes('task-view'));
  assert.equal(
    api._shouldUseIndexedState(validLocal, invalidTypeIndexed),
    false,
  );
  assert.equal(
    api._shouldUseIndexedState(validLocal, missingKeyIndexed),
    false,
  );
});

test('import undo refuses to overwrite changes made after import', async () => {
  const api = createImportUndoApi();
  assert.equal(
    await api.performImportBackup({ tasks: [{ id: 'imported' }] }),
    true,
  );
  api.mutateAfterImport();
  await api.runImportUndo();

  assert.deepEqual(
    api.getTasks().map((task) => task.id),
    ['imported', 'later'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.getErrors())), [
    '読み込み後に変更があるため元に戻せません',
  ]);
  assert.equal(api.getCommits(), 1);
});

test('successful import invalidates delete undo and still allows immediate import undo', async () => {
  const api = createImportUndoApi();
  assert.equal(
    await api.performImportBackup({ tasks: [{ id: 'imported' }] }),
    true,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.getDeleteUndoState())), {
    payload: null,
    version: 2,
    toastHtml: '',
    timerId: null,
  });

  await api.runImportUndo();
  assert.deepEqual(
    api.getTasks().map((task) => task.id),
    ['before'],
  );
  assert.equal(api.getCommits(), 2);
});

test('focus rollback preserves running task metadata after save failure', () => {
  const api = createFocusRollbackApi();
  const previousState = api._createAppStateSnapshot();
  const previousFocusState = api._createFocusRuntimeSnapshot();

  api.mutateAfterSnapshot();
  api._restoreFocusStateAfterFailedSave(
    previousState,
    previousFocusState,
    'failed',
  );

  assert.equal(api.getTaskFocus().focusState, 'running');
  assert.equal(api.getTaskFocus().startedAt, 1000);
  assert.equal(api.focusState.type, 'parent');
  assert.equal(api.focusState.parentId, 'parent');
  assert.equal(api.focusState.lastCheckpointAt, 1000);
  assert.deepEqual(Array.from(api.getErrors()), ['failed']);
});

test('focus save failure paths use the runtime-preserving rollback helper', () => {
  [
    'openFocusModal',
    'pauseOrResumeFocus',
    'performAbortFocus',
    'completeFocus',
    'checkpointActiveFocusElapsed',
  ].forEach((name) => {
    assert.match(extractFunctionSource(name), /_commitFocusStateSave/);
  });
});

test('readJsonFromStorage backs corrupt values up once with a fixed size cap', () => {
  const api = createLogicApi();
  const values = new Map([['tasks', '{broken json']]);
  const writes = [];
  const removes = [];
  const errors = [];
  const storage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
      values.set(key, String(value));
    },
    removeItem(key) {
      removes.push(key);
      values.delete(key);
    },
  };
  const fallback = [];

  assert.equal(
    api._readJsonFromStorage({
      storage,
      key: 'tasks',
      fallback,
      validate: Array.isArray,
      onError(mode, error, meta) {
        errors.push({ mode, key: meta?.key, message: error.message });
      },
    }),
    fallback,
  );

  assert.equal(values.has('tasks'), false);
  assert.equal(
    values.get(`tasks${api.CORRUPT_STORAGE_BACKUP_SUFFIX}`),
    '{broken json',
  );
  assert.deepEqual(
    writes.map(([key]) => key),
    [`tasks${api.CORRUPT_STORAGE_BACKUP_SUFFIX}`],
  );
  assert.deepEqual(removes, ['tasks']);
  assert.equal(errors[0].mode, 'parse');

  assert.equal(
    api._readJsonFromStorage({
      storage,
      key: 'tasks',
      fallback: 'empty',
    }),
    'empty',
  );
  assert.deepEqual(
    [...values.keys()],
    [`tasks${api.CORRUPT_STORAGE_BACKUP_SUFFIX}`],
  );

  values.set('tasks', '{new broken json');
  assert.equal(
    api._readJsonFromStorage({
      storage,
      key: 'tasks',
      fallback: 'existing-backup',
    }),
    'existing-backup',
  );
  assert.equal(
    values.get(`tasks${api.CORRUPT_STORAGE_BACKUP_SUFFIX}`),
    '{broken json',
  );
  assert.equal(writes.length, 1);
  assert.equal(values.get('tasks'), '{new broken json');

  const longRaw = 'x'.repeat(api.MAX_CORRUPT_STORAGE_BACKUP_CHARS + 100);
  const longFallback = {};
  values.set('settings', longRaw);
  assert.equal(
    api._readJsonFromStorage({
      storage,
      key: 'settings',
      fallback: longFallback,
    }),
    longFallback,
  );
  const truncated = values.get(`settings${api.CORRUPT_STORAGE_BACKUP_SUFFIX}`);
  assert.equal(truncated.length, api.MAX_CORRUPT_STORAGE_BACKUP_CHARS);
  assert.match(truncated, /\[truncated corrupt storage value/);
  assert.equal(values.get('settings'), longRaw);
});

test('writeManyToStorage rolls back previous values after a partial write failure', () => {
  const api = createLogicApi();
  const values = new Map([
    ['tasks', 'old-tasks'],
    ['settings', 'old-settings'],
    ['meta', 'old-meta'],
  ]);
  const errors = [];
  const storage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (key === 'meta' && value === 'new-meta') {
        throw new Error('quota exceeded');
      }
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  const ok = api._writeManyToStorage({
    storage,
    entries: [
      ['tasks', 'new-tasks'],
      ['settings', 'new-settings'],
      ['sidebar', 'true'],
      ['meta', 'new-meta'],
    ],
    onError(mode, error, meta) {
      errors.push({ mode, key: meta?.key, message: error.message });
    },
  });

  assert.equal(ok, false);
  assert.equal(values.get('tasks'), 'old-tasks');
  assert.equal(values.get('settings'), 'old-settings');
  assert.equal(values.get('meta'), 'old-meta');
  assert.equal(values.has('sidebar'), false);
  assert.deepEqual(errors, [
    {
      mode: 'write',
      key: 'meta',
      message: 'quota exceeded',
    },
  ]);
});

test('storage diff tracking compares data against the last committed values', () => {
  const api = createLogicApi();
  assert.equal(api._hasPersistedDataChanges([['memo', 'A']]), true);
  api._rememberPersistedDataEntries([
    ['tasks', '[]'],
    ['memo', 'A'],
  ]);
  assert.equal(api._hasPersistedDataChanges([['memo', 'A']]), false);
  assert.equal(api._hasPersistedDataChanges([['memo', 'AB']]), true);
  assert.equal(api._hasPersistedDataChanges([['metadata', 'ignored']]), false);
  api._rememberPersistedDataEntries([['memo', 'AB']]);
  assert.equal(api._hasPersistedDataChanges([['memo', 'AB']]), false);
  assert.equal(api._hasPersistedDataChanges([['tasks', '[]']]), false);
});

test('saveStoredState falls back to indexedDB when localStorage write fails', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    failLocalKeys: ['tasks'],
    indexedResults: [true],
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  assert.equal(
    await api._saveStoredState([[api.TASKS_KEY, 'new-tasks']]),
    true,
  );
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');
  assert.equal(api.getIndexedWrites().length, 1);

  const indexedWrite = api.getIndexedWrites()[0];
  assert.equal(
    indexedWrite.find(([key]) => key === api.TASKS_KEY)?.[1],
    'new-tasks',
  );
  assert.ok(indexedWrite.some(([key]) => key === api.STATE_META_KEY));
  assert.equal(
    api._hasPersistedDataChanges([[api.TASKS_KEY, 'new-tasks']]),
    false,
  );
  assert.equal(api.isWarningVisible(), false);
});

test('saveStoredState still fails when both localStorage and indexedDB are unavailable', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: false,
    failLocalKeys: ['tasks'],
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  assert.equal(
    await api._saveStoredState([[api.TASKS_KEY, 'new-tasks']]),
    false,
  );
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');
  assert.equal(api.getIndexedWrites().length, 0);
  assert.equal(
    api._hasPersistedDataChanges([[api.TASKS_KEY, 'new-tasks']]),
    true,
  );
  assert.equal(api.getMeta().revision, 0);
});

test('saveStoredState fails and restores metadata when indexedDB fallback fails', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    failLocalKeys: ['tasks'],
    indexedResults: [false],
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  assert.equal(
    await api._saveStoredState([[api.TASKS_KEY, 'new-tasks']]),
    false,
  );
  assert.equal(api.getMeta().revision, 0);
  assert.equal(api.isWarningVisible(), true);
  assert.ok(
    api
      .getWarnings()
      .some(
        (warning) =>
          warning.kind === 'persistent' &&
          warning.mode === 'storage-write' &&
          warning.message === 'indexedDB write failed',
      ),
  );
  assert.equal(
    api._hasPersistedDataChanges([[api.TASKS_KEY, 'new-tasks']]),
    true,
  );
});

test('saveStoredState stops when indexedDB has newer metadata', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedValues: {
      meta: JSON.stringify({ version: 1, revision: 2, updatedAt: 10 }),
    },
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  assert.equal(
    await api._saveStoredState([[api.TASKS_KEY, 'new-tasks']]),
    false,
  );
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');
  assert.equal(api.getIndexedWrites().length, 0);
  assert.equal(
    api._hasPersistedDataChanges([[api.TASKS_KEY, 'new-tasks']]),
    true,
  );
  assert.ok(
    api
      .getWarnings()
      .some(
        (warning) =>
          warning.kind === 'persistent' && warning.mode === 'storage-conflict',
      ),
  );
});

test('saveStoredState refuses same-generation localStorage writes from another tab', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedReadDelays: [true],
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  const save = api._saveStoredState([[api.TASKS_KEY, 'new-tasks']]);
  await api.flushAsyncStorage();
  assert.equal(api.getIndexedReads().length, 1);

  api.setLocalValue(api.TASKS_KEY, 'other-tab-tasks');
  api.setLocalValue(
    api.STATE_META_KEY,
    JSON.stringify({
      version: 1,
      revision: 1,
      updatedAt: 5,
      writeId: 'other-tab-write',
      writerId: 'other-tab',
      base: { revision: 0, updatedAt: 0, writeId: '' },
    }),
  );
  api.releaseIndexedRead();

  assert.equal(await save, false);
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'other-tab-tasks');
  assert.equal(
    api
      .getLocalWrites()
      .some(([key, value]) => key === api.TASKS_KEY && value === 'new-tasks'),
    false,
  );
  assert.equal(api.getMeta().revision, 0);
  assert.ok(
    api
      .getWarnings()
      .some(
        (warning) =>
          warning.kind === 'persistent' && warning.mode === 'storage-conflict',
      ),
  );
});

test('indexedDB fallback refuses same-generation writes from another tab', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    failLocalKeys: ['tasks'],
    indexedWriteDelays: [true],
    indexedValues: {
      meta: JSON.stringify({ version: 1, revision: 0, updatedAt: 0 }),
      tasks: 'old-indexed-tasks',
    },
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  const save = api._saveStoredState([[api.TASKS_KEY, 'new-tasks']]);
  await api.flushAsyncStorage();

  api.setIndexedValue(api.TASKS_KEY, 'other-tab-indexed-tasks');
  api.setIndexedValue(
    api.STATE_META_KEY,
    JSON.stringify({
      version: 1,
      revision: 1,
      updatedAt: 7,
      writeId: 'other-tab-indexed-write',
      writerId: 'other-tab',
      base: { revision: 0, updatedAt: 0, writeId: '' },
    }),
  );
  api.releaseIndexedWrite();

  assert.equal(await save, false);
  assert.equal(api.getIndexedValue(api.TASKS_KEY), 'other-tab-indexed-tasks');
  assert.equal(api.getIndexedWrites().length, 0);
  assert.equal(api.getIndexedWriteSkips().length, 1);
  assert.equal(api.getMeta().revision, 0);
  assert.ok(
    api
      .getWarnings()
      .some(
        (warning) =>
          warning.kind === 'persistent' &&
          warning.mode === 'storage-write' &&
          warning.message === 'indexedDB has newer state; skipped stale write',
      ),
  );
});

test('save serializes overlapping full-state writes so the newest state persists last', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedReadDelays: [true],
  });
  api._rememberPersistedDataEntries([
    [api.TASKS_KEY, 'old-tasks'],
    [api.SETTINGS_KEY, JSON.stringify({})],
    [api.SIDEBAR_KEY, 'false'],
    [api.ORGANIZE_MEMO_KEY, 'old-memo'],
    [api.TASK_VIEW_KEY, JSON.stringify({ filter: 'all' })],
  ]);

  api.setRuntimeState({ tasks: [{ id: 'first-task' }] });
  const firstSave = api.save();
  await api.flushAsyncStorage();
  assert.equal(api.getIndexedReads().length, 1);

  api.setRuntimeState({ tasks: [{ id: 'second-task' }] });
  const secondSave = api.save();
  await api.flushAsyncStorage();
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');

  api.releaseIndexedRead();

  assert.equal(await firstSave, true);
  assert.equal(await secondSave, true);
  assert.equal(
    api.getLocalValue(api.TASKS_KEY),
    JSON.stringify([{ id: 'second-task' }]),
  );
  assert.equal(
    api._hasPersistedDataChanges([
      [api.TASKS_KEY, JSON.stringify([{ id: 'second-task' }])],
    ]),
    false,
  );
});

test('unload persistence does not let an already running stale save overwrite the latest local snapshot', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedReadDelays: [true],
  });
  const oldTasks = JSON.stringify([{ id: 'old-task' }]);
  const firstTasks = JSON.stringify([{ id: 'first-task' }]);
  const unloadTasks = JSON.stringify([{ id: 'unload-task' }]);
  api._rememberPersistedDataEntries([
    [api.TASKS_KEY, oldTasks],
    [api.SETTINGS_KEY, JSON.stringify({})],
    [api.SIDEBAR_KEY, 'false'],
    [api.ORGANIZE_MEMO_KEY, 'old-memo'],
    [api.TASK_VIEW_KEY, JSON.stringify({ filter: 'all' })],
  ]);

  api.setRuntimeState({ tasks: [{ id: 'first-task' }] });
  const firstSave = api.save();
  await api.flushAsyncStorage();
  assert.equal(api.getIndexedReads().length, 1);

  api.setRuntimeState({
    tasks: [{ id: 'unload-task' }],
    organizeMemo: 'unload-memo',
  });
  api.persistRuntimeStateForUnload();

  assert.equal(api.getLocalValue(api.TASKS_KEY), unloadTasks);
  api.releaseIndexedRead();

  assert.equal(await firstSave, true);
  await api.flushAsyncStorage();

  assert.equal(api.getLocalValue(api.TASKS_KEY), unloadTasks);
  assert.equal(api.getLocalValue(api.ORGANIZE_MEMO_KEY), 'unload-memo');
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        api
          .getLocalWrites()
          .filter(([key]) => key === api.TASKS_KEY)
          .map(([, value]) => value),
      ),
    ),
    [unloadTasks],
  );
  assert.ok(
    !api
      .getLocalWrites()
      .some(([key, value]) => key === api.TASKS_KEY && value === firstTasks),
  );
});

test('a delayed authoritative commit rejects a competing write and preserves local data', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedWriteDelays: [true],
    indexedValues: {
      meta: JSON.stringify({ version: 1, revision: 0, updatedAt: 0 }),
      tasks: 'old-indexed-tasks',
    },
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);

  const saving = api._saveStoredState([[api.TASKS_KEY, 'new-local-tasks']]);
  await api.flushAsyncStorage();
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');

  api.setIndexedValue(
    api.STATE_META_KEY,
    JSON.stringify({ version: 1, revision: 99, updatedAt: 99 }),
  );
  api.setIndexedValue(api.TASKS_KEY, 'newer-indexed-tasks');
  api.releaseIndexedWrite();
  await api.flushAsyncStorage();

  assert.equal(await saving, false);
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'old-tasks');
  assert.equal(api.getIndexedValue(api.TASKS_KEY), 'newer-indexed-tasks');
  assert.equal(api.getIndexedWrites().length, 0);
  assert.equal(api.getIndexedWriteSkips().length, 1);
});

test('organize memo checkpoint writes a full local snapshot instead of memo-only metadata', async () => {
  const api = createStorageSaveApi({ indexedDbAvailable: true });
  const oldTasks = JSON.stringify([{ id: 'old-task' }]);
  const latestTasks = JSON.stringify([{ id: 'latest-task' }]);
  api._rememberPersistedDataEntries([
    [api.TASKS_KEY, oldTasks],
    [api.SETTINGS_KEY, JSON.stringify({ sound: false })],
    [api.SIDEBAR_KEY, 'false'],
    [api.ORGANIZE_MEMO_KEY, 'old-memo'],
    [api.TASK_VIEW_KEY, JSON.stringify({ filter: 'all' })],
  ]);

  api.setRuntimeState({
    tasks: [{ id: 'latest-task' }],
    settings: { sound: true },
    isSidebarCollapsed: true,
    organizeMemo: 'checkpoint memo',
    taskViewState: { filter: 'completed' },
  });

  assert.equal(await api.persistOrganizeMemoLocalCheckpoint(), true);
  assert.equal(api.getLocalValue(api.TASKS_KEY), latestTasks);
  assert.equal(
    api.getLocalValue(api.SETTINGS_KEY),
    JSON.stringify({ sound: true }),
  );
  assert.equal(api.getLocalValue(api.SIDEBAR_KEY), 'true');
  assert.equal(api.getLocalValue(api.ORGANIZE_MEMO_KEY), 'checkpoint memo');
  assert.equal(
    api.getLocalValue(api.TASK_VIEW_KEY),
    JSON.stringify({ filter: 'completed' }),
  );
  assert.ok(JSON.parse(api.getLocalValue(api.STATE_META_KEY)).revision > 0);
});

test('startup mirror skips targets that already have newer metadata', async () => {
  const api = createStorageSaveApi({ indexedDbAvailable: true });
  api.setLocalValue(api.TASKS_KEY, 'newer-local-tasks');
  api.setLocalValue(
    api.STATE_META_KEY,
    JSON.stringify({ version: 1, revision: 5, updatedAt: 5 }),
  );
  api.setIndexedValue(api.TASKS_KEY, 'newer-indexed-tasks');
  api.setIndexedValue(
    api.STATE_META_KEY,
    JSON.stringify({ version: 1, revision: 5, updatedAt: 5 }),
  );

  api._mirrorPersistentStorageState(
    [[api.TASKS_KEY, 'selected-older-tasks']],
    { revision: 1, updatedAt: 1 },
    { local: true, indexed: true },
  );
  await api.flushAsyncStorage();

  assert.equal(api.getLocalValue(api.TASKS_KEY), 'newer-local-tasks');
  assert.equal(api.getIndexedValue(api.TASKS_KEY), 'newer-indexed-tasks');
  assert.equal(api.getIndexedWrites().length, 0);
  assert.equal(api.getIndexedWriteSkips().length, 1);
});

test('organize memo local checkpoints do not let a delayed stale value overwrite the latest memo', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedReadDelays: [true],
  });
  api._rememberPersistedDataEntries([
    [api.TASKS_KEY, '[]'],
    [api.SETTINGS_KEY, JSON.stringify({})],
    [api.SIDEBAR_KEY, 'false'],
    [api.ORGANIZE_MEMO_KEY, 'old-memo'],
    [api.TASK_VIEW_KEY, JSON.stringify({ filter: 'all' })],
  ]);

  api.setRuntimeState({ organizeMemo: 'A' });
  const firstCheckpoint = api.persistOrganizeMemoLocalCheckpoint();
  await api.flushAsyncStorage();
  assert.equal(api.getIndexedReads().length, 1);

  api.setRuntimeState({ organizeMemo: 'AB' });
  const secondCheckpoint = api.persistOrganizeMemoLocalCheckpoint();
  await api.flushAsyncStorage();
  assert.equal(api.getLocalValue(api.ORGANIZE_MEMO_KEY), undefined);

  api.releaseIndexedRead();

  assert.equal(await firstCheckpoint, true);
  assert.equal(await secondCheckpoint, true);
  assert.equal(api.getLocalValue(api.ORGANIZE_MEMO_KEY), 'AB');
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        api
          .getLocalWrites()
          .filter(([key]) => key === api.ORGANIZE_MEMO_KEY)
          .map(([, value]) => value),
      ),
    ),
    ['AB'],
  );
  assert.deepEqual([...api.getMemoStatuses()], ['saving']);
});

test('persistRuntimeStateForUnload writes localStorage before asynchronous indexedDB checks finish', async () => {
  const api = createStorageSaveApi({ indexedDbAvailable: true });
  const previousTasks = JSON.stringify([{ id: 'old-task' }]);
  const previousSettings = JSON.stringify({});
  const previousTaskView = JSON.stringify({ filter: 'all' });
  const nextTasks = JSON.stringify([{ id: 'new-task' }]);
  api._rememberPersistedDataEntries([
    [api.TASKS_KEY, previousTasks],
    [api.SETTINGS_KEY, previousSettings],
    [api.SIDEBAR_KEY, 'false'],
    [api.ORGANIZE_MEMO_KEY, 'old-memo'],
    [api.TASK_VIEW_KEY, previousTaskView],
  ]);
  api.setRuntimeState({
    tasks: [{ id: 'new-task' }],
    settings: {},
    isSidebarCollapsed: false,
    organizeMemo: 'new-memo',
    taskViewState: { filter: 'all' },
  });

  api.persistRuntimeStateForUnload();

  assert.equal(api.getLocalValue(api.TASKS_KEY), nextTasks);
  assert.equal(api.getLocalValue(api.ORGANIZE_MEMO_KEY), 'new-memo');
  assert.equal(api.getIndexedWrites().length, 0);
  assert.deepEqual([...api.getMemoStatuses()], ['saving']);

  await api.flushAsyncStorage();

  assert.equal(api.getIndexedWrites().length, 1);
  assert.equal(
    api.getIndexedWrites()[0].find(([key]) => key === api.TASKS_KEY)?.[1],
    nextTasks,
  );
  assert.deepEqual([...api.getMemoStatuses()], ['saving', 'saved']);
});

test('persistRuntimeStateForUnload rolls back localStorage when indexedDB conflict is found', async () => {
  const api = createStorageSaveApi({
    indexedDbAvailable: true,
    indexedValues: {
      meta: JSON.stringify({ version: 1, revision: 1, updatedAt: 10 }),
    },
  });
  const previousTasks = JSON.stringify([{ id: 'old-task' }]);
  const previousSettings = JSON.stringify({});
  const previousTaskView = JSON.stringify({ filter: 'all' });
  const nextTasks = JSON.stringify([{ id: 'new-task' }]);
  api._rememberPersistedDataEntries([
    [api.TASKS_KEY, previousTasks],
    [api.SETTINGS_KEY, previousSettings],
    [api.SIDEBAR_KEY, 'false'],
    [api.ORGANIZE_MEMO_KEY, 'old-memo'],
    [api.TASK_VIEW_KEY, previousTaskView],
  ]);
  api.setRuntimeState({
    tasks: [{ id: 'new-task' }],
    settings: {},
    isSidebarCollapsed: false,
    organizeMemo: 'new-memo',
    taskViewState: { filter: 'all' },
  });
  const previousLocalTasks = api.getLocalValue(api.TASKS_KEY);
  const previousLocalMeta = api.getLocalValue(api.STATE_META_KEY);

  api.persistRuntimeStateForUnload();
  assert.equal(api.getLocalValue(api.TASKS_KEY), nextTasks);
  await api.flushAsyncStorage();

  assert.equal(api.getLocalValue(api.TASKS_KEY), previousLocalTasks);
  assert.equal(api.getLocalValue(api.STATE_META_KEY), previousLocalMeta);
  assert.equal(api.getMeta().revision, 0);
  assert.equal(api.getIndexedWrites().length, 0);
  assert.ok(
    api.getIndexedReads().some((keys) => keys.includes(api.STATE_META_KEY)),
  );
  assert.ok(
    api
      .getWarnings()
      .some(
        (warning) =>
          warning.kind === 'persistent' && warning.mode === 'storage-conflict',
      ),
  );
  assert.deepEqual([...api.getMemoStatuses()], ['saving', 'error']);
});

test('delayed unload rollback preserves a newer save made by another tab', async () => {
  const api = createStorageSaveApi({
    indexedValues: {
      meta: JSON.stringify({ version: 1, revision: 1, updatedAt: 10 }),
    },
    indexedReadDelays: [true],
  });
  api._rememberPersistedDataEntries([[api.TASKS_KEY, 'old-tasks']]);
  api.persistRuntimeStateForUnload();
  await api.flushAsyncStorage();
  const newerMeta = JSON.stringify({
    version: 1,
    revision: 2,
    updatedAt: Date.now(),
    writeId: 'other-tab-save',
  });
  api.setLocalValue(api.TASKS_KEY, 'newer-other-tab-tasks');
  api.setLocalValue(api.STATE_META_KEY, newerMeta);
  api.releaseIndexedRead();
  await api.flushAsyncStorage();
  assert.equal(api.getLocalValue(api.TASKS_KEY), 'newer-other-tab-tasks');
  assert.equal(api.getLocalValue(api.STATE_META_KEY), newerMeta);
  assert.ok(
    api.getWarnings().some((warning) => warning.mode === 'storage-conflict'),
  );
});

test('clear completed respects the active task filter', async () => {
  const pendingApi = createClearCompletedApi('pending');
  assert.deepEqual(
    JSON.parse(JSON.stringify(pendingApi.getClearCompletedDeleteCounts())),
    {
      parentCount: 0,
      subtaskCount: 0,
      totalCount: 0,
    },
  );
  assert.equal(await pendingApi.performClearCompleted(), undefined);
  assert.deepEqual(
    JSON.parse(JSON.stringify(pendingApi.getTasks().map((task) => task.id))),
    ['pending-leaf', 'done-leaf', 'mixed-parent', 'done-parent'],
  );

  const completedApi = createClearCompletedApi('completed');
  assert.deepEqual(
    JSON.parse(JSON.stringify(completedApi.getClearCompletedDeleteCounts())),
    {
      parentCount: 2,
      subtaskCount: 3,
      totalCount: 5,
    },
  );
  assert.equal(
    completedApi.buildClearCompletedConfirmMessage(),
    '表示中の完了済み親タスク2件・子タスク3件（合計5件）を削除してもよろしいですか？',
  );

  await completedApi.performClearCompleted();

  const remainingTasks = completedApi.getTasks();
  assert.deepEqual(
    JSON.parse(JSON.stringify(remainingTasks.map((task) => task.id))),
    ['pending-leaf', 'mixed-parent'],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(remainingTasks[1].subtasks.map((sub) => sub.id))),
    ['pending-sub'],
  );
  assert.match(completedApi.getUndoToast().message, /^表示中の完了済み/);
  assert.equal(completedApi.getUndoToast().payload.removedParents.length, 2);
  assert.equal(completedApi.getUndoToast().payload.removedSubtasks.length, 1);
});

test('shared save pending guard blocks unrelated list mutations', async () => {
  const api = createClearCompletedApi('completed');
  const before = api.getTasks();
  api.setStateSavePending(true);

  assert.equal(await api.performClearCompleted(), false);
  assert.deepEqual(api.getTasks(), before);
  assert.equal(api.getUndoToast(), null);
  assert.match(
    extractFunctionSource('addTask'),
    /isStateSaveOperationPending\(\)/,
  );
  assert.match(
    extractFunctionSource('startModalSubtaskDrag'),
    /isAddOperationPending\('subtask'\)/,
  );
});

test('add operations ignore duplicate submissions while save is pending', async () => {
  const api = createAddOperationApi();

  api.setTaskInput('同じ親タスク');
  const taskSave = api.addTask();
  await api.addTask();

  assert.equal(api.getPendingSaveCount(), 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getTasks().map((task) => task.text))),
    ['同じ親タスク', 'Parent'],
  );
  assert.equal(api.getControls().taskInput.disabled, true);
  assert.equal(api.getControls().addBtn.ariaDisabled, 'true');

  api.resolveNextSave(true);
  await taskSave;

  assert.equal(api.getControls().taskInput.value, '');
  assert.equal(api.getControls().taskInput.disabled, false);
  assert.equal(api.getControls().addBtn.ariaDisabled, 'false');

  api.setSubtaskInput('同じ子タスク');
  const subtaskSave = api.addSubtaskFromModal();
  await api.addSubtaskFromModal();

  assert.equal(api.getPendingSaveCount(), 1);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        api
          .getTasks()
          .find((task) => task.id === 'parent')
          .subtasks.map((sub) => sub.text),
      ),
    ),
    ['同じ子タスク'],
  );
  assert.equal(api.getControls().modalSubtaskInput.disabled, true);
  assert.equal(api.getControls().modalAddSubtaskBtn.ariaDisabled, 'true');

  api.resolveNextSave(true);
  await subtaskSave;

  assert.equal(api.getControls().modalSubtaskInput.value, '');
  assert.equal(api.getControls().modalSubtaskInput.disabled, false);
  assert.equal(api.getControls().modalAddSubtaskBtn.ariaDisabled, 'false');

  api.setMessageInput('やるやん');
  const messageSave = api.saveMessage();
  await api.saveMessage();

  assert.equal(api.getPendingSaveCount(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getMessages())), ['やるやん']);
  assert.equal(api.getControls().messageInput.disabled, true);
  assert.equal(api.getControls().messageSaveBtn.ariaDisabled, 'true');

  api.resolveNextSave(true);
  await messageSave;

  assert.equal(api.getControls().messageInput.value, '');
  assert.equal(api.getControls().messageInput.disabled, false);
  assert.equal(api.getControls().messageSaveBtn.ariaDisabled, 'false');
});

test('add operation controls are restored and input is preserved when save fails', async () => {
  const api = createAddOperationApi();

  api.setTaskInput('保存失敗タスク');
  const taskSave = api.addTask();

  assert.equal(api.getControls().taskInput.disabled, true);
  api.resolveNextSave(false);
  await taskSave;

  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getTasks().map((task) => task.text))),
    ['Parent'],
  );
  assert.equal(api.getControls().taskInput.value, '保存失敗タスク');
  assert.equal(api.getControls().taskInput.disabled, false);
  assert.equal(api.getControls().addBtn.ariaDisabled, 'false');
});

test('message edit and delete ignore stale index submissions while save is pending', async () => {
  const deleteApi = createMessageOperationApi(['A', 'B', 'C']);
  const deleteSave = deleteApi.deleteMessage(0);
  await deleteApi.deleteMessage(0);

  assert.equal(deleteApi.getPendingSaveCount(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(deleteApi.getMessages())), [
    'B',
    'C',
  ]);
  assert.equal(deleteApi.getControls().editMessageBtn.ariaDisabled, 'true');
  assert.equal(deleteApi.getControls().deleteMessageBtn.ariaDisabled, 'true');

  deleteApi.resolveNextSave(true);
  await deleteSave;

  assert.deepEqual(JSON.parse(JSON.stringify(deleteApi.getMessages())), [
    'B',
    'C',
  ]);
  assert.equal(deleteApi.getControls().editMessageBtn.ariaDisabled, 'false');
  assert.equal(deleteApi.getControls().deleteMessageBtn.ariaDisabled, 'false');

  const editApi = createMessageOperationApi(['A', 'B', 'C']);
  editApi.editMessage(1);
  editApi.setEditInput(1, 'B edited');
  const editSave = editApi.saveEditedMessage(1);
  await editApi.saveEditedMessage(2);
  await editApi.deleteMessage(0);

  assert.equal(editApi.getPendingSaveCount(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(editApi.getMessages())), [
    'A',
    'B edited',
    'C',
  ]);
  assert.equal(editApi.getControls().messageSaveBtn.ariaDisabled, 'true');
  assert.equal(editApi.getControls().saveMessageEditBtn.ariaDisabled, 'true');

  editApi.resolveNextSave(true);
  await editSave;

  assert.deepEqual(JSON.parse(JSON.stringify(editApi.getMessages())), [
    'A',
    'B edited',
    'C',
  ]);
  assert.equal(editApi.getMessageEditIndex(), null);
  assert.equal(editApi.getControls().messageSaveBtn.ariaDisabled, 'false');
});

test('message edit restores controls and preserves attempted input when save fails', async () => {
  const api = createMessageOperationApi(['A', 'B']);

  api.editMessage(1);
  api.setEditInput(1, 'B failed edit');
  const editSave = api.saveEditedMessage(1);
  api.resolveNextSave(false);
  await editSave;

  assert.deepEqual(JSON.parse(JSON.stringify(api.getMessages())), ['A', 'B']);
  assert.equal(api.getMessageEditIndex(), 1);
  assert.equal(api.getEditInput(1).value, 'B failed edit');
  assert.equal(api.getEditInput(1).disabled, false);
  assert.equal(api.getControls().saveMessageEditBtn.ariaDisabled, 'false');
});

test('task edit modals ignore repeat saves and close attempts while save is pending', async () => {
  const parentApi = createEditOperationApi();
  const parentSave = parentApi.saveParentEdit();
  await parentApi.saveParentEdit();

  assert.equal(parentApi.getPendingSaveCount(), 1);
  assert.equal(parentApi.getControls().parentEditInput.disabled, true);
  assert.equal(parentApi.getControls().saveParentEditBtn.ariaDisabled, 'true');
  assert.equal(
    parentApi.getControls().closeParentModalBtn.ariaDisabled,
    'true',
  );
  assert.equal(parentApi.getControls().modalAddSubtaskBtn.ariaDisabled, 'true');
  assert.equal(
    parentApi.getControls().modalEditSubtaskBtn.ariaDisabled,
    'true',
  );
  assert.equal(
    parentApi.getControls().modalDeleteSubtaskBtn.ariaDisabled,
    'true',
  );
  assert.equal(parentApi.getControls().modalDragHandle.draggable, false);
  assert.equal(parentApi.closeParentModal(), false);
  assert.equal(parentApi.getModalState().parentId, 'parent');

  parentApi.resolveNextSave(false);
  await parentSave;

  assert.equal(parentApi.getTasks()[0].text, 'Parent');
  assert.equal(parentApi.getControls().parentEditInput.value, 'Parent edited');
  assert.equal(parentApi.getControls().parentEditInput.disabled, false);
  assert.equal(parentApi.getControls().saveParentEditBtn.ariaDisabled, 'false');
  assert.deepEqual(
    JSON.parse(JSON.stringify(parentApi.getClosedOverlays())),
    [],
  );

  const subtaskApi = createEditOperationApi();
  const subtaskSave = subtaskApi.saveSubtaskEdit();
  await subtaskApi.saveSubtaskEdit();

  assert.equal(subtaskApi.getPendingSaveCount(), 1);
  assert.equal(subtaskApi.getControls().subtaskEditInput.disabled, true);
  assert.equal(
    subtaskApi.getControls().saveSubtaskEditBtn.ariaDisabled,
    'true',
  );
  assert.equal(
    subtaskApi.getControls().closeSubtaskModalBtn.ariaDisabled,
    'true',
  );
  assert.equal(subtaskApi.closeSubtaskModal(), false);
  assert.equal(subtaskApi.getModalState().subtaskId, 'sub');

  subtaskApi.resolveNextSave(false);
  await subtaskSave;

  assert.equal(subtaskApi.getTasks()[0].subtasks[0].text, 'Subtask');
  assert.equal(
    subtaskApi.getControls().subtaskEditInput.value,
    'Subtask edited',
  );
  assert.equal(subtaskApi.getControls().subtaskEditInput.disabled, false);
  assert.equal(
    subtaskApi.getControls().saveSubtaskEditBtn.ariaDisabled,
    'false',
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(subtaskApi.getClosedOverlays())),
    [],
  );
});

test('focus operations ignore competing focus actions while save is pending', async () => {
  const api = createFocusOperationApi();

  const firstStart = api.openFocusModal('parent', 'a');
  await api.openFocusModal('parent', 'b');

  assert.equal(api.getPendingSaveCount(), 1);
  assert.equal(api.getTasks()[0].focus.focusState, 'running');
  assert.equal(api.getTasks()[1].focus.focusState, 'idle');
  assert.equal(api.getControls().startAButton.ariaDisabled, 'true');
  assert.equal(api.getControls().startBButton.ariaDisabled, 'true');
  assert.equal(api.getControls().blockedStartButton.ariaDisabled, 'true');

  api.resolveNextSave(true);
  await firstStart;

  assert.equal(api.getFocusState().parentId, 'a');
  assert.equal(api.getControls().startAButton.ariaDisabled, 'false');
  assert.equal(api.getControls().blockedStartButton.ariaDisabled, 'true');
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSounds())), ['start']);

  api.setNow(2500);
  const completeSave = api.completeFocus();
  api.abortFocus();
  await api.performAbortFocus({
    type: 'parent',
    parentId: 'a',
    subtaskId: null,
  });

  assert.equal(api.getPendingSaveCount(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getConfirmations())), []);
  assert.equal(api.getTasks()[0].done, true);
  assert.equal(api.getTasks()[0].focus.focusState, 'idle');
  assert.equal(api.getTasks()[0].focus.elapsedMs, 1500);
  assert.equal(api.getControls().focusAbortBtn.ariaDisabled, 'true');

  api.resolveNextSave(true);
  await completeSave;

  assert.equal(api.getTasks()[0].done, true);
  assert.equal(api.getTasks()[0].focus.elapsedMs, 1500);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getClosedOverlays())), [
    'focus',
  ]);
});

test('keyboard reorder uses visible parent rows under the active filter', async () => {
  const api = createKeyboardReorderApi(
    [
      { id: 'pending-a', text: 'Pending A', done: false, subtasks: [] },
      { id: 'done-hidden', text: 'Done Hidden', done: true, subtasks: [] },
      { id: 'pending-b', text: 'Pending B', done: false, subtasks: [] },
    ],
    'pending',
    {
      type: 'parent',
      parentId: 'pending-a',
    },
  );

  assert.deepEqual(JSON.parse(JSON.stringify(api.getVisibleParentTaskIds())), [
    'pending-a',
    'pending-b',
  ]);
  assert.equal(await api._moveFocusedTaskRowByOffset(1), true);

  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getTasks().map((task) => task.id))),
    ['done-hidden', 'pending-b', 'pending-a'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.getVisibleParentTaskIds())), [
    'pending-b',
    'pending-a',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getRestoredFocus())), {
    type: 'parent',
    parentId: 'pending-a',
    subId: null,
  });
});

test('keyboard reorder uses visible subtask rows under the active filter', async () => {
  const api = createKeyboardReorderApi(
    [
      {
        id: 'parent',
        text: 'Parent',
        done: false,
        subtasks: [
          { id: 'pending-a', text: 'Pending A', done: false },
          { id: 'done-hidden', text: 'Done Hidden', done: true },
          { id: 'pending-b', text: 'Pending B', done: false },
        ],
      },
    ],
    'pending',
    {
      type: 'subtask',
      parentId: 'parent',
      subId: 'pending-a',
    },
  );

  const getSubtaskIds = () => api.getTasks()[0].subtasks.map((sub) => sub.id);
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getVisibleSubtaskIds(api.getTasks()[0]))),
    ['pending-a', 'pending-b'],
  );
  assert.equal(await api._moveFocusedTaskRowByOffset(1), true);

  assert.deepEqual(JSON.parse(JSON.stringify(getSubtaskIds())), [
    'done-hidden',
    'pending-b',
    'pending-a',
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.getVisibleSubtaskIds(api.getTasks()[0]))),
    ['pending-b', 'pending-a'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.getRestoredFocus())), {
    type: 'subtask',
    parentId: 'parent',
    subId: 'pending-a',
  });
});

test('pomodoro persistence sync excludes break time from focus elapsed', () => {
  const api = createPomodoroApi();
  const target = {
    focus: {
      focusState: 'running',
      elapsedMs: 0,
      startedAt: 0,
    },
    subtasks: [],
  };
  api.setActiveTask(target);

  assert.equal(api.syncRunningFocusElapsedForPersist(1500), true);
  assert.equal(target.focus.elapsedMs, 1000);
  assert.equal(target.focus.startedAt, null);
  assert.equal(api.focusState.pomodoroPhase, 'break');
  assert.equal(api.focusState.pomodoroPhaseRemainingMs, 500);

  assert.equal(api.syncRunningFocusElapsedForPersist(2500), true);
  assert.equal(target.focus.elapsedMs, 1500);
  assert.equal(target.focus.startedAt, 2500);
  assert.equal(api.focusState.pomodoroPhase, 'focus');
  assert.equal(api.focusState.pomodoroPhaseRemainingMs, 500);
});

test('pomodoro catches up across phase boundaries and a 30-day background interval without counting breaks', () => {
  for (const [focusMinutes, breakMinutes] of [
    [1, 1],
    [25, 5],
    [180, 120],
  ]) {
    const api = createPomodoroApi();
    const focusMs = focusMinutes * 60000;
    const breakMs = breakMinutes * 60000;
    const cycleMs = focusMs + breakMs;
    Object.assign(api.focusState, {
      pomodoroFocusMs: focusMs,
      pomodoroBreakMs: breakMs,
      pomodoroPhaseEndsAt: focusMs,
      pomodoroPhaseRemainingMs: focusMs,
    });
    const target = {
      focus: { focusState: 'running', elapsedMs: 0, startedAt: 0 },
      subtasks: [],
    };
    api.setActiveTask(target);
    const times = [
      0,
      focusMs - 1,
      focusMs,
      cycleMs - 1,
      cycleMs,
      cycleMs + 1000,
      30 * 86400000,
    ];
    for (const now of times) {
      api.syncRunningFocusElapsedForPersist(now);
      const remainder = now % cycleMs;
      const expected =
        Math.floor(now / cycleMs) * focusMs + Math.min(remainder, focusMs);
      assert.equal(target.focus.elapsedMs, expected);
      assert.equal(
        api.focusState.pomodoroPhase,
        remainder < focusMs ? 'focus' : 'break',
      );
      const phaseEnd = remainder < focusMs ? focusMs : cycleMs;
      assert.equal(
        api.focusState.pomodoroPhaseRemainingMs,
        phaseEnd - remainder,
      );
    }
  }
});

function storageFixture(taskIds, meta, memo = 'memo') {
  return {
    tasks: JSON.stringify(
      taskIds.map((id) => ({ id, text: id, done: false, subtasks: [] })),
    ),
    settings: '{}',
    sidebar: 'false',
    memo,
    'task-view': '{"filter":"all"}',
    meta: JSON.stringify(meta),
  };
}

function copyLocalStorage(api, values) {
  Object.entries(values).forEach(([key, value]) =>
    api.setLocalValue(key, value),
  );
}

function readStorageFixture(api, method = 'getLocalValue') {
  return Object.fromEntries(
    ['tasks', 'settings', 'sidebar', 'memo', 'task-view', 'meta'].map((key) => [
      key,
      api[method](key),
    ]),
  );
}

for (const operation of ['save', 'persistOrganizeMemoLocalCheckpoint']) {
  for (const failedRead of [true, false]) {
    test(`${operation} protects other-tab data through restart when conflict read ${failedRead ? 'fails' : 'succeeds'}`, async () => {
      const base = storageFixture(['original'], {
        revision: 3,
        updatedAt: 10,
        writeId: 'base',
      });
      const other = storageFixture(['original', 'other-tab-task'], {
        version: 1,
        revision: 4,
        updatedAt: 20,
        writeId: 'other',
        writerId: 'other-tab',
      });
      const api = createStorageSaveApi({
        indexedValues: base,
        indexedReadFailures: [false, failedRead],
      });
      copyLocalStorage(api, base);
      await api.initialize();
      Object.entries(other).forEach(([key, value]) =>
        api.setIndexedValue(key, value),
      );
      const localWrites = api.getLocalWrites().length;
      const indexedWrites = api.getIndexedWrites().length;
      api.setRuntimeState({
        tasks: JSON.parse(
          storageFixture(['original', 'this-tab-task'], {}).tasks,
        ),
        organizeMemo: 'draft',
      });

      assert.equal(await api[operation](), false);
      await api.flushAsyncStorage();
      assert.equal(api.getLocalWrites().length, localWrites);
      assert.equal(api.getIndexedWrites().length, indexedWrites);
      assert.deepEqual(readStorageFixture(api), base);
      assert.deepEqual(readStorageFixture(api, 'getIndexedValue'), other);
      assert.equal(api.isWarningVisible(), true);
      assert.ok(
        api
          .getWarnings()
          .some(
            (warning) =>
              warning.mode ===
              (failedRead ? 'indexeddb-read' : 'storage-conflict'),
          ),
      );
      if (failedRead) {
        assert.equal(
          api
            .getWarnings()
            .some((warning) => warning.mode === 'storage-conflict'),
          false,
        );
        // 読み込み復旧時は競合する書き込みを検出し、下書きを無条件で再保存しない。
        assert.equal(await api[operation](), false);
        assert.deepEqual(readStorageFixture(api), base);
      }

      const restarted = createStorageSaveApi({
        indexedValues: readStorageFixture(api, 'getIndexedValue'),
      });
      copyLocalStorage(restarted, readStorageFixture(api));
      await restarted.initialize();
      await restarted.flushAsyncStorage();
      assert.equal(
        Object.fromEntries(restarted.getRuntimeEntries()).tasks,
        other.tasks,
      );
      assert.deepEqual(readStorageFixture(restarted), other);
      assert.deepEqual(readStorageFixture(restarted, 'getIndexedValue'), other);
    });
  }

  test(`${operation} retries the retained draft after a transient read failure without a competing write`, async () => {
    const base = storageFixture(['original'], {
      revision: 3,
      updatedAt: 10,
      writeId: 'base',
    });
    const api = createStorageSaveApi({
      indexedValues: base,
      indexedReadFailures: [false, true],
    });
    copyLocalStorage(api, base);
    await api.initialize();
    api.setRuntimeState({ organizeMemo: 'retained draft' });
    assert.equal(await api[operation](), false);
    assert.deepEqual(readStorageFixture(api), base);
    assert.equal(
      Object.fromEntries(api.getRuntimeEntries()).memo,
      'retained draft',
    );
    assert.equal(api.isWarningVisible(), true);

    assert.equal(await api[operation](), true);
    // メモのチェックポイント後に通常の全体保存を行い、IndexedDBへ反映する。
    assert.equal(await api.save(), true);
    await api.flushAsyncStorage();
    assert.equal(api.getLocalValue('memo'), 'retained draft');
    assert.equal(api.getIndexedValue('memo'), 'retained draft');
    assert.deepEqual(
      readStorageFixture(api),
      readStorageFixture(api, 'getIndexedValue'),
    );
    assert.equal(api.isWarningVisible(), false);
  });
}

for (const indexedDbAvailable of [false, true]) {
  test(`missing IndexedDB metadata permits saving when IndexedDB is ${indexedDbAvailable ? 'empty' : 'unsupported'}`, async () => {
    const api = createStorageSaveApi({ indexedDbAvailable });
    assert.equal(await api.save(), true);
    api.setRuntimeState({ organizeMemo: 'memo checkpoint' });
    assert.equal(await api.persistOrganizeMemoLocalCheckpoint(), true);
    assert.equal(await api.save(), true);
    await api.flushAsyncStorage();
    assert.equal(api.getLocalValue('memo'), 'memo checkpoint');
    if (indexedDbAvailable)
      assert.equal(api.getIndexedValue('memo'), 'memo checkpoint');
    assert.equal(api.isWarningVisible(), false);
  });
}

test('failed unload verification retains its provisional checkpoint and read warning until a safe retry', async () => {
  const base = storageFixture(['original'], {
    revision: 3,
    updatedAt: 10,
    writeId: 'base',
  });
  const api = createStorageSaveApi({
    indexedValues: base,
    indexedReadFailures: [false, true],
  });
  copyLocalStorage(api, base);
  await api.initialize();
  api.setRuntimeState({ organizeMemo: 'last draft' });
  api.persistRuntimeStateForUnload();
  const provisional = readStorageFixture(api);
  await api.flushAsyncStorage();
  assert.deepEqual(readStorageFixture(api), provisional);
  assert.ok(JSON.parse(provisional.meta).unloadBase);
  assert.equal(api.isWarningVisible(), true);
  assert.equal(
    api.getWarnings().some((warning) => warning.mode === 'storage-conflict'),
    false,
  );
  assert.equal(await api.save(), true);
  await api.flushAsyncStorage();
  assert.equal(api.getIndexedValue('memo'), 'last draft');
  assert.equal(JSON.parse(api.getLocalValue('meta')).unloadBase, undefined);
});

test('restart after an interrupted unload keeps an IndexedDB-only concurrent task', async () => {
  const base = { revision: 0, updatedAt: 0, writeId: '' };
  const confirmed = storageFixture(['old', 'other-tab-task'], {
    revision: 1,
    updatedAt: 10,
    writeId: 'other-tab-write',
    writerId: 'other-tab',
    base,
  });
  const original = storageFixture(['old'], base);
  const leaving = createStorageSaveApi({
    indexedValues: confirmed,
    indexedReadDelays: [true],
  });
  copyLocalStorage(leaving, original);
  leaving._rememberPersistedDataEntries(
    Object.entries(original).filter(([key]) => key !== 'meta'),
  );
  leaving.setRuntimeState({
    tasks: JSON.parse(original.tasks),
    organizeMemo: 'unsaved memo',
  });
  leaving.persistRuntimeStateForUnload();
  await leaving.flushAsyncStorage();
  const interrupted = readStorageFixture(leaving);
  assert.deepEqual(JSON.parse(interrupted.meta).unloadBase, base);
  assert.ok(JSON.parse(interrupted.meta).updatedAt > 10);

  // 新しい実行環境には保存済みデータだけを渡し、旧ページのPromiseは引き継がない。
  const restarted = createStorageSaveApi({ indexedValues: confirmed });
  copyLocalStorage(restarted, interrupted);
  await restarted.initialize();
  assert.equal(
    Object.fromEntries(restarted.getRuntimeEntries()).tasks,
    confirmed.tasks,
  );
  assert.equal(restarted.getLocalValue('tasks'), confirmed.tasks);
  assert.equal(restarted.getIndexedValue('tasks'), confirmed.tasks);
  assert.equal(
    JSON.parse(restarted.getLocalValue('meta')).unloadBase,
    undefined,
  );
  assert.ok(
    restarted
      .getWarnings()
      .some((warning) => warning.mode === 'storage-unload-conflict'),
  );

  restarted.setRuntimeState({ organizeMemo: 'after recovery' });
  assert.equal(await restarted.save(), true);
  await restarted.flushAsyncStorage();
  assert.equal(restarted.getIndexedValue('tasks'), confirmed.tasks);
  assert.equal(restarted.getIndexedValue('memo'), 'after recovery');
});

test('repeated unload checkpoints preserve the original conflict baseline', async () => {
  const base = { revision: 0, updatedAt: 0, writeId: '' };
  const confirmed = storageFixture(['other-tab-task'], {
    revision: 1,
    updatedAt: 10,
    writeId: 'other',
  });
  const leaving = createStorageSaveApi({
    indexedValues: confirmed,
    indexedReadDelays: [true],
  });
  leaving.persistRuntimeStateForUnload();
  await leaving.flushAsyncStorage();
  leaving.setRuntimeState({ organizeMemo: 'second checkpoint' });
  leaving.persistRuntimeStateForUnload();
  const interrupted = readStorageFixture(leaving);
  assert.equal(JSON.parse(interrupted.meta).revision, 2);
  assert.deepEqual(JSON.parse(interrupted.meta).unloadBase, base);
  const restarted = createStorageSaveApi({ indexedValues: confirmed });
  copyLocalStorage(restarted, interrupted);
  await restarted.initialize();
  assert.equal(restarted.getLocalValue('tasks'), confirmed.tasks);
  assert.equal(restarted.getIndexedValue('tasks'), confirmed.tasks);
});

test('restart confirms a nonconflicting unload and retains the latest memo', async () => {
  const base = { revision: 3, updatedAt: 10, writeId: 'baseline' };
  const confirmed = storageFixture(['old'], base);
  const checkpoint = storageFixture(
    ['old', 'new-task'],
    {
      revision: 4,
      updatedAt: 20,
      writeId: 'checkpoint',
      base,
      unloadBase: base,
    },
    'latest memo',
  );
  const restarted = createStorageSaveApi({ indexedValues: confirmed });
  copyLocalStorage(restarted, checkpoint);
  await restarted.initialize();
  await restarted.flushAsyncStorage();
  assert.equal(restarted.getLocalValue('tasks'), checkpoint.tasks);
  assert.equal(restarted.getIndexedValue('tasks'), checkpoint.tasks);
  assert.equal(restarted.getIndexedValue('memo'), 'latest memo');
  assert.equal(
    JSON.parse(restarted.getLocalValue('meta')).unloadBase,
    undefined,
  );
  const writesBeforeNoOp = restarted.getLocalWrites().length;
  assert.equal(await restarted.save(), true);
  assert.equal(restarted.getLocalWrites().length, writesBeforeNoOp);
});

test('failed IndexedDB verification never upgrades an unverified unload to a confirmed save', async () => {
  const base = { revision: 3, updatedAt: 10, writeId: 'baseline' };
  const checkpoint = storageFixture(['old'], {
    revision: 4,
    updatedAt: 20,
    writeId: 'checkpoint',
    base,
    unloadBase: base,
  });
  const restarted = createStorageSaveApi({ indexedReadFailures: [true, true] });
  copyLocalStorage(restarted, checkpoint);
  await restarted.initialize();
  restarted.setRuntimeState({
    tasks: [{ id: 'old' }],
    organizeMemo: 'later draft',
  });
  const writes = restarted.getLocalWrites().length;
  assert.equal(await restarted.save(), false);
  assert.equal(restarted.getLocalWrites().length, writes);
  assert.equal(restarted.getLocalValue('meta'), checkpoint.meta);
  assert.equal(restarted.getIndexedWrites().length, 0);
});

test('startup recovery never replaces a local write made while IndexedDB was loading', async () => {
  const base = { revision: 0, updatedAt: 0, writeId: '' };
  const checkpoint = storageFixture(['old'], {
    revision: 1,
    updatedAt: 20,
    writeId: 'checkpoint',
    base,
    unloadBase: base,
  });
  const confirmed = storageFixture(['other'], {
    revision: 1,
    updatedAt: 10,
    writeId: 'other',
  });
  const restarted = createStorageSaveApi({
    indexedValues: confirmed,
    indexedReadDelays: [true],
  });
  copyLocalStorage(restarted, checkpoint);
  const init = restarted.initialize();
  const latest = storageFixture(['latest-local'], {
    revision: 2,
    updatedAt: 30,
    writeId: 'latest',
  });
  copyLocalStorage(restarted, latest);
  restarted.releaseIndexedRead();
  await init;
  assert.equal(restarted.getLocalValue('tasks'), latest.tasks);
  assert.equal(
    Object.fromEntries(restarted.getRuntimeEntries()).tasks,
    latest.tasks,
  );
});

test('local recovery failure preserves the IndexedDB winner', async () => {
  const base = { revision: 0, updatedAt: 0, writeId: '' };
  const checkpoint = storageFixture(['old'], {
    revision: 2,
    updatedAt: 20,
    writeId: 'checkpoint',
    base,
    unloadBase: base,
  });
  const confirmed = storageFixture(['other'], {
    revision: 1,
    updatedAt: 10,
    writeId: 'other',
  });
  const restarted = createStorageSaveApi({
    indexedValues: confirmed,
    failLocalKeys: ['tasks'],
  });
  copyLocalStorage(restarted, checkpoint);
  await restarted.initialize();
  assert.equal(
    Object.fromEntries(restarted.getRuntimeEntries()).tasks,
    confirmed.tasks,
  );
  assert.equal(restarted.getIndexedValue('tasks'), confirmed.tasks);
  assert.equal(restarted.getLocalValue('tasks'), checkpoint.tasks);
  assert.equal(restarted.getIndexedWrites().length, 0);
  assert.ok(
    restarted
      .getWarnings()
      .some((warning) => warning.mode === 'storage-unload-conflict'),
  );
});

test('a completed unload verification clears the marker and mirrors the confirmed data', async () => {
  const api = createStorageSaveApi();
  api.persistRuntimeStateForUnload();
  assert.ok(JSON.parse(api.getLocalValue('meta')).unloadBase);
  await api.flushAsyncStorage();
  assert.equal(JSON.parse(api.getLocalValue('meta')).unloadBase, undefined);
  assert.equal(api.getIndexedValue('tasks'), api.getLocalValue('tasks'));
  assert.equal(api.getIndexedValue('meta'), api.getLocalValue('meta'));
});

test('successive unload saves never publish an older memo after the latest synchronous checkpoint', async () => {
  const api = createStorageSaveApi({ indexedDbAvailable: true });
  api.setRuntimeState({ organizeMemo: 'first departure' });
  api.persistRuntimeStateForUnload();
  api.setRuntimeState({ organizeMemo: 'latest departure' });
  api.persistRuntimeStateForUnload();
  await api.flushAsyncStorage();
  const values = api
    .getLocalWrites()
    .filter(([key]) => key === api.ORGANIZE_MEMO_KEY)
    .map(([, value]) => value);
  const latestIndex = values.indexOf('latest departure');
  assert.ok(latestIndex >= 0);
  assert.ok(
    values.slice(latestIndex).every((value) => value === 'latest departure'),
    JSON.stringify(values),
  );
  assert.equal(api.getIndexedValue(api.ORGANIZE_MEMO_KEY), 'latest departure');
});

test('local-only environments keep synchronous unload persistence without a verification marker', () => {
  const api = createStorageSaveApi({ indexedDbAvailable: false });
  api.setRuntimeState({
    tasks: [{ id: 'local-task' }],
    organizeMemo: 'last draft',
  });
  api.persistRuntimeStateForUnload();
  assert.equal(
    api.getLocalValue('tasks'),
    JSON.stringify([{ id: 'local-task' }]),
  );
  assert.equal(api.getLocalValue('memo'), 'last draft');
  assert.equal(JSON.parse(api.getLocalValue('meta')).unloadBase, undefined);
});

test('a valid unload checkpoint still repairs a malformed IndexedDB snapshot', async () => {
  const base = { revision: 3, updatedAt: 10, writeId: 'baseline' };
  const checkpoint = storageFixture(
    ['recoverable-task'],
    {
      revision: 5,
      updatedAt: 30,
      writeId: 'checkpoint',
      base,
      unloadBase: base,
    },
    'recoverable memo',
  );
  const invalid = storageFixture([], {
    revision: 4,
    updatedAt: 20,
    writeId: 'corrupt',
  });
  invalid.tasks = '{"not":"an array"}';
  const restarted = createStorageSaveApi({ indexedValues: invalid });
  copyLocalStorage(restarted, checkpoint);
  await restarted.initialize();
  await restarted.flushAsyncStorage();
  assert.equal(restarted.getIndexedValue('tasks'), checkpoint.tasks);
  assert.equal(restarted.getIndexedValue('memo'), checkpoint.memo);
  assert.equal(
    JSON.parse(restarted.getLocalValue('meta')).unloadBase,
    undefined,
  );
});

// 課題42：事前のメタデータ読み込みに加え、コミット時点の境界も検証する。
for (const operation of ['save', 'persistOrganizeMemoLocalCheckpoint']) {
  for (const phase of ['after-read', 'at-commit']) {
    test(`${operation} rejects a competing IndexedDB write ${phase} and restores it on restart`, async () => {
      const base = storageFixture(['original'], {
        revision: 3,
        updatedAt: 10,
        writeId: 'base',
      });
      const other = storageFixture(['original', 'other-task'], {
        revision: 4,
        updatedAt: 20,
        writeId: 'other',
        writerId: 'other-tab',
      });
      const api = createStorageSaveApi({
        indexedValues: base,
        indexedReadDelays: [false, phase === 'after-read'],
        indexedWriteDelays: [false, phase === 'at-commit'],
      });
      copyLocalStorage(api, base);
      await api.initialize();
      await api.flushAsyncStorage();
      api.setRuntimeState({ organizeMemo: 'my draft' });
      const saving = api[operation]();
      await api.flushAsyncStorage();
      Object.entries(other).forEach(([key, value]) =>
        api.setIndexedValue(key, value),
      );
      if (phase === 'after-read') api.releaseIndexedRead();
      else api.releaseIndexedWrite();
      assert.equal(await saving, false);
      assert.equal(api.isWarningVisible(), true);
      assert.deepEqual(readStorageFixture(api), base);
      assert.deepEqual(readStorageFixture(api, 'getIndexedValue'), other);
      assert.equal(api.getMeta().revision, 3);
      const restarted = createStorageSaveApi({ indexedValues: other });
      copyLocalStorage(restarted, readStorageFixture(api));
      await restarted.initialize();
      assert.equal(
        Object.fromEntries(restarted.getRuntimeEntries()).tasks,
        other.tasks,
      );
    });
  }

  test(`${operation} never acknowledges or publishes a write before its transaction commits`, async () => {
    const base = storageFixture(['original'], {
      revision: 3,
      updatedAt: 10,
      writeId: 'base',
    });
    const api = createStorageSaveApi({
      indexedValues: base,
      indexedWriteDelays: [false, true],
    });
    copyLocalStorage(api, base);
    await api.initialize();
    await api.flushAsyncStorage();
    api.setRuntimeState({ organizeMemo: 'my draft' });
    let settled = false;
    const saving = api[operation]().then((ok) => {
      settled = true;
      return ok;
    });
    await api.flushAsyncStorage();
    assert.equal(settled, false);
    assert.deepEqual(readStorageFixture(api), base);
    api.releaseIndexedWrite();
    assert.equal(await saving, true);
    assert.equal(api.getIndexedValue('memo'), 'my draft');
    assert.equal(api.getLocalValue('memo'), 'my draft');
    assert.deepEqual(
      readStorageFixture(api),
      readStorageFixture(api, 'getIndexedValue'),
    );
  });
}

for (const committed of [false, true]) {
  test(`restart during an in-flight save and repeated unload preserves ${committed ? 'the latest own draft' : 'the competing task'}`, async () => {
    const base = storageFixture(['original'], {
      revision: 3,
      updatedAt: 10,
      writeId: 'base',
    });
    const other = storageFixture(['original', 'other-task'], {
      revision: 3,
      updatedAt: 20,
      writeId: 'same-generation-competitor',
      writerId: 'other-tab',
    });
    const api = createStorageSaveApi({
      indexedValues: base,
      indexedWriteDelays: [false, true],
    });
    copyLocalStorage(api, base);
    await api.initialize();
    await api.flushAsyncStorage();
    api.setRuntimeState({ organizeMemo: 'first draft' });
    const saving = api.save();
    await api.flushAsyncStorage();
    api.setRuntimeState({ organizeMemo: 'second draft' });
    api.persistRuntimeStateForUnload();
    api.setRuntimeState({ organizeMemo: 'last draft' });
    api.persistRuntimeStateForUnload();
    const interrupted = readStorageFixture(api);
    assert.equal(interrupted.memo, 'last draft');
    if (!committed)
      Object.entries(other).forEach(([key, value]) =>
        api.setIndexedValue(key, value),
      );
    api.releaseIndexedWrite();
    assert.equal(await saving, committed);
    // ページ終了時の保存内容を固定し、最初のトランザクション結果だけを残す。
    const indexed = committed
      ? storageFixture(
          ['original'],
          {
            ...JSON.parse(api.getIndexedValue('meta')),
          },
          api.getIndexedValue('memo'),
        )
      : other;
    const restarted = createStorageSaveApi({ indexedValues: indexed });
    copyLocalStorage(restarted, interrupted);
    await restarted.initialize();
    await restarted.flushAsyncStorage();
    assert.equal(
      Object.fromEntries(restarted.getRuntimeEntries()).tasks,
      committed ? base.tasks : other.tasks,
    );
    assert.equal(
      Object.fromEntries(restarted.getRuntimeEntries()).memo,
      committed ? 'last draft' : other.memo,
    );
    assert.equal(
      JSON.parse(restarted.getLocalValue('meta')).unloadBase,
      undefined,
    );
  });
}

test('startup recovers a previously split same-generation save from the transactional backend', async () => {
  const local = storageFixture(['original'], {
    revision: 4,
    updatedAt: 30,
    writeId: 'old-bug',
    writerId: 'local-tab',
  });
  const indexed = storageFixture(['original', 'other-task'], {
    revision: 4,
    updatedAt: 20,
    writeId: 'committed',
    writerId: 'other-tab',
  });
  const api = createStorageSaveApi({ indexedValues: indexed });
  copyLocalStorage(api, local);
  await api.initialize();
  assert.equal(
    Object.fromEntries(api.getRuntimeEntries()).tasks,
    indexed.tasks,
  );
  assert.equal(api.getLocalValue('tasks'), indexed.tasks);
  assert.equal(api.isWarningVisible(), true);
});

test('a preflight superseded by unload does not acknowledge an unverified competing draft', async () => {
  const base = storageFixture(['original'], {
    revision: 3,
    updatedAt: 10,
    writeId: 'base',
  });
  const other = storageFixture(['original', 'other-task'], {
    revision: 4,
    updatedAt: 20,
    writeId: 'other',
  });
  const api = createStorageSaveApi({
    indexedValues: base,
    indexedReadDelays: [false, true],
  });
  copyLocalStorage(api, base);
  await api.initialize();
  api.setRuntimeState({ organizeMemo: 'draft' });
  const saving = api.save();
  await api.flushAsyncStorage();
  api.persistRuntimeStateForUnload();
  Object.entries(other).forEach(([key, value]) =>
    api.setIndexedValue(key, value),
  );
  api.releaseIndexedRead();
  assert.equal(await saving, false);
  await api.flushAsyncStorage();
  assert.equal(api.isWarningVisible(), true);
  assert.deepEqual(readStorageFixture(api, 'getIndexedValue'), other);
});

test('an IndexedDB commit failure cannot be masked by writable localStorage', async () => {
  const base = storageFixture(['original'], {
    revision: 3,
    updatedAt: 10,
    writeId: 'base',
  });
  const api = createStorageSaveApi({
    indexedValues: base,
    indexedResults: [true, false, true],
  });
  copyLocalStorage(api, base);
  await api.initialize();
  await api.flushAsyncStorage();
  const indexedBefore = readStorageFixture(api, 'getIndexedValue');
  api.setRuntimeState({ organizeMemo: 'retry draft' });
  assert.equal(await api.save(), false);
  assert.deepEqual(readStorageFixture(api), base);
  assert.deepEqual(readStorageFixture(api, 'getIndexedValue'), indexedBefore);
  assert.equal(api.getMeta().revision, 3);
  assert.equal(api.isWarningVisible(), true);
  assert.equal(await api.save(), true);
  assert.equal(api.getIndexedValue('memo'), 'retry draft');
  assert.equal(api.getLocalValue('memo'), 'retry draft');
});
