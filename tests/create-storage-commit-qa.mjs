// 実ブラウザ用のコミット・復旧テストを生成する。保存先は本番から分離する。
// このファイルを実行し、表示されたディレクトリをlocalhostで配信して/index.htmlを開く。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-commit-qa-'));
const namespace = `yaruyan-commit-qa-${randomUUID()}`;
let html = readFileSync(
  process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url),
  'utf8',
);
html = html.replace(
  /'(yatta-spa-[^']+)'/g,
  (_, key) =>
    `(${JSON.stringify(namespace)} + '-' + new URLSearchParams(location.search).get('case') + '-${key}')`,
);
function installQa() {
  let gate = null;
  function installGate(name, phase = 'before') {
    let release, entered;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    const reached = new Promise((resolve) => {
      entered = resolve;
    });
    const original =
      name === 'read' ? _hasNewerPersistedStorageState : _writeManyToIndexedDb;
    let used = false;
    const wrapped = async (...args) => {
      if (used) return original(...args);
      used = true;
      if (phase === 'before') {
        entered();
        await waiting;
      }
      const result = await original(...args);
      if (phase === 'after') {
        entered();
        await waiting;
      }
      return result;
    };
    if (name === 'read') _hasNewerPersistedStorageState = wrapped;
    else _writeManyToIndexedDb = wrapped;
    gate = { release, reached };
    return reached;
  }
  globalThis.__storageQa = {
    installGate,
    release: () => gate.release(),
    draft(ids, memo = 'memo') {
      tasks = normalizeTasks(
        ids.map((id) => ({ id, text: id, done: false, subtasks: [] })),
      );
      organizeMemo = memo;
    },
    save,
    async addThroughUi(text) {
      taskInput.value = text;
      await addTask();
      return {
        count: tasks.length,
        draft: taskInput.value,
        locked: isStateSaveOperationPending(),
        disabled: taskInput.disabled,
      };
    },
    checkpoint: persistOrganizeMemoLocalCheckpoint,
    unload: persistRuntimeStateForUnload,
    state: () => ({
      ids: tasks.map((task) => task.id),
      memo: organizeMemo,
      meta: _getCurrentStorageMeta(),
      warning: !_getStorageWarningEl().hidden,
    }),
    async stored() {
      return {
        local: _readLocalStateSnapshot(),
        indexed: _createIndexedStateSnapshot(
          await _readManyFromIndexedDb(PERSISTED_STATE_KEYS),
        ),
      };
    },
    blockLocalWrites() {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === TASKS_KEY || key === STATE_META_KEY)
          throw new DOMException('QA local quota', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    },
    abortNextCommit() {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = original.apply(this, args);
        if (args[1] === 'readwrite') {
          IDBDatabase.prototype.transaction = original;
          tx.abort();
        }
        return tx;
      };
    },
    // 保存済みデータだけを残して実行が終了した状態を再現する。プロセスの強制終了ではなく、
    // フレームを削除して、その中の待機処理を破棄する。
    stopLifecycle() {
      _persistentStorageInitialized = false;
    },
    async settled() {
      await _storedStateSaveQueue;
      await _indexedDbWriteQueue;
    },
  };
}
html = html.replace(
  '      navigate(getRouteFromHash());\n    })();',
  `      navigate(getRouteFromHash());\n      (${installQa.toString()})();\n    })();`,
);
writeFileSync(join(directory, 'app.html'), html);

