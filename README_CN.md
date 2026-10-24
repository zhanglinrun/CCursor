# CCursor — 自维护 BYOK 分支

[English](README.md) · [整合与维护记录](docs/INTEGRATION.md) · [更新日志](CHANGELOG.md)

基于 [CometixSpace/CCursor](https://github.com/CometixSpace/CCursor)，整合 [Yoahoug/CCursor-BYOK](https://github.com/Yoahoug/CCursor-BYOK) 的增强和部分上游兼容修复。当前开发版本 **0.1.0**，维护仓库为 **zhanglinrun/CCursor**，并非原项目的官方发行版。

## 已整合内容

| 来源 | 内容 |
|---|---|
| Yoahoug `0.0.26` 及其文档更新 | 搜索/抓取修复、自定义搜索地址、模型级协议与探测、用量/缓存统计、界面、性能和开发工具增强 |
| PR #31 | ConnectRPC 模块没有 `.js` 后缀时的安装兼容 |
| PR #33 | Remote SSH 的 Agent Host legacy 回退 |
| PR #38 | 模型列表刷新、本地请求通道、Auto/default 解析、connect turn 路由 |
| PR #30 | Goal 工具、多窗口服务版本识别和接管 |
| PR #35 | 长工具链反复压缩及无收益摘要处理 |
| PR #18 / #17 | 默认模型启用状态一致性、Canvas 导出脚本转义 |
| 本分支补充 | Auto 不选停用模型、Request 覆盖参数保留、补丁独有标记、预检失败码与 glass 检查、测试隔离和版本同步 |

完整来源提交见 [upstream-sources.json](upstream-sources.json)。Git 保留了 Yoahoug 的原提交历史，整合修复分别提交，便于定位和回退。

## 构建与验证

需要 **Node.js 22+**、**pnpm 10.32.1**，以及供 SQLite 集成测试使用的 Cursor 安装。`Cursor++/package.json` 固定了 pnpm 版本。

在仓库根目录依次执行：

```powershell
cd Cursor++
pnpm install --frozen-lockfile
cd ../installer
npm ci
cd ..
node scripts/verify.mjs
npm --prefix installer run build:all
node installer/dist/cli.cjs check
```

`verify.mjs` 检查版本一致性、类型、Lint、扩展测试和安装器测试。测试使用项目 `Temp/tests` 和模拟用户目录，不使用日常 BYOK 配置。真实网络测试默认跳过。

自定义安装路径时：测试使用 `CURSOR_APP_ROOT`，安装器使用 `CCURSOR_CURSOR_ROOT`；都应指向 Cursor 的 `resources/app` 目录。

构建产物：

- `installer/dist/cli.cjs` 和同目录的 `models-catalog.json`。
- `installer/vsix/cursor2plus-0.1.0.vsix`。

保留 installer 目录结构，CLI 还需要本地依赖和旁边的 `vsix` 目录。

## 安装与后续更新

**先执行 `check`，不匹配时停止安装。安装或更新之前完全退出所有 Cursor 窗口。**

```powershell
# 首次安装
node installer/dist/cli.cjs install

# 已安装时更新：先恢复旧补丁，再安装当前构建
node installer/dist/cli.cjs update

# 检查安装状态
node installer/dist/cli.cjs status
```

按实际情况选择 `install` 或 `update`。需要恢复 Cursor 程序文件时：

```powershell
node installer/dist/cli.cjs uninstall
```

仅拖入 VSIX 不会应用必要的 Cursor 程序补丁。面板里的更新按钮只替换扩展本体；涉及 `installer/src/` 的改动必须重新构建并运行 installer。每次升级 Cursor 后，也应重新预检并应用补丁。

更新检查已指向 **zhanglinrun/CCursor**。本仓库尚未发布自己的 Release 时，请从源码构建。`npx @cometix/ccursor` 会安装上游版本，覆盖此分支的增强。

## SSH 与兼容边界

本分支已对本机 **Windows Cursor 3.27.12** 完成只读补丁预检，全部目标匹配。这证明安装文件的补丁定位通过，**不等于真实 SSH Agent 已验收**。此前自动检测到的 3.15.19 缺少 glass 刷新锚点，预检会拒绝它。

- #33 强制回退 legacy Agent Host 路径，部分新 Agent Host 功能可能不可用；补丁保留期间也会影响官方模式。
- #38 会写入 `cursor.experimental.startupConnectTransport = false`。卸载不会自动恢复此设置；需要回到 Cursor 默认值时，手动删除该覆盖项。
- 从旧版本升级后，先关闭所有 Cursor 窗口一次，避免旧窗口继续占有 BYOK 服务。
- SSH 验收需分别确认远端主机名/目录、远端独有文件的读取与修改、命令执行、取消请求和子代理访问；不能只测试聊天回复。

维护步骤、来源边界与验证记录见 [INTEGRATION.md](docs/INTEGRATION.md)。本次整合只提交源码和本地构建，没有推送或公开发布。

## 署名与许可

原项目作者为 CometixSpace，增强版本来自 Yoahoug，其余修复保留 PR 与提交来源。继续使用 **AGPL-3.0-or-later**，见 [LICENSE](LICENSE)。[原版归档文档](README_UPSTREAM_CN.md) 对应较旧版本，配置与安装请以当前 README 为准。
