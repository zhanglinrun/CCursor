/** 低频配置入口折叠收纳，更新操作保持可见。 */
export function Footer() {
  return (
    <footer class="footer">
      <details class="footer-advanced">
        <summary>高级设置</summary>
        <div class="footer-row">
          <button class="secondary" x-on:click="$store.app.post('editRoutes')">编辑路由配置</button>
          <button class="secondary" x-on:click="$store.app.post('editProvidersJson')">编辑服务商 JSON</button>
        </div>
      </details>
      <button
        class="secondary footer-update"
        x-text="$store.app.updateButtonLabel"
        x-bind:disabled="$store.app.updatePhase !== ''"
        title="检查本分支的 GitHub 发行版，有新版时更新扩展"
        x-on:click="$store.app.checkForUpdates()"
      >
        检查扩展更新
      </button>
    </footer>
  )
}
