# CCursor maintained installer

Build from the repository root:

```sh
npm --prefix installer ci
npm --prefix installer run build:all
node installer/dist/cli.cjs check
```

Install extension dependencies in `Cursor++` first. Stop if preflight fails. Fully close Cursor before running `install`, `update` or `uninstall` with this CLI.

Keep `dist/`, `vsix/` and the installed dependencies together. Panel/VSIX-only updates do not update Cursor application patches. The upstream npm package installs the upstream version, not this fork.

Remote SSH uses the legacy Agent Host fallback from PR #33. Read [the maintenance record](../docs/INTEGRATION.md) for compatibility limits and the startup transport setting that requires manual restoration.
