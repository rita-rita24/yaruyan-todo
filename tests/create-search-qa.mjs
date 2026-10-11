// 実アプリの保存キー・DB名を隔離した、再実行可能な検索のブラウザ検証。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function searchQa() {
  const results = [];
  const check = (ok, label) => {
    results.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
    if (!ok) throw new Error(label);
  };
  const search = (value) => {
    taskSearchInput.value = value;
    taskSearchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
  };
  const visibleParents = () =>
    qsa('.task-item', taskList)
      .map((row) => row.dataset.id)
      .join(',');
  const visibleChildren = () =>
    qsa('.subtask-item', taskList)
      .map((row) => row.dataset.subId)
      .join(',');
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([
      {
        id: 'project',
        text: 'サイト公開',
        subtasks: [
          { id: 'api', text: 'ＡＰＩ のテスト' },
          { id: 'design', text: '画面デザイン', done: true },
        ],
      },
      { id: 'mail', text: 'メールを返す', done: true },
    ]);
    taskViewState.filter = 'all';
    check(await save(), 'fixture commits to isolated native storage');
    render();
    const savedMeta = LOCAL_STORAGE.getItem(STATE_META_KEY);
    search('api');
    check(
      visibleParents() === 'project' && visibleChildren() === 'api',
      'full-width child matches a lowercase query and retains its parent',
    );
    check(
      clearAllBtn.disabled &&
        clearCompletedBtn.disabled &&
        taskViewStatus.textContent.startsWith('1件を表示中'),
      'search updates the count and disables both bulk-delete buttons',
    );
    check(
      LOCAL_STORAGE.getItem(STATE_META_KEY) === savedMeta &&
        !JSON.stringify(createBackupPayload().data.taskView).includes('api'),
      'search does not advance the save generation or enter the backup',
    );
    openClearAllConfirm();
    check(
      !confirmModalOverlay.classList.contains('show'),
      'keyboard-accessible bulk confirmation is guarded',
    );
    check(
      (await performClearAll()) === false && tasks.length === 2,
      'bulk execution is also guarded',
    );
    await setTaskFilter('completed');
    check(
      visibleParents() === '' &&
        emptyStateTitle.textContent === '一致するタスクはありません',
      'search combines with completion state and explains an empty result',
    );
    search('サイト');
    check(
      visibleChildren() === 'design',
      'parent match includes only children in the active status filter',
    );
    taskSearchInput.value = '未確定';
    taskSearchInput.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true }),
    );
    check(
      visibleChildren() === 'design',
      'IME intermediate input leaves results unchanged',
    );
    taskSearchInput.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true }),
    );
    check(visibleParents() === '', 'IME committed input refreshes results');
    taskSearchInput.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    check(
      taskSearchInput.value === '' && visibleParents() === 'project,mail',
      'Escape clears search without changing the completion filter',
    );
    search('<img src=x>');
    check(
      visibleParents() === '' && !taskList.querySelector('img'),
      'markup query is treated as plain text',
    );
    clearTaskSearchBtn.click();
    check(
      document.activeElement === taskSearchInput && taskSearchQuery === '',
      'clear button restores search focus',
    );
    search('メール');
    taskInput.value = '保存テスト';
    const originalSave = _saveStoredState;
    try {
      _saveStoredState = async () => false;
      await addTask();
      check(
        taskSearchQuery === 'メール' &&
          taskInput.value === '保存テスト' &&
          taskViewState.filter === 'completed' &&
          tasks.length === 2,
        'failed addition preserves search, filter, input and tasks',
      );
    } finally {
      _saveStoredState = originalSave;
    }
    await addTask();
    check(
      taskSearchQuery === '' &&
        taskSearchInput.value === '' &&
        taskInput.value === '' &&
        taskViewState.filter === 'all' &&
        qsa('.task-item', taskList).length === 3,
      'successful addition clears search and reveals the saved task',
    );
  } catch (error) {
    results.push(`ERROR ${error.stack}`);
  }
  const failures = results.filter((line) => /^(FAIL|ERROR)/.test(line)).length;
  const output = document.createElement('pre');
  output.textContent =
    results.join('\n') +
    `\n${results.filter((line) => line.startsWith('PASS')).length} PASSED / ${failures} FAILED`;
  document.body.replaceChildren(output);
  document.title = failures ? 'FAIL: search QA' : 'PASS: search QA';
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-search-qa-'));
const suffix = randomUUID();
const original = readFileSync(
  new URL('../yaruyan-todo.html', import.meta.url),
  'utf8',
);
const isolated = original.replace(
  /'(yatta-spa-[^']+)'/g,
  (_, key) => `'${key}-search-qa-${suffix}'`,
);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker))
  throw new Error('Application initialization marker missing');
writeFileSync(
  join(directory, 'index.html'),
  isolated.replace(
    marker,
    `      navigate(getRouteFromHash());\nawait (${searchQa.toString()})();\n    })();`,
  ),
);
writeFileSync(
  join(directory, 'app.html'),
  isolated.replaceAll(`search-qa-${suffix}`, `search-preview-${suffix}`),
);
console.log(directory);
