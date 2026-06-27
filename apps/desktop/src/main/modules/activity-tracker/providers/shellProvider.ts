import { execFile } from 'child_process'
import { readFile, readlink } from 'fs/promises'
import { basename } from 'path'
import type { ActiveWindowSample } from '../types'
import type { ActivityProvider, ProviderQueryOptions } from './types'

/**
 * Dependency-free fallback provider. Used only when the native `get-windows`
 * module is unavailable. It shells out to OS tools that are present on a
 * default install:
 *   - macOS:   osascript (AppleScript via System Events) + ps
 *   - Windows: powershell with a tiny user32 P/Invoke
 *   - Linux:   xdotool or xprop on X11, reading /proc for process details
 *
 * Known gap: pure Wayland sessions expose no generic way to read the focused
 * window, so the Linux path reports unavailable there.
 */

const RUN_TIMEOUT_MS = 4000
const MAX_BUFFER = 1024 * 1024

interface CommandResult {
  stdout: string
  stderr: string
}

function run(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
}

async function commandExists(command: string): Promise<boolean> {
  const locator = process.platform === 'win32' ? 'where' : 'which'
  try {
    await run(locator, [command])
    return true
  } catch {
    return false
  }
}

function parsePid(value: string | undefined): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/* ------------------------------- macOS -------------------------------- */

async function macProcessPath(pid: number): Promise<string> {
  if (pid <= 0) {
    return ''
  }
  try {
    const { stdout } = await run('ps', ['-p', String(pid), '-o', 'comm='])
    return stdout.trim()
  } catch {
    return ''
  }
}

async function sampleMac(options: ProviderQueryOptions): Promise<ActiveWindowSample | null> {
  const titleScript = options.captureTitles
    ? '\n  set winTitle to ""\n  try\n    set winTitle to name of front window of frontApp\n  end try'
    : '\n  set winTitle to ""'
  const script =
    'tell application "System Events"\n' +
    '  set frontApp to first application process whose frontmost is true\n' +
    '  set appName to name of frontApp\n' +
    '  set appPid to unix id of frontApp' +
    titleScript +
    '\nend tell\n' +
    'return appName & "\\n" & appPid & "\\n" & winTitle'

  let stdout: string
  try {
    const result = await run('osascript', ['-e', script])
    stdout = result.stdout
  } catch {
    return null
  }

  const lines = stdout.split('\n')
  const app = (lines[0] ?? '').trim()
  if (app.length === 0) {
    return null
  }
  const pid = parsePid(lines[1])
  const title = options.captureTitles ? (lines[2] ?? '').trim() : ''
  const path = await macProcessPath(pid)

  return {
    app,
    title,
    pid,
    path,
    platform: 'macos',
    windowId: 0
  }
}

/* ------------------------------ Windows ------------------------------- */

const WINDOWS_SCRIPT = [
  '$ErrorActionPreference = "SilentlyContinue"',
  'Add-Type @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public class DeskMateWin {',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);',
  '}',
  '"@',
  '$handle = [DeskMateWin]::GetForegroundWindow()',
  '$procId = 0',
  '[void][DeskMateWin]::GetWindowThreadProcessId($handle, [ref]$procId)',
  '$proc = Get-Process -Id $procId',
  '$fields = @($procId, $proc.ProcessName, $proc.Path, $proc.MainWindowTitle, [int64]$handle)',
  '$fields -join "`n"'
].join('\n')

async function sampleWindows(options: ProviderQueryOptions): Promise<ActiveWindowSample | null> {
  const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')
  let stdout: string
  try {
    const result = await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      encoded
    ])
    stdout = result.stdout
  } catch {
    return null
  }

  const lines = stdout.split('\n').map((line) => line.replace(/\r$/, ''))
  const pid = parsePid(lines[0])
  const processName = (lines[1] ?? '').trim()
  const path = (lines[2] ?? '').trim()
  const title = options.captureTitles ? (lines[3] ?? '').trim() : ''
  const windowId = parsePid(lines[4])

  const app = processName.length > 0 ? processName : path.length > 0 ? basename(path) : ''
  if (app.length === 0) {
    return null
  }

  return {
    app,
    title,
    pid,
    path,
    platform: 'windows',
    windowId
  }
}

/* ------------------------------- Linux -------------------------------- */

async function readProcComm(pid: number): Promise<string> {
  if (pid <= 0) {
    return ''
  }
  try {
    const raw = await readFile(`/proc/${pid}/comm`, 'utf8')
    return raw.trim()
  } catch {
    return ''
  }
}

