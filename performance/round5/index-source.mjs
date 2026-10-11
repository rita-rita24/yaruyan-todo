import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'espree';
const sha = (value) => createHash('sha256').update(value).digest('hex');
function index(path) {
  const html = readFileSync(path, 'utf8');
  const match = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(html),
    script = match[1];
  const offset =
    html.slice(0, match.index + match[0].indexOf(script)).split('\n').length -
    1;
  const ast = parse(script, { ecmaVersion: 2026, range: true, loc: true });
  const body = ast.body.find(
    (node) => node.expression?.callee?.type === 'ArrowFunctionExpression',
  ).expression.callee.body.body;
  const declarations = body
    .filter((node) => node.type === 'FunctionDeclaration')
    .map((node) => ({
      name: node.id.name,
      startLine: node.loc.start.line + offset,
      endLine: node.loc.end.line + offset,
      sha256: sha(script.slice(...node.range)),
    }));
  const allFunctions = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      [
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression',
      ].includes(node.type)
    )
      allFunctions.push({
        name: node.id?.name || null,
        type: node.type,
        startLine: node.loc.start.line + offset,
        endLine: node.loc.end.line + offset,
        async: node.async,
        generator: node.generator || false,
      });
    for (const [key, value] of Object.entries(node)) {
      if (['range', 'loc'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return {
    path,
    sha256: sha(html),
    htmlOutsideScript: html.replace(script, ''),
    declarations,
    allFunctions,
    nonFunctionStatements: body
      .filter((node) => node.type !== 'FunctionDeclaration')
      .map((node) => sha(script.slice(...node.range))),
  };
}
const before = index('performance/round5/baseline.html'),
  after = index('performance/round5/child-v4-candidate.html');
assert.equal(before.htmlOutsideScript, after.htmlOutsideScript);
assert.deepEqual(before.nonFunctionStatements, after.nonFunctionStatements);
const previous = new Map(
  before.declarations.map((entry) => [entry.name, entry]),
);
const changed = after.declarations
  .filter(
    (entry) =>
      previous.has(entry.name) &&
      entry.sha256 !== previous.get(entry.name).sha256,
  )
  .map((entry) => entry.name);
const added = after.declarations
  .filter((entry) => !previous.has(entry.name))
  .map((entry) => entry.name);
const removed = before.declarations
  .filter(
    (entry) => !after.declarations.some((next) => next.name === entry.name),
  )
  .map((entry) => entry.name);
assert.deepEqual(changed, ['renderTasks']);
assert.equal(added.length, 3);
assert.equal(removed.length, 0);
writeFileSync(
  'performance/round5/application-index.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      source: after.path,
      sourceSha256: after.sha256,
      topLevelNamedDeclarations: after.declarations.length,
      allFunctionNodes: after.allFunctions.length,
      functions: after.allFunctions,
      declarations: after.declarations,
      changed,
      added,
      removed,
      htmlOutsideScriptUnchanged: true,
      otherApplicationStatementsUnchanged: true,
      caveat:
        'Function enumeration and exact source comparison are not a complete semantic/API audit. Anonymous callbacks are included in allFunctionNodes, with null names.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    topLevel: after.declarations.length,
    all: after.allFunctions.length,
    changed,
    added,
  }),
);
