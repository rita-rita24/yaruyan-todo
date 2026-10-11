import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { source } = loadAppSource();
function api(initialTasks = [], filter = 'all', saveOk = true, query = '') {
  const names = [
    'normalizeTaskSearchText',
    'matchesTaskSearch',
    'resetTaskSearch',
    'matchesTaskFilter',
    'getFilteredSubtasks',
    'isTaskVisible',
    'getVisibleParentTaskIds',
    'getVisibleSubtaskIds',
    'getProgressStats',
    'normalizeInputText',
    'addTask',
  ];
  const context = { initialTasks, filter, saveOk, query, structuredClone };
  vm.runInNewContext(
    `
    let tasks = structuredClone(initialTasks);
    const taskViewState = { filter };
    let taskSearchQuery = query;
    const taskSearchInput = { value: query };
    const taskInput = { value: '新しく追加する作業', focus() {} };
    const MAX_TASK_TEXT_LENGTH = 120, MAX_PARENT_TASK_COUNT = 200;
    const errors = [];
    function hasSubtasks(task) { return Array.isArray(task.subtasks) && task.subtasks.length > 0; }
    function isStateSaveOperationPending() { return false; }
    function isAddOperationPending() { return false; }
    function setAddOperationPending() {}
    function uid() { return 'new-task'; }
    function createFocusMeta() { return { elapsedMs: 0, focusState: 'idle', startedAt: null }; }
    function _createAppStateSnapshot() { return structuredClone({ tasks, taskViewState }); }
    async function _commitStateSave(previous) {
      if (!saveOk) { tasks = previous.tasks; taskViewState.filter = previous.taskViewState.filter; }
      return saveOk;
    }
    function showErrorToast(text) { errors.push(text); }
    function playAddSound() {}
    function render() {}
    ${names.map(source).join('\n')}
    globalThis.api = { getFilteredSubtasks, isTaskVisible,
      getVisibleParentTaskIds, getVisibleSubtaskIds, getProgressStats, addTask,
      state: () => ({tasks, filter: taskViewState.filter, input: taskInput.value, query: taskSearchQuery, searchInput: taskSearchInput.value, errors}) };
  `,
    context,
  );
  return context.api;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const tasks = [
  {
    id: 'project',
    text: 'サイトを公開する',
    done: false,
    subtasks: [
      { id: 'design', text: '画面のデザイン', done: true },
      { id: 'api', text: 'ＡＰＩ のテスト', done: false },
    ],
  },
  { id: 'mail', text: 'メールを返す', done: true, subtasks: [] },
];

test('status filtering keeps the parent context of matching children', () => {
  const app = api(tasks, 'pending');
  assert.deepEqual(plain(app.getVisibleParentTaskIds()), ['project']);
  assert.deepEqual(plain(app.getVisibleSubtaskIds(tasks[0])), ['api']);
  assert.equal(app.isTaskVisible(tasks[0], 'completed'), true);
  assert.deepEqual(plain(api(tasks, 'completed').getVisibleParentTaskIds()), [
    'project',
    'mail',
  ]);
});

test('progress counts actual work without double counting parents', () => {
  const app = api(tasks);
  assert.deepEqual(plain(app.getVisibleSubtaskIds(tasks[0])), [
    'design',
    'api',
  ]);
  assert.deepEqual(plain(app.getProgressStats()), {
    total: 3,
    completed: 2,
    pct: 67,
  });
});

test('adding from completed results reveals the saved new task', async () => {
  const app = api(tasks, 'completed');
  await app.addTask();
  assert.equal(app.state().filter, 'all');
  assert.equal(app.state().input, '');
  assert.ok(app.getVisibleParentTaskIds().includes('new-task'));
});

test('failed addition preserves the filter, draft and existing tasks', async () => {
  const app = api(tasks, 'completed', false);
  await app.addTask();
  assert.equal(app.state().filter, 'completed');
  assert.equal(app.state().input, '新しく追加する作業');
  assert.deepEqual(plain(app.state().tasks), tasks);
});

test('successful addition clears search so the new task is visible', async () => {
  const app = api(tasks, 'completed', true, 'no match');
  await app.addTask();
  assert.equal(app.state().query, '');
  assert.equal(app.state().searchInput, '');
  assert.ok(app.getVisibleParentTaskIds().includes('new-task'));
});

test('failed addition preserves search as well as the filter and input', async () => {
  const app = api(tasks, 'completed', false, 'メール');
  await app.addTask();
  assert.equal(app.state().query, 'メール');
  assert.equal(app.state().searchInput, 'メール');
  assert.equal(app.state().filter, 'completed');
  assert.equal(app.state().input, '新しく追加する作業');
  assert.deepEqual(plain(app.state().tasks), tasks);
});
