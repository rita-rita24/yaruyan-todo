import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'espree';

export const APP = new URL('../../yaruyan-todo.html', import.meta.url);

// The shipped HTML is the source of truth, including for comparison runs.
export function loadAppSource(path = process.env.YARUYAN_TEST_SOURCE || APP) {
  const html = readFileSync(path, 'utf8');
  const scripts = [
    ...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),
  ].map(([, script]) => script);
  assert.ok(scripts.length, `Application script missing: ${path}`);
  const script = scripts.join('\n');
  const cache = new Map();
  const program = parse(script, {
    ecmaVersion: 2026,
    sourceType: 'script',
    range: true,
  });
  const application = program.body.find(
    (node) =>
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'CallExpression' &&
      node.expression.callee.type === 'ArrowFunctionExpression',
  )?.expression.callee.body.body;
  assert.ok(application, `Application scope missing: ${path}`);
  const declarations = new Map(
    application
      .filter((node) => node.type === 'FunctionDeclaration')
      .map((node) => [node.id.name, node]),
  );

  function source(name) {
    assert.match(name, /^[A-Za-z_$][\w$]*$/, 'Expected a function name');
    if (cache.has(name)) return cache.get(name);
    const declaration = declarations.get(name);
    assert.ok(declaration, `Function ${name} missing: ${path}`);
    const extracted = script.slice(...declaration.range);
    new vm.Script(extracted, { filename: `${path}#${name}` });
    cache.set(name, extracted);
    return extracted;
  }

  function run(names, context = {}) {
    return vm.runInNewContext(
      names.map(source).join('\n') + `\n({${names.join(',')}})`,
      context,
    );
  }

  function inputKeydownSource(input) {
    assert.match(input, /^[A-Za-z_$][\w$]*$/, 'Expected an input name');
    const statement = application.find((node) => {
      if (
        node.type !== 'ExpressionStatement' ||
        node.expression.type !== 'CallExpression'
      )
        return false;
      const call = node.expression;
      if (
        call.callee.type === 'Identifier' &&
        call.callee.name === 'bindInputEnter'
      ) {
        return (
          call.arguments[0]?.type === 'Identifier' &&
          call.arguments[0].name === input
        );
      }
      return (
        call.callee.type === 'MemberExpression' &&
        call.callee.object.name === input &&
        call.callee.property.name === 'addEventListener' &&
        call.arguments[0]?.value === 'keydown'
      );
    });
    assert.ok(statement, `Keydown binding for ${input} missing`);
    const binding = script.slice(...statement.range);
    return statement.expression.callee.type === 'Identifier'
      ? `${source('bindInputEnter')}\n${binding}`
      : binding;
  }

  return { html, scripts, source, run, inputKeydownSource };
}
