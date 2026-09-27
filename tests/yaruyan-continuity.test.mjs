import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();

const rhythm = { enabled: true, focusMinutes: 25, breakMinutes: 5 };

function settingsContext() {
  const context = {
    settings: { pomodoro: { ...rhythm } }, tasks: [], taskViewState: {},
    organizeMemoInput: {}, normalizeTasks: value => value, normalizeSettings: value => value,
    normalizeOrganizeMemo: value => value, normalizeTaskViewState: value => value,
    applySidebarState() {}, setMemoSaveStatus() {},
    document: { activeElement: null },
    pomodoroToggle: { checked: false }, pomodoroFocusMinutesInput: { value: '90' },
    pomodoroBreakMinutesInput: { value: '30' }, pomodoroRhythmCard: null,
    _pomodoroSettingsControlsSynced: true, isStateSaveOperationPending: () => false,
    normalizePomodoroSettings: value => ({ ...value }),
    normalizePomodoroMinutes: (value, fallback) => value === '' ? fallback : Number(value),
    MIN_POMODORO_MINUTES: 1, MAX_POMODORO_FOCUS_MINUTES: 180, MAX_POMODORO_BREAK_MINUTES: 120,
    _createAppStateSnapshot: () => ({ settings: structuredClone(context.settings) }),
    _commitStateSave: async () => true
  };
  return context;
}

for (const method of ['_applyNormalizedBackupPayload', '_applyAppStateSnapshot']) {
  test(`${method} restores timer controls before a later focus start can commit stale values`, async () => {
    const context = settingsContext();
    const api = run([method, 'syncPomodoroSettingsControls', 'commitPomodoroSettingsFromControls'], context);
    const restored = { enabled: true, focusMinutes: 40, breakMinutes: 8 };
    api[method]({ tasks: [], settings: { pomodoro: restored }, taskView: { filter: 'all' }, organizeMemo: '' });
    await api.commitPomodoroSettingsFromControls();
    assert.deepEqual({ ...context.settings.pomodoro }, restored);
    assert.equal(context.pomodoroFocusMinutesInput.value, '40');
    assert.equal(context.pomodoroBreakMinutesInput.value, '8');
  });
}

test('an unrelated failed operation preserves a timer draft when the saved rhythm did not change', () => {
  const context = settingsContext();
  context.document.activeElement = context.pomodoroFocusMinutesInput;
  const api = run(['_applyAppStateSnapshot', 'syncPomodoroSettingsControls'], context);
  api._applyAppStateSnapshot({ tasks: [], settings: { pomodoro: { ...rhythm } }, taskView: {}, organizeMemo: '' });
  assert.equal(context.pomodoroFocusMinutesInput.value, '90');
});

test('failed duration saves reset even the focused control and cannot be retried by starting focus', async () => {
  const context = settingsContext();
  context.document.activeElement = context.pomodoroFocusMinutesInput;
  let saves = 0;
  context._commitStateSave = async previous => {
    saves++;
    context.settings = previous.settings;
    return false;
  };
  const api = run(['commitPomodoroSettingsFromControls', 'syncPomodoroSettingsControls'], context);
  assert.equal(await api.commitPomodoroSettingsFromControls(), false);
  assert.equal(context.pomodoroFocusMinutesInput.value, '25');
  assert.equal(context.pomodoroBreakMinutesInput.value, '5');
  assert.equal(context.pomodoroToggle.checked, true);
  assert.equal(await api.commitPomodoroSettingsFromControls(), true);
  assert.equal(saves, 1);
});

for (const type of ['parent', 'subtask']) {
  test(`delayed ${type} reorder focus respects a new modal, route, or save lock`, () => {
    let callback, focuses = 0, route = 'tasks', modal = null, pending = false;
    const target = { focus: () => focuses++ };
    const api = run(['_restoreFocusToTaskRow'], {
      requestAnimationFrame: fn => { callback = fn; }, qs: () => target,
      getRouteFromHash: () => route, _getActiveModalOverlay: () => modal,
      isStateSaveOperationPending: () => pending, _isFocusableElement: () => true
    });
    for (const blocked of ['modal', 'route', 'pending', null]) {
      api._restoreFocusToTaskRow(type, 'parent', 'child');
      modal = blocked === 'modal' ? {} : null;
      route = blocked === 'route' ? 'memo' : 'tasks';
      pending = blocked === 'pending';
      callback();
      assert.equal(focuses, blocked === null ? 1 : 0);
    }
  });
}

