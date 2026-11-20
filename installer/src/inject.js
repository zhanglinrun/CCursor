import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { createBackup, hasBackup, restoreBackup } from './backup.js';
import { prepareChecksumUpdate } from './checksum.js';
import { findCursorPathsDetailed, formatDiagnostic } from './detect.js';
import { getAgentHostGateTargets, prepareAgentHostGatePatch } from './patch-agent-host-gate.js';
import { getAgentHostBackupTargets, hasAgentHost, prepareAgentHostPatch } from './patch-agent-host.js';
import { prepareAlwaysLocalRoutingPatch } from './patch-always-local.js';
import { prepareWorkbenchPatch } from './patch-inject.js';
import { getProxy39Target, needsProxy39Patch, prepareProxy39Patch } from './patch-proxy-39.js';

const info = message => console.log(`\x1b[34m[>]\x1b[0m ${message}`);

function prepareRoutingPatches(paths) {
  const originals = new Map();
  const read = file => {
    if (!originals.has(file)) originals.set(file, readFileSync(file, 'utf-8'));
    return originals.get(file);
  };
  const product = JSON.parse(read(paths.productJson));
  if (!product || typeof product !== 'object' || Array.isArray(product)
      || (product.checksums != null && (typeof product.checksums !== 'object' || Array.isArray(product.checksums)))) {
    throw new Error('Unexpected product.json checksum format');
  }

  const writes = [];
  const planned = new Map();
  const current = file => planned.get(file) ?? read(file);
  // Keep the legacy tag order so its uninstaller can restore each checksum snapshot.
  const addGroup = (tag, candidates) => {
    const modified = [];
    for (const [file, source] of candidates) {
      if (source === current(file)) continue;
      modified.push(file);
      planned.set(file, source);
      writes.push({ file, source, tag });
    }
    if (modified.length === 0) return;
    const original = current(paths.productJson);
    const { source } = prepareChecksumUpdate(paths, original, modified, undefined, current);
    if (source === original) return;
    planned.set(paths.productJson, source);
    writes.push({ file: paths.productJson, source, tag });
  };

  const workbenches = getAgentHostGateTargets(paths)
    .filter(({ path, label }) => label === 'desktop' || existsSync(path));
  addGroup('inject', workbenches.map(({ path, label }) =>
    [path, prepareWorkbenchPatch(read(path), label, paths, undefined, { routingOnly: true })]));

  const legacySource = read(paths.alwaysLocalMain);
  addGroup('always-local', [[paths.alwaysLocalMain, prepareAlwaysLocalRoutingPatch(legacySource)]]);

  if (hasAgentHost(paths)) {
    const { originalByFile, patchedByFile } = prepareAgentHostPatch(paths);
    for (const [file, source] of originalByFile) originals.set(file, source);
    addGroup('agent-host', patchedByFile);
  }

  const singleton = getProxy39Target(paths);
  if (needsProxy39Patch(paths)) {
    const source = prepareProxy39Patch(read(singleton), paths.cursorVersion);
    if (source === null) throw new Error(`Unsupported singleton HTTP/1.1 transport in ${singleton}`);
    addGroup('proxy-39', [[singleton, source]]);
  }

  addGroup('agent-host-gate', workbenches.map(({ path, label }) =>
    [path, prepareAgentHostGatePatch(current(path), label).source]));

  const backupTargets = new Set([
    ...originals.keys(), paths.glassJs, singleton, ...getAgentHostBackupTargets(paths),
  ]);
  // Tagged backups belong to a specific app build and patch sequence. Reusing
  // them for a different or partially updated tree can restore obsolete files.
  for (const file of backupTargets) {
    if ((writes.length > 0 || !originals.has(file)) && hasBackup(file)) {
      throw new Error(`Existing backup for ${file} prevents safe application. Start from a clean copy of this Cursor build.`);
    }
  }

  const unchanged = [...originals.keys()].filter(file => file !== paths.productJson && !planned.has(file));
  const checksumCheck = prepareChecksumUpdate(paths, read(paths.productJson), unchanged, undefined, read);
  if (checksumCheck.updated > 0) {
    const expected = JSON.parse(checksumCheck.source).checksums;
    const mismatch = Object.keys(expected).find(key => expected[key] !== product.checksums[key]);
    if (mismatch) throw new Error(`Checksum mismatch for ${mismatch}. Start from a clean copy of this Cursor build.`);
  }

  return { originals, writes, targets: [...planned.keys()] };
}

function preflight() {
  const { paths, diagnostic } = findCursorPathsDetailed();
  if (!paths) {
    console.log(formatDiagnostic(diagnostic));
    throw new Error('Cursor installation not found');
  }
  info(`Cursor ${paths.cursorVersion} at ${paths.appRoot}`);
  return prepareRoutingPatches(paths);
}

export async function checkRouting() {
  const { targets } = preflight();
  const count = targets.length;
  info(count ? `Routing preflight passed. ${count} file(s) would change.` : 'Routing preflight passed. Routing patches are current.');
}

export async function inject() {
  const { originals, writes, targets } = preflight();
  for (const file of targets) {
    if (readFileSync(file, 'utf-8') !== originals.get(file) || hasBackup(file)) {
      throw new Error(`File or backups changed during preflight: ${file}`);
    }
    accessSync(file, constants.W_OK);
    accessSync(dirname(file), constants.W_OK);
  }

  const backedUp = [];
  try {
    for (const { file, source, tag } of writes) {
      createBackup(file, tag, info);
      backedUp.push({ file, tag });
      writeFileSync(file, source);
    }
  } catch (error) {
    const failed = [];
    for (const { file, tag } of backedUp.reverse()) {
      try {
        if (!restoreBackup(file, tag, info)) failed.push(file);
      } catch (restoreError) {
        failed.push(restoreError.message);
      }
    }
    const rollback = failed.length ? ` Rollback failed for ${failed.join(', ')}.` : '';
    throw new Error(`Applying routing patches failed. ${error.message}${rollback}`, { cause: error });
  }

  info(targets.length ? `Routing patches applied to ${targets.length} file(s). Restart Cursor.` : 'Routing patches are current.');
}
