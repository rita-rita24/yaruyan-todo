import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const APP = new URL('../../yaruyan-todo.html', import.meta.url);

// The shipped HTML is the source of truth, including for comparison runs.
export function loadAppSource(path = process.env.YARUYAN_TEST_SOURCE || APP) {
  const html = readFileSync(path, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, script]) => script);
  assert.ok(scripts.length, `Application script missing: ${path}`);
  const script = scripts.join('\n');
  const cache = new Map();

  function source(name) {
    assert.match(name, /^[A-Za-z_$][\w$]*$/, 'Expected a function name');
    if (cache.has(name)) return cache.get(name);
    const escapedName = name.replace(/\$/g, '\\$');
    const start = new RegExp(`^( +)(?:async )?function ${escapedName}\\(`, 'm').exec(script);
    assert.ok(start, `Function ${name} missing: ${path}`);
    // App-level function braces share the declaration's indentation. Avoid
    // counting braces inside strings, templates, comments or destructuring.
    const rest = script.slice(start.index);
    const end = new RegExp(`^${start[1]}}\\r?$`, 'm').exec(rest);
    assert.ok(end, `Function ${name} closing brace missing: ${path}`);
    const extracted = rest.slice(0, end.index + end[0].length);
    new vm.Script(extracted, { filename: `${path}#${name}` });
    cache.set(name, extracted);
    return extracted;
  }

  function run(names, context = {}) {
    return vm.runInNewContext(
      names.map(source).join('\n') + `\n({${names.join(',')}})`, context
    );
  }

  return { html, scripts, source, run };
}
