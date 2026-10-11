import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from '../../tests/helpers/app-source.mjs';
import vm from 'node:vm';

const { source } = loadAppSource(
  new URL('./cache-candidate.html', import.meta.url),
);
const functions = [
  'normalizeTaskSearchText',
  'matchesTaskSearch',
  'isTaskSearchActive',
  'hasSubtasks',
  'matchesTaskFilter',
  'getFilteredSubtasks',
  'isTaskVisible',
  'getVisibleParentTaskIds',
  'getVisibleSubtaskIds',
  'getProgressStats',
  'getTaskStructureCounts',
  'shouldClearCompletedItem',
  'getClearCompletedDeleteCounts',
  'getClearCompletedScopeText',
  'renderTasks',
  'openClearAllConfirm',
  'openClearCompletedConfirm',
];
function harness(
  filter,
  tasks = [
    {
      id: 'parent',
      done: false,
      subtasks: [
        { id: 'child-pending', done: false },
        { id: 'child-done', done: true },
      ],
    },
    { id: 'pending', done: false, subtasks: [] },
    { id: 'done', done: true, subtasks: [] },
  ],
) {
  const node = () => ({
    hidden: false,
    style: {},
    textContent: '',
    setAttribute() {},
  });
  const context = {
    tasks,
    taskViewState: { filter },
    taskSearchQuery: '',
    clearTaskSearchBtn: node(),
    pending: false,
    rows: [],
    confirmations: [],
    errors: [],
    taskFullRowCache: new Map(),
    taskRowCache: new Map(
      tasks.map((task) => [task.id, { key: task.id, element: task.id }]),
    ),
    taskViewStatus: node(),
    taskOverview: node(),
    taskProgressText: node(),
    taskProgressBar: node(),
    taskHeaderActions: node(),
    clearCompletedBtn: node(),
    clearAllBtn: node(),
    emptyState: node(),
    emptyStateTitle: node(),
    emptyStateDescription: node(),
    syncTaskFilterButtons() {},
    getTaskRowRenderKey: (task) => task.id,
    reconcileTaskRows: (rows) => (context.rows = Array.from(rows)),
    isStateSaveOperationPending: () => context.pending,
    showErrorToast: (message) => context.errors.push(message),
    buildClearAllConfirmMessage: () => 'all',
    buildClearCompletedConfirmMessage: () => 'completed',
    openConfirmModal: (...args) => context.confirmations.push(args),
  };
  const api = vm.runInNewContext(
    functions.map(source).join('\n') + `\n({${functions.join(',')}})`,
    context,
  );
  return { context, api };
}

for (const [filter, expectedRows, count] of [
  ['all', ['parent', 'pending', 'done'], 4],
  ['pending', ['parent', 'pending'], 2],
  ['completed', ['parent', 'done'], 2],
]) {
  test(`${filter}: rendering and counts work with an empty search`, () => {
    const { context, api } = harness(filter);
    api.renderTasks();
    assert.deepEqual(context.rows, expectedRows);
    assert.deepEqual(Array.from(api.getVisibleParentTaskIds()), expectedRows);
    assert.match(
      context.taskViewStatus.textContent,
      new RegExp(`^${count}件を表示中`),
    );
    assert.equal(context.taskProgressText.textContent, '2 / 4 完了');
    assert.equal(context.taskViewStatus.hidden, false);
    assert.equal(context.emptyState.hidden, true);
    assert.equal(context.taskHeaderActions.hidden, false);
    assert.equal(context.clearAllBtn.disabled, false);
    assert.equal(context.clearCompletedBtn.disabled, filter === 'pending');
    const expectedChildren =
      filter === 'all'
        ? ['child-pending', 'child-done']
        : [filter === 'pending' ? 'child-pending' : 'child-done'];
    assert.deepEqual(
      Array.from(api.getVisibleSubtaskIds(context.tasks[0])),
      expectedChildren,
    );
  });
}

test('no tasks and no matching completion state keep their empty messages', () => {
  const empty = harness('all', []);
  empty.api.renderTasks();
  assert.equal(
    empty.context.emptyStateTitle.textContent,
    'まだタスクがありません',
  );
  assert.equal(empty.context.taskViewStatus.hidden, true);
  assert.equal(empty.context.emptyState.hidden, false);
  assert.equal(empty.context.taskHeaderActions.hidden, true);
  assert.equal(empty.context.clearAllBtn.disabled, true);
  for (const [filter, done, title] of [
    ['pending', true, '未完了タスクはありません'],
    ['completed', false, '完了タスクはありません'],
  ]) {
    const { api, context } = harness(filter, [
      { id: 'one', done, subtasks: [] },
    ]);
    api.renderTasks();
    assert.equal(context.emptyStateTitle.textContent, title);
    assert.equal(context.emptyState.hidden, false);
  }
});

test('bulk deletion still requires confirmation and respects the save lock and filter', () => {
  const { context, api } = harness('all');
  api.openClearAllConfirm();
  api.openClearCompletedConfirm();
  assert.deepEqual(
    context.confirmations.map((args) => args[1]),
    ['clear-all', 'clear-completed'],
  );
  assert.equal(
    context.tasks.length,
    3,
    'opening confirmation must not delete tasks',
  );
  context.pending = true;
  api.openClearAllConfirm();
  api.openClearCompletedConfirm();
  assert.equal(context.confirmations.length, 2);
  context.pending = false;
  context.taskViewState.filter = 'pending';
  api.openClearCompletedConfirm();
  assert.equal(context.confirmations.length, 2);
  assert.deepEqual(context.errors, ['完了済みタスクがありません']);
});

