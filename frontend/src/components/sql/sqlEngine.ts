// ─────────────────────────────────────────────────────────────────────────────
// Единый движок SQL-лаборатории:
//  • PostgreSQL 17 (WASM через @electric-sql/pglite) в выделенном Web Worker:
//    загрузка WASM, initdb и выполнение запросов не блокируют основной поток UI!
//  • Мгновенный сброс схемы через DROP SCHEMA public CASCADE (< 5 мс вместо перезапуска WASM).
//  • Тёплый singleton-воркер: повторное открытие /sql работает мгновенно.
//  • Автоматический fallback на main-thread PGlite, если браузер ограничивает Worker.
// ─────────────────────────────────────────────────────────────────────────────

export * from './sqlTypes'
import {
  pgOidToName,
  parseSqlError,
  type DbEngineKind,
  type SqlExecOutcome,
  type SqlResultSet,
  type SqlCommandNote,
  type TableSchemaInfo,
  type TableColumnInfo,
} from './sqlTypes'

// ── Shared warm PostgreSQL Web Worker RPC client ──
let sharedWorker: Worker | null = null
let workerFailed = false
let rpcSeq = 1
const pendingRpc = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()

function getPgWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null
  if (sharedWorker) return sharedWorker
  try {
    const w = new Worker(new URL('./pgWorker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (ev: MessageEvent) => {
      const { id, ok, result, error } = ev.data || {}
      const entry = pendingRpc.get(id)
      if (!entry) return
      pendingRpc.delete(id)
      if (ok) entry.resolve(result)
      else entry.reject(new Error(error || 'PostgreSQL worker error'))
    }
    w.onerror = (err) => {
      workerFailed = true
      sharedWorker = null
      const msg = new Error(err?.message || 'PostgreSQL worker failed')
      for (const [, entry] of pendingRpc) entry.reject(msg)
      pendingRpc.clear()
      try { w.terminate() } catch {}
    }
    sharedWorker = w
    return w
  } catch {
    workerFailed = true
    return null
  }
}

function callPgWorker<T = any>(op: 'init' | 'reset' | 'exec' | 'inspect' | 'close', sql?: string): Promise<T> {
  const w = getPgWorker()
  if (!w) return Promise.reject(new Error('Web Worker unavailable'))
  const id = rpcSeq++
  return new Promise<T>((resolve, reject) => {
    pendingRpc.set(id, { resolve, reject })
    w.postMessage({ id, op, sql })
  })
}

// ── Fallback main-thread PGlite singleton (used only if Web Worker is blocked) ──
let fallbackPg: any = null
let fallbackPgVer = 'PostgreSQL 17'

interface SqlJsDb {
  run(sql: string): void
  exec(sql: string): { columns: string[]; values: unknown[][] }[]
  getRowsModified(): number
  close(): void
}
interface SqlJsEngine {
  Database: new (data?: ArrayLike<number> | null) => SqlJsDb
}

export class SqlLabSession {
  private kind: DbEngineKind = 'postgres'
  private useWorker = true
  private sqliteEngine: SqlJsEngine | null = null
  private sqliteDb: SqlJsDb | null = null
  public versionLabel = 'PostgreSQL 17'

  getEngine(): DbEngineKind {
    return this.kind
  }

  async init(kind: DbEngineKind): Promise<string> {
    this.kind = kind
    if (kind === 'postgres') {
      await this.closeSqlite()
      if (!workerFailed && typeof Worker !== 'undefined') {
        try {
          const ver = await callPgWorker<string>('init')
          this.useWorker = true
          this.versionLabel = ver || 'PostgreSQL 17'
          return this.versionLabel
        } catch {
          this.useWorker = false
          workerFailed = true
        }
      } else {
        this.useWorker = false
      }
      await this.ensureFallbackPg()
      return this.versionLabel
    } else {
      if (!this.sqliteEngine) {
        const initmod = (await import('sql.js')) as unknown as {
          default?: (cfg?: object) => Promise<SqlJsEngine>
        } & ((cfg?: object) => Promise<SqlJsEngine>)
        const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default
        this.sqliteEngine = await (typeof initmod.default === 'function' ? initmod.default : initmod)({
          locateFile: () => wasmUrl,
        })
      }
      await this.reset()
      return this.versionLabel
    }
  }

  private async ensureFallbackPg(): Promise<void> {
    if (!fallbackPg) {
      const mod = await import('@electric-sql/pglite')
      fallbackPg = await mod.PGlite.create()
      try {
        const vr = await fallbackPg.query('SELECT version() AS v')
        const raw = String((vr?.rows?.[0] as any)?.v || '')
        const m = raw.match(/PostgreSQL\s+([\d.]+)/i)
        fallbackPgVer = m ? `PostgreSQL ${m[1]}` : 'PostgreSQL 17'
      } catch {
        fallbackPgVer = 'PostgreSQL 17'
      }
    }
    this.versionLabel = fallbackPgVer
  }

