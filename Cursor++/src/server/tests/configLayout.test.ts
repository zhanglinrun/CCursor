import { expect, it } from 'vitest'
import { renderHtml } from '../../ui/components/layout'

it('renders a Chinese config page with grouped directory controls and collapsed advanced actions', () => {
  const html = renderHtml('/* synthetic webview */')
  expect(html).toContain('lang="zh-CN"')
  expect(html).toContain('class="config-header"')
  expect(html).toContain('服务商与模型')
  expect(html).toContain('aria-label="模型目录"')
  expect(html).toContain('class="catalog-toolbar"')
  expect(html).toContain('role="status"')
  expect(html).toContain('更新目录')
  expect(html).toContain('获取模型')
  expect(html).toContain('保存配置')
  expect(html).toContain('启用扩展思考')
  expect(html).toContain('在 Cursor 模型编辑面板中显示推理档位选择器（None 为关闭）')
  expect(html).not.toContain('Expose the')
  expect(html).toContain('<details class="footer-advanced"><summary>高级设置</summary>')
  expect(html).toContain('editRoutes')
  expect(html).toContain('editProvidersJson')
  expect(html).toContain('checkForUpdates')
  expect(html).not.toContain('Last successful update:')
  expect(html).not.toContain('Catalog defaults apply only')
})
