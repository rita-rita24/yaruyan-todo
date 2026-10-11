import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadAppSource } from './helpers/app-source.mjs';

const { run, inputKeydownSource } = loadAppSource();

function createList(ids) {
  const mutations = [];
  const container = {
    children: [],
    get firstElementChild() {
      return this.children[0] ?? null;
    },
    insertBefore(row, next) {
      mutations.push(['insert', row.id]);
      const current = this.children.indexOf(row);
      if (current >= 0) this.children.splice(current, 1);
      const index = next ? this.children.indexOf(next) : this.children.length;
      assert.ok(
        index >= 0,
        'The insertion anchor must still belong to the list',
      );
      this.children.splice(index, 0, row);
    },
  };
  function node(id) {
    return {
      id,
      get nextElementSibling() {
        return container.children[container.children.indexOf(this) + 1] ?? null;
      },
      remove() {
        mutations.push(['remove', this.id]);
        container.children.splice(container.children.indexOf(this), 1);
      },
    };
  }
  container.children = ids.map(node);
  return { container, mutations, node };
}

test('unchanged list reconciliation does not detach or move any existing row', () => {
  const { reconcileChildren } = run(['reconcileChildren']);
  const { container, mutations } = createList(['a', 'b', 'c']);
  const rows = [...container.children];
  reconcileChildren(container, rows);
  assert.deepEqual(mutations, []);
  assert.deepEqual(container.children, rows);
});

test('list reconciliation handles filtering, replacement, insertion and reorder while retaining nodes', () => {
  const { reconcileChildren } = run(['reconcileChildren']);
  const { container, mutations, node } = createList(['a', 'b', 'c']);
  const [a, b, c] = container.children;
  const updatedB = node('b');
  const added = node('d');
  reconcileChildren(container, [c, updatedB, a, added]);
  assert.deepEqual(container.children, [c, updatedB, a, added]);
  assert.ok(!container.children.includes(b));
  mutations.length = 0;
  reconcileChildren(container, [c, a]);
  assert.deepEqual(container.children, [c, a]);
  assert.deepEqual(mutations, [
    ['remove', 'b'],
    ['remove', 'd'],
  ]);
  reconcileChildren(container, []);
  assert.deepEqual(container.children, []);
});

for (const [input, action] of [
  ['taskInput', 'addTask'],
  ['messageInput', 'saveMessage'],
  ['parentEditInput', 'saveParentEdit'],
  ['modalSubtaskInput', 'addSubtaskFromModal'],
  ['subtaskEditInput', 'saveSubtaskEdit'],
]) {
  test(`${input}: shared Enter handling preserves composition and handled events`, () => {
    let handler,
      actions = 0,
      prevented = 0;
    vm.runInNewContext(inputKeydownSource(input), {
      [input]: {
        addEventListener: (_, callback) => {
          handler = callback;
        },
      },
      [action]: () => actions++,
    });
    for (const options of [
      { keyCode: 229 },
      { isComposing: true },
      { defaultPrevented: true },
      { key: 'Escape' },
    ]) {
      handler({ key: 'Enter', preventDefault: () => prevented++, ...options });
    }
    assert.equal(actions, 0);
    assert.equal(prevented, 0);
    handler({
      key: 'Enter',
      shiftKey: true,
      preventDefault: () => prevented++,
    });
    assert.equal(
      actions,
      input === 'parentEditInput' ? 0 : 1,
      'Preserve each input’s Shift+Enter behavior',
    );
  });
}
