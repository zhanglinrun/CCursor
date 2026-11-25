// Serialized into the workbench hook. Keep dependencies inside this function.
export function installRendererI18n(url, events) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined')
    return;

  const textExcluded = 'code, pre, kbd, samp, var, script, style, noscript, svg, textarea, input, iframe, webview, '
    + '[contenteditable="true"], [contenteditable=""], .aislash-editor-input, .monaco-editor, .monaco-diff-editor, '
    + '.view-lines, .xterm, .terminal-outer-container, .integrated-terminal, .explorer-folders-view, .monaco-breadcrumbs, '
    + '.tabs-container .tab-label, .tabs-and-actions-container .tab .label-name, .output-view, .repl-tree, .markers-panel, '
    + '[data-message-role="human"], [data-message-role="user"], [data-message-kind="human"], .composer-human-message, '
    + '.vs-markdown-container, .composer-plan-markdown-container, .rendered-markdown, .markdown-section, '
    + '.composer-code-block-anysphere, .composer-message-codeblock';
  const attrExcluded = '.monaco-editor, .monaco-diff-editor, .xterm, .terminal-outer-container, .explorer-folders-view, '
    + '[data-message-role="human"], [data-message-role="user"], [data-message-kind="human"], .composer-human-message, '
    + '.vs-markdown-container, .composer-plan-markdown-container, .rendered-markdown, '
    + '.composer-code-block-anysphere, .composer-message-codeblock, code, pre';
  const uiControls = 'button, a, label, summary, option, th, dt, h1, h2, h3, h4, h5, h6, [role="button"], [role="tab"], '
    + '[role="menuitem"], [role="option"], [role="heading"], [role="tooltip"], [role="switch"], [role="checkbox"], '
    + '[role="radio"], [role="navigation"], nav, header, footer, aside, [data-component]';
  const uiClass = /\b(?:ui-|glass-|anysphere-|monaco-button|action-label|title|header|badge|pill|sidebar|settings|statusbar|tooltip|menu|picker|tab|nav|button|btn)/i;
  const attributes = ['placeholder', 'title', 'aria-label'];
  const storageKey = '__byokI18nEnabled';
  let active;
  let request;

  function originalText(node) {
    const entry = active?.textOriginals.get(node);
    return entry && node.data === entry.translated ? entry.orig : node.data;
  }

  globalThis.__byokI18nOrigAttr = (el, attr) => {
    const raw = el.getAttribute(attr);
    const entry = active?.attrOriginals.get(el)?.get(attr);
    return entry && raw === entry.translated ? entry.orig : raw;
  };
  globalThis.__byokI18nOrigText = function readOriginalText(el) {
    if (!active)
      return el.textContent;
    const mnemonic = active.mnemonicOriginals.get(el);
    if (mnemonic && el.textContent === mnemonic.translated)
      return mnemonic.origText;
    let text = '';
    for (const child of el.childNodes)
      text += child.nodeType === 3 ? originalText(child) : readOriginalText(child) ?? '';
    return text;
  };

  function isMnemonicChild(node) {
    return node.nodeType === 1 && node.tagName?.toUpperCase() === 'MNEMONIC';
  }

  function isMnemonicContainer(el) {
    if (el?.nodeType !== 1)
      return false;
    let hasMnemonic = false;
    for (const child of el.childNodes) {
      if (isMnemonicChild(child))
        hasMnemonic = true;
      else if (child.nodeType !== 3)
        return false;
    }
    return hasMnemonic && !el.closest(textExcluded);
  }

  function isUiChrome(el) {
    if (el.closest('p') && !el.closest('button, [role="button"], dialog, [role="dialog"], [role="tooltip"]'))
      return false;
    for (let depth = 0; el && depth < 5; depth++, el = el.parentElement) {
      if (el.matches(uiControls) || uiClass.test(el.getAttribute('class') || ''))
        return true;
    }
    return false;
  }

  function activate(data, { exactMap, shortUiMap, patterns, disabledKeys }) {
    const body = document.body;
    const textOriginals = new WeakMap();
    const attrOriginals = new WeakMap();
    const mnemonicOriginals = new WeakMap();
    // Restore even detached nodes without holding them in memory while localization is enabled.
    const tracked = new Set();
    const nodeRefs = new WeakMap();
    const cleanup = new FinalizationRegistry(ref => tracked.delete(ref));
    const dirty = new Set([body]);
    const removed = new Set();
    let scan;
    let timer;
    let frame;
    let stopped = false;
    const useFrame = typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function';

    function track(node) {
      if (nodeRefs.has(node))
        return;
      const ref = new WeakRef(node);
      nodeRefs.set(node, ref);
      tracked.add(ref);
      cleanup.register(node, ref, ref);
    }

    function forget(node) {
      const ref = nodeRefs.get(node);
      if (!ref)
        return;
      tracked.delete(ref);
      cleanup.unregister(ref);
      nodeRefs.delete(node);
    }

    function translate(raw, shortAllowed) {
      if (!raw || raw.length > 400 || !/[A-Za-z]/.test(raw))
        return raw;
      const [, leading, core, trailing] = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
      const key = core.replace(/\s+/g, ' ');
      if (disabledKeys.has(key))
        return raw;
      let result = exactMap.get(key);
      if (result === undefined && shortUiMap.has(key) && shortAllowed())
        result = shortUiMap.get(key);
      if (result === undefined) {
        for (const [pattern, replacement] of patterns) {
          if (pattern.test(key)) {
            result = key.replace(pattern, replacement);
            break;
          }
        }
      }
      return result === undefined || result === key ? raw : leading + result + trailing;
    }

    function visitMnemonic(el, attached, moved) {
      const prior = mnemonicOriginals.get(el);
      const splitLabel = attached && isMnemonicContainer(el);
      if (!prior && !splitLabel)
        return;
      const raw = el.textContent;
      const unchanged = prior && raw === prior.translated;
      if (splitLabel || (unchanged && attached && !el.closest(textExcluded))) {
        if (unchanged && !moved)
          return;
        const origText = unchanged ? prior.origText : globalThis.__byokI18nOrigText(el);
        const translation = translate(origText, () => isUiChrome(el));
        if (translation !== origText) {
          const origNodes = unchanged ? prior.origNodes : Array.from(el.childNodes);
          const hotkey = unchanged ? prior.hotkey : origNodes.find(isMnemonicChild)?.textContent.trim();
          const suffix = /^[A-Za-z]$/.test(hotkey || '') ? '(' + hotkey.toUpperCase() + ')' : '';
          const translated = suffix && el.matches('.menubar-menu-title') && !translation.includes(suffix)
            ? translation + suffix
            : translation;
          mnemonicOriginals.set(el, { origNodes, origText, hotkey, translated });
          track(el);
          if (raw !== translated)
            el.textContent = translated;
          return;
        }
      }
      if (unchanged) {
        el.textContent = '';
        for (const child of prior.origNodes)
          el.appendChild(child);
      }
      mnemonicOriginals.delete(el);
    }

    function visit(node, attached, moved = false) {
      if (node.nodeType === 3) {
        const raw = node.data;
        const prior = textOriginals.get(node);
        const parent = node.parentElement;
        if (attached && parent && !parent.closest(textExcluded)
          && !mnemonicOriginals.has(parent) && !isMnemonicChild(parent) && !isMnemonicContainer(parent)) {
          const unchanged = prior && raw === prior.translated;
          if (unchanged && !moved)
            return;
          const orig = unchanged ? prior.orig : raw;
          const translated = translate(orig, () => isUiChrome(parent));
          if (translated !== orig) {
            textOriginals.set(node, { orig, translated });
            track(node);
            if (raw !== translated)
              node.data = translated;
            return;
          }
        }
        if (prior && raw === prior.translated)
          node.data = prior.orig;
        textOriginals.delete(node);
        forget(node);
        return;
      }
      if (node.nodeType !== 1)
        return;
      visitMnemonic(node, attached, moved);
      const eligible = attached && !node.closest(attrExcluded);
      let entries = attrOriginals.get(node);
      for (const attr of attributes) {
        const raw = node.getAttribute(attr);
        const prior = entries?.get(attr);
        if (eligible) {
          if (prior && raw === prior.translated)
            continue;
          const translated = translate(raw, () => true);
          if (translated !== raw) {
            if (!entries) {
              entries = new Map();
              attrOriginals.set(node, entries);
            }
            entries.set(attr, { orig: raw, translated });
            track(node);
            node.setAttribute(attr, translated);
            continue;
          }
        }
        if (prior && raw === prior.translated)
          node.setAttribute(attr, prior.orig);
        entries?.delete(attr);
      }
      if (!entries?.size) {
        attrOriginals.delete(node);
        if (!mnemonicOriginals.has(node))
          forget(node);
      }
    }

    function* walk(node, checkRemoved) {
      yield node;
      if (mnemonicOriginals.has(node) || isMnemonicContainer(node))
        return;
      if (!checkRemoved && node.nodeType === 1 && node.closest(textExcluded) && node.closest(attrExcluded))
        return;
      // Keep one sibling cursor per level so a large list can span frames.
      let child = node.firstChild;
      while (child) {
        const next = child.nextSibling;
        yield* walk(child, checkRemoved);
        child = next;
      }
    }

    function schedule() {
      if (stopped || timer !== undefined || frame !== undefined)
        return;
      timer = setTimeout(() => {
        timer = undefined;
        if (useFrame)
          frame = requestAnimationFrame(flush);
        else
          flush();
      }, 32);
    }

    function flush() {
      frame = undefined;
      const deadline = Date.now() + 8;
      do {
        if (!scan) {
          const queue = removed.size ? removed : dirty;
          const root = queue.values().next().value;
          if (!root)
            return;
          queue.delete(root);
          const moved = queue === removed;
          scan = { nodes: walk(root, moved), moved };
        }
        const step = scan.nodes.next();
        if (step.done)
          scan = undefined;
        else
          visit(step.value, body.contains(step.value), scan.moved);
      } while (Date.now() < deadline);
      schedule();
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const { target, type } = record;
        const el = target.nodeType === 3 ? target.parentElement : target;
        if (!el || el.closest(type === 'attributes' ? attrExcluded : textExcluded))
          continue;
        if (type !== 'attributes') {
          const container = isMnemonicChild(el) ? el.parentElement : el;
          const prior = mnemonicOriginals.get(container);
          if (prior || isMnemonicContainer(container)) {
            if (prior?.translated !== container.textContent)
              dirty.add(container);
            continue;
          }
        }
        if (type === 'childList') {
          for (const node of record.addedNodes)
            dirty.add(node);
          for (const node of record.removedNodes)
            removed.add(node);
        }
        else if (type === 'characterData') {
          if (textOriginals.get(target)?.translated !== target.data)
            dirty.add(target);
        }
        else if (attrOriginals.get(target)?.get(record.attributeName)?.translated !== target.getAttribute(record.attributeName)) {
          dirty.add(target);
        }
      }
      if (dirty.size || removed.size)
        schedule();
    });
    observer.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes });
    schedule();
    return {
      hash: data.hash,
      textOriginals,
      attrOriginals,
      mnemonicOriginals,
      stop() {
        stopped = true;
        observer.disconnect();
        if (timer !== undefined)
          clearTimeout(timer);
        if (frame !== undefined)
          cancelAnimationFrame(frame);
        dirty.clear();
        removed.clear();
        scan = undefined;
        for (const ref of tracked) {
          const node = ref.deref();
          if (node)
            visit(node, false);
          else
            cleanup.unregister(ref);
        }
        tracked.clear();
      },
    };
  }

  function remember(enabled) {
    try { localStorage.setItem(storageKey, enabled ? '1' : '0'); } catch {}
  }

  function cancelRequest() {
    request?.controller?.abort();
    if (request?.ready)
      document.removeEventListener('DOMContentLoaded', request.ready);
    request = undefined;
  }

  function disable() {
    cancelRequest();
    active?.stop();
    active = undefined;
    remember(false);
  }

  async function load(hash) {
    if (hash && request?.hash === hash)
      return;
    cancelRequest();
    if (hash && active?.hash === hash)
      return;
    const next = { hash, controller: typeof AbortController === 'function' ? new AbortController() : undefined };
    request = next;
    try {
      const headers = active ? { 'If-None-Match': '"' + active.hash + '"' } : undefined;
      const response = await fetch(url + '/byok/i18n', { headers, signal: next.controller?.signal });
      if (request !== next || response.status === 304 || !response.ok)
        return;
      const data = await response.json();
      if (request !== next)
        return;
      if (!data.enabled) {
        disable();
        return;
      }
      const dictionary = {
        exactMap: new Map(Object.entries(data.exact)),
        shortUiMap: new Map(Object.entries(data.shortUi)),
        patterns: data.patterns.map(({ source, flags, replacement }) => [new RegExp(source, flags), replacement]),
        disabledKeys: new Set(data.disabledKeys),
      };
      const apply = () => {
        if (request !== next || !document.body)
          return;
        active?.stop();
        active = activate(data, dictionary);
        request = undefined;
        remember(true);
      };
      if (!document.body && typeof document.addEventListener === 'function') {
        next.ready = apply;
        document.addEventListener('DOMContentLoaded', apply, { once: true });
      }
      else
        apply();
    }
    catch {}
    finally {
      if (request === next && !next.ready)
        request = undefined;
    }
  }

  events?.addEventListener('i18n', (event) => {
    try {
      const { enabled, hash } = JSON.parse(event.data);
      if (enabled === true) {
        remember(true);
        void load(hash);
      }
      else if (enabled === false)
        disable();
    } catch {}
  });
  try {
    if (localStorage.getItem(storageKey) === '1')
      void load();
  } catch {}
  return () => active !== undefined;
}
