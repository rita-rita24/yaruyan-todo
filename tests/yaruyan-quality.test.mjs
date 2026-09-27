import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { source, run } = loadAppSource();

test('text limits never split an emoji surrogate pair in tasks or memo', () => {
  const api = run(['normalizeInputText', 'normalizeOrganizeMemo'], { MAX_ORGANIZE_MEMO_LENGTH: 4 });
  assert.equal(api.normalizeInputText('abc😀', 4), 'abc');
  assert.equal(api.normalizeInputText('ab😀', 4), 'ab😀');
  assert.equal(api.normalizeOrganizeMemo('abc😀'), 'abc');
  assert.equal(api.normalizeOrganizeMemo('ab😀'), 'ab😀');
});

test('HTML escaping handles literal markup and quotes without creating DOM nodes', () => {
  const { escapeHtml } = run(['escapeHtml']);
  assert.equal(escapeHtml(`<img src=x onerror="evil()"> & 'quoted'`), '&lt;img src=x onerror=&quot;evil()&quot;&gt; &amp; &#39;quoted&#39;');
});

test('repeated icon hydration retains the SVG and updates changed icons', () => {
  let writes = 0;
  class Element {
    dataset = {};
    childNodes = [];
    replaceChildren(svg) { writes++; this.firstElementChild = svg; this.childNodes = [svg]; }
  }
  const { setMaterialIcon } = run(['setMaterialIcon'], {
    HTMLElement: Element, normalizeMaterialIconToken: token => token,
    _createMaterialIconSvg: token => ({ querySelector: () => ({ getAttribute: () => '#icon-' + token }) })
  });
  const element = new Element();
  setMaterialIcon(element, 'play_circle');
  const original = element.firstElementChild;
  setMaterialIcon(element, 'play_circle');
  assert.equal(writes, 1);
  assert.equal(element.firstElementChild, original);
  setMaterialIcon(element, 'pause_circle');
  assert.equal(writes, 2);
});

test('tooltip follows the current accessible label without a cached copy', () => {
  let label = '一時停止';
  const element = { getAttribute: key => key === 'aria-label' ? label : null };
  const { _extractTooltipText } = run(['_extractTooltipText']);
  assert.equal(_extractTooltipText(element), '一時停止');
  label = '再開';
  assert.equal(_extractTooltipText(element), '再開');
  assert.equal(_extractTooltipText(null), '');
});

test('memo autosave waits for composition before applying the shared save lock', async () => {
  const locks = [], statuses = [];
  let retries = 0, saves = 0;
  const context = {
    organizeMemoComposing: true, activeCompositionTarget: null, activePointerIds: new Set(), isStateSaveOperationPending: () => false,
    scheduleOrganizeMemoSave: () => retries++, setStateSaveOperationPending: value => locks.push(value),
    _enqueueStoredStateSave: async () => { saves++; return true; },
    _getPersistedStateEntries: () => [], setMemoSaveStatus: value => statuses.push(value)
  };
  const { persistOrganizeMemoCheckpoint } = run(['persistOrganizeMemoCheckpoint'], context);
  assert.equal(await persistOrganizeMemoCheckpoint(), false);
  assert.equal(retries, 1);
  assert.deepEqual(locks, []);
  assert.equal(saves, 0);
  context.organizeMemoComposing = false;
  assert.equal(await persistOrganizeMemoCheckpoint(), true);
  assert.deepEqual(locks, [true, false]);
  assert.deepEqual(statuses, ['saved']);
});

test('IME confirmation marked by keyCode 229 never triggers global shortcuts', () => {
  const { handleDocumentShortcuts } = run(['handleDocumentShortcuts']);
  assert.doesNotThrow(() => handleDocumentShortcuts({ key: 'Enter', keyCode: 229, isComposing: false }));
});

