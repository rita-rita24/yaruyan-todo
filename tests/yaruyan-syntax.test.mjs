import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadAppSource } from './helpers/app-source.mjs';

test('the complete application script parses', () => {
  for (const script of loadAppSource().scripts) {
    assert.doesNotThrow(() => new vm.Script(script));
  }
});
