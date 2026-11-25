/**
 * 二次确认弹窗
 *
 * 删除中转站会立刻写 providers.json 且面板无法撤销，误点代价是重配整条链路。
 * 弹窗只用 store 上的描述符渲染，动作还原逻辑在 confirmAction() 里。
 */
export function ConfirmDialog() {
  return (
    <template {...{ 'x-if': '$store.app.confirmDialog' }}>
      <div
        class="modal-backdrop"
        role="presentation"
        {...{ 'x-on:click.self': '$store.app.cancelConfirm()' }}
        {...{ 'x-on:keydown.escape.window': '$store.app.cancelConfirm()' }}
      >
        <div
          class="modal-dialog confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          {...{ 'x-effect': '$store.app.confirmDialog && $refs.cancelAction && $refs.cancelAction.focus()' }}
        >
          <div class="modal-header">
            <span id="confirm-dialog-title" class="modal-title" x-text="$store.app.confirmDialog?.title"></span>
          </div>
          <div class="modal-body">
            <p id="confirm-dialog-message" class="confirm-message" x-text="$store.app.confirmDialog?.message"></p>
            <template {...{ 'x-if': '$store.app.confirmDialog?.warning' }}>
              <p class="confirm-warning" x-text="$store.app.confirmDialog?.warning"></p>
            </template>
            <div class="confirm-actions">
              <button
                type="button"
                class="ghost"
                x-ref="cancelAction"
                {...{ 'x-on:click': '$store.app.cancelConfirm()' }}
              >
                取消
              </button>
              <button
                type="button"
                class="danger-solid"
                x-text="$store.app.confirmDialog?.confirmLabel || '删除'"
                {...{ 'x-on:click': '$store.app.confirmAction()' }}
              >
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  )
}
