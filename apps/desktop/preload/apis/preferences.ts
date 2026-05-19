/**
 * Preferences Preload API
 */
import { ipcRenderer } from 'electron'

export const preferencesApi = {
  get: (): Promise<Record<string, unknown>> => {
    return ipcRenderer.invoke('preferences:get')
  },

  save: (partial: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('preferences:save', partial)
  },

  getUiConfig: (): Promise<Record<string, unknown>> => {
    return ipcRenderer.invoke('preferences:getUiConfig')
  },

  saveUiConfig: (partial: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('preferences:saveUiConfig', partial)
  },

  getLocale: (): Promise<string> => {
    return ipcRenderer.invoke('preferences:getLocale')
  },

  saveLocale: (lang: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('preferences:saveLocale', lang)
  },
}
