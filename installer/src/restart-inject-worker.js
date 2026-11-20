import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  accessSync, constants, readFileSync, readdirSync, readlinkSync, realpathSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize, relative, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { inject } from './inject.js';

const execFileAsync = promisify(execFile);
const windows = process.platform === 'win32';
const mac = process.platform === 'darwin';
const pollInterval = 500;

function pathKey(path) {
  const normalized = normalize(path);
  return windows ? normalized.toLowerCase() : normalized;
}

function resolveExecutable(path) {
  if (!statSync(path).isFile()) throw new Error(`Cursor executable is not a file: ${path}`);
  accessSync(path, constants.X_OK);
  return realpathSync.native(path);
}

function isInside(directory, path) {
  const suffix = relative(directory, path);
  return Boolean(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

// Pass names as data so Windows never parses either input path as PowerShell code.
const windowsQuery = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$processes = @(Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -ieq $env:CCURSOR_IMAGE_NAME -or $_.Name -ieq $env:CCURSOR_REAL_IMAGE_NAME) -and
  $_.CommandLine -notmatch '--type=crashpad-handler'
} | Select-Object ProcessId, ExecutablePath)
ConvertTo-Json -Compress -InputObject $processes
`;

async function windowsHasCursor(executable, canonical, options) {
  const powershell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await execFileAsync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsQuery], {
    ...options,
    env: { ...process.env, CCURSOR_IMAGE_NAME: basename(executable), CCURSOR_REAL_IMAGE_NAME: basename(canonical) },
  });
  const processes = JSON.parse(stdout);
  if (!Array.isArray(processes)) throw new Error('Unexpected Windows process list');
  return processes.some(({ ProcessId, ExecutablePath }) => {
    if (ProcessId === process.pid) return false;
    // A different user or an elevated process can hide its executable path.
    if (!ExecutablePath || !isAbsolute(ExecutablePath)) return true;
    if (pathKey(ExecutablePath) === pathKey(executable) || pathKey(ExecutablePath) === pathKey(canonical)) return true;
    try {
      return pathKey(realpathSync.native(ExecutablePath)) === pathKey(canonical);
    } catch {
      return false;
    }
  });
}

async function macHasCursor(executable, canonical, options) {
  const { stdout } = await execFileAsync('/bin/ps', ['-axww', '-o', 'pid=', '-o', 'comm='], options);
  const contents = [executable, canonical].map(path => dirname(dirname(path)));
  const names = [basename(executable), basename(canonical)];
  return stdout.trimEnd().split('\n').some(line => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    if (!match) throw new Error('Unexpected macOS process list');
    const [, pid, command] = match;
    if (Number(pid) === process.pid) return false;
    if (isAbsolute(command)) return contents.some(path => isInside(path, command));
    const name = basename(command.replace(/^\((.*)\)$/, '$1'));
    // Helpers outlive the app process; only the app itself counts as running.
    return names.some(image => name === image)
  });
}

function linuxHasCursor(canonical) {
  const processes = readdirSync('/proc', { withFileTypes: true });
  const imageName = basename(canonical).slice(0, 15);
  return processes.some(({ name }) => {
    if (!/^\d+$/.test(name) || Number(name) === process.pid) return false;
    try {
      const image = readlinkSync(`/proc/${name}/exe`).replace(/ \(deleted\)$/, '');
      return image === canonical;
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ESRCH') return false;
      if (error.code !== 'EACCES' && error.code !== 'EPERM') throw error;
      try {
        return readFileSync(`/proc/${name}/comm`, 'utf8').trimEnd() === imageName;
      } catch (commError) {
        if (commError.code === 'ENOENT' || commError.code === 'ESRCH') return false;
        throw commError;
      }
    }
  });
}

async function hasCursor(executable, canonical) {
  const options = { timeout: 10_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true };
  if (windows) return windowsHasCursor(executable, canonical, options);
  if (mac) return macHasCursor(executable, canonical, options);
  if (process.platform === 'linux') return linuxHasCursor(canonical);
  throw new Error(`Unsupported platform: ${process.platform}`);
}

async function waitForCursorExit(executable, canonical, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  let wasIdle = false;
  while (performance.now() < deadline) {
    let running;
    try {
      running = await hasCursor(executable, canonical);
    } catch (error) {
      if (performance.now() >= deadline) break;
      throw new Error(`Could not verify that Cursor closed. ${error.message}`);
    }
    if (performance.now() >= deadline) break;
    if (!running && wasIdle) return;
    wasIdle = !running;
    await delay(Math.min(pollInterval, Math.max(0, deadline - performance.now())));
  }
  throw new Error('等待 Cursor 退出超时。若出现「确定要退出吗？」提示，请选择「退出」后重试。');
}

function writeResult(jobPath, result) {
  const temp = `${jobPath}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(result), { flag: 'wx', mode: 0o600 });
  try {
    renameSync(temp, jobPath);
  } finally {
    rmSync(temp, { force: true });
  }
}

