/**
 * Import performance logger — Electron adapter.
 *
 * Delegates to @openchatlab/node-runtime perf logger.
 * Provides the log directory from Electron's path system.
 */

import * as path from 'path'
import { initPerfLog as coreInitPerfLog } from '@openchatlab/node-runtime'
import { getDbDir } from './dbCore'

export {
  LogLevel,
  logPerf,
  logPerfDetail,
  resetPerfLog,
  getCurrentLogFile,
  logError,
  logInfo,
  getErrorCount,
  logSummary,
} from '@openchatlab/node-runtime'

export function initPerfLog(sessionId: string): void {
  const dbDir = getDbDir()
  const logDir = path.join(path.dirname(dbDir), 'logs', 'import')
  coreInitPerfLog(sessionId, logDir)
}
