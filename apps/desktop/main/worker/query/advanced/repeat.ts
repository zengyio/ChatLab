/**
 * 口头禅分析模块（委托给 @openchatlab/core）
 */

import { openDatabaseAdapter, type TimeFilter } from '../../core'
import { getCatchphraseAnalysis as coreGetCatchphraseAnalysis } from '@openchatlab/core'

export function getCatchphraseAnalysis(sessionId: string, filter?: TimeFilter): any {
  const db = openDatabaseAdapter(sessionId)
  if (!db) return { members: [] }
  return coreGetCatchphraseAnalysis(db, filter)
}
