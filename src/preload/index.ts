import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type SessionMode = 'idle' | 'locked' | 'break'

const api = {
  onOpenTab: (callback: (url: string) => void) => {
    const listener = (_event: unknown, url: string): void => {
      callback(url)
    }
    ipcRenderer.on('browser:open-tab', listener)
    return () => {
      ipcRenderer.removeListener('browser:open-tab', listener)
    }
  },
  setSessionMode: (mode: SessionMode) => {
    ipcRenderer.send('session:mode', mode)
  },
  openPdfDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:open-pdf')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}