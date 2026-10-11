import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { html, source, run } = loadAppSource();

test('bulk deletion is blocked while a state save is pending', () => {
  const errors = [],
    confirmations = [];
  const api = run(['openClearAllConfirm', 'openClearCompletedConfirm'], {
    taskViewState: { filter: 'all' },
    tasks: [],
    isStateSaveOperationPending: () => true,
    getTaskStructureCounts: () => ({ totalCount: 1 }),
    getClearCompletedDeleteCounts: () => ({ totalCount: 1 }),
    buildClearAllConfirmMessage: () => 'all',
    buildClearCompletedConfirmMessage: () => 'completed',
    showErrorToast: (value) => errors.push(value),
    openConfirmModal: (value) => confirmations.push(value),
  });
  api.openClearAllConfirm();
  api.openClearCompletedConfirm();
  assert.equal(confirmations.length, 0);
  assert.equal(errors.length, 0);
});

test('a locally handled keyboard event cannot also trigger a global focus action', () => {
  let completed = 0;
  class Element {
    closest() {
      return null;
    }
  }
  const focusOverlay = {};
  const { handleDocumentShortcuts } = run(['handleDocumentShortcuts'], {
    HTMLElement: Element,
    focusOverlay,
    confirmModalOverlay: {},
    subtaskModalOverlay: {},
    parentModalOverlay: {},
    _getActiveModalOverlay: () => focusOverlay,
    isTypingTarget: () => false,
    completeFocus: () => completed++,
  });
  handleDocumentShortcuts({
    key: 'Enter',
    defaultPrevented: true,
    target: new Element(),
    preventDefault() {},
  });
  assert.equal(completed, 0);
});

for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
  test(`IME Escape preserves the message draft (${JSON.stringify(composition)})`, () => {
    const start = html.indexOf("      messageList.addEventListener('keydown',");
    const handler = html.slice(start, html.indexOf('\n      });', start) + 10);
    let keydown,
      renders = 0;
    const state = { editIndex: 2, draft: '変換中' };
    vm.runInNewContext(handler, {
      messageList: {
        addEventListener: (_, fn) => {
          keydown = fn;
        },
      },
      messageEditorState: state,
      renderMessages: () => renders++,
    });
    keydown({
      key: 'Escape',
      ...composition,
      target: { closest: () => ({}) },
      preventDefault() {},
    });
    assert.deepEqual(state, { editIndex: 2, draft: '変換中' });
    assert.equal(renders, 0);
  });
}

test('parent editor routes its existing reorder shortcut to the focused child', () => {
  const offsets = [];
  const parentModalOverlay = {};
  const { handleDocumentShortcuts } = run(['handleDocumentShortcuts'], {
    parentModalOverlay,
    confirmModalOverlay: {},
    subtaskModalOverlay: {},
    _getActiveModalOverlay: () => parentModalOverlay,
    isTypingTarget: () => false,
    _moveFocusedTaskRowByOffset: (value) => offsets.push(value),
  });
  for (const key of ['ArrowDown', 'ArrowUp']) {
    handleDocumentShortcuts({ key, altKey: true, preventDefault() {} });
  }
  assert.deepEqual(offsets, [1, -1]);
});

test('message controls recover their focus after being disabled for a save', () => {
  const body = {},
    button = {};
  const document = { activeElement: button, body };
  const { setMessageOperationPending } = run(['setMessageOperationPending'], {
    document,
    messageOperationState: { pending: false },
    messageInput: {},
    messageSaveBtn: {},
    isAddOperationPending: () => false,
    _captureModalReturnFocus: () => ({ rowIndex: 1 }),
    _restoreFocusAfterPending: (entry) => {
      document.activeElement = entry.returnFocusEl;
    },
    setInputActionPending: (_, __, pending) => {
      if (pending) document.activeElement = body;
    },
    updateMessageListPendingState() {},
  });
  setMessageOperationPending(true);
  assert.equal(document.activeElement, body);
  setMessageOperationPending(false);
  assert.equal(document.activeElement, button);
});