test('search rendering shows only matching work, keeps global progress and disables bulk deletion', () => {
  const { context, api } = harness('all', [
    {
      id: 'project',
      text: '公開',
      done: false,
      subtasks: [
        { id: 'api', text: 'ＡＰＩ', done: false },
        { id: 'ui', text: '画面', done: true },
      ],
    },
    { id: 'hidden', text: '別のタスク', done: true, subtasks: [] },
  ]);
  context.taskSearchQuery = 'api';
  api.renderTasks();
  assert.deepEqual(context.rows, ['project']);
  assert.match(context.taskViewStatus.textContent, /^1件を表示中/);
  assert.equal(context.taskProgressText.textContent, '2 / 3 完了');
  assert.equal(context.clearTaskSearchBtn.hidden, false);
  assert.equal(context.clearAllBtn.disabled, true);
  assert.equal(context.clearCompletedBtn.disabled, true);
  context.taskSearchQuery = 'missing';
  api.renderTasks();
  assert.deepEqual(context.rows, []);
  assert.equal(
    context.emptyStateTitle.textContent,
    '一致するタスクはありません',
  );
  assert.equal(context.tasks.length, 2);
  context.taskSearchQuery = '';
  // このハーネスでは実DOM生成を使わず、表示対象の選択と状態を検証する。
  context.taskRowCache = new Map(
    context.tasks.map((task) => [task.id, { key: task.id, element: task.id }]),
  );
  api.renderTasks();
  assert.deepEqual(context.rows, ['project', 'hidden']);
  assert.equal(context.clearTaskSearchBtn.hidden, true);
  assert.equal(context.clearAllBtn.disabled, false);
});

function retainedRowsHarness() {
  const { context, api } = harness('all', [
    {
      id: 'p',
      text: '親',
      done: false,
      subtasks: [
        { id: 's1', text: 'API', done: false },
        { id: 's2', text: '画面', done: true },
      ],
    },
    { id: 'leaf', text: '単独', done: false, subtasks: [] },
  ]);
  context.taskRowCache.clear();
  context.getTaskRowRenderKey = vm.runInNewContext(
    source('getTaskRowRenderKey') + ';getTaskRowRenderKey',
    { hasSubtasks: api.hasSubtasks },
  );
  let created = 0;
  context.document = {
    createElement: () => ({
      number: ++created,
      style: { setProperty() {} },
      dataset: {},
      isConnected: false,
      classList: { contains: () => false },
      querySelector: () => null,
    }),
  };
  context.isRunnableParent = (task) => !api.hasSubtasks(task);
  context.escapeHtml = String;
  context.getFocusIconForMeta = () => 'play_circle';
  context.createSubtaskRowMarkup = (_, sub) => sub.text;
  context.hydrateMaterialIcons = () => {};
  context.reconcileTaskRows = (rows) => {
    for (const row of context.rows) row.isConnected = false;
    context.rows = Array.from(rows);
    for (const row of rows) row.isConnected = true;
  };
  return { context, api, getCreated: () => created };
}

test('search and filter returns reuse full rows without accumulating earlier filtered views', () => {
  const { context, api, getCreated } = retainedRowsHarness();
  api.renderTasks();
  const original = [...context.rows];
  for (let i = 0; i < 12; i++) {
    context.taskSearchQuery = i % 2 ? 'api' : 'missing';
    api.renderTasks();
    assert.ok(context.taskFullRowCache.size <= context.tasks.length);
    assert.ok(context.taskRowCache.size <= context.tasks.length);
    context.taskSearchQuery = '';
    api.renderTasks();
    assert.deepEqual(context.rows, original);
  }
  const count = getCreated();
  context.taskViewState.filter = 'completed';
  api.renderTasks();
  context.taskViewState.filter = 'all';
  api.renderTasks();
  assert.deepEqual(context.rows, original);
  assert.equal(getCreated(), count + 1);
});

test('retained full rows are invalidated after hidden edits and released after deletion', () => {
  const { context, api } = retainedRowsHarness();
  api.renderTasks();
  const original = context.rows[0];
  context.taskSearchQuery = 'missing';
  api.renderTasks();
  context.tasks[0].subtasks[0].text = '更新API';
  api.renderTasks();
  assert.equal(context.taskFullRowCache.has('p'), false);
  context.taskSearchQuery = '';
  api.renderTasks();
  assert.notEqual(context.rows[0], original);
  assert.ok(context.rows[0].innerHTML.includes('更新API'));
  context.tasks.splice(0, 1);
  api.renderTasks();
  assert.equal(context.taskFullRowCache.has('p'), false);
  assert.equal(context.taskFullRowCache.size, 1);
});

test('detached drag styling is not restored from a retained full row', () => {
  const { context, api } = retainedRowsHarness();
  api.renderTasks();
  const original = context.rows[0];
  context.taskSearchQuery = 'missing';
  api.renderTasks();
  original.classList.contains = (name) => name === 'dragging';
  context.taskSearchQuery = '';
  api.renderTasks();
  assert.notEqual(context.rows[0], original);
  assert.equal(context.rows[0].classList.contains('dragging'), false);
});
