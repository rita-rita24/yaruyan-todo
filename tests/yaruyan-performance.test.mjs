import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();
function harness(route) {
  const state = { route, tasks: [{ text: '保存前' }], rows: [], calls: 0 };
  const context = {
    syncAllParents() {},
    applyColorMode() {},
    applyThemeColor() {},
    getRouteFromHash: () => state.route,
    isAllDone: () => false,
    renderTasks() {
      state.calls++;
      state.rows = state.tasks.map((task) => task.text);
    },
    syncEditorReorderControls() {},
    updateDocumentTaskIndicators() {},
    handleTooltipViewportChange() {},
    modalState: {},
    focusOverlay: { classList: { contains: () => false } },
    previousAllDoneState: false,
    navButtons: [],
    qsa: () => [],
    renderSettings() {},
    closeBulkActions() {},
    _getActiveModalOverlay: () => null,
    qs: () => ({ setAttribute() {}, focus() {} }),
    window: { scrollTo() {} },
  };
  return { state, ...run(['render', 'renderRoute'], context) };
}

test('offscreen updates are reflected on the first visit to tasks without rebuilding unchanged returns', () => {
  const { state, render, renderRoute } = harness('settings');
  render();
  assert.equal(state.calls, 0);
  state.tasks = [{ text: '保存後' }, { text: '追加したタスク' }];
  state.route = 'memo';
  render();
  assert.equal(state.calls, 0);
  state.route = 'tasks';
  renderRoute('tasks');
  assert.deepEqual(state.rows, ['保存後', '追加したタスク']);
  assert.equal(state.calls, 1);
  renderRoute('settings');
  renderRoute('tasks');
  assert.equal(state.calls, 1);
});

test('visible task updates immediately replace previous content, including empty state', () => {
  const { state, render } = harness('tasks');
  render();
  assert.deepEqual(state.rows, ['保存前']);
  state.tasks[0].text = '編集済み';
  render();
  assert.deepEqual(state.rows, ['編集済み']);
  state.tasks = [];
  render();
  assert.deepEqual(state.rows, []);
  assert.equal(state.calls, 3);
});

function focusHarness() {
  const state = {
    locks: 0,
    pending: false,
    shown: false,
    resolve: null,
    reject: null,
  };
  const target = {
    text: '対象',
    done: false,
    focus: { elapsedMs: 0, focusState: 'idle' },
  };
  const hidden = { classList: { contains: () => false } };
  const context = {
    isStateSaveOperationPending: () => state.locks > 0,
    isFocusOperationPending: () => state.pending,
    setStateSaveOperationPending: (pending) => {
      state.locks += pending ? 1 : -1;
    },
    setFocusOperationPending: (pending) => {
      state.pending = pending;
    },
    focusOverlay: { classList: { contains: () => state.shown } },
    confirmModalOverlay: hidden,
    parentModalOverlay: hidden,
    subtaskModalOverlay: hidden,
    document: { activeElement: null, body: { classList: { add() {} } } },
    commitPomodoroSettingsFromControls: async () => true,
    getTarget: () => target,
    canOpenFocusForParent: () => true,
    canOpenFocusForSubtask: () => true,
    _createAppStateSnapshot: () => ({}),
    _createFocusRuntimeSnapshot: () => ({}),
    clearRunningAcrossAllTargets() {},
    getElapsedMs: () => 0,
    focusState: { tickerId: null },
    startFocusPomodoroSession() {},
    _commitFocusStateSave: () =>
      new Promise((resolve, reject) => {
        assert.equal(state.locks, 1, 'shared lock covers the save');
        state.resolve = resolve;
        state.reject = reject;
      }),
    focusTaskTitle: {},
    syncFocusPauseButton() {},
    updateFocusTimer() {},
    focusPauseBtn: {},
    _openModalOverlay() {
      assert.equal(state.locks, 1);
      state.shown = true;
    },
    setInterval: () => 1,
    clearInterval() {},
    playFocusStartSound() {},
    render() {
      assert.equal(state.locks, 1, 'lock remains held through first render');
    },
  };
  return { state, ...run(['openFocusModal'], context) };
}

test('focus transition keeps the shared lock until the saved overlay is rendered', async () => {
  const { state, openFocusModal } = focusHarness();
  const opening = openFocusModal('parent', 'p');
  await new Promise(setImmediate);
  assert.equal(state.locks, 1);
  assert.equal(state.shown, false);
  await openFocusModal('parent', 'other');
  state.resolve(true);
  await opening;
  assert.equal(state.locks, 0);
  assert.equal(state.pending, false);
  assert.equal(state.shown, true);
});

test('failed or rejected focus saves release both locks without opening the overlay', async () => {
  for (const rejected of [false, true]) {
    const { state, openFocusModal } = focusHarness();
    const opening = openFocusModal('parent', 'p');
    await new Promise(setImmediate);
    if (rejected) {
      state.reject(new Error('保存失敗'));
      await assert.rejects(opening, /保存失敗/);
    } else {
      state.resolve(false);
      await opening;
    }
    assert.equal(state.locks, 0);
    assert.equal(state.pending, false);
    assert.equal(state.shown, false);
  }
});
