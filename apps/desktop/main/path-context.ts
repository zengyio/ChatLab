/**
 * Global PathProvider singleton for the Electron main process.
 *
 * Initializes lazily on first access. All modules that need directory paths
 * should import getPathProvider() instead of importing functions from paths.ts
 * directly — this makes them PathProvider-aware and easier to extract to
 * shared packages later.
 */

import type { PathProvider } from '@openchatlab/core'
import { ElectronPathProvider } from './electron-path-provider'

let _provider: PathProvider | null = null

export function getPathProvider(): PathProvider {
  if (!_provider) {
    _provider = new ElectronPathProvider()
  }
  return _provider
}
