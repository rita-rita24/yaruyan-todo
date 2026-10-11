import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppSource } from '../../tests/helpers/app-source.mjs';
const { run } = loadAppSource(
  new URL('./paths-candidate.html', import.meta.url),
);

class SvgNode {
  constructor(tag, children = []) {
    this.tag = tag;
    this.children = children;
    this.dataset = {};
    this.attributes = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  append(node) {
    this.children.push(node);
  }
  cloneNode(deep) {
    const copy = new SvgNode(
      this.tag,
      deep ? this.children.map((child) => child.cloneNode(true)) : [],
    );
    copy.dataset = { ...this.dataset };
    copy.attributes = new Map(this.attributes);
    return copy;
  }
}

test('SVG icons preserve canonical shape attributes without sharing mutable nodes or unbounded cache entries', () => {
  const shape = new SvgNode('g', [new SvgNode('path')]);
  shape.setAttribute('transform', 'matrix(.025 0 0 .025 0 24)');
  shape.children[0].setAttribute('d', 'M0 0L24 24');
  const symbols = new Map(
    ['play_circle', 'task_alt'].map((token) => [
      token,
      new SvgNode('symbol', [shape]),
    ]),
  );
  const cache = new Map();
  const { _createMaterialIconSvg } = run(
    ['normalizeMaterialIconToken', '_createMaterialIconSvg'],
    {
      MATERIAL_ICON_TOKENS: new Set(symbols.keys()),
      MATERIAL_ICON_FALLBACK: 'task_alt',
      materialIconSvgTemplates: cache,
      document: {
        createElementNS: (namespace, tag) => {
          assert.equal(namespace, 'http://www.w3.org/2000/svg');
          return new SvgNode(tag);
        },
      },
      qs: (selector) =>
        selector === '.icon-sprite-defs'
          ? 'sprite'
          : symbols.get(selector.slice(6)),
    },
  );
  const first = _createMaterialIconSvg('play_circle'),
    second = _createMaterialIconSvg('play_circle');
  assert.notEqual(first, second);
  assert.notEqual(first.children[0], shape);
  assert.notEqual(
    first.children[0].children[0],
    second.children[0].children[0],
  );
  assert.equal(
    first.children[0].attributes.get('transform'),
    shape.attributes.get('transform'),
  );
  assert.equal(first.children[0].children[0].attributes.get('d'), 'M0 0L24 24');
  first.children[0].children[0].setAttribute('d', 'changed');
  assert.equal(
    _createMaterialIconSvg(
      'play_circle',
    ).children[0].children[0].attributes.get('d'),
    'M0 0L24 24',
  );
  for (const input of ['<script>bad</script>', 'unknown', null])
    assert.equal(_createMaterialIconSvg(input).dataset.icon, 'task_alt');
  assert.equal(cache.size, 2);
});