  async reset(): Promise<void> {
    if (this.kind === 'postgres') {
      if (this.useWorker && !workerFailed) {
        try {
          const ver = await callPgWorker<string>('reset')
          this.versionLabel = ver || this.versionLabel
          return
        } catch {
          this.useWorker = false
          workerFailed = true
        }
      }
      await this.ensureFallbackPg()
      try {
        await fallbackPg.exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
      } catch {
        try { await fallbackPg?.close() } catch {}
        fallbackPg = null
        await this.ensureFallbackPg()
      }
    } else {
      await this.closeSqlite()
      if (!this.sqliteEngine) throw new Error('SQLite engine not initialized')
      this.sqliteDb = new this.sqliteEngine.Database()
      try {
        this.sqliteDb.run('PRAGMA foreign_keys = ON;')
        const vr = this.sqliteDb.exec('SELECT sqlite_version()')
        const ver = vr?.[0]?.values?.[0]?.[0]
        this.versionLabel = ver ? `SQLite ${ver}` : 'SQLite 3'
      } catch {
        this.versionLabel = 'SQLite 3'
      }
    }
  }

  async execute(sql: string): Promise<SqlExecOutcome> {
    const trimmed = (sql || '').trim()
    if (!trimmed) {
      return { results: [], notices: [], durationMs: 0 }
    }

    if (this.kind === 'postgres') {
      if (this.useWorker && !workerFailed) {
        try {
          return await callPgWorker<SqlExecOutcome>('exec', trimmed)
        } catch {
          this.useWorker = false
          workerFailed = true
        }
      }
      const t0 = performance.now()
      await this.ensureFallbackPg()
      try {
        const rawList: any[] = await fallbackPg.exec(trimmed, { rowMode: 'array' })
        const results: SqlResultSet[] = []
        const notices: SqlCommandNote[] = []
        for (const item of rawList || []) {
          const fields = Array.isArray(item.fields) ? item.fields : []
          const rows = Array.isArray(item.rows) ? item.rows : []
          const cmd = item.command ? String(item.command) : undefined
          const rc = typeof item.rowCount === 'number'
            ? item.rowCount
            : (typeof item.affectedRows === 'number' ? item.affectedRows : undefined)
          if (fields.length > 0) {
            results.push({
              columns: fields.map((f: any) => ({
                name: String(f.name ?? '?'),
                typeName: pgOidToName(f.dataTypeID),
              })),
              rows,
              command: cmd,
              rowCount: rows.length,
            })
          } else if (cmd || rc !== undefined) {
            notices.push({ command: cmd || 'OK', rowCount: rc })
          }
        }
        return {
          results,
          notices,
          durationMs: Math.max(0.1, Number((performance.now() - t0).toFixed(1))),
        }
      } catch (err: any) {
        return {
          results: [],
          notices: [],
          durationMs: Math.max(0.1, Number((performance.now() - t0).toFixed(1))),
          error: parseSqlError(err, trimmed),
        }
      }
    } else {
      const t0 = performance.now()
      if (!this.sqliteDb) await this.reset()
      try {
        const raw = this.sqliteDb!.exec(trimmed)
        const results: SqlResultSet[] = (raw || []).map(r => ({
          columns: r.columns.map(c => ({ name: c })),
          rows: r.values,
          command: 'SELECT',
          rowCount: r.values.length,
        }))
        const notices: SqlCommandNote[] = []
        if (results.length === 0) {
          let mod = 0
          try { mod = this.sqliteDb!.getRowsModified() } catch {}
          notices.push({ command: 'OK', rowCount: mod })
        }
        return {
          results,
          notices,
          durationMs: Math.max(0.1, Number((performance.now() - t0).toFixed(1))),
        }
      } catch (err: any) {
        return {
          results: [],
          notices: [],
          durationMs: Math.max(0.1, Number((performance.now() - t0).toFixed(1))),
          error: parseSqlError(err, trimmed),
        }
      }
    }
  }

