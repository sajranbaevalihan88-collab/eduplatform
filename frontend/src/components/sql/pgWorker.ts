// Dedicated Web Worker for PostgreSQL 17 (PGlite WASM).
// Runs WASM compilation, initdb, query execution, and schema inspection completely
// off the UI main thread so opening /sql and running queries NEVER freezes the page.
import { PGlite } from '@electric-sql/pglite'
import {
  pgOidToName,
  parseSqlError,
  type SqlExecOutcome,
  type SqlResultSet,
  type SqlCommandNote,
  type TableSchemaInfo,
  type TableColumnInfo,
} from './sqlTypes'

let pg: any = null
let versionLabel = 'PostgreSQL 17'
let bootPromise: Promise<string> | null = null

async function ensurePg(): Promise<string> {
  if (pg) return versionLabel
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    const inst = await PGlite.create()
    pg = inst
    try {
      const vr = await inst.query('SELECT version() AS v')
      const raw = String((vr?.rows?.[0] as any)?.v || '')
      const m = raw.match(/PostgreSQL\s+([\d.]+)/i)
      versionLabel = m ? `PostgreSQL ${m[1]}` : 'PostgreSQL 17'
    } catch {
      versionLabel = 'PostgreSQL 17'
    }
    return versionLabel
  })()
  try {
    return await bootPromise
  } catch (err) {
    bootPromise = null
    pg = null
    throw err
  }
}

async function resetPublicSchema(): Promise<string> {
  await ensurePg()
  try {
    await pg.exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    return versionLabel
  } catch {
    // Fallback: recreate PGlite only if schema reset itself failed
    try { await pg?.close() } catch {}
    pg = null
    bootPromise = null
    return await ensurePg()
  }
}

async function execSql(sql: string): Promise<SqlExecOutcome> {
  const trimmed = (sql || '').trim()
  if (!trimmed) {
    return { results: [], notices: [], durationMs: 0 }
  }
  await ensurePg()
  const t0 = performance.now()
  try {
    const rawList: any[] = await pg.exec(trimmed, { rowMode: 'array' })
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
}

async function inspectSchema(): Promise<TableSchemaInfo[]> {
  if (!pg) return []
  try {
    const tblRes = await pg.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_type, table_name
    `)
    const colsRes = await pg.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)
    const pkRes = await pg.query(`
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
    `)
    const fkRes = await pg.query(`
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
        const cnt = await pg.query(`SELECT COUNT(*)::int AS c FROM "public"."${safeIdent}"`)
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
}

self.onmessage = async (ev: MessageEvent) => {
  const { id, op, sql } = ev.data || {}
  try {
    let result: any
    if (op === 'init') {
      result = await ensurePg()
    } else if (op === 'reset') {
      result = await resetPublicSchema()
    } else if (op === 'exec') {
      result = await execSql(sql || '')
    } else if (op === 'inspect') {
      result = await inspectSchema()
    } else if (op === 'close') {
      if (pg) {
        try { await pg.close() } catch {}
        pg = null
        bootPromise = null
      }
      result = true
    } else {
      throw new Error(`Unknown worker op: ${String(op)}`)
    }
    ;(self as any).postMessage({ id, ok: true, result })
  } catch (err: any) {
    ;(self as any).postMessage({ id, ok: false, error: String(err?.message || err) })
  }
}
