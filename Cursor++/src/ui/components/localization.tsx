export function Localization() {
  return (
    <section class="dashboard-service localization-card" aria-labelledby="localization-title" x-show="$store.app.state" x-cloak>
      <div class="localization-header">
        <h2 id="localization-title">Cursor 界面汉化</h2>
        <span
          class="localization-status"
          role="status"
          x-bind:class="{ 'is-available': $store.app.state?.i18nHookPresent && $store.app.state?.i18n.enabled, 'is-outdated': !$store.app.state?.i18nHookPresent }"
          x-text="$store.app.i18nLabel"
        >
        </span>
        <button
          type="button"
          class="service-switch"
          role="switch"
          aria-labelledby="localization-title"
          x-bind:aria-checked="Boolean($store.app.state?.i18nHookPresent && $store.app.state?.i18n.enabled)"
          x-bind:disabled="!$store.app.state?.i18nHookPresent || $store.app.i18nBusy"
          x-on:click="$store.app.setCursorLocalization()"
        >
        </button>
      </div>
      <div class="localization-caption">
        <p x-text="$store.app.i18nCaption"></p>
        <button type="button" class="secondary dashboard-action" x-show="!$store.app.state?.i18nHookPresent" x-on:click="$store.app.post('injectRouting')">重新注入</button>
      </div>
      <div class="localization-actions">
        <button type="button" class="secondary dashboard-action" aria-haspopup="dialog" x-on:click="$store.app.i18nRulesOpen = true">自定义词典</button>
        <button
          type="button"
          class="secondary dashboard-action"
          x-show="!$store.app.state?.zhLangPackInstalled || !$store.app.state?.uiLanguage?.toLowerCase().startsWith('zh')"
          x-text="$store.app.state?.zhLangPackInstalled ? '切换显示语言' : '安装官方中文包'"
          x-on:click="$store.app.post('installZhLanguagePack')"
        >
        </button>
      </div>
    </section>
  )
}
