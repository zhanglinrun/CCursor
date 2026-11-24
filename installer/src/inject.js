import { createHash } from 'crypto';
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import * as acorn from 'acorn';
import { createBackup, hasBackup, restoreBackup } from './backup.js';
import { prepareChecksumUpdate } from './checksum.js';
import { findCursorPathsDetailed, formatDiagnostic } from './detect.js';
import { getAgentHostGateTargets, prepareAgentHostGatePatch } from './patch-agent-host-gate.js';
import { getAgentHostBackupTargets, hasAgentHost, prepareAgentHostPatch } from './patch-agent-host.js';
import { prepareAlwaysLocalRoutingPatch } from './patch-always-local.js';
import { prepareWorkbenchPatch } from './patch-inject.js';
import { getProxy39Target, needsProxy39Patch, prepareProxy39Patch } from './patch-proxy-39.js';

const info = message => console.log(`\x1b[34m[>]\x1b[0m ${message}`);
const VERIFY_USAGE_NEEDLE = 'checking expected hashes for';
const VERIFY_MISMATCH_NEEDLE = 'Hash mismatch for files:';
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export function hasVerifiedHashCheck(source) {
  return typeof source === 'string'
    && (source.includes(VERIFY_USAGE_NEEDLE) || source.includes(VERIFY_MISMATCH_NEEDLE));
}

