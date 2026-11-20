import { PROVIDER_PRESETS } from '../providerPresets'
import { CustomSelect } from './custom-select'

const AUTH_KINDS = [
  { value: 'apiKey', label: 'API Key' },
  { value: 'token', label: 'Bearer Token' },
]

export function ProviderFields() {
  return (
    <>
      <h3 class="connection-title">连接配置</h3>
      <div class="field provider-presets" x-show="$store.app.canApplyProviderPreset(p.id)" x-cloak>
        <div class="provider-preset-grid" role="group" aria-label="服务商预设">
          <button type="button" class="ghost provider-preset" x-on:click="document.getElementById('provider-url-' + p.id)?.focus()">
            <span class="provider-preset-icon" aria-hidden="true">+</span>
            <span class="provider-preset-text">
              <strong>自定义</strong>
              <small>手动填写地址</small>
            </span>
          </button>
          {PROVIDER_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              class="ghost provider-preset"
              title={preset.baseUrl}
              x-on:click={`if ($store.app.applyProviderPreset(p.id, '${preset.id}')) { listProtocol = ''; $nextTick(() => document.getElementById('provider-key-' + p.id)?.focus()) }`}
            >
              <span class="provider-preset-icon" aria-hidden="true">{preset.name[0]}</span>
              <span class="provider-preset-text">
                <strong>{preset.name}</strong>
                <small>{preset.baseUrl.slice('https://'.length)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div class="provider-connection-fields">
        <div class="field">
          <label x-bind:for="'provider-name-' + p.id">服务商名称</label>
          <input
            type="text"
            x-bind:id="'provider-name-' + p.id"
            placeholder="例如：我的中转站"
            x-effect="if(document.activeElement !== $el) $el.value = $store.app.getDraft(p.id).name || ''"
            x-on:input="$store.app.updateField(p.id, 'name', $event.target.value)"
            x-bind:class="{ 'invalid': $store.app.validate(p.id).errors.name }"
          />
          <div class="err" x-show="$store.app.validate(p.id).errors.name" x-text="$store.app.validate(p.id).errors.name"></div>
        </div>
        <div class="field">
          <label x-bind:for="'provider-url-' + p.id">服务地址</label>
          <input
            type="text"
            inputmode="url"
            x-bind:id="'provider-url-' + p.id"
            placeholder="https://api.example.com"
            x-effect="if(document.activeElement !== $el) $el.value = $store.app.getDraft(p.id).baseUrl || ''"
            x-on:input="$store.app.updateField(p.id, 'baseUrl', $event.target.value); listProtocol = ''"
            x-bind:class="{ 'invalid': $store.app.validate(p.id).errors.baseUrl }"
          />
          <div class="err" x-show="$store.app.validate(p.id).errors.baseUrl" x-text="$store.app.validate(p.id).errors.baseUrl"></div>
        </div>
        <div class="field" x-data="{ showKey: false }">
          <label x-bind:for="'provider-key-' + p.id">API 密钥 / Token</label>
          <div class="input-reveal">
            <input
              x-bind:type="showKey ? 'text' : 'password'"
              x-bind:id="'provider-key-' + p.id"
              placeholder="sk-..."
              x-effect="if(document.activeElement !== $el) $el.value = $store.app.getDraft(p.id).auth?.value || ''"
              x-on:input="$store.app.updateField(p.id, 'auth.value', $event.target.value)"
              x-bind:class="{ 'invalid': $store.app.validate(p.id).errors.authValue }"
            />
            <button
              type="button"
              class="reveal-btn"
              x-on:click="showKey = !showKey"
              x-bind:aria-label="showKey ? '隐藏密钥' : '显示密钥'"
              title="显示或隐藏密钥"
            >
              <span x-bind:class="showKey ? 'codicon codicon-eye-closed' : 'codicon codicon-eye'"></span>
            </button>
          </div>
          <div class="err" x-show="$store.app.validate(p.id).errors.authValue" x-text="$store.app.validate(p.id).errors.authValue"></div>
        </div>
        <div class="field">
          <label x-bind:for="'list-protocol-' + p.id">列表接口</label>
          <select x-bind:id="'list-protocol-' + p.id" x-model="listProtocol">
            <option value="">自动选择</option>
            <option value="openai-chat">OpenAI 兼容</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>
      </div>

      <section class="provider-advanced" x-ref="connectionAdvanced" x-bind:id="'provider-advanced-' + p.id" x-bind:hidden="!advancedVisible" x-cloak>
        <h3 class="connection-title">高级连接设置</h3>
        <div class="provider-advanced-fields">
          <div class="field" x-show="$store.app.providerUsesAnthropic(p.id)" x-cloak>
            <label>认证方式</label>
            <CustomSelect
              valueExpr="$store.app.getDraft(p.id).auth?.kind"
              changeExpr="$store.app.updateField(p.id, 'auth.kind', $value)"
              options={AUTH_KINDS}
            />
            <div class="err" x-show="$store.app.validate(p.id).errors.authKind" x-text="$store.app.validate(p.id).errors.authKind"></div>
          </div>
          <div class="field" x-show="$store.app.providerUsesProxy(p.id)" x-cloak>
            <label x-bind:for="'provider-proxy-' + p.id">代理地址（选填）</label>
            <input
              type="text"
              x-bind:id="'provider-proxy-' + p.id"
              placeholder="http://127.0.0.1:8080"
              x-effect="if(document.activeElement !== $el) $el.value = $store.app.getDraft(p.id).proxyUrl || ''"
              x-on:input="$store.app.updateField(p.id, 'proxyUrl', $event.target.value)"
            />
          </div>
          <div class="field">
            <label x-bind:for="'provider-headers-' + p.id">自定义请求头（JSON，选填）</label>
            <textarea
              x-bind:id="'provider-headers-' + p.id"
              rows={2}
              placeholder={'{"anthropic-beta": "interleaved-thinking-2025-05-14"}'}
              x-effect="if(document.activeElement !== $el) $el.value = $store.app.formatHeaders(p.id)"
              x-on:input="$store.app.updateHeaders(p.id, $event.target.value)"
              x-bind:class="{ 'invalid': $store.app.headersInvalid[p.id] }"
            >
            </textarea>
            <div class="err" x-show="$store.app.headersInvalid[p.id]">请输入 JSON 对象，例如一组名称和值</div>
          </div>
        </div>
      </section>
    </>
  )
}
