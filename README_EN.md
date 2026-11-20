# CCursor (Cursor++) — Bring Your Own Key for Cursor

Use **your own LLM API keys** in [Cursor IDE](https://cursor.com) — Anthropic, OpenAI, Google Gemini, or any OpenAI-compatible endpoint — while keeping Cursor's full Agent experience. A local BYOK server runs inside Cursor's extension host, intercepts ConnectRPC/REST traffic, and routes LLM requests to your configured providers. Toggle back to your official Cursor subscription at any time.

[中文](README.md) · [Changelog](CHANGELOG.md) · [Integration notes](docs/INTEGRATION.md)

Current version **0.1.8** · Maintained at **zhanglinrun/CCursor** · License AGPL-3.0-or-later

## Features

**Core BYOK**

- **One-click mode switch** — status-bar button in IDE windows and a sidebar button in the Agent window; requests are idempotent, so a double-fired click can no longer flip the toggle twice. Switching back to OFF restores Cursor's official behavior untouched (including its local-loop turn routing).
- **Multi-provider** — Anthropic, OpenAI (Chat + Responses API), Google Gemini, and any OpenAI-compatible endpoint; protocol, base URL and API key are configured per model.
- **Hot reload** — provider/model changes take effect without restarting Cursor.

**Agent experience**

- **Full agent mode** — 22+ built-in tools (Shell, Read, Grep, Glob, Write, Edit, ApplyPatch, WebSearch, WebFetch, TodoWrite, …), MCP servers, and dynamic tool discovery (`GetDynamicTools`) with large results spilled to a file on the workspace machine — including Remote-SSH/WSL windows, where the file is written by the client, not the server.
- **Subagents & Goal tool** — parallel Task subagents and a Goal tool for long-running, outcome-driven work; version-aware server ownership keeps multi-window setups consistent.
- **Context compaction** — soft/hard budgets reserve output headroom, trigger a summary at 90% of the safe budget, and only block requests at the hard limit (e.g. 855K/950K for a 1M window with 32K output). Checkpoints persist across turns; failed summaries never replace history with a text excerpt.
- **Native error banner** — provider errors surface as Cursor's retry banner with retryable/non-retryable classification.

**Model management**

- **Visual config UI** — Chinese-localized sidebar panel for providers and models, with a model catalog (models.dev) snapshot bundled offline. Click **Fetch**, pick an endpoint model, and display name, protocol, capabilities, context/output limits, thinking level and quick-switch defaults fill in automatically; manual edits always win after **Save**.
- **Usage dashboard** — per-window token and cache statistics.
- **Update channel** — the panel's **check for extension updates** downloads the latest stable Release from this repository and replaces the extension body.

**Window & remote compatibility**

- **Agent Window (glass) support** — ConnectRPC calls in the Agent window are routed at the renderer level to the local BYOK server, with the official transport kept as fallback.
- **Remote SSH / WSL / Dev Containers** — a topology guard keeps the agent host on Cursor's legacy path in remote windows when BYOK is on, so it can reach the local service.
- **Route freshness** — routing rules reload on demand from `routes.json` before each decision, so the first requests after a BYOK toggle already use the new rules.

## Install and update

**Install Cursor++ using Cursor’s “Install from VSIX” command.** The user-installed extension and your existing `~/.ccursor` configuration persist across Cursor upgrades. The full ZIP includes the standalone CLI.

Before first using BYOK or after a Cursor upgrade, open Cursor++ in a regular editor window, click **Reinject** (重新注入), and confirm the restart. The extension waits for Cursor to quit, checks compatibility, applies the routing patches, and reopens Cursor. The same action is available in Advanced Settings or the command palette.

For standalone maintenance, close Cursor and run `node installer/dist/cli.cjs check --routing-only` for read-only preflight or `node installer/dist/cli.cjs inject` to restore the routes.

The legacy bundled installation still supports `check`, `install`, `update`, `status`, and `uninstall`. To migrate, run `uninstall` with the installer and Cursor version matching the existing bundled installation, then install the VSIX and run `inject`. Both installation methods read providers, models, and routes from `~/.ccursor`.
Open the standard VSIX settings panel from a regular editor window.


Download the latest release: <https://github.com/zhanglinrun/CCursor/releases/latest> — do not use `npx @cometix/ccursor`, which installs the upstream distribution and replaces this fork.

## Build from source

Requires **Node.js 22+** and pnpm **10.32.1** (pinned in `Cursor++/package.json`), plus an installed Cursor for the SQLite integration tests:

```sh
cd Cursor++ && pnpm install --frozen-lockfile
cd ../installer && npm ci && cd ..
node scripts/verify.mjs                 # types, lint, extension + installer tests, version sync
npm --prefix installer run build:all    # builds installer/dist/cli.cjs + vsix
node installer/dist/cli.cjs check
```

Tests run against synthetic homes under `Temp/tests`, never your real BYOK configuration. For custom Cursor locations, point `CURSOR_APP_ROOT` (tests) and `CCURSOR_CURSOR_ROOT` (installer) at Cursor's `resources/app`.

## Context compaction and model catalog in detail

- Compaction checks before every model request — new prompts, tool results and schemas included. A failed soft-trigger summary keeps the history intact and the session may continue below the hard limit. Oversized summary input is summarized in bounded chunks; empty/truncated summaries are never committed, and a local text excerpt is never passed off as a summary.
- Opening the panel or fetching available models refreshes a catalog more than an hour old in the background. Manual refresh stays available, and failures keep the last successful snapshot. **Fetch** lists the provider's current models and can fill in token limits reported by the provider before the catalog includes them. The wire model ID is preserved. Refresh the bundled snapshot with `node installer/scripts/update-models-catalog.mjs` before rebuilding.

## Remote workspaces: what to verify

The preflight verifies bundle compatibility, not a live remote session. Before relying on a remote workspace, confirm hostname/current directory, remote-only file read/edit, shell execution, cancellation and subagent file access — not just chat replies. Two accepted trade-offs remain: the legacy agent-host fallback may leave some Agent-Host-only features unavailable while patched, and BYOK-on writes `cursor.experimental.startupConnectTransport = false`; uninstalling does not restore that setting — remove the override manually if you want Cursor's default back. Upgrading from an old server owner requires closing every Cursor window once.

## Attribution and license

Based on [CometixSpace/CCursor](https://github.com/CometixSpace/CCursor) with enhancements from [Yoahoug/CCursor-BYOK](https://github.com/Yoahoug/CCursor-BYOK); this fork adds further fixes and features. Exact source revisions are recorded in [upstream-sources.json](upstream-sources.json), the merge history in [docs/INTEGRATION.md](docs/INTEGRATION.md). Licensed under **AGPL-3.0-or-later**; see [LICENSE](LICENSE). The archived upstream README ([EN](README_UPSTREAM.md) / [中文](README_UPSTREAM_CN.md)) describes an older upstream release and may contain stale facts.