  async inspectSchema(): Promise<TableSchemaInfo[]> {
    if (this.kind === 'postgres') {
      if (this.useWorker && !workerFailed) {
        try {
          return await callPgWorker<TableSchemaInfo[]>('inspect')
        } catch {
          this.useWorker = false
          workerFailed = true
        }
      }
      if (!fallbackPg) return []
      try {
        const tblRes = await fallbackPg.query(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_type, table_name
        `)
        const colsRes = await fallbackPg.query(`
          SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `)
        const pkRes = await fallbackPg.query(`
          SELECT kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'
        `)
        const fkRes = await fallbackPg.query(`
          SELECT
            kcu.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.constraint_type = 'FOREIGN KEY'
        `)
        const pkSet = new Set<string>((pkRes.rows || []).map((r: any) => `${r.table_name}.${r.column_name}`))
        const fkMap = new Map<string, { table: string; column: string }>()
        for (const r of fkRes.rows || []) {
          fkMap.set(`${r.table_name}.${r.column_name}`, { table: String(r.foreign_table), column: String(r.foreign_column) })
        }
        const colsByTable = new Map<string, TableColumnInfo[]>()
        for (const c of colsRes.rows || []) {
          const tname = String(c.table_name)
          const cname = String(c.column_name)
          const rawType = String(c.udt_name || c.data_type || '')
          const prettyType = rawType.startsWith('_') ? `${rawType.slice(1)}[]` : rawType
          const list = colsByTable.get(tname) || []
          list.push({
            name: cname,
            type: prettyType,
            nullable: String(c.is_nullable).toUpperCase() === 'YES',
            isPk: pkSet.has(`${tname}.${cname}`),
            fkTarget: fkMap.get(`${tname}.${cname}`),
            defaultVal: c.column_default ? String(c.column_default) : null,
          })
          colsByTable.set(tname, list)
        }
        const out: TableSchemaInfo[] = []
        for (const t of tblRes.rows || []) {
          const name = String(t.table_name)
          const kind: 'table' | 'view' = String(t.table_type).toUpperCase().includes('VIEW') ? 'view' : 'table'
          let rowCount = 0
          try {
            const safeIdent = name.replace(/"/g, '""')
            const cnt = await fallbackPg.query(`SELECT COUNT(*)::int AS c FROM "public"."${safeIdent}"`)
            rowCount = Number(cnt.rows?.[0]?.c || 0)
          } catch {}
          out.push({ name, kind, rowCount, columns: colsByTable.get(name) || [] })
        }
        return out
      } catch {
        return []
      }
    } else {
      if (!this.sqliteDb) return []
      try {
        const list = this.sqliteDb.exec(
          "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        if (!list.length) return []
        const out: TableSchemaInfo[] = []
        for (const row of list[0].values) {
          const name = String(row[0])
          const kind: 'table' | 'view' = String(row[1]) === 'view' ? 'view' : 'table'
          const safe = name.replace(/"/g, '""')
          const fkMap = new Map<string, { table: string; column: string }>()
          try {
            const fks = this.sqliteDb.exec(`PRAGMA foreign_key_list("${safe}")`)
            if (fks.length) {
              for (const fk of fks[0].values) {
                fkMap.set(String(fk[3]), { table: String(fk[2]), column: String(fk[4] || 'id') })
              }
            }
          } catch {}
          const columns: TableColumnInfo[] = []
          try {
            const cols = this.sqliteDb.exec(`PRAGMA table_info("${safe}")`)
            if (cols.length) {
              for (const c of cols[0].values) {
                const cname = String(c[1])
                columns.push({
                  name: cname,
                  type: String(c[2] || 'ANY').toLowerCase(),
                  nullable: Number(c[3]) === 0,
                  isPk: Number(c[5]) > 0,
                  fkTarget: fkMap.get(cname),
                  defaultVal: c[4] != null ? String(c[4]) : null,
                })
              }
            }
          } catch {}
          let rowCount = 0
          try {
            const cnt = this.sqliteDb.exec(`SELECT COUNT(*) FROM "${safe}"`)
            rowCount = Number(cnt?.[0]?.values?.[0]?.[0] || 0)
          } catch {}
          out.push({ name, kind, rowCount, columns })
        }
        return out
      } catch {
        return []
      }
    }
  }

  private async closeSqlite() {
    if (this.sqliteDb) {
      try { this.sqliteDb.close() } catch {}
      this.sqliteDb = null
    }
  }

  async destroy() {
    // Keep the warm PostgreSQL Web Worker alive across route switches so re-opening /sql is instant!
    await this.closeSqlite()
  }
}

// Аккуратное форматирование SQL (верхний регистр ключевых слов + переносы клауз)
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'RETURNING', 'WITH', 'AS', 'DISTINCT',
  'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'PRIMARY', 'KEY',
  'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'DEFAULT', 'CHECK', 'UNIQUE', 'SERIAL', 'BIGSERIAL',
  'INTEGER', 'INT', 'TEXT', 'VARCHAR', 'NUMERIC', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP',
  'TIMESTAMPTZ', 'JSONB', 'JSON', 'UUID', 'AND', 'OR', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'IS',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'OVER', 'PARTITION', 'DESC', 'ASC', 'NULLS', 'FIRST', 'LAST',
  'EXPLAIN', 'ANALYZE', 'IF', 'EXISTS', 'CASCADE', 'FILTER', 'COALESCE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND',
])

const NEWLINE_CLAUSES = /\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|JOIN|GROUP BY|HAVING|ORDER BY|LIMIT|OFFSET|RETURNING|UNION ALL|UNION)\b/gi

export function formatSqlLite(sql: string): string {
  const tokens: string[] = []
  const masked = sql.replace(/('(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/)/g, m => {
    const id = tokens.push(m) - 1
    return `__SQLTOK_${id}__`
  })
  const upper = masked.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, w => {
    const u = w.toUpperCase()
    return SQL_KEYWORDS.has(u) ? u : w
  })
  let out = upper
  if (out.split('\n').length <= 2 && /^\s*(SELECT|WITH)\b/i.test(out)) {
    out = out
      .replace(/\s+/g, ' ')
      .trim()
      .replace(NEWLINE_CLAUSES, m => '\n' + m.toUpperCase())
      .replace(/^\n/, '')
  }
  return out.replace(/__SQLTOK_(\d+)__/g, (_, i) => tokens[Number(i)] ?? '')
}
