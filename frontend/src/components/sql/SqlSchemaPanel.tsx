import { useState } from 'react'
import {
  Table2, Eye, KeyRound, Link2, ChevronRight, ChevronDown,
  Plus, GitFork, Clock, CheckCircle2, AlertCircle, Maximize2, X,
} from 'lucide-react'
import type { TableSchemaInfo } from './sqlEngine'

export interface QueryHistoryItem {
  id: string
  sql: string
  durationMs: number
  ok: boolean
  rowCount?: number
  at: string
}

/* ==================== Авто-раскладка и SVG ER-диаграмма ==================== */
export function ErDiagramSvg({
  tables,
  selectedTable,
  onSelectTable,
}: {
  tables: TableSchemaInfo[]
  selectedTable: string | null
  onSelectTable: (name: string) => void
}) {
  const realTables = tables.filter(t => t.kind === 'table')
  if (realTables.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500">
        Создайте таблицы через <code className="text-sky-400">CREATE TABLE</code> — здесь появится ER-диаграмма со связями.
      </div>
    )
  }

  const cardW = 210
  const rowH = 22
  const headH = 30
  const gapX = 56
  const gapY = 36
  const colsPerRow = realTables.length <= 2 ? realTables.length : Math.min(3, Math.ceil(Math.sqrt(realTables.length)))

  type Box = {
    table: TableSchemaInfo
    x: number
    y: number
    w: number
    h: number
    colY: Record<string, number>
  }

  const boxes: Box[] = []
  const boxByName = new Map<string, Box>()

  // Считаем высоты строк сетки, чтобы карточки не перекрывались
  const rowHeights: number[] = []
  realTables.forEach((t, idx) => {
    const r = Math.floor(idx / colsPerRow)
    const h = headH + Math.max(1, t.columns.length) * rowH + 8
    rowHeights[r] = Math.max(rowHeights[r] || 0, h)
  })

  realTables.forEach((t, idx) => {
    const r = Math.floor(idx / colsPerRow)
    const c = idx % colsPerRow
    const x = 20 + c * (cardW + gapX)
    const y = 20 + rowHeights.slice(0, r).reduce((a, b) => a + b + gapY, 0)
    const h = headH + Math.max(1, t.columns.length) * rowH + 8
    const colY: Record<string, number> = {}
    t.columns.forEach((col, ci) => {
      colY[col.name] = y + headH + ci * rowH + rowH / 2 + 2
    })
    const box: Box = { table: t, x, y, w: cardW, h, colY }
    boxes.push(box)
    boxByName.set(t.name, box)
  })

  const svgW = Math.max(300, 40 + colsPerRow * cardW + (colsPerRow - 1) * gapX)
  const svgH = Math.max(220, 40 + rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, rowHeights.length - 1) * gapY)

  // Связи Foreign Key
  const edges: { from: Box; fromCol: string; to: Box; toCol: string }[] = []
  for (const b of boxes) {
    for (const col of b.table.columns) {
      if (col.fkTarget) {
        const target = boxByName.get(col.fkTarget.table)
        if (target) {
          edges.push({ from: b, fromCol: col.name, to: target, toCol: col.fkTarget.column })
        }
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-auto block select-none"
      style={{ minWidth: Math.min(svgW, 460) }}
    >
      <defs>
        <marker id="er-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="er-arrow-hi" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
        </marker>
      </defs>

      {/* Связи FK -> PK */}
      {edges.map((e, i) => {
        const y1 = e.from.colY[e.fromCol] ?? (e.from.y + headH / 2)
        const y2 = e.to.colY[e.toCol] ?? (e.to.y + headH / 2)
        const goRight = e.to.x >= e.from.x
        const x1 = goRight ? e.from.x + e.from.w : e.from.x
        const x2 = goRight ? e.to.x : e.to.x + e.to.w
        const sameCol = e.from.x === e.to.x
        const d = sameCol
          ? `M ${e.from.x + e.from.w} ${y1} C ${e.from.x + e.from.w + 40} ${y1}, ${e.to.x + e.to.w + 40} ${y2}, ${e.to.x + e.to.w} ${y2}`
          : `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.5} ${y1}, ${x1 + (x2 - x1) * 0.5} ${y2}, ${x2} ${y2}`
        const hi = selectedTable === e.from.table.name || selectedTable === e.to.table.name
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={hi ? '#f59e0b' : '#38bdf8'}
            strokeWidth={hi ? 2.4 : 1.7}
            strokeOpacity={hi ? 1 : 0.72}
            markerEnd={hi ? 'url(#er-arrow-hi)' : 'url(#er-arrow)'}
          />
        )
      })}

      {/* Карточки таблиц */}
      {boxes.map(b => {
        const active = selectedTable === b.table.name
        return (
          <g
            key={b.table.name}
            onClick={() => onSelectTable(b.table.name)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={8}
              fill="#161b22"
              stroke={active ? '#f59e0b' : '#30363d'}
              strokeWidth={active ? 2 : 1.2}
            />
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={headH}
              rx={8}
              fill={active ? '#1d4ed8' : '#1e293b'}
            />
            <rect
              x={b.x}
              y={b.y + headH - 8}
              width={b.w}
              height={8}
              fill={active ? '#1d4ed8' : '#1e293b'}
            />
            <text
              x={b.x + 10}
              y={b.y + 19}
              fill="#f8fafc"
              fontSize="12"
              fontWeight="700"
              fontFamily="JetBrains Mono, Consolas, monospace"
            >
              {b.table.name.length > 18 ? b.table.name.slice(0, 17) + '…' : b.table.name}
            </text>
            <text
              x={b.x + b.w - 8}
              y={b.y + 19}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="10"
              fontFamily="JetBrains Mono, Consolas, monospace"
            >
              {b.table.rowCount}
            </text>

            {b.table.columns.map((col, ci) => {
              const cy = b.y + headH + ci * rowH + 16
              return (
                <g key={col.name}>
                  {ci > 0 && (
                    <line
                      x1={b.x + 6}
                      y1={b.y + headH + ci * rowH + 2}
                      x2={b.x + b.w - 6}
                      y2={b.y + headH + ci * rowH + 2}
                      stroke="#262c36"
                      strokeWidth="1"
                    />
                  )}
                  <text
                    x={b.x + 10}
                    y={cy}
                    fill={col.isPk ? '#fbbf24' : col.fkTarget ? '#38bdf8' : '#e2e8f0'}
                    fontSize="10.5"
                    fontWeight={col.isPk ? '700' : '500'}
                    fontFamily="JetBrains Mono, Consolas, monospace"
                  >
                    {col.isPk ? '🔑 ' : col.fkTarget ? '🔗 ' : '· '}
                    {col.name.length > 14 ? col.name.slice(0, 13) + '…' : col.name}
                  </text>
                  <text
                    x={b.x + b.w - 8}
                    y={cy}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, Consolas, monospace"
                  >
                    {col.type.length > 10 ? col.type.slice(0, 10) : col.type}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

export default function SqlSchemaPanel({
  tables,
  history,
  onPreviewTable,
  onInsertText,
  onRunHistorySql,
}: {
  tables: TableSchemaInfo[]
  history: QueryHistoryItem[]
  onPreviewTable: (tableName: string) => void
  onInsertText: (snippet: string) => void
  onRunHistorySql: (sql: string) => void
}) {
  const [tab, setTab] = useState<'schema' | 'er' | 'history'>('schema')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedEr, setSelectedEr] = useState<string | null>(null)
  const [erModal, setErModal] = useState(false)

  const toggle = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: prev[name] === undefined ? false : !prev[name] }))
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#141920] text-slate-200 select-none">
      {/* Переключатель вкладок сайдбара */}
      <div className="h-9 bg-[#181e27] border-b border-[#262d38] flex items-center px-1.5 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setTab('schema')}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition ${
            tab === 'schema' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Table2 size={12} /> Схема
          <span className="text-[10px] opacity-80">({tables.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('er')}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition ${
            tab === 'er' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <GitFork size={12} /> ER
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition ${
            tab === 'history' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Clock size={12} /> История
        </button>
      </div>

      {/* Вкладка 1: Дерево схемы */}
      {tab === 'schema' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {tables.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed border-[#2c3543] text-slate-500 text-xs text-center">
              В базе пока нет таблиц.<br />Выполните <code className="text-sky-400">CREATE TABLE</code> или выберите пример выше.
            </div>
          ) : (
            tables.map(t => {
              const isOpen = expanded[t.name] !== false
              return (
                <div key={t.name} className="rounded-lg border border-[#242c38] bg-[#181f29] overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-[#1e2734] transition group">
                    <button
                      type="button"
                      onClick={() => toggle(t.name)}
                      className="text-slate-500 hover:text-slate-200 p-0.5"
                    >
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPreviewTable(t.name)}
                      className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                      title={`Показать данные: SELECT * FROM "${t.name}" LIMIT 50`}
                    >
                      {t.kind === 'view' ? (
                        <Eye size={12} className="text-violet-400 shrink-0" />
                      ) : (
                        <Table2 size={12} className="text-emerald-400 shrink-0" />
                      )}
                      <span className="font-mono text-xs font-bold text-slate-100 truncate">{t.name}</span>
                      <span className="ml-auto px-1.5 py-0 rounded-full bg-[#0d1117] text-[10px] font-mono text-slate-400 shrink-0">
                        {t.rowCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onInsertText(t.name)}
                      title="Вставить имя таблицы в редактор"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sky-600/30 text-sky-400 transition"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-[#222a36] bg-[#12171e] py-1">
                      {t.columns.map(col => (
                        <div
                          key={col.name}
                          className="flex items-center gap-1.5 px-3 py-0.5 text-[11px] font-mono hover:bg-white/[0.04] group/col"
                        >
                          {col.isPk ? (
                            <KeyRound size={10} className="text-amber-400 shrink-0" aria-label="PRIMARY KEY" />
                          ) : col.fkTarget ? (
                            <Link2 size={10} className="text-sky-400 shrink-0" aria-label={`FK → ${col.fkTarget.table}.${col.fkTarget.column}`} />
                          ) : (
                            <span className="w-2.5 text-center text-slate-600 shrink-0">·</span>
                          )}
                          <span className={`truncate ${col.isPk ? 'text-amber-200 font-semibold' : 'text-slate-300'}`}>
                            {col.name}
                          </span>
                          <span className="ml-auto text-[10px] text-sky-400/80 shrink-0">
                            {col.type}
                          </span>
                          {!col.nullable && (
                            <span className="text-[9px] text-rose-400/80 font-bold" title="NOT NULL">*</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onInsertText(col.name)}
                            title={`Вставить колонку ${col.name}`}
                            className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded hover:bg-sky-600/30 text-sky-400"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Вкладка 2: Визуальная ER-диаграмма */}
      {tab === 'er' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-2.5 py-1.5 border-b border-[#242c38] flex items-center justify-between text-[10.5px] text-slate-400">
            <span>Клик по таблице — подсветка связей</span>
            <button
              type="button"
              onClick={() => setErModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#222a36] hover:bg-sky-600 text-slate-200 text-[10px] font-semibold"
              title="Открыть ER-диаграмму на весь экран"
            >
              <Maximize2 size={10} /> На весь экран
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 bg-[#0d1117]">
            <ErDiagramSvg
              tables={tables}
              selectedTable={selectedEr}
              onSelectTable={name => setSelectedEr(prev => (prev === name ? null : name))}
            />
          </div>
        </div>
      )}

      {/* Вкладка 3: История запросов */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {history.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">
              История выполненных запросов появится здесь.
            </div>
          ) : (
            history.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onRunHistorySql(item.sql)}
                className="w-full text-left p-2 rounded-lg border border-[#242c38] bg-[#181f29] hover:border-sky-500/60 transition space-y-1"
              >
                <div className="flex items-center gap-1.5 text-[10px]">
                  {item.ok ? (
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={11} className="text-rose-400 shrink-0" />
                  )}
                  <span className="font-mono text-slate-400">{item.durationMs} ms</span>
                  {item.rowCount !== undefined && (
                    <span className="text-sky-400 font-mono">{item.rowCount} стр.</span>
                  )}
                  <span className="ml-auto text-slate-500">{item.at}</span>
                </div>
                <pre className="text-[10.5px] font-mono text-slate-300 line-clamp-2 whitespace-pre-wrap break-all">
                  {item.sql}
                </pre>
              </button>
            ))
          )}
        </div>
      )}

      {/* Полноэкранная модалка ER-диаграммы */}
      {erModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setErModal(false) }}
        >
          <div className="w-full max-w-5xl max-h-[88vh] rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <GitFork size={16} className="text-sky-400" /> ER-диаграмма базы данных ({tables.filter(t => t.kind === 'table').length} таблиц)
              </div>
              <button
                type="button"
                onClick={() => setErModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ErDiagramSvg
                tables={tables}
                selectedTable={selectedEr}
                onSelectTable={name => {
                  setSelectedEr(name)
                  onPreviewTable(name)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
