import { ElectronAPI } from '@electron-toolkit/preload'

export type SessionMode = 'idle' | 'locked' | 'break'

export interface AppAPI {
  onOpenTab: (callback: (url: string) => void) => () => void
  setSessionMode: (mode: SessionMode) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
