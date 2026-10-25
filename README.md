# CCursor — maintained BYOK fork

[中文](README_CN.md) · [Integration and maintenance](docs/INTEGRATION.md) · [Changelog](CHANGELOG.md)

An independently maintained fork of [CometixSpace/CCursor](https://github.com/CometixSpace/CCursor), incorporating [Yoahoug/CCursor-BYOK](https://github.com/Yoahoug/CCursor-BYOK) enhancements and selected upstream compatibility fixes. Development version: **0.1.0**. This is not an official CometixSpace or Yoahoug distribution.

## Included

- Yoahoug's changes through `0.0.26`: search/fetch fixes, custom search endpoints, per-model protocols and probing, usage/cache statistics, UI improvements, performance fixes and local development tools.
- PR #31: extensionless ConnectRPC installation anchors.
- PR #33: legacy Agent Host fallback for Remote SSH.
- PR #38: local model refresh, HTTP routing, Auto/default resolution and connect turn routing.
- PR #30: Goal tools and version-aware server ownership across windows.
- PR #35: repeated compaction during long tool chains.
- PR #18 and #17: consistent enabled-model selection and escaped Canvas exports.
- Integration fixes and regression tests for disabled Auto models, fetch Request overrides, patch identification and incompatible preflight exit codes.

Exact source revisions are recorded in [upstream-sources.json](upstream-sources.json). The Yoahoug history is preserved in Git.

## Build and verify

Requires **Node.js 22+**, pnpm **10.32.1**, and an installed Cursor for the SQLite integration tests. `Cursor++/package.json` pins pnpm. Run from the repository root:

```sh
cd Cursor++
pnpm install --frozen-lockfile
cd ../installer
npm ci
cd ..
node scripts/verify.mjs
npm --prefix installer run build:all
node installer/dist/cli.cjs check
```

Verification uses `Temp/tests` and synthetic test homes, not your normal BYOK configuration. Set `CURSOR_APP_ROOT` for tests if Cursor is installed in a custom location. Set `CCURSOR_CURSOR_ROOT` for installer detection; both values point to `resources/app`.

Build outputs:

- `installer/dist/cli.cjs` and its sibling `models-catalog.json`.
- `installer/vsix/cursor2plus-0.1.0.vsix`.

Keep the installer directory layout intact. The CLI requires its local dependencies and the sibling `vsix` directory.

## Install and update

**First run `check`; stop if it reports a mismatch. Fully exit all Cursor windows before installation or update.**

```sh
node installer/dist/cli.cjs install
# Existing installation: restore old patches, then install the current build
node installer/dist/cli.cjs update
node installer/dist/cli.cjs status
```

Run only the command appropriate to your installation. To restore the application files:

```sh
node installer/dist/cli.cjs uninstall
```

Dragging a VSIX into Cursor does not apply the required application patches. Panel updates replace the extension body only; changes under `installer/src/` require rebuilding and running the installer. After each Cursor update, rebuild if necessary and repeat `check` and installation/update.

The update channel now points to **zhanglinrun/CCursor**. Until this fork publishes its own Release, build from source. `npx @cometix/ccursor` installs the upstream distribution and replaces this fork.

## Context compaction and model catalog

- Compaction follows PI-Desktop `7a95fd0`'s soft/hard budgets: reserve output/prompt headroom, try at 90% of the safe budget, and block ordinary requests only at the hard limit. With a 1M window and 32K output budget, the trigger/hard limit are **855K/950K**; with 64K output they are **842.4K/936K**.
- Check before every model request, including new prompts, tool results and schemas. A failed soft-trigger summary preserves history and may continue below the hard limit. Oversized summary input is summarized in bounded chunks; failed/empty/truncated summaries are never replaced with a local text excerpt.
- The model catalog uses `https://models.dev/api.json`, with manual refresh and a bundled offline fallback. Click **Fetch** and select an available endpoint model: name, protocol, capabilities, token limits, reasoning and quick-switch defaults fill automatically, without a second catalog picker. The wire model id stays unchanged and Fast stays off. Changing the model reapplies defaults; manual edits remain available and **Save** is required. Unknown/ambiguous models require manual limits rather than fuzzy guesses; address and API keys stay untouched.
- Refresh the build snapshot with `node installer/scripts/update-models-catalog.mjs`, then rebuild. This does not touch user configuration.

For development GitHub queries, use `pwsh -File scripts/github-api.ps1 -Endpoint repos/vastsa/PI-Desktop` or authenticated `gh api`. The script runs GET only, reuses the system proxy and existing login, and never stores tokens or changes global settings. Raw HTTP does not reuse the CLI login (anonymous: 60/hour; authenticated REST normally: 5000/hour).

## Remote SSH and verification limits

The current branch passed a read-only patch preflight against **Windows Cursor 3.27.12**. This verifies bundle compatibility, not a live SSH Agent session. The earlier local 3.15.19 build lacked the glass refresh anchor and is rejected by preflight.

- PR #33 forces the legacy Agent Host path; Agent Host-specific features may be unavailable. This also affects official mode while the patch remains installed.
- PR #38 writes `cursor.experimental.startupConnectTransport = false`; uninstall does not restore that setting. Remove your override manually if you want Cursor's default again.
- Before relying on a remote workspace, verify hostname/current directory, remote-only file read/edit, shell execution, cancellation and subagent file access.
- The first upgrade from an old server owner requires closing every Cursor window once.

See [the maintenance record](docs/INTEGRATION.md) for checks, source updates and rollback guidance. No release or npm package has been published as part of this integration.

## Attribution and license

Original project: CometixSpace. Enhancement fork: Yoahoug. Additional fixes retain their PR attribution and source revisions. Licensed under **AGPL-3.0-or-later**; see [LICENSE](LICENSE). [Archived upstream documentation](README_UPSTREAM.md) describes the older upstream release and may contain stale facts.
