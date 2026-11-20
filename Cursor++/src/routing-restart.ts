import { spawn } from 'node:child_process'
import { access, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import * as vscode from 'vscode'

const JOB_FILE = 'routing-reinject.json'
const RESTART_ACTION = '重新注入并重启'
const STALE_AFTER_MS = 5 * 60_000
const WAIT_HINT_MS = 15_000

type RoutingJob
  = | { status: 'pending', startedAt: number } | { status: 'success' | 'error', message: string }

function isFsError(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === code
}

async function readJob(path: string): Promise<RoutingJob | undefined> {
  try {
    const text = await readFile(path, 'utf8')
    // An exclusive create can be observed just before its first write.
    if (!text.trim())
      return { status: 'pending', startedAt: (await stat(path)).mtimeMs }
    return JSON.parse(text) as RoutingJob
  }
  catch (error) {
    if (isFsError(error, 'ENOENT'))
      return undefined
    throw error
  }
}

export function registerRoutingRestart(context: vscode.ExtensionContext): void {
  const storage = context.globalStorageUri.fsPath
  const jobPath = join(storage, JOB_FILE)
  let requesting = false
  let poll: ReturnType<typeof setInterval> | undefined
  let hinted = false

  function stopPolling() {
    if (poll)
      clearInterval(poll)
    poll = undefined
  }

  async function reportResult(): Promise<boolean> {
    const job = await readJob(jobPath)
    if (!job)
      return false
    if (job.status === 'pending' && Date.now() - job.startedAt < STALE_AFTER_MS) {
      // Cursor can hold the quit behind its own confirmation dialog; say so instead of waiting silently.
      if (Date.now() - job.startedAt > WAIT_HINT_MS && !hinted) {
        hinted = true
        void vscode.window.showWarningMessage('Cursor 正在等待退出确认：请在弹出的「确定要退出吗？」里选择「退出」，之后会自动注入并重新打开。')
      }
      return true
    }
    try {
      await unlink(jobPath)
    }
    catch (error) {
      if (isFsError(error, 'ENOENT'))
        return false
      throw error
    }
    if (job.status === 'success')
      void vscode.window.showInformationMessage(job.message || 'Cursor++ 路由补丁已就绪。')
    else
      void vscode.window.showErrorMessage(job.status === 'pending' ? '上一次重新注入未完成，可以重新尝试。' : job.message)
    return false
  }

  function watchResult() {
    if (poll)
      return
    poll = setInterval(() => {
      if (requesting)
        return
      void reportResult().then((pending) => {
        if (!pending)
          stopPolling()
      }).catch(() => stopPolling())
    }, 1_000)
  }

  context.subscriptions.push({ dispose: stopPolling })
  void reportResult().then((pending) => {
    if (pending)
      watchResult()
  }).catch(() => {})

  context.subscriptions.push(vscode.commands.registerCommand('cursor2plus.injectRouting', async () => {
    if (requesting)
      return
    requesting = true
    let ownsJob = false
    let worker: ReturnType<typeof spawn> | undefined
    try {
      if (await reportResult()) {
        watchResult()
        void vscode.window.showInformationMessage('重新注入正在等待 Cursor 退出。')
        return
      }
      const appRoot = vscode.env.appRoot
      const executable = process.platform === 'darwin'
        ? resolve(appRoot, '..', '..', 'MacOS', 'Cursor')
        : process.execPath
      const runner = join(context.extensionPath, 'dist', 'restart-inject.cjs')
      if (!isAbsolute(appRoot) || !/^cursor(?:\.exe)?$/i.test(basename(executable)))
        throw new Error('无法找到本机 Cursor 安装路径。')
      await Promise.all([access(runner), access(executable)])
      const choice = await vscode.window.showWarningMessage(
        '重新注入 Cursor++ 路由补丁？',
        { modal: true, detail: 'Cursor 会正常退出，完成兼容性检查和注入后自动重开。' },
        RESTART_ACTION,
      )
      if (choice !== RESTART_ACTION)
        return
      // Reopen into the profile and extension set this window came from.
      const restartArgs = process.argv
        .filter(arg => /^--(?:user-data-dir|extensions-dir)=/.test(arg))
        .map(arg => arg.replace(/^--([^=]+)="?(.*?)"?$/, '--$1=$2'))
      await mkdir(storage, { recursive: true })
      await writeFile(jobPath, JSON.stringify({ status: 'pending', startedAt: Date.now() }), { flag: 'wx' })
      hinted = false
      ownsJob = true
      const child = spawn(executable, [runner, appRoot, executable, jobPath, JSON.stringify(restartArgs)], {
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      })
      worker = child
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      child.unref()
      // A worker that exits within two seconds never reached the guarded quit.
      setTimeout(() => {
        if (!ownsJob || child.exitCode === null)
          return
        void unlink(jobPath).catch(() => {})
        void vscode.window.showErrorMessage('重新注入程序未能启动。')
      }, 2_000)
      watchResult()
      void Promise.resolve(vscode.commands.executeCommand('workbench.action.quit')).catch(async (error: unknown) => {
        child.kill()
        await unlink(jobPath).catch(() => {})
        void vscode.window.showErrorMessage(`无法退出 Cursor：${error instanceof Error ? error.message : String(error)}`)
      })
    }
    catch (error) {
      if (ownsJob) {
        worker?.kill()
        await unlink(jobPath).catch(() => {})
      }
      if (!ownsJob && isFsError(error, 'EEXIST')) {
        watchResult()
        void vscode.window.showInformationMessage('另一个 Cursor 窗口已开始重新注入。')
      }
      else {
        void vscode.window.showErrorMessage(`无法启动重新注入：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    finally {
      requesting = false
    }
  }))
}
