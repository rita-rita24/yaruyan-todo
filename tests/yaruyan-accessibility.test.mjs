import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../YaruyanTodo.html', import.meta.url), 'utf8');

function extractFunctionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `function ${name} not found`);
  let parameterDepth = 0;
  let parameterEnd = html.indexOf('(', start);
  for (; parameterEnd < html.length; parameterEnd += 1) {
    if (html[parameterEnd] === '(') parameterDepth += 1;
    if (html[parameterEnd] === ')') parameterDepth -= 1;
    if (parameterDepth === 0) break;
  }
  let depth = 0;
  for (let index = html.indexOf('{', parameterEnd); index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`function ${name} end not found`);
}

class TestElement {
  constructor({ id = '', tagName = 'BUTTON', className = '', dataset = {}, parent = null } = {}) {
    this.id = id;
    this.tagName = tagName;
    this.dataset = dataset;
    this.parent = parent;
    this.ownerDocument = parent?.ownerDocument || null;
    this.children = [];
    this.isConnected = true;
    this.attributes = {};
    this.focusCount = 0;
    const classes = new Set(className.split(' ').filter(Boolean));
    this.classList = {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name)
    };
    parent?.children.push(this);
  }

  matches(selector) {
    return selector.split(',').some((part) => {
      const value = part.trim();
      if (value.startsWith('.')) return this.classList.contains(value.slice(1));
      if (value === '[contenteditable="true"]') return !!this.isContentEditable;
      if (value === '[role="button"]') return this.attributes.role === 'button';
      if (value === 'a[href]') return this.tagName === 'A' && this.hasAttribute('href');
      return this.tagName.toLowerCase() === value;
    });
  }

  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parent?.closest(selector) || null;
  }

  contains(element) {
    return element === this || this.children.some((child) => child.contains(element));
  }

  getClientRects() { return this.hidden ? [] : [{}]; }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) {
    this.toggleAttribute('disabled', value);
  }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  toggleAttribute(name, value) {
    if (value) this.attributes[name] = '';
    else delete this.attributes[name];
    const activeElement = this.ownerDocument?.activeElement;
    if (value && activeElement && (
      (name === 'disabled' && activeElement === this)
      || (name === 'inert' && this.contains(activeElement))
    )) this.ownerDocument.activeElement = this.ownerDocument.body;
  }
  focus(options) {
    this.focusCount += 1;
    this.lastFocusOptions = options;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }
}

function queryAll(selector, root) {
  return root.children.flatMap((child) => [
    ...(child.matches(selector) ? [child] : []),
    ...queryAll(selector, child)
  ]);
}

function createShortcutApi() {
  const calls = [];
  const focusOverlay = new TestElement({ tagName: 'DIV' });
  const context = {
    HTMLElement: TestElement,
    focusOverlay,
    confirmModalOverlay: {},
    subtaskModalOverlay: {},
    parentModalOverlay: {},
    _getActiveModalOverlay: () => focusOverlay,
    completeFocus: () => calls.push('complete'),
    pauseOrResumeFocus: () => calls.push('pause'),
    abortFocus: () => calls.push('abort')
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunctionSource('isTypingTarget'),
    extractFunctionSource('handleDocumentShortcuts')
  ].join('\n'), context);
  return {
    dispatch(target, key, options = {}) {
      calls.length = 0;
      let prevented = false;
      context.handleDocumentShortcuts({
        target, key, ...options,
        preventDefault() { prevented = true; }
      });
      return { prevented, calls: [...calls] };
    }
  };
}

test('focus action buttons retain native Enter and Space activation', () => {
  const api = createShortcutApi();
  for (const id of ['focusCompleteBtn', 'focusPauseBtn', 'focusAbortBtn']) {
    const button = new TestElement({ id });
    const icon = new TestElement({ tagName: 'SPAN', parent: button });
    for (const target of [button, icon]) {
      for (const key of ['Enter', ' ']) {
        assert.deepEqual(api.dispatch(target, key), { prevented: false, calls: [] }, `${id}: ${key}`);
      }
    }
  }
});

