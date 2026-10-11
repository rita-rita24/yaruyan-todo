import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from '../../tests/helpers/app-source.mjs';
const { run } = loadAppSource('performance/round5/child-v4-candidate.html');
function harness() {
  const list = { children: [], isConnected: true };
  const row = (id) => ({
    id,
    parentElement: null,
    get nextElementSibling() {
      const siblings = this.parentElement.children;
      return siblings[siblings.indexOf(this) + 1] || null;
    },
    remove() {
      if (!this.parentElement) return;
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    },
  });
  list.insertBefore = (element, next) => {
    element.remove();
    const index = next ? list.children.indexOf(next) : list.children.length;
    list.children.splice(index, 0, element);
    element.parentElement = list;
  };
  Object.defineProperty(list, 'firstElementChild', {
    get: () => list.children[0] || null,
  });
  const task = {
    id: 'p',
    text: 'parent',
    done: false,
    subtasks: [
      { id: 'a', text: 'ＡＰＩ', done: false },
      { id: 'b', text: '保留', done: false },
    ],
  };
  let focusInside = false,
    dragging = false,
    preview = false,
    created = 0;
  const element = {
    isConnected: true,
    contains: () => focusInside,
    classList: { contains: () => dragging },
    querySelector: (selector) =>
      selector === '.subtask-list' ? list : preview ? {} : null,
    style: { setProperty() {} },
  };
  const document = {
    activeElement: {},
    createElement: () => ({
      set innerHTML(value) {
        this.content = { firstElementChild: row(value) };
      },
    }),
  };
  const api = run(
    [
      'hasSubtasks',
      'getTaskRowRenderKey',
      'reconcileChildren',
      'pruneCachedChildRows',
      'hasTaskRowDragState',
      'reconcileCachedTaskRow',
    ],
    {
      document,
      createSubtaskRowMarkup: (_, sub) => sub.id,
      hydrateMaterialIcons: () => created++,
    },
  );
  const fields = (sub) => [
    sub.id,
    sub.text,
    sub.done,
    sub.focus?.focusState,
    sub.done || sub.focus?.focusState === 'paused' ? sub.focus?.elapsedMs : 0,
  ];
  const childRows = new Map(
    task.subtasks.map((sub) => [
      sub.id,
      { key: JSON.stringify(fields(sub)), element: row(sub.id) },
    ]),
  );
  for (const child of childRows.values())
    list.insertBefore(child.element, null);
  const cached = {
    key: api.getTaskRowRenderKey(task, task.subtasks),
    element,
    childRows,
  };
  const reconcile = (visible) =>
    api.reconcileCachedTaskRow(
      cached,
      task,
      visible,
      api.getTaskRowRenderKey(task, visible),
    );
  return {
    task,
    list,
    cached,
    reconcile,
    created: () => created,
    prune: () => api.pruneCachedChildRows(cached, task.subtasks),
    setFocus: (value) => (focusInside = value),
    setDragging: (value) => (dragging = value),
    setPreview: (value) => (preview = value),
  };
}
test('search detach and restore preserves the exact child nodes and order', () => {
  const h = harness(),
    original = [...h.list.children];
  assert.equal(h.reconcile([h.task.subtasks[1]]), true);
  assert.deepEqual(h.list.children, [original[1]]);
  assert.equal(original[0].parentElement, null);
  assert.equal(h.reconcile(h.task.subtasks), true);
  assert.deepEqual(h.list.children, original);
  assert.equal(h.created(), 0);
});
test('edited hidden children are recreated when restored, while unchanged nodes survive', () => {
  const h = harness(),
    original = [...h.list.children];
  h.reconcile([h.task.subtasks[1]]);
  h.task.subtasks[0].text = '編集済み';
  h.reconcile(h.task.subtasks);
  assert.notEqual(h.list.children[0], original[0]);
  assert.equal(h.list.children[1], original[1]);
  assert.equal(h.created(), 1);
});
test('focus and drag state use the original full replacement path', () => {
  const h = harness();
  h.setFocus(true);
  assert.equal(h.reconcile([h.task.subtasks[0]]), false);
  assert.equal(h.list.children.length, 2);
  h.setFocus(false);
  h.setDragging(true);
  assert.equal(h.reconcile([h.task.subtasks[0]]), false);
});
test('changed parent controls use the original full replacement path', () => {
  const h = harness();
  h.task.text = '変更';
  assert.equal(h.reconcile(h.task.subtasks), false);
  assert.equal(h.created(), 0);
});

test('child cache initializes only on a changed view and retains existing nodes', () => {
  const h = harness(),
    original = [...h.list.children];
  delete h.cached.childRows;
  assert.equal(h.reconcile([h.task.subtasks[0]]), true);
  assert.equal(h.cached.childRows.size, 2);
  assert.equal(h.cached.childRows.get('b').element, original[1]);
  assert.equal(h.created(), 0);
});

test('unchanged structure retains its index and changed IDs prune stale entries', () => {
  const h = harness();
  h.prune();
  const index = h.cached.childStructure;
  h.prune();
  assert.equal(h.cached.childStructure, index);
  h.task.subtasks[0] = { id: 'replacement', text: 'new', done: false };
  h.prune();
  assert.equal(h.cached.childRows.has('a'), false);
  h.reconcile(h.task.subtasks);
  assert.equal(h.cached.childRows.size, 2);
  assert.equal(h.list.children[0].id, 'replacement');
});

test('detached deleted children are removed, while connected deletion waits for reconciliation', () => {
  const h = harness(),
    removed = h.list.children[0];
  h.task.subtasks.shift();
  h.prune();
  assert.equal(h.cached.childRows.has('a'), false);
  assert.equal(removed.parentElement, h.list);
  h.reconcile(h.task.subtasks);
  assert.equal(removed.parentElement, null);
  const detached = harness(),
    detachedChild = detached.list.children[0];
  detached.cached.element.isConnected = false;
  detached.task.subtasks.shift();
  detached.prune();
  assert.equal(detachedChild.parentElement, null);
});

test('insertion previews bypass lazy child-cache creation and reconciliation', () => {
  const h = harness();
  delete h.cached.childRows;
  h.setPreview(true);
  assert.equal(h.reconcile([h.task.subtasks[0]]), false);
  assert.equal(h.cached.childRows, undefined);
  assert.equal(h.list.children.length, 2);
});
