import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../YaruyanTodo.html', import.meta.url), 'utf8');
function source(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(html);
  assert.ok(match, `${name} exists`);
  const end = html.indexOf('\n      }', match.index);
  assert.notEqual(end, -1);
  return html.slice(match.index, end + '\n      }'.length);
}
function api(initialTasks = [], query = '', filter = 'all', saveOk = true) {
  const names = ['matchesTaskFilter', 'matchesTaskSearch', 'getFilteredSubtasks', 'isTaskVisible',
    'getVisibleParentTaskIds', 'getVisibleSubtaskIds', 'getProgressStats', 'resetTaskSearch',
    'normalizeInputText', 'addTask', 'openClearAllConfirm', 'openClearCompletedConfirm'];
  const context = { initialTasks, query, filter, saveOk, structuredClone };
  vm.runInNewContext(`
    let tasks = structuredClone(initialTasks);
    let taskSearchQuery = query;
    const taskViewState = { filter };
    const taskSearchInput = { value: query };
    const taskInput = { value: '新しく追加する作業', focus() {} };
    const MAX_TASK_TEXT_LENGTH = 120, MAX_PARENT_TASK_COUNT = 200;
    const errors = [], confirmations = [];
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
    function openConfirmModal(text) { confirmations.push(text); }
    function playAddSound() {}
    function render() {}
    ${names.map(source).join('\n')}
    globalThis.api = { matchesTaskSearch, getFilteredSubtasks, isTaskVisible,
      getVisibleParentTaskIds, getVisibleSubtaskIds, getProgressStats, addTask,
      openClearAllConfirm, openClearCompletedConfirm,
      state: () => ({tasks, filter: taskViewState.filter, query: taskSearchQuery, input: taskInput.value, errors, confirmations}) };
  `, context);
  return context.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
const tasks = [
  { id: 'project', text: 'サイトを公開する', done: false, subtasks: [
    { id: 'design', text: '画面のデザイン', done: true },
    { id: 'api', text: 'ＡＰＩ のテスト', done: false }
  ] },
  { id: 'mail', text: 'メールを返す', done: true, subtasks: [] }
];

test('the complete application script parses', () => {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length);
  for (const [, script] of scripts) assert.doesNotThrow(() => new vm.Script(script));
});

test('search handles Japanese width variants, case, whitespace and literal symbols', () => {
  const app = api();
  assert.equal(app.matchesTaskSearch('ＡＰＩ のテスト', ' api　テスト '), true);
  assert.equal(app.matchesTaskSearch('カタカナ', 'ｶﾀｶﾅ'), true);
  assert.equal(app.matchesTaskSearch('ＡＰＩ のテスト', 'api 完了'), false);
  assert.equal(app.matchesTaskSearch('<script> & [todo]', '<script>'), true);
  assert.equal(app.matchesTaskSearch('何でも', '　 '), true);
});

test('child search keeps its parent context and combines with status filtering', () => {
  const app = api(tasks, 'api', 'pending');
  assert.deepEqual(plain(app.getVisibleParentTaskIds()), ['project']);
  assert.deepEqual(plain(app.getVisibleSubtaskIds(tasks[0])), ['api']);
  assert.equal(app.isTaskVisible(tasks[0], 'completed'), false);
  assert.deepEqual(plain(api(tasks, '不存在').getVisibleParentTaskIds()), []);
});

test('parent name search includes its children while progress always counts actual work', () => {
  const app = api(tasks, 'サイト', 'all');
  assert.deepEqual(plain(app.getVisibleSubtaskIds(tasks[0])), ['design', 'api']);
  assert.deepEqual(plain(app.getProgressStats()), { total: 3, completed: 2, pct: 67 });
});

test('bulk deletion shortcuts cannot delete hidden matches during a search', () => {
  const app = api(tasks, 'api');
  app.openClearAllConfirm();
  app.openClearCompletedConfirm();
  assert.equal(app.state().confirmations.length, 0);
  assert.equal(app.state().errors.length, 2);
  assert.deepEqual(plain(app.state().tasks), tasks);
});

test('adding from completed results reveals the saved new task', async () => {
  const app = api(tasks, 'api', 'completed');
  await app.addTask();
  assert.equal(app.state().filter, 'all');
  assert.equal(app.state().query, '');
  assert.equal(app.state().input, '');
  assert.ok(app.getVisibleParentTaskIds().includes('new-task'));
});

test('failed addition preserves search, filter, draft and existing tasks', async () => {
  const app = api(tasks, 'api', 'completed', false);
  await app.addTask();
  assert.equal(app.state().filter, 'completed');
  assert.equal(app.state().query, 'api');
  assert.equal(app.state().input, '新しく追加する作業');
  assert.deepEqual(plain(app.state().tasks), tasks);
});
