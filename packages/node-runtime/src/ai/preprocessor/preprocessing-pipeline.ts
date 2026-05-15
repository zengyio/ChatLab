/**
 * 预处理管道（统一实现）
 *
 * Electron 端和 Server 端共用的消息预处理管道核心逻辑：
 * rawMessages → preprocess → [anonymize] → format → truncate → text
 */

import type { PreprocessConfig, PreprocessableMessage, TruncationStrategy } from './types'
import { preprocessMessages } from './pipeline'
import {
  formatMessageCompact,
  anonymizeMessageNames,
  formatToolResultAsText,
  truncateFormattedMessages,
} from './format'
import { countTokens } from '../tokenizer'

export interface PreprocessingPipelineOptions {
  rawMessages: PreprocessableMessage[]
  preprocessConfig?: PreprocessConfig
  locale?: string
  anonymizeNames?: boolean
  ownerPlatformId?: string
  maxToolResultTokens?: number
  truncationStrategy?: TruncationStrategy
  /** rawMessages 之外的附加元数据（如 total、timeRange），会合并到输出 details */
  extraDetails?: Record<string, unknown>
}

export interface PreprocessingPipelineResult {
  text: string
  details: Record<string, unknown>
}

export function applyPreprocessingPipeline(options: PreprocessingPipelineOptions): PreprocessingPipelineResult {
  const {
    rawMessages,
    preprocessConfig,
    locale,
    anonymizeNames = false,
    ownerPlatformId,
    maxToolResultTokens,
    truncationStrategy = 'keep_last',
    extraDetails = {},
  } = options

  const processed = preprocessMessages(rawMessages, preprocessConfig)

  let nameMapLine = ''
  if (anonymizeNames) {
    nameMapLine = anonymizeMessageNames(processed, ownerPlatformId)
  }

  let formatted = processed.map((m) => formatMessageCompact(m, locale))

  let wasTruncated = false
  const originalCount = formatted.length

  if (maxToolResultTokens && maxToolResultTokens > 0) {
    const truncResult = truncateFormattedMessages(formatted, maxToolResultTokens, truncationStrategy, countTokens)
    if (truncResult.wasTruncated) {
      formatted = truncResult.messages
      wasTruncated = true
    }
  }

  const finalDetails: Record<string, unknown> = { ...extraDetails, messages: formatted, returned: formatted.length }

  let textContent = formatToolResultAsText(finalDetails)

  if (wasTruncated) {
    const strategyDesc = truncationStrategy === 'keep_first' ? 'most relevant' : 'most recent'
    const notice = `⚠️ Results truncated: ${originalCount} messages found, showing ${formatted.length} ${strategyDesc} due to context limit. Use a narrower time range or more specific keywords for more precise results.`
    textContent = notice + '\n' + textContent
  }

  if (nameMapLine) {
    textContent = nameMapLine + '\n' + textContent
  }

  return { text: textContent, details: finalDetails }
}
