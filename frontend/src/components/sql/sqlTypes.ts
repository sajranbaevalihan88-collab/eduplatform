// Shared pure types and helpers for SQL Lab (safe for both main thread & Web Worker)

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

export function posToLineCol(sql: string, pos1Based: number): { line: number; col: number; snippet: string } {
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

export function parseSqlError(err: any, sql: string): SqlErrorDetail {
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