function propertyKeyName(prop) {
  if (!prop || prop.type !== 'Property' || prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

function findObjectProperty(objNode, matcher) {
  if (!objNode || objNode.type !== 'ObjectExpression') return null;
  for (const prop of objNode.properties) {
    const key = propertyKeyName(prop);
    if (key !== null && matcher(key)) return prop;
  }
  return null;
}

function hasAnySha256Leaf(node) {
  if (!node) return false;
  if (node.type === 'Literal') return typeof node.value === 'string' && SHA256_HEX_RE.test(node.value);
  if (node.type === 'ObjectExpression') return node.properties.some(prop => prop.type === 'Property' && hasAnySha256Leaf(prop.value));
  return false;
}

function parseVerifiedHashMapAt(source, braceOffset) {
  if (braceOffset < 0 || source[braceOffset] !== '{') return null;
  let node;
  try {
    node = acorn.parseExpressionAt(source, braceOffset, { ecmaVersion: 'latest', sourceType: 'script' });
  }
  catch {
    return null;
  }
  if (!node || node.type !== 'ObjectExpression' || node.properties.length === 0) return null;
  const looksLikeHashMap = node.properties.some((prop) => {
    const extId = propertyKeyName(prop);
    if (!extId || !extId.includes('.') || prop.value?.type !== 'ObjectExpression') return false;
    const distProp = findObjectProperty(prop.value, key => key === 'dist');
    return Boolean(distProp && hasAnySha256Leaf(distProp.value));
  });
  return looksLikeHashMap ? node : null;
}

/**
 * 定位 extensionHostProcess.js 中的内置扩展完整性哈希表（不依赖混淆变量名）。
 *
 * 1. 优先从 `checking expected hashes for` 日志使用点反推变量名（如 n3 / s3），
 *    再向上查找该变量的 `={...}` 对象字面量并通过 acorn 校验 AST 结构；
 * 2. 回退直接按 `"anysphere.cursor-always-local":{dist:{` 等条目结构反找外层对象。
 */
export function locateVerifiedHashMap(source) {
  const usageAt = source.indexOf(VERIFY_USAGE_NEEDLE);
  if (usageAt >= 0) {
    const before = source.slice(Math.max(0, usageAt - 300), usageAt);
    const varNames = new Set();
    for (const match of before.matchAll(/\bin\s+([A-Za-z_$][\w$]*)\)/g)) varNames.add(match[1]);
    for (const match of before.matchAll(/=\s*([A-Za-z_$][\w$]*)\[/g)) varNames.add(match[1]);

    for (const varName of varNames) {
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const assignRe = new RegExp(`(?:^|[\\s,;])(?:(?:var|let|const)\\s+)?${escaped}\\s*=\\s*\\{`, 'g');
      const candidates = [];
      for (const match of source.matchAll(assignRe)) {
        candidates.push(match.index + match[0].length - 1);
      }
      // 优先检查位于使用点之前且离得最近的声明，再检查全文件
      candidates.sort((a, b) => {
        const aBefore = a < usageAt ? 0 : 1;
        const bBefore = b < usageAt ? 0 : 1;
        if (aBefore !== bBefore) return aBefore - bBefore;
        return Math.abs(usageAt - a) - Math.abs(usageAt - b);
      });
      for (const braceAt of candidates) {
        const parsed = parseVerifiedHashMapAt(source, braceAt);
        if (parsed) return parsed;
      }
    }
  }

  // 结构回退：直接寻找带 dist 的内置扩展条目，再反查其外层 `={` 对象起点
  const entryRe = /["'][^"']+\.(?:cursor-always-local|[a-z0-9-]+)["']\s*:\s*\{\s*["']?dist["']?\s*:\s*\{/gi;
  const entryOffsets = [];
  for (const match of source.matchAll(entryRe)) {
    const isAlwaysLocal = match[0].includes('cursor-always-local');
    entryOffsets.push({ offset: match.index, priority: isAlwaysLocal ? 0 : 1 });
    if (entryOffsets.length >= 20) break;
  }
  entryOffsets.sort((a, b) => a.priority - b.priority);

  const tried = new Set();
  for (const { offset } of entryOffsets) {
    const windowStart = Math.max(0, offset - 32768);
    const slice = source.slice(windowStart, offset);
    const openRe = /=\s*\{/g;
    const opens = [];
    for (const m of slice.matchAll(openRe)) {
      opens.push(windowStart + m.index + m[0].length - 1);
    }
    for (let i = opens.length - 1; i >= 0; i--) {
      const braceAt = opens[i];
      if (tried.has(braceAt)) continue;
      tried.add(braceAt);
      const parsed = parseVerifiedHashMapAt(source, braceAt);
      if (parsed && parsed.start <= offset && offset < parsed.end) return parsed;
    }
  }

  return null;
}

function findExtensionEntryInMap(mapNode, extId) {
  return findObjectProperty(mapNode, key => key === extId || key.endsWith(`.${extId}`));
}

function findDistHashLeaf(extEntryNode, relPath) {
  const segments = ['dist', ...relPath.split('/').filter(Boolean)];
  let current = extEntryNode.value;
  for (const seg of segments) {
    const prop = findObjectProperty(current, key => key === seg);
    if (!prop) return null;
    current = prop.value;
  }
  if (!current || current.type !== 'Literal' || typeof current.value !== 'string' || !SHA256_HEX_RE.test(current.value)) {
    return null;
  }
  return { node: current, hash: current.value };
}

function collectExtensionTargets(writes) {
  const targets = [];
  for (const { file, source } of writes) {
    const match = /[\\/]extensions[\\/]([^\\/]+)[\\/]dist[\\/](.+)$/i.exec(file);
    if (match) targets.push({ id: match[1], rel: match[2].replace(/\\/g, '/'), source });
  }
  return targets;
}

/**
 * 内置扩展完整性校验同步。
 *
 * `extensionHostProcess.js` 里保存了内置扩展各 dist 文件的 sha256，扩展加载前逐个比对。
 * 我们改了 `cursor-always-local/dist/main.js` 却不改这张表，该扩展就会被判
 * 「Hash mismatch」拒绝激活 —— 而它正是注册 Connect transport、发 auth ready 信号的
 * 扩展：一旦不激活，模型列表刷新、插件市场以及新窗口的首个 Agent 回合都会受阻。
 *
 * 这里通过语义定位 + AST 精确改写被我们写入过的文件哈希（不依赖混淆变量名）；
 * 若目标版本不存在完整性校验则跳过；若存在校验却找不到哈希表则显式报错，避免静默失效。
 */
export function prepareVerifiedHashUpdate(paths, writes, read) {
  if (!paths.extensionHostJs || !existsSync(paths.extensionHostJs)) return null;

  const targets = collectExtensionTargets(writes);
  if (targets.length === 0) return null;

  const original = read(paths.extensionHostJs);
  const mapNode = locateVerifiedHashMap(original);
  if (!mapNode) {
    if (hasVerifiedHashCheck(original)) {
      throw new Error('Built-in extension verification hash map not found in extensionHostProcess.js');
    }
    return null;
  }

  const edits = [];
  for (const target of targets) {
    const entry = findExtensionEntryInMap(mapNode, target.id);
    if (!entry) continue;
    const leaf = findDistHashLeaf(entry, target.rel);
    if (!leaf) {
      throw new Error(`Built-in extension hash entry not found for ${target.id}/dist/${target.rel}`);
    }
    const nextHash = createHash('sha256').update(target.source).digest('hex');
    if (leaf.hash === nextHash) continue;
    edits.push({ start: leaf.node.start + 1, end: leaf.node.end - 1, nextHash });
  }

  if (edits.length === 0) return null;
  edits.sort((a, b) => b.start - a.start);
  let source = original;
  for (const edit of edits) {
    source = source.slice(0, edit.start) + edit.nextHash + source.slice(edit.end);
  }
  return source;
}

/** status 用：检查 extensionHostProcess.js 内置扩展哈希表是否与磁盘上的补丁文件一致 */
export function inspectVerifiedHashSync(paths) {
  if (!paths.extensionHostJs || !existsSync(paths.extensionHostJs)) {
    return { present: false, hasCheck: false, synced: true, mismatched: [], error: null };
  }
  const source = readFileSync(paths.extensionHostJs, 'utf-8');
  const hasCheck = hasVerifiedHashCheck(source);
  const mapNode = locateVerifiedHashMap(source);
  if (!mapNode) {
    return {
      present: true,
      hasCheck,
      synced: !hasCheck,
      mismatched: [],
      error: hasCheck ? 'verification hash map not found' : null,
    };
  }

  const candidateFiles = [paths.alwaysLocalMain, paths.agentHostMain].filter(file => file && existsSync(file));
  const targets = collectExtensionTargets(candidateFiles.map(file => ({ file, source: readFileSync(file, 'utf-8') })));
  const mismatched = [];
  for (const target of targets) {
    const entry = findExtensionEntryInMap(mapNode, target.id);
    if (!entry) continue;
    const leaf = findDistHashLeaf(entry, target.rel);
    const actualHash = createHash('sha256').update(target.source).digest('hex');
    if (!leaf || leaf.hash !== actualHash) {
      mismatched.push(`${target.id}/dist/${target.rel}`);
    }
  }
  return { present: true, hasCheck: true, synced: mismatched.length === 0, mismatched, error: null };
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
    ...originals.keys(), paths.glassJs, paths.extensionHostJs, singleton, ...getAgentHostBackupTargets(paths),
  ]);

  // 内置扩展完整性校验：把我们改过的内置扩展文件的期望哈希同步进哈希表，
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
  const OWN_MARKERS = [
    'CURSOR-BYOK-HOOK-START',
    'byokAgentHostUrlRewrite',
    '__byokUrlRewrite',
    '__byokSingletonUrlRewrite',
    'BYOK-HTTP11-ROUTER-',
    'BYOK-AGENT-HOST-GATE-OFF',
  ];
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
