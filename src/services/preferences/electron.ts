import type { PreferencesAdapter, Preferences, UiConfig } from './types'

export class ElectronPreferencesAdapter implements PreferencesAdapter {
  async getPreferences(): Promise<Preferences> {
    return (await window.preferencesApi.get()) as unknown as Preferences
  }

  savePreferences(partial: Partial<Preferences>): Promise<{ success: boolean; error?: string }> {
    return window.preferencesApi.save(partial as Record<string, unknown>)
  }

  async getUiConfig(): Promise<UiConfig> {
    return (await window.preferencesApi.getUiConfig()) as unknown as UiConfig
  }

  saveUiConfig(partial: Partial<UiConfig>): Promise<{ success: boolean; error?: string }> {
    return window.preferencesApi.saveUiConfig(partial as Record<string, unknown>)
  }

  getLocale(): Promise<string> {
    return window.preferencesApi.getLocale()
  }

  saveLocale(lang: string): Promise<{ success: boolean; error?: string }> {
    return window.preferencesApi.saveLocale(lang)
  }
}
