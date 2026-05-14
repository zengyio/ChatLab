/**
 * 远程 LLM API 操作（平台无关）
 *
 * - validateApiKey: 通过 completeSimple 发一条测试请求验证 key 有效性
 * - fetchRemoteModels: 调用 provider API 获取可用模型列表
 */

import { completeSimple } from '@openchatlab/node-runtime'
import { BUILTIN_PROVIDERS } from '@openchatlab/core'
import { buildPiModel, type AIServiceConfig } from './llm-config'

// ==================== Types ====================

export interface RemoteModel {
  id: string
  name: string
  ownedBy?: string
  contextWindow?: number
}

export interface FetchRemoteModelsResult {
  success: boolean
  models?: RemoteModel[]
  error?: string
}

// ==================== fetchRemoteModels ====================

/**
 * 根据 API 格式调用 provider 的模型列表端点:
 * - openai-completions / openai-responses → {baseUrl}/models
 * - google-generative-ai → {baseUrl}/v1beta/models?key={apiKey}
 * - anthropic-messages → 不支持
 */
export async function fetchRemoteModels(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  apiFormat?: string
): Promise<FetchRemoteModelsResult> {
  const effectiveApiFormat = apiFormat || 'openai-completions'

  if (effectiveApiFormat === 'anthropic-messages') {
    return { success: false, error: 'Anthropic does not support model listing via API' }
  }

  const providerDef = BUILTIN_PROVIDERS.find((p) => p.id === provider)
  const rawBaseUrl = baseUrl || providerDef?.defaultBaseUrl || ''
  if (!rawBaseUrl) {
    return { success: false, error: 'No base URL provided' }
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 15000)

  try {
    let url: string
    const headers: Record<string, string> = {}

    if (effectiveApiFormat === 'google-generative-ai') {
      const trimmed = rawBaseUrl.replace(/\/+$/, '').replace(/\/v1(beta)?$/, '')
      url = `${trimmed}/v1beta/models?key=${apiKey}`
    } else {
      let resolved = rawBaseUrl.replace(/\/+$/, '')
      try {
        const parsed = new URL(resolved)
        if (!resolved.endsWith('/v1') && (parsed.pathname === '/' || parsed.pathname === '')) {
          resolved = resolved + '/v1'
        }
      } catch {
        // ignore
      }
      url = `${resolved}/models`
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: abortController.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { success: false, error: `HTTP ${response.status}: ${body.slice(0, 200)}` }
    }

    const json = await response.json()

    let models: RemoteModel[]

    if (effectiveApiFormat === 'google-generative-ai') {
      const geminiModels = (json.models || []) as Array<{
        name?: string
        displayName?: string
        inputTokenLimit?: number
      }>
      models = geminiModels.map((m) => {
        const id = (m.name || '').replace(/^models\//, '')
        return {
          id,
          name: m.displayName || id,
          ownedBy: 'google',
          contextWindow: m.inputTokenLimit || undefined,
        }
      })
    } else {
      const data = (json.data || []) as Array<{
        id?: string
        owned_by?: string
        context_length?: number
      }>
      models = data
        .filter((m) => m.id)
        .map((m) => ({
          id: m.id!,
          name: m.id!,
          ownedBy: m.owned_by,
          contextWindow: m.context_length || undefined,
        }))
    }

    return { success: true, models }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('aborted') || message.includes('AbortError')) {
      return { success: false, error: 'Request timed out (15s)' }
    }
    return { success: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

// ==================== validateApiKey ====================

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
  apiFormat?: string
): Promise<{ success: boolean; error?: string }> {
  const providerDef = BUILTIN_PROVIDERS.find((p) => p.id === provider)
  const defaultModel = providerDef?.modelIds?.[0]

  const config: AIServiceConfig = {
    id: 'validate-temp',
    name: 'validate-temp',
    provider,
    apiKey,
    baseUrl,
    model: model || defaultModel,
    apiFormat,
  }
  const piModel = buildPiModel(config)

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 15000)

  try {
    const result = await completeSimple(
      piModel,
      {
        messages: [{ role: 'user', content: 'Hi', timestamp: Date.now() }] as any,
      },
      {
        apiKey,
        maxTokens: 1,
        signal: abortController.signal,
      }
    )
    if (result.stopReason === 'error' || result.stopReason === 'aborted') {
      return { success: false, error: result.errorMessage || 'Connection failed' }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('aborted') || message.includes('AbortError')) {
      return { success: false, error: 'Request timed out (15s)' }
    }
    return { success: false, error: message }
  } finally {
    clearTimeout(timeout)
  }
}
