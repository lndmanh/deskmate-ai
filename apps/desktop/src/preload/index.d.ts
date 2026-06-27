import { ElectronAPI } from '@electron-toolkit/preload'
import type { DeskMateApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: DeskMateApi
  }
}