test('queued all-done feedback is cancelled if work becomes incomplete before the frame', () => {
  const frames = [];
  let done = true, celebrations = 0, sounds = 0;
  const context = { syncAllParents() {}, applyColorMode() {}, applyThemeColor() {},
    getRouteFromHash: () => 'tasks', isAllDone: () => done, renderTasks() {}, renderRoute() {},
    hydrateMaterialIcons() {}, updateDocumentTaskIndicators() {},
    handleTooltipViewportChange() {}, modalState: {}, previousAllDoneState: false,
    focusOverlay: { classList: { contains: () => false } },
    requestAnimationFrame: fn => frames.push(fn), settings: { celebration: true },
    showCelebration: () => celebrations++, launchConfetti() {}, window: {},
    playAllClearSound: () => sounds++ };
  const api = run(['render'], context);
  api.render();
  done = false;
  api.render();
  frames.splice(0).forEach(fn => fn());
  assert.equal(celebrations, 0);
  assert.equal(sounds, 0);
  done = true;
  api.render();
  frames.splice(0).forEach(fn => fn());
  assert.equal(celebrations, 1);
  assert.equal(sounds, 1);
  done = false;
  api.render();
  done = true;
  api.render();
  done = false;
  api.render();
  done = true;
  api.render();
  frames.splice(0).forEach(fn => fn());
  assert.equal(celebrations, 2, 'Only the last completion in the same frame is celebrated');
  assert.equal(sounds, 2);
});

test('a suspended sound cannot play after sound is switched off', async () => {
  let resume, plays = 0;
  const ctx = { state: 'suspended', resume: () => new Promise(resolve => { resume = resolve; }) };
  const settings = { sound: true };
  const api = run(['_withRunningAudio'], { getAudioCtx: () => ctx, settings });
  api._withRunningAudio(() => plays++);
  settings.sound = false;
  ctx.state = 'running';
  resume();
  await Promise.resolve();
  assert.equal(plays, 0);
  settings.sound = true;
  api._withRunningAudio(() => plays++);
  assert.equal(plays, 1);
});

test('muted interactions do not initialize an audio context', () => {
  let contexts = 0;
  const api = run(['_withRunningAudio'], { settings: { sound: false }, getAudioCtx() {
    contexts++;
    return { state: 'running' };
  } });
  api._withRunningAudio(() => {});
  assert.equal(contexts, 0);
});

test('a closed audio context is replaced together with its old audio nodes', () => {
  const context = { audioCtx: { state: 'closed' }, _audioPrimed: true,
    _audioMasterGainNode: {},
    window: { AudioContext: class { state = 'running'; } } };
  const api = run(['getAudioCtx'], context);
  const replacement = api.getAudioCtx();
  assert.equal(replacement.state, 'running');
  assert.equal(context._audioMasterGainNode, null);
  assert.equal(context._audioPrimed, false);
  assert.equal(api.getAudioCtx(), replacement);
});

test('memo autosave waits for every pressed pointer without cancelling the pending click', async () => {
  let locks = 0, schedules = 0, saves = 0;
  const activePointerIds = new Set([1, 2]);
  const api = run(['persistOrganizeMemoCheckpoint'], {
    activePointerIds, organizeMemoComposing: false, activeCompositionTarget: null,
    isStateSaveOperationPending: () => false,
    scheduleOrganizeMemoSave: () => schedules++, setStateSaveOperationPending: () => locks++,
    _enqueueStoredStateSave: async () => { saves++; return true; }, setMemoSaveStatus() {}
  });
  assert.equal(await api.persistOrganizeMemoCheckpoint(), false);
  activePointerIds.delete(1);
  assert.equal(await api.persistOrganizeMemoCheckpoint(), false);
  assert.equal(locks, 0);
  assert.equal(saves, 0);
  assert.equal(schedules, 2);
  activePointerIds.delete(2);
  assert.equal(await api.persistOrganizeMemoCheckpoint(), true);
  assert.equal(saves, 1);
  assert.equal(locks, 2);
});
