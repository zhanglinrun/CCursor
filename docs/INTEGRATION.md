# 整合与维护记录

本分支以 CometixSpace/CCursor `fcac85d`（0.0.15）为基线，维护目标是自用 BYOK、Remote SSH 和新版 Cursor 的兼容性。当前开发版本为 0.1.0。

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

构建、安装和公开发布是不同步骤。当前仅完成本地源码提交与构建，没有创建远程 Release 或 npm 发布。
