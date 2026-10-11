import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();

for (const [name, inputName, maxName, extra] of [
  ['addTask', 'taskInput', 'MAX_TASK_TEXT_LENGTH', {}],
  [
    'saveParentEdit',
    'parentEditInput',
    'MAX_TASK_TEXT_LENGTH',
    { modalState: { parentId: 'p' }, getTask: () => ({ text: 'old' }) },
  ],
  [
    'saveSubtaskEdit',
    'subtaskEditInput',
    'MAX_SUBTASK_TEXT_LENGTH',
    {
      modalState: { subtaskParentId: 'p', subtaskId: 'c' },
      getSubtask: () => ({ text: 'old' }),
    },
  ],
  [
    'addSubtaskFromModal',
    'modalSubtaskInput',
    'MAX_SUBTASK_TEXT_LENGTH',
    { modalState: { parentId: 'p' }, getTask: () => ({ subtasks: [] }) },
  ],
]) {
  test(`${name} preserves an over-limit draft without attempting a save`, async () => {
    const draft = 'あ'.repeat(120) + '大切な末尾';
    let focused = false;
    const errors = [];
    const state = {
      ...extra,
      [inputName]: {
        value: draft,
        focus: () => {
          focused = true;
        },
      },
      [maxName]: 120,
      isStateSaveOperationPending: () => false,
      isAddOperationPending: () => false,
      isEditOperationPending: () => false,
      showErrorToast: (text) => errors.push(text),
      _commitStateSave: () => assert.fail('must not save'),
    };
    await run([name], state)[name]();
    assert.equal(state[inputName].value, draft);
    assert.equal(focused, true);
    assert.match(errors[0], /120文字/);
  });
}

test('Escape keeps the active focus session running and does not close it', () => {
  const overlay = {};
  const target = {
    focus: { focusState: 'running', elapsedMs: 3000, startedAt: 1000 },
  };
  const before = structuredClone(target);
  let prevented = false;
  const { handleDocumentShortcuts } = run(['handleDocumentShortcuts'], {
    focusOverlay: overlay,
    confirmModalOverlay: {},
    parentModalOverlay: {},
    subtaskModalOverlay: {},
    _getActiveModalOverlay: () => overlay,
    closeFocusModal: () => assert.fail('Escape must not close focus'),
    returnFromFocus: () => assert.fail('Escape must not leave focus'),
  });
  handleDocumentShortcuts({
    key: 'Escape',
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.deepEqual(target, before);
});

test('an open focus session cannot be replaced by starting another task', async () => {
  const { openFocusModal } = run(['openFocusModal'], {
    isStateSaveOperationPending: () => false,
    isFocusOperationPending: () => false,
    focusOverlay: { classList: { contains: () => true } },
    getTarget: () => assert.fail('must not start a different target'),
    setFocusOperationPending: () =>
      assert.fail('must not mutate the active session'),
  });
  await openFocusModal('parent', 'other');
});

test('closing a dirty parent editor asks before discarding and keeps the draft', () => {
  const confirmations = [];
  let closed = false;
  const state = {
    modalState: { parentId: 'p' },
    getTask: () => ({ text: 'old' }),
    parentEditInput: { value: 'new' },
    modalSubtaskInput: { value: '' },
    isStateSaveOperationPending: () => false,
    isEditOperationPending: () => false,
    isAddOperationPending: () => false,
    openConfirmModal: (...args) => confirmations.push(args),
    resetModalSubtaskDragState() {},
    parentModalOverlay: {},
    _closeModalOverlay: () => {
      closed = true;
    },
  };
  const api = run(['closeParentModal'], state);
  assert.equal(api.closeParentModal(), false);
  assert.equal(closed, false);
  assert.equal(state.parentEditInput.value, 'new');
  assert.equal(confirmations[0][1], 'discard-parent-edit');
  assert.equal(api.closeParentModal({ force: true }), true);
  assert.equal(closed, true);
});

for (const saveOk of [true, false]) {
  test(`adding a child reveals it only after a committed save (${saveOk})`, async () => {
    const parent = {
      id: 'p',
      text: 'parent',
      done: true,
      focus: {},
      subtasks: [],
    };
    const state = {
      modalState: { parentId: 'p' },
      getTask: () => parent,
      taskViewState: { filter: 'completed' },
      taskSearchQuery: 'old search',
      taskSearchInput: { value: 'old search' },
      modalSubtaskInput: { value: 'new child', focus() {} },
      MAX_SUBTASK_TEXT_LENGTH: 120,
      MAX_SUBTASK_COUNT_PER_PARENT: 50,
      isStateSaveOperationPending: () => false,
      isAddOperationPending: () => false,
      isEditOperationPending: () => false,
      hasSubtasks: (p) => p.subtasks.length > 0,
      _createAppStateSnapshot: () => ({
        parent: structuredClone(parent),
        filter: state.taskViewState.filter,
      }),
      setAddOperationPending() {},
      uid: () => 'c',
      createFocusMeta: () => ({}),
      syncParentStatus() {},
      _commitStateSave: async (snapshot) => {
        if (!saveOk) {
          Object.assign(parent, snapshot.parent);
          state.taskViewState.filter = snapshot.filter;
        }
        return saveOk;
      },
      playAddSound() {},
      renderParentModalSubtasks() {},
      render() {},
      showErrorToast: (text) => assert.fail(text),
    };
    await run(
      ['normalizeInputText', 'resetTaskSearch', 'addSubtaskFromModal'],
      state,
    ).addSubtaskFromModal();
    assert.equal(state.taskViewState.filter, saveOk ? 'all' : 'completed');
    assert.equal(state.taskSearchQuery, saveOk ? '' : 'old search');
    assert.equal(state.modalSubtaskInput.value, saveOk ? '' : 'new child');
    assert.equal(parent.subtasks.length, saveOk ? 1 : 0);
  });
}

test('pomodoro shows rounded-up phase remaining time separately from cumulative work', () => {
  const state = {
    Date: { now: () => 1000 },
    getActiveFocusTarget: () => ({ focus: {} }),
    syncPomodoroPhaseProgress: () => 0,
    isPomodoroEnabledForSession: () => true,
    focusState: { pomodoroPhase: 'focus' },
    getPomodoroPhaseRemainingMs: () => 59401,
    getElapsedMs: () => 92000,
    formatElapsed: (ms) => String(ms),
    focusTimer: { textContent: '' },
    focusTimerCaption: { textContent: '' },
    focusElapsedSummary: { hidden: true, textContent: '' },
    syncFocusPhaseVisualState() {},
    syncFocusStatusChip() {},
    checkpointActiveFocusElapsed() {},
  };
  run(['updateFocusTimer'], state).updateFocusTimer();
  assert.equal(state.focusTimer.textContent, '60000');
  assert.equal(state.focusTimerCaption.textContent, '集中の残り時間');
  assert.equal(state.focusElapsedSummary.textContent, '実績時間 92000');
  assert.equal(state.focusElapsedSummary.hidden, false);
});

test('row cache updates when filters or search change the visible children', () => {
  const state = { hasSubtasks: () => true };
  const api = run(['getTaskRowRenderKey'], state);
  const parent = { id: 'p', text: 'parent', focus: {} };
  const children = [
    { id: 'c1', text: 'first', focus: {} },
    { id: 'c2', text: 'second', focus: {} },
  ];
  const all = api.getTaskRowRenderKey(parent, children);
  assert.notEqual(api.getTaskRowRenderKey(parent, [children[0]]), all);
  assert.notEqual(api.getTaskRowRenderKey(parent, []), all);
  assert.equal(api.getTaskRowRenderKey(parent, [...children]), all);
});
