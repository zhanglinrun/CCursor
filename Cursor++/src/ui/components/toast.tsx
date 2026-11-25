export function ToastContainer() {
  return (
    <div
      class="toast-container"
      {...{ 'x-show': '($store.app.toasts || []).length > 0' }}
      x-cloak
    >
      <template {...{ 'x-for': 't in ($store.app.toasts || [])', 'x-bind:key': 't.id' }}>
        <div
          class="toast"
          {...{
            'x-bind:class': '\'toast-\' + t.level',
          }}
        >
          <span role="status" x-text="t.text"></span>
          <button type="button" class="ghost toast-close" aria-label="关闭通知" x-on:click="$store.app.dismissToast(t.id)">&times;</button>
        </div>
      </template>
    </div>
  )
}
