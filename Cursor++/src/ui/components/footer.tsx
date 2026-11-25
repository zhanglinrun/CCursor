export function Footer() {
  return (
    <footer class="footer">
      <span
        class="footer-version"
        x-show="$store.app.state?.version"
        x-text="'Cursor++ v' + ($store.app.state?.version || '')"
        x-cloak
      >
      </span>
      <button
        type="button"
        class="secondary footer-update"
        x-text="$store.app.updateButtonLabel"
        x-bind:disabled="$store.app.updatePhase !== ''"
        title="检查本分支的 GitHub 发行版，有新版时更新扩展"
        x-on:click="$store.app.checkForUpdates()"
      >
        检查更新
      </button>
    </footer>
  )
}
