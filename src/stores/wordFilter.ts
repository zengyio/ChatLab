import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface WordFilterScheme {
  id: string
  name: string
  words: string[]
  createdAt: number
}

/**
 * 词云过滤方案管理
 * 支持全局默认方案 + 会话级覆盖
 */
export const useWordFilterStore = defineStore(
  'wordFilter',
  () => {
    const schemes = ref<WordFilterScheme[]>([])
    const defaultSchemeId = ref<string | null>(null)
    const sessionSchemeOverrides = ref<Record<string, string | null>>({})
    const showWordFilterModal = ref(false)

    function generateId(): string {
      return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }

    function createScheme(name: string, words: string[] = []): WordFilterScheme {
      const scheme: WordFilterScheme = {
        id: generateId(),
        name,
        words: [...words],
        createdAt: Date.now(),
      }
      schemes.value.push(scheme)
      return scheme
    }

    function updateScheme(id: string, patch: Partial<Pick<WordFilterScheme, 'name' | 'words'>>) {
      const scheme = schemes.value.find((s) => s.id === id)
      if (!scheme) return
      if (patch.name !== undefined) scheme.name = patch.name
      if (patch.words !== undefined) scheme.words = [...patch.words]
    }

    function deleteScheme(id: string) {
      schemes.value = schemes.value.filter((s) => s.id !== id)
      if (defaultSchemeId.value === id) {
        defaultSchemeId.value = null
      }
      for (const [sessionId, schemeId] of Object.entries(sessionSchemeOverrides.value)) {
        if (schemeId === id) {
          delete sessionSchemeOverrides.value[sessionId]
        }
      }
    }

    function setDefaultScheme(id: string | null) {
      defaultSchemeId.value = id
    }

    function setSessionScheme(sessionId: string, schemeId: string | null) {
      sessionSchemeOverrides.value[sessionId] = schemeId
    }

    function clearSessionScheme(sessionId: string) {
      delete sessionSchemeOverrides.value[sessionId]
    }

    /**
     * 获取某个会话生效的方案 ID：会话显式覆盖 > 全局默认 > null
     */
    function getActiveSchemeId(sessionId: string): string | null {
      if (sessionId in sessionSchemeOverrides.value) {
        return sessionSchemeOverrides.value[sessionId]
      }
      return defaultSchemeId.value
    }

    /**
     * 获取某个会话生效的过滤词列表
     */
    function getExcludeWords(sessionId: string): string[] {
      const schemeId = getActiveSchemeId(sessionId)
      if (!schemeId) return []
      const scheme = schemes.value.find((s) => s.id === schemeId)
      return scheme?.words ?? []
    }

    function getSchemeById(id: string): WordFilterScheme | undefined {
      return schemes.value.find((s) => s.id === id)
    }

    const schemeOptions = computed(() =>
      schemes.value.map((s) => ({
        label: s.name,
        value: s.id,
        isDefault: s.id === defaultSchemeId.value,
        wordCount: s.words.length,
      }))
    )

    function openModal() {
      showWordFilterModal.value = true
    }

    function closeModal() {
      showWordFilterModal.value = false
    }

    return {
      schemes,
      defaultSchemeId,
      sessionSchemeOverrides,
      showWordFilterModal,
      schemeOptions,
      createScheme,
      updateScheme,
      deleteScheme,
      setDefaultScheme,
      setSessionScheme,
      clearSessionScheme,
      getActiveSchemeId,
      getExcludeWords,
      getSchemeById,
      openModal,
      closeModal,
    }
  },
  {
    persist: false,
    backendPersist: {
      pick: ['schemes', 'defaultSchemeId', 'sessionSchemeOverrides'],
      key: 'wordFilter',
    },
  }
)
