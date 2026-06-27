import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { createActivityTracker, registerActivityIpc } from './modules/activity-tracker'
import { registerChatIpc } from './modules/chat'

// Desktop activity tracker (Work Rhythm Module data connector). It does not
// start on its own — the renderer enables it via IPC once the module is on.
const activityTracker = createActivityTracker()

function getOnboardingFilePath(): string {
  return join(app.getPath('userData'), 'onboarding.json')
}

async function readOnboardingFile(): Promise<unknown | null> {
  try {
    const content = await readFile(getOnboardingFilePath(), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function writeOnboardingFile(data: unknown): Promise<{ path: string }> {
  const path = getOnboardingFilePath()

  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')

  return { path }
}

async function clearOnboardingFile(): Promise<{ path: string }> {
  const path = getOnboardingFilePath()

  try {
    await unlink(path)
  } catch {
    // The reset action should be idempotent if the file is already gone.
  }

  return { path }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron')
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.code === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  })

  ipcMain.handle('onboarding:read', readOnboardingFile)
  ipcMain.handle('onboarding:write', (_, data) => writeOnboardingFile(data))
  ipcMain.handle('onboarding:clear', clearOnboardingFile)
  ipcMain.handle('onboarding:path', () => getOnboardingFilePath())

  // Expose the activity tracker to the renderer.
  registerActivityIpc(ipcMain, activityTracker, () => BrowserWindow.getAllWindows())
  registerChatIpc(ipcMain)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Persist the current activity day and tear down the tracker before quitting.
app.on('before-quit', () => {
  void activityTracker.dispose()
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
