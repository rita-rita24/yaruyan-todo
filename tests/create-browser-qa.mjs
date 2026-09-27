// ブラウザでの品質確認用に、実アプリの分離したコピーを生成する。
// 表示されたファイルURLを開く。本番ファイルやユーザーの保存データには触れない。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-browser-qa-'));
const namespace = 'yaruyan-qa-' + randomUUID();
const original = readFileSync(new URL('../yaruyan-todo.html', import.meta.url), 'utf8');

// この関数は、生成したテスト用アプリのクロージャー内で実行する。
async function runBrowserQa(qaNamespace) {
  const qaOutput = document.createElement('pre');
  qaOutput.id = 'qa-results';
  document.body.prepend(qaOutput);
  const qaSessionKey = qaNamespace + '-results';
  const qaAssert = (ok, detail) => { if (!ok) throw new Error(detail); };
  const qaLines = JSON.parse(sessionStorage.getItem(qaSessionKey) || '[]');
  const qaReport = (line) => { qaLines.push(line); qaOutput.textContent = qaLines.join('\n'); };
  const qaParents = () => Array.from({ length: 200 }, (_, parent) => ({
    id: 'parent-' + parent,
    text: ('親タスク <>&" 😀 ' + parent + ' ').padEnd(120, 'あ'),
    done: false,
    focus: createFocusMeta(),
    subtasks: Array.from({ length: 50 }, (_, child) => ({
      id: 'child-' + child,
      text: ('子タスク <>&" 😀 ' + child + ' ').padEnd(120, 'い'),
      done: child % 2 === 0,
      focus: createFocusMeta({ elapsedMs: child * 12345 })
    }))
  }));
  try {
    if (sessionStorage.getItem(qaSessionKey + '-phase') !== 'verify') {
      settings.sound = false;
      settings.celebration = false;
      tasks = normalizeTasks(qaParents());
      organizeMemo = 'メ'.repeat(10000);
      settings.messages = Array.from({ length: 30 }, (_, index) => String(index).padEnd(80, '祝'));
      const qaStart = performance.now();
      render();
      qaAssert(taskList.querySelectorAll('.task-item').length === 200, 'Maximum parents did not render');
      qaAssert(getProgressStats().total === 10000, 'Maximum children count differs');
      qaReport('PASS maximum data rendered: 200 parents / 10,000 children (' + Math.round(performance.now() - qaStart) + ' ms)');
      qaAssert(await save(), 'Maximum data save failed');
      await _indexedDbWriteQueue;
      const qaJson = JSON.stringify(createBackupPayload(), null, 2);
      const qaFile = new File([qaJson], 'qa-backup.json', { type: 'application/json' });
      qaAssert(qaFile.size <= MAX_BACKUP_FILE_BYTES, 'Own backup exceeds the import limit');
      qaReport('PASS maximum backup fits import limit (' + qaFile.size + ' bytes)');
      tasks = [];
      organizeMemo = '';
      qaAssert(await save(), 'Clearing test state failed');
      qaAssert(await importBackupFile(qaFile), 'Backup file parser rejected own export');
      qaAssert(confirmState.action === 'import-backup', 'Import confirmation was not required');
      await executeConfirmedAction();
      await _indexedDbWriteQueue;
      qaAssert(JSON.stringify(tasks) === JSON.stringify(normalizeTasks(qaParents())), 'Backup task round-trip differs');
      qaAssert(organizeMemo.length === 10000 && settings.messages.length === 30, 'Backup memo/settings round-trip differs');
      qaReport('PASS maximum backup file import, confirmation and restoration');
      sessionStorage.setItem(qaSessionKey, JSON.stringify(qaLines));
      sessionStorage.setItem(qaSessionKey + '-phase', 'verify');
      location.reload();
    } else {
      qaAssert(JSON.stringify(tasks) === JSON.stringify(normalizeTasks(qaParents())), 'Reload task data differs');
      qaAssert(organizeMemo.length === 10000 && settings.messages.length === 30, 'Reload memo/settings data differs');
      qaReport('PASS maximum data survives full page reload');
      await _indexedDbWriteQueue;
      const qaIndexed = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
      const qaExpected = JSON.stringify(tasks);
      const qaActual = qaIndexed[TASKS_KEY] || '';
      let qaDifference = 0;
      while (qaDifference < qaExpected.length && qaExpected[qaDifference] === qaActual[qaDifference]) qaDifference += 1;
      qaAssert(qaActual === qaExpected, 'IndexedDB contents differ after reload: expected '
        + qaExpected.length + ' chars, got ' + qaActual.length + ' chars, first difference ' + qaDifference
        + '; actual prefix ' + qaActual.slice(0, 150));
      qaReport('PASS native IndexedDB data agrees with restored application');
      qaReport('ALL 5 BROWSER CHECKS PASSED');
      sessionStorage.removeItem(qaSessionKey);
      sessionStorage.removeItem(qaSessionKey + '-phase');
      document.body.replaceChildren(qaOutput);
    }
  } catch (qaError) {
    qaReport('FAIL: ' + qaError.stack);
    document.body.replaceChildren(qaOutput);
  }
}

const marker = '      navigate(getRouteFromHash());\n    })();';
if (!original.includes(marker)) throw new Error('Application initialization marker not found');
const fixture = original.replaceAll('yatta-spa-', namespace + '-')
  .replace(marker, '      navigate(getRouteFromHash());\nawait (' + runBrowserQa.toString()
    + ')(' + JSON.stringify(namespace) + ');\n    })();');
const output = join(directory, 'browser-qa.html');
writeFileSync(output, fixture);
console.log(pathToFileURL(output).href);