test('focus shortcuts remain available away from controls and ignore repeats or composition', () => {
  const api = createShortcutApi();
  const dialog = new TestElement({ tagName: 'DIV' });
  assert.deepEqual(api.dispatch(dialog, 'Enter'), { prevented: true, calls: ['complete'] });
  assert.deepEqual(api.dispatch(dialog, ' '), { prevented: true, calls: ['pause'] });
  assert.deepEqual(api.dispatch(dialog, 'x'), { prevented: true, calls: ['abort'] });
  assert.deepEqual(api.dispatch(dialog, 'Enter', { repeat: true }), { prevented: true, calls: [] });
  assert.deepEqual(api.dispatch(dialog, 'Enter', { isComposing: true }), { prevented: false, calls: [] });
  assert.deepEqual(api.dispatch(dialog, 'Enter', { ctrlKey: true }), { prevented: false, calls: [] });
  assert.deepEqual(api.dispatch(new TestElement({ tagName: 'TEXTAREA' }), 'x'), { prevented: false, calls: [] });
});

function createModalFocusApi() {
  const root = new TestElement({ tagName: 'DIV' });
  const document = {
    activeElement: root,
    body: root,
    getElementById: (id) => queryAll('button, input', root).find((element) => element.id === id) || null
  };
  root.ownerDocument = document;
  const taskList = new TestElement({ tagName: 'UL', parent: root });
  const modalSubtaskList = new TestElement({ tagName: 'DIV', parent: root });
  const taskInput = new TestElement({ id: 'taskInput', tagName: 'INPUT', parent: root });
  const frames = [];
  const overlayFocusCalls = [];
  const context = {
    HTMLElement: TestElement,
    taskList,
    modalSubtaskList,
    taskInput,
    document,
    appShell: root,
    stateSaveOperationState: { pendingCount: 0 },
    focusOperationState: { pending: false },
    parentModalOverlay: new TestElement({ tagName: 'DIV', parent: root }),
    subtaskModalOverlay: new TestElement({ tagName: 'DIV', parent: root }),
    confirmModalOverlay: new TestElement({ tagName: 'DIV', parent: root }),
    focusOverlay: new TestElement({ tagName: 'DIV', parent: root }),
    _modalFocusStack: [],
    qsa: queryAll,
    requestAnimationFrame: (callback) => frames.push(callback),
    _focusWithinOverlay: (overlay) => overlayFocusCalls.push(overlay)
  };
  for (const id of ['focusCompleteBtn', 'focusPauseBtn', 'focusAbortBtn']) {
    context[id] = new TestElement({ id, parent: context.focusOverlay });
  }
  vm.createContext(context);
  vm.runInContext([
    '_isFocusableElement', '_getActiveModalOverlay', '_captureModalReturnFocus',
    '_resolveModalReturnFocus', '_openModalOverlay', '_closeModalOverlay',
    '_restoreFocusAfterPending', 'isStateSaveOperationPending', 'setStateSaveOperationPending',
    'setActionControlPending', 'setFocusStartControlPending', 'setFocusOperationPending'
  ].map(extractFunctionSource).join('\n'), context);
  return {
    root, taskList, modalSubtaskList, taskInput, overlayFocusCalls,
    document,
    focusOverlay: context.focusOverlay,
    focusPauseBtn: context.focusPauseBtn,
    focusAbortBtn: context.focusAbortBtn,
    setSavePending: context.setStateSaveOperationPending,
    setFocusPending: context.setFocusOperationPending,
    addRow(id, options = {}) {
      const scope = options.scope || taskList;
      const row = new TestElement({
        tagName: 'LI', className: options.className || 'task-item',
        dataset: options.dataset || { id }, parent: scope
      });
      for (let index = 0; index < 4; index += 1) new TestElement({ parent: row });
      return row;
    },
    replaceRows(scope = taskList) {
      const detach = (element) => {
        element.isConnected = false;
        element.children.forEach(detach);
      };
      scope.children.forEach(detach);
      scope.children = [];
    },
    open(opener, overlay = new TestElement({ tagName: 'DIV', parent: root })) {
      context.document.activeElement = opener;
      context._openModalOverlay(overlay);
      frames.splice(0).forEach((callback) => callback());
      return overlay;
    },
    close(overlay) {
      context._closeModalOverlay(overlay);
      frames.splice(0).forEach((callback) => callback());
    }
  };
}

