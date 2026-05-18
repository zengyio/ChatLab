/**
 * 内置工具目录查询 — 从 @openchatlab/core 重导出
 */

import { BUILTIN_TOOL_CATALOG as _CATALOG } from '@openchatlab/core'

export type { BuiltinToolCatalogEntry } from '@openchatlab/core'

/**
 * 获取所有内置工具的目录（含分类），供前端展示
 */
export function getBuiltinToolCatalog() {
  return _CATALOG
}
