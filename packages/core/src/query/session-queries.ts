/**
 * 会话查询模块（平台无关）
 *
 * 纯 SQL 查询函数，接收 DatabaseAdapter 参数，不依赖全局状态。
 * 这些函数是 CLI/MCP/HTTP API 查询会话数据的基础。
 */

import type { TimeFilter } from '@openchatlab/shared-types'
import type { DatabaseAdapter } from '../interfaces'
import { hasTable } from './filters'
import { getMemberActivity } from './basic-queries'

export interface SessionMeta {
  name: string
  platform: string
  type: string
  importedAt: number
  groupId: string | null
  groupAvatar: string | null
  ownerId: string | null
}

export interface SessionOverview {
  totalMessages: number
  totalMembers: number
  firstMessageTs: number | null
  lastMessageTs: number | null
}

export interface SessionInfo extends SessionMeta {
  id: string
  overview: SessionOverview
}

/**
 * 判断数据库是否为聊天会话数据库
 * 通过核心三表（meta/member/message）存在性快速识别
 */
export function isChatSessionDb(db: DatabaseAdapter): boolean {
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name IN ('meta', 'member', 'message')")
    .get() as { cnt: number } | undefined
  return row?.cnt === 3
}

/**
 * 读取会话元信息
 */
export function getSessionMeta(db: DatabaseAdapter): SessionMeta | null {
  const row = db.prepare('SELECT * FROM meta LIMIT 1').get() as Record<string, unknown> | undefined
  if (!row) return null

  return {
    name: row.name as string,
    platform: row.platform as string,
    type: row.type as string,
    importedAt: row.imported_at as number,
    groupId: (row.group_id as string) || null,
    groupAvatar: (row.group_avatar as string) || null,
    ownerId: (row.owner_id as string) || null,
  }
}

/**
 * 查询会话基础统计（消息数、成员数、时间范围）
 */
export function getSessionOverview(db: DatabaseAdapter): SessionOverview {
  const msgRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM message msg
       JOIN member m ON msg.sender_id = m.id
       WHERE COALESCE(m.account_name, '') != '系统消息'`
    )
    .get() as { count: number }

  const memberRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM member
       WHERE COALESCE(account_name, '') != '系统消息'`
    )
    .get() as { count: number }

  const firstTs = (db.prepare('SELECT MIN(ts) as v FROM message').get() as { v: number | null })?.v ?? null
  const lastTs = (db.prepare('SELECT MAX(ts) as v FROM message').get() as { v: number | null })?.v ?? null

  return {
    totalMessages: msgRow.count,
    totalMembers: memberRow.count,
    firstMessageTs: firstTs,
    lastMessageTs: lastTs,
  }
}

/**
 * 获取数据库中的表结构（Schema）
 */
export function getDatabaseSchema(db: DatabaseAdapter): Array<{ name: string; sql: string }> {
  return db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string; sql: string }>
}

// ==================== Chat Overview & Session Queries ====================

export interface ChatOverviewData {
  name: string
  platform: string
  type: string
  totalMessages: number
  totalMembers: number
  firstMessageTs: number | null
  lastMessageTs: number | null
  topMembers: Array<{ id: number; name: string; count: number }>
}

export interface SessionSearchItem {
  id: number
  startTs: number
  endTs: number
  messageCount: number
  isComplete: boolean
  previewMessages: Array<{
    id: number
    senderName: string
    content: string | null
    timestamp: number
  }>
}

export interface SessionMessagesData {
  sessionId: number
  startTs: number
  endTs: number
  messageCount: number
  returnedCount: number
  participants: string[]
  messages: Array<{
    id: number
    senderName: string
    content: string | null
    timestamp: number
  }>
}

export interface SessionSummaryData {
  id: number
  startTs: number
  endTs: number
  messageCount: number
  participants: string[]
  summary: string | null
}

/**
 * Get chat overview by composing meta, overview stats, and top members.
 * Simpler than Electron version — no cache layer, direct SQL.
 */
export function getChatOverview(db: DatabaseAdapter, topN: number = 10): ChatOverviewData | null {
  const meta = getSessionMeta(db)
  if (!meta) return null

  const overview = getSessionOverview(db)
  const members = getMemberActivity(db)

  const topMembers = members.slice(0, topN).map((m) => ({
    id: m.memberId,
    name: m.name,
    count: m.messageCount,
  }))

  return {
    name: meta.name,
    platform: meta.platform,
    type: meta.type,
    totalMessages: overview.totalMessages,
    totalMembers: overview.totalMembers,
    firstMessageTs: overview.firstMessageTs,
    lastMessageTs: overview.lastMessageTs,
    topMembers,
  }
}

/**
 * Search chat sessions with optional keyword and time filters.
 * Requires chat_session and message_context tables (session indexing).
 * Uses LIKE-based keyword search (no FTS dependency).
 */
