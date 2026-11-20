/**
 * Webview CSS — 跟随宿主主题的现代分层令牌层
 *
 * 全部色彩从 --vscode-* 派生，深浅主题自动成立：
 *   - 侧边栏画布透出 --vscode-sideBar-background
 *   - 卡片采用 --vscode-editor-background 抬升出清晰层次（浅色下纯白浮在浅灰底上，
 *     深色下微亮面板浮在深底上），搭配细发丝描边与极轻阴影
 *   - 表单控件采用 --vscode-input-background，避免像“灰色禁用框”
 *   - 全局基础表单选择器用 :where(...) 降权重，彻底杜绝 padding 覆盖搜索框/密码框等局部样式
 */

export const styles = /* css */ `
  /* ── 设计令牌 ───────────────────────────────────────────── */
  :root {
    --cpp-ink: var(--vscode-foreground, #24282e);

    --cpp-bg: transparent;
    --cpp-canvas: var(--vscode-sideBar-background, var(--vscode-editor-background, #f3f3f3));
    --cpp-card: var(--vscode-editor-background, var(--cpp-canvas));
    --cpp-card-subtle: color-mix(in srgb, var(--cpp-ink) 3.5%, var(--cpp-card));
    --cpp-input-bg: var(--vscode-input-background, var(--cpp-card));

    --cpp-surface: color-mix(in srgb, var(--cpp-ink) 4%, transparent);
    --cpp-surface-2: color-mix(in srgb, var(--cpp-ink) 7%, transparent);
    --cpp-surface-3: color-mix(in srgb, var(--cpp-ink) 11%, transparent);
    --cpp-border: color-mix(in srgb, var(--cpp-ink) 10%, transparent);
    --cpp-border-strong: color-mix(in srgb, var(--cpp-ink) 18%, transparent);

    --cpp-text: var(--cpp-ink);
    --cpp-text-dim: color-mix(in srgb, var(--cpp-ink) 68%, transparent);
    --cpp-text-faint: color-mix(in srgb, var(--cpp-ink) 48%, transparent);

    /* 强调色直接取宿主主题按钮色 */
    --cpp-accent: var(--vscode-button-background, #0078d4);
    --cpp-accent-hover: var(--vscode-button-hoverBackground, #0066b8);
    --cpp-accent-fg: var(--vscode-button-foreground, #ffffff);
    --cpp-accent-soft: color-mix(in srgb, var(--cpp-accent) 14%, transparent);
    --cpp-accent-ring: color-mix(in srgb, var(--cpp-accent) 24%, transparent);

    /* 语义色 */
    --cpp-ok: var(--vscode-testing-iconPassed, var(--vscode-charts-green, #22863a));
    --cpp-warn: var(--vscode-editorWarning-foreground, var(--vscode-charts-orange, #b07414));
    --cpp-danger: var(--vscode-errorForeground, var(--vscode-charts-red, #c93b32));
    --cpp-ok-soft: color-mix(in srgb, var(--cpp-ok) 13%, transparent);
    --cpp-ok-border: color-mix(in srgb, var(--cpp-ok) 30%, transparent);
    --cpp-warn-soft: color-mix(in srgb, var(--cpp-warn) 13%, transparent);
    --cpp-warn-border: color-mix(in srgb, var(--cpp-warn) 32%, transparent);
    --cpp-danger-soft: color-mix(in srgb, var(--cpp-danger) 12%, transparent);
    --cpp-danger-border: color-mix(in srgb, var(--cpp-danger) 30%, transparent);

    --cpp-tip-soft: color-mix(in srgb, var(--cpp-ink) 5%, transparent);
    --cpp-tip-border: color-mix(in srgb, var(--cpp-ink) 14%, transparent);
    --cpp-on-track: var(--cpp-accent);
    --cpp-off-track: color-mix(in srgb, var(--cpp-ink) 22%, transparent);
    --cpp-knob: #ffffff;

    --cpp-radius-lg: 11px;
    --cpp-radius: 8px;
    --cpp-radius-sm: 6px;
    --cpp-radius-pill: 999px;

    /* 阴影统一用黑色低透明，避免深色主题下 ink 偏白产生白晕 */
    --cpp-shadow-card: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 1px rgba(0, 0, 0, 0.03);
    --cpp-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    --cpp-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1);

    /* 宿主悬浮件底色 */
    --cpp-editor-widget-bg: var(
      --vscode-editorWidget-background,
      var(--vscode-editor-background, #252526)
    );
    --cpp-editor-widget-border: var(
      --vscode-editorWidget-border,
      color-mix(in srgb, var(--cpp-ink) 22%, transparent)
    );
    --cpp-hover-bg: var(--vscode-editorHoverWidget-background, var(--cpp-editor-widget-bg));
    --cpp-hover-border: var(--vscode-editorHoverWidget-border, var(--cpp-editor-widget-border));
    --cpp-hover-fg: var(--vscode-editorHoverWidget-foreground, var(--cpp-text));

    /* 浮层毛玻璃 */
    --cpp-glass-bg: color-mix(in srgb, var(--cpp-editor-widget-bg) 90%, transparent);
    --cpp-glass-blur: saturate(170%) blur(16px);
    --cpp-glass-border: color-mix(in srgb, var(--cpp-ink) 16%, transparent);
    --cpp-glass-shadow: 0 10px 28px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.12);

    /* 弹窗不透明材质 */
    --cpp-modal-bg: var(--cpp-editor-widget-bg);
    --cpp-modal-border: var(--cpp-editor-widget-border);
    --cpp-modal-scrim: rgba(0, 0, 0, 0.52);
    --cpp-modal-shadow: 0 18px 44px rgba(0, 0, 0, 0.36), 0 4px 12px rgba(0, 0, 0, 0.18);

    --cpp-mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
    --cpp-font: var(--vscode-font-family, -apple-system, "Segoe UI", system-ui, sans-serif);
    --cpp-fs: 12px;
  }

  /* ── 基础 ──────────────────────────────────────────────── */
  * { box-sizing: border-box; }
  html, body { background: transparent; }
  body {
    font-family: var(--cpp-font);
    font-size: var(--cpp-fs);
    line-height: 1.45;
    color: var(--cpp-text);
    padding: 0 12px 20px;
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }
  [x-cloak] { display: none !important; }

  h3 {
    font-size: 11px;
    font-weight: 650;
    color: var(--cpp-text-dim);
    margin: 14px 0 8px;
    padding: 0;
    border: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h3 .h3-actions { display: flex; gap: 4px; align-items: center; }

  /* ── 顶部状态横幅 ─────────────────────────────────────── */
  .byok-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    margin: 0 -12px 10px;
    background: color-mix(in srgb, var(--cpp-canvas) 90%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--cpp-border);
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 25;
  }
  .byok-banner.is-active {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--cpp-ok) 8%, var(--cpp-canvas)),
      color-mix(in srgb, var(--cpp-canvas) 94%, transparent)
    );
  }
  .byok-status-wrap {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1 1 150px;
    min-width: 0;
  }
  .byok-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--cpp-text-faint);
    box-shadow: 0 0 0 3px var(--cpp-surface-2);
  }
  .byok-status-dot.is-ok {
    background: var(--cpp-ok);
    box-shadow: 0 0 0 3px var(--cpp-ok-soft);
  }
  .byok-status-dot.is-warn {
    background: var(--cpp-warn);
    box-shadow: 0 0 0 3px var(--cpp-warn-soft);
  }
  .byok-banner .byok-label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }
  .byok-banner .byok-title {
    font-weight: 650;
    font-size: 12.5px;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
  .byok-banner .byok-hint {
    font-size: 10.5px;
    color: var(--cpp-text-dim);
    margin-top: 1px;
    line-height: 1.35;
  }
  .byok-banner .banner-actions { display: flex; flex: 0 0 auto; align-items: center; }
  button.banner-toggle {
    min-height: 27px;
    padding: 4px 11px;
    border-radius: var(--cpp-radius-sm);
    font-size: 11px;
    white-space: nowrap;
  }

  /* 补丁缺失＝功能不可用，横幅按置顶告警条呈现 */
  .byok-banner.blocked {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--cpp-warn) 14%, var(--cpp-canvas)),
      color-mix(in srgb, var(--cpp-warn) 8%, var(--cpp-canvas))
    );
    border-bottom-color: var(--cpp-warn-border);
    box-shadow: inset 3px 0 0 var(--cpp-warn);
  }
  .byok-banner.blocked .byok-title { color: var(--cpp-warn); }
  .byok-banner.blocked .byok-title::before { content: '⚠ '; }
  .byok-banner.blocked .byok-hint { color: var(--cpp-text); }
  button.banner-primary {
    min-height: 28px;
    padding-inline: 13px;
    font-weight: 650;
    box-shadow: 0 2px 8px var(--cpp-warn-border);
  }

  /* ── 分段式导航栏 ─────────────────────────────────────── */
  .tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px;
    max-width: 960px;
    margin: 0 auto 12px;
    padding: 3px;
    background: var(--cpp-surface-2);
    border: 1px solid var(--cpp-border);
    border-radius: 9px;
  }
  .tab {
    background: transparent;
    color: var(--cpp-text-dim);
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  }
  .tab:hover:not(.active) {
    background: var(--cpp-surface);
    color: var(--cpp-text);
  }
  .tab.active,
  .tab.active:hover:not(:disabled) {
    background: var(--cpp-card);
    color: var(--cpp-text);
    border-color: var(--cpp-border);
    box-shadow: var(--cpp-shadow-card);
  }

  /* ── 按钮（用 :where 降低基础权重，避免 hover 覆盖页签/分段控件等定制按钮） ── */
  :where(button) {
    background: var(--cpp-accent);
    color: var(--cpp-accent-fg);
    border: 1px solid transparent;
    padding: 5px 11px;
    border-radius: var(--cpp-radius-sm);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    line-height: 1.4;
    transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
  }
  :where(button):hover:not(:disabled) { background: var(--cpp-accent-hover); }
  :where(button):disabled { opacity: 0.45; cursor: not-allowed; }
  :where(button):focus-visible { outline: 2px solid var(--cpp-accent); outline-offset: 1px; }

  button.secondary {
    background: var(--cpp-card);
    color: var(--cpp-text);
    border-color: var(--cpp-border-strong);
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.03);
  }
  button.secondary:hover:not(:disabled) {
    background: var(--cpp-card-subtle);
    border-color: color-mix(in srgb, var(--cpp-ink) 28%, transparent);
  }
  button.danger {
    background: transparent;
    color: var(--cpp-danger);
    border-color: transparent;
    padding: 4px 9px;
  }
  button.danger:hover:not(:disabled) {
    background: var(--cpp-danger-soft);
    border-color: var(--cpp-danger-border);
  }
  button.ghost {
    background: transparent;
    color: var(--cpp-text-dim);
    border-color: transparent;
    padding: 4px 8px;
    font-weight: 500;
  }
  button.ghost:hover:not(:disabled) {
    background: var(--cpp-surface-2);
    color: var(--cpp-text);
  }
  button.tiny { padding: 3px 8px; font-size: 10px; }

  /* ── 表单（用 :where 降低权重，避免覆盖搜索框/密码框等定制 padding） ── */
  :where(input:not([type=checkbox]):not([type=radio]), select, textarea) {
    width: 100%;
    background: var(--cpp-input-bg);
    color: var(--cpp-text);
    border: 1px solid var(--cpp-border-strong);
    padding: 6px 9px;
    font-size: 11.5px;
    line-height: 1.4;
    border-radius: var(--cpp-radius-sm);
    outline: none;
    font-family: var(--cpp-mono);
    resize: vertical;
    transition: border-color 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease;
  }
  :where(select) {
    font-family: var(--cpp-font);
    cursor: pointer;
  }
  :where(input:not([type=checkbox]):not([type=radio])):hover:not(:disabled):not(:focus),
  :where(select):hover:not(:disabled):not(:focus),
  :where(textarea):hover:not(:disabled):not(:focus) {
    border-color: color-mix(in srgb, var(--cpp-ink) 30%, transparent);
  }
  :where(input:not([type=checkbox]):not([type=radio])):focus,
  :where(select):focus,
  :where(textarea):focus {
    border-color: var(--cpp-accent);
    box-shadow: 0 0 0 3px var(--cpp-accent-ring);
  }
  input[type=radio], input[type=checkbox] { outline: none; accent-color: var(--cpp-accent); }
  input::placeholder, textarea::placeholder { color: var(--cpp-text-faint); font-family: var(--cpp-font); }

  /* 禁用态强调 */
  :where(input:not([type=checkbox]):not([type=radio]), select, textarea):disabled {
    opacity: 0.55;
    background: var(--cpp-surface);
    color: var(--cpp-text-faint);
    border-style: dashed;
    cursor: not-allowed;
  }
  .model-body :where(input[type=number]):disabled {
    text-decoration: line-through;
  }

  /* 移除 number input 的原生 spinner */
  input[type=number] { -moz-appearance: textfield; }
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--cpp-text-dim);
    margin: 8px 0 4px;
    text-transform: none;
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }
  .label-note {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--cpp-text-faint);
    font-size: 10px;
  }
  label:has(> .label-note) {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: nowrap;
    white-space: nowrap;
    min-width: 0;
  }
  label:has(> .label-note) > .label-note {
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hint { font-size: 10.5px; color: var(--cpp-text-faint); line-height: 1.5; margin-top: 4px; }
  .err { color: var(--cpp-danger); font-size: 10.5px; margin-top: 3px; }
  .req { color: var(--cpp-danger); font-weight: 400; }
  input.invalid, textarea.invalid { border-color: var(--cpp-danger); }

  .field { margin-bottom: 10px; }
  .field > label:first-child { margin-top: 0; }
  .field-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: start;
  }
  .field-row > * { min-width: 0; }

  /* ── 仪表盘 ───────────────────────────────────────────── */
  .dashboard-page {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dashboard-page h2 { margin: 0; font-size: 13.5px; font-weight: 650; letter-spacing: -0.01em; }
  .dashboard-page h3 { margin: 0; font-size: 12.5px; font-weight: 650; color: var(--cpp-text); letter-spacing: -0.01em; }
  .dashboard-page button.dashboard-action {
    padding: 4px 10px;
    min-height: 26px;
    font-size: 11px;
    white-space: nowrap;
  }

  .dashboard-service, .usage-scope, .usage-detail {
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
    padding: 12px 13px;
    box-shadow: var(--cpp-shadow-card);
  }
  .dashboard-service, .usage-header, .usage-scope-head, .usage-detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px 10px;
  }
  .dashboard-service { padding: 10px 12px; }
  .dashboard-service-status { display: flex; gap: 9px; align-items: center; }
  .dashboard-service-status .dot { width: 8px; height: 8px; }
  .dashboard-service-status .dot-ok { box-shadow: 0 0 0 3px var(--cpp-ok-soft); }
  .dashboard-service-status .dot-bad { box-shadow: 0 0 0 3px var(--cpp-danger-soft); }
  .dashboard-service-status h2 { font-size: 12.5px; line-height: 1.3; }
  .dashboard-service-status p { margin: 1px 0 0; color: var(--cpp-text-dim); font-size: 11px; }
  .dashboard-service-actions { display: flex; align-items: center; gap: 8px; }
  .dashboard-version {
    padding: 2px 7px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    border: 1px solid var(--cpp-border);
    color: var(--cpp-text-dim);
    font-family: var(--cpp-mono);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .usage-scope-range {
    padding: 2px 7px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-card-subtle);
    color: var(--cpp-text-dim);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .usage-period, .usage-axis { color: var(--cpp-text-faint); font-size: 10.5px; }
  .usage-axis { font-variant-numeric: tabular-nums; }

  .usage { margin-top: 2px; }
  .usage-header { margin-bottom: 8px; }
  .usage-body > .notice { margin: 0 0 10px; }
  .usage-content, .usage-scopes { display: grid; gap: 10px; }
  .usage-scopes { grid-template-columns: minmax(0, 1fr); }
  .usage-scope { min-width: 0; }

  .usage-cache { margin-top: 10px; }
  .usage-cache-main { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 3px 9px; }
  .usage-label { color: var(--cpp-text-dim); font-size: 11px; font-weight: 500; }
  .usage-value {
    margin: 0;
    color: var(--cpp-text);
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
  .usage-rate { font-size: 24px; font-weight: 750; letter-spacing: -0.03em; line-height: 1.05; }
  .usage-cache-meter {
    height: 6px;
    margin: 7px 0;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    overflow: hidden;
  }
  .usage-cache-meter > span {
    display: block;
    height: 100%;
    max-width: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--cpp-accent), color-mix(in srgb, var(--cpp-ok) 45%, var(--cpp-accent)));
    transition: width 0.25s ease;
  }
  .usage-cache-details {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2px 8px;
    color: var(--cpp-text-dim);
    font-size: 10.5px;
  }
  .usage-cache-details strong { color: var(--cpp-text); font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

  .usage-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
    border-top: none;
  }
  .usage-metrics > div {
    min-width: 0;
    padding: 7px 9px;
    background: var(--cpp-card-subtle);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
  }
  .usage-metrics dt {
    color: var(--cpp-text-faint);
    font-size: 10px;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .usage-empty {
    margin: 0;
    padding: 16px 12px;
    background: var(--cpp-card);
    border: 1px dashed var(--cpp-border-strong);
    border-radius: var(--cpp-radius-lg);
    color: var(--cpp-text-dim);
    text-align: center;
    font-size: 11px;
  }
  .usage-empty-inline { margin-top: 8px; padding: 10px; font-size: 11px; background: var(--cpp-card-subtle); }

  .usage-window {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 2px 2px 0;
    color: var(--cpp-text-dim);
    font-size: 11px;
    font-weight: 600;
  }
  .usage-window-options {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: var(--cpp-surface-2);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
  }
  .usage-window-options button {
    padding: 3px 9px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--cpp-text-dim);
    font-size: 10.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .usage-window-options button:hover:not(:disabled):not([aria-pressed='true']) {
    background: var(--cpp-surface);
    color: var(--cpp-text);
  }
  .usage-window-options button[aria-pressed='true'],
  .usage-window-options button[aria-pressed='true']:hover:not(:disabled) {
    background: var(--cpp-card);
    color: var(--cpp-text);
    border-color: var(--cpp-border);
    box-shadow: var(--cpp-shadow-card);
  }

  .usage-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 8px 0 10px; color: var(--cpp-text-dim); font-size: 10.5px; }
  .usage-legend > span { display: inline-flex; align-items: center; gap: 5px; }
  .usage-swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2.5px; }
  .usage-swatch-cached, .usage-col-cached { background: var(--cpp-accent); }
  .usage-swatch-write, .usage-col-write { background: color-mix(in srgb, var(--cpp-accent) 58%, var(--cpp-card-subtle)); }
  .usage-swatch-new, .usage-col { background: color-mix(in srgb, var(--cpp-accent) 26%, var(--cpp-surface-3)); }

  .usage-chart {
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: clamp(3px, 0.9vw, 8px);
    height: 92px;
    border-bottom: 1px solid var(--cpp-border-strong);
    background: repeating-linear-gradient(
      to top,
      transparent 0 calc(33.333% - 1px),
      var(--cpp-border) calc(33.333% - 1px) 33.333%
    );
  }
  .usage-chart button.usage-slot {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-width: 0;
    height: 100%;
    margin: 0;
    padding: 0 1px;
    background: transparent;
    border: 0;
    border-radius: 4px 4px 0 0;
  }
  .usage-chart button.usage-slot:hover, .usage-chart button.usage-slot:focus-visible { background: var(--cpp-surface); }
  .usage-chart button.usage-slot:focus-visible { outline: 2px solid var(--cpp-accent); outline-offset: -2px; }
  .usage-col {
    display: flex;
    flex-direction: column-reverse;
    width: 100%;
    max-width: 28px;
    border-radius: 4px 4px 0 0;
    overflow: hidden;
    transition: filter 0.12s ease;
  }
  .usage-chart button.usage-slot:hover .usage-col { filter: brightness(1.06); }
  .usage-col-cached, .usage-col-write { flex: 0 0 auto; }
  .usage-axis { margin-top: 6px; }
  .usage-tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: clamp(77px, var(--usage-tip-center, 50%), calc(100% - 77px));
    z-index: 30;
    width: 158px;
    padding: 8px 10px;
    border-radius: var(--cpp-radius);
    background: var(--cpp-hover-bg);
    border: 1px solid var(--cpp-hover-border);
    color: var(--cpp-hover-fg);
    box-shadow: var(--cpp-shadow-lg);
    font-size: 11px;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, 4px);
    transition: opacity 0.12s ease, transform 0.12s ease;
  }
  .usage-tip.is-open { opacity: 1; transform: translateX(-50%); }
  .usage-tip-date { font-weight: 700; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--cpp-border); }
  .usage-tip-row { display: flex; justify-content: space-between; gap: 6px; line-height: 1.5; }
  @media (prefers-reduced-motion: reduce) { .usage-tip { transition: none; } }

  .usage-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .usage-table th, .usage-table td { text-align: left; padding: 8px 0; }
  .usage-table th { color: var(--cpp-text-faint); font-size: 10.5px; font-weight: 600; padding-top: 4px; }
  .usage-table td { border-top: 1px solid var(--cpp-border); vertical-align: middle; }
  .usage-table tbody tr { transition: background-color 0.1s ease; }
  .usage-table tbody tr:hover { background: var(--cpp-card-subtle); }
  .usage-table :is(th, td):first-child { width: 100%; overflow-wrap: anywhere; padding-left: 4px; }
  .usage-table :is(th, td):last-child { padding-right: 4px; }
  .usage-table :is(th, td):not(:first-child) { padding-left: 10px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .usage-row-model { display: block; font-size: 11.5px; font-weight: 600; font-family: var(--cpp-mono); color: var(--cpp-text); }
  .usage-row-provider { display: block; font-size: 10.5px; color: var(--cpp-text-faint); margin-top: 1px; }
  .usage-row-calls { font-size: 11px; color: var(--cpp-text-dim); }
  .usage-row-input { font-size: 11.5px; font-weight: 650; }
  .usage-row-input-inline { display: none; font-size: 10.5px; color: var(--cpp-text-dim); margin-top: 2px; }
  .usage-rate-pill {
    display: inline-block;
    padding: 2px 7px;
    border-radius: var(--cpp-radius-pill);
    font-size: 10.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: var(--cpp-surface-2);
  }
  .usage-rate-pill.tone-ok { background: var(--cpp-ok-soft); color: var(--cpp-ok); }
  .usage-rate-pill.tone-warn { background: var(--cpp-warn-soft); color: var(--cpp-warn); }
  .usage-rate-pill.tone-bad { background: var(--cpp-danger-soft); color: var(--cpp-danger); }
  .usage-rate-pill.tone-flat { background: var(--cpp-surface-2); color: var(--cpp-text-dim); }
  .tone-ok { color: var(--cpp-ok); }
  .tone-warn { color: var(--cpp-warn); }
  .tone-bad { color: var(--cpp-danger); }
  .tone-flat { color: var(--cpp-text-dim); }
  @media (max-width: 470px) {
    .usage-table .usage-row-input { display: none; }
    .usage-row-input-inline { display: block; }
  }
  @media (min-width: 540px) { .usage-scopes { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  /* ── 配置页：服务列表与模型目录 ────────────────────────── */
  .config-page {
    --settings-canvas: var(--cpp-canvas);
    --settings-tray: var(--cpp-card-subtle);
    --settings-row: var(--cpp-card);
    max-width: 960px;
    margin: 0 auto;
  }
  .config-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin: 4px 0 10px;
  }
  .config-header h2, .provider-edit-toolbar h2 {
    margin: 0;
    color: var(--cpp-text);
    font-size: 13.5px;
    font-weight: 650;
    line-height: 1.35;
    letter-spacing: -0.01em;
    display: inline-flex;
    align-items: center;
  }
  .config-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .config-actions > button { min-height: 27px; }
  button.settings-primary {
    background: var(--cpp-accent);
    color: var(--cpp-accent-fg);
    border-color: transparent;
    padding-inline: 12px;
    white-space: nowrap;
  }
  button.settings-primary:hover:not(:disabled) { background: var(--cpp-accent-hover); }

  .catalog-badge, .service-count {
    padding: 1px 7px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    border: 1px solid var(--cpp-border);
    color: var(--cpp-text-dim);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
  }
  .service-count { margin-inline-start: 6px; font-variant-numeric: tabular-nums; }

  .service-list { display: flex; flex-direction: column; gap: 8px; }
  .service-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 4px;
    min-height: 58px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
    box-shadow: var(--cpp-shadow-card);
    transition: border-color 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease;
  }
  .service-row:hover, .service-row:focus-within {
    border-color: var(--cpp-border-strong);
    box-shadow: var(--cpp-shadow);
  }
  button.service-open {
    display: flex;
    align-items: center;
    text-align: left;
    gap: 10px;
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 6px 8px;
    color: var(--cpp-text);
  }
  button.service-open:hover:not(:disabled) { background: transparent; }
  .service-icon {
    display: grid;
    place-items: center;
    flex: 0 0 32px;
    height: 32px;
    background: var(--cpp-accent-soft);
    border: 1px solid color-mix(in srgb, var(--cpp-accent) 22%, transparent);
    border-radius: var(--cpp-radius);
    color: var(--cpp-accent);
    font-size: 13px;
    font-weight: 700;
  }
  .service-identity { display: grid; gap: 2px; min-width: 0; }
  .service-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .service-name strong, .service-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .service-name strong { font-size: 12.5px; font-weight: 650; }
  .service-name .catalog-badge { flex: none; }
  .service-meta { color: var(--cpp-text-dim); font-size: 11px; font-family: var(--cpp-mono); }
  .service-disabled { opacity: 0.72; }
  .service-disabled .service-open { color: var(--cpp-text-dim); }
  .service-disabled .service-icon {
    background: var(--cpp-surface-2);
    border-color: var(--cpp-border);
    color: var(--cpp-text-faint);
  }

  button.service-switch {
    position: relative;
    flex: 0 0 36px;
    min-width: 0;
    min-height: 0;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-off-track);
    transition: background-color 0.16s ease;
  }
  button.service-switch:hover:not(:disabled) { background: color-mix(in srgb, var(--cpp-ink) 30%, transparent); }
  button.service-switch[aria-checked='true'] { background: var(--cpp-on-track); }
  button.service-switch[aria-checked='true']:hover:not(:disabled) { background: var(--cpp-accent-hover); }
  button.service-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--cpp-knob);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24);
    transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  button.service-switch[aria-checked='true']::after { transform: translateX(16px); }

  .catalog-status {
    margin-top: 12px;
    padding: 9px 12px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
    color: var(--cpp-text-dim);
    font-size: 11px;
    box-shadow: var(--cpp-shadow-card);
  }
  .catalog-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px 12px; }
  .catalog-info { flex: 1 1 175px; min-width: 0; font-size: 11px; color: var(--cpp-text-dim); }
  button.catalog-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    white-space: nowrap;
    min-height: 26px;
    padding: 3px 9px;
    border: 1px solid var(--cpp-border);
    background: var(--cpp-card-subtle);
    color: var(--cpp-text);
    flex: 0 0 auto;
  }
  button.catalog-refresh:hover:not(:disabled) {
    background: var(--cpp-surface-2);
    border-color: var(--cpp-border-strong);
  }
  .catalog-refresh-icon { display: inline-block; font-size: 14px; line-height: 1; }
  .catalog-refresh-icon.is-spinning { animation: catalog-spin 1s linear infinite; }
  @keyframes catalog-spin { to { transform: rotate(360deg); } }
  .catalog-error {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    padding: 8px 10px;
    background: var(--cpp-danger-soft);
    border: 1px solid var(--cpp-danger-border);
    border-radius: var(--cpp-radius-sm);
    color: var(--cpp-danger);
    overflow-wrap: anywhere;
    font-size: 11px;
  }

  /* ── 服务商编辑器 ─────────────────────────────────────── */
  .provider-editor {
    margin-top: 4px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
    box-shadow: var(--cpp-shadow-card);
  }
  .provider-edit-toolbar {
    position: sticky;
    top: 52px;
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--cpp-card) 94%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg) var(--cpp-radius-lg) 0 0;
  }
  .provider-edit-toolbar button[aria-expanded='true'] {
    background: var(--cpp-accent-soft);
    color: var(--cpp-accent);
  }
  .provider-editor-body { padding: 14px; }
  .provider-editor > .actions-bar {
    margin: 0;
    padding: 10px 14px;
    background: var(--cpp-card-subtle);
    border-radius: 0 0 var(--cpp-radius-lg) var(--cpp-radius-lg);
  }
  .connection-title {
    margin: 0 0 10px;
    color: var(--cpp-text);
    font-size: 12px;
    font-weight: 650;
  }
  .provider-advanced, .model-item { scroll-margin-block-start: 104px; }

  .provider-connection-fields { display: grid; gap: 0 12px; }
  .provider-connection-fields > * { min-width: 0; }
  .provider-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-bottom: 8px; }
  button.provider-preset {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 9px;
    min-width: 0;
    text-align: left;
    background: var(--cpp-card-subtle);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
    color: var(--cpp-text);
  }
  button.provider-preset:hover:not(:disabled) {
    background: var(--cpp-surface-2);
    border-color: var(--cpp-accent);
  }
  .provider-preset-icon {
    flex: 0 0 26px;
    display: grid;
    place-items: center;
    height: 26px;
    border-radius: var(--cpp-radius-sm);
    background: var(--cpp-accent-soft);
    color: var(--cpp-accent);
    font-weight: 700;
    font-size: 11px;
  }
  .provider-preset-text { min-width: 0; line-height: 1.3; }
  .provider-preset-text strong { display: block; font-size: 11px; font-weight: 650; }
  .provider-preset-text small { display: block; color: var(--cpp-text-faint); font-size: 10px; overflow-wrap: anywhere; }
  .provider-advanced {
    padding: 12px;
    margin: 4px 0 12px;
    border-radius: var(--cpp-radius);
    background: var(--cpp-card-subtle);
    border: 1px solid var(--cpp-border);
  }
  .provider-advanced-fields { display: grid; gap: 0 12px; }
  .provider-advanced-fields > * { min-width: 0; }
  @media (min-width: 540px) { .provider-preset-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 560px) {
    .provider-connection-fields, .provider-advanced-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .provider-advanced-fields > :last-child { grid-column: 1 / -1; }
  }

  /* ── 模型区域（修复搜索图标重叠，清爽双层材质） ─────────── */
  .models-section { display: grid; gap: 12px; margin-top: 14px; }
  .model-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 8px;
    padding: 11px;
    background: var(--cpp-card-subtle);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
  }
  .model-pane .models-header { min-height: 26px; margin: 0; }
  .model-pane .remote-models-panel { margin: 0; }
  h3.models-title { margin: 0; font-size: 12px; font-weight: 650; color: var(--cpp-text); letter-spacing: 0; }
  .models-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .models-header-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

  .model-search { position: relative; }
  .model-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 13px;
    height: 13px;
    color: var(--cpp-text-faint);
    pointer-events: none;
  }
  .model-search input {
    min-height: 31px;
    padding: 5px 10px 5px 30px;
    font-family: var(--cpp-font);
  }

  .configured-models-list { display: flex; flex-direction: column; gap: 6px; }
  .model-item {
    position: relative;
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
    background: var(--cpp-card);
    overflow: hidden;
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
  }
  .model-item:hover { border-color: var(--cpp-border-strong); }
  .model-item.model-opened {
    border-color: color-mix(in srgb, var(--cpp-accent) 42%, var(--cpp-border));
    box-shadow: var(--cpp-shadow-card);
  }

  /* 拖动排序插入线 */
  .model-item.model-drop-top::before,
  .model-item.model-drop-bottom::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--cpp-accent);
    pointer-events: none;
    z-index: 2;
  }
  .model-item.model-drop-top::before { top: 0; }
  .model-item.model-drop-bottom::after { bottom: 0; }
  .model-item.model-dragging { opacity: 0.4; border-style: dashed; }

  .model-drag-handle {
    flex: 0 0 auto;
    width: 10px;
    height: 16px;
    margin-right: -1px;
    cursor: grab;
    background-image: radial-gradient(circle, var(--cpp-text-faint) 1px, transparent 1.25px);
    background-size: 4px 4px;
    background-position: 1px 2px;
    background-repeat: repeat;
    opacity: 0.55;
    transition: opacity 0.12s ease;
  }
  .model-item:hover .model-drag-handle { opacity: 0.9; }
  .model-drag-handle:active { cursor: grabbing; }

  .model-head { display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 3px 8px; font-size: 11.5px; }
  button.model-open {
    display: flex;
    align-items: center;
    text-align: left;
    min-width: 0;
    flex: 1;
    gap: 6px;
    padding: 4px;
    color: var(--cpp-text);
  }
  button.model-open:hover:not(:disabled) { background: transparent; }
  button.model-open:focus-visible { outline-offset: -2px; }
  .model-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 11.5px var(--cpp-mono); }
  .model-summary {
    flex: none;
    color: var(--cpp-text-dim);
    font-size: 10px;
    font-family: var(--cpp-mono);
    font-variant-numeric: tabular-nums;
  }
  .model-open-label {
    flex: none;
    padding: 2px 7px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    color: var(--cpp-text-dim);
    font-size: 10px;
    font-weight: 600;
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  button.model-open:hover .model-open-label {
    background: var(--cpp-accent-soft);
    color: var(--cpp-accent);
  }
  @media (max-width: 400px) { .model-summary { display: none; } }

  .model-remove-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin: 2px 0;
    padding: 7px 9px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
  }
  .model-remove-actions > span { margin-right: auto; color: var(--cpp-text-dim); font-size: 11px; }
  .model-head .model-remove-checkbox { flex: 0 0 auto; margin: 0; }
  .model-head .model-remove-checkbox:focus-visible { outline: 2px solid var(--cpp-accent); outline-offset: 2px; }
  .model-body {
    padding: 8px 11px 12px;
    border-top: 1px solid var(--cpp-border);
    background: var(--cpp-card-subtle);
  }
  .model-empty {
    margin: 0;
    font-size: 11px;
    color: var(--cpp-text-faint);
    text-align: center;
    padding: 10px 4px;
  }

  .custom-model-entry {
    display: grid;
    gap: 6px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--cpp-border);
  }
  .custom-model-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
  .custom-model-form button { white-space: nowrap; }
  .remote-model-count { font-size: 10px; font-family: var(--cpp-mono); color: var(--cpp-text-dim); white-space: nowrap; }

  @media (min-width: 740px) {
    .models-section { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .model-pane { min-height: 260px; }
    .configured-models-list { max-height: clamp(210px, 50vh, 460px); overflow: auto; scrollbar-width: thin; }
  }
  @media (max-width: 420px) {
    .config-header { align-items: flex-start; }
    .config-actions { width: 100%; }
    .config-actions > button { flex: 1; }
    .catalog-info { flex-basis: 150px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .catalog-refresh-icon.is-spinning { animation: none; }
  }

  .custom-protocol-fields {
    display: grid;
    gap: 4px;
    padding: 9px 10px;
    margin-top: 6px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
  }
  .custom-protocol-fields > label { margin-top: 3px; }

  /* ── 模型 defaultOn 开关 ───────────────────────────────── */
  .model-switch {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    flex: 0 0 32px;
    cursor: pointer;
    vertical-align: middle;
    opacity: 1;
    text-transform: none;
    letter-spacing: normal;
    margin: 0;
  }
  .model-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 3; }
  .model-switch-track {
    position: absolute;
    inset: 0;
    background: var(--cpp-off-track);
    border: 1px solid transparent;
    border-radius: var(--cpp-radius-pill);
    transition: background-color 0.16s ease;
    z-index: 1;
    pointer-events: none;
    box-sizing: border-box;
  }
  .model-switch-knob {
    position: absolute;
    left: 2px;
    top: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--cpp-knob);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
    transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 2;
    pointer-events: none;
  }
  .model-switch input:checked ~ .model-switch-track { background: var(--cpp-on-track); }
  .model-switch input:checked ~ .model-switch-knob { transform: translateX(14px); }
  .model-switch input:focus-visible ~ .model-switch-track { outline: 2px solid var(--cpp-accent); outline-offset: 1px; }

  /* ── 远程模型列表 ─────────────────────────────────────── */
  .remote-models-panel { min-width: 0; }
  .model-selection-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    color: var(--cpp-text-dim);
    font-size: 10.5px;
  }
  .remote-models-list { display: grid; gap: 4px; max-height: clamp(180px, 46vh, 412px); overflow: auto; scrollbar-width: thin; }
  .remote-models-list .remote-model-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 8px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
    color: var(--cpp-text);
    text-transform: none;
    letter-spacing: normal;
    cursor: pointer;
    transition: border-color 0.12s ease, background-color 0.12s ease;
  }
  .remote-model-item input { flex: 0 0 auto; margin: 0; }
  .remote-model-item:not(.already-added):is(:hover, :focus-within),
  .remote-model-item.is-selected {
    background: color-mix(in srgb, var(--cpp-accent) 10%, var(--cpp-card));
    border-color: color-mix(in srgb, var(--cpp-accent) 40%, var(--cpp-border));
  }
  .remote-model-item input:focus-visible { outline: 2px solid var(--cpp-accent); outline-offset: 2px; }
  .remote-model-item.already-added { color: var(--cpp-text-dim); opacity: 0.72; cursor: default; }
  .remote-model-label { flex: 1; min-width: 0; }
  .remote-model-name, .remote-model-id { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .remote-model-name { font-weight: 600; font-size: 11px; }
  .remote-model-id { font-family: var(--cpp-mono); font-size: 10px; color: var(--cpp-text-faint); }
  .remote-model-added {
    flex: 0 0 auto;
    padding: 1px 6px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-ok-soft);
    color: var(--cpp-ok);
    font-size: 10px;
    font-weight: 600;
  }
  .model-import-paste { padding: 6px 0 0; }
  .model-import-paste > button { margin-top: 6px; }
  .model-import-review, .model-list-recovery {
    padding: 9px 10px;
    margin: 2px 0;
    border-radius: var(--cpp-radius);
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    overflow-wrap: anywhere;
    font-size: 11px;
  }
  .model-import-review > p { margin: 0 0 6px; }
  .model-import-actions, .model-import-issues { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 9px; }
  .model-import-actions { justify-content: flex-end; }
  .remote-models-panel > .model-import-actions { padding-top: 8px; }
  .model-import-actions > span { margin-right: auto; color: var(--cpp-text-dim); font-size: 11px; }
  .model-import-issues { margin-bottom: 8px; }
  .model-import-issues button { white-space: normal; overflow-wrap: anywhere; }

  /* ── 最终请求地址预览 ─────────────────────────────────── */
  .endpoint {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-top: 6px;
    padding: 6px 9px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-sm);
  }
  .endpoint-label {
    flex: 0 0 auto;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--cpp-text-faint);
  }
  .endpoint-url {
    flex: 1;
    min-width: 0;
    font-family: var(--cpp-mono);
    font-size: 10.5px;
    color: var(--cpp-text);
    overflow-wrap: anywhere;
  }

  /* ── 提示条与徽标 ─────────────────────────────────────── */
  .notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 6px;
    padding: 8px 10px;
    font-size: 10.5px;
    line-height: 1.5;
    border-radius: var(--cpp-radius);
    background: var(--cpp-tip-soft);
    border: 1px solid var(--cpp-tip-border);
    color: var(--cpp-text);
  }
  .notice-text { flex: 1; min-width: 0; }
  .notice button { flex: 0 0 auto; }
  .notice-warn { background: var(--cpp-warn-soft); border-color: var(--cpp-warn-border); }
  .notice-bad { background: var(--cpp-danger-soft); border-color: var(--cpp-danger-border); }

  .badge {
    flex: 0 0 auto;
    background: var(--cpp-surface-2);
    color: var(--cpp-text-dim);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-pill);
    padding: 1px 7px;
    font-size: 9.5px;
    font-weight: 600;
    font-family: var(--cpp-mono);
    white-space: nowrap;
  }
  .badge:hover:not(:disabled) { background: var(--cpp-surface-3); }
  .badge-ok { background: var(--cpp-ok-soft); border-color: var(--cpp-ok-border); color: var(--cpp-ok); }
  .badge-ok:hover:not(:disabled) { background: var(--cpp-ok-soft); }
  .badge-bad { background: var(--cpp-danger-soft); border-color: var(--cpp-danger-border); color: var(--cpp-danger); }
  .badge-bad:hover:not(:disabled) { background: var(--cpp-danger-soft); }

  .model-proto-tag {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--cpp-text-dim);
    background: var(--cpp-surface-2);
    border-radius: var(--cpp-radius-pill);
    padding: 1px 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── 连通性测试 / 协议探测 ────────────────────────────── */
  .test-row { display: flex; align-items: center; gap: 8px; }
  .test-card {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: var(--cpp-radius);
    background: var(--cpp-ok-soft);
    border: 1px solid var(--cpp-ok-border);
  }
  .test-card-bad { background: var(--cpp-danger-soft); border-color: var(--cpp-danger-border); }
  .test-card-idle { background: var(--cpp-card); border-color: var(--cpp-border); }
  .test-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .test-card-summary { font-size: 11px; font-weight: 700; }
  .test-card-bad .test-card-summary { color: var(--cpp-danger); }
  .test-card:not(.test-card-bad):not(.test-card-idle) .test-card-summary { color: var(--cpp-ok); }
  .test-metrics { margin-top: 4px; font-size: 10px; font-family: var(--cpp-mono); color: var(--cpp-text-dim); }
  .test-error-kind { margin-top: 4px; font-size: 10px; font-weight: 700; color: var(--cpp-danger); }
  .test-error-msg {
    display: block;
    margin-top: 4px;
    font-family: var(--cpp-mono);
    font-size: 10px;
    color: var(--cpp-text-dim);
    overflow-wrap: anywhere;
  }
  .test-raw { margin-top: 6px; }
  .test-raw summary { font-size: 10px; color: var(--cpp-text-dim); cursor: pointer; }
  .test-raw pre {
    margin: 4px 0 0;
    padding: 6px 8px;
    max-height: 180px;
    overflow: auto;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-sm);
    font-family: var(--cpp-mono);
    font-size: 10px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--cpp-text);
  }

  .probe { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--cpp-border-strong); }
  .probe-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 5px; }
  .probe-label { font-size: 9.5px; color: var(--cpp-text-faint); line-height: 1.5; }
  .probe-buttons { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }

  /* ── 状态点 / 通用行 / 门禁空状态 ─────────────────────── */
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex: 0 0 auto; background: var(--cpp-text-faint); }
  .dot-ok { background: var(--cpp-ok); }
  .dot-warn { background: var(--cpp-warn); }
  .dot-bad { background: var(--cpp-danger); }

  .row { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; font-size: 12px; gap: 8px; }
  .gate {
    text-align: center;
    padding: 22px 16px;
    margin: 6px 0;
    background: var(--cpp-card);
    border: 1px dashed var(--cpp-border-strong);
    border-radius: var(--cpp-radius-lg);
  }
  .gate-title { font-size: 12px; font-weight: 700; }
  .gate-text { font-size: 11px; color: var(--cpp-text-dim); margin: 6px 0 12px; line-height: 1.5; }
  .gate-actions { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
  .empty {
    font-size: 11px;
    color: var(--cpp-text-faint);
    padding: 20px 12px;
    text-align: center;
    background: var(--cpp-card);
    border: 1px dashed var(--cpp-border-strong);
    border-radius: var(--cpp-radius-lg);
  }

  .service-sort { flex: 0 0 18px; display: grid; gap: 1px; }
  .sort-btn {
    background: transparent;
    border: none;
    color: var(--cpp-text-faint);
    cursor: pointer;
    padding: 0 2px;
    font-size: 8px;
    line-height: 1.6;
    min-width: 16px;
  }
  .sort-btn:hover:not(:disabled) { background: var(--cpp-surface-2); color: var(--cpp-text); }

  .actions-bar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--cpp-border);
  }

  /* ── 自定义下拉选择器 ─────────────────────────────────── */
  .custom-select { position: relative; width: 100%; }
  .custom-select-trigger {
    display: flex;
    align-items: center;
    width: 100%;
    background: var(--cpp-input-bg);
    color: var(--cpp-text);
    border: 1px solid var(--cpp-border-strong);
    padding: 6px 9px;
    font-size: 11.5px;
    border-radius: var(--cpp-radius-sm);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    font-weight: 500;
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
  }
  .custom-select-trigger:hover { border-color: color-mix(in srgb, var(--cpp-ink) 30%, transparent); background: var(--cpp-input-bg); }
  .custom-select-trigger:focus { outline: none; border-color: var(--cpp-accent); box-shadow: 0 0 0 3px var(--cpp-accent-ring); }
  .custom-select-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .custom-select-caret { opacity: 0.5; font-size: 8px; margin-left: 6px; }
  .custom-select-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--cpp-glass-bg);
    backdrop-filter: var(--cpp-glass-blur);
    border: 1px solid var(--cpp-glass-border);
    border-radius: var(--cpp-radius);
    box-shadow: var(--cpp-glass-shadow);
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
  }
  .custom-select-option {
    padding: 5px 8px;
    font-size: 11px;
    cursor: pointer;
    color: var(--cpp-text);
    border-radius: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .custom-select-option.hover,
  .custom-select-option:hover { background: var(--cpp-surface-2); }
  .custom-select-option.selected { background: var(--cpp-accent-soft); color: var(--cpp-accent); font-weight: 600; }

  /* ── 自动补全 ─────────────────────────────────────────── */
  .autocomplete { position: relative; }
  .ac-input-wrap { display: flex; align-items: stretch; }
  .ac-input-wrap input { flex: 1; border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; min-width: 0; }
  .ac-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    padding: 0;
    border: 1px solid var(--cpp-border-strong);
    border-left: none;
    border-radius: 0 var(--cpp-radius-sm) var(--cpp-radius-sm) 0;
    background: var(--cpp-input-bg);
    color: var(--cpp-text-dim);
    cursor: pointer;
    font-size: 14px;
    min-width: auto;
    line-height: 1;
  }
  .ac-toggle:hover:not(:disabled) { background: var(--cpp-surface-2); color: var(--cpp-text); }
  .ac-toggle-caret { display: inline-block; transition: transform 0.15s ease; }
  .ac-toggle-caret.open { transform: rotate(180deg); }
  .ac-loading { display: flex; align-items: center; justify-content: center; padding: 12px 0; }
  @keyframes ac-spin { to { transform: rotate(360deg); } }
  .ac-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--cpp-border-strong);
    border-top-color: var(--cpp-accent);
    border-radius: 50%;
    animation: ac-spin 0.6s linear infinite;
  }
  .autocomplete-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 20;
    background: var(--cpp-glass-bg);
    backdrop-filter: var(--cpp-glass-blur);
    border: 1px solid var(--cpp-glass-border);
    border-radius: var(--cpp-radius);
    box-shadow: var(--cpp-glass-shadow);
    max-height: 200px;
    overflow-y: auto;
    margin-top: 4px;
  }
  .autocomplete-item { padding: 6px 9px; cursor: pointer; font-size: 11px; border-bottom: 1px solid var(--cpp-border); }
  .autocomplete-item:last-child { border-bottom: none; }
  .autocomplete-item:hover, .autocomplete-item.selected { background: var(--cpp-accent-soft); }
  .autocomplete-item .ac-name { font-weight: 600; }
  .autocomplete-item .ac-id { font-family: var(--cpp-mono); font-size: 10px; color: var(--cpp-text-faint); margin-top: 1px; }
  .autocomplete-item .ac-meta { font-size: 10px; color: var(--cpp-text-faint); margin-top: 1px; }

  /* ── Quick Switch ─────────────────────────────────────── */
  .qs-section { margin-top: 8px; border: 1px solid var(--cpp-border); border-radius: var(--cpp-radius); overflow: hidden; background: var(--cpp-card); }
  .qs-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 10px;
    background: var(--cpp-card-subtle);
    border: none;
    color: var(--cpp-text);
    cursor: pointer;
    font-size: 11px;
    font-weight: 650;
    text-align: left;
    min-width: auto;
    border-radius: 0;
  }
  .qs-header:hover:not(:disabled) { background: var(--cpp-surface-2); }
  .qs-caret { font-size: 9px; color: var(--cpp-text-faint); width: 9px; }
  .qs-hint {
    margin-left: auto;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 1px solid var(--cpp-border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: var(--cpp-text-faint);
    font-weight: 400;
    cursor: help;
  }
  .qs-body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; background: var(--cpp-card); }
  .qs-item { border: 1px solid var(--cpp-border); border-radius: var(--cpp-radius-sm); overflow: hidden; background: var(--cpp-card-subtle); }
  .qs-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 9px; }
  .qs-label { font-size: 11px; font-weight: 600; }
  .qs-item-body { padding: 6px 9px 8px; border-top: 1px solid var(--cpp-border); background: var(--cpp-card); }
  .qs-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 1;
    margin: 0;
    text-transform: none;
  }
  .qs-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .qs-switch-track { width: 28px; height: 15px; border-radius: var(--cpp-radius-pill); background: var(--cpp-off-track); transition: background-color 0.16s ease; }
  .qs-switch input:checked + .qs-switch-track { background: var(--cpp-on-track); }
  .qs-switch-knob {
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--cpp-knob);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: left 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }
  .qs-switch input:checked ~ .qs-switch-knob { left: 15px; }
  .qs-group { display: flex; flex-direction: column; gap: 4px; }
  .qs-chips { display: flex; flex-wrap: wrap; gap: 4px; padding-left: 16px; }
  .qs-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    padding: 2px 8px;
    border: 1px solid var(--cpp-border-strong);
    border-radius: var(--cpp-radius-pill);
    cursor: pointer;
    user-select: none;
    background: var(--cpp-card);
  }
  .qs-chip input { width: auto; margin: 0; }
  .qs-chip:has(input:checked) { background: var(--cpp-accent-soft); border-color: var(--cpp-accent); color: var(--cpp-accent); font-weight: 600; }
  .qs-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-left: 16px; }
  .qs-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    padding: 2px 7px;
    background: var(--cpp-surface-2);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-pill);
    font-weight: 600;
  }
  .qs-tag-x { background: none; border: none; color: var(--cpp-danger); cursor: pointer; font-size: 12px; padding: 0 2px; min-width: auto; line-height: 1; }
  .qs-tag-x:hover:not(:disabled) { background: transparent; }
  .qs-tag-input {
    font-size: 10px;
    padding: 2px 7px;
    width: 100px;
    height: 22px;
    border: 1px dashed var(--cpp-border-strong);
    background: transparent;
    color: var(--cpp-text);
    border-radius: var(--cpp-radius-pill);
  }

  /* ── 能力勾选 + Thinking 子控件 ───────────────────────── */
  .check { display: flex; align-items: center; gap: 5px; font-size: 10.5px; margin: 0; white-space: nowrap; font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--cpp-text-dim); }
  .check input { width: auto; }
  .caps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px 8px;
    margin: 8px 0 6px;
    padding: 8px 0;
    border-top: 1px dashed var(--cpp-border-strong);
    border-bottom: 1px dashed var(--cpp-border-strong);
  }
  .caps .thinking-cell { grid-column: 1 / 2; }
  .caps .thinking-sub-disabled { grid-column: 2 / 4; }
  .caps .thinking-level-cell { grid-column: 2 / 4; }
  .caps .thinking-level-cell .custom-select-trigger { height: 22px; padding: 0 7px; font-size: 10.5px; }
  .caps .thinking-mode-group { grid-column: 2 / 4; display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
  .thinking-mode-tabs { display: flex; flex-shrink: 0; }
  .thinking-mode-tab {
    font-size: 9.5px;
    padding: 1px 7px;
    border: 1px solid var(--cpp-border-strong);
    background: var(--cpp-card);
    color: var(--cpp-text-dim);
    cursor: pointer;
    min-width: auto;
    height: 22px;
    border-radius: 0;
    font-weight: 600;
  }
  .thinking-mode-tab:first-child { border-radius: 5px 0 0 5px; }
  .thinking-mode-tab:last-child { border-radius: 0 5px 5px 0; border-left: none; }
  .thinking-mode-tab.active { background: var(--cpp-accent-soft); color: var(--cpp-accent); border-color: var(--cpp-accent); }
  .thinking-mode-tab.active:hover:not(:disabled) { background: var(--cpp-accent-soft); }
  .thinking-mode-value { flex: 1; min-width: 0; }
  .thinking-mode-value .custom-select-trigger { height: 22px; padding: 0 7px; font-size: 10.5px; }

  /* ── 密钥显示切换 ─────────────────────────────────────── */
  .input-reveal { position: relative; display: flex; align-items: center; }
  .input-reveal input { padding-right: 32px; }
  .reveal-btn {
    position: absolute;
    right: 3px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    padding: 4px 5px;
    cursor: pointer;
    color: var(--cpp-text-faint);
    min-width: auto;
    border-radius: 4px;
  }
  .reveal-btn:hover:not(:disabled) { background: var(--cpp-surface-2); color: var(--cpp-text); }

  /* ── 底部工具栏 ───────────────────────────────────────── */
  .footer {
    max-width: 960px;
    margin: 16px auto 0;
    padding-top: 12px;
    border-top: 1px solid var(--cpp-border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .footer-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .footer-row button { font-size: 10.5px; padding: 4px 9px; }
  .footer-advanced { flex: 1 1 130px; min-width: 0; }
  .footer-advanced > summary {
    width: fit-content;
    cursor: pointer;
    color: var(--cpp-text-dim);
    font-size: 11px;
    font-weight: 500;
    padding: 5px 2px;
    user-select: none;
  }
  .footer-advanced > summary:hover { color: var(--cpp-text); }
  .footer-advanced > summary:focus-visible { outline: 2px solid var(--cpp-accent); outline-offset: 3px; border-radius: 4px; }
  .footer-update { flex: 0 0 auto; font-size: 11px; padding: 4px 10px; }

  /* ── Toast ────────────────────────────────────────────── */
  .toast-container {
    position: fixed;
    bottom: 12px;
    left: 12px;
    right: 12px;
    z-index: 999;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    padding: 9px 12px;
    border-radius: var(--cpp-radius);
    font-size: 11px;
    line-height: 1.45;
    cursor: pointer;
    box-shadow: var(--cpp-glass-shadow);
    background: var(--cpp-glass-bg);
    backdrop-filter: var(--cpp-glass-blur);
    border: 1px solid var(--cpp-glass-border);
    border-left: 3px solid var(--cpp-accent);
    color: var(--cpp-text);
    animation: toast-in 0.18s ease-out;
  }
  .toast-error {
    border-left-color: var(--cpp-danger);
    background: linear-gradient(var(--cpp-danger-soft), var(--cpp-danger-soft)) var(--cpp-glass-bg);
  }
  .toast-warn {
    border-left-color: var(--cpp-warn);
    background: linear-gradient(var(--cpp-warn-soft), var(--cpp-warn-soft)) var(--cpp-glass-bg);
  }
  .toast-info { border-left-color: var(--cpp-accent); }
  .toast-enter { animation: toast-in 0.2s ease-out; }
  .toast-leave { animation: toast-out 0.15s ease-in; }
  @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(8px); } }

  /* ── 弹窗 ─────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--cpp-modal-scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modal-dialog {
    background: var(--cpp-modal-bg);
    border: 1px solid var(--cpp-modal-border);
    border-radius: var(--cpp-radius-lg);
    width: 100%;
    max-width: 440px;
    max-height: 85vh;
    overflow: visible;
    box-shadow: var(--cpp-modal-shadow);
    isolation: isolate;
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--cpp-border); }
  .modal-title { font-size: 13px; font-weight: 700; }
  .modal-close { background: transparent; border: none; color: var(--cpp-text-dim); font-size: 18px; cursor: pointer; min-width: auto; padding: 0 4px; line-height: 1; }
  .modal-close:hover:not(:disabled) { background: transparent; color: var(--cpp-text); }
  .modal-body { padding: 10px 14px 14px; }

  /* ── Web Tools 弹窗 ───────────────────────────────────── */
  .search-btn { font-size: 10px; padding: 4px 9px; }
  .wt-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px;
    padding: 3px;
    background: var(--cpp-surface-2);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
    margin-bottom: 10px;
  }
  .wt-tab {
    background: transparent;
    border: 1px solid transparent;
    color: var(--cpp-text-dim);
    padding: 5px 0;
    font-size: 11.5px;
    cursor: pointer;
    min-width: auto;
    border-radius: 5px;
    font-weight: 600;
  }
  .wt-tab.active,
  .wt-tab.active:hover:not(:disabled) {
    background: var(--cpp-card);
    color: var(--cpp-text);
    border-color: var(--cpp-border);
    box-shadow: var(--cpp-shadow-card);
  }
  .wt-tab:hover:not(:disabled):not(.active) { background: var(--cpp-surface); color: var(--cpp-text); }

  .search-providers { display: flex; flex-direction: column; gap: 0; }
  .search-provider-card { border-bottom: 1px solid var(--cpp-border); padding: 9px 0; }
  .search-provider-card:last-of-type { border-bottom: none; }
  .search-provider-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .search-provider-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .search-provider-name { font-size: 12px; font-weight: 600; }
  .search-provider-hint { font-size: 10.5px; color: var(--cpp-text-faint); }
  .search-provider-key { margin-top: 7px; }
  .search-provider-key input { width: 100%; font-size: 11px; padding: 6px 8px; }
  .search-provider-actions { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .search-test-btn {
    font-size: 10.5px;
    padding: 3px 9px;
    cursor: pointer;
    background: var(--cpp-card);
    color: var(--cpp-text);
    border: 1px solid var(--cpp-border-strong);
    border-radius: var(--cpp-radius-sm);
  }
  .search-test-btn:hover:not(:disabled) { background: var(--cpp-surface-2); }
  .search-test-btn:disabled { opacity: 0.5; cursor: default; }
  .search-test-result { font-size: 10.5px; line-height: 1.4; word-break: break-word; color: var(--cpp-text-dim); }
  .search-test-result.level-ok { color: var(--cpp-ok); }
  .search-test-result.level-error { color: var(--cpp-danger); }
  .search-options { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--cpp-border); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .search-max-results { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .search-max-results select { font-size: 11px; padding: 3px 5px; width: auto; }
  .search-dialog-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--cpp-border); }

  .fetch-providers { display: flex; flex-direction: column; gap: 0; }
  .fetch-provider-card { border-bottom: 1px solid var(--cpp-border); padding: 8px 0; }
  .fetch-provider-card:last-of-type { border-bottom: none; }
  .fetch-provider-row {
    display: flex !important;
    width: 100%;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    margin: 0 !important;
    text-transform: none !important;
    opacity: 1 !important;
    letter-spacing: normal !important;
    font-size: 12px !important;
    justify-content: flex-start;
    color: var(--cpp-text);
  }
  .fetch-provider-row .search-provider-name { white-space: nowrap; }
  .fetch-provider-hint { font-size: 10.5px; color: var(--cpp-text-faint); padding-left: 20px; margin-top: 2px; }
  .fetch-provider-row input[type=radio] { flex-shrink: 0; margin: 0; width: auto; background: none; border: none; padding: 0; }
  .fetch-provider-reuse { padding-left: 20px; margin-top: 6px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .fetch-provider-reuse-status { font-size: 10.5px; line-height: 1.4; word-break: break-word; color: var(--cpp-text-dim); }
  .fetch-provider-reuse-status.level-ok { color: var(--cpp-ok); }
  .fetch-provider-reuse-status.level-warn { color: var(--cpp-warn); }
  .fetch-provider-goto-search { font-size: 10.5px; padding: 3px 8px; cursor: pointer; }

  /* ── 确认弹窗 ─────────────────────────────────────────── */
  .confirm-dialog { max-width: 340px; }
  .confirm-message { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--cpp-text); overflow-wrap: anywhere; }
  .confirm-warning {
    margin: 8px 0 0;
    padding: 7px 9px;
    font-size: 10.5px;
    line-height: 1.5;
    border-radius: var(--cpp-radius-sm);
    background: var(--cpp-warn-soft);
    border: 1px solid var(--cpp-warn-border);
    color: var(--cpp-warn);
  }
  .confirm-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 14px; }
  button.danger-solid { background: var(--cpp-danger); color: #fff; border-color: transparent; }
  button.danger-solid:hover:not(:disabled) { background: var(--cpp-danger); opacity: 0.88; }
`
