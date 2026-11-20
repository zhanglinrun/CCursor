import { createHash } from 'crypto';
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
/** 内置扩展完整性哈希表在 extensionHostProcess.js 里的起始锚点 */
const VERIFY_MAP_NEEDLE = 'n3={';
/**
 * 内置扩展完整性校验同步。
 *
 * `extensionHostProcess.js` 里的 `n3` 保存每个内置扩展各文件的 sha256，扩展加载前逐个
 * 比对。我们改了 `cursor-always-local/dist/main.js` 却不改这张表，该扩展就会被判
 * 「Hash mismatch」拒绝激活 —— 而它正是注册 Connect transport、发 auth ready 信号的
 * 扩展：一旦不激活，插件市场、技能同步以及新窗口的首个 Agent 回合都会卡满 Cursor 的
 * 等待预算（实测 116~147 秒）。
 *
 * 这里只改被我们写入过的那几个文件的期望值，其余条目原样保留；找不到锚点就返回 null，
 * 由调用方跳过（不阻断路由注入）。
 */
export function prepareVerifiedHashUpdate(paths, writes, read) {
  if (!paths.extensionHostJs || !existsSync(paths.extensionHostJs)) return null;

  const targets = [];
  for (const { file, source } of writes) {
    const match = /[\\/]extensions[\\/]([^\\/]+)[\\/]dist[\\/](.+)$/i.exec(file);
    if (match) targets.push({ id: match[1], rel: match[2].replace(/\\/g, '/'), source });
  }
  if (targets.length === 0) return null;

  const original = read(paths.extensionHostJs);
  const mapStart = original.indexOf(VERIFY_MAP_NEEDLE);
  if (mapStart < 0) return null;

  let source = original;
  let updated = 0;
  for (const target of targets) {
    // 表里的 id 带 publisher 前缀（anysphere.cursor-always-local），只匹配尾部
    const entryAt = source.indexOf(`${target.id}":{dist:{`, mapStart);
    if (entryAt < 0) continue;
    const keyAt = source.indexOf(`"${target.rel}":"`, entryAt);
    if (keyAt < 0) continue;
    const hashStart = keyAt + `"${target.rel}":"`.length;
    const hashEnd = source.indexOf('"', hashStart);
    if (hashEnd < 0) continue;
    const current = source.slice(hashStart, hashEnd);
    if (!/^[0-9a-f]{64}$/.test(current)) continue;
    const nextHash = createHash('sha256').update(target.source).digest('hex');
    if (current === nextHash) continue;
    source = source.slice(0, hashStart) + nextHash + source.slice(hashEnd);
    updated++;
  }

  return updated > 0 ? source : null;
}

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

  // 内置扩展完整性校验：把我们改过的内置扩展文件的期望哈希同步进 n3，
  // 否则 cursor-always-local 会被判定 Hash mismatch 而拒绝激活。
  // 已打过补丁但本次无需再写的文件也要算进来（增量场景下 writes 里没有它）。
  const verifySources = new Map(writes.map(({ file, source }) => [file, source]));
  for (const file of [paths.alwaysLocalMain, paths.agentHostMain]) {
    if (file && existsSync(file) && !verifySources.has(file)) verifySources.set(file, readFileSync(file, 'utf-8'));
  }
  const verifiedBundles = prepareVerifiedHashUpdate(paths, [...verifySources].map(([file, source]) => ({ file, source })), read);
  if (verifiedBundles) addGroup('inject', [[paths.extensionHostJs, verifiedBundles]]);
  // 已有备份只在「本次要写新内容、且当前文件不是我们打的补丁」时才不可信：
  // 那说明备份和本机的补丁序列对不上。已带本项目补丁标记的文件属于增量更新
  // （例如给已安装的机器补一条新子补丁），旧备份仍是干净的原始件，可以复用。
  const OWN_MARKERS = ['CURSOR-BYOK-HOOK-START', 'byokAgentHostUrlRewrite', 'BYOK-AGENT-HOST-GATE-OFF'];
  const patchedByUs = file => OWN_MARKERS.some(marker => readFileSync(file, 'utf8').includes(marker));
  // product.json（校验和宿主）与 extensionHostProcess.js（内置扩展哈希表宿主）本身不带补丁
  // 标记，判断「补丁覆盖补丁」时排除它们；只剩这两个文件的写入也算增量更新。
  const metaFiles = new Set([paths.productJson, paths.extensionHostJs]);
  const patchWrites = writes.filter(({ file }) => !metaFiles.has(file));
  const updatingPatchedTree = writes.length > 0 && patchWrites.every(({ file }) => patchedByUs(file));
  for (const file of backupTargets) {
    if (!hasBackup(file)) continue;
    if (updatingPatchedTree) continue;
    if (writes.length === 0 && originals.has(file)) continue;
    throw new Error(`Existing backup for ${file} prevents safe application. Start from a clean copy of this Cursor build.`);
  }

  const unchanged = [...originals.keys()].filter(file => file !== paths.productJson && !planned.has(file));
  const checksumCheck = prepareChecksumUpdate(paths, read(paths.productJson), unchanged, undefined, read);
  if (checksumCheck.updated > 0) {
    const expected = JSON.parse(checksumCheck.source).checksums;
    const mismatch = Object.keys(expected).find(key => expected[key] !== product.checksums[key]);
    if (mismatch) throw new Error(`Checksum mismatch for ${mismatch}. Start from a clean copy of this Cursor build.`);
  }
  return { originals, writes, targets: [...planned.keys()], reuseBackups: updatingPatchedTree };
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
  const { originals, writes, targets, reuseBackups } = preflight();
  for (const file of targets) {
    if (readFileSync(file, 'utf-8') !== originals.get(file) || (hasBackup(file) && !reuseBackups)) {
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
