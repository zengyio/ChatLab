/**
 * 语言偏好分析模块（委托给 @openchatlab/core）
 *
 * NLP 能力通过 electron/main/nlp 提供的 jieba 实例构建 NlpProvider。
 */

import { openDatabaseAdapter, type TimeFilter } from '../../core'
import { getLanguagePreferenceAnalysis as coreGetLanguagePreferenceAnalysis } from '@openchatlab/core'
import type { NlpProvider, PosTagResult } from '@openchatlab/core'
import { getJieba } from '@openchatlab/node-runtime'
import { isStopword, MEANINGFUL_POS_TAGS } from '@openchatlab/core'
import type { DictType } from '@openchatlab/core'

function createWorkerNlpProvider(dictType: DictType = 'default'): NlpProvider {
  return {
    tag(text: string): PosTagResult[] {
      const jieba = getJieba(dictType)
      return jieba.tag(text)
    },
    isStopword(word: string, locale: string): boolean {
      return isStopword(word, locale)
    },
    meaningfulPosTags: MEANINGFUL_POS_TAGS,
  }
}

interface LanguagePreferenceParams {
  sessionId: string
  locale: string
  timeFilter?: TimeFilter
  dictType?: string
}

export function getLanguagePreferenceAnalysis(params: LanguagePreferenceParams): any {
  const { sessionId, locale, timeFilter, dictType = 'default' } = params
  const db = openDatabaseAdapter(sessionId)
  if (!db) return { members: [], sharedWords: [], similarityScore: 0 }

  const nlpProvider = createWorkerNlpProvider(dictType as DictType)
  return coreGetLanguagePreferenceAnalysis(db, { locale, timeFilter, nlpProvider })
}
