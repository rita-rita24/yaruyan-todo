import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource, APP } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { html, run } = loadAppSource(APP);

// Deterministic grid geometry: inserting a slot adds its height and one row gap.
function previewHarness(tagName = 'LI', heights = [40, 40, 40, 40]) {
  const root = {
    children: [],
    classList: { remove() {} },
    insertBefore(element, sibling) {
      element.parentElement = this;
      const index = sibling ? this.children.indexOf(sibling) : this.children.length;
      this.children.splice(index, 0, element);
    }
  };
  function element(id, height, tag = tagName) {
    return {
      id, tagName: tag, height, parentElement: root, className: '', textContent: '',
      setAttribute() {},
      get nextSibling() { return root.children[root.children.indexOf(this) + 1] || null; },
      remove() { root.children.splice(root.children.indexOf(this), 1); this.parentElement = null; },
      getBoundingClientRect() {
        const index = root.children.indexOf(this);
        const top = 100 + root.children.slice(0, index).reduce((sum, row) => sum + row.height + 8, 0);
        return { top, bottom: top + this.height, height: this.height };
      }
    };
  }
  const rows = heights.map((height, index) => element(String.fromCharCode(97 + index), height));
  root.children.push(...rows);
  const qsa = (selector, parent = root) => parent.children.filter(row =>
    selector.includes('.drag-insertion-slot') && row.className === 'drag-insertion-slot');
  const api = run(['showDragInsertionPreview', 'resolveDropIntentByClientY', 'clearDragDropIndicators', 'clearModalSubtaskDragIndicators'], {
    qs: (selector, parent) => qsa(selector, parent)[0] || null, qsa,
    taskList: root, modalSubtaskList: root,
    getComputedStyle: () => ({ rowGap: '8px' }),
    document: { createElement: tag => element(null, 2, tag.toUpperCase()) }
  });
  return { root, rows, api, slot: () => qsa('.drag-insertion-slot')[0] };
}

for (const tag of ['LI', 'DIV']) {
  test(`${tag}: hover opens an insertion slot and does not change task order`, () => {
    const { root, rows, api, slot } = previewHarness(tag);
    const intent = api.resolveDropIntentByClientY(rows, 'a', 204, row => row.id);
    assert.equal(intent.targetId, 'c');
    assert.equal(intent.placeAfter, false);
    api.showDragInsertionPreview(root, intent);
    assert.deepEqual(root.children.map(row => row.id), ['a', 'b', null, 'c', 'd']);
    assert.equal(slot().tagName, tag);
    assert.equal(slot().textContent, '');
    assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c', 'd']);
  });

  test(`${tag}: insertion stays stable inside the slot and over the displaced row`, () => {
    const { root, rows, api, slot } = previewHarness(tag);
    api.showDragInsertionPreview(root, api.resolveDropIntentByClientY(rows, 'a', 204, row => row.id));
    const firstSlot = slot();
    for (const y of [196, 197, 204, 220, 204]) {
      const intent = api.resolveDropIntentByClientY(rows, 'a', y, row => row.id);
      assert.equal(intent.targetId, 'c');
      assert.equal(intent.placeAfter, false);
      api.showDragInsertionPreview(root, intent);
      assert.equal(slot(), firstSlot, 'same target must retain the same DOM slot');
    }
    const next = api.resolveDropIntentByClientY(rows, 'a', 230, row => row.id);
    assert.equal(next.targetId, 'd');
    api.showDragInsertionPreview(root, next);
    assert.deepEqual(root.children.map(row => row.id), ['a', 'b', 'c', null, 'd']);
  });

  test(`${tag}: cancelling or leaving removes the slot without moving any task`, () => {
    const { root, rows, api, slot } = previewHarness(tag);
    api.showDragInsertionPreview(root, api.resolveDropIntentByClientY(rows, 'd', 120, row => row.id));
    assert.ok(slot());
    const clear = tag === 'LI' ? api.clearDragDropIndicators : api.clearModalSubtaskDragIndicators;
    clear();
    assert.equal(slot(), undefined);
    assert.deepEqual(root.children, rows);
    api.showDragInsertionPreview(root, null);
    assert.deepEqual(root.children, rows);
  });
}

test('insertion supports both ends and variable-height parent tasks', () => {
  const { root, rows, api, slot } = previewHarness('LI', [40, 200, 60, 40]);
  const before = api.resolveDropIntentByClientY(rows, 'd', 90, row => row.id);
  assert.equal(before.targetId, 'a');
  assert.equal(before.placeAfter, false);
  api.showDragInsertionPreview(root, before);
  assert.equal(root.children[0], slot());
  api.clearDragDropIndicators();
  const after = api.resolveDropIntentByClientY(rows, 'a', 500, row => row.id);
  assert.equal(after.targetId, 'd');
  assert.equal(after.placeAfter, true);
  api.showDragInsertionPreview(root, after);
  assert.equal(root.children.at(-1), slot());
});

test('a single-item list has no destination', () => {
  const { rows, api } = previewHarness('LI', [40]);
  assert.equal(api.resolveDropIntentByClientY(rows, 'a', 120, row => row.id), null);
});

for (const type of ['parent', 'subtask']) {
  test(`${type}: drop inserts between items while preserving their relative order`, async () => {
    const items = ['a', 'b', 'c', 'd'].map(id => ({ id, text: id, focus: { elapsedMs: 25 } }));
    const tasks = type === 'parent' ? items : [{ id: 'parent', subtasks: items }];
    const originals = [...items];
    let saves = 0, renders = 0;
    const api = run(['moveArrayItem', 'reorderParentTasks', 'reorderSubtasks'], {
      tasks, getTask: id => tasks.find(task => task.id === id),
      isStateSaveOperationPending: () => false,
      _createAppStateSnapshot: () => structuredClone(tasks),
      _commitStateSave: async () => { saves++; return true; },
      render: () => renders++
    });
    const move = (from, to, after = false) => type === 'parent'
      ? api.reorderParentTasks(from, to, after)
      : api.reorderSubtasks('parent', from, to, after);
    assert.equal(await move('a', 'd'), true);
    assert.deepEqual(items.map(item => item.id), ['b', 'c', 'a', 'd']);
    assert.equal(await move('d', 'c'), true);
    assert.deepEqual(items.map(item => item.id), ['b', 'd', 'c', 'a']);
    assert.equal(await move('b', 'a', true), true);
    assert.deepEqual(items.map(item => item.id), ['d', 'c', 'a', 'b']);
    assert.equal(await move('b', 'a', true), false);
    assert.equal(saves, 3);
    assert.equal(renders, 3);
    for (const item of originals) assert.ok(items.includes(item), 'task data is preserved');
  });
}

test('all inline scripts remain syntactically valid', () => {
  for (const [, code] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(code);
});
