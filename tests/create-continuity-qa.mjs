// 使い捨てのコピーにより、ブラウザ統合テストをユーザーデータから分離する。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function continuityQa() {
  const lines = [];
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const frame = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  const settle = async () => {
    await _storedStateSaveQueue;
    await _indexedDbWriteQueue;
    await frame();
  };
  const pointer = (type, id) =>
    document.dispatchEvent(
      new PointerEvent(type, { pointerId: id, bubbles: true }),
    );
  try {
    settings.sound = false;
    settings.celebration = false;
    settings.pomodoro = { enabled: true, focusMinutes: 25, breakMinutes: 5 };
    tasks = normalizeTasks([{ id: 'original', text: '元のタスク' }]);
    await save();
    navigate('settings');
    await frame();
    navigate('tasks');
    await frame();
    const original = structuredClone(createBackupPayload());
    const replacement = normalizeBackupPayload({
      ...original,
      data: {
        ...original.data,
        settings: {
          ...original.data.settings,
          pomodoro: { enabled: true, focusMinutes: 40, breakMinutes: 8 },
        },
      },
    });
    await performImportBackup(structuredClone(replacement));
    await settle();
    check(
      pomodoroFocusMinutesInput.value === '40' &&
        pomodoroBreakMinutesInput.value === '8',
      'import outside settings synchronizes hidden timer controls',
    );
    await openFocusModal('parent', 'original');
    await settle();
    check(
      focusState.pomodoroFocusMs === 40 * 60000 &&
        settings.pomodoro.focusMinutes === 40,
      'starting focus does not overwrite restored settings with stale controls',
    );
    await performAbortFocus();
    await settle();

    await performImportBackup(normalizeBackupPayload(original));
    navigate('settings');
    await frame();
    await performImportBackup(structuredClone(replacement));
    navigate('tasks');
    await frame();
    qs('.toast-action-btn', toastLayer).click();
    await settle();
    check(
      settings.pomodoro.focusMinutes === 25 &&
        pomodoroFocusMinutesInput.value === '25',
      'import Undo synchronizes timer controls after leaving settings',
    );
    await openFocusModal('parent', 'original');
    await settle();
    check(
      focusState.pomodoroFocusMs === 25 * 60000,
      'focus after Undo uses the original duration',
    );
    await performAbortFocus();
    await settle();

    const realSave = _saveStoredState;
    _saveStoredState = async () => false;
    try {
      const ok = await performImportBackup(structuredClone(replacement));
      check(
        !ok &&
          settings.pomodoro.focusMinutes === 25 &&
          pomodoroFocusMinutesInput.value === '25',
        'failed import rolls back timer state and hidden controls together',
      );
    } finally {
      _saveStoredState = realSave;
    }
    navigate('settings');
    await frame();
    pomodoroFocusMinutesInput.focus();
    pomodoroFocusMinutesInput.value = '90';
    _saveStoredState = async () => false;
    try {
      const ok = await commitPomodoroSettingsFromControls();
      check(
        !ok &&
          settings.pomodoro.focusMinutes === 25 &&
          pomodoroFocusMinutesInput.value === '25',
        'failed timer save resets the focused field',
      );
      check(
        !isStateSaveOperationPending() && !appShell.inert,
        'failure releases the application save lock',
      );
    } finally {
      _saveStoredState = realSave;
    }
    await commitPomodoroSettingsFromControls();
    check(
      settings.pomodoro.focusMinutes === 25,
      'next commit cannot silently reapply the rejected duration',
    );

    navigate('tasks');
    await frame();
    openParentModal('original');
    _restoreFocusToTaskRow('parent', 'original');
    await frame();
    check(
      parentModalOverlay.contains(document.activeElement),
      'delayed reorder focus cannot escape a newly opened editor',
    );
    closeParentModal();
    await frame();
    _restoreFocusToTaskRow('parent', 'original');
    await frame();
    check(
      document.activeElement.matches('.parent-drag-handle'),
      'ordinary reorder restores its drag handle',
    );

    navigate('memo');
    await frame();
    organizeMemoInput.focus();
    organizeMemoInput.value = 'クリックを妨げず保存するメモ';
    handleOrganizeMemoInput();
    pointer('pointerdown', 71);
    pointer('pointerdown', 72);
    organizeMemoInput.blur();
    check(
      !isStateSaveOperationPending() && !appShell.inert,
      'memo blur during a pointer gesture keeps the clicked controls interactive',
    );
    await settle();
    pointer('pointerup', 71);
    check(
      (await persistOrganizeMemoCheckpoint()) === false,
      'another pressed pointer still defers the autosave lock',
    );
    pointer('pointercancel', 72);
    await flushOrganizeMemoSave();
    await settle();
    let stored = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(
      stored[ORGANIZE_MEMO_KEY] === organizeMemo &&
        localStorage.getItem(ORGANIZE_MEMO_KEY) === organizeMemo,
      'pointer release and cancellation allow the memo to reach both storage backends',
    );
    pointer('pointerdown', 73);
    window.dispatchEvent(new Event('blur'));
    check(
      (await persistOrganizeMemoCheckpoint()) === true,
      'leaving the window clears a lost pointer release',
    );

    let plays = 0,
      resume;
    const previousAudio = audioCtx;
    const fakeAudio = {
      state: 'suspended',
      resume: () =>
        new Promise((resolve) => {
          resume = resolve;
        }),
    };
    audioCtx = fakeAudio;
    settings.sound = true;
    _withRunningAudio(() => plays++);
    settings.sound = false;
    fakeAudio.state = 'running';
    resume();
    await Promise.resolve();
    check(plays === 0, 'muting cancels audio waiting for context resume');
    plays = 0;
    settings.sound = true;
    _withRunningAudio(() => plays++);
    check(
      plays === 1,
      'unmuted running audio still invokes its playback callback',
    );
    settings.sound = false;
    audioCtx = previousAudio;

    navigate('tasks');
    await frame();
    await openFocusModal('parent', 'original');
    await pauseOrResumeFocus();
    check(
      getTask('original').focus.focusState === 'paused',
      'focus pause remains functional',
    );
    await pauseOrResumeFocus();
    check(
      getTask('original').focus.focusState === 'running',
      'focus resume remains functional',
    );
    await completeFocus();
    await settle();
    check(
      getTask('original').done && !focusOverlay.classList.contains('show'),
      'focus completion closes the dialog',
    );
    stored = await _readManyFromIndexedDb(PERSISTED_STATE_KEYS);
    check(
      stored[TASKS_KEY] === localStorage.getItem(TASKS_KEY) &&
        stored[TASKS_KEY] === JSON.stringify(tasks),
      'final task data matches both native persistence backends',
    );
  } catch (error) {
    lines.push('ERROR ' + error.stack);
  }
  lines.push(
    `${lines.filter((line) => line.startsWith('PASS')).length} PASSED / ${lines.filter((line) => /^(FAIL|ERROR)/.test(line)).length} FAILED`,
  );
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent = lines.join('\n');
  document.body.replaceChildren(output);
}

const directory = mkdtempSync(join(tmpdir(), 'yaruyan-continuity-qa-'));
const original = readFileSync(
  process.argv[2] || new URL('../yaruyan-todo.html', import.meta.url),
  'utf8',
);
const isolated = original.replaceAll(
  'yatta-spa-',
  `yaruyan-continuity-${randomUUID()}-`,
);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker))
  throw new Error('Initialization marker missing');
writeFileSync(
  join(directory, 'index.html'),
  isolated.replace(
    marker,
    '      navigate(getRouteFromHash());\nawait (' +
      continuityQa.toString() +
      ')();\n    })();',
  ),
);
writeFileSync(
  join(directory, 'app.html'),
  isolated.replaceAll('yaruyan-continuity-', 'yaruyan-continuity-preview-'),
);
console.log(directory);