test('closing an edit modal returns to the same task action after rows are rebuilt', () => {
  const api = createModalFocusApi();
  const originalRow = api.addRow('task-a');
  const overlay = api.open(originalRow.children[2]);
  api.replaceRows();
  api.addRow('task-b');
  const updatedRow = api.addRow('task-a');
  api.close(overlay);
  assert.equal(updatedRow.children[2].focusCount, 1);
  assert.equal(api.taskInput.focusCount, 0);
});

test('closing after deletion selects the next visible task or the task input when the list is empty', () => {
  const api = createModalFocusApi();
  const firstRow = api.addRow('task-a');
  api.addRow('task-b');
  const overlay = api.open(firstRow.children[3]);
  api.replaceRows();
  const remainingRow = api.addRow('task-b');
  api.close(overlay);
  assert.equal(remainingRow.children[3].focusCount, 1);

  const lastOverlay = api.open(remainingRow.children[3]);
  api.replaceRows();
  api.close(lastOverlay);
  assert.equal(api.taskInput.focusCount, 1);
});

test('nested child editors restore rebuilt actions inside the remaining parent modal', () => {
  const api = createModalFocusApi();
  const task = api.addRow('parent-a');
  const parentOverlay = api.open(task.children[2]);
  // Move the persistent modal list inside the parent dialog for containment checks.
  api.root.children = api.root.children.filter((element) => element !== api.modalSubtaskList);
  api.modalSubtaskList.parent = parentOverlay;
  parentOverlay.children.push(api.modalSubtaskList);
  const rowOptions = {
    scope: api.modalSubtaskList,
    className: 'modal-subtask-row',
    dataset: { parentId: 'parent-a', subId: 'sub-a' }
  };
  const child = api.addRow('sub-a', rowOptions);
  const childOverlay = api.open(child.children[1]);
  api.replaceRows(api.modalSubtaskList);
  const updatedChild = api.addRow('sub-a', rowOptions);
  api.close(childOverlay);
  assert.equal(updatedChild.children[1].focusCount, 1);
  assert.equal(task.children[2].focusCount, 0);
  assert.equal(api.taskInput.focusCount, 0);
});

test('memo autosave restores textarea focus after the shared inert lock releases', () => {
  const api = createModalFocusApi();
  const memoInput = new TestElement({ tagName: 'TEXTAREA', parent: api.root });
  api.document.activeElement = memoInput;

  api.setSavePending(true);
  assert.equal(api.document.activeElement, api.document.body);
  api.setSavePending(false);

  assert.equal(api.document.activeElement, memoInput);
  assert.equal(memoInput.lastFocusOptions.preventScroll, true);
});

test('focus pause retains focus across disabled controls and the nested shared save lock', () => {
  const api = createModalFocusApi();
  api.open(api.taskInput, api.focusOverlay);
  api.document.activeElement = api.focusPauseBtn;

  api.setFocusPending(true);
  assert.equal(api.focusPauseBtn.disabled, true);
  assert.equal(api.document.activeElement, api.document.body);
  api.setSavePending(true);
  api.setSavePending(false);
  assert.equal(api.document.activeElement, api.document.body);
  api.setFocusPending(false);

  assert.equal(api.focusPauseBtn.disabled, false);
  assert.equal(api.document.activeElement, api.focusPauseBtn);
});

test('periodic focus checkpoints preserve the selected button until the last lock releases', () => {
  const api = createModalFocusApi();
  api.open(api.taskInput, api.focusOverlay);
  api.document.activeElement = api.focusAbortBtn;

  for (let checkpoint = 0; checkpoint < 3; checkpoint += 1) {
    api.setSavePending(true);
    api.setSavePending(true);
    api.setSavePending(false);
    assert.equal(api.document.activeElement, api.document.body);
    api.setSavePending(false);
    assert.equal(api.document.activeElement, api.focusAbortBtn);
  }
});

test('unlocking never steals focus from a newly chosen control', () => {
  const api = createModalFocusApi();
  api.document.activeElement = api.taskInput;
  api.setSavePending(true);
  const otherControl = new TestElement();
  api.document.activeElement = otherControl;
  api.setSavePending(false);
  assert.equal(api.document.activeElement, otherControl);
});
