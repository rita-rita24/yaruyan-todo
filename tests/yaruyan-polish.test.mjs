import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';
import vm from 'node:vm';

const { html, source, run } = loadAppSource();

test('leaving a memo recovers composition even when compositionend never arrives', () => {
  let inputs = 0, saves = 0;
  const input = {};
  const context = {
    _persistentStorageInitialized: true, organizeMemoComposing: true,
    organizeMemoInput: input, activeCompositionTarget: input,
    handleOrganizeMemoInput() { inputs++; },
    flushOrganizeMemoSave() {
      assert.equal(context.organizeMemoComposing, false);
      assert.equal(context.activeCompositionTarget, null);
      saves++;
    }
  };
  run(['handleOrganizeMemoBlur'], context).handleOrganizeMemoBlur();
  assert.equal(inputs, 1, 'Capture the final field value before saving');
  assert.equal(saves, 1);
});

test('memo blur does not clear composition belonging to a different field', () => {
  const otherInput = {};
  const context = { _persistentStorageInitialized: true, organizeMemoComposing: true,
    organizeMemoInput: {}, activeCompositionTarget: otherInput,
    handleOrganizeMemoInput() {}, flushOrganizeMemoSave() {} };
  run(['handleOrganizeMemoBlur'], context).handleOrganizeMemoBlur();
  assert.equal(context.organizeMemoComposing, false);
  assert.equal(context.activeCompositionTarget, otherInput);
});

function toastApi() {
  let handler, dismissed = 0, pending = true;
  const button = { addEventListener: (_, callback) => { handler = callback; } };
  const toast = { classList: { add() {} } };
  const context = { toastLayer: {}, toastHideTimerId: null, _toastSessionId: 0,
    _toastDismissHandler: null, _runToastDismissHandler() {},
    escapeHtml: text => text, hydrateMaterialIcons() {},
    qs: selector => selector === '.toast' ? toast : button,
    requestAnimationFrame() {}, window: { setTimeout: () => 1 }, clearTimeout() {},
    _hideToastBySession: () => dismissed++, isStateSaveOperationPending: () => pending };
  return { ...run(['showToast'], context), click: () => handler({ preventDefault() {} }),
    dismissed: () => dismissed, ready: () => { pending = false; } };
}

test('clicking backup Undo during autosave retains the action for a later retry', async () => {
  const api = toastApi();
  let actions = 0;
  api.showToast('Undo', { actionLabel: 'Undo', onAction: () => actions++ });
  await api.click();
  assert.equal(actions, 0);
  assert.equal(api.dismissed(), 0);
  api.ready();
  await api.click();
  assert.equal(actions, 1);
  assert.equal(api.dismissed(), 1);
});

test('a toast action cannot execute twice while its first action is awaiting storage', async () => {
  const api = toastApi();
  api.ready();
  let finish, actions = 0;
  api.showToast('Undo', { actionLabel: 'Undo', onAction: () => {
    actions++;
    return new Promise(resolve => { finish = resolve; });
  } });
  const first = api.click();
  const repeated = api.click();
  assert.equal(actions, 1);
  finish();
  await Promise.all([first, repeated]);
  assert.equal(api.dismissed(), 1);
});

for (const [fn, route, field] of [
  ['focusTaskInputWithRoute', 'tasks', 'taskInput'],
  ['focusMemoInputWithRoute', 'memo', 'organizeMemoInput'],
  ['focusMessageInputWithRoute', 'settings', 'messageInput']
]) {
  test(`${fn} ignores stale callbacks after navigation, modal opening, or a save lock`, () => {
    let callback, currentRoute = route, modal = null, pending = false, focus = 0;
    const context = { navigate() {}, setTimeout: fn => { callback = fn; },
      getRouteFromHash: () => currentRoute, _getActiveModalOverlay: () => modal,
      isStateSaveOperationPending: () => pending, _isFocusableElement: () => true,
      [field]: { focus: () => focus++, select() {} } };
    const api = run([fn], context);
    for (const blockedBy of ['route', 'modal', 'save', null]) {
      api[fn]();
      currentRoute = blockedBy === 'route' ? 'other' : route;
      modal = blockedBy === 'modal' ? {} : null;
      pending = blockedBy === 'save';
      callback();
      assert.equal(focus, blockedBy === null ? 1 : 0);
    }
  });
}

test('Ctrl/Meta+Enter in the child input reaches the parent save shortcut without adding a child', () => {
  const start = html.indexOf("modalSubtaskInput.addEventListener('keydown'");
  const handlerSource = html.slice(start, html.indexOf('\n      });', start) + 10);
  let handler, adds = 0, prevented = 0;
  vm.runInNewContext(handlerSource, { modalSubtaskInput: { addEventListener: (_, fn) => { handler = fn; } },
    addSubtaskFromModal: () => adds++ });
  for (const modifier of ['ctrlKey', 'metaKey']) {
    handler({ key: 'Enter', [modifier]: true, preventDefault: () => prevented++ });
  }
  assert.equal(adds, 0);
  assert.equal(prevented, 0, 'The document handler must receive the save shortcut');
  handler({ key: 'Enter', preventDefault: () => prevented++ });
  assert.equal(adds, 1, 'A plain Enter still adds one child');
});

test('moving between children of the same tooltip button does not restart its animation', () => {
  const element = {};
  let writes = 0;
  const tooltip = {
    hidden: false, textContent: '編集',
    classList: { remove() { writes++; } }, setAttribute() { writes++; }
  };
  const { _showQuickTooltip } = run(['_showQuickTooltip'], {
    $quickTooltip: tooltip, _tooltipState: { anchorEl: element, rafId: null },
    _isIconOnlyButton: () => true, _extractTooltipText: () => '編集',
    requestAnimationFrame() { writes++; }, _positionQuickTooltip() { writes++; }
  });
  _showQuickTooltip(element);
  assert.equal(writes, 0);
});
