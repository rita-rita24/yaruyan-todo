import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();
const fixture = [
  {
    id: 'project',
    text: 'サイト公開',
    done: false,
    subtasks: [
      { id: 'design', text: '画面デザイン', done: true },
      { id: 'api', text: 'ＡＰＩ のテスト', done: false },
    ],
  },
  { id: 'mail', text: 'メールを返す', done: true, subtasks: [] },
];
function harness(query = '') {
  const state = {
    tasks: structuredClone(fixture),
    taskViewState: { filter: 'all' },
    taskSearchQuery: query,
    taskSearchInput: { value: query },
    renders: 0,
    pending: false,
    errors: [],
    isStateSaveOperationPending: () => state.pending,
    render: () => state.renders++,
    showErrorToast: (text) => state.errors.push(text),
  };
  const api = run(
    [
      'normalizeTaskSearchText',
      'matchesTaskSearch',
      'isTaskSearchActive',
      'resetTaskSearch',
      'handleTaskSearchInput',
      'hasSubtasks',
      'matchesTaskFilter',
      'getFilteredSubtasks',
      'isTaskVisible',
      'getVisibleParentTaskIds',
      'getVisibleSubtaskIds',
      'openClearAllConfirm',
      'openClearCompletedConfirm',
      'performClearAll',
      'performClearCompleted',
    ],
    state,
  );
  return { state, api };
}

test('search normalizes width, case and whitespace and treats markup literally', () => {
  const { api } = harness();
  assert.equal(
    api.matchesTaskSearch('ＡＰＩ　のテスト', '  api のテスト  '),
    true,
  );
  assert.equal(api.matchesTaskSearch('カタカナ', 'ｶﾀｶﾅ'), true);
  assert.equal(api.matchesTaskSearch('<img src=x>', '<IMG'), true);
  assert.equal(api.matchesTaskSearch('abc', '.*'), false);
  assert.equal(api.matchesTaskSearch('anything', '　 '), true);
});

test('a matching child retains its parent while a matching parent includes matching-status children', () => {
  const { state, api } = harness('api');
  assert.deepEqual(Array.from(api.getVisibleParentTaskIds()), ['project']);
  assert.deepEqual(Array.from(api.getVisibleSubtaskIds(state.tasks[0])), [
    'api',
  ]);
  state.taskViewState.filter = 'completed';
  assert.deepEqual(Array.from(api.getVisibleParentTaskIds()), []);
  state.taskSearchQuery = 'サイト';
  assert.deepEqual(Array.from(api.getVisibleSubtaskIds(state.tasks[0])), [
    'design',
  ]);
  state.taskViewState.filter = 'all';
  assert.deepEqual(Array.from(api.getVisibleSubtaskIds(state.tasks[0])), [
    'design',
    'api',
  ]);
});

test('search leaves data and the persisted filter unchanged, and clearing reveals all rows', () => {
  const { state, api } = harness('missing');
  assert.deepEqual(Array.from(api.getVisibleParentTaskIds()), []);
  api.resetTaskSearch();
  assert.equal(state.taskSearchInput.value, '');
  assert.deepEqual(Array.from(api.getVisibleParentTaskIds()), [
    'project',
    'mail',
  ]);
  assert.deepEqual(state.tasks, fixture);
  assert.deepEqual(state.taskViewState, { filter: 'all' });
});

test('IME composition does not refresh results until committed input', () => {
  const { state, api } = harness();
  state.taskSearchInput.value = 'サイト';
  api.handleTaskSearchInput({ isComposing: true });
  assert.equal(state.renders, 0);
  assert.equal(state.taskSearchQuery, '');
  api.handleTaskSearchInput({});
  assert.equal(state.renders, 1);
  assert.equal(state.taskSearchQuery, 'サイト');
  api.handleTaskSearchInput({});
  assert.equal(
    state.renders,
    1,
    'duplicate input/compositionend events do not render twice',
  );
});

test('search respects an active save lock', () => {
  const { state, api } = harness();
  state.pending = true;
  state.taskSearchInput.value = 'API';
  api.handleTaskSearchInput({});
  assert.equal(state.renders, 0);
  assert.equal(state.taskSearchQuery, '');
});

test('search blocks both bulk confirmations and execution without touching data', async () => {
  const { state, api } = harness('api');
  api.openClearAllConfirm();
  api.openClearCompletedConfirm();
  assert.equal(await api.performClearAll(), false);
  assert.equal(await api.performClearCompleted(), false);
  assert.equal(state.errors.length, 4);
  assert.ok(state.errors.every((text) => text.includes('検索を解除')));
  assert.deepEqual(state.tasks, fixture);
});
