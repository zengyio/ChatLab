/**
 * Agent 事件处理器
 * 将 AgentCoreEvent 映射为 IPC AgentStreamChunk，
 * 并跟踪运行时状态（usage / 工具轮次 / 状态发射 / context token 估算）
 */

import type { PiMessage, AgentCoreEvent } from '@openchatlab/node-runtime'
import type { TokenUsage, AgentRuntimeStatus } from '../../../shared/types'
import type { ToolContext } from '../tools/types'
import type { AgentStreamChunk } from './types'

export interface EventHandlerConfig {
  onChunk: (chunk: AgentStreamChunk) => void
  context: ToolContext
  systemPrompt: string
}

/**
 * Agent 运行时状态追踪器
 * 可被 Agent 主类作为组合成员持有
 */
export class AgentEventHandler {
  readonly toolsUsed: string[] = []
  toolRounds: number = 0

  private totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  private lastStatusAt = 0
  private readonly onChunk: (chunk: AgentStreamChunk) => void
  private readonly context: ToolContext
  private readonly systemPrompt: string

  constructor(config: EventHandlerConfig) {
    this.onChunk = config.onChunk
    this.context = config.context
    this.systemPrompt = config.systemPrompt
  }

  /**
   * 处理来自 runAgentCore 的事件，映射为 AgentStreamChunk 并发送
   * @param event AgentCoreEvent
   * @param messages 最近一次 convertToLlm 的 PiMessage 快照（用于 context token 估算）
   */
  handleCoreEvent(event: AgentCoreEvent, messages: PiMessage[]): void {
    switch (event.type) {
      case 'content':
        this.onChunk({ type: 'content', content: event.content })
        this.emitStatus('responding', messages)
        break
      case 'thinking_start':
        this.emitStatus('thinking', messages, { force: true })
        break
      case 'thinking_delta':
        this.onChunk({ type: 'think', content: event.content, thinkTag: 'thinking' })
        this.emitStatus('thinking', messages)
        break
      case 'thinking_end':
        this.onChunk({ type: 'think', content: '', thinkTag: 'thinking', thinkDurationMs: event.durationMs })
        this.emitStatus('responding', messages, { force: true })
        break
      case 'tool_start': {
        const params = this.normalizeToolParams(event.toolName, event.toolParams)
        this.toolsUsed.push(event.toolName)
        this.onChunk({ type: 'tool_start', toolName: event.toolName, toolParams: params })
        this.emitStatus('tool_running', messages, { currentTool: event.toolName, force: true })
        break
      }
      case 'tool_end':
        this.onChunk({ type: 'tool_result', toolName: event.toolName, toolResult: event.toolResult })
        this.emitStatus('thinking', messages, { force: true })
        break
      case 'turn_end':
        this.toolRounds = event.round
        this.emitStatus('thinking', messages, { force: true })
        break
      case 'usage_update':
        this.totalUsage = { ...event.usage }
        this.emitStatus('responding', messages, { force: true })
        break
    }
  }

  cloneUsage(): TokenUsage {
    return {
      promptTokens: this.totalUsage.promptTokens,
      completionTokens: this.totalUsage.completionTokens,
      totalTokens: this.totalUsage.totalTokens,
    }
  }

  emitStatus(
    phase: AgentRuntimeStatus['phase'],
    messages: PiMessage[],
    options?: {
      pendingUserMessage?: string
      currentTool?: string
      force?: boolean
    }
  ): void {
    const now = Date.now()
    if (!options?.force && now - this.lastStatusAt < 240) {
      return
    }
    this.lastStatusAt = now

    const contextTokens = this.estimateContextTokens(this.systemPrompt, messages, options?.pendingUserMessage)

    const status: AgentRuntimeStatus = {
      phase,
      round: this.toolRounds,
      toolsUsed: this.toolsUsed.length,
      currentTool: options?.currentTool,
      contextTokens,
      totalUsage: this.cloneUsage(),
      updatedAt: now,
    }

    this.onChunk({ type: 'status', status })
  }

  normalizeToolParams(toolName: string, params: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...params }

    const toolsWithLimit = ['search_messages', 'get_recent_messages', 'get_conversation_between']
    if (this.context.maxMessagesLimit && toolsWithLimit.includes(toolName)) {
      normalized.limit = this.context.maxMessagesLimit
    }

    if (this.context.timeFilter && (toolName === 'search_messages' || toolName === 'get_recent_messages')) {
      normalized._timeFilter = this.context.timeFilter
    }

    return normalized
  }

  // ==================== Token 估算（内部方法） ====================

  private estimateTokensFromText(text: string): number {
    if (!text) return 0
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!normalized) return 0
    const cjkCount = (normalized.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length
    const latinCount = normalized.length - cjkCount
    return Math.max(1, Math.ceil(cjkCount * 1.15 + latinCount / 4))
  }

  private extractMessageText(message: PiMessage): string {
    if (message.role === 'user') {
      if (typeof message.content === 'string') return message.content
      return message.content
        .map((item) => {
          if (item.type === 'text') return item.text
          if (item.type === 'image') return '[image]'
          return ''
        })
        .join('\n')
    }

    if (message.role === 'assistant') {
      return message.content
        .map((item) => {
          if (item.type === 'text') return item.text
          if (item.type === 'thinking') return item.thinking
          if (item.type === 'toolCall') return `${item.name} ${JSON.stringify(item.arguments || {})}`
          return ''
        })
        .join('\n')
    }

    if (message.role === 'toolResult') {
      return message.content
        .map((item) => {
          if (item.type === 'text') return item.text
          return '[binary]'
        })
        .join('\n')
    }

    return ''
  }

  private estimateContextTokens(systemPrompt: string, messages: PiMessage[], pendingUserMessage?: string): number {
    let tokens = this.estimateTokensFromText(systemPrompt)
    for (const message of messages) {
      if (message.role === 'toolResult') continue
      tokens += this.estimateTokensFromText(this.extractMessageText(message))
    }
    if (pendingUserMessage) {
      tokens += this.estimateTokensFromText(pendingUserMessage)
    }
    return tokens
  }
}
