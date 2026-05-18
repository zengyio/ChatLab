/**
 * NLP 查询模块
 *
 * Electron Worker 的 NLP 入口。
 * 负责从 worker DB 池获取数据库实例，实际计算委托给 @openchatlab/node-runtime。
 */

import { openDatabaseAdapter } from '../core'
import { computeWordFrequency, segmentText as _segmentText, getPosTagDefinitions } from '@openchatlab/node-runtime'
import type { SupportedLocale, WordFrequencyResult, WordFrequencyParams, PosTagInfo } from '@openchatlab/core'

export function getWordFrequency(params: WordFrequencyParams): WordFrequencyResult {
  const db = openDatabaseAdapter(params.sessionId)
  if (!db) {
    return { words: [], totalWords: 0, totalMessages: 0, uniqueWords: 0 }
  }
  return computeWordFrequency(db, params)
}

export function segmentText(text: string, locale: SupportedLocale, minLength?: number): string[] {
  return _segmentText(text, locale, minLength)
}

export function getPosTags(): PosTagInfo[] {
  return getPosTagDefinitions()
}
