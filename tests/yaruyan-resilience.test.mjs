import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { html, source } = loadAppSource();

function normalizationApi() {
  const names = [
    'normalizeInputText',
    'normalizeNonNegativeNumber',
    'normalizeEntityId',
    'normalizeMessageList',
    'normalizePomodoroMinutes',
    'normalizePomodoroSettings',
    'createFocusMeta',
    'normalizeFocusMeta',
    'normalizeTasks',
    '_normalizeStorageMetaRecord',
    '_createStorageMetaIdentity',
  ];
  const constants = [
    'MAX_TASK_TEXT_LENGTH',
    'MAX_SUBTASK_TEXT_LENGTH',
    'MAX_PARENT_TASK_COUNT',
    'MAX_SUBTASK_COUNT_PER_PARENT',
    'MAX_MESSAGE_TEXT_LENGTH',
    'MAX_MESSAGE_COUNT',
    'SAFE_ENTITY_ID_PATTERN',
    'MIN_POMODORO_MINUTES',
    'MAX_POMODORO_FOCUS_MINUTES',
    'MAX_POMODORO_BREAK_MINUTES',
    'DEFAULT_POMODORO_FOCUS_MINUTES',
    'DEFAULT_POMODORO_BREAK_MINUTES',
  ];
  return vm.runInNewContext(`
    ${constants.map((name) => html.match(new RegExp(`const ${name} = [^\\n]+`))[0]).join('\n')}
    let nextId = 0;
    function uid() { return 'repaired-' + ++nextId; }
    ${names.map(source).join('\n')}
    ({ ${names.join(',')} })
  `);
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const invalidScalars = [
  null,
  {},
  [],
  [12],
  { toString: null },
  { toString: {}, valueOf: null },
];

test('static and generated controls never reintroduce native title tooltips', () => {
  assert.doesNotMatch(html, /\stitle\s*=/);
  assert.doesNotMatch(html, /(?<!document)\.title\s*=/);
  assert.doesNotMatch(html, /setAttribute\(['"]title['"]/);
  assert.doesNotMatch(html, /data-tooltip(?:-source)?/);
});

test('malformed task fields cannot stop recovery of healthy tasks and children', () => {
  const api = normalizationApi();
  for (const value of invalidScalars) {
    const result = api.normalizeTasks([
      { id: 'bad-text', text: value },
      {
        id: value,
        text: 'Keep parent',
        focus: { elapsedMs: value, startedAt: value },
        subtasks: [
          { id: 'bad-child', text: value },
          { id: value, text: 'Keep child', focus: { elapsedMs: value } },
        ],
      },
      { id: 'healthy', text: 'Keep healthy task' },
    ]);
    assert.deepEqual(plain(result.map((task) => task.text)), [
      'Keep parent',
      'Keep healthy task',
    ]);
    assert.deepEqual(plain(result[0].subtasks.map((sub) => sub.text)), [
      'Keep child',
    ]);
    assert.match(result[0].id, /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
    assert.equal(result[0].subtasks[0].focus.elapsedMs, 0);
  }
});

test('only a boolean true marks imported work complete', () => {
  const api = normalizationApi();
  for (const done of ['false', 'true', 1, {}, [], null, false, true]) {
    const result = api.normalizeTasks([
      { id: 'leaf', text: 'Leaf', done },
      {
        id: 'parent',
        text: 'Parent',
        subtasks: [{ id: 'child', text: 'Child', done }],
      },
    ]);
    assert.equal(result[0].done, done === true);
    assert.equal(result[1].done, done === true);
    assert.equal(result[1].subtasks[0].done, done === true);
  }
});

test('invalid messages and timer values use safe defaults without object coercion', () => {
  const api = normalizationApi();
  assert.deepEqual(
    plain(api.normalizeMessageList([...invalidScalars, 'Keep message'])),
    ['Keep message'],
  );
  for (const value of [...invalidScalars, true, false, '', '   ']) {
    assert.deepEqual(
      plain(
        api.normalizePomodoroSettings({
          focusMinutes: value,
          breakMinutes: value,
        }),
      ),
      { enabled: false, focusMinutes: 25, breakMinutes: 5 },
    );
  }
  assert.equal(
    api.createFocusMeta({ elapsedMs: { toString: null } }).elapsedMs,
    0,
  );
  assert.equal(api.createFocusMeta({ elapsedMs: '1200' }).elapsedMs, 1200);
  assert.equal(
    api.normalizePomodoroSettings({ focusMinutes: '50' }).focusMinutes,
    50,
  );
});

test('storage metadata ignores nested ancestry and malformed numeric fields', () => {
  const api = normalizationApi();
  const identity = { revision: 4, updatedAt: 200, writeId: 'baseline' };
  const cycle = { ...identity };
  cycle.base = cycle;
  const result = api._normalizeStorageMetaRecord({
    revision: 5,
    updatedAt: 300,
    writeId: 'current',
    base: cycle,
    unloadBase: cycle,
  });
  assert.deepEqual(plain(result.base), identity);
  assert.deepEqual(plain(result.unloadBase), identity);
  assert.doesNotThrow(() =>
    api._normalizeStorageMetaRecord({
      revision: { toString: null },
      updatedAt: [1],
      writeId: 'corrupt',
    }),
  );
});

test('deeply nested metadata from JSON is reduced to a shallow identity', () => {
  const api = normalizationApi();
  const prefix = '{"revision":4,"updatedAt":200,"writeId":"baseline","base":';
  const nested = JSON.parse(prefix.repeat(5000) + 'null' + '}'.repeat(5000));
  const result = api._normalizeStorageMetaRecord(nested);
  assert.deepEqual(plain(result.base), {
    revision: 4,
    updatedAt: 200,
    writeId: 'baseline',
  });
  assert.equal(JSON.stringify(result).length < 200, true);
});

test('repaired task data remains stable across subsequent reloads', () => {
  const api = normalizationApi();
  const values = [
    ...invalidScalars,
    true,
    false,
    '',
    '  ',
    0,
    42,
    '42',
    'safe-id',
    'unsafe"id',
  ];
  for (const value of values) {
    const tasks = api.normalizeTasks([
      {
        id: value,
        text: 'Parent',
        done: value,
        focus: { elapsedMs: value },
        subtasks: [
          { id: value, text: 'Child A', done: value },
          { id: value, text: 'Child B', done: true },
        ],
      },
      { id: value, text: 'Leaf', done: value, focus: { elapsedMs: value } },
    ]);
    assert.deepEqual(plain(api.normalizeTasks(plain(tasks))), plain(tasks));
    assert.notEqual(tasks[0].id, tasks[1].id);
    assert.notEqual(tasks[0].subtasks[0].id, tasks[0].subtasks[1].id);
  }
});

function indexedWriteApi({ failKey, failRead = false } = {}) {
  const persisted = new Map([
    ['tasks', 'old tasks'],
    ['settings', 'old settings'],
    ['meta', 'old meta'],
  ]);
  let aborts = 0;
  let completes = 0;
  const failure = new Error(failRead ? 'metadata read failed' : 'put failed');
  const db = {
    transaction() {
      const pending = new Map();
      let active = true;
      const tx = {
        objectStore() {
          return {
            get() {
              const request = {};
              setImmediate(() => {
                if (!active) return;
                if (failRead) {
                  request.error = failure;
                  request.onerror();
                } else {
                  request.result = null;
                  request.onsuccess();
                }
              });
              return request;
            },
            put(value, key) {
              if (key === failKey) throw failure;
              pending.set(key, value);
            },
          };
        },
        abort() {
          if (!active) return;
          active = false;
          aborts += 1;
          queueMicrotask(() => tx.onabort?.());
        },
      };
      // 同期的なput例外では、ブラウザのIndexedDBトランザクションは中止されない。
      setImmediate(() =>
        setImmediate(() => {
          if (!active) return;
          active = false;
          for (const [key, value] of pending) persisted.set(key, value);
          completes += 1;
          tx.oncomplete?.();
        }),
      );
      return tx;
    },
  };
  const api = vm.runInNewContext(
    `
    const INDEXED_DB_STORE_NAME = 'state', STATE_META_KEY = 'meta', STORAGE_OPERATION_TIMEOUT_MS = 1000;
    const window = { setTimeout };
    let _lastIndexedDbWriteError = null;
    async function _requestIndexedDbOpen() { return db; }
    function _getStorageMetaFromEntries() { return { revision: 1 }; }
    function _normalizeStorageMeta() { return null; }
    function _hasStorageMetaConflictSince() { return false; }
    ${['_waitForIndexedDbRequest', '_waitForIndexedDbTransaction', '_writeManyToIndexedDb'].map(source).join('\n')}
    ({ write: _writeManyToIndexedDb })
  `,
    { db, setTimeout, clearTimeout },
  );
  return {
    ...api,
    persisted,
    failure,
    aborts: () => aborts,
    completes: () => completes,
  };
}

test('a synchronous IndexedDB write failure aborts all previously queued writes', async () => {
  const api = indexedWriteApi({ failKey: 'settings' });
  await assert.rejects(
    api.write([
      ['tasks', 'new tasks'],
      ['settings', 'new settings'],
      ['meta', 'new meta'],
    ]),
    api.failure,
  );
  await new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
  assert.equal(api.aborts(), 1);
  assert.equal(api.completes(), 0);
  assert.equal(api.persisted.get('tasks'), 'old tasks');
  assert.equal(api.persisted.get('settings'), 'old settings');
  assert.equal(api.persisted.get('meta'), 'old meta');
});

test('IndexedDB metadata-read failures settle and abort the write transaction', async () => {
  const api = indexedWriteApi({ failRead: true });
  await assert.rejects(api.write([['tasks', 'new tasks']]), api.failure);
  assert.equal(api.aborts(), 1);
  assert.equal(api.persisted.get('tasks'), 'old tasks');
});

test('successful IndexedDB saves commit every key together', async () => {
  const api = indexedWriteApi();
  assert.equal(
    await api.write([
      ['tasks', 'new tasks'],
      ['settings', 'new settings'],
      ['meta', 'new meta'],
    ]),
    true,
  );
  assert.equal(api.aborts(), 0);
  assert.equal(api.completes(), 1);
  assert.deepEqual(
    [...api.persisted.values()],
    ['new tasks', 'new settings', 'new meta'],
  );
});

test('closed or superseded IndexedDB connections are reopened for the next operation', async () => {
  const connections = [];
  const indexedDB = {
    open() {
      const request = {};
      const db = {
        closed: false,
        close() {
          this.closed = true;
        },
      };
      connections.push(db);
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess();
      });
      return request;
    },
  };
  const api = vm.runInNewContext(
    `
    let _indexedDbPromise = null;
    const INDEXED_DB_NAME = 'db', INDEXED_DB_VERSION = 1, INDEXED_DB_STORE_NAME = 'state';
    const STORAGE_OPERATION_TIMEOUT_MS = 1000, window = { setTimeout };
    ${source('_requestIndexedDbOpen')}
    ({ open: _requestIndexedDbOpen })
  `,
    { indexedDB, setTimeout, clearTimeout },
  );
  const first = await api.open();
  assert.equal(await api.open(), first);
  first.onversionchange?.();
  assert.equal(first.closed, true);
  const second = await api.open();
  assert.notEqual(second, first);
  second.onclose?.();
  assert.notEqual(await api.open(), second);
  assert.equal(connections.length, 3);
});

test('failed focus checkpoints retry at the checkpoint interval instead of every timer tick', async () => {
  const api = vm.runInNewContext(`
    const FOCUS_CHECKPOINT_INTERVAL_MS = 2000;
    const focusState = { lastCheckpointAt: 5000 };
    const target = { focus: { focusState: 'running' } };
    let saves = 0;
    function isStateSaveOperationPending() { return false; }
    function getActiveFocusTarget() { return target; }
    function _createAppStateSnapshot() { return {}; }
    function _createFocusRuntimeSnapshot() { return { ...focusState }; }
    function syncRunningFocusElapsedForPersist() { return true; }
    async function _commitFocusStateSave(previous, runtime) {
      saves += 1;
      Object.assign(focusState, runtime);
      return false;
    }
    ${source('checkpointActiveFocusElapsed')}
    ({ checkpoint: checkpointActiveFocusElapsed, saves: () => saves })
  `);
  for (const now of [10000, 10200, 11000, 11999, 12000])
    await api.checkpoint(now);
  assert.equal(api.saves(), 2);
});
