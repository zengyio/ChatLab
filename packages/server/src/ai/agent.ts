/**
 * 服务端 Agent
 *
 * 使用 @openchatlab/node-runtime 的 runAgentCore 编排对话流程，
 * 将流式事件通过回调输出给 SSE 端点。
 */

import {
  runAgentCore,
  completeSimple,
  checkAndCompress,
  type AgentCoreEvent,
  type SimpleHistoryMessage,
  type AIConversationManager,
  type CompressionConfig,
  type CompressionLlmAdapter,
  type PiTextContent,
  type AgentTool,
} from '@openchatlab/node-runtime'

import { getDefaultAssistantConfig, buildPiModel } from './llm-config'

export interface AgentStreamEvent {
  type: 'content' | 'think' | 'tool_start' | 'tool_result' | 'status' | 'done' | 'error'
  content?: string
  thinkTag?: string
  thinkDurationMs?: number
  toolName?: string
  toolParams?: Record<string, unknown>
  toolResult?: unknown
  error?: { name: string | null; message: string | null }
  isFinished?: boolean
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  status?: {
    phase: string
    round: number
    toolsUsed: number
    currentTool?: string
  }
}

export interface RunAgentOptions {
  userMessage: string
  conversationId: string
  chatType?: 'group' | 'private'
  locale?: string
  assistantSystemPrompt?: string
  skillMenu?: string | null
  compressionConfig?: CompressionConfig
  tools?: AgentTool[]
  aiDataDir: string
  convManager: AIConversationManager
  onEvent: (event: AgentStreamEvent) => void
  abortSignal?: AbortSignal
}

function buildSystemPrompt(
  _chatType: 'group' | 'private',
  assistantSystemPrompt?: string,
  locale: string = 'zh-CN',
  skillMenu?: string | null
): string {
  const now = new Date()
  const dateLocale = locale.startsWith('zh') ? 'zh-CN' : 'en-US'
  const currentDate = now.toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const isZh = locale.startsWith('zh')
  const role =
    assistantSystemPrompt ||
    (isZh
      ? '你是 ChatLab AI 助手，一个智能对话助手。请友好、准确地回答用户的问题。'
      : 'You are ChatLab AI assistant, an intelligent conversational assistant. Please answer questions in a friendly and accurate manner.')

  const datePrefix = isZh ? '当前日期是' : 'Current date is'
  const responseNote = isZh
    ? '请直接回答用户的问题，不要使用工具除非确实需要。'
    : "Answer the user's question directly. Only use tools when truly necessary."

  let prompt = `${role}

${datePrefix} ${currentDate}。

${responseNote}`

  if (skillMenu) {
    prompt += `\n\n${skillMenu}`
  }

  return prompt
}

function mapCoreEventToStream(
  event: AgentCoreEvent,
  onEvent: (event: AgentStreamEvent) => void,
  toolsUsedCount: { value: number },
  currentRound: { value: number }
): void {
  switch (event.type) {
    case 'content':
      onEvent({ type: 'content', content: event.content })
      break
    case 'thinking_start':
      onEvent({
        type: 'status',
        status: { phase: 'thinking', round: currentRound.value, toolsUsed: toolsUsedCount.value },
      })
      break
    case 'thinking_delta':
      onEvent({ type: 'think', content: event.content, thinkTag: 'thinking' })
      break
    case 'thinking_end':
      onEvent({ type: 'think', content: '', thinkTag: 'thinking', thinkDurationMs: event.durationMs })
      break
    case 'tool_start':
      toolsUsedCount.value += 1
      onEvent({ type: 'tool_start', toolName: event.toolName, toolParams: event.toolParams })
      onEvent({
        type: 'status',
        status: {
          phase: 'tool_running',
          round: currentRound.value,
          toolsUsed: toolsUsedCount.value,
          currentTool: event.toolName,
        },
      })
      break
    case 'tool_end':
      onEvent({ type: 'tool_result', toolName: event.toolName, toolResult: event.toolResult })
      break
    case 'turn_end':
      currentRound.value = event.round
      break
    case 'usage_update':
      break
  }
}

export async function runServerAgent(options: RunAgentOptions): Promise<void> {
  const {
    userMessage,
    conversationId,
    chatType = 'group',
    locale = 'zh-CN',
    assistantSystemPrompt,
    skillMenu,
    compressionConfig,
    tools = [],
    aiDataDir,
    convManager,
    onEvent,
    abortSignal,
  } = options

  const llmConfig = getDefaultAssistantConfig(aiDataDir)
  if (!llmConfig) {
    onEvent({ type: 'error', error: { name: 'ConfigError', message: 'LLM service not configured' } })
    onEvent({ type: 'done', isFinished: true })
    return
  }

  const piModel = buildPiModel(llmConfig)
  const systemPrompt = buildSystemPrompt(chatType, assistantSystemPrompt, locale, skillMenu)

  if (compressionConfig?.enabled) {
    const llmAdapter: CompressionLlmAdapter = {
      contextWindow: piModel.contextWindow ?? 128000,
      compress: async (prompt: string, maxTokens: number) => {
        onEvent({ type: 'status', status: { phase: 'compressing', round: 0, toolsUsed: 0 } })
        try {
          const result = await completeSimple(
            piModel,
            {
              systemPrompt: undefined,
              messages: [{ role: 'user', content: [{ type: 'text', text: prompt }], timestamp: Date.now() }] as any,
            },
            { apiKey: llmConfig.apiKey, maxTokens }
          )
          const text = result.content
            .filter((item): item is PiTextContent => item.type === 'text')
            .map((item) => item.text)
            .join('')
          return text || null
        } catch {
          return null
        }
      },
    }
    const compressionResult = await checkAndCompress(
      conversationId,
      compressionConfig,
      systemPrompt,
      llmAdapter,
      convManager
    )
    if (compressionResult.compressed) {
      onEvent({ type: 'status', status: { phase: 'compression_done', round: 0, toolsUsed: 0 } })
    }
  }

  if (abortSignal?.aborted) {
    onEvent({ type: 'done', isFinished: true, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
    return
  }

  let history: SimpleHistoryMessage[] = []
  try {
    history = convManager.getHistoryForAgent(conversationId)
  } catch {
    // empty history on failure
  }

  const toolsUsedCount = { value: 0 }
  const currentRound = { value: 0 }

  onEvent({ type: 'status', status: { phase: 'preparing', round: 0, toolsUsed: 0 } })

  try {
    const result = await runAgentCore({
      piModel,
      apiKey: llmConfig.apiKey,
      systemPrompt,
      tools,
      history,
      userMessage,
      maxToolRounds: 5,
      abortSignal,
      onEvent: (coreEvent) => mapCoreEventToStream(coreEvent, onEvent, toolsUsedCount, currentRound),
      onDebugContext: (messages) => {
        try {
          convManager.setPendingDebugContext(conversationId, JSON.stringify(messages, null, 2))
        } catch {
          // silent
        }
      },
    })

    if (result.error) {
      onEvent({ type: 'error', error: { name: 'AgentError', message: result.error } })
    }

    onEvent({ type: 'done', isFinished: true, usage: result.usage })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    onEvent({ type: 'error', error: { name: 'AgentError', message: msg } })
    onEvent({ type: 'done', isFinished: true, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
  }
}
