import { useMemo, useState } from 'react'
import { Download, Copy, Check, ArrowUpDown, ArrowUp, ArrowDown, Search, FileJson, FileText } from 'lucide-react'
import type { SqlResultSet } from './sqlEngine'

function formatCellRaw(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    const iso = v.toISOString()
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.replace('T', ' ').slice(0, 19)
  }
  if (v instanceof Uint8Array) return `\\x${Array.from(v.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')}${v.length > 16 ? '…' : ''}`
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

function toCsv(res: SqlResultSet): string {
  const esc = (v: unknown) => {
    const s = formatCellRaw(v)
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const rows = [res.columns.map(c => esc(c.name)).join(',')].concat(
    res.rows.map(r => r.map(esc).join(','))
  )
  return '\ufeff' + rows.join('\n')
}

function toMarkdown(res: SqlResultSet): string {
  const esc = (v: unknown) => (v == null ? 'NULL' : formatCellRaw(v).replace(/\|/g, '\\|').replace(/\n/g, ' '))
  const head = '| ' + res.columns.map(c => c.name).join(' | ') + ' |'
  const sep = '| ' + res.columns.map(() => '---').join(' | ') + ' |'
  const body = res.rows.map(r => '| ' + r.map(esc).join(' | ') + ' |')
  return [head, sep, ...body].join('\n')
}

function toJsonString(res: SqlResultSet): string {
  const objs = res.rows.map(r => {
    const o: Record<string, unknown> = {}
    res.columns.forEach((c, idx) => { o[c.name] = r[idx] })
    return o
  })
  return JSON.stringify(objs, null, 2)
}

function downloadBlob(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function SqlResultTable({
  result,
  index,
  compact = false,
}: {
  result: SqlResultSet
  index: number
  compact?: boolean
}) {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter] = useState('')
  const [limit, setLimit] = useState(100)
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedJson, setExpandedJson] = useState<{ r: number; c: number; text: string } | null>(null)

  // Особое оформление для PostgreSQL EXPLAIN / EXPLAIN ANALYZE
  const isExplain =
    result.columns.length === 1 &&
    /^(QUERY PLAN|detail)$/i.test(result.columns[0].name)

  const filteredAndSorted = useMemo(() => {
    const q = filter.trim().toLowerCase()
    let rows = result.rows
    if (q) {
      rows = rows.filter(row => row.some(cell => formatCellRaw(cell).toLowerCase().includes(q)))
    }
    if (sortCol !== null) {
      const col = sortCol
      const mult = sortDir === 'asc' ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const va = a[col]
        const vb = b[col]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const na = Number(va)
        const nb = Number(vb)
        if (!Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '' && typeof va !== 'boolean' && typeof vb !== 'boolean') {
          return (na - nb) * mult
        }
        return formatCellRaw(va).localeCompare(formatCellRaw(vb), 'ru') * mult
      })
    }
    return rows
  }, [result.rows, filter, sortCol, sortDir])

  const toggleSort = (colIdx: number) => {
    if (sortCol !== colIdx) {
      setSortCol(colIdx)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortCol(null)
    }
  }

  const copyText = async (tag: string, txt: string) => {
    try {
      await navigator.clipboard.writeText(txt)
      setCopied(tag)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  if (isExplain) {
    return (
      <div className="rounded-lg border border-sky-900/60 bg-[#0d1520] overflow-hidden">
        <div className="px-3 py-1.5 bg-[#122033] border-b border-sky-900/50 flex items-center justify-between text-[11px]">
          <span className="font-bold text-sky-300 font-mono">PostgreSQL QUERY PLAN</span>
          <button
            type="button"
            onClick={() => copyText('plan', result.rows.map(r => String(r[0] ?? '')).join('\n'))}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-900/50 hover:bg-sky-800/70 text-sky-200 text-[10px]"
          >
            {copied === 'plan' ? <Check size={11} /> : <Copy size={11} />}
            {copied === 'plan' ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <pre className="p-3 text-[11.5px] leading-relaxed font-mono overflow-x-auto text-slate-200">
          {result.rows.map((r, i) => {
            const line = String(r[0] ?? '')
            const isTiming = /Planning Time|Execution Time/i.test(line)
            const isScan = /Seq Scan|Index Scan|Hash Join|Nested Loop|Sort|Aggregate|Bitmap/i.test(line)
            return (
              <div
                key={i}
                className={
                  isTiming
                    ? 'text-emerald-300 font-bold mt-1'
                    : isScan
                      ? 'text-amber-200'
                      : 'text-slate-300'
                }
              >
                {line}
              </div>
            )
          })}
        </pre>
      </div>
    )
  }

  const shownRows = filteredAndSorted.slice(0, limit)

  return (
    <div className="rounded-lg border border-[#2d333b] bg-[#161b22] overflow-hidden">
      {/* Панель таблицы */}
      <div className="px-2.5 py-1.5 bg-[#1c2128] border-b border-[#2d333b] flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono text-slate-400">
          <span className="text-sky-400 font-bold">#{index + 1}</span>
          {' · '}
          <span className="text-slate-200 font-semibold">{filteredAndSorted.length}</span>
          {filter && filteredAndSorted.length !== result.rows.length ? ` / ${result.rows.length}` : ''}
          {' строк · '}
          {result.columns.length} кол.
        </span>

        {result.rows.length > 3 && (
          <div className="relative flex items-center">
            <Search size={11} className="absolute left-2 text-slate-500 pointer-events-none" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Фильтр…"
              className="pl-6 pr-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px] text-slate-200 placeholder-slate-500 w-32 focus:w-44 focus:border-sky-500 outline-none transition-all"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => copyText('md', toMarkdown(result))}
            title="Копировать как Markdown-таблицу"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#262c36] hover:bg-[#323a46] text-slate-300 hover:text-white text-[10px]"
          >
            {copied === 'md' ? <Check size={10} className="text-emerald-400" /> : <FileText size={10} />}
            MD
          </button>
          <button
            type="button"
            onClick={() => copyText('json', toJsonString(result))}
            title="Копировать как JSON"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#262c36] hover:bg-[#323a46] text-slate-300 hover:text-white text-[10px]"
          >
            {copied === 'json' ? <Check size={10} className="text-emerald-400" /> : <FileJson size={10} />}
            JSON
          </button>
          <button
            type="button"
            onClick={() => downloadBlob(`result-${index + 1}.csv`, toCsv(result), 'text/csv;charset=utf-8')}
            title="Скачать CSV (Excel UTF-8)"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#262c36] hover:bg-emerald-700 text-slate-300 hover:text-white text-[10px]"
          >
            <Download size={10} />
            CSV
          </button>
        </div>
      </div>

      {/* Сетка данных */}
      <div className={`overflow-auto ${compact ? 'max-h-64' : 'max-h-80'}`}>
        <table className="w-full text-left border-collapse font-mono text-[11.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#21262d]">
              <th className="px-2 py-1.5 border-b border-r border-[#30363d] text-slate-500 font-normal text-[10px] w-8 text-right select-none">
                #
              </th>
              {result.columns.map((col, ci) => {
                const isSorted = sortCol === ci
                return (
                  <th
                    key={ci}
                    onClick={() => toggleSort(ci)}
                    title="Нажмите для сортировки"
                    className="px-2.5 py-1.5 border-b border-r last:border-r-0 border-[#30363d] whitespace-nowrap cursor-pointer hover:bg-[#2a313c] select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-300 font-bold">{col.name}</span>
                      {col.typeName && (
                        <span className="px-1 py-0 rounded bg-[#0d1117]/80 text-sky-400/90 text-[9.5px] font-normal">
                          {col.typeName}
                        </span>
                      )}
                      <span className="ml-auto text-slate-500">
                        {isSorted ? (
                          sortDir === 'asc' ? <ArrowUp size={11} className="text-sky-400" /> : <ArrowDown size={11} className="text-sky-400" />
                        ) : (
                          <ArrowUpDown size={10} className="opacity-40" />
                        )}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shownRows.length === 0 ? (
              <tr>
                <td colSpan={result.columns.length + 1} className="px-3 py-4 text-center text-slate-500 italic">
                  {filter ? 'Нет строк по фильтру' : 'Пустой результат (0 строк)'}
                </td>
              </tr>
            ) : (
              shownRows.map((row, ri) => (
                <tr key={ri} className={`${ri % 2 ? 'bg-white/[0.025]' : ''} hover:bg-sky-500/[0.08] transition-colors`}>
                  <td className="px-2 py-1 border-t border-r border-[#262c36] text-slate-600 text-[10px] text-right select-none">
                    {ri + 1}
                  </td>
                  {row.map((cell, ci) => {
                    const isNull = cell === null || cell === undefined
                    const isBool = typeof cell === 'boolean'
                    const isNum = typeof cell === 'number'
                    const isObj = !isNull && typeof cell === 'object' && !(cell instanceof Date) && !(cell instanceof Uint8Array)
                    const text = formatCellRaw(cell)
                    const isLong = text.length > 64

                    return (
                      <td
                        key={ci}
                        className={`px-2.5 py-1 border-t border-r last:border-r-0 border-[#262c36] whitespace-nowrap ${
                          isNum ? 'text-right tabular-nums text-cyan-200' : ''
                        }`}
                      >
                        {isNull ? (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-500 italic text-[10px]">NULL</span>
                        ) : isBool ? (
                          <span className={`px-1.5 py-0.2 rounded text-[10.5px] font-bold ${cell ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                            {String(cell)}
                          </span>
                        ) : isObj ? (
                          <button
                            type="button"
                            onClick={() => setExpandedJson({ r: ri, c: ci, text: JSON.stringify(cell, null, 2) })}
                            className="px-1.5 py-0.5 rounded bg-violet-950/70 hover:bg-violet-900/70 border border-violet-800/50 text-violet-200 text-[10.5px] max-w-[240px] truncate block text-left"
                            title="Нажмите, чтобы развернуть JSON / массив"
                          >
                            {text}
                          </button>
                        ) : isLong ? (
                          <span className="text-emerald-200 inline-block max-w-[280px] truncate align-bottom" title={text}>
                            {text}
                          </span>
                        ) : (
                          <span className={isNum ? 'text-cyan-200' : 'text-emerald-200'}>{text}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Раскрытый JSON / массив */}
      {expandedJson && (
        <div className="border-t border-violet-800/50 bg-[#12101e] p-2.5">
          <div className="flex items-center justify-between mb-1 text-[10.5px] text-violet-300 font-semibold">
            <span>Ячейка [{expandedJson.r + 1}, {result.columns[expandedJson.c]?.name}]</span>
            <button
              type="button"
              onClick={() => setExpandedJson(null)}
              className="px-2 py-0.5 rounded bg-violet-900/50 hover:bg-violet-800 text-violet-100"
            >
              Закрыть
            </button>
          </div>
          <pre className="text-[11px] font-mono text-violet-100 overflow-auto max-h-40">{expandedJson.text}</pre>
        </div>
      )}

      {/* Пагинация если строк > limit */}
      {filteredAndSorted.length > limit && (
        <div className="px-3 py-1.5 bg-[#1c2128] border-t border-[#2d333b] flex items-center justify-between text-[11px] text-slate-400">
          <span>Показано {limit} из {filteredAndSorted.length}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLimit(l => l + 200)}
              className="px-2 py-0.5 rounded bg-[#262c36] hover:bg-[#323a46] text-slate-200 text-[10.5px]"
            >
              +200 строк
            </button>
            <button
              type="button"
              onClick={() => setLimit(filteredAndSorted.length)}
              className="px-2 py-0.5 rounded bg-[#262c36] hover:bg-[#323a46] text-slate-200 text-[10.5px]"
            >
              Показать все
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
