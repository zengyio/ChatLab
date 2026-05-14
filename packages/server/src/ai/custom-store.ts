/**
 * 自定义 Provider / Model 持久化存储（平台无关）
 *
 * 文件位置:
 *   - {aiDataDir}/custom-providers.json
 *   - {aiDataDir}/custom-models.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import type { ProviderDefinition, ModelDefinition } from '@openchatlab/core'

// ==================== Custom Providers ====================

function readProviders(aiDataDir: string): ProviderDefinition[] {
  const storePath = path.join(aiDataDir, 'custom-providers.json')
  if (!fs.existsSync(storePath)) return []
  try {
    const content = fs.readFileSync(storePath, 'utf-8')
    return JSON.parse(content) as ProviderDefinition[]
  } catch {
    return []
  }
}

function writeProviders(aiDataDir: string, providers: ProviderDefinition[]): void {
  const storePath = path.join(aiDataDir, 'custom-providers.json')
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(providers, null, 2), 'utf-8')
}

export function addCustomProvider(
  aiDataDir: string,
  input: Omit<ProviderDefinition, 'id' | 'builtin' | 'enabledByDefault'>
): ProviderDefinition {
  const providers = readProviders(aiDataDir)
  const newProvider: ProviderDefinition = {
    ...input,
    id: `custom:${randomUUID()}`,
    builtin: false,
    enabledByDefault: false,
  }
  providers.push(newProvider)
  writeProviders(aiDataDir, providers)
  return newProvider
}

export function updateCustomProvider(
  aiDataDir: string,
  id: string,
  updates: Partial<Omit<ProviderDefinition, 'id' | 'builtin'>>
): { success: boolean; error?: string } {
  const providers = readProviders(aiDataDir)
  const index = providers.findIndex((p) => p.id === id)
  if (index === -1) return { success: false, error: 'Custom provider not found' }

  providers[index] = { ...providers[index], ...updates }
  writeProviders(aiDataDir, providers)
  return { success: true }
}

export function deleteCustomProvider(aiDataDir: string, id: string): { success: boolean; error?: string } {
  const providers = readProviders(aiDataDir)
  const index = providers.findIndex((p) => p.id === id)
  if (index === -1) return { success: false, error: 'Custom provider not found' }

  providers.splice(index, 1)
  writeProviders(aiDataDir, providers)
  return { success: true }
}

// ==================== Custom Models ====================

function readModels(aiDataDir: string): ModelDefinition[] {
  const storePath = path.join(aiDataDir, 'custom-models.json')
  if (!fs.existsSync(storePath)) return []
  try {
    const content = fs.readFileSync(storePath, 'utf-8')
    return JSON.parse(content) as ModelDefinition[]
  } catch {
    return []
  }
}

function writeModels(aiDataDir: string, models: ModelDefinition[]): void {
  const storePath = path.join(aiDataDir, 'custom-models.json')
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(models, null, 2), 'utf-8')
}

export function addCustomModel(
  aiDataDir: string,
  input: Omit<ModelDefinition, 'builtin' | 'editable'>
): { success: boolean; model?: ModelDefinition; error?: string } {
  const models = readModels(aiDataDir)

  const existing = models.find((m) => m.id === input.id && m.providerId === input.providerId)
  if (existing) {
    return { success: false, error: `Model "${input.id}" already exists under provider "${input.providerId}"` }
  }

  const newModel: ModelDefinition = {
    ...input,
    builtin: false,
    editable: true,
  }
  models.push(newModel)
  writeModels(aiDataDir, models)
  return { success: true, model: newModel }
}

export function updateCustomModel(
  aiDataDir: string,
  providerId: string,
  modelId: string,
  updates: Partial<Omit<ModelDefinition, 'id' | 'providerId' | 'builtin'>>
): { success: boolean; error?: string } {
  const models = readModels(aiDataDir)
  const index = models.findIndex((m) => m.id === modelId && m.providerId === providerId)
  if (index === -1) return { success: false, error: 'Custom model not found' }

  models[index] = { ...models[index], ...updates }
  writeModels(aiDataDir, models)
  return { success: true }
}

export function deleteCustomModel(
  aiDataDir: string,
  providerId: string,
  modelId: string
): { success: boolean; error?: string } {
  const models = readModels(aiDataDir)
  const index = models.findIndex((m) => m.id === modelId && m.providerId === providerId)
  if (index === -1) return { success: false, error: 'Custom model not found' }

  models.splice(index, 1)
  writeModels(aiDataDir, models)
  return { success: true }
}