for (const kind of ['task', 'subtask', 'message']) {
  test(`failed ${kind} additions can restore the original input after enabling controls`, () => {
    const input = {},
      body = {};
    const document = { activeElement: input, body };
    const { setAddOperationPending } = run(['setAddOperationPending'], {
      document,
      addOperationState: { task: false, subtask: false, message: false },
      taskInput: input,
      addBtn: {},
      modalSubtaskInput: input,
      modalAddSubtaskBtn: {},
      messageInput: input,
      messageSaveBtn: {},
      isEditOperationPending: () => false,
      isMessageOperationPending: () => false,
      _captureModalReturnFocus: () => ({}),
      _restoreFocusAfterPending: (entry) => {
        document.activeElement = entry.returnFocusEl;
      },
      setInputActionPending: (_, __, pending) => {
        if (pending) document.activeElement = body;
      },
    });
    setAddOperationPending(kind, true);
    setAddOperationPending(kind, true);
    assert.equal(document.activeElement, body);
    setAddOperationPending(kind, false);
    assert.equal(document.activeElement, input);
  });
}

for (const kind of ['parent', 'subtask']) {
  test(`failed ${kind} edits restore the original input after enabling controls`, () => {
    const input = {},
      body = {};
    const document = { activeElement: input, body };
    const state = { parent: false, subtask: false };
    const update = () => {
      if (state[kind]) document.activeElement = body;
    };
    const { setEditOperationPending } = run(['setEditOperationPending'], {
      document,
      editOperationState: state,
      _captureModalReturnFocus: () => ({}),
      _restoreFocusAfterPending: (entry) => {
        document.activeElement = entry.returnFocusEl;
      },
      updateParentModalPendingState: update,
      updateSubtaskModalPendingState: update,
    });
    setEditOperationPending(kind, true);
    setEditOperationPending(kind, true);
    assert.equal(document.activeElement, body);
    setEditOperationPending(kind, false);
    assert.equal(document.activeElement, input);
  });
}

function timerContext(focusMs, breakMs, phase = 'focus', remaining = null) {
  const end = remaining ?? (phase === 'focus' ? focusMs : breakMs);
  return {
    focusState: {
      pomodoroEnabled: true,
      pomodoroFocusMs: focusMs,
      pomodoroBreakMs: breakMs,
      pomodoroPhase: phase,
      pomodoroPhaseEndsAt: end,
      pomodoroPhaseRemainingMs: end,
    },
    target: {
      focus: {
        focusState: 'running',
        elapsedMs: 42,
        startedAt: phase === 'focus' ? 0 : null,
      },
    },
  };
}
const timerNames = [
  'isPomodoroEnabledForSession',
  'getPomodoroPhaseDurationMs',
  'getPomodoroPhaseRemainingMs',
  'syncPomodoroPhaseProgress',
];

test('timer catch-up matches a phase-by-phase reference from partially elapsed focus and break', () => {
  for (const [focusMs, breakMs] of [
    [60000, 60000],
    [1500000, 300000],
    [10800000, 7200000],
  ]) {
    for (const phase of ['focus', 'break']) {
      for (const partial of [1, 0.25]) {
        for (const cycles of [0, 1, 7, 500]) {
          const duration = phase === 'focus' ? focusMs : breakMs;
          const remaining = duration * partial;
          const now = remaining + cycles * (focusMs + breakMs) + focusMs / 3;
          const context = timerContext(focusMs, breakMs, phase, remaining);
          const expected = structuredClone(context);
          let transitions = 0;
          while (now >= expected.focusState.pomodoroPhaseEndsAt) {
            const end = expected.focusState.pomodoroPhaseEndsAt;
            if (expected.focusState.pomodoroPhase === 'focus') {
              expected.target.focus.elapsedMs +=
                end - expected.target.focus.startedAt;
            }
            expected.focusState.pomodoroPhase =
              expected.focusState.pomodoroPhase === 'focus' ? 'break' : 'focus';
            expected.target.focus.startedAt =
              expected.focusState.pomodoroPhase === 'focus' ? end : null;
            expected.focusState.pomodoroPhaseEndsAt +=
              expected.focusState.pomodoroPhase === 'focus' ? focusMs : breakMs;
            transitions++;
          }
          expected.focusState.pomodoroPhaseRemainingMs =
            expected.focusState.pomodoroPhaseEndsAt - now;
          const api = run(timerNames, context);
          assert.equal(
            api.syncPomodoroPhaseProgress(context.target, now),
            transitions,
          );
          assert.deepEqual(context.target, expected.target);
          assert.deepEqual(context.focusState, expected.focusState);
        }
      }
    }
  }
});