async function readProcExe(pid: number): Promise<string> {
  if (pid <= 0) {
    return ''
  }
  try {
    return await readlink(`/proc/${pid}/exe`)
  } catch {
    return ''
  }
}

function extractXpropString(output: string, property: string): string {
  const line = output.split('\n').find((entry) => entry.startsWith(property))
  if (!line) {
    return ''
  }
  const eq = line.indexOf('=')
  if (eq < 0) {
    return ''
  }
  const value = line.slice(eq + 1).trim()
  // WM_CLASS yields: "instance", "Class" — take the last quoted token.
  const quoted = value.match(/"([^"]*)"/g)
  if (quoted && quoted.length > 0) {
    const last = quoted[quoted.length - 1]
    return last.replace(/"/g, '')
  }
  return value
}

function extractXpropNumber(output: string, property: string): number {
  const line = output.split('\n').find((entry) => entry.startsWith(property))
  if (!line) {
    return 0
  }
  const match = line.match(/=\s*(\d+)/)
  return match ? parsePid(match[1]) : 0
}

async function sampleLinuxXdotool(
  options: ProviderQueryOptions
): Promise<ActiveWindowSample | null> {
  let stdout: string
  try {
    const result = await run('xdotool', [
      'getactivewindow',
      'getwindowpid',
      'getwindowname'
    ])
    stdout = result.stdout
  } catch {
    return null
  }

  const lines = stdout.split('\n')
  const pid = parsePid(lines[0])
  const windowName = (lines[1] ?? '').trim()
  const comm = await readProcComm(pid)
  const exePath = await readProcExe(pid)
  const app = comm.length > 0 ? comm : windowName
  if (app.length === 0) {
    return null
  }

  return {
    app,
    title: options.captureTitles ? windowName : '',
    pid,
    path: exePath,
    platform: 'linux',
    windowId: 0
  }
}

async function sampleLinuxXprop(
  options: ProviderQueryOptions
): Promise<ActiveWindowSample | null> {
  let activeOut: string
  try {
    const result = await run('xprop', ['-root', '_NET_ACTIVE_WINDOW'])
    activeOut = result.stdout
  } catch {
    return null
  }

  const idMatch = activeOut.match(/0x[0-9a-fA-F]+/)
  if (!idMatch) {
    return null
  }
  const windowIdHex = idMatch[0]
  const windowId = Number.parseInt(windowIdHex, 16)

  let infoOut: string
  try {
    const result = await run('xprop', [
      '-id',
      windowIdHex,
      '_NET_WM_PID',
      'WM_CLASS',
      '_NET_WM_NAME'
    ])
    infoOut = result.stdout
  } catch {
    return null
  }

  const pid = extractXpropNumber(infoOut, '_NET_WM_PID')
  const wmClass = extractXpropString(infoOut, 'WM_CLASS')
  const title = extractXpropString(infoOut, '_NET_WM_NAME')
  const comm = await readProcComm(pid)
  const exePath = await readProcExe(pid)
  const app = wmClass.length > 0 ? wmClass : comm
  if (app.length === 0) {
    return null
  }

  return {
    app,
    title: options.captureTitles ? title : '',
    pid,
    path: exePath,
    platform: 'linux',
    windowId: Number.isFinite(windowId) ? windowId : 0
  }
}

async function sampleLinux(options: ProviderQueryOptions): Promise<ActiveWindowSample | null> {
  if (await commandExists('xdotool')) {
    const sample = await sampleLinuxXdotool(options)
    if (sample) {
      return sample
    }
  }
  if (await commandExists('xprop')) {
    return sampleLinuxXprop(options)
  }
  return null
}

/* ----------------------------- factory ------------------------------- */

export function createShellProvider(): ActivityProvider {
  return {
    name: `shell:${process.platform}`,

    async isAvailable(): Promise<boolean> {
      if (process.platform === 'darwin') {
        return commandExists('osascript')
      }
      if (process.platform === 'win32') {
        return commandExists('powershell.exe')
      }
      if (process.platform === 'linux') {
        const hasDisplay = Boolean(process.env.DISPLAY)
        if (!hasDisplay) {
          return false
        }
        return (await commandExists('xdotool')) || (await commandExists('xprop'))
      }
      return false
    },

    getActiveWindow(options: ProviderQueryOptions): Promise<ActiveWindowSample | null> {
      if (process.platform === 'darwin') {
        return sampleMac(options)
      }
      if (process.platform === 'win32') {
        return sampleWindows(options)
      }
      if (process.platform === 'linux') {
        return sampleLinux(options)
      }
      return Promise.resolve(null)
    }
  }
}