async function run() {
  const output = document.getElementById('results');
  const results = [];
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  async function open(caseId) {
    const frame = document.createElement('iframe');
    frame.src = `app.html?case=${caseId}`;
    document.body.appendChild(frame);
    for (let i = 0; i < 200; i++) {
      if (frame.contentWindow?.__storageQa) {
        const api = frame.contentWindow.__storageQa;
        await api.settled();
        return { frame, api };
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('App initialization timed out');
  }
  const close = ({ frame, api }) => {
    api.stopLifecycle();
    frame.remove();
  };
  async function seed(caseId) {
    const a = await open(caseId);
    a.api.draft(['original']);
    check(await a.api.save(), 'Seed save failed');
    return a;
  }
  async function test(label, callback) {
    try {
      await callback();
      results.push({ label, pass: true });
    } catch (error) {
      results.push({ label, pass: false, error: String(error.stack || error) });
    }
    output.textContent = JSON.stringify(results, null, 2);
  }
  for (const operation of ['save', 'checkpoint']) {
    await test(`${operation}: other-context commit after successful preflight`, async () => {
      const caseId = `${operation}-late`;
      const a = await seed(caseId),
        b = await open(caseId);
      const reached = a.api.installGate('read', 'after');
      a.api.draft(['original'], 'a draft');
      const pending = a.api[operation]();
      await reached;
      b.api.blockLocalWrites();
      b.api.draft(['original', 'other-task']);
      check(await b.api.save(), 'Other context could not commit to IndexedDB');
      a.api.release();
      check((await pending) === false, 'Stale save was acknowledged');
      check(a.api.state().warning, 'Conflict warning missing');
      close(a);
      close(b);
      const restarted = await open(caseId);
      check(
        restarted.api.state().ids.includes('other-task'),
        'Restart lost other task',
      );
      close(restarted);
    });
  }
  for (const first of ['a', 'b']) {
    await test(`two native transactions race, release ${first} first`, async () => {
      const caseId = `race-${first}`;
      const a = await seed(caseId),
        b = await open(caseId);
      const ga = a.api.installGate('write'),
        gb = b.api.installGate('write');
      a.api.draft(['original', 'a']);
      b.api.draft(['original', 'b']);
      const pa = a.api.save(),
        pb = b.api.save();
      await Promise.all([ga, gb]);
      if (first === 'a') {
        a.api.release();
        b.api.release();
      } else {
        b.api.release();
        a.api.release();
      }
      const outcome = await Promise.all([pa, pb]);
      check(
        outcome.filter(Boolean).length === 1,
        `Expected one winner: ${outcome}`,
      );
      const winner = outcome[0] ? 'a' : 'b';
      close(a);
      close(b);
      const restarted = await open(caseId);
      check(
        restarted.api.state().ids.includes(winner),
        'Restart lost winning task',
      );
      close(restarted);
    });
  }
  for (const unload of [false, true]) {
    await test(`restart after native commit before local publication, unload=${unload}`, async () => {
      const caseId = `interrupted-${unload}`;
      const a = await seed(caseId);
      const reached = a.api.installGate('write', 'after');
      a.api.draft(['original', 'committed'], 'committed memo');
      void a.api.save();
      await reached;
      if (unload) {
        a.api.draft(['original', 'committed'], 'later draft');
        a.api.unload();
        a.api.draft(['original', 'committed'], 'latest draft');
        a.api.unload();
      }
      close(a);
      const restarted = await open(caseId);
      const state = restarted.api.state();
      check(state.ids.includes('committed'), 'Committed task missing');
      check(
        state.memo === (unload ? 'latest draft' : 'committed memo'),
        'Wrong memo after restart',
      );
      const stored = await restarted.api.stored();
      check(!stored.local.meta.unloadBase, 'Checkpoint never confirmed');
      close(restarted);
    });
  }
  await test('unload during preflight waits for verification and rejects a native competitor', async () => {
    const caseId = 'superseded-preflight';
    const a = await seed(caseId),
      b = await open(caseId);
    const ga = a.api.installGate('read', 'after');
    const gb = b.api.installGate('write');
    a.api.draft(['original'], 'a draft');
    const pa = a.api.save();
    await ga;
    b.api.draft(['original', 'other-task']);
    const pb = b.api.save();
    await gb;
    a.api.unload();
    b.api.release();
    check(await pb, 'Competing native commit failed');
    a.api.release();
    check((await pa) === false, 'Unverified unload was acknowledged');
    await a.api.settled();
    close(a);
    close(b);
    const restarted = await open(caseId);
    check(
      restarted.api.state().ids.includes('other-task'),
      'Restart lost the native competitor',
    );
    close(restarted);
  });
  await test('UI add rolls back on native abort, retains input, and releases the save lock', async () => {
    const a = await seed('ui-abort');
    a.api.abortNextCommit();
    const failed = await a.api.addThroughUi('keep this draft');
    check(failed.count === 1, 'Failed addition was retained as saved');
    check(failed.draft === 'keep this draft', 'Input was lost');
    check(!failed.locked && !failed.disabled, 'UI stayed locked');
    const saved = await a.api.addThroughUi('keep this draft');
    check(saved.count === 2 && saved.draft === '', 'Addition retry failed');
    close(a);
  });
  await test('native transaction abort preserves both backends and permits retry', async () => {
    const a = await seed('abort');
    const before = await a.api.stored();
    a.api.draft(['original', 'draft']);
    a.api.abortNextCommit();
    check(
      (await a.api.save()) === false,
      'Aborted transaction reported success',
    );
    const after = await a.api.stored();
    check(
      JSON.stringify(before) === JSON.stringify(after),
      'Abort changed persistent data',
    );
    check(a.api.state().warning, 'Abort warning missing');
    check(await a.api.save(), 'Retry failed');
    check(!a.api.state().warning, 'Successful retry retained warning');
    close(a);
  });
  globalThis.qaResults = results;
  globalThis.qaComplete = true;
  document.title = results.every((result) => result.pass)
    ? 'PASS: storage commit QA'
    : 'FAIL: storage commit QA';
}
writeFileSync(
  join(directory, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Storage commit QA</title><style>iframe{width:450px;height:280px}pre{white-space:pre-wrap}</style><h1>Isolated native IndexedDB commit QA</h1><pre id="results">Running...</pre><script>(${run.toString()})().catch(error=>{document.getElementById('results').textContent=String(error.stack);globalThis.qaComplete=true;});</script>`,
);
console.log(directory);
