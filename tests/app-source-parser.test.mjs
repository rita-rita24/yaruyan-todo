import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAppSource } from './helpers/app-source.mjs';

test('source extraction follows syntax rather than indentation, braces in strings or nested declarations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yaruyan-source-'));
  try {
    const path = join(directory, 'fixture.html');
    writeFileSync(
      path,
      `<script>(async()=>{
function target(){const text='}'; function nested(){return '{';} return text+nested();}
function bindInputEnter(input, action){input.addEventListener('keydown', action);}
bindInputEnter(
 input,
 action
);
})();</script>`,
    );
    const app = loadAppSource(path);
    assert.equal(app.run(['target']).target(), '}{');
    assert.throws(() => app.source('nested'), /missing/);
    assert.match(
      app.inputKeydownSource('input'),
      /bindInputEnter\([\s\S]*input/,
    );
  } finally {
    rmSync(directory, { recursive: true });
  }
});