test('very large forward clock jumps finish without iterating through every phase', () => {
  const context = vm.createContext(timerContext(60000, 60000));
  vm.runInContext(timerNames.map(source).join('\n'), context);
  const transitions = vm.runInContext(
    'syncPomodoroPhaseProgress(target, 60000 * 2e9 + 15000)',
    context,
    { timeout: 1000 },
  );
  assert.equal(transitions, 2e9);
  assert.equal(context.target.focus.elapsedMs, 42 + 60000 * 1e9);
  assert.equal(context.focusState.pomodoroPhaseRemainingMs, 45000);
});

test('timer ticks do not replace unchanged timer or caption text nodes', () => {
  let writes = 0;
  const node = (text) => ({
    get textContent() {
      return text;
    },
    set textContent(value) {
      writes++;
      text = value;
    },
  });
  const { updateFocusTimer } = run(['updateFocusTimer'], {
    getActiveFocusTarget: () => ({ focus: {} }),
    syncPomodoroPhaseProgress: () => 0,
    isPomodoroEnabledForSession: () => false,
    getElapsedMs: () => 1200,
    formatElapsed: () => '00:00:01',
    focusTimer: node('00:00:01'),
    focusTimerCaption: node('経過時間'),
    focusElapsedSummary: node(''),
    syncFocusPhaseVisualState() {},
    syncFocusStatusChip() {},
    checkpointActiveFocusElapsed() {},
  });
  updateFocusTimer();
  updateFocusTimer();
  assert.equal(writes, 0);
});

test('IndexedDB reads are queued together and settle only after transaction commit', async () => {
  const requests = [];
  let finish;
  const txDone = new Promise((resolve) => {
    finish = resolve;
  });
  const tx = {
    objectStore: () => ({
      get(key) {
        const request = { key };
        requests.push(request);
        return request;
      },
    }),
  };
  const { _readManyFromIndexedDb } = run(
    ['_readManyFromIndexedDb', '_waitForIndexedDbRequest'],
    {
      INDEXED_DB_STORE_NAME: 'state',
      _requestIndexedDbOpen: async () => ({ transaction: () => tx }),
      _waitForIndexedDbTransaction: () => txDone,
    },
  );
  const result = _readManyFromIndexedDb(['tasks', 'settings', 'memo']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    requests.map((request) => request.key),
    ['tasks', 'settings', 'memo'],
  );
  let settled = false;
  result.then(() => {
    settled = true;
  });
  for (const request of requests) {
    request.result = request.key === 'memo' ? null : request.key;
    request.onsuccess();
  }
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  finish(true);
  assert.deepEqual(JSON.parse(JSON.stringify(await result)), {
    tasks: 'tasks',
    settings: 'settings',
    memo: null,
  });
});

test('an IndexedDB read setup failure aborts and observes the transaction rejection', async () => {
  let aborts = 0;
  const failure = new Error('missing store');
  let rejectTransaction;
  const txDone = new Promise((_, reject) => {
    rejectTransaction = reject;
  });
  const tx = {
    objectStore() {
      throw failure;
    },
    abort() {
      aborts++;
      rejectTransaction(new Error('aborted'));
    },
  };
  const { _readManyFromIndexedDb } = run(['_readManyFromIndexedDb'], {
    INDEXED_DB_STORE_NAME: 'state',
    _requestIndexedDbOpen: async () => ({ transaction: () => tx }),
    _waitForIndexedDbTransaction: () => txDone,
  });
  await assert.rejects(_readManyFromIndexedDb(['tasks']), /missing store/);
  assert.equal(aborts, 1);
});
