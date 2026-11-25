import { Banner } from './banner'
import { ConfirmDialog } from './confirm-dialog'
import { Footer } from './footer'
import { Localization } from './localization'
import { LocalizationDialog } from './localization-dialog'
import { Providers } from './providers'
import { WebToolsDialog } from './search-section'
import { Server } from './server'
import { styles } from './styles'
import { ToastContainer } from './toast'
import { UsageDashboard } from './usage-dashboard'

/**
 * CSS 必须以 dangerouslySetInnerHTML 注入 —— 不能用 <style>{css}</style>。
 *
 * hono/jsx 会把 style 标签的子节点当普通文本做 HTML 转义：字体名里的双引号
 * 会被写成 &quot;（`"SF Mono"` → `&quot;SF Mono&quot;`），codicon 的 content
 * 转义序列也会被跟着二次转义。转义后的声明不合法，CSS 解析器会静默丢弃，
 * 表现就是某条规则莫名不生效，且不报任何错。
 */
function StyleSheet({ css }: { css: string }) {
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}

function Layout({ webviewJs, codiconUri }: { webviewJs: string, codiconUri?: string }) {
  const codiconCss = codiconUri
    ? `@font-face { font-family: 'codicon'; font-display: block; src: url('${codiconUri}') format('truetype'); }
       .codicon { font-family: 'codicon'; font-size: 14px; line-height: 1; display: inline-block; -webkit-font-smoothing: antialiased; }
       .codicon::before { display: inline-block; }
       .codicon-eye::before { content: "\\ea70"; }
       .codicon-eye-closed::before { content: "\\eae7"; }`
    : ''

  return (
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <StyleSheet css={codiconCss + styles} />
      </head>
      <body class="panel-shell" x-data>
        <Banner />

        <div class="tabs" role="tablist" aria-label="Cursor++">
          <button
            type="button"
            class="tab"
            role="tab"
            id="dashboard-tab"
            aria-controls="dashboard-panel"
            x-ref="dashboardTab"
            x-bind:aria-selected="$store.app.activeTab === 'dashboard'"
            x-bind:tabindex="$store.app.activeTab === 'dashboard' ? 0 : -1"
            x-on:click="$store.app.setTab('dashboard')"
            {...{ 'x-on:keydown.left.prevent': '$refs.configTab.click(); $refs.configTab.focus()', 'x-on:keydown.right.prevent': '$refs.configTab.click(); $refs.configTab.focus()' }}
          >
            仪表盘
          </button>
          <button
            type="button"
            class="tab"
            role="tab"
            id="config-tab"
            aria-controls="config-panel"
            x-ref="configTab"
            x-bind:aria-selected="$store.app.activeTab === 'config'"
            x-bind:tabindex="$store.app.activeTab === 'config' ? 0 : -1"
            x-on:click="$store.app.setTab('config')"
            {...{ 'x-on:keydown.left.prevent': '$refs.dashboardTab.click(); $refs.dashboardTab.focus()', 'x-on:keydown.right.prevent': '$refs.dashboardTab.click(); $refs.dashboardTab.focus()' }}
          >
            服务配置
          </button>
        </div>

        <main>
          <div class="dashboard-page" id="dashboard-panel" role="tabpanel" aria-labelledby="dashboard-tab" x-show="$store.app.activeTab === 'dashboard'">
            <Server />
            <Localization />
            <UsageDashboard />
          </div>
          <div class="config-page" id="config-panel" role="tabpanel" aria-labelledby="config-tab" x-show="$store.app.activeTab === 'config'" x-cloak>
            <Providers />
          </div>
        </main>

        <WebToolsDialog />
        <LocalizationDialog />
        <ConfirmDialog />

        <Footer />
        <ToastContainer />

        <script dangerouslySetInnerHTML={{ __html: webviewJs }} />
      </body>
    </html>
  )
}

/** 生成完整 HTML 字符串 (extension host 侧调用) */
export function renderHtml(webviewJs: string, codiconUri?: string): string {
  const html = (<Layout webviewJs={webviewJs} codiconUri={codiconUri} />).toString()
  return `<!DOCTYPE html>${html}`
}
