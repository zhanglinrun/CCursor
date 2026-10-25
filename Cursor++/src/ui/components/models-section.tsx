import { ModelCard } from './model-card'

/** Models 子区域 — 在 provider accordion body 内 */
export function ModelsSection() {
  return (
    <div class="models-section" style="position:relative">
      {/* Loading 遮罩 */}
      <template {...{ 'x-if': '$store.app.remoteModels[p.id] && $store.app.remoteModels[p.id].loading' }}>
        <div class="models-loading-overlay">
          <span class="models-loading-spinner">正在获取可用模型…</span>
        </div>
      </template>

      <div class="models-header">
        <span
          class="models-title"
          {...{ 'x-text': '\'模型（\' + ($store.app.getDraft(p.id).models || []).length + \'）\'' }}
        >
        </span>
        <span class="models-header-actions">
          <button
            class="tiny secondary"
            {...{ 'x-bind:disabled': '$store.app.batchTesting[p.id] === true' }}
            title="依次测试此服务商下的所有模型；会发送真实请求"
            x-on:click="$store.app.testAllModels(p.id)"
            x-text="$store.app.batchTesting[p.id] ? '测试中…' : '测试全部'"
          >
          </button>
          <button class="tiny secondary" {...{ 'x-on:click': '$store.app.fetchRemoteModels(p.id)' }}>获取模型</button>
          <button class="tiny secondary" {...{ 'x-on:click': '$store.app.addModel(p.id)' }}>+ 添加模型</button>
        </span>
      </div>

      {/* Remote models 结果面板 */}
      <template {...{ 'x-if': '$store.app.remoteModels[p.id] && $store.app.remoteModels[p.id].models && $store.app.remoteModels[p.id].models.length > 0' }}>
        <div class="remote-models-panel">
          <div class="remote-models-header">
            <span
              class="remote-models-title"
              {...{ 'x-text': '\'可用模型（\' + $store.app.remoteModels[p.id].models.length + \'）\'' }}
            >
            </span>
            <button class="tiny ghost" title="关闭可用模型列表" aria-label="关闭可用模型列表" {...{ 'x-on:click': '$store.app.dismissRemoteModels(p.id)' }}>✕</button>
          </div>
          <div class="remote-models-list">
            <template {...{ 'x-for': 'rm in $store.app.remoteModels[p.id].models' }}>
              {/*
                显示上游给的 display_name，而不是 id。
                部分中转站会把 id 混淆成不可读的串（flash → hsalf 之类），
                拿 id 当标题会让整列都是乱码；id 只在两者不同时作为副标题出现。
              */}
              <div
                class="remote-model-item"
                x-on:click="$store.app.applyRemoteModel(p.id, rm)"
                x-bind:title="rm.id"
              >
                <span class="remote-model-name" x-text="$store.app.remoteModelPrimary(rm)"></span>
                <template {...{ 'x-if': '$store.app.remoteModelSecondary(rm)' }}>
                  <span class="remote-model-id" x-text="$store.app.remoteModelSecondary(rm)"></span>
                </template>
              </div>
            </template>
          </div>
        </div>
      </template>

      <template {...{ 'x-if': '!$store.app.getDraft(p.id).models || $store.app.getDraft(p.id).models.length === 0' }}>
        <div class="model-empty">
          暂无模型。点击“获取模型”从端点读取可用列表，选择后自动填参；也可手动添加。
        </div>
      </template>
      <template {...{ 'x-for': 'm in ($store.app.getDraft(p.id).models || [])', 'x-bind:key': 'm.id' }}>
        <ModelCard />
      </template>
    </div>
  )
}
