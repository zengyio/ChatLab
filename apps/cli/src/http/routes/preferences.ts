/**
 * Preferences HTTP routes — /_web/preferences/*
 *
 * Read/write preferences.json and config.toml [ui] section for Web UI.
 */

import type { FastifyInstance } from 'fastify'
import { PreferencesManager, type Preferences } from '@openchatlab/node-runtime'
import { loadConfig, writeConfigField, type UiConfig } from '@openchatlab/config'
import type { PathProvider } from '@openchatlab/core'

let prefManager: PreferencesManager | null = null

export function registerPreferencesRoutes(server: FastifyInstance, pathProvider: PathProvider): void {
  if (!prefManager) {
    prefManager = new PreferencesManager(pathProvider.getSystemDir())
  }

  server.get('/_web/preferences', async () => {
    return prefManager!.load()
  })

  server.patch<{ Body: Partial<Preferences> }>('/_web/preferences', async (request) => {
    return prefManager!.save(request.body)
  })

  server.get('/_web/preferences/ui-config', async () => {
    const config = loadConfig()
    return config.ui
  })

  server.patch<{ Body: Partial<UiConfig> }>('/_web/preferences/ui-config', async (request) => {
    try {
      for (const [key, value] of Object.entries(request.body)) {
        if (value !== undefined) {
          writeConfigField('ui', key, value as string | number)
        }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  server.get('/_web/preferences/locale', async () => {
    const config = loadConfig()
    return { lang: config.locale.lang }
  })

  server.patch<{ Body: { lang: string } }>('/_web/preferences/locale', async (request) => {
    try {
      writeConfigField('locale', 'lang', request.body.lang)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
