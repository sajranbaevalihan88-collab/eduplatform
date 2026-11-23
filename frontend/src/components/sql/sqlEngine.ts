// ─────────────────────────────────────────────────────────────────────────────
// Единый движок SQL-лаборатории:
//  • PostgreSQL 17 (WASM через @electric-sql/pglite — как на dbfiddle.dev)
//  • SQLite 3      (WASM через sql.js)
// Оба движка загружаются лениво и работают полностью локально в браузере.
// ─────────────────────────────────────────────────────────────────────────────

export type DbEngineKind = 'postgres' | 'sqlite'

export interface SqlColumnMeta {
  name: string
  typeName?: string
}

export interface SqlResultSet {
  columns: SqlColumnMeta[]
  rows: unknown[][]
  command?: string
  rowCount?: number
}

export interface SqlCommandNote {
  command: string
  rowCount?: number
}

export interface SqlErrorDetail {
  message: string
  code?: string
  detail?: string
  hint?: string
  line?: number
  col?: number
  snippet?: string
}

export interface SqlExecOutcome {
  results: SqlResultSet[]
  notices: SqlCommandNote[]
  durationMs: number
  error?: SqlErrorDetail
}

export interface TableColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPk: boolean
  fkTarget?: { table: string; column: string }
  defaultVal?: string | null
}

export interface TableSchemaInfo {
  name: string
  kind: 'table' | 'view'
  rowCount: number
  columns: TableColumnInfo[]
}

// Справочник PostgreSQL OID → понятное название типа колонки
const PG_OID_MAP: Record<number, string> = {
  16: 'bool',
  17: 'bytea',
  20: 'bigint',
  21: 'smallint',
  23: 'int4',
  25: 'text',
  26: 'oid',
  114: 'json',
  700: 'float4',
  701: 'float8',
  1000: 'bool[]',
  1005: 'int2[]',
  1007: 'int4[]',
  1009: 'text[]',
  1015: 'varchar[]',
  1016: 'int8[]',
  1042: 'char',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
  3807: 'jsonb[]',
}

export function pgOidToName(oid?: number): string | undefined {
  if (!oid) return undefined
  return PG_OID_MAP[oid] || `oid:${oid}`
}

function posToLineCol(sql: string, pos1Based: number): { line: number; col: number; snippet: string } {
  const idx = Math.max(0, Math.min(sql.length, pos1Based - 1))
  const before = sql.slice(0, idx)
  const lines = before.split('\n')
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  const allLines = sql.split('\n')
  const rawLine = allLines[line - 1] ?? ''
  const caret = ' '.repeat(Math.max(0, col - 1)) + '^'
  return { line, col, snippet: `${rawLine}\n${caret}` }
}

function parseSqlError(err: any, sql: string): SqlErrorDetail {
  const message = String(err?.message || err || 'Неизвестная ошибка SQL')
  const out: SqlErrorDetail = { message }
  if (err?.code) out.code = String(err.code)
  if (err?.detail) out.detail = String(err.detail)
  if (err?.hint) out.hint = String(err.hint)
  const posNum = err?.position ? parseInt(String(err.position), 10) : NaN
  if (!Number.isNaN(posNum) && posNum > 0) {
    const lc = posToLineCol(sql, posNum)
    out.line = lc.line
    out.col = lc.col
    out.snippet = lc.snippet
  }
  return out
}

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
  private pg: any = null
  private pgCtor: any = null
  private sqliteEngine: SqlJsEngine | null = null
  private sqliteDb: SqlJsDb | null = null
  public versionLabel = 'PostgreSQL WASM'

  getEngine(): DbEngineKind {
    return this.kind
  }

  async init(kind: DbEngineKind): Promise<string> {
    this.kind = kind
    if (kind === 'postgres') {
      await this.closeSqlite()
      if (!this.pgCtor) {
        const mod = await import('@electric-sql/pglite')
        this.pgCtor = mod.PGlite
      }
      await this.reset()
      return this.versionLabel
    } else {
      await this.closePg()
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

  async reset(): Promise<void> {
    if (this.kind === 'postgres') {
      await this.closePg()
      if (!this.pgCtor) {
        const mod = await import('@electric-sql/pglite')
        this.pgCtor = mod.PGlite
      }
      this.pg = await this.pgCtor.create()
      try {
        const vr = await this.pg.query('SELECT version() AS v')
        const raw = String(vr?.rows?.[0]?.v || '')
        const m = raw.match(/PostgreSQL\s+([\d.]+)/i)
        this.versionLabel = m ? `PostgreSQL ${m[1]}` : 'PostgreSQL 17'
      } catch {
        this.versionLabel = 'PostgreSQL 17'
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
    const t0 = performance.now()

    if (this.kind === 'postgres') {
      if (!this.pg) await this.reset()
      try {
        const rawList: any[] = await this.pg.exec(trimmed, { rowMode: 'array' })
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
      if (!this.pg) return []
      try {
        const tblRes = await this.pg.query(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_type, table_name
        `)
        const colsRes = await this.pg.query(`
          SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `)
        const pkRes = await this.pg.query(`
          SELECT kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'
        `)
        const fkRes = await this.pg.query(`
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

        const pkSet = new Set<string>(
          (pkRes.rows || []).map((r: any) => `${r.table_name}.${r.column_name}`)
        )
        const fkMap = new Map<string, { table: string; column: string }>()
        for (const r of fkRes.rows || []) {
          fkMap.set(`${r.table_name}.${r.column_name}`, {
            table: String(r.foreign_table),
            column: String(r.foreign_column),
          })
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
            const cnt = await this.pg.query(`SELECT COUNT(*)::int AS c FROM "public"."${safeIdent}"`)
            rowCount = Number(cnt.rows?.[0]?.c || 0)
          } catch {}
          out.push({
            name,
            kind,
            rowCount,
            columns: colsByTable.get(name) || [],
          })
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

  private async closePg() {
    if (this.pg) {
      try { await this.pg.close() } catch {}
      this.pg = null
    }
  }

  private async closeSqlite() {
    if (this.sqliteDb) {
      try { this.sqliteDb.close() } catch {}
      this.sqliteDb = null
    }
  }

  async destroy() {
    await this.closePg()
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
  // Сохраняем строковые литералы и -- комментарии нетронутыми
  const tokens: string[] = []
  const masked = sql.replace(/('(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/)/g, m => {
    const id = tokens.push(m) - 1
    return `__SQLTOK_${id}__`
  })
  const upper = masked.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, w => {
    const u = w.toUpperCase()
    return SQL_KEYWORDS.has(u) ? u : w
  })
  // Если запрос написан в одну строку (простой SELECT), раскладываем по клаузам
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
