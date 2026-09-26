import { app, shell, BrowserWindow, ipcMain, session, WebContents } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getBlockedPageUrl, isBlockedSocialUrl } from '../shared/sitePolicy'

const BROWSER_PARTITION = 'persist:lockedin'

type SessionMode = 'idle' | 'locked' | 'break'

let sessionMode: SessionMode = 'idle'

function isLockActive(): boolean {
  return sessionMode === 'locked'
}

function applyWindowMode(win: BrowserWindow, mode: SessionMode): void {
  if (win.isDestroyed()) return

  if (mode === 'locked') {
    win.setKiosk(true)
    return
  }

  win.setKiosk(false)
  win.setAlwaysOnTop(false)
  if (win.isFullScreen()) {
    win.setFullScreen(false)
  }
  win.setMinimizable(true)
  win.setMaximizable(true)
  win.setClosable(true)
}

function guardWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (!isLockActive() || !isBlockedSocialUrl(url)) return
    event.preventDefault()
    void contents.loadURL(getBlockedPageUrl())
  })

  contents.on('will-redirect', (event, url) => {
    if (!isLockActive() || !isBlockedSocialUrl(url)) return
    event.preventDefault()
    void contents.loadURL(getBlockedPageUrl())
  })

  contents.setWindowOpenHandler(({ url }) => {
    if (isLockActive() && isBlockedSocialUrl(url)) {
      return { action: 'deny' }
    }

    const host = contents.hostWebContents
    if (host && !host.isDestroyed()) {
      host.send('browser:open-tab', url)
    }

    return { action: 'deny' }
  })
}

function registerSocialBlocker(): void {
  const browserSession = session.fromPartition(BROWSER_PARTITION)
  const filter = { urls: ['*://*/*'] }

  browserSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    if (!isLockActive() || !isBlockedSocialUrl(details.url)) {
      callback({})
      return
    }

    if (details.resourceType === 'mainFrame') {
      callback({ redirectURL: getBlockedPageUrl() })
      return
    }

    callback({ cancel: true })
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    kiosk: false,
    titleBarStyle: 'hidden', // <-- ADD THIS: Hides the default OS title bar
    titleBarOverlay: {       // <-- ADD THIS: Styles the Windows/Mac control buttons
      color: '#111111', 
      symbolColor: '#ffffff'
    },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      webviewTag: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.preload = undefined
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  registerSocialBlocker()

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      guardWebContents(contents)
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('session:mode', (event, mode: SessionMode) => {
    if (mode !== 'idle' && mode !== 'locked' && mode !== 'break') return
    sessionMode = mode
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      applyWindowMode(win, mode)
    }
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
