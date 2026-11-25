export const styles = /* css */ `
  /* ── 设计令牌 ───────────────────────────────────────────── */
  :root {
    --cpp-ink: var(--vscode-foreground, #24282e);

    --cpp-canvas: var(--vscode-sideBar-background, var(--vscode-editor-background, #f3f3f3));
    --cpp-card: var(--vscode-editor-background, var(--cpp-canvas));
    --cpp-card-subtle: color-mix(in srgb, var(--cpp-ink) 3.5%, var(--cpp-card));
    --cpp-input-bg: var(--vscode-input-background, var(--cpp-card));

    --cpp-surface: color-mix(in srgb, var(--cpp-ink) 4%, transparent);
    --cpp-surface-2: color-mix(in srgb, var(--cpp-ink) 7%, transparent);
    --cpp-surface-3: color-mix(in srgb, var(--cpp-ink) 11%, transparent);
    --cpp-border: color-mix(in srgb, var(--cpp-ink) 8%, transparent);
    --cpp-border-strong: color-mix(in srgb, var(--cpp-ink) 18%, transparent);

    --cpp-text: var(--cpp-ink);
    --cpp-text-dim: color-mix(in srgb, var(--cpp-ink) 68%, transparent);
    --cpp-text-faint: color-mix(in srgb, var(--cpp-ink) 62%, transparent);

    --cpp-accent: var(--vscode-button-background, #0078d4);
    --cpp-accent-hover: var(--vscode-button-hoverBackground, #0066b8);
    --cpp-accent-fg: var(--vscode-button-foreground, #ffffff);
    --cpp-accent-soft: color-mix(in srgb, var(--cpp-accent) 14%, transparent);
    --cpp-accent-ring: color-mix(in srgb, var(--cpp-accent) 24%, transparent);
    --cpp-focus: var(--vscode-focusBorder, var(--cpp-accent));

    --cpp-ok: var(--vscode-testing-iconPassed, var(--vscode-charts-green, #22863a));
    --cpp-warn: var(--vscode-editorWarning-foreground, var(--vscode-charts-orange, #b07414));
    --cpp-danger: var(--vscode-errorForeground, var(--vscode-charts-red, #c93b32));
    --cpp-ok-soft: color-mix(in srgb, var(--cpp-ok) 13%, transparent);
    --cpp-ok-border: color-mix(in srgb, var(--cpp-ok) 30%, transparent);
    --cpp-warn-soft: color-mix(in srgb, var(--cpp-warn) 13%, transparent);
    --cpp-warn-border: color-mix(in srgb, var(--cpp-warn) 24%, transparent);
    --cpp-danger-soft: color-mix(in srgb, var(--cpp-danger) 12%, transparent);
    --cpp-danger-border: color-mix(in srgb, var(--cpp-danger) 24%, transparent);
    --cpp-tip-soft: var(--cpp-surface);
    --cpp-tip-border: var(--cpp-border);
    --cpp-on-track: var(--cpp-accent);
    --cpp-off-track: color-mix(in srgb, var(--cpp-ink) 26%, transparent);
    --cpp-knob: #ffffff;

    --cpp-radius-lg: 10px;
    --cpp-radius: 7px;
    --cpp-radius-sm: 5px;
    --cpp-radius-pill: 999px;
    --cpp-motion: 0.14s ease;
    --cpp-shadow-float: 0 6px 20px rgb(0 0 0 / 16%);
    --cpp-modal-scrim: rgb(0 0 0 / 36%);

    --cpp-editor-widget-bg: var(
      --vscode-editorWidget-background,
      var(--cpp-card)
    );
    --cpp-editor-widget-border: var(
      --vscode-editorWidget-border,
      color-mix(in srgb, var(--cpp-ink) 22%, transparent)
    );
    --cpp-hover-bg: var(--vscode-editorHoverWidget-background, var(--cpp-editor-widget-bg));
    --cpp-hover-border: var(--vscode-editorHoverWidget-border, var(--cpp-editor-widget-border));
    --cpp-hover-fg: var(--vscode-editorHoverWidget-foreground, var(--cpp-text));

    --cpp-mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace);
    --cpp-font: var(--vscode-font-family, -apple-system, "Segoe UI", system-ui, sans-serif);
    --cpp-fs: 12px;
  }

  /* ── 基础 ──────────────────────────────────────────────── */
  * { box-sizing: border-box; }
  html { background: var(--cpp-canvas); scrollbar-width: thin; }
  .panel-shell {
    font-family: var(--cpp-font);
    font-size: var(--cpp-fs);
    line-height: 1.45;
    color: var(--cpp-text);
    padding: 10px clamp(10px, 2.5vw, 16px) 18px;
    max-width: 992px;
    margin: 0 auto;
    background: var(--cpp-canvas);
    font-variant-numeric: tabular-nums;
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

  /* Routing status and navigation */
  .byok-banner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding: 7px 10px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
  }
  .byok-status-wrap, .byok-heading, .banner-actions {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .byok-heading { flex-wrap: wrap; gap: 3px 7px; }
  .byok-label { min-width: 0; }
  .byok-glyph { flex: 0 0 20px; height: 20px; color: var(--cpp-text-dim); }
  .byok-alert { color: var(--cpp-warn); align-self: start; }
  .byok-banner.is-active .byok-glyph { color: var(--cpp-ok); }
  .byok-title { font-size: 13px; font-weight: 650; line-height: 1.3; }
  .byok-pill {
    padding: 1px 6px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    color: var(--cpp-text-dim);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .035em;
    white-space: nowrap;
  }
  .byok-banner.is-active .byok-pill { color: var(--cpp-ok); background: var(--cpp-ok-soft); }
  .byok-hint { display: block; color: var(--cpp-text-dim); font-size: 11px; margin-top: 2px; }
  .byok-banner.blocked {
    background: color-mix(in srgb, var(--cpp-warn) 9%, var(--cpp-card));
    border-color: color-mix(in srgb, var(--cpp-warn) 18%, transparent);
  }
  .banner-actions > button { min-height: 27px; padding-inline: 8px; white-space: nowrap; }
  @media (max-width: 400px) {
    .byok-banner.blocked { grid-template-columns: minmax(0, 1fr); }
    .byok-banner.blocked .banner-actions { padding-inline-start: 27px; }
    .byok-heading { align-items: flex-start; }
  }

  .tabs, .usage-window-options, .wt-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px;
    padding: 2px;
    background: var(--cpp-surface-2);
    border-radius: var(--cpp-radius);
  }
  .tabs { margin-bottom: 10px; }
  :is(.tabs, .usage-window-options, .wt-tabs) > button {
    background: transparent;
    color: var(--cpp-text-dim);
    border-radius: var(--cpp-radius-sm);
    padding: 4px 8px;
    text-align: center;
    white-space: nowrap;
  }
  :is(.tabs, .usage-window-options, .wt-tabs) > button:hover:not(:disabled) {
    background: var(--cpp-surface);
    color: var(--cpp-text);
  }
  :is(.tabs, .usage-window-options, .wt-tabs) > button:is([aria-selected='true'], [aria-pressed='true']),
  :is(.tabs, .usage-window-options, .wt-tabs) > button:is([aria-selected='true'], [aria-pressed='true']):hover:not(:disabled) {
    background: var(--cpp-card);
    color: var(--cpp-text);
    border-color: var(--cpp-border);
  }

  /* ── 按钮（用 :where 降低基础权重，避免 hover 覆盖页签/分段控件等定制按钮） ── */
  :where(button) {
    background: var(--cpp-accent);
    color: var(--cpp-accent-fg);
    border: 1px solid transparent;
    padding: 5px 11px;
    border-radius: var(--cpp-radius);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    line-height: 1.4;
    transition: background-color var(--cpp-motion), border-color var(--cpp-motion), color var(--cpp-motion), box-shadow var(--cpp-motion), opacity var(--cpp-motion);
  }
  :where(button):hover:not(:disabled) { background: var(--cpp-accent-hover); }
  :where(button):disabled { opacity: 0.45; cursor: not-allowed; }
  :where(button):focus-visible { outline: 2px solid var(--cpp-focus); outline-offset: 1px; }

  button.secondary {
    background: var(--cpp-surface);
    color: var(--cpp-text);
    border-color: var(--cpp-border);
  }
  button.secondary:hover:not(:disabled) {
    background: var(--cpp-surface-2);
    border-color: var(--cpp-border-strong);
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
    border-radius: var(--cpp-radius);
    outline: none;
    font-family: var(--cpp-mono);
    resize: vertical;
    transition: border-color var(--cpp-motion), box-shadow var(--cpp-motion), background-color var(--cpp-motion);
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
    border-color: var(--cpp-focus);
    box-shadow: 0 0 0 1px var(--cpp-accent-ring);
  }
  input[type=radio], input[type=checkbox] { accent-color: var(--cpp-accent); }
  input::placeholder, textarea::placeholder { color: var(--cpp-text-faint); font-family: var(--cpp-font); }

  /* 禁用态强调 */
  :where(input:not([type=checkbox]):not([type=radio]), select, textarea):disabled {
    opacity: 0.55;
    background: var(--cpp-surface);
    color: var(--cpp-text-faint);
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

  /* Dashboard */
  .dashboard-page { display: grid; gap: 8px; }
  .dashboard-page :is(h2, h3) {
    margin: 0;
    color: var(--cpp-text);
    font-size: 13px;
    font-weight: 650;
    line-height: 1.3;
  }
  .dashboard-page button.dashboard-action { white-space: nowrap; min-height: 25px; padding: 3px 8px; }
  .dashboard-service, .usage-scope, .usage-analytics {
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
  }
  .dashboard-service {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1px 6px;
    padding: 7px 8px;
  }
  .dashboard-service-status { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .dashboard-service-status .dot { width: 7px; height: 7px; }
  .dashboard-service h2 { font-size: 12px; }
  .dashboard-service-caption { grid-area: 2 / 1; margin: 0 0 0 11px; color: var(--cpp-text-dim); font-size: 10.5px; white-space: nowrap; }
  .dashboard-service-actions { grid-area: 1 / 2 / span 2; display: flex; align-items: center; gap: 4px; }
  .dashboard-service button.dashboard-action { padding-inline: 6px; }
  .dashboard-service.localization-card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .localization-header, .localization-caption, .localization-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .localization-header .service-switch { margin-inline-start: auto; flex-shrink: 0; }
  .localization-status {
    padding: 1px 6px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    color: var(--cpp-text-dim);
    font-size: 10px;
    white-space: nowrap;
  }
  .localization-status.is-available { color: var(--cpp-ok); background: var(--cpp-ok-soft); }
  .localization-status.is-outdated { color: var(--cpp-warn); background: var(--cpp-warn-soft); }
  .localization-caption p { margin: 0; min-width: 0; color: var(--cpp-text-dim); font-size: 10.5px; }
  .localization-caption button { flex-shrink: 0; white-space: nowrap; }
  .localization-actions { flex-wrap: wrap; }
  .dashboard-port, .usage-scope-range {
    padding: 1px 5px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface);
    color: var(--cpp-text-dim);
    font-size: 10px;
    line-height: 1.4;
    white-space: nowrap;
  }
  .dashboard-port { font-family: var(--cpp-mono); }

  .usage-header, .usage-scope-head, .usage-detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .usage-header { margin-bottom: 6px; }
  .usage-body > .notice { margin: 0 0 8px; }
  .usage-content, .usage-scopes { display: grid; gap: 7px; }
  .usage-scopes { grid-template-columns: minmax(0, 1fr); }
  .usage-scope { min-width: 0; padding: 7px 9px 6px; }
  .usage-scope-title { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .usage-scope-title h3 { flex: 0 0 auto; }
  .usage-scope-range { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .usage-scope-range:empty { display: none; }
  .usage-cache-main { display: flex; align-items: baseline; flex-shrink: 0; gap: 4px; }
  .usage-label, .usage-period, .usage-axis { color: var(--cpp-text-dim); font-size: 10px; }
  .usage-value { margin: 0; min-width: 0; font-weight: 650; font-size: 14px; line-height: 1.2; }
  .usage-rate { font-size: 17px; letter-spacing: -.035em; }
  .usage-cache { margin: 5px 0; }
  .usage-cache-meter { height: 5px; overflow: hidden; border-radius: var(--cpp-radius-pill); background: var(--cpp-surface-2); }
  .usage-cache-meter > span {
    display: block;
    height: 100%;
    background: var(--cpp-ok);
    border-radius: inherit;
    transition: width var(--cpp-motion);
  }
  .usage-cache-details { display: flex; align-items: baseline; gap: 4px; margin-top: 3px; color: var(--cpp-text-dim); font-size: 10px; white-space: nowrap; }
  .usage-cache-details strong { color: var(--cpp-text); font-weight: 600; }
  .usage-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding-top: 5px; border-top: 1px solid var(--cpp-border); }
  .usage-metrics > div { min-width: 0; padding-inline: 7px 3px; }
  .usage-metrics > div:first-child { padding-inline-start: 0; }
  .usage-metrics > div + div { border-left: 1px solid var(--cpp-border); }
  .usage-metrics dt { margin-bottom: 1px; color: var(--cpp-text-dim); font-size: 10px; }
  .usage-empty { margin: 0; padding: 10px; border-radius: var(--cpp-radius); background: var(--cpp-surface); color: var(--cpp-text-dim); font-size: 11px; }
  .usage-empty-inline { margin-top: 6px; padding: 6px 0 0; background: transparent; }
  .usage-analytics { padding: 0 10px; }
  .usage-detail { min-width: 0; padding: 9px 0; }
  .usage-detail + .usage-detail { border-top: 1px solid var(--cpp-border); }
  .usage-window-options > button { padding: 3px 6px; font-size: 10px; }

  .usage-chart-footer { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 3px 10px; margin-top: 6px; }
  .usage-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--cpp-text-dim); font-size: 10px; }
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
    height: clamp(78px, 19vw, 128px);
    margin-top: 8px;
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
  .usage-chart button.usage-slot:focus-visible { outline: 2px solid var(--cpp-focus); outline-offset: -2px; }
  .usage-col {
    display: flex;
    flex-direction: column-reverse;
    width: 100%;
    max-width: 36px;
    border-radius: var(--cpp-radius-sm) var(--cpp-radius-sm) 0 0;
    overflow: hidden;
    transition: height var(--cpp-motion), filter var(--cpp-motion);
  }
  .usage-chart button.usage-slot:hover .usage-col { filter: brightness(1.06); }
  .usage-col-cached, .usage-col-write { flex: 0 0 auto; }
  .usage-tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: clamp(79px, var(--usage-tip-center, 50%), calc(100% - 79px));
    z-index: 30;
    width: 158px;
    padding: 8px 10px;
    border-radius: var(--cpp-radius);
    background: var(--cpp-hover-bg);
    border: 1px solid var(--cpp-hover-border);
    color: var(--cpp-hover-fg);
    box-shadow: var(--cpp-shadow-float);
    font-size: 11px;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, 4px);
    transition: opacity var(--cpp-motion), transform var(--cpp-motion);
  }
  .usage-tip.is-open { opacity: 1; transform: translateX(-50%); }
  .usage-tip-date { font-weight: 700; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--cpp-border); }
  .usage-tip-row { display: flex; justify-content: space-between; gap: 6px; line-height: 1.5; }
  @media (prefers-reduced-motion: reduce) { .usage-tip { transition: none; } }

  .usage-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 6px; }
  .usage-table th, .usage-table td { text-align: left; padding: 8px 0; }
  .usage-table th { color: var(--cpp-text-faint); font-size: 10.5px; font-weight: 600; padding-top: 4px; }
  .usage-table td { border-top: 1px solid var(--cpp-border); vertical-align: middle; }
  .usage-table tbody tr { transition: background-color 0.1s ease; }
  .usage-table tbody tr:hover { background: var(--cpp-card-subtle); }
  .usage-table th:not(:first-child) { width: 17%; }
  .usage-table :is(th, td):first-child { padding-left: 4px; }
  .usage-table :is(th, td):last-child { padding-right: 4px; }
  .usage-table :is(th, td):not(:first-child) { padding-left: 10px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .usage-row-model, .usage-row-provider { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    .usage-table th:not(:first-child) { width: 57px; }
    .usage-table th:last-child { width: 46px; }
    .usage-table .usage-row-input { display: none; }
    .usage-row-input-inline { display: block; }
  }
  @media (min-width: 540px) {
    .usage-scopes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dashboard-service { display: flex; gap: 10px; }
    .dashboard-service-caption { margin: 0; }
    .dashboard-service-actions { margin-inline-start: auto; }
  }

  /* ── 配置页：服务列表与模型目录 ────────────────────────── */
  .config-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px 8px;
    margin: 0 0 10px;
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
  .config-actions button { min-height: 27px; white-space: nowrap; }
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
    color: var(--cpp-text-dim);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
  }
  .service-count { margin-inline-start: 6px; font-variant-numeric: tabular-nums; }

  .service-list { display: grid; gap: 6px; }
  .service-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px 3px 3px;
    min-height: 48px;
    background: var(--cpp-card);
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius-lg);
    transition: background-color var(--cpp-motion), border-color var(--cpp-motion);
  }
  .service-row:hover, .service-row:focus-within {
    background: var(--cpp-card-subtle);
    border-color: var(--cpp-border-strong);
  }
  button.service-open {
    display: flex;
    align-items: center;
    text-align: left;
    gap: 8px;
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 4px 5px;
    color: var(--cpp-text);
  }
  button.service-open:hover:not(:disabled) { background: transparent; }
  .service-icon {
    display: grid;
    place-items: center;
    flex: 0 0 28px;
    height: 28px;
    background: var(--cpp-accent-soft);
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
  .service-meta { color: var(--cpp-text-dim); font-size: 10.5px; }
  .service-disabled { background: var(--cpp-surface); }
  .service-disabled .service-open { color: var(--cpp-text-dim); }
  .service-disabled .service-icon {
    background: var(--cpp-surface-2);
    color: var(--cpp-text-dim);
  }

  button.service-switch {
    position: relative;
    flex: 0 0 30px;
    min-width: 0;
    min-height: 0;
    height: 17px;
    padding: 0;
    border: 0;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-off-track);
    transition: background-color var(--cpp-motion);
  }
  button.service-switch:hover:not(:disabled) { background: color-mix(in srgb, var(--cpp-ink) 30%, transparent); }
  button.service-switch[aria-checked='true'] { background: var(--cpp-on-track); }
  button.service-switch[aria-checked='true']:hover:not(:disabled) { background: var(--cpp-accent-hover); }
  button.service-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--cpp-knob);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24);
    transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  button.service-switch[aria-checked='true']::after { background: var(--cpp-accent-fg); transform: translateX(13px); }

  .catalog-status {
    margin-top: 10px;
    padding: 8px 0 0;
    border-top: 1px solid var(--cpp-border);
    color: var(--cpp-text-dim);
    font-size: 11px;
  }
  .catalog-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 6px 8px; }
  .catalog-info { min-width: 0; font-size: 10.5px; }
  button.catalog-refresh { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; min-height: 26px; }
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
  .provider-edit-toolbar {
    position: sticky;
    top: 0;
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 5px 10px;
    margin-bottom: 8px;
    padding: 4px 0 8px;
    background: var(--cpp-canvas);
    border-bottom: 1px solid var(--cpp-border);
  }
  .provider-edit-toolbar .config-actions { justify-content: space-between; }
  .provider-toolbar-group { display: flex; gap: 3px; }
  .provider-edit-toolbar button[aria-expanded='true'] {
    background: var(--cpp-accent-soft);
    color: var(--cpp-accent);
  }
  .provider-editor-body { display: grid; gap: 10px; }
  .provider-connection { min-width: 0; padding: 10px 11px 2px; background: var(--cpp-card); border: 1px solid var(--cpp-border); border-radius: var(--cpp-radius-lg); }
  .provider-connection input:not(.provider-address):not([type=password]) { font-family: var(--cpp-font); }
  .provider-editor > .actions-bar { margin: 10px 0 0; }
  .connection-title {
    margin: 0 0 10px;
    color: var(--cpp-text);
    font-size: 12px;
    font-weight: 650;
  }
  .provider-advanced, .model-item { scroll-margin-block-start: 88px; }

  .provider-connection-fields { display: grid; gap: 0 12px; }
  .provider-connection-fields > * { min-width: 0; }
  .provider-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-bottom: 8px; }
  button.provider-preset {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    min-width: 0;
    text-align: left;
    background: var(--cpp-surface);
    border: 1px solid transparent;
    border-radius: var(--cpp-radius);
    color: var(--cpp-text);
  }
  button.provider-preset:hover:not(:disabled) {
    background: var(--cpp-surface-2);
    border-color: var(--cpp-border);
  }
  .provider-preset-icon {
    flex: 0 0 22px;
    display: grid;
    place-items: center;
    height: 22px;
    border-radius: var(--cpp-radius-sm);
    background: var(--cpp-accent-soft);
    color: var(--cpp-accent);
    font-weight: 700;
    font-size: 11px;
  }
  .provider-preset-text { min-width: 0; line-height: 1.3; }
  .provider-preset-text strong { display: block; font-size: 11px; font-weight: 650; }
  .provider-preset-text small { display: block; color: var(--cpp-text-dim); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .provider-advanced {
    margin: 2px 0 4px;
    padding-top: 10px;
    border-top: 1px solid var(--cpp-border);
  }
  .provider-advanced-fields { display: grid; gap: 0 12px; }
  .provider-advanced-fields > * { min-width: 0; }
  @media (min-width: 540px) {
    .provider-preset-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .provider-connection-fields, .provider-advanced-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .provider-advanced-fields > :last-child { grid-column: 1 / -1; }
  }

  /* ── 模型区域（修复搜索图标重叠，清爽双层材质） ─────────── */
  .models-section { display: grid; gap: 10px; }
  .model-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 7px;
    padding: 10px 11px;
    background: var(--cpp-card);
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
    min-height: 30px;
    padding: 5px 10px 5px 31px;
    font-family: var(--cpp-font);
  }

  .configured-models-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; min-width: 0; }
  .model-item {
    position: relative;
    border: 1px solid var(--cpp-border);
    border-radius: var(--cpp-radius);
    background: var(--cpp-surface);
    transition: border-color var(--cpp-motion), background-color var(--cpp-motion);
  }
  .model-item:is(:hover, :focus-within) { border-color: var(--cpp-border-strong); }
  .model-item.model-opened { background: var(--cpp-card); border-color: var(--cpp-border-strong); }

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
    transition: opacity var(--cpp-motion);
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
  .model-chevron, .sort-btn::before {
    width: 6px;
    height: 6px;
    border: solid currentColor;
    border-width: 0 1.25px 1.25px 0;
    transform: rotate(-45deg);
  }
  .model-chevron { flex: 0 0 auto; color: var(--cpp-text-dim); transition: transform var(--cpp-motion); }
  button.model-open[aria-expanded='true'] .model-chevron { transform: translateY(-1px) rotate(45deg); }
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
  .model-head .model-remove-checkbox:focus-visible { outline: 2px solid var(--cpp-focus); outline-offset: 2px; }
  .model-body {
    padding: 9px 8px 8px;
    border-top: 1px solid var(--cpp-border);
  }
  .model-empty {
    margin: 0;
    font-size: 11px;
    color: var(--cpp-text-faint);
    padding: 2px 0 5px;
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

  @media (min-width: 760px) {
    .models-section { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  }
  @media (max-width: 420px) {
    .provider-edit-toolbar > .config-actions { flex: 1 0 100%; }
    .provider-edit-toolbar .config-actions button { padding-inline: 6px; }
  }
  @media (min-width: 650px) { .service-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (prefers-reduced-motion: reduce) {
    .catalog-refresh-icon.is-spinning { animation: none; }
  }

  .custom-protocol-fields {
    display: grid;
    gap: 4px;
    padding: 4px 0 0;
    margin-top: 6px;
    border-top: 1px solid var(--cpp-border);
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
    transition: background-color var(--cpp-motion);
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
  .model-switch input:checked ~ .model-switch-knob { background: var(--cpp-accent-fg); transform: translateX(14px); }
  .model-switch input:focus-visible ~ .model-switch-track { outline: 2px solid var(--cpp-focus); outline-offset: 1px; }

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
  .remote-models-list { display: grid; gap: 2px; max-height: clamp(180px, 46vh, 412px); overflow: auto; scrollbar-width: thin; }
  .remote-models-list .remote-model-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 8px;
    background: var(--cpp-surface);
    border: 1px solid transparent;
    border-radius: var(--cpp-radius-sm);
    color: var(--cpp-text);
    text-transform: none;
    letter-spacing: normal;
    cursor: pointer;
    transition: border-color var(--cpp-motion), background-color var(--cpp-motion);
  }
  .remote-model-item input { flex: 0 0 auto; margin: 0; }
  .remote-model-item:not(.already-added):is(:hover, :focus-within),
  .remote-model-item.is-selected {
    background: color-mix(in srgb, var(--cpp-accent) 10%, var(--cpp-card));
    border-color: color-mix(in srgb, var(--cpp-accent) 40%, var(--cpp-border));
  }
  .remote-model-item input:focus-visible { outline: 2px solid var(--cpp-focus); outline-offset: 2px; }
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
    padding: 6px 7px;
    background: var(--cpp-surface);
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
    border: 1px solid transparent;
    border-radius: var(--cpp-radius-pill);
    padding: 1px 6px;
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
  }
  .test-card-bad { background: var(--cpp-danger-soft); }
  .test-card-idle { background: var(--cpp-surface); }
  .test-card-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 3px 8px; }
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

  .probe { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--cpp-border); }
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

  .service-sort { flex: 0 0 17px; display: grid; gap: 1px; }
  button.sort-btn {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--cpp-text-dim);
  }
  .sort-btn::before { content: ''; }
  .sort-up::before { transform: translateY(1px) rotate(225deg); }
  .sort-down::before { transform: translateY(-1px) rotate(45deg); }
  button.sort-btn:hover:not(:disabled) { background: var(--cpp-surface-2); color: var(--cpp-text); }
  @media (hover: hover) {
    .service-sort { opacity: .35; transition: opacity var(--cpp-motion); }
    .service-row:is(:hover, :focus-within) .service-sort { opacity: 1; }
  }

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
    transition: border-color var(--cpp-motion), box-shadow var(--cpp-motion);
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
    background: var(--cpp-editor-widget-bg);
    border: 1px solid var(--cpp-editor-widget-border);
    border-radius: var(--cpp-radius);
    box-shadow: var(--cpp-shadow-float);
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
    background: var(--cpp-editor-widget-bg);
    border: 1px solid var(--cpp-editor-widget-border);
    border-radius: var(--cpp-radius);
    box-shadow: var(--cpp-shadow-float);
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
  .qs-switch-track { width: 28px; height: 15px; border-radius: var(--cpp-radius-pill); background: var(--cpp-off-track); transition: background-color var(--cpp-motion); }
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
  .qs-switch input:checked ~ .qs-switch-knob { background: var(--cpp-accent-fg); left: 15px; }
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
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--cpp-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .footer-version {
    color: var(--cpp-text-dim);
    font-size: 10.5px;
    white-space: nowrap;
  }
  .footer-update {
    margin-inline-start: auto;
    white-space: nowrap;
    font-size: 10.5px;
    padding: 4px 8px;
  }

  /* ── Toast ────────────────────────────────────────────── */
  .toast-container {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: min(calc(100% - 20px), 440px);
    z-index: 999;
    display: grid;
    gap: 6px;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: start;
    gap: 7px;
    justify-content: space-between;
    pointer-events: auto;
    padding: 7px 7px 7px 10px;
    border-radius: var(--cpp-radius-lg);
    font-size: 11px;
    box-shadow: var(--cpp-shadow-float);
    background: var(--cpp-editor-widget-bg);
    border: 1px solid var(--cpp-editor-widget-border);
    border-inline-start: 2px solid var(--cpp-accent);
    color: var(--cpp-text);
    animation: toast-in var(--cpp-motion);
  }
  .toast > span { overflow-wrap: anywhere; padding-block: 2px; }
  .toast-error { border-inline-start-color: var(--cpp-danger); }
  .toast-warn { border-inline-start-color: var(--cpp-warn); }
  button.toast-close, button.modal-close { font-size: 16px; line-height: 1; padding: 2px 5px; }
  @keyframes toast-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  /* ── 弹窗 ─────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--cpp-modal-scrim);
    display: grid;
    place-items: center;
    padding: 10px;
  }
  .modal-dialog {
    display: flex;
    flex-direction: column;
    background: var(--cpp-editor-widget-bg);
    border: 1px solid var(--cpp-editor-widget-border);
    border-radius: var(--cpp-radius-lg);
    width: min(100%, 440px);
    max-height: calc(100vh - 20px);
    box-shadow: var(--cpp-shadow-float);
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 9px 11px; border-bottom: 1px solid var(--cpp-border); }
  .modal-title { font-size: 13px; font-weight: 650; }
  .modal-body { min-height: 0; overflow: auto; padding: 9px 11px 11px; }
  .wt-tabs { margin-bottom: 6px; }
  .localization-dialog-intro { margin: 0 0 8px; }
  .localization-count {
    margin-inline-start: 4px;
    padding: 1px 5px;
    border-radius: var(--cpp-radius-pill);
    background: var(--cpp-surface-2);
    font-size: 10px;
  }
  .localization-rule-form, .localization-rule {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
  }
  .localization-custom-form { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
  @media (max-width: 420px) {
    .localization-custom-form { grid-template-columns: minmax(0, 1fr) auto; }
    .localization-custom-form input:first-child { grid-column: 1 / -1; }
  }
  .localization-rule-form input { min-width: 0; }
  .localization-rule-form button, .localization-rule button { white-space: nowrap; }
  .localization-empty { margin: 8px 0 0; }
  .localization-rule-list { margin: 8px 0 0; padding: 0; list-style: none; }
  .localization-rule { padding: 5px 0; border-bottom: 1px solid var(--cpp-border); overflow-wrap: anywhere; }
  .localization-rule-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 5px; }
  .localization-arrow { color: var(--cpp-text-faint); }
  .search-dialog-actions.localization-dialog-actions { justify-content: space-between; }

  .search-providers { display: flex; flex-direction: column; gap: 0; }
  .search-provider-card { border-bottom: 1px solid var(--cpp-border); padding: 9px 0; }
  .search-provider-card:last-of-type { border-bottom: none; }
  .search-provider-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .search-provider-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .search-provider-name { font-size: 12px; font-weight: 600; }
  .search-provider-hint { font-size: 10.5px; color: var(--cpp-text-faint); }
  .search-provider-key { display: grid; gap: 5px; margin-top: 7px; }
  .search-provider-key input { width: 100%; font-size: 11px; padding: 6px 8px; }
  .search-provider-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 8px; margin-top: 2px; }
  .search-test-btn { flex: 0 0 auto; padding: 4px 8px; }
  .search-test-result { font-size: 10.5px; line-height: 1.4; word-break: break-word; color: var(--cpp-text-dim); }
  .search-test-result.level-ok { color: var(--cpp-ok); }
  .search-test-result.level-error { color: var(--cpp-danger); }
  .search-options { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--cpp-border); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .search-fallback { margin-top: 8px; }
  .search-max-results { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .search-max-results > label { margin: 0; }
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
    color: var(--cpp-text);
  }
  .confirm-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 14px; }
  button.danger-solid { background: var(--cpp-danger); color: #fff; border-color: transparent; }
  button.danger-solid:hover:not(:disabled) { background: var(--cpp-danger); opacity: 0.88; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
`
