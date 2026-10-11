import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { HtmlValidate } from 'html-validate';

const rules = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'smart'],
  'no-unreachable': 'error',
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-constant-binary-expression': 'error',
  'no-unsafe-finally': 'error',
  'no-new-wrappers': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-prototype-builtins': 'error',
  'no-async-promise-executor': 'error',
};
const lint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      languageOptions: { ecmaVersion: 2026, sourceType: 'module' },
      rules,
    },
  ],
});
const files = [];
async function walk(directory = '.') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.DS_Store'].includes(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else if (
      /\.(?:mjs|html|json|md|yml)$/.test(path) ||
      ['.nvmrc', '.gitignore'].includes(entry.name)
    )
      files.push(path);
  }
}
await walk();
let errors = 0;
const inventory = [];
for (const path of files.sort()) {
  const source = await readFile(path, 'utf8');
  const snapshot = path.startsWith('./performance/') && path.endsWith('.html');
  const ownedCode = path.endsWith('.mjs') || path === './yaruyan-todo.html';
  const record = {
    path,
    bytes: Buffer.byteLength(source),
    sha256: createHash('sha256').update(source).digest('hex'),
    scope: snapshot
      ? 'immutable experiment or generated QA'
      : ownedCode
        ? 'maintained source'
        : 'configuration, evidence or documentation',
  };
  inventory.push(record);
  if (path.endsWith('.json')) JSON.parse(source);
  if (path.endsWith('.yml')) await prettier.format(source, { parser: 'yaml' });
  if (path.endsWith('.mjs')) {
    const results = await lint.lintText(source, { filePath: path });
    for (const result of results) {
      errors += result.errorCount;
      for (const message of result.messages)
        console.error(
          `${path}:${message.line} ${message.ruleId}: ${message.message}`,
        );
    }
    if (
      !(await prettier.check(source, { parser: 'babel', singleQuote: true }))
    ) {
      console.error(`${path}: run npm run format`);
      errors++;
    }
  }
  if (path.endsWith('.html')) {
    // Parse the whole HTML/CSS/JS without rewriting immutable historical evidence.
    try {
      await prettier.format(source, { parser: 'html' });
    } catch (error) {
      console.error(`${path}: ${error.message}`);
      errors++;
    }
    for (const [index, match] of [
      ...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
    ].entries()) {
      const results = await lint.lintText(match[1], {
        filePath: `${path}.${index}.js`,
      });
      for (const result of results) {
        // Snapshot diagnostics stay visible but do not rewrite the version being compared.
        if (!snapshot) errors += result.errorCount;
        record.scriptDiagnostics =
          (record.scriptDiagnostics ?? 0) + result.errorCount;
        if (!snapshot)
          for (const message of result.messages)
            console.error(
              `${path} script ${index}:${message.line} ${message.ruleId}: ${message.message}`,
            );
      }
    }
  }
}
const html = await readFile('yaruyan-todo.html', 'utf8');
const htmlValidator = new HtmlValidate();
const htmlReport = await htmlValidator.validateString(
  html,
  'yaruyan-todo.html',
);
errors += htmlReport.errorCount;
for (const result of htmlReport.results) {
  for (const message of result.messages)
    console.error(
      `yaruyan-todo.html:${message.line} ${message.ruleId}: ${message.message}`,
    );
}

const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .join('\n');
// The only keyCode exception is the existing IME 229 guard; never use it for key identity.
const legacyReads = [...script.matchAll(/\.keyCode\b/g)];
if (
  legacyReads.length !== 7 ||
  legacyReads.some(
    (match) =>
      !/^\s*=== 229\b/.test(script.slice(match.index + match[0].length)),
  )
) {
  console.error(
    'keyCode exception changed: review IME compatibility before updating the inventory',
  );
  errors++;
}
if (/\.(?:substr|addListener|removeListener)\s*\(|xlink:href/.test(script)) {
  console.error('Deprecated API found in application script');
  errors++;
}
if (/<(?:font|center|marquee|big|blink)\b/i.test(html)) {
  console.error('Obsolete HTML element found');
  errors++;
}
if (/transition:\s*all\b/.test(html)) {
  console.error('Unbounded CSS transition found');
  errors++;
}
const inventoryArgument = process.argv.find((arg) =>
  arg.startsWith('--inventory='),
);
if (process.argv.includes('--inventory') || inventoryArgument)
  await writeFile(
    inventoryArgument?.slice('--inventory='.length) ||
      'performance/round3/source-inventory.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        node: process.version,
        parserEcmaVersion: 2026,
        files: inventory,
        rules,
        errors,
        limitations: [
          'Current static application HTML uses html-validate recommended rules; CSS parsing and generated-markup parsing are not full conformance or cross-browser validation',
          'No type checking for untyped JavaScript',
          'No claim that regex API inventory detects every deprecated API',
          'Immutable experiment HTML is parsed; script diagnostics are recorded, not treated as current-source migration failures',
        ],
      },
      null,
      2,
    ),
  );
console.log(
  `Node ${process.version}: ${files.length} files inventoried, ${files.filter((path) => path.endsWith('.mjs')).length} modules checked, ${errors} errors`,
);
process.exitCode = errors ? 1 : 0;
