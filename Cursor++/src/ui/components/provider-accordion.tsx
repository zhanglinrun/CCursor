import { ModelsSection } from './models-section'
import { ProviderFields } from './provider-fields'

export function ProviderEditor() {
  return (
    <section class="provider-editor" x-data="{ listProtocol: '', advancedOpen: false, get advancedVisible() { return this.advancedOpen || $store.app.headersInvalid[p.id] || $store.app.validate(p.id).errors.authKind } }" x-init="$nextTick(() => $refs.editorTitle.focus())" aria-labelledby="provider-editor-title">
      <header class="provider-edit-toolbar">
        <h2 id="provider-editor-title" x-ref="editorTitle" tabindex={-1} x-text="$store.app.baseProvider(p.id) ? '编辑 AI 服务' : '添加 AI 服务'"></h2>
        <div class="config-actions">
          <div class="provider-toolbar-group">
            <button type="button" class="ghost" x-bind:aria-expanded="!!advancedVisible" x-bind:aria-controls="'provider-advanced-' + p.id" x-on:click="advancedOpen = !advancedOpen; if (advancedOpen) $nextTick(() => $refs.connectionAdvanced?.scrollIntoView({ block: 'nearest' }))">高级设置</button>
            <button type="button" class="ghost" x-bind:disabled="!p.models?.length || !!$store.app.batchTesting[p.id]" x-on:click="$store.app.testAllModels(p.id)" x-text="$store.app.batchTesting[p.id] ? '测试中…' : '测试模型'">测试模型</button>
          </div>
          <div class="provider-toolbar-group">
            <button type="button" class="ghost" x-bind:disabled="!!$store.app.savingProviders[p.id]" x-on:click="$store.app.cancelProviderEdit(p.id)">取消</button>
            <button type="button" class="settings-primary" x-bind:disabled="!$store.app.isDirty(p.id) || !!$store.app.savingProviders[p.id]" x-on:click="$store.app.saveProvider(p.id)" x-text="$store.app.savingProviders[p.id] ? '保存中…' : '保存服务'">保存服务</button>
          </div>
        </div>
      </header>
      <div class="provider-editor-body">
        <section class="provider-connection" aria-labelledby="provider-connection-title">
          <ProviderFields />
        </section>
        <ModelsSection />
      </div>
      <div class="actions-bar" x-show="$store.app.baseProvider(p.id)">
        <button type="button" class="danger" x-bind:disabled="!!$store.app.savingProviders[p.id]" x-on:click="$store.app.requestDeleteProvider(p.id)">删除服务商</button>
      </div>
    </section>
  )
}
