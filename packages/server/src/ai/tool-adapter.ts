/**
 * 工具适配层
 *
 * 将 @openchatlab/tools 的 ToolDefinition 适配为 @mariozechner/pi-agent-core 的 AgentTool 格式。
 * 消息类工具返回 rawMessages 时自动执行预处理管道（清洗、去噪、脱敏、截断、格式化）。
 */

import type { ToolDefinition, ToolExecutionContext } from '@openchatlab/tools'
import type { DatabaseAdapter } from '@openchatlab/core'
import {
  preprocessMessages,
  formatMessageCompact,
  truncateFormattedMessages,
  formatToolResultAsText,
  countTokens,
  type AgentTool,
  type AgentToolResult,
  type PreprocessableMessage,
  type TruncationStrategy,
} from '@openchatlab/node-runtime'

const DEFAULT_MAX_TOOL_RESULT_TOKENS = 8000

const TOOL_TRUNCATION_STRATEGY: Record<string, TruncationStrategy> = {
  chatlab_search: 'keep_first',
  chatlab_recent_messages: 'keep_last',
}

export interface ServerToolContext {
  db: DatabaseAdapter
  sessionId: string
  locale?: string
}

function convertJsonSchemaToParameters(schema: ToolDefinition['inputSchema']) {
  const properties: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(schema.properties)) {
    properties[key] = { ...prop }
  }
  return {
    type: 'object' as const,
    properties,
    required: schema.required || [],
  }
}

function applyPreprocessing(
  rawMessages: PreprocessableMessage[],
  toolName: string,
  locale?: string,
  details?: Record<string, unknown>
): string {
  const processed = preprocessMessages(rawMessages)
  let formatted = processed.map((m) => formatMessageCompact(m, locale))

  let wasTruncated = false
  const originalCount = formatted.length
  const budget = DEFAULT_MAX_TOOL_RESULT_TOKENS

  let totalTokens = 0
  for (const line of formatted) {
    totalTokens += countTokens(line) + 1
  }

  if (totalTokens > budget) {
    const strategy = TOOL_TRUNCATION_STRATEGY[toolName] ?? 'keep_last'
    const truncResult = truncateFormattedMessages(formatted, budget, strategy, countTokens)
    if (truncResult.wasTruncated) {
      formatted = truncResult.messages
      wasTruncated = true
    }
  }

  const finalDetails = { ...details, messages: formatted, returned: formatted.length }
  const { rawMessages: _, ...restDetails } = finalDetails as Record<string, unknown>
  let textContent = formatToolResultAsText({ ...restDetails, messages: formatted, returned: formatted.length })

  if (wasTruncated) {
    const strategy = TOOL_TRUNCATION_STRATEGY[toolName] ?? 'keep_last'
    const strategyDesc = strategy === 'keep_first' ? 'most relevant' : 'most recent'
    const notice = `⚠️ Results truncated: ${originalCount} messages found, showing ${formatted.length} ${strategyDesc} due to context limit. Use a narrower time range or more specific keywords for more precise results.`
    textContent = notice + '\n' + textContent
  }

  return textContent
}

export function adaptToolsForAgent(
  tools: ToolDefinition[],
  getContext: () => ServerToolContext
): AgentTool<any, any>[] {
  return tools.map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: convertJsonSchemaToParameters(tool.inputSchema) as any,
    async execute(_toolCallId: string, params: Record<string, unknown>): Promise<AgentToolResult<unknown>> {
      const ctx = getContext()
      const execCtx: ToolExecutionContext = {
        db: ctx.db,
        sessionId: ctx.sessionId,
        locale: ctx.locale,
      }
      try {
        const result = tool.handler(params, execCtx)

        if (result.rawMessages && result.rawMessages.length > 0) {
          const textContent = applyPreprocessing(
            result.rawMessages as PreprocessableMessage[],
            tool.name,
            ctx.locale,
            (result.data ?? {}) as Record<string, unknown>
          )
          return { content: [{ type: 'text', text: textContent }], details: null }
        }

        return { content: [{ type: 'text', text: result.content }], details: null }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return { content: [{ type: 'text', text: `Error: ${msg}` }], details: null }
      }
    },
  }))
}
