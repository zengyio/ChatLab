/**
 * AI tool session queries — Electron worker wrappers.
 * Core search/messages logic lives in @openchatlab/core;
 * Electron adds FTS tokenization and DB lifecycle.
 */

import { searchSessions as coreSearchSessions, getSessionMessages as coreGetSessionMessages } from '@openchatlab/core'
import type { SessionSearchItem, SessionMessagesData } from '@openchatlab/core'
import { openReadonlyDatabase } from './core'
import { wrapAsDatabaseAdapter } from '../../core'
import { hasFtsIndex } from '../fts'
import { tokenizeQueryForFts } from '@openchatlab/node-runtime'

// Re-export core types under Electron-local aliases
export type { SessionSearchItem as SessionSearchResultItem }
export type { SessionMessagesData as SessionMessagesResult }

export function searchSessions(
  sessionId: string,
  keywords?: string[],
  timeFilter?: { startTs: number; endTs: number },
  limit: number = 20,
  previewCount: number = 5
): SessionSearchItem[] {
  const db = openReadonlyDatabase(sessionId)
  if (!db) return []

  try {
    const adapter = wrapAsDatabaseAdapter(db)

    let ftsMatchExpression: string | undefined
    if (keywords && keywords.length > 0 && hasFtsIndex(sessionId)) {
      const match = tokenizeQueryForFts(keywords)
      if (match) ftsMatchExpression = match
    }

    return coreSearchSessions(adapter, keywords, timeFilter, limit, previewCount, ftsMatchExpression)
  } catch (error) {
    console.error('searchSessions error:', error)
    return []
  } finally {
    db.close()
  }
}

export function getSessionMessages(
  sessionId: string,
  chatSessionId: number,
  limit: number = 500
): SessionMessagesData | null {
  const db = openReadonlyDatabase(sessionId)
  if (!db) return null

  try {
    const adapter = wrapAsDatabaseAdapter(db)
    return coreGetSessionMessages(adapter, chatSessionId, limit)
  } catch (error) {
    console.error('getSessionMessages error:', error)
    return null
  } finally {
    db.close()
  }
}
