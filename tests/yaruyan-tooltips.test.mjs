import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppSource } from './helpers/app-source.mjs';

const { run } = loadAppSource();

test('labeled buttons and non-button elements do not open a tooltip', () => {
  let reads = 0;
  const { _showQuickTooltip } = run(['_showQuickTooltip'], {
    $quickTooltip: {},
    _isIconOnlyButton: () => false,
    _extractTooltipText() {
      reads++;
    },
  });
  _showQuickTooltip({});
  assert.equal(reads, 0);
});

test('touch does not open a mouse tooltip, while keyboard focus does', () => {
  const shown = [];
  const target = { matches: () => true };
  const api = run(['handleTooltipPointerOver', 'handleTooltipFocusIn'], {
    _resolveTooltipTarget: () => target,
    _showQuickTooltip: (element) => shown.push(element),
  });
  api.handleTooltipPointerOver({ pointerType: 'touch' });
  api.handleTooltipPointerOver({ pointerType: 'pen' });
  assert.equal(shown.length, 0);
  api.handleTooltipPointerOver({ pointerType: 'mouse' });
  api.handleTooltipFocusIn({});
  assert.deepEqual(shown, [target, target]);
  target.matches = () => false;
  api.handleTooltipFocusIn({});
  assert.equal(shown.length, 2);
});

test('Escape dismisses the tooltip before the underlying dialog handles the key', () => {
  let hidden = 0,
    prevented = 0;
  const state = { anchorEl: {} };
  const { handleTooltipKeyDown } = run(['handleTooltipKeyDown'], {
    _tooltipState: state,
    _hideQuickTooltip() {
      hidden++;
      state.anchorEl = null;
    },
  });
  handleTooltipKeyDown({
    key: 'Tab',
    preventDefault() {
      prevented++;
    },
  });
  for (const state of [
    { isComposing: true },
    { keyCode: 229 },
    { defaultPrevented: true },
  ]) {
    handleTooltipKeyDown({
      key: 'Escape',
      ...state,
      preventDefault() {
        prevented++;
      },
    });
  }
  assert.equal(hidden, 0);
  assert.equal(
    prevented,
    0,
    'IME cancellation and already handled keys remain untouched',
  );
  handleTooltipKeyDown({
    key: 'Escape',
    preventDefault() {
      prevented++;
    },
  });
  handleTooltipKeyDown({
    key: 'Escape',
    preventDefault() {
      prevented++;
    },
  });
  assert.equal(hidden, 1);
  assert.equal(
    prevented,
    1,
    'a second Escape remains available to close the dialog',
  );
});

test('viewport changes hide a tooltip when its button gains a visible text label', () => {
  let hidden = 0;
  const { _positionQuickTooltip } = run(['_positionQuickTooltip'], {
    $quickTooltip: { hidden: false },
    _tooltipState: { anchorEl: {} },
    _isTooltipAnchorActive: () => true,
    _isIconOnlyButton: () => false,
    _hideQuickTooltip() {
      hidden++;
    },
  });
  _positionQuickTooltip();
  assert.equal(hidden, 1);
});