export function searchSessions(
  db: DatabaseAdapter,
  keywords?: string[],
  timeFilter?: TimeFilter,
  limit: number = 20,
  previewCount: number = 5
): SessionSearchItem[] {
  if (!hasTable(db, 'chat_session')) return []

  let sessionSql = `
    SELECT cs.id, cs.start_ts as startTs, cs.end_ts as endTs, cs.message_count as messageCount
    FROM chat_session cs WHERE 1=1
  `
  const params: unknown[] = []

  if (timeFilter?.startTs !== undefined) {
    sessionSql += ' AND cs.start_ts >= ?'
    params.push(timeFilter.startTs)
  }
  if (timeFilter?.endTs !== undefined) {
    sessionSql += ' AND cs.end_ts <= ?'
    params.push(timeFilter.endTs)
  }

  if (keywords && keywords.length > 0) {
    const keywordConditions = keywords.map(() => 'm.content LIKE ?').join(' OR ')
    sessionSql += `
      AND cs.id IN (
        SELECT DISTINCT mc.session_id FROM message_context mc
        JOIN message m ON m.id = mc.message_id
        WHERE (${keywordConditions})
      )
    `
    for (const kw of keywords) {
      params.push(`%${kw}%`)
    }
  }

  sessionSql += ' ORDER BY cs.start_ts DESC LIMIT ?'
  params.push(limit)

  const sessions = db.prepare(sessionSql).all(...params) as Array<{
    id: number
    startTs: number
    endTs: number
    messageCount: number
  }>

  const previewSql = `
    SELECT m.id, COALESCE(mb.group_nickname, mb.account_name, mb.platform_id) as senderName,
           m.content, m.ts as timestamp
    FROM message_context mc
    JOIN message m ON m.id = mc.message_id
    JOIN member mb ON mb.id = m.sender_id
    WHERE mc.session_id = ? ORDER BY m.ts ASC LIMIT ?
  `

  return sessions.map((session) => {
    const previewMessages = db.prepare(previewSql).all(session.id, previewCount) as Array<{
      id: number
      senderName: string
      content: string | null
      timestamp: number
    }>

    return {
      id: session.id,
      startTs: session.startTs,
      endTs: session.endTs,
      messageCount: session.messageCount,
      isComplete: session.messageCount <= previewCount,
      previewMessages,
    }
  })
}

/**
 * Get messages for a specific chat session
 */
export function getSessionMessages(
  db: DatabaseAdapter,
  chatSessionId: number,
  limit: number = 500
): SessionMessagesData | null {
  if (!hasTable(db, 'chat_session')) return null

  const session = db
    .prepare(
      `SELECT id, start_ts as startTs, end_ts as endTs, message_count as messageCount
       FROM chat_session WHERE id = ?`
    )
    .get(chatSessionId) as { id: number; startTs: number; endTs: number; messageCount: number } | undefined

  if (!session) return null

  const messages = db
    .prepare(
      `SELECT m.id, COALESCE(mb.group_nickname, mb.account_name, mb.platform_id) as senderName,
              m.content, m.ts as timestamp
       FROM message_context mc
       JOIN message m ON m.id = mc.message_id
       JOIN member mb ON mb.id = m.sender_id
       WHERE mc.session_id = ? ORDER BY m.ts ASC LIMIT ?`
    )
    .all(chatSessionId, limit) as Array<{
    id: number
    senderName: string
    content: string | null
    timestamp: number
  }>

  const participantsSet = new Set<string>()
  for (const msg of messages) {
    participantsSet.add(msg.senderName)
  }

  return {
    sessionId: session.id,
    startTs: session.startTs,
    endTs: session.endTs,
    messageCount: session.messageCount,
    returnedCount: messages.length,
    participants: Array.from(participantsSet),
    messages,
  }
}

/**
 * Get session summaries (only sessions that have AI-generated summaries)
 */
export function getSessionSummaries(
  db: DatabaseAdapter,
  options?: { limit?: number; timeFilter?: TimeFilter }
): SessionSummaryData[] {
  if (!hasTable(db, 'chat_session')) return []

  const { limit = 50, timeFilter } = options ?? {}

  let sql = `
    SELECT cs.id, cs.start_ts as startTs, cs.end_ts as endTs,
           cs.message_count as messageCount, cs.summary
    FROM chat_session cs
    WHERE cs.summary IS NOT NULL AND cs.summary != ''
  `
  const params: unknown[] = []

  if (timeFilter?.startTs !== undefined) {
    sql += ' AND cs.start_ts >= ?'
    params.push(timeFilter.startTs)
  }
  if (timeFilter?.endTs !== undefined) {
    sql += ' AND cs.start_ts <= ?'
    params.push(timeFilter.endTs)
  }

  sql += ' ORDER BY cs.start_ts DESC LIMIT ?'
  params.push(limit)

  const sessions = db.prepare(sql).all(...params) as Array<{
    id: number
    startTs: number
    endTs: number
    messageCount: number
    summary: string | null
  }>

  const participantsSql = `
    SELECT DISTINCT COALESCE(mb.group_nickname, mb.account_name, mb.platform_id) as name
    FROM message_context mc
    JOIN message m ON m.id = mc.message_id
    JOIN member mb ON mb.id = m.sender_id
    WHERE mc.session_id = ? LIMIT 10
  `

  return sessions.map((session) => {
    const participants = db.prepare(participantsSql).all(session.id) as Array<{ name: string }>

    return {
      id: session.id,
      startTs: session.startTs,
      endTs: session.endTs,
      messageCount: session.messageCount,
      participants: participants.map((p) => p.name),
      summary: session.summary,
    }
  })
}
