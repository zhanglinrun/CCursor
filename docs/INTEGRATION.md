# 整合与维护记录

本分支以 CometixSpace/CCursor `fcac85d`（0.0.15）为基线，维护目标是自用 BYOK、Remote SSH 和新版 Cursor 的兼容性。当前版本为 0.1.3。

## 来源

所有完整 SHA 都记录在根目录 [upstream-sources.json](../upstream-sources.json)。

| 来源 | 处理方式 |
|---|---|
| Yoahoug/CCursor-BYOK `0e239a7` | 合并完整历史，包含 0.0.26 和后续 README 更新 |
| CometixSpace/CCursor #31 | 安装锚点兼容，独立提交 |
| #33 | SSH legacy Agent Host 回退，独立提交 |
| #38 | 按请求通道、默认模型、模型刷新、turn 路由分成四笔提交 |
| #30 | Goal 工具及跨窗口版本接管，保留 Yoahoug 更新器和工具结构 |
| #35 | 压缩边界和无收益摘要，保留拆分后的 runtime 模块及用量统计 |
| #18 | 默认模型启用规则，并修正与 #38 Auto 解析之间的冲突 |
| #17 | Canvas 内联 JSON 转义 |
| CometixSpace/CCursor `fcac85d..32f25ef` (0.0.16/0.0.17) | 2026-10 上游批次,见下方「0.1.3 同步」 |

## 0.1.3 同步 (0.0.16/0.0.17)

按提交移植,保留本 fork 自有改动 (路由日志、legacy rebind、AvailableModels 短路、glass 原生刷新桥接、agent-gate 补丁):

- `ea084a2`/`18a215d`/`95c2efd`/`7a14847` 随 #38/#18/proto 已在 0.1.0 整合,未重复移植。
- `5525b68` SSE `event: rpc-routes` + `splitRedirect`;外部编辑 routes.json 时 server 进程同样推送。
- `868fe81`/`0084dbf`/`a395824` 幂等 BYOK 开关 (`requestByokMode` + `/byok/mode` + `cursor2plus.setByokMode`) 与稳定后补发刷新 (`bumpRefreshSignalForModeChange`);本 fork 的 `disableStartupConnectTransport` 保留在统一入口内。
- `c811805`/`00655b8` HTTP/1.1 路由 V3 补齐 (`ensureFresh` 按需重载 + `__byokRpcRouted` + `stripLegacyRouterPayload`)。
- `a5fd848` hook rev2: glass 窗口 renderer 层 ConnectRPC 路由,与本地 AvailableModels 短路融合在同一 payload (rev3)。
- `fe49f67` turn 路由条件守卫 (`agent-turn-route-guard.js`),替换 #38 旧版的无条件 connect 钉住。
- `735fcd6`/`b0c0046`/`32f25ef` 远端拓扑守卫 (`agent-host-topology.js` + hook `__byokAgentHostTopology` + 扩展 proposal 声明与 Reload 提示)。
- `886e189` GetDynamicTools 大结果客户端溢写 (`writeFileViaClient`);`ecc15df` Shell `working_directory` 透传 (`shellWorkingDirectoryArg`)。
- `9627787` (EADDRINUSE 误报) 经核对本地已有等价实现,未移植;`ce935a7` (CORS 预检不计入 [GRPC] 日志 + 预检缓存 10 分钟) 为本次移植。
- proto 未重新装载: 上游 `7a14847` 的 gen 面向 3.27.22 审计,本地 gen 与服务实现仍基于既有装载;后续跟进 Cursor 新版本时再评估。

这里不是上游所有 PR 的集合。#23 改动历史持久化边界；#15、#25、#26 等独立功能没有随兼容修复默认引入。#16 涉及的陈旧说明由当前 README 替换；没有宣称接入上游 CI 或发布流程。

## 整合时额外修正

