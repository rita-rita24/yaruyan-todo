import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'espree';
const html = readFileSync('yaruyan-todo.html', 'utf8');
const scriptMatch = /<script\b[^>]*>([\s\S]*?)<\/script>/g.exec(html);
const script = scriptMatch[1];
const offset =
  html.slice(0, scriptMatch.index + scriptMatch[0].indexOf(script)).split('\n')
    .length - 1;
const ast = parse(script, { ecmaVersion: 2026, loc: true });
const body = ast.body.find(
  (node) => node.expression?.callee?.type === 'ArrowFunctionExpression',
).expression.callee.body.body;
const functions = body
  .filter((node) => node.type === 'FunctionDeclaration')
  .map((node) => ({
    name: node.id.name,
    startLine: node.loc.start.line + offset,
    endLine: node.loc.end.line + offset,
    async: node.async,
  }));
writeFileSync(
  'performance/round3/application-index.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      sha256: createHash('sha256').update(html).digest('hex'),
      languages: [
        'HTML',
        'CSS',
        'SVG',
        'JavaScript (browser)',
        'JavaScript ES modules (Node)',
        'JSON',
        'YAML',
        'Markdown with shell examples',
      ],
      functions,
      review: [
        {
          area: 'storage',
          functions:
            '_safeStorage*, _requestIndexedDbOpen, _readManyFromIndexedDb, _writeManyToIndexedDb, _saveStoredState, _enqueueStoredStateSave',
          disposition:
            'transaction/generation/timeout/rollback contract retained; no API obsolescence identified by configured rules',
        },
        {
          area: 'normalization and backup',
          functions:
            'normalize*, createBackupPayload, exportBackup, importBackupFile, performImportBackup',
          disposition:
            'limits/IDs/escaping/URL release preserved; browser QA and existing regression tests',
        },
        {
          area: 'tasks and rendering',
          functions:
            'render*, getFilteredSubtasks, createSubtaskRowMarkup, reconcileChildren',
          disposition:
            'markup responsibility extracted; atomic DOM move with fallback; partial-child patch rejected',
        },
        {
          area: 'drag and reordering',
          functions:
            'resolveDropIntentByClientY, reorderParentTasks, reorderSubtasks',
          disposition:
            'binary coordinate lookup adopted; latest geometry every event; variable-height and preview contract tested',
        },
        {
          area: 'modal, focus and keyboard',
          functions:
            '_openModalOverlay, _closeModalOverlay, _trapFocusInOverlay, handleDocumentShortcuts',
          disposition:
            'nested modal/return focus/inert retained; seven IME exceptions documented',
        },
        {
          area: 'memo, focus timer, sound and celebration',
          functions:
            'flushOrganizeMemoSave, updateFocusTimer, syncPomodoroPhaseProgress, play*, launchConfetti',
          disposition:
            'pointer/IME deferral, save order and cleanup retained; real-IME and long-running operations incomplete',
        },
        {
          area: 'messages and toast',
          functions: 'renderMessages, saveEditedMessage, showToast',
          disposition:
            'silent input truncation removed; finally exception suppression removed',
        },
        {
          area: 'HTML/CSS',
          functions: 'whole inline markup/style including generated templates',
          disposition:
            'parsed, obsolete elements/transition checked; existing CSS layers/nesting kept, three prefix exceptions; full conformance and browser matrix incomplete',
        },
        {
          area: 'tests and operations',
          functions: 'all maintained .mjs',
          disposition:
            'whole-module lint/format; AST test extraction; lockfile/CI; generated and historical HTML inventoried separately',
        },
      ],
      caveat:
        'AST enumeration/static scans/regression tests are evidence of scope, not proof of full manual audit or absence of every obsolete pattern.',
    },
    null,
    2,
  ),
);
console.log(`${functions.length} application functions indexed`);
