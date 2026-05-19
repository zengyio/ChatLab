import { getRegisteredAdapter } from '../registry'
import type { PreferencesAdapter } from './types'

export function usePreferencesService(): PreferencesAdapter {
  return getRegisteredAdapter<PreferencesAdapter>('preferences')
}