async function applyRouting(appRoot, executable, canonical) {
  if (pathKey(resolveExecutable(executable)) !== pathKey(canonical)) {
    throw new Error('The Cursor executable changed locations while waiting for Cursor to close.');
  }
  const expectedRoot = mac
    ? join(dirname(dirname(canonical)), 'Resources', 'app')
    : join(dirname(canonical), 'resources', 'app');
  const root = realpathSync.native(appRoot);
  if (pathKey(root) !== pathKey(realpathSync.native(expectedRoot))) {
    throw new Error('Cursor application root and executable refer to different installations.');
  }

  const previousRoot = process.env.CCURSOR_CURSOR_ROOT;
  process.env.CCURSOR_CURSOR_ROOT = root;
  try {
    await inject();
  } finally {
    if (previousRoot === undefined) delete process.env.CCURSOR_CURSOR_ROOT;
    else process.env.CCURSOR_CURSOR_ROOT = previousRoot;
  }
}

async function restartCursor(executable, canonical, launchArgs) {
  if (pathKey(resolveExecutable(executable)) !== pathKey(canonical)) {
    throw new Error('The Cursor executable now points to a different installation.');
  }
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !/^(?:ELECTRON_|VSCODE_|NODE_CHANNEL_FD$|NODE_CHANNEL_SERIALIZATION_MODE$)/i.test(key)));
  const child = spawn(executable, launchArgs, { cwd: dirname(executable), detached: true, stdio: 'ignore', env });
  await once(child, 'spawn');
  child.unref();
}

export async function runRestartInject([appRoot, executable, jobPath, restartArgs], { timeoutMs = 180_000 } = {}) {
  if (!isAbsolute(jobPath ?? '') || JSON.parse(readFileSync(jobPath, 'utf8')).status !== 'pending') {
    throw new Error('The restart worker requires an existing pending job.');
  }
  const launchArgs = restartArgs ? JSON.parse(restartArgs) : [];
  if (!Array.isArray(launchArgs) || launchArgs.some(arg => typeof arg !== 'string' || !arg.startsWith('--')))
    throw new Error('The restart arguments must be an array of options.');
  let canonical;
  try {
    if (!isAbsolute(appRoot ?? '') || !isAbsolute(executable ?? '')) {
      throw new Error('The Cursor application root and executable must be absolute paths.');
    }
    canonical = resolveExecutable(executable);
    await waitForCursorExit(executable, canonical, timeoutMs);
  } catch (error) {
    writeResult(jobPath, { status: 'error', message: error.message });
    // A quit that already completed must not leave the user without a window.
    try {
      if (canonical && !await hasCursor(executable, canonical)) await restartCursor(executable, canonical, launchArgs);
    } catch {}
    return 1;
  }

  let result;
  try {
    await applyRouting(appRoot, executable, canonical);
    result = { status: 'success', message: 'Cursor++ 路由补丁已就绪。' };
  } catch (error) {
    result = { status: 'error', message: error.message };
  }
  // Publish before launching so the resumed extension can read the result during activation.
  try {
    writeResult(jobPath, result);
  } finally {
    try {
      await restartCursor(executable, canonical, launchArgs)
    } catch (error) {
      result = { status: 'error', message: `${result.message} Could not restart Cursor. ${error.message}` };
      writeResult(jobPath, result);
    }
  }
  return result.status === 'success' ? 0 : 1;
}
