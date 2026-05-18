/**
 * Electron implementation of PathProvider.
 * Wraps the existing paths.ts functions to satisfy the shared interface.
 */

import type { PathProvider } from '@openchatlab/core'
import {
  getSystemDataDir,
  getUserDataDir,
  getDatabaseDir,
  getAiDataDir,
  getSettingsDir,
  getCacheDir,
  getTempDir,
  getLogsDir,
  getDownloadsDir,
} from './paths'

export class ElectronPathProvider implements PathProvider {
  getSystemDir(): string {
    return getSystemDataDir()
  }
  getUserDataDir(): string {
    return getUserDataDir()
  }
  getDatabaseDir(): string {
    return getDatabaseDir()
  }
  getAiDataDir(): string {
    return getAiDataDir()
  }
  getSettingsDir(): string {
    return getSettingsDir()
  }
  getCacheDir(): string {
    return getCacheDir()
  }
  getTempDir(): string {
    return getTempDir()
  }
  getLogsDir(): string {
    return getLogsDir()
  }
  getDownloadsDir(): string {
    return getDownloadsDir()
  }
}
