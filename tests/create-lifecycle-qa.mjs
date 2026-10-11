// 保存キーを分離し、ブラウザ標準の永続化機能を使って実アプリを動かす。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function lifecycleQa() {
  const lines = [];
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const frame = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  const settle = async () => {
    await _storedStateSaveQueue;
    await _indexedDbWriteQueue;
    await frame();
  };
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([
      { id: 'active', text: '集中テスト' },
      { id: 'removed', text: '取り消しテスト' },
      {
        id: 'parent',
        text: '編集テスト',
        subtasks: [{ id: 'child', text: '変更前' }],
      },
    ]);
    await save();
    navigate('tasks');
    render();
    openParentModal('parent');
    await frame();
    const originalRow = modalSubtaskList.firstElementChild;
    const originalButton = originalRow.querySelector('.modal-edit-subtask-btn');
    originalButton.focus();
    render();
    check(
      modalSubtaskList.firstElementChild === originalRow &&
        document.activeElement === originalButton,
      'unchanged parent editor preserves the row, SVG, and keyboard focus',
    );
    getTask('parent').subtasks[0].text = '変更後';
    render();
    check(
      modalSubtaskList.textContent.includes('変更後') &&
        modalSubtaskList.firstElementChild !== originalRow,
      'child edits refresh the existing editor',
    );
    closeParentModal();
    await frame();

    const undo = _createParentDeleteUndoPayload('removed');
    await performDeleteParent('removed');
    await openFocusModal('parent', 'active');
    await settle();
    const previous = _createAppStateSnapshot();
    _applyDeleteUndoPayload(undo);
    const originalRead = _getPersistedStateEntries;
    _getPersistedStateEntries = () => {
      throw new Error('intentional QA save failure');
    };
    let saved;
    try {
      saved = await _commitStateSave(previous);
    } finally {
      _getPersistedStateEntries = originalRead;
    }
    check(
      saved === false && !getTask('removed'),
      'failed Undo rolls task changes back',
    );
    check(
      getTask('active').focus.focusState === 'running' &&
        !isStateSaveOperationPending(),
      'failed unrelated save preserves the running timer and releases the UI lock',
    );

    // 集中から休憩への切り替え中は保存を保留し、その後に対応する実行状態を復元する。
    const clock = Date.now;
    const saveOriginal = save;
    let now = 100000;
    Date.now = () => now;
    try {
      Object.assign(focusState, {
        pomodoroEnabled: true,
        pomodoroPhase: 'focus',
        pomodoroFocusMs: 1000,
        pomodoroBreakMs: 1000,
        pomodoroPhaseEndsAt: 101000,
        pomodoroPhaseRemainingMs: 1000,
        lastCheckpointAt: 100000,
      });
      Object.assign(getTask('active').focus, {
        focusState: 'running',
        startedAt: 100000,
        elapsedMs: 0,
      });
      const snapshot = _createAppStateSnapshot();
      let release;
      save = () =>
        new Promise((resolve) => {
          release = resolve;
        });
      const pending = _commitStateSave(snapshot);
      now = 101500;
      updateFocusTimer();
      check(
        focusState.pomodoroPhase === 'break',
        'timer can reach the next phase while persistence is pending',
      );
      release(false);
      await pending;
      check(
        focusState.pomodoroPhase === 'break' &&
          getTask('active').focus.elapsedMs === 1000 &&
          getTask('active').focus.startedAt === null,
        'failed save replays the phase transition exactly once without counting rest time',
      );
    } finally {
      Date.now = clock;
      save = saveOriginal;
    }
    await performAbortFocus();
    await settle();

    const writes = [];
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      writes.push([key, value]);
      return originalSet.call(this, key, value);
    };
    try {
      organizeMemo = 'first departure';
      persistRuntimeStateForUnload();
      organizeMemo = 'latest departure';
      persistRuntimeStateForUnload();
      await settle();
    } finally {
      Storage.prototype.setItem = originalSet;
    }
    const values = writes
      .filter(([key]) => key === ORGANIZE_MEMO_KEY)
      .map(([, value]) => value);
    check(
      values
        .slice(values.indexOf('latest departure'))
        .every((value) => value === 'latest departure'),
      'successive page departures never republish the old memo',
    );
    check(
      localStorage.getItem(ORGANIZE_MEMO_KEY) === 'latest departure' &&
        (await _readManyFromIndexedDb([ORGANIZE_MEMO_KEY]))[
          ORGANIZE_MEMO_KEY
        ] === 'latest departure',
      'both native storage backends retain the latest departure memo',
    );

    let reads = 0;
    const getEntries = _getPersistedStateEntries;
    _getPersistedStateEntries = () => {
      reads++;
      return getEntries();
    };
    try {
      const pending = [];
      for (let i = 0; i < 100; i++) {
        organizeMemo = `連続入力${i}`;
        pending.push(persistOrganizeMemoLocalCheckpoint());
      }
      await Promise.all(pending);
      check(
        reads === 2 && localStorage.getItem(ORGANIZE_MEMO_KEY) === '連続入力99',
        '100 pending memo inputs require only two state reads and save the final text',
      );
      organizeMemo = '次の入力';
      await persistOrganizeMemoLocalCheckpoint();
      check(
        localStorage.getItem(ORGANIZE_MEMO_KEY) === organizeMemo,
        'a new input after the shared checkpoint starts a fresh save',
      );
    } finally {
      _getPersistedStateEntries = getEntries;
    }
    await save();
    await settle();
    check(
      (await _readManyFromIndexedDb([ORGANIZE_MEMO_KEY]))[ORGANIZE_MEMO_KEY] ===
        organizeMemo,
      'the final memo also reaches native IndexedDB',
    );
    navigate('tasks');
    render();
    check(
      !appShell.hasAttribute('inert') && !taskInput.disabled,
      'the application stays interactive after all recovery paths',
    );
  } catch (error) {
    lines.push('ERROR ' + error.stack);
  }
  await settle();
  lines.push(
    `${lines.filter((line) => line.startsWith('PASS')).length} PASSED / ${lines.filter((line) => /^(FAIL|ERROR)/.test(line)).length} FAILED`,
  );
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-lifecycle-qa-'));
const original = readFileSync(
  process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url),
  'utf8',
);
const isolated = original.replaceAll(
  'yatta-spa-',
  `yaruyan-lifecycle-${randomUUID()}-`,
);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker))
  throw new Error('Initialization marker missing');
writeFileSync(
  join(directory, 'index.html'),
  isolated.replace(
    marker,
    '      navigate(getRouteFromHash());\nawait (' +
      lifecycleQa.toString() +
      ')();\n    })();',
  ),
);
console.log(directory);
