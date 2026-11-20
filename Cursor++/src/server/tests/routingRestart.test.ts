import type { ExtensionContext } from 'vscode'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerRoutingRestart } from '../../routing-restart'

const stub = vi.hoisted(() => ({
  env: { appRoot: '' },
  registerCommand: vi.fn(() => ({ dispose() {} })),
  executeCommand: vi.fn(async () => {}),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  spawn: vi.fn(),
}))
vi.mock('vscode', () => ({ env: stub.env, commands: stub, window: stub }))
vi.mock('node:child_process', () => ({ spawn: stub.spawn }))

let root: string
let job: string
let context: ExtensionContext
const originalExecPath = process.execPath

beforeEach(async () => {
  vi.resetAllMocks()
  root = await mkdtemp(join(tmpdir(), 'routing-restart-'))
  stub.env.appRoot = join(root, 'resources', 'app')
  context = { extensionPath: join(root, 'cursor2plus'), globalStorageUri: { fsPath: join(root, 'storage') }, subscriptions: [] } as unknown as ExtensionContext
  job = join(context.globalStorageUri.fsPath, 'routing-reinject.json')
  const executable = process.platform === 'darwin'
    ? resolve(stub.env.appRoot, '..', '..', 'MacOS', 'Cursor')
    : join(root, process.platform === 'win32' ? 'Cursor.exe' : 'cursor')
  process.execPath = executable
  const runner = join(context.extensionPath, 'dist', 'restart-inject.cjs')
  await mkdir(dirname(executable), { recursive: true })
  await mkdir(dirname(runner), { recursive: true })
  await writeFile(executable, '')
  await writeFile(runner, '')
  stub.registerCommand.mockReturnValue({ dispose() {} })
  stub.executeCommand.mockResolvedValue(undefined)
})

afterEach(async () => {
  context.subscriptions.forEach(item => item.dispose())
  process.execPath = originalExecPath
  await rm(root, { recursive: true, force: true })
})

function command(): () => Promise<void> {
  registerRoutingRestart(context)
  return (stub.registerCommand.mock.calls as unknown as [string, () => Promise<void>][])[0]![1]
}

it('does not queue work or quit when the user cancels', async () => {
  await command()()
  expect(stub.showWarningMessage).toHaveBeenCalledOnce()
  expect(stub.spawn).not.toHaveBeenCalled()
  expect(stub.executeCommand).not.toHaveBeenCalled()
  await expect(readFile(job)).rejects.toHaveProperty('code', 'ENOENT')
})

it('queues one detached worker before requesting a normal quit', async () => {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() })
  stub.spawn.mockImplementation(() => {
    queueMicrotask(() => child.emit('spawn'))
    return child
  })
  stub.showWarningMessage.mockResolvedValue('重新注入并重启')
  const originalArgv = process.argv
  process.argv = [...originalArgv, '--user-data-dir=C:\\profile dir']
  const run = command()
  await run()
  await run()
  process.argv = originalArgv
  expect(stub.spawn).toHaveBeenCalledOnce()
  expect(stub.spawn.mock.calls[0]![1]).toContain(job)
  expect(JSON.parse(stub.spawn.mock.calls[0]![1].at(-1)!)).toEqual(['--user-data-dir=C:\\profile dir'])
  expect(stub.executeCommand).toHaveBeenCalledExactlyOnceWith('workbench.action.quit')
  expect(JSON.parse(await readFile(job, 'utf8'))).toMatchObject({ status: 'pending' })
})

it('keeps Cursor open and removes the queued job when the worker fails to launch', async () => {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() })
  stub.spawn.mockImplementation(() => {
    queueMicrotask(() => child.emit('error', new Error('could not spawn')))
    return child
  })
  stub.showWarningMessage.mockResolvedValue('重新注入并重启')
  await command()()
  expect(stub.executeCommand).not.toHaveBeenCalled()
  expect(stub.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('could not spawn'))
  await expect(readFile(job)).rejects.toHaveProperty('code', 'ENOENT')
})
