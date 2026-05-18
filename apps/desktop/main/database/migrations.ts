/**
 * Database migration — Electron adapter layer.
 *
 * Thin wrapper around @openchatlab/node-runtime shared migration definitions.
 * Keeps Electron-only concerns: i18n MigrationInfo, better-sqlite3 type bridging.
 */

import type Database from 'better-sqlite3'
import { CURRENT_SCHEMA_VERSION, runMigrations, needsMigration as coreNeedsMigration } from '@openchatlab/core'
import type { DatabaseAdapter } from '@openchatlab/core'
import { BetterSqliteAdapter, getChatDbMigrations } from '@openchatlab/node-runtime'
import { t } from '../i18n'
import { tokenizeForFts } from '@openchatlab/node-runtime'

export { CURRENT_SCHEMA_VERSION }

export interface MigrationInfo {
  version: number
  description: string
  userMessage: string
}

const i18nKeys: Array<{ descriptionKey: string; userMessageKey: string }> = [
  { descriptionKey: 'database.migrationV1Desc', userMessageKey: 'database.migrationV1Message' },
  { descriptionKey: 'database.migrationV2Desc', userMessageKey: 'database.migrationV2Message' },
  { descriptionKey: 'database.migrationV3Desc', userMessageKey: 'database.migrationV3Message' },
  { descriptionKey: 'database.migrationV4Desc', userMessageKey: 'database.migrationV4Message' },
]

function checkDatabaseIntegrity(db: DatabaseAdapter): { valid: boolean; error?: string } {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").all() as Array<{
      name: string
    }>
    if (tables.length === 0) {
      return { valid: false, error: t('database.integrityError') }
    }
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: t('database.checkFailed', { error: error instanceof Error ? error.message : String(error) }),
    }
  }
}

/**
 * Execute database migrations.
 * Wraps better-sqlite3 Database in a DatabaseAdapter and delegates to core runMigrations
 * with shared migration definitions from @openchatlab/node-runtime.
 */
export function migrateDatabase(db: Database.Database, forceRepair = false): boolean {
  const adapter = new BetterSqliteAdapter(db)

  const integrity = checkDatabaseIntegrity(adapter)
  if (!integrity.valid) {
    throw new Error(integrity.error)
  }

  const migrations = getChatDbMigrations({ tokenizeForFts })
  return runMigrations(adapter, migrations, forceRepair)
}

export function needsMigration(db: Database.Database): boolean {
  const adapter = new BetterSqliteAdapter(db)
  return coreNeedsMigration(adapter, CURRENT_SCHEMA_VERSION)
}

/**
 * Get pending migration info for UI display (with i18n).
 */
export function getPendingMigrationInfos(fromVersion = 0): MigrationInfo[] {
  const migrations = getChatDbMigrations({ tokenizeForFts })
  return migrations
    .filter((m) => m.version > fromVersion)
    .map((m, idx) => ({
      version: m.version,
      description: i18nKeys[idx] ? t(i18nKeys[idx].descriptionKey) : m.description,
      userMessage: i18nKeys[idx] ? t(i18nKeys[idx].userMessageKey) : m.description,
    }))
}
