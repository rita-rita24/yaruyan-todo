import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();

test('binary drop lookup matches the original scan for variable heights, every source and scroll offset', () => {
  let reads = 0;
  const state = { scroll: 0 };
  let top = 0;
  const rows = Array.from({ length: 200 }, (_, id) => {
    const height = 20 + ((id * 37) % 113);
    const y = top;
    top += height + 8;
    return {
      id,
      parentElement: {},
      getBoundingClientRect() {
        reads++;
        return { top: y - state.scroll, height };
      },
    };
  });
  const { resolveDropIntentByClientY } = run(['resolveDropIntentByClientY'], {
    qs: () => null,
  });
  for (const scroll of [0, 123.5, 5000]) {
    state.scroll = scroll;
    for (const source of [0, 87, 199]) {
      const candidates = rows.filter((row) => row.id !== source);
      for (let y = -100; y < top + 100; y += 43.7) {
        const target = candidates.find((row) => {
          const r = row.getBoundingClientRect();
          return y < r.top + r.height / 2;
        });
        reads = 0;
        const result = resolveDropIntentByClientY(
          rows,
          source,
          y,
          (row) => row.id,
        );
        assert.equal(result.targetEl, target ?? candidates.at(-1));
        assert.equal(result.placeAfter, !target);
        assert.ok(
          reads <= 8,
          `geometry reads ${reads} exceed logarithmic bound`,
        );
      }
    }
  }
});

test('reconciliation uses atomic moves only for connected retained rows, with a portable fallback', () => {
  const { reconcileChildren } = run(['reconcileChildren']);
  for (const atomic of [true, false]) {
    const calls = [];
    const container = {
      children: [],
      isConnected: true,
      get firstElementChild() {
        return this.children[0];
      },
      insertBefore(row, next) {
        calls.push('insert');
        move(row, next);
      },
    };
    function move(row, next) {
      const index = container.children.indexOf(row);
      if (index >= 0) container.children.splice(index, 1);
      container.children.splice(
        next ? container.children.indexOf(next) : container.children.length,
        0,
        row,
      );
      row.parentElement = container;
    }
    if (atomic)
      container.moveBefore = (row, next) => {
        calls.push('move');
        move(row, next);
      };
    const nodes = ['a', 'b'].map((id) => ({
      id,
      parentElement: container,
      get nextElementSibling() {
        return container.children[container.children.indexOf(this) + 1];
      },
      remove() {},
    }));
    container.children.push(...nodes);
    const added = { id: 'c' };
    reconcileChildren(container, [nodes[1], nodes[0], added]);
    assert.deepEqual(
      container.children.map((row) => row.id),
      ['b', 'a', 'c'],
    );
    assert.deepEqual(calls, [atomic ? 'move' : 'insert', 'insert']);
  }
});
