import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
const { run } = loadAppSource();

function movementHarness(saveOk = true) {
  const parent = {
    id: 'p',
    text: 'original',
    subtasks: [{ id: 'c1' }, { id: 'c2' }],
  };
  const state = {
    tasks: [parent, { id: 'p2', subtasks: [] }],
    modalState: { parentId: 'p', subtaskParentId: 'p', subtaskId: 'c1' },
    getTask: (id) => state.tasks.find((item) => item.id === id),
    isStateSaveOperationPending: () => false,
    _createAppStateSnapshot: () => structuredClone(state.tasks),
    _commitStateSave: async (previous) => {
      if (!saveOk) state.tasks = previous;
      return saveOk;
    },
    render() {},
    syncEditorReorderControls() {},
    parentModalOverlay: {},
    subtaskModalOverlay: {},
    qsa: () => [],
    _getActiveModalOverlay: () => null,
  };
  return {
    state,
    api: run(
      [
        'getEditorReorderContext',
        'moveEditorTask',
        'moveArrayItem',
        'reorderParentTasks',
        'reorderSubtasks',
      ],
      state,
    ),
  };
}
for (const kind of ['parent', 'subtask']) {
  test(`editor ${kind} moves in saved order without saving name drafts`, async () => {
    const { state, api } = movementHarness();
    state.parentEditInput = { value: 'unsaved name' };
    state.subtaskEditInput = { value: 'unsaved child name' };
    assert.equal(await api.moveEditorTask(kind, 1), true);
    assert.deepEqual(
      kind === 'parent'
        ? state.tasks.map((p) => p.id)
        : state.tasks[0].subtasks.map((c) => c.id),
      kind === 'parent' ? ['p2', 'p'] : ['c2', 'c1'],
    );
    assert.equal(state.parentEditInput.value, 'unsaved name');
    assert.equal(state.getTask('p').text, 'original');
    assert.equal(state.subtaskEditInput.value, 'unsaved child name');
    assert.equal(
      await api.moveEditorTask(kind, 1),
      false,
      'end boundary must not wrap',
    );
  });
  test(`editor ${kind} keeps the original order on save failure`, async () => {
    const { state, api } = movementHarness(false);
    assert.equal(await api.moveEditorTask(kind, 1), false);
    assert.deepEqual(
      state.tasks.map((p) => p.id),
      ['p', 'p2'],
    );
    assert.deepEqual(
      state.tasks[0].subtasks.map((c) => c.id),
      ['c1', 'c2'],
    );
  });
}
test('editor movement ignores stale targets, invalid offsets and a pending save', async () => {
  const { state, api } = movementHarness();
  for (const [kind, offset] of [
    ['unknown', 1],
    ['parent', 2],
    ['parent', -1],
  ]) {
    assert.equal(await api.moveEditorTask(kind, offset), false);
  }
  state.modalState.parentId = 'deleted';
  assert.equal(await api.moveEditorTask('parent', 1), false);
  state.modalState.parentId = 'p';
  state.isStateSaveOperationPending = () => true;
  assert.equal(await api.moveEditorTask('parent', 1), false);
  assert.deepEqual(
    state.tasks.map((p) => p.id),
    ['p', 'p2'],
  );
});

test('bulk menu dismissal restores its summary only when focus was inside', () => {
  let focusCount = 0;
  const inside = {};
  const state = {
    bulkActions: { open: true, contains: (target) => target === inside },
    document: { activeElement: inside },
    bulkActionsSummary: { focus: () => focusCount++ },
  };
  const api = run(['closeBulkActions'], state);
  api.closeBulkActions({ restoreFocus: true });
  assert.equal(state.bulkActions.open, false);
  assert.equal(focusCount, 1);
  state.bulkActions.open = true;
  state.document.activeElement = {};
  api.closeBulkActions({ restoreFocus: true });
  assert.equal(focusCount, 1, 'outside interactions keep their chosen focus');
});

test('route focus changes only on navigation and stays out of an open dialog', () => {
  const calls = [];
  const scrolls = [];
  const pages = ['tasks', 'memo', 'settings'].map((route) => ({
    id: `page-${route}`,
    classList: { toggle() {} },
  }));
  const state = {
    qsa: () => pages,
    navButtons: [],
    renderSettings() {},
    closeBulkActions() {},
    window: { scrollTo: (options) => scrolls.push({ ...options }) },
    _getActiveModalOverlay: () => null,
    qs: (selector) => ({
      setAttribute() {},
      focus: () => calls.push(selector),
      scrollIntoView: () =>
        assert.fail('must not scroll the heading past the top navigation'),
    }),
  };
  const api = run(['renderRoute'], state);
  api.renderRoute('tasks');
  api.renderRoute('tasks');
  assert.equal(
    calls.length,
    0,
    'initial load and ordinary saves preserve focus',
  );
  assert.equal(
    scrolls.length,
    0,
    'initial load and ordinary saves preserve scroll',
  );
  api.renderRoute('memo');
  assert.deepEqual(calls, ['#page-memo h1']);
  assert.deepEqual(scrolls, [{ top: 0, left: 0, behavior: 'instant' }]);
  api.renderRoute('memo');
  assert.equal(calls.length, 1);
  assert.equal(scrolls.length, 1);
  api.renderRoute('settings');
  assert.equal(calls.at(-1), '#page-settings h1');
  assert.deepEqual(scrolls.at(-1), { top: 0, left: 0, behavior: 'instant' });
  state._getActiveModalOverlay = () => ({});
  api.renderRoute('tasks');
  assert.equal(
    calls.length,
    2,
    'a dialog retains focus even across a hash change',
  );
  assert.equal(
    scrolls.length,
    2,
    'a dialog retains scroll even across a hash change',
  );
});
