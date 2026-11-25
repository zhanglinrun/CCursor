import { Modal } from './modal'

export function LocalizationDialog() {
  return (
    <Modal showExpr="$store.app.i18nRulesOpen" title="自定义词典">
      <p class="hint localization-dialog-intro">遇到漏翻或不习惯的英文界面文案时，在这里添加规则，保存后立即热生效。</p>
      <div class="wt-tabs" role="group" aria-label="词典规则">
        <button type="button" x-bind:aria-pressed="$store.app.i18nRulesTab === 'custom'" x-on:click="$store.app.i18nRulesTab = 'custom'">
          自定义翻译
          <span class="localization-count" x-show="$store.app.i18nCustomRows.length" x-text="$store.app.i18nCustomRows.length"></span>
        </button>
        <button type="button" x-bind:aria-pressed="$store.app.i18nRulesTab === 'english'" x-on:click="$store.app.i18nRulesTab = 'english'">
          保留英文
          <span class="localization-count" x-show="$store.app.i18nDisabledKeys.length" x-text="$store.app.i18nDisabledKeys.length"></span>
        </button>
      </div>

      <div x-show="$store.app.i18nRulesTab === 'custom'">
        <form class="localization-rule-form localization-custom-form" {...{ 'x-on:submit.prevent': '$store.app.addCustomTranslation()' }}>
          <input type="text" aria-label="英文原文" placeholder="英文原文（如 New Agent）" maxlength={400} x-model="$store.app.i18nSource" x-bind:disabled="!!$store.app.i18nRulesSaving" />
          <input type="text" aria-label="中文译文" placeholder="中文译文（如 新建助手）" x-model="$store.app.i18nTranslation" x-bind:disabled="!!$store.app.i18nRulesSaving" />
          <button type="submit" x-bind:disabled="$store.app.i18nRulesSaving || !$store.app.i18nSource.trim() || !$store.app.i18nTranslation.trim()">添加</button>
        </form>
        <p class="hint localization-empty" x-show="!$store.app.i18nCustomRows.length">暂无自定义词条。例如填 New Agent 和 新建助手，点击添加即可立即生效。</p>
        <ul class="localization-rule-list" aria-label="自定义翻译" x-show="$store.app.i18nCustomRows.length">
          <template x-for="rule in $store.app.i18nCustomRows" x-bind:key="rule[0]">
            <li class="localization-rule">
              <div class="localization-rule-pair">
                <span x-text="rule[0]"></span>
                <span class="localization-arrow" aria-hidden="true">→</span>
                <span x-text="rule[1]"></span>
              </div>
              <button type="button" class="ghost tiny" x-bind:disabled="!!$store.app.i18nRulesSaving" x-bind:aria-label="'删除 ' + rule[0]" x-on:click="$store.app.removeCustomTranslation(rule[0])">删除</button>
            </li>
          </template>
        </ul>
      </div>

      <div x-show="$store.app.i18nRulesTab === 'english'">
        <p class="hint localization-dialog-intro">加入此列表的词条将跳过内置汉化，界面立即恢复为英文原样。</p>
        <form class="localization-rule-form" {...{ 'x-on:submit.prevent': '$store.app.addEnglishRule()' }}>
          <input type="text" aria-label="要保留英文的词条" placeholder="要保留英文的词条（如 Agent）" maxlength={400} x-model="$store.app.i18nKeepEnglish" x-bind:disabled="!!$store.app.i18nRulesSaving" />
          <button type="submit" x-bind:disabled="$store.app.i18nRulesSaving || !$store.app.i18nKeepEnglish.trim()">添加</button>
        </form>
        <p class="hint localization-empty" x-show="!$store.app.i18nDisabledKeys.length">暂无跳过词条。若某条内置翻译不习惯，可在这里恢复英文。</p>
        <ul class="localization-rule-list" aria-label="保留英文" x-show="$store.app.i18nDisabledKeys.length">
          <template x-for="source in $store.app.i18nDisabledKeys" x-bind:key="source">
            <li class="localization-rule">
              <span x-text="source"></span>
              <button type="button" class="ghost tiny" x-bind:disabled="!!$store.app.i18nRulesSaving" x-bind:aria-label="'移除 ' + source" x-on:click="$store.app.removeEnglishRule(source)">移除</button>
            </li>
          </template>
        </ul>
      </div>

      <div class="search-dialog-actions localization-dialog-actions">
        <button type="button" class="ghost" x-on:click="$store.app.post('editLocalization')">打开 JSON 源文件</button>
        <button type="button" class="secondary" x-on:click="$store.app.i18nRulesOpen = false">关闭</button>
      </div>
    </Modal>
  )
}
