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
        <h2 id="dashboard-service-title">本地服务</h2>
        <span class="dashboard-port" x-text="':' + ($store.app.state?.port ?? '')"></span>
      </div>
      <p class="dashboard-service-caption" role="status" x-text="$store.app.serverLabel"></p>
      <div class="dashboard-service-actions">
        <button
          type="button"
          class="secondary dashboard-action"
          x-show="$store.app.state?.server === 'local' || $store.app.state?.server === 'offline'"
          x-text="$store.app.state?.server === 'local' ? '停止' : '启动'"
          x-bind:aria-label="$store.app.state?.server === 'local' ? '停止本地服务' : '启动本地服务'"
          x-bind:disabled="$store.app.state?.serverIssue === 'port_occupied'"
          x-bind:title="$store.app.state?.serverIssue === 'port_occupied' ? '端口已被其他程序占用' : ''"
          x-on:click="$store.app.post('toggleServer')"
        >
        </button>
      </div>
    </section>
  )
}
