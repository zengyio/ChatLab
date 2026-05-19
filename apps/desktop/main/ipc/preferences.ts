/**
 * Preferences IPC handlers
 *
 * Read/write ~/.chatlab/preferences.json and config.toml [ui] section.
 */

import { ipcMain } from 'electron'
import type { IpcContext } from './types'
import { PreferencesManager, type Preferences } from '@openchatlab/node-runtime'
import { loadConfig, writeConfigField, type UiConfig } from '@openchatlab/config'
import { getSystemDataDir } from '../paths'

let prefManager: PreferencesManager | null = null

function getManager(): PreferencesManager {
  if (!prefManager) {
    prefManager = new PreferencesManager(getSystemDataDir())
  }
  return prefManager
}

export function registerPreferencesHandlers(_context: IpcContext): void {
  console.log('[IpcMain] Registering preferences handlers...')

  ipcMain.handle('preferences:get', (): Preferences => {
    return getManager().load()
  })

  ipcMain.handle('preferences:save', (_event, partial: Partial<Preferences>): { success: boolean; error?: string } => {
    return getManager().save(partial)
  })

  ipcMain.handle('preferences:getUiConfig', (): UiConfig => {
    const config = loadConfig()
    return config.ui
  })

  ipcMain.handle(
    'preferences:saveUiConfig',
    (_event, partial: Partial<UiConfig>): { success: boolean; error?: string } => {
      try {
        for (const [key, value] of Object.entries(partial)) {
          if (value !== undefined) {
            writeConfigField('ui', key, value as string | number)
          }
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('preferences:getLocale', (): string => {
    const config = loadConfig()
    return config.locale.lang
  })

  ipcMain.handle('preferences:saveLocale', (_event, lang: string): { success: boolean; error?: string } => {
    try {
      writeConfigField('locale', 'lang', lang)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  console.log('[IpcMain] Preferences handlers registered')
}
