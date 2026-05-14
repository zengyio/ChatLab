/**
 * AI 模块（Node.js 实现）
 *
 * 助手/技能 MD 文件解析器、共享类型、对话管理、Agent Core。
 */

export type { AssistantConfig, AssistantSummary, SkillDef, SkillSummary } from './types'
export { parseAssistantFile, serializeAssistant } from './assistant-parser'
export { parseSkillFile, extractSkillId } from './skill-parser'
export { AIConversationManager } from './conversations'
export type {
  AIConversation,
  AIMessage,
  AIMessageRole,
  ContentBlock,
  TokenUsageData,
  ConversationManagerLogger,
} from './conversations'

// Tokenizer
export { countTokens, countMessagesTokens } from './tokenizer'

// SkillManager
export { SkillManager } from './skill-manager'
export type { SkillManagerLogger } from './skill-manager'
export { createActivateSkillTool } from './activate-skill-tool'
export type { ActivateSkillToolOptions, ActivateSkillTool, ActivateSkillToolResult } from './activate-skill-tool'

// Compression
export type { CompressionConfig, CompressionResult, CompressionLogger, CompressionLlmAdapter } from './compression'
export { checkAndCompress, manualCompress } from './compression'

// Preprocessor
export type {
  PreprocessConfig,
  PreprocessableMessage,
  DesensitizeRule,
  TruncationStrategy,
  PreprocessLogger,
} from './preprocessor'
export {
  preprocessMessages,
  BUILTIN_DESENSITIZE_RULES,
  getDefaultRulesForLocale,
  mergeRulesForLocale,
  formatMessageCompact,
  formatTimeRange,
  formatToolResultAsText,
  anonymizeMessageNames,
  truncateFormattedMessages,
  isChineseLocale,
  i18nTexts,
  t,
} from './preprocessor'

// Agent Core
export type { AgentCoreOptions, AgentCoreEvent, AgentCoreResult, AgentTokenUsage, SimpleHistoryMessage } from './agent'
export { runAgentCore } from './agent'

// Re-exports from @mariozechner/pi-agent-core
export type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core'

// Re-exports from @mariozechner/pi-ai
export { Type, completeSimple, streamSimple } from '@mariozechner/pi-ai'
export type {
  Model as PiModel,
  Api as PiApi,
  Message as PiMessage,
  Usage as PiUsage,
  TextContent as PiTextContent,
  AssistantMessage as PiAssistantMessage,
} from '@mariozechner/pi-ai'