- Auto 只选择 `defaultOn === true` 的模型；没有启用模型时不会偷偷使用停用的首项。两个交叉回归用例先失败，修复后通过。
- `fetch(Request, init)` 重定向合成有效 Request，保留 method、body、headers 和取消信号的覆盖参数。
- Agent turn 路由使用独有补丁标记，原生 BYOK connect 分支不再被误认为补丁已生效。
- `check` 校验 glass 模型刷新补丁；未找到安装或有不兼容目标时返回非零退出码。
- 测试使用模拟 home 和独立数据库，pnpm 固定为 10.32.1。
- 扩展和 installer 版本统一为 0.1.0；版本提升同步 installer lockfile。
- 更新渠道指向 zhanglinrun/CCursor。installer 标记为私有包，避免发布成上游 npm 包。
- 上游监测比较已整合的上游基线版本，而非本 fork 的独立版本号。

## 验证与实际边界

统一入口：

```powershell
node scripts/verify.mjs
npm --prefix installer run build:all
node installer/dist/cli.cjs check
```

本次完成类型检查、ESLint、扩展全量测试、安装器回归测试、VSIX/CLI 构建及 Windows Cursor 3.27.12 的只读预检。扩展测试为 572 项通过，11 项按条件跳过；安装器测试包含补丁幂等性、版本同步、请求参数和预检行为。真实网络和指定旧版 bundle 的可选测试未代替实机验证。

未把 BYOK 补丁安装到正在运行的 Cursor，也未执行真实供应商调用或 SSH 工具端到端测试。预检读取安装文件，不修改它们。当前分支不承诺未来所有 Cursor 构建都可安装；每次升级后都必须重新预检。

#33 的 legacy 回退和 #38 的 `cursor.experimental.startupConnectTransport = false` 是已接受的兼容折衷。前者可能影响新 Agent Host 功能；后者需在卸载后手动删除覆盖项才能恢复 Cursor 默认设置。

## 日常修改

1. 新问题使用独立分支，先定位具体 Cursor 版本、provider、错误路径；日志分享前去除凭据与请求正文。
2. 安装器在 `installer/src/`，扩展与 Agent 服务在 `Cursor++/src/`，界面在 `Cursor++/src/ui/`。
3. 为行为修复补一个能暴露原问题的测试，先运行受影响测试，再运行统一验证。
4. 每个独立内容使用 `fix: ...`、`feat: ...`、`test: ...`、`chore: ...` 提交。`git log --first-parent --oneline` 可查看本分支整合步骤。
5. 需要换回某项源码修改时，用对应提交的 `git revert`，再验证和重建。恢复已安装的程序文件用本分支 installer 的 `uninstall`。

## 跟进上游

```powershell
git fetch https://github.com/CometixSpace/CCursor.git main:refs/remotes/upstream/main
git fetch https://github.com/Yoahoug/CCursor-BYOK.git main:refs/remotes/yoahoug/main
# 指定 PR 的例子
git fetch https://github.com/CometixSpace/CCursor.git refs/pull/38/head:refs/remotes/upstream/pr-38
```

先对照 `upstream-sources.json` 和目标提交差异，再选择合并或移植；不要覆盖整目录。整合后更新来源记录，特别检查模型协议、工具注册、压缩策略、更新地址和 installer 补丁是否互相覆盖。

## 本地构建与发布

- 首选 `npm --prefix installer run build:all`，它生成完整安装所需的本地目录结构，不安装、不发布。
- `node scripts/release.mjs --dry-run --local-only` 可验证仅扩展的多平台打包，不安装、不推送。
- `node scripts/release.mjs --local-only` 会修改本机扩展，不适合需要更新 installer 补丁的首次整合。
- release 脚本不带上述限制参数时会安装本机、打 tag、推送并创建 Release；只在明确要发布时使用。它要求发布分支为 main。
- 面板自动更新依赖本 fork 的 GitHub Release，且只替换 VSIX 扩展本体。需要更新程序补丁时仍须执行完整 installer。

构建、安装和公开发布是不同步骤。v0.1.2 通过 GitHub 正式 Release 分发 VSIX，供已安装本分支的面板更新使用；不发布 npm 包。
