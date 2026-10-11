import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppSource } from '../../tests/helpers/app-source.mjs';

const { html, run } = loadAppSource(
  new URL('./icons-candidate.html', import.meta.url),
);
const tokens = new Set(
  [...html.matchAll(/<symbol id="icon-([\w]+)"/g)].map((match) => match[1]),
);

test('task icon markup uses only sprite tokens and keeps its cache bounded by the whitelist', () => {
  const cache = new Map();
  const { createMaterialIconMarkup } = run(
    ['normalizeMaterialIconToken', 'createMaterialIconMarkup'],
    {
      MATERIAL_ICON_TOKENS: tokens,
      MATERIAL_ICON_FALLBACK: 'task_alt',
      materialIconMarkupCache: cache,
    },
  );
  for (const token of tokens) {
    const markup = createMaterialIconMarkup(token);
    assert.ok(markup.includes(`data-icon="${token}"`));
    assert.ok(markup.includes(`<use href="#icon-${token}"></use>`));
    assert.ok(markup.includes('aria-hidden="true" focusable="false"'));
    assert.equal(createMaterialIconMarkup(token), markup);
  }
  const fallback = createMaterialIconMarkup('task_alt');
  for (const token of [
    '"><script>alert(1)</script>',
    '<svg onload="alert(1)">',
    '',
    null,
    'unknown',
  ]) {
    assert.equal(createMaterialIconMarkup(token), fallback);
  }
  assert.equal(cache.size, tokens.size);
});