test('unchanged focus status does not repeatedly announce through the live region', () => {
  let writes = 0, value = '進行中';
  const status = { get textContent() { return value; }, set textContent(next) { writes++; value = next; } };
  const target = { focus: { focusState: 'running' } };
  const { syncFocusStatusChip } = run(['syncFocusStatusChip'], {
    focusStatusChip: { classList: { toggle() {}, remove() {}, add() {} } }, focusStatusIcon: {},
    focusStatusText: status, getActiveFocusTarget: () => target,
    isPomodoroEnabledForSession: () => false, focusState: {}, setMaterialIcon() {}
  });
  syncFocusStatusChip(); syncFocusStatusChip();
  assert.equal(writes, 0);
  target.focus.focusState = 'paused';
  syncFocusStatusChip(); syncFocusStatusChip();
  assert.equal(value, '一時停止中');
  assert.equal(writes, 1);
});

test('reduced motion suppresses canvas particles and stops an existing animation', () => {
  let frames = 0, clears = 0;
  const context = {
    settings: { celebration: true }, CAN_USE_CONFETTI: true,
    window: { matchMedia: () => ({ matches: true }) }, document: { hidden: false },
    confettiPieces: [{ life: 1 }], confettiAnimating: true,
    confettiCanvas: { width: 100, height: 100 }, ctx2d: { clearRect() { clears++; } },
    requestAnimationFrame() { frames++; }
  };
  const api = run(['launchConfetti', 'animateConfetti'], context);
  api.launchConfetti(0, 0, 100);
  assert.equal(context.confettiPieces.length, 1);
  api.animateConfetti();
  assert.equal(context.confettiPieces.length, 0);
  assert.equal(context.confettiAnimating, false);
  assert.equal(frames, 0);
  assert.equal(clears, 1);
});

test('task row cache changes only when displayed content changes', () => {
  const { getTaskRowRenderKey } = run(['getTaskRowRenderKey'], { hasSubtasks: task => task.subtasks.length > 0 });
  const task = { id: 'parent', text: 'Parent', done: false, focus: { focusState: 'running', elapsedMs: 10 }, subtasks: [] };
  const initial = getTaskRowRenderKey(task, []);
  task.focus.elapsedMs = 2000;
  assert.equal(getTaskRowRenderKey(task, []), initial);
  task.text = 'Changed';
  assert.notEqual(getTaskRowRenderKey(task, []), initial);
  task.done = true;
  const completed = getTaskRowRenderKey(task, []);
  task.focus.elapsedMs++;
  assert.notEqual(getTaskRowRenderKey(task, []), completed);
  task.subtasks = [{ id: 'child', text: 'Child', done: false, focus: {} }];
  assert.notEqual(getTaskRowRenderKey(task, task.subtasks), getTaskRowRenderKey(task, []));
});

for (const earlierFails of [false, true]) {
  test(`latest selected backup wins when earlier reading ${earlierFails ? 'fails' : 'finishes'} late`, async () => {
    let finishEarlier, failEarlier;
    const confirmations = [], errors = [];
    const context = {
      backupImportRequestId: 0, isStateSaveOperationPending: () => false,
      MAX_BACKUP_FILE_BYTES: 1024, backupFileInput: { value: 'selected' },
      normalizeBackupPayload: value => value,
      buildImportBackupConfirmMessage: value => value.name,
      openConfirmModal: (_, action, payload) => { confirmations.push(payload.normalized.name); return true; },
      showErrorToast: error => errors.push(error)
    };
    const { importBackupFile } = run(['importBackupFile'], context);
    const earlier = importBackupFile({ size: 1, text: () => new Promise((resolve, reject) => {
      finishEarlier = resolve; failEarlier = reject;
    }) });
    assert.equal(await importBackupFile({ size: 1, text: async () => '{"name":"latest"}' }), true);
    context.backupFileInput.value = 'next selection';
    if (earlierFails) failEarlier(new Error('stale failure'));
    else finishEarlier('{"name":"earlier"}');
    assert.equal(await earlier, false);
    assert.deepEqual(confirmations, ['latest']);
    assert.deepEqual(errors, []);
    assert.equal(context.backupFileInput.value, 'next selection');
  });
}
