export function Server() {
  return (
    <section class="dashboard-service" aria-labelledby="dashboard-service-title" x-show="$store.app.state" x-cloak>
      <div class="dashboard-service-status">
        <span
          class="dot"
          aria-hidden="true"
          x-bind:class="{
            'dot-ok': $store.app.state?.server === 'local' || $store.app.state?.server === 'remote',
            'dot-bad': $store.app.state?.server === 'offline' && $store.app.state?.serverIssue === 'port_occupied',
          }"
        >
        </span>
        <div>
          <h2 id="dashboard-service-title">本地服务</h2>
          <p role="status" x-text="$store.app.serverLabel"></p>
        </div>
      </div>
      <div class="dashboard-service-actions">
        <span class="dashboard-version" x-show="$store.app.state?.version" x-text="'v' + ($store.app.state?.version || '')"></span>
        <button
          type="button"
          class="secondary dashboard-action"
          x-show="$store.app.state?.server === 'local' || $store.app.state?.server === 'offline'"
          x-text="$store.app.state?.server === 'local' ? '停止服务' : '启动服务'"
          x-bind:disabled="$store.app.state?.serverIssue === 'port_occupied'"
          x-bind:title="$store.app.state?.serverIssue === 'port_occupied' ? '端口已被其他程序占用' : ''"
          x-on:click="$store.app.post('toggleServer')"
        >
        </button>
      </div>
    </section>
  )
}
