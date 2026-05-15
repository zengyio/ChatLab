/**
 * SQL 查询过滤条件构建工具
 *
 * 平台无关的 WHERE 子句构建器和 schema 检测工具，供所有查询模块复用。
 */

import type { TimeFilter } from '@openchatlab/shared-types'
import type { DatabaseAdapter } from '../interfaces'

/**
 * 构建时间过滤 WHERE 子句
 * @param filter 时间过滤器（包含时间范围和成员筛选）
 * @param tableAlias 表别名，用于多表 JOIN 场景避免列名歧义（如 'msg'）
 */
export function buildTimeFilter(
  filter?: TimeFilter,
  tableAlias?: string
): { clause: string; params: (number | string)[] } {
  const conditions: string[] = []
  const params: (number | string)[] = []

  const tsColumn = tableAlias ? `${tableAlias}.ts` : 'ts'
  const senderIdColumn = tableAlias ? `${tableAlias}.sender_id` : 'sender_id'

  if (filter?.startTs !== undefined) {
    conditions.push(`${tsColumn} >= ?`)
    params.push(filter.startTs)
  }
  if (filter?.endTs !== undefined) {
    conditions.push(`${tsColumn} <= ?`)
    params.push(filter.endTs)
  }
  if (filter?.memberId !== undefined && filter?.memberId !== null) {
    conditions.push(`${senderIdColumn} = ?`)
    params.push(filter.memberId)
  }

  return {
    clause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

/**
 * Check if a table exists in the database
 */
export function hasTable(db: DatabaseAdapter, tableName: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(tableName)
  return row !== undefined
}

/**
 * Check if a column exists in a table
 */
export function hasColumn(db: DatabaseAdapter, tableName: string, columnName: string): boolean {
  const rows = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>
  if (!Array.isArray(rows)) return false
  return rows.some((r) => r.name === columnName)
}

/**
 * 构建排除系统消息的过滤条件
 */
export function buildSystemMessageFilter(existingClause: string): string {
  const systemFilter = "COALESCE(m.account_name, '') != '系统消息'"

  if (existingClause.includes('WHERE')) {
    return existingClause + ' AND ' + systemFilter
  } else {
    return ' WHERE ' + systemFilter
  }
}
