import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildHookPayload } from '../src/patch-inject.js';
import { DEFAULT_ROUTES } from '../src/defaults.js';

class Node {
  parentElement = null;
  childNodes = [];
  get firstChild() { return this.childNodes[0]; }
  get nextSibling() {
    const siblings = this.parentElement?.childNodes;
    return siblings?.[siblings.indexOf(this) + 1];
  }

  appendChild(node) {
    const siblings = node.parentElement?.childNodes;
    if (siblings)
      siblings.splice(siblings.indexOf(node), 1);
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }

  contains(node) {
    return node === this || this.childNodes.some(child => child.contains(node));
  }
}

class Text extends Node {
  nodeType = 3;
  constructor(data) {
    super();
    this.data = data;
  }

  get textContent() { return this.data; }
}

class Element extends Node {
  nodeType = 1;
  attrs = new Map();
  dataset = {};
  style = {};
  listeners = new Map();
  clicks = 0;

  constructor(tag, attrs = {}, text) {
    super();
    this.tag = tag;
    for (const [name, value] of Object.entries(attrs))
      this.setAttribute(name, value);
    if (text !== undefined)
      this.appendChild(new Text(text));
  }

  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) {
    for (const child of this.childNodes)
      child.parentElement = null;
    this.childNodes = [];
    if (value)
      this.appendChild(new Text(value));
  }
  get tagName() { return this.tag.toUpperCase(); }
  set id(value) { this.setAttribute('id', value); }
  set className(value) { this.setAttribute('class', value); }
  get className() { return this.getAttribute('class') ?? ''; }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  setAttribute(name, value) { this.attrs.set(name, value); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { this.clicks++; this.listeners.get('click')?.({ stopPropagation() {} }); }

  matches(selector) {
    function compound(element, token) {
      const tag = token.match(/^[a-z][\w-]*/)?.[0];
      if (tag && element.tag !== tag)
        return false;
      for (const match of token.matchAll(/([.#])([\w-]+)|\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g)) {
        const [, prefix, name, attr, value] = match;
        if (prefix === '.' && !element.className.split(' ').includes(name))
          return false;
        if (prefix === '#' && element.getAttribute('id') !== name)
          return false;
        if (attr && (value === undefined ? element.getAttribute(attr) === null : element.getAttribute(attr) !== value))
          return false;
      }
      return true;
    }
    return selector.split(',').some(part => {
      const tokens = part.trim().split(/\s+/).reverse();
      if (!compound(this, tokens[0]))
        return false;
      let ancestor = this.parentElement;
      for (const token of tokens.slice(1)) {
        while (ancestor && !compound(ancestor, token))
          ancestor = ancestor.parentElement;
        if (!ancestor)
          return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector))
        return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    const result = [];
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        if (child.matches(selector))
          result.push(child);
        result.push(...child.querySelectorAll(selector));
      }
    }
    return result;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const dictionary = {
  enabled: true,
  hash: 'v1',
  exact: { 'Cursor Settings': 'Cursor 设置', 'Search models': '搜索模型', 'Refresh model list': '刷新模型列表', 'Refresh Models': '刷新模型', 'New Text File': '新建文本文件' },
  shortUi: { Plan: '规划', Debug: '调试', File: '文件', Edit: '编辑' },
  patterns: [
    { source: '^([0-9]+)\\s+days?\\s+ago$', flags: 'i', replacement: '$1 天前' },
    { source: '^Thought for\\s+([0-9]+)s$', flags: '', replacement: '已思考 $1 秒' },
  ],
};

function fixture({ initial, glass = false, animationFrame = true, fetchReply } = {}) {
  const body = new Element('body');
  const handlers = new Map();
  const events = new Map();
  const timers = new Map();
  const observers = [];
  const calls = [];
  const storage = new Map([['__byokI18nEnabled', initial]]);
  let payload = dictionary;
  let timer = 0;
  const setTimeout = (fn, delay) => {
    const id = ++timer;
    timers.set(id, { fn, delay });
    return id;
  };
  const clearTimeout = id => timers.delete(id);
  const context = vm.createContext({
    Headers, Request, Response, AbortController,
    console: { log() {}, warn() {} },
    setTimeout, clearTimeout,
    ...(animationFrame && { requestAnimationFrame: fn => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout }),
    document: {
      body,
      contains: node => body.contains(node),
      createElement: tag => new Element(tag),
      querySelector: s => body.querySelector(s),
      querySelectorAll: s => body.querySelectorAll(s),
      addEventListener: (name, listener) => handlers.set(name, listener),
      removeEventListener: name => handlers.delete(name),
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    EventSource: class { addEventListener(name, listener) { events.set(name, listener); } },
    MutationObserver: class {
      constructor(listener) {
        this.listener = listener;
        observers.push(this);
      }
      observe(root, options) { this.root = root; this.options = options; }
      disconnect() { this.disconnected = true; }
    },
    fetch: async (url, options) => {
      assert.match(url, /\/byok\/i18n$/);
      calls.push(options);
      return fetchReply ? fetchReply() : Response.json(payload);
    },
  });

  function flush() {
    for (const [id, { fn, delay }] of timers) {
      if (delay <= 32) {
        timers.delete(id);
        fn();
      }
    }
  }

  const observer = () => observers.findLast(item => item.options.attributes && !item.disconnected);
  const add = (tag, attrs, text, parent = body) => parent.appendChild(new Element(tag, attrs, text));
  const event = (enabled = true, hash = dictionary.hash) => events.get('i18n')({ data: JSON.stringify({ enabled, hash }) });
  const settle = async () => { await new Promise(setImmediate); flush(); };
  return {
    context, body, add, observers, observer, calls, storage, event, settle, flush, handlers,
    setPayload: next => { payload = next; },
    start: () => vm.runInContext(buildHookPayload(glass, glass ? 'glass' : 'desktop', DEFAULT_ROUTES), context),
  };
}

test('localizes exact, chrome-only, attribute and anchored pattern matches and restores them on disable', async () => {
  const h = fixture({ animationFrame: false });
  const heading = h.add('div', {}, ' \tCursor   Settings\n');
  const button = h.add('button', { title: 'Plan', 'aria-label': 'Debug' }, 'Plan');
  const label = h.add('label', {}, 'Debug');
  const input = h.add('input', { placeholder: 'Search models' }, 'Plan');
  input.value = 'Debug';
  const prose = h.add('p', { class: 'ui-prose' }, 'Plan');
  const dialogText = h.add('p', { class: 'ui-copy' }, 'Plan', h.add('div', { role: 'dialog' }));
  const relativeTime = h.add('span', {}, '3 DAYS AGO');
  const thoughtTime = h.add('span', {}, 'Thought for 5s');
  const partial = h.add('span', {}, 'Updated 3 days ago');
  const excluded = [
    ['div', { class: 'monaco-editor' }],
    ['div', { class: 'xterm' }],
    ['code', {}],
    ['pre', {}],
    ['div', { contenteditable: 'true' }],
    ['div', { class: 'explorer-folders-view' }],
    ['div', { 'data-message-role': 'human' }],
    ['div', { class: 'vs-markdown-container' }],
    ['div', { class: 'composer-code-block-anysphere' }],
  ].map(([tag, attrs]) => h.add('button', { title: 'Plan' }, 'Cursor Settings', h.add(tag, attrs)));
  h.start();
  h.event();
  await h.settle();

  assert.equal(heading.textContent, ' \tCursor 设置\n');
  assert.equal(button.textContent, '规划');
  assert.equal(label.textContent, '调试');
  assert.equal(button.getAttribute('title'), '规划');
  assert.equal(button.getAttribute('aria-label'), '调试');
  assert.equal(input.getAttribute('placeholder'), '搜索模型');
  assert.equal(input.value, 'Debug');
  assert.equal(input.textContent, 'Plan');
  assert.equal(prose.textContent, 'Plan');
  assert.equal(dialogText.textContent, '规划');
  assert.equal(relativeTime.textContent, '3 天前');
  assert.equal(thoughtTime.textContent, '已思考 5 秒');
  assert.equal(partial.textContent, 'Updated 3 days ago');
  for (const node of excluded) {
    assert.equal(node.textContent, 'Cursor Settings');
    // Editable regions exclude their text. Their allowlisted attributes can still be localized.
    assert.equal(node.getAttribute('title'), node.parentElement.getAttribute('contenteditable') ? '规划' : 'Plan');
  }

  const observer = h.observer();
  const unseen = h.add('button', {}, 'Plan');
  observer.listener([{ type: 'childList', target: h.body, addedNodes: [unseen], removedNodes: [] }]);
  h.event(false);
  h.flush();
  assert.ok(observer.disconnected);
  assert.equal(h.storage.get('__byokI18nEnabled'), '0');
  assert.equal(heading.textContent, ' \tCursor   Settings\n');
  assert.equal(button.textContent, 'Plan');
  assert.equal(button.getAttribute('title'), 'Plan');
  assert.equal(button.getAttribute('aria-label'), 'Debug');
  assert.equal(input.getAttribute('placeholder'), 'Search models');
  assert.equal(unseen.textContent, 'Plan');
  assert.equal(label.textContent, 'Debug');
  assert.equal(dialogText.textContent, 'Plan');
  assert.equal(relativeTime.textContent, '3 DAYS AGO');
  assert.equal(thoughtTime.textContent, 'Thought for 5s');
});

test('reconciles framework writes and replaces the dictionary when the SSE hash changes', async () => {
  const h = fixture({ initial: '1' });
  const button = h.add('button', { title: 'Plan' }, 'Plan');
  h.start();
  await h.settle();
  assert.equal(h.calls.length, 1);
  h.event();
  await h.settle();
  assert.equal(h.calls.length, 1);
  const node = button.firstChild;
  node.data = 'Debug';
  button.setAttribute('title', 'A different label');
  h.observer().listener([
    { type: 'characterData', target: node },
    { type: 'attributes', target: button, attributeName: 'title' },
  ]);
  h.flush();
  assert.equal(node.data, '调试');
  assert.equal(h.context.__byokI18nOrigAttr(button, 'title'), 'A different label');

  h.setPayload({ ...dictionary, hash: 'v2', shortUi: { Debug: '排查' } });
  h.event(true, 'v2');
  await h.settle();
  assert.equal(new Headers(h.calls[1].headers).get('if-none-match'), '"v1"');
  assert.equal(node.data, '排查');
  assert.equal(h.context.__byokI18nOrigText(button), 'Debug');
  h.event(false);
  assert.equal(node.data, 'Debug');
  assert.equal(button.getAttribute('title'), 'A different label');
});

test('translates menubar titles and dropdown labels and restores the original child nodes', async () => {
  const h = fixture();
  const menu = h.add('div', { class: 'menubar-menu-title', title: 'File' });
  h.add('mnemonic', { 'aria-hidden': 'true' }, 'F', menu);
  menu.appendChild(new Text('ile'));
  const action = h.add('span', { class: 'action-label' }, 'New ');
  h.add('mnemonic', { 'aria-hidden': 'true' }, 'T', action);
  action.appendChild(new Text('ext File'));
  const excluded = h.add('div', { class: 'monaco-editor' });
  const excludedMenu = h.add('div', { class: 'menubar-menu-title' }, undefined, excluded);
  h.add('mnemonic', {}, 'F', excludedMenu);
  excludedMenu.appendChild(new Text('ile'));
  const menuNodes = [...menu.childNodes];
  const actionNodes = [...action.childNodes];

  h.start();
  h.event();
  await h.settle();
  assert.equal(menu.textContent, '文件(F)');
  assert.equal(menu.getAttribute('title'), '文件');
  assert.equal(action.textContent, '新建文本文件');
  assert.equal(excludedMenu.textContent, 'File');
  assert.equal(h.context.__byokI18nOrigText(menu), 'File');
  assert.equal(h.context.__byokI18nOrigText(action), 'New Text File');
  h.event(false);
  assert.equal(menu.textContent, 'File');
  assert.equal(menu.getAttribute('title'), 'File');
  assert.equal(action.textContent, 'New Text File');
  assert.equal(menu.childNodes.length, menuNodes.length);
  assert.equal(action.childNodes.length, actionNodes.length);
  menuNodes.forEach((node, index) => assert.equal(menu.childNodes[index], node));
  actionNodes.forEach((node, index) => assert.equal(action.childNodes[index], node));
});

test('reconciles a framework rewrite of a localized mnemonic label', async () => {
  const h = fixture();
  const menu = h.add('div', { class: 'menubar-menu-title' });
  h.add('mnemonic', {}, 'F', menu);
  menu.appendChild(new Text('ile'));
  h.start();
  h.event();
  await h.settle();
  assert.equal(menu.textContent, '文件(F)');

  const removedNodes = [...menu.childNodes];
  menu.textContent = '';
  const mnemonic = h.add('mnemonic', {}, 'E', menu);
  const rest = menu.appendChild(new Text('dit'));
  h.observer().listener([{ type: 'childList', target: menu, addedNodes: [mnemonic, rest], removedNodes }]);
  h.flush();
  assert.equal(menu.textContent, '编辑(E)');
  h.event(false);
  assert.equal(menu.textContent, 'Edit');
  assert.equal(menu.childNodes[0], mnemonic);
  assert.equal(menu.childNodes[1], rest);
});

test('keeps a skipped dynamic label in English even when it matches a pattern', async () => {
  const h = fixture();
  const status = h.add('span', {}, '3 days ago');
  h.start();
  h.event();
  await h.settle();
  assert.equal(status.textContent, '3 天前');
  h.setPayload({ ...dictionary, hash: 'v2', disabledKeys: ['3 days ago'] });
  h.event(true, 'v2');
  await h.settle();
  assert.equal(status.textContent, '3 days ago');
});

test('ignores late fetch results after localization is disabled', async () => {
  let resolve;
  const h = fixture({ fetchReply: () => new Promise(done => { resolve = done; }) });
  const button = h.add('button', {}, 'Plan');
  h.start();
  h.event();
  h.event(false);
  resolve(Response.json(dictionary));
  await h.settle();
  assert.equal(h.observer(), undefined);
  assert.equal(button.textContent, 'Plan');
  assert.equal(h.calls[0].signal.aborted, true);
});

test('model picker and native refresh controls still work after translation', async () => {
  const h = fixture({ glass: true });
  const group = h.add('div', { class: 'ui-input-group' });
  const input = h.add('input', { placeholder: 'Search models' }, undefined, group);
  const native = h.add('button', { title: 'Refresh model list', 'aria-label': 'Plan' }, 'Refresh Models');
  const nativeTextOnly = h.add('button', {}, 'Refresh Models');
  h.start();
  h.event();
  await h.settle();
  assert.equal(native.getAttribute('title'), '刷新模型列表');
  assert.equal(native.textContent, '刷新模型');
  assert.equal(input.getAttribute('placeholder'), '搜索模型');
  assert.equal(h.context.__byokI18nOrigAttr(input, 'placeholder'), 'Search models');

  h.observers.find(item => !item.options.attributes).listener([]);
  const injected = group.querySelector('#byok-refresh-btn');
  assert.ok(injected);
  injected.click();
  assert.equal(native.clicks, 1);
  assert.equal(h.context.__byokRefreshModels(), 'click');
  assert.equal(native.clicks, 2);

  for (const node of [native, nativeTextOnly]) {
    h.context.__byokForceRefresh = false;
    h.handlers.get('click')({ target: node });
    assert.equal(h.context.__byokForceRefresh, true);
  }
});

test('boots without document, MutationObserver or EventSource in a minimal VM', () => {
  assert.doesNotThrow(() => vm.runInNewContext(buildHookPayload(false, 'desktop', DEFAULT_ROUTES)));
});
