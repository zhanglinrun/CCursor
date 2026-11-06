# CCursor (Cursor++) — 在 Cursor 中使用自己的 API Key

在 [Cursor IDE](https://cursor.com) 中使用**你自己的 LLM API Key**——Anthropic、OpenAI、Google Gemini 或任意 OpenAI 兼容端点——同时保留 Cursor 完整的 Agent 体验。本地 BYOK 服务运行在 Cursor 的扩展宿主内，拦截 ConnectRPC/REST 流量并转发到你配置的服务商；随时可一键切回官方订阅。

[English](README.md) · [更新日志](CHANGELOG.md) · [整合记录](docs/INTEGRATION.md)

当前版本 **0.1.3** · 维护仓库 **zhanglinrun/CCursor** · 许可证 AGPL-3.0-or-later

## 功能

**核心 BYOK**

- **一键开关** — IDE 窗口用状态栏按钮，Agent 窗口用侧边栏按钮；请求幂等，重复点击不会出现「关了又开」。切回 OFF 时 Cursor 官方行为（包括本地 local-loop 路由）原样恢复。
- **多服务商** — Anthropic、OpenAI（Chat + Responses API）、Google Gemini 及任意 OpenAI 兼容端点；协议、地址、API Key 按模型配置。
- **热更新** — 服务商/模型配置修改后即时生效，无需重启 Cursor。

**Agent 体验**

- **完整 Agent 模式** — 22+ 内置工具（Shell、Read、Grep、Glob、Write、Edit、ApplyPatch、WebSearch、WebFetch、TodoWrite 等）、MCP 服务器、动态工具发现（`GetDynamicTools`）；大结果溢写到工作区所在机器的文件里——包括 Remote-SSH/WSL 窗口，由客户端落盘而非服务端。
- **子代理与 Goal 工具** — 并行 Task 子代理与长任务 Goal 工具；多窗口场景下的服务版本识别与接管保持一致。
- **上下文自动压缩** — 软/硬预算先预留输出余量，安全预算的 90% 触发摘要，硬上限才阻止请求（1M 窗口 + 32K 输出为 855K/950K）。检查点跨轮次持久化；摘要失败不会用截取文本冒充历史。
- **原生错误横幅** — 服务商错误以 Cursor 原生重试横幅呈现，区分可重试/不可重试。

**模型管理**

- **可视化配置面板** — 中文本地化的服务商与模型管理界面，内置 models.dev 模型目录的离线快照。点击 **Fetch** 选择端点上的模型，显示名、协议、能力、上下文/输出上限、思考档位与快捷切换参数自动填充；**Save** 后手动编辑始终优先。
- **用量面板** — 按窗口统计 token 与缓存用量。
- **扩展更新** — 面板的「检查扩展更新」从本仓库下载最新正式 Release 并替换扩展本体。

**窗口与远程兼容**

- **Agent Window (glass) 支持** — Agent 窗口的 ConnectRPC 在 renderer 层直发本地 BYOK 服务，官方 transport 作为回退。
- **Remote SSH / WSL / Dev Container** — 拓扑守卫保证 BYOK 开启时远程窗口的 agent host 走 Cursor legacy 路径（远程 agent host 够不到你本机的 BYOK 服务），检测到错配时提示重新加载窗口。
- **路由时效** — 路由规则在每次判定前按需从 `routes.json` 重载，BYOK 切换后的首批请求即用新规则。

## 安装与更新

> 需要已安装 Cursor。**安装或更新前完全退出所有 Cursor 窗口。**打包脚本支持 Windows/macOS/Linux，维护目标为 Windows Cursor 3.27.x。

从本仓库获取 CLI（或自行构建，见下），先跑 `check`，报告不匹配就停止：

```sh
node installer/dist/cli.cjs check      # 只读预检
node installer/dist/cli.cjs install    # 首次安装
node installer/dist/cli.cjs update     # 已安装时更新
node installer/dist/cli.cjs status     # 安装状态
node installer/dist/cli.cjs uninstall  # 恢复 Cursor 原始文件
```

安装器会补丁 Cursor 程序文件（renderer hook、HTTP 路由、agent-host 守卫）并安装 Cursor++ 扩展；仅拖入 VSIX 不够。面板更新只替换扩展本体——涉及 `installer/src/` 的改动需要重跑安装器。Cursor 自身升级后，重新 `check` 再 `update`。

最新发布：<https://github.com/zhanglinrun/CCursor/releases/latest> ——不要用 `npx @cometix/ccursor`，那会安装上游版本并覆盖本分支的增强。

## 从源码构建

需要 **Node.js 22+**、pnpm **10.32.1**（`Cursor++/package.json` 已固定），以及供 SQLite 集成测试使用的 Cursor 安装：

```sh
cd Cursor++ && pnpm install --frozen-lockfile
cd ../installer && npm ci && cd ..
node scripts/verify.mjs                 # 类型、Lint、扩展与安装器测试、版本一致性
npm --prefix installer run build:all    # 构建 installer/dist/cli.cjs + vsix
node installer/dist/cli.cjs check
```

测试使用项目 `Temp/tests` 与模拟用户目录，不使用日常 BYOK 配置。Cursor 安装在自定义位置时，把 `CURSOR_APP_ROOT`（测试）和 `CCURSOR_CURSOR_ROOT`（安装器）指向 Cursor 的 `resources/app` 目录。

## 压缩与模型目录细节

- 压缩在每次模型请求前检查——新消息、工具结果和 schema 都算。软阈值摘要失败会保留原历史，低于硬上限仍可继续；超长摘要输入按预算分块，空白/截断的摘要不提交，也不会用截取文本冒充摘要。
- 模型目录按需从 `https://models.dev/api.json` 刷新，失败时保留旧快照。API Model 保留端点原名，Fast 默认关闭。构建前可用 `node installer/scripts/update-models-catalog.mjs` 更新内置快照，不会修改用户配置。

## 远程工作区：需要自行验证的内容

预检证明的是补丁定位兼容，不是真实远程会话。依赖远程工作区前，分别确认远端主机名/目录、远端独有文件的读取与修改、命令执行、取消请求和子代理文件访问——不能只测聊天回复。两个已接受的折衷仍然存在：legacy agent-host 回退期间部分 Agent-Host 专属功能可能不可用；BYOK 开启会写入 `cursor.experimental.startupConnectTransport = false`，卸载不会自动恢复，需要 Cursor 默认值时手动删除该覆盖项。从旧 server owner 升级需要完整关闭一次所有 Cursor 窗口。

## 署名与许可

基于 [CometixSpace/CCursor](https://github.com/CometixSpace/CCursor)，增强来自 [Yoahoug/CCursor-BYOK](https://github.com/Yoahoug/CCursor-BYOK)，本分支在其上继续添加修复与功能。确切来源提交见 [upstream-sources.json](upstream-sources.json)，合并历史见 [docs/INTEGRATION.md](docs/INTEGRATION.md)。许可证 **AGPL-3.0-or-later**，见 [LICENSE](LICENSE)。归档的上游 README（[英文](README_UPSTREAM.md) / [中文](README_UPSTREAM_CN.md)）对应较旧版本，可能包含过时信息。
