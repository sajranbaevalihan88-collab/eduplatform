import React, { useRef } from 'react'
import { Plus, Trash2, X, BarChart3 } from 'lucide-react'
import { parseCssGradient, SvgShape } from './pptxView'

/* ============================================================================
   1. VECTOR SHAPES (23 PowerPoint-grade SVG shapes with fill, stroke, gradient,
      dash style, shadow, quick presets, and centered text inside)
   ============================================================================ */

export type ShapeCategory = 'basic' | 'arrows' | 'flow' | 'accent'

export interface ShapeDef {
  k: string
  label: string
  cat: ShapeCategory
  isLine?: boolean
  renderSvg: (fill: string, stroke: string, sw: number, dash?: string, defs?: React.ReactNode) => React.ReactNode
  toHtmlSvg: (fill: string, stroke: string, sw: number, dash?: string, gradDef?: string) => string
}

const dashAttr = (dash?: string) =>
  dash === 'dotted' ? '2 4' : dash === 'dashed' ? '8 5' : undefined

function pathShape(
  k: string,
  label: string,
  cat: ShapeCategory,
  d: string,
  extra?: { isLine?: boolean; markerArrow?: boolean }
): ShapeDef {
  return {
    k,
    label,
    cat,
    isLine: extra?.isLine,
    renderSvg: (fill, stroke, sw, dash, defs) => {
      const da = dashAttr(dash)
      if (extra?.isLine) {
        const lineColor = stroke && stroke !== 'none' && stroke !== 'transparent' ? stroke : (fill !== 'none' ? fill : '#2563eb')
        const lw = Math.max(2, sw || 3)
        return (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full block overflow-visible">
            {defs}
            <line
              x1="4" y1="50" x2={extra.markerArrow ? '86' : '96'} y2="50"
              stroke={lineColor} strokeWidth={lw} strokeDasharray={da}
              strokeLinecap="round" vectorEffect="non-scaling-stroke"
            />
            {extra.markerArrow && (
              <polygon points="82,26 98,50 82,74" fill={lineColor} />
            )}
          </svg>
        )
      }
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full block overflow-visible">
          {defs}
          <path
            d={d}
            fill={fill}
            stroke={sw > 0 ? stroke : 'none'}
            strokeWidth={sw}
            strokeDasharray={da}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )
    },
    toHtmlSvg: (fill, stroke, sw, dash, gradDef = '') => {
      const da = dashAttr(dash)
      const daStr = da ? ` stroke-dasharray="${da}"` : ''
      if (extra?.isLine) {
        const lineColor = stroke && stroke !== 'none' && stroke !== 'transparent' ? stroke : (fill !== 'none' ? fill : '#2563eb')
        const lw = Math.max(2, sw || 3)
        return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible">${gradDef}<line x1="4" y1="50" x2="${extra.markerArrow ? '86' : '96'}" y2="50" stroke="${lineColor}" stroke-width="${lw}"${daStr} stroke-linecap="round" vector-effect="non-scaling-stroke"/>${extra.markerArrow ? `<polygon points="82,26 98,50 82,74" fill="${lineColor}"/>` : ''}</svg>`
      }
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible">${gradDef}<path d="${d}" fill="${fill}" stroke="${sw > 0 ? stroke : 'none'}" stroke-width="${sw}"${daStr} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`
    },
  }
}

export const SHAPE_CATALOG: ShapeDef[] = [
  // Базовые
  pathShape('rect', 'Прямоугольник', 'basic', 'M 2,2 H 98 V 98 H 2 Z'),
  pathShape('rounded', 'Скруглённый', 'basic', 'M 14,2 H 86 Q 98,2 98,14 V 86 Q 98,98 86,98 H 14 Q 2,98 2,86 V 14 Q 2,2 14,2 Z'),
  pathShape('circle', 'Круг / Овал', 'basic', 'M 50,2 A 48,48 0 1,1 49.99,2 Z'),
  pathShape('ellipse', 'Эллипс', 'basic', 'M 50,2 A 48,48 0 1,1 49.99,2 Z'),
  pathShape('triangle', 'Треугольник', 'basic', 'M 50,4 L 97,96 L 3,96 Z'),
  pathShape('rightTriangle', 'Прям. треуг.', 'basic', 'M 4,4 L 96,96 L 4,96 Z'),
  pathShape('diamond', 'Ромб', 'basic', 'M 50,3 L 97,50 L 50,97 L 3,50 Z'),
  pathShape('pentagon', 'Пятиугольник', 'basic', 'M 50,3 L 97,38 L 79,96 L 21,96 L 3,38 Z'),
  pathShape('hexagon', 'Шестиугольник', 'basic', 'M 25,4 L 75,4 L 97,50 L 75,96 L 25,96 L 3,50 Z'),

  // Стрелки и линии
  pathShape('arrow', 'Стрелка вправо', 'arrows', 'M 3,26 H 60 V 8 L 97,50 L 60,92 V 74 H 3 Z'),
  pathShape('arrowLeft', 'Стрелка влево', 'arrows', 'M 97,26 H 40 V 8 L 3,50 L 40,92 V 74 H 97 Z'),
  pathShape('arrowUp', 'Стрелка вверх', 'arrows', 'M 26,97 V 40 H 8 L 50,3 L 92,40 H 74 V 97 Z'),
  pathShape('arrowDown', 'Стрелка вниз', 'arrows', 'M 26,3 V 60 H 8 L 50,97 L 92,60 H 74 V 3 Z'),
  pathShape('arrowBoth', 'Двойная стрелка', 'arrows', 'M 3,50 L 28,14 V 32 H 72 V 14 L 97,50 L 72,86 V 68 H 28 V 86 Z'),
  pathShape('line', 'Линия', 'arrows', '', { isLine: true }),
  pathShape('lineArrow', 'Линия со стрелкой', 'arrows', '', { isLine: true, markerArrow: true }),

  // Выноски и блок-схемы
  pathShape('callout', 'Выноска / Речь', 'flow', 'M 10,4 H 90 Q 97,4 97,12 V 66 Q 97,74 90,74 H 42 L 22,95 L 25,74 H 10 Q 3,74 3,66 V 12 Q 3,4 10,4 Z'),
  pathShape('chevron', 'Шеврон (этап)', 'flow', 'M 3,10 H 74 L 97,50 L 74,90 H 3 L 26,50 Z'),
  pathShape('parallelogram', 'Параллелограмм', 'flow', 'M 20,5 H 97 L 80,95 H 3 Z'),
  pathShape('trapezoid', 'Трапеция', 'flow', 'M 20,5 H 80 L 97,95 H 3 Z'),

  // Акценты
  pathShape('star', 'Звезда', 'accent', 'M 50,3 L 62,36 L 97,37 L 69,58 L 79,94 L 50,73 L 21,94 L 31,58 L 3,37 L 38,36 Z'),
  pathShape('heart', 'Сердце', 'accent', 'M 50,92 C 20,70 4,50 4,30 C 4,14 16,4 30,4 C 40,4 46,10 50,18 C 54,10 60,4 70,4 C 84,4 96,14 96,30 C 96,50 80,70 50,92 Z'),
  pathShape('plus', 'Плюс', 'accent', 'M 35,4 H 65 V 35 H 96 V 65 H 65 V 96 H 35 V 65 H 4 V 35 H 35 Z'),
  pathShape('badge', 'Щит / Бейдж', 'accent', 'M 50,3 L 94,18 V 52 C 94,76 74,90 50,97 C 26,90 6,76 6,52 V 18 Z'),
]

export const SHAPE_GROUPS: { id: ShapeCategory; label: string }[] = [
  { id: 'basic', label: 'Базовые фигуры' },
  { id: 'arrows', label: 'Стрелки и линии' },
  { id: 'flow', label: 'Блок-схемы и выноски' },
  { id: 'accent', label: 'Акценты и значки' },
]

export const SHAPE_GRADIENTS = [
  { name: 'Синий', css: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
  { name: 'Оранжевый', css: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)' },
  { name: 'Изумруд', css: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
  { name: 'Фиолет', css: 'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)' },
  { name: 'Розовый', css: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' },
  { name: 'Золото', css: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' },
]

// Экспресс-стили PowerPoint для фигур (как Quick Styles в оригинальном Office)
export const SHAPE_QUICK_STYLES = [
  { name: 'Синяя', fill: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', stroke: '#1e40af', strokeWidth: 0, textColor: '#ffffff', shadow: true, dash: 'solid' },
  { name: 'Светлая', fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e3a8a', shadow: false, dash: 'solid' },
  { name: 'Контур', fill: 'transparent', stroke: '#2563eb', strokeWidth: 2.5, textColor: '#1e293b', shadow: false, dash: 'solid' },
  { name: 'Пунктир', fill: '#f8fafc', stroke: '#64748b', strokeWidth: 2, textColor: '#334155', shadow: false, dash: 'dashed' },
  { name: 'Акцент', fill: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)', stroke: '#9a3412', strokeWidth: 0, textColor: '#ffffff', shadow: true, dash: 'solid' },
  { name: 'Изумруд', fill: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', stroke: '#065f46', strokeWidth: 0, textColor: '#ffffff', shadow: true, dash: 'solid' },
  { name: 'Графит', fill: '#1e293b', stroke: '#0f172a', strokeWidth: 1, textColor: '#f8fafc', shadow: true, dash: 'solid' },
  { name: 'Янтарь', fill: '#fef3c7', stroke: '#d97706', strokeWidth: 2, textColor: '#78350f', shadow: false, dash: 'solid' },
]

export function getShapeDef(key?: string): ShapeDef {
  return SHAPE_CATALOG.find(s => s.k === key) || SHAPE_CATALOG[0]
}

export function ShapeThumb({ shapeKey, color = '#3b82f6' }: { shapeKey: string; color?: string }) {
  const def = getShapeDef(shapeKey)
  return (
    <div className="w-6 h-6 flex items-center justify-center">
      {def.renderSvg(def.isLine ? 'none' : color, def.isLine ? color : '#1e3a8a', def.isLine ? 3 : 1.5)}
    </div>
  )
}

export function SlideShape({
  block,
  gid,
  editable = false,
  editing = false,
  onCommitText,
  onStartEdit,
  onStopEdit,
}: {
  block: any
  gid: string
  editable?: boolean
  editing?: boolean
  onCommitText?: (val: string) => void
  onStartEdit?: () => void
  onStopEdit?: () => void
}) {
  const st = block.style || {}

  if (st.svgPath) {
    return (
      <div className="w-full h-full relative" style={{ opacity: st.opacity ?? 1 }}>
        <SvgShape st={st} gid={gid} svgStyle={{ pointerEvents: 'none' }} />
      </div>
    )
  }

  const shapeKey = block.shape || st.preset || 'rect'
  const def = getShapeDef(shapeKey)
  const rawFill = st.fill === 'transparent' || st.fill === 'none' ? 'none' : (st.fill || '#3b82f6')
  const grad = typeof rawFill === 'string' && rawFill.startsWith('linear-gradient') ? parseCssGradient(rawFill) : null
  const fillVal = grad ? `url(#${gid})` : rawFill
  const strokeVal = st.stroke === 'transparent' || st.stroke === 'none' ? 'none' : (st.stroke ?? '#1d4ed8')
  const sw = st.strokeWidth ?? (def.isLine ? 3 : 2)
  const textColor = st.textColor || '#ffffff'
  const textSize = st.textSize || 16
  const hasRadiusOverride = (shapeKey === 'rect' || shapeKey === 'rounded') && st.borderRadius != null

  return (
    <div
      className="w-full h-full relative select-none"
      style={{
        opacity: st.opacity ?? 1,
        filter: st.shadow ? 'drop-shadow(0 8px 18px rgba(15,23,42,0.2))' : undefined,
      }}
      onDoubleClick={e => {
        if (!editable || def.isLine) return
        e.stopPropagation()
        onStartEdit?.()
      }}
    >
      {hasRadiusOverride ? (
        <div
          className="w-full h-full"
          style={{
            background: rawFill === 'none' ? 'transparent' : rawFill,
            border: sw > 0 && strokeVal !== 'none' ? `${sw}px ${st.dash || 'solid'} ${strokeVal}` : 'none',
            borderRadius: `${st.borderRadius}px`,
          }}
        />
      ) : (
        <div className="w-full h-full pointer-events-none relative">
          {def.renderSvg(
            fillVal,
            strokeVal,
            sw,
            st.dash,
            grad ? (
              <defs>
                <linearGradient id={gid} x1={grad.x1} y1={grad.y1} x2={grad.x2} y2={grad.y2}>
                  {grad.stops.map((sp, i) => (
                    <stop key={i} offset={`${sp.offset}%`} stopColor={sp.color} stopOpacity={sp.opacity} />
                  ))}
                </linearGradient>
              </defs>
            ) : undefined
          )}
        </div>
      )}

      {!def.isLine && (editing || block.content) && (
        <div className="absolute inset-0 flex items-center justify-center p-3 overflow-hidden">
          {editing ? (
            <textarea
              autoFocus
              defaultValue={block.content || ''}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onBlur={e => {
                onCommitText?.(e.target.value)
                onStopEdit?.()
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  ;(e.target as HTMLTextAreaElement).blur()
                }
              }}
              style={{
                color: textColor,
                fontSize: `${textSize}px`,
                fontWeight: st.textBold !== false ? 700 : 400,
                textAlign: st.textAlign || 'center',
              }}
              className="w-full h-full resize-none bg-transparent outline-none leading-snug"
              placeholder="Текст…"
            />
          ) : (
            <div
              className="w-full whitespace-pre-wrap break-words leading-snug pointer-events-none"
              style={{
                color: textColor,
                fontSize: `${textSize}px`,
                fontWeight: st.textBold !== false ? 700 : 400,
                textAlign: st.textAlign || 'center',
              }}
            >
              {block.content}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   2. TABLES (PowerPoint / Word-grade Editable Table with Column Divider Resize,
      6 Themes, Crisp Borders, Header Row, Zebra Stripes, Tab/Enter Navigation)
   ============================================================================ */

export interface TableTheme {
  id: string
  name: string
  headerBg: string
  headerText: string
  zebraBg: string
  cellBg: string
  border: string
  text: string
}

export const TABLE_THEMES: TableTheme[] = [
  { id: 'blue', name: 'Синяя', headerBg: '#2563eb', headerText: '#ffffff', zebraBg: '#eff6ff', cellBg: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
  { id: 'powerpoint', name: 'Оранжевая', headerBg: '#b7472a', headerText: '#ffffff', zebraBg: '#fff7ed', cellBg: '#ffffff', border: '#fed7aa', text: '#1e293b' },
  { id: 'emerald', name: 'Изумруд', headerBg: '#059669', headerText: '#ffffff', zebraBg: '#ecfdf5', cellBg: '#ffffff', border: '#a7f3d0', text: '#0f172a' },
  { id: 'violet', name: 'Индиго', headerBg: '#4f46e5', headerText: '#ffffff', zebraBg: '#eef2ff', cellBg: '#ffffff', border: '#c7d2fe', text: '#0f172a' },
  { id: 'slate', name: 'Графит', headerBg: '#1e293b', headerText: '#f8fafc', zebraBg: '#f1f5f9', cellBg: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
  { id: 'minimal', name: 'Минимал', headerBg: '#f1f5f9', headerText: '#0f172a', zebraBg: '#f8fafc', cellBg: '#ffffff', border: '#cbd5e1', text: '#1e293b' },
]

export function getTableTheme(id?: string): TableTheme {
  return TABLE_THEMES.find(t => t.id === id) || TABLE_THEMES[0]
}

export function createDefaultTable(rows = 3, cols = 3) {
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      text: r === 0 ? `Заголовок ${c + 1}` : (c === 0 ? `Пункт ${r}` : `Значение ${r}.${c}`),
      style: {},
    }))
  )
  return {
    rows,
    cols,
    theme: 'blue',
    headerRow: true,
    striped: true,
    fontSize: 13,
    align: 'left' as 'left' | 'center' | 'right',
    colWidths: Array.from({ length: cols }, () => Number((100 / cols).toFixed(2))),
    cells,
  }
}

export function SlideTable({
  block,
  editable = false,
  selected = false,
  activeCell = null,
  onSelectCell,
  onUpdateCell,
  onResizeColumns,
}: {
  block: any
  editable?: boolean
  selected?: boolean
  activeCell?: { r: number; c: number } | null
  onSelectCell?: (r: number, c: number) => void
  onUpdateCell?: (r: number, c: number, text: string) => void
  onResizeColumns?: (widths: number[]) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tbl = block.table || {}
  const rows = Math.max(1, tbl.rows || tbl.cells?.length || 3)
  const cols = Math.max(1, tbl.cols || tbl.cells?.[0]?.length || 3)
  const theme = getTableTheme(tbl.theme)
  const headerRow = tbl.headerRow !== false
  const striped = tbl.striped !== false
  const fontSize = tbl.fontSize || 13
  const defaultAlign = tbl.align || 'left'

  const colWidths: number[] =
    Array.isArray(tbl.colWidths) && tbl.colWidths.length === cols
      ? tbl.colWidths
      : Array.from({ length: cols }, () => 100 / cols)

  const safeCells: any[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => tbl.cells?.[r]?.[c] || { text: '', style: {} })
  )

  const hasMerges = safeCells.some(row => row.some(c => c?.merged || (c?.colspan || 1) > 1 || (c?.rowspan || 1) > 1))

  const focusCellOffset = (r: number, c: number, delta: number, container: HTMLElement | null) => {
    if (!container) return
    const total = rows * cols
    const nextIdx = (r * cols + c + delta + total) % total
    const nr = Math.floor(nextIdx / cols)
    const nc = nextIdx % cols
    onSelectCell?.(nr, nc)
    requestAnimationFrame(() => {
      const inp = container.querySelector(`[data-cell="${nr}-${nc}"]`) as HTMLTextAreaElement | null
      if (inp) { inp.focus(); inp.select() }
    })
  }

  // Плавное перетаскивание границы столбца (как в Word / PowerPoint!)
  const startColResize = (e: React.PointerEvent, colIdx: number) => {
    if (!onResizeColumns || !wrapRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const totalW = wrapRef.current.getBoundingClientRect().width || 500
    const startX = e.clientX
    const orig = [...colWidths]
    const pairSum = orig[colIdx] + orig[colIdx + 1]
    const onMove = (ev: PointerEvent) => {
      const deltaPct = ((ev.clientX - startX) / totalW) * 100
      const wLeft = Math.max(10, Math.min(pairSum - 10, orig[colIdx] + deltaPct))
      const next = [...orig]
      next[colIdx] = Number(wLeft.toFixed(2))
      next[colIdx + 1] = Number((pairSum - wLeft).toFixed(2))
      onResizeColumns(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={wrapRef}
      className="w-full h-full overflow-hidden rounded-lg bg-white relative"
      style={{
        border: `1.5px solid ${theme.border}`,
        boxShadow: block.style?.shadow ? '0 8px 22px rgba(15,23,42,0.14)' : undefined,
      }}
    >
      <table
        className="w-full h-full border-collapse table-fixed"
        style={{ fontSize: `${fontSize}px` }}
      >
        <colgroup>
          {colWidths.map((w, ci) => (
            <col key={ci} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          {safeCells.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                if (hasMerges && cell?.merged) return null
                const isHdr = headerRow && r === 0
                const cs = cell?.style || {}
                const bg = cs.background || (isHdr ? theme.headerBg : (striped && r % 2 === 0 ? theme.zebraBg : theme.cellBg))
                const color = cs.color || (isHdr ? theme.headerText : theme.text)
                const bold = cs.bold !== undefined ? cs.bold : isHdr
                const align = cs.align || defaultAlign
                const isAct = editable && selected && activeCell?.r === r && activeCell?.c === c
                const Tag = isHdr ? 'th' : 'td'
                return (
                  <Tag
                    key={c}
                    colSpan={cell?.colspan || 1}
                    rowSpan={cell?.rowspan || 1}
                    onClick={e => {
                      if (!editable) return
                      if (selected) {
                        e.stopPropagation()
                        onSelectCell?.(r, c)
                      }
                    }}
                    style={{
                      background: bg,
                      color,
                      border: `1px solid ${theme.border}`,
                      fontWeight: bold ? 700 : 400,
                      textAlign: align,
                      padding: editable && selected ? '3px 6px' : '6px 9px',
                      verticalAlign: 'middle',
                      position: 'relative',
                      outline: isAct ? '2px solid #2563eb' : undefined,
                      outlineOffset: isAct ? '-2px' : undefined,
                    }}
                  >
                    {editable && selected ? (
                      <textarea
                        data-cell={`${r}-${c}`}
                        value={cell?.text ?? ''}
                        onMouseDown={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        onFocus={() => onSelectCell?.(r, c)}
                        onChange={e => onUpdateCell?.(r, c, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Tab') {
                            e.preventDefault()
                            const tblEl = (e.target as HTMLElement).closest('table')
                            focusCellOffset(r, c, e.shiftKey ? -1 : 1, tblEl)
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            const tblEl = (e.target as HTMLElement).closest('table')
                            focusCellOffset(r, c, cols, tblEl)
                          }
                        }}
                        rows={Math.max(1, Math.min(4, String(cell?.text ?? '').split('\n').length))}
                        style={{
                          color,
                          fontWeight: bold ? 700 : 400,
                          textAlign: align,
                          fontSize: `${fontSize}px`,
                        }}
                        className="w-full bg-transparent border-none outline-none resize-none leading-snug py-0.5 align-middle"
                      />
                    ) : (
                      <div className="w-full break-words whitespace-pre-wrap leading-snug">
                        {cell?.text ?? ''}
                      </div>
                    )}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Вертикальные ручки ширины столбцов на всю высоту таблицы (как в Word!) */}
      {editable && selected && !hasMerges && onResizeColumns && cols > 1 && (() => {
        let acc = 0
        return colWidths.slice(0, -1).map((w, ci) => {
          acc += w
          return (
            <div
              key={ci}
              onPointerDown={e => startColResize(e, ci)}
              onMouseDown={e => e.stopPropagation()}
              title="Потяните, чтобы изменить ширину столбца"
              style={{ left: `${acc}%` }}
              className="absolute top-0 bottom-0 -ml-1.5 w-3 cursor-col-resize z-20 group/col touch-none"
            >
              <div className="w-0.5 h-full mx-auto bg-transparent group-hover/col:bg-blue-500 transition-colors" />
            </div>
          )
        })
      })()}
    </div>
  )
}

/* ============================================================================
   3. CHARTS (Real SVG Bar, Horizontal Bar, Line, Area, Pie, Donut + Excel Modal)
   ============================================================================ */

export type ChartKind = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'donut'

export const CHART_TYPES: { id: ChartKind; label: string }[] = [
  { id: 'bar', label: 'Столбцы' },
  { id: 'hbar', label: 'Горизонт.' },
  { id: 'line', label: 'Линия' },
  { id: 'area', label: 'Область' },
  { id: 'pie', label: 'Круговая' },
  { id: 'donut', label: 'Кольцевая' },
]

export const CHART_PALETTES: Record<string, { name: string; colors: string[] }> = {
  corporate: { name: 'Деловая', colors: ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'] },
  vibrant: { name: 'Яркая', colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'] },
  emerald: { name: 'Изумруд', colors: ['#059669', '#10b981', '#34d399', '#0d9488', '#06b6d4', '#0284c7', '#2563eb'] },
  warm: { name: 'Тёплая', colors: ['#b7472a', '#ea580c', '#f59e0b', '#eab308', '#e11d48', '#db2777', '#9333ea'] },
  pastel: { name: 'Пастель', colors: ['#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#38bdf8'] },
  mono: { name: 'Графит', colors: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#2563eb', '#0284c7'] },
}

export const CHART_PRESETS = [
  { name: 'Четверти', title: 'Успеваемость по четвертям', labels: ['1 четв.', '2 четв.', '3 четв.', '4 четв.'], values: [68, 76, 84, 92] },
  { name: 'Оценки', title: 'Распределение оценок', labels: ['«5» Отл.', '«4» Хор.', '«3» Удовл.', '«2» Неуд.'], values: [11, 14, 4, 1] },
  { name: 'Динамика', title: 'Рост показателей', labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май'], values: [25, 42, 38, 64, 85] },
]

export function createDefaultChartData(title = 'Показатели') {
  return {
    title,
    labels: ['1 четв.', '2 четв.', '3 четв.', '4 четв.'],
    values: [68, 82, 75, 94],
    colors: [] as string[],
    palette: 'corporate',
    showValues: true,
    showLegend: true,
    showGrid: true,
    bg: '#ffffff',
  }
}

function normalizeChart(block: any) {
  const cd = block.chartData || {}
  const chartType: ChartKind = (block.style?.chartType || cd.chartType || 'bar') as ChartKind
  const values: number[] = Array.isArray(cd.values) && cd.values.length
    ? cd.values.map((v: any) => Number(v) || 0)
    : [68, 82, 75, 94]
  const labels: string[] = Array.isArray(cd.labels) && cd.labels.length
    ? values.map((_, i) => String(cd.labels[i] ?? `Пункт ${i + 1}`))
    : values.map((_, i) => `Пункт ${i + 1}`)
  const pal = CHART_PALETTES[cd.palette || 'corporate']?.colors || CHART_PALETTES.corporate.colors
  const colors = values.map((_, i) => (cd.colors?.[i] ? cd.colors[i] : pal[i % pal.length]))
  return {
    chartType,
    title: cd.title ?? '',
    labels,
    values,
    colors,
    showValues: cd.showValues !== false,
    showLegend: cd.showLegend !== false,
    showGrid: cd.showGrid !== false,
    bg: cd.bg || '#ffffff',
  }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const sweep = endAngle - startAngle
  if (sweep >= 359.99) {
    const p1 = polarToCartesian(cx, cy, rOuter, 0)
    const p2 = polarToCartesian(cx, cy, rOuter, 180)
    if (rInner <= 0) {
      return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 1 1 ${p2.x} ${p2.y} A ${rOuter} ${rOuter} 0 1 1 ${p1.x} ${p1.y} Z`
    }
    const i1 = polarToCartesian(cx, cy, rInner, 0)
    const i2 = polarToCartesian(cx, cy, rInner, 180)
    return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 1 1 ${p2.x} ${p2.y} A ${rOuter} ${rOuter} 0 1 1 ${p1.x} ${p1.y} Z M ${i1.x} ${i1.y} A ${rInner} ${rInner} 0 1 0 ${i2.x} ${i2.y} A ${rInner} ${rInner} 0 1 0 ${i1.x} ${i1.y} Z`
  }
  const large = sweep > 180 ? 1 : 0
  const oStart = polarToCartesian(cx, cy, rOuter, startAngle)
  const oEnd = polarToCartesian(cx, cy, rOuter, endAngle)
  if (rInner <= 0) {
    return `M ${cx} ${cy} L ${oStart.x} ${oStart.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${oEnd.x} ${oEnd.y} Z`
  }
  const iStart = polarToCartesian(cx, cy, rInner, endAngle)
  const iEnd = polarToCartesian(cx, cy, rInner, startAngle)
  return `M ${oStart.x} ${oStart.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${oEnd.x} ${oEnd.y} L ${iStart.x} ${iStart.y} A ${rInner} ${rInner} 0 ${large} 0 ${iEnd.x} ${iEnd.y} Z`
}

export function SlideChart({ block, gid }: { block: any; gid?: string }) {
  const cfg = normalizeChart(block)
  const { chartType, title, labels, values, colors, showValues, showLegend, showGrid, bg } = cfg
  const maxVal = Math.max(...values.map(v => Math.max(0, v)), 1)
  const stepUnit = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxVal)) - 1))
  const niceMax = Math.ceil(maxVal / stepUnit) * stepUnit || maxVal
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1
  const areaGradId = `cg-${gid || block.id || 'x'}`
  const isTransparent = bg === 'transparent'

  const renderSvgChart = () => {
    if (chartType === 'pie' || chartType === 'donut') {
      const W = 440, H = 240
      const cx = showLegend ? 132 : 220
      const cy = 122
      const rOuter = 94
      const rInner = chartType === 'donut' ? 54 : 0
      let angle = 0
      const slices = values.map((v, i) => {
        const safeV = Math.max(0, v)
        const deg = (safeV / total) * 360
        const start = angle
        const end = angle + deg
        angle = end
        const mid = start + deg / 2
        const labelR = chartType === 'donut' ? (rOuter + rInner) / 2 : rOuter * 0.64
        const pt = polarToCartesian(cx, cy, labelR, mid)
        const pct = Math.round((safeV / total) * 100)
        return { d: arcSlicePath(cx, cy, rOuter, rInner, start, end), color: colors[i], pt, pct, val: safeV, label: labels[i] }
      })
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
          {slices.map((sl, i) => (
            <g key={i}>
              <path d={sl.d} fill={sl.color} stroke="#ffffff" strokeWidth="2" />
              {showValues && sl.pct >= 6 && (
                <text x={sl.pt.x} y={sl.pt.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
                  {sl.pct}%
                </text>
              )}
            </g>
          ))}
          {chartType === 'donut' && (
            <g>
              <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">Всего</text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontSize="18" fill="#0f172a" fontWeight="800">{total}</text>
            </g>
          )}
          {showLegend && (
            <g transform="translate(254, 24)">
              {slices.slice(0, 8).map((sl, i) => (
                <g key={i} transform={`translate(0, ${i * 25})`}>
                  <rect x="0" y="0" width="12" height="12" rx="3" fill={sl.color} />
                  <text x="18" y="10" fontSize="11.5" fontWeight="600" fill="#1e293b">
                    {sl.label.length > 13 ? sl.label.slice(0, 13) + '…' : sl.label}
                  </text>
                  <text x="174" y="10" textAnchor="end" fontSize="11.5" fontWeight="700" fill="#475569">
                    {sl.val} ({sl.pct}%)
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      )
    }

    if (chartType === 'hbar') {
      const W = 440, H = 240
      const padL = 96, padR = 44, padT = 16, padB = 22
      const plotW = W - padL - padR
      const plotH = H - padT - padB
      const rowH = plotH / Math.max(values.length, 1)
      const barH = Math.min(28, rowH * 0.62)
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
          {showGrid && [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const x = padL + plotW * t
            return (
              <g key={i}>
                <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="#e2e8f0" strokeDasharray={i === 0 ? undefined : '3 3'} />
                <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">{Math.round(niceMax * t)}</text>
              </g>
            )
          })}
          {values.map((v, i) => {
            const safeV = Math.max(0, v)
            const bw = Math.max(3, (safeV / niceMax) * plotW)
            const y = padT + i * rowH + (rowH - barH) / 2
            return (
              <g key={i}>
                <text x={padL - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#334155">
                  {labels[i].length > 12 ? labels[i].slice(0, 12) + '…' : labels[i]}
                </text>
                <rect x={padL} y={y} width={bw} height={barH} rx="5" fill={colors[i]} />
                {showValues && (
                  <text x={padL + bw + 6} y={y + barH / 2 + 4} fontSize="11" fontWeight="700" fill="#0f172a">
                    {safeV}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )
    }

    if (chartType === 'line' || chartType === 'area') {
      const W = 440, H = 240
      const padL = 42, padR = 20, padT = 22, padB = 34
      const plotW = W - padL - padR
      const plotH = H - padT - padB
      const pts = values.map((v, i) => {
        const x = padL + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW)
        const y = padT + plotH - (Math.max(0, v) / niceMax) * plotH
        return { x, y, val: v, label: labels[i] }
      })
      const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
      const areaD = pts.length
        ? `M ${pts[0].x} ${padT + plotH} L ${pts.map(p => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${padT + plotH} Z`
        : ''
      const mainCol = colors[0] || '#2563eb'
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={mainCol} stopOpacity="0.34" />
              <stop offset="100%" stopColor={mainCol} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {showGrid && [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const y = padT + plotH * (1 - t)
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeDasharray={i === 0 ? undefined : '3 3'} />
                <text x={padL - 7} y={y + 3.5} textAnchor="end" fontSize="10" fill="#64748b">{Math.round(niceMax * t)}</text>
              </g>
            )
          })}
          {chartType === 'area' && areaD && <path d={areaD} fill={`url(#${areaGradId})`} />}
          <polyline points={poly} fill="none" stroke={mainCol} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke={mainCol} strokeWidth="2.8" />
              {showValues && (
                <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">{p.val}</text>
              )}
              <text x={p.x} y={H - 12} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#475569">
                {p.label.length > 10 ? p.label.slice(0, 10) + '…' : p.label}
              </text>
            </g>
          ))}
        </svg>
      )
    }

    const W = 440, H = 240
    const padL = 42, padR = 16, padT = 22, padB = 34
    const plotW = W - padL - padR
    const plotH = H - padT - padB
    const slotW = plotW / Math.max(values.length, 1)
    const barW = Math.min(48, slotW * 0.58)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = padT + plotH * (1 - t)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeDasharray={i === 0 ? undefined : '3 3'} />
              <text x={padL - 7} y={y + 3.5} textAnchor="end" fontSize="10" fill="#64748b">{Math.round(niceMax * t)}</text>
            </g>
          )
        })}
        {values.map((v, i) => {
          const safeV = Math.max(0, v)
          const bh = Math.max(3, (safeV / niceMax) * plotH)
          const x = padL + i * slotW + (slotW - barW) / 2
          const y = padT + plotH - bh
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx="5" fill={colors[i]} />
              {showValues && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">{safeV}</text>
              )}
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#475569">
                {labels[i].length > 10 ? labels[i].slice(0, 10) + '…' : labels[i]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div
      className="w-full h-full flex flex-col rounded-xl overflow-hidden select-none"
      style={{
        background: isTransparent ? 'transparent' : bg,
        border: isTransparent ? 'none' : '1px solid #e2e8f0',
        padding: '10px 12px 6px',
        boxShadow: block.style?.shadow ? '0 8px 22px rgba(15,23,42,0.12)' : undefined,
      }}
    >
      {title && (
        <div className="text-center font-bold text-slate-800 text-sm mb-1 truncate shrink-0">
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0 w-full">{renderSvgChart()}</div>
    </div>
  )
}

/* ==================== Excel-Style Live Chart Data Editor Modal ==================== */
export function ChartDataModal({
  block,
  onChange,
  onClose,
}: {
  block: any
  onChange: (patch: { style?: any; chartData?: any }) => void
  onClose: () => void
}) {
  const cd = { ...createDefaultChartData(), ...(block.chartData || {}) }
  const chartType: ChartKind = (block.style?.chartType || 'bar') as ChartKind
  const pal = CHART_PALETTES[cd.palette || 'corporate']?.colors || CHART_PALETTES.corporate.colors

  const patchData = (p: any) => onChange({ chartData: { ...cd, ...p } })

  const updateRow = (idx: number, field: 'label' | 'value' | 'color', val: any) => {
    const labels = [...(cd.labels || [])]
    const values = [...(cd.values || [])]
    const colors = [...(cd.colors || [])]
    while (labels.length < values.length) labels.push(`Пункт ${labels.length + 1}`)
    if (field === 'label') labels[idx] = String(val)
    if (field === 'value') values[idx] = Number(val) || 0
    if (field === 'color') colors[idx] = String(val)
    patchData({ labels, values, colors })
  }

  const addRow = () => {
    patchData({
      labels: [...(cd.labels || []), `Пункт ${(cd.values?.length || 0) + 1}`],
      values: [...(cd.values || []), 50],
    })
  }

  const delRow = (idx: number) => {
    if ((cd.values?.length || 0) <= 1) return
    patchData({
      labels: (cd.labels || []).filter((_: any, i: number) => i !== idx),
      values: (cd.values || []).filter((_: any, i: number) => i !== idx),
      colors: (cd.colors || []).filter((_: any, i: number) => i !== idx),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <BarChart3 size={17} className="text-[#b7472a]" /> Редактор диаграммы и данных
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center dark:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto">
          {/* Живой предпросмотр */}
          <div className="space-y-3">
            <div className="h-[250px] rounded-xl bg-slate-100 dark:bg-slate-800 p-2 border dark:border-slate-700">
              <SlideChart block={{ ...block, chartData: cd, style: { ...block.style, chartType } }} gid="modal-preview" />
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-1.5">Тип диаграммы</div>
              <div className="grid grid-cols-3 gap-1.5">
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => onChange({ style: { chartType: ct.id } })}
                    className={`py-1.5 rounded-lg border text-xs font-bold ${
                      chartType === ct.id
                        ? 'bg-[#b7472a] text-white border-[#b7472a]'
                        : 'bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-1.5">Быстрые примеры</div>
              <div className="flex flex-wrap gap-1.5">
                {CHART_PRESETS.map(pr => (
                  <button
                    key={pr.name}
                    type="button"
                    onClick={() => patchData({ title: pr.title, labels: pr.labels, values: pr.values, colors: [] })}
                    className="px-2.5 py-1 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#b7472a] text-xs font-semibold dark:text-slate-200"
                  >
                    {pr.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Таблица данных как в Excel */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Заголовок диаграммы</label>
              <input
                value={cd.title || ''}
                onChange={e => patchData({ title: e.target.value })}
                placeholder="Например: Успеваемость по четвертям"
                className="w-full px-3 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm font-semibold"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Таблица значений</span>
              <button type="button" onClick={addRow} className="px-2.5 py-1 rounded-lg bg-[#b7472a] text-white text-xs font-bold flex items-center gap-1">
                <Plus size={13} /> Добавить строку
              </button>
            </div>

            <div className="border dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[34px_1fr_84px_32px] gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500">
                <span>Цвет</span>
                <span>Категория / Подпись</span>
                <span className="text-right">Значение</span>
                <span />
              </div>
              <div className="divide-y dark:divide-slate-800 max-h-[220px] overflow-y-auto">
                {(cd.values || []).map((val: number, idx: number) => (
                  <div key={idx} className="grid grid-cols-[34px_1fr_84px_32px] gap-1.5 px-2.5 py-1.5 items-center bg-white dark:bg-slate-900">
                    <input
                      type="color"
                      value={cd.colors?.[idx] || pal[idx % pal.length]}
                      onChange={e => updateRow(idx, 'color', e.target.value)}
                      className="w-7 h-7 rounded border dark:border-slate-600 cursor-pointer p-0"
                    />
                    <input
                      value={cd.labels?.[idx] ?? ''}
                      onChange={e => updateRow(idx, 'label', e.target.value)}
                      className="px-2 py-1 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs"
                    />
                    <input
                      type="number"
                      value={val}
                      onChange={e => updateRow(idx, 'value', e.target.value)}
                      className="px-2 py-1 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs font-mono text-right"
                    />
                    <button
                      type="button"
                      onClick={() => delRow(idx)}
                      disabled={(cd.values?.length || 0) <= 1}
                      className="w-7 h-7 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 flex items-center justify-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(CHART_PALETTES).map(([pid, p]) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => patchData({ palette: pid, colors: [] })}
                  className={`p-1.5 rounded-lg border text-left ${
                    (cd.palette || 'corporate') === pid ? 'border-[#b7472a] ring-1 ring-[#b7472a]' : 'dark:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] font-bold mb-1 dark:text-slate-200">{p.name}</div>
                  <div className="flex gap-0.5">
                    {p.colors.slice(0, 4).map((c, i) => <span key={i} className="h-2 flex-1 rounded-xs" style={{ background: c }} />)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t dark:border-slate-700 flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white text-xs font-bold">
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   4. HTML EXPORT HELPERS (PDF / Print export matches the slide 1:1!)
   ============================================================================ */

const escHtml = (s: string) =>
  String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])

const safeColor = (v: any, fb: string) => {
  const s = String(v || '').trim()
  if (/^(?:#[0-9a-fA-F]{3,8}|rgba?\([0-9.,\s%]+\)|transparent|none)$/.test(s)) return s
  return fb
}
const safeNumVal = (v: any, fb: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}
const safeSvgPath = (v: any) => String(v || '').replace(/[^0-9eE.,+\-\sMmLlHhVvCcSsQqTtAaZz]/g, '').slice(0, 8000)
const safeId = (v: any) => String(v || 'x').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'x'
const safeAlignVal = (v: any, fb = 'left') => (['left', 'center', 'right', 'justify'].includes(String(v)) ? String(v) : fb)

export function renderShapeHtml(block: any, posStyle: string): string {
  const st = block.style || {}
  const def = getShapeDef(block.shape || st.preset || 'rect')
  const rawFill = st.fill === 'transparent' || st.fill === 'none' ? 'none' : (st.fill || '#3b82f6')
  const grad = typeof rawFill === 'string' && rawFill.startsWith('linear-gradient') ? parseCssGradient(rawFill) : null
  const gid = `pdf-g-${safeId(block.id)}`
  const gradDef = grad
    ? `<defs><linearGradient id="${gid}" x1="${safeNumVal(grad.x1, 0)}" y1="${safeNumVal(grad.y1, 0)}" x2="${safeNumVal(grad.x2, 1)}" y2="${safeNumVal(grad.y2, 1)}">${grad.stops.map(s => `<stop offset="${safeNumVal(s.offset, 0)}%" stop-color="${safeColor(s.color, '#3b82f6')}" stop-opacity="${safeNumVal(s.opacity, 1)}"/>`).join('')}</linearGradient></defs>`
    : ''
  const fillVal = grad ? `url(#${gid})` : safeColor(rawFill, '#3b82f6')
  const strokeVal = st.stroke === 'transparent' || st.stroke === 'none' ? 'none' : safeColor(st.stroke, '#1d4ed8')
  const sw = Math.max(0, Math.min(30, safeNumVal(st.strokeWidth, def.isLine ? 3 : 2)))
  const svg = st.svgPath
    ? `<svg viewBox="0 0 ${Math.max(1, safeNumVal(st.svgW, 10000))} ${Math.max(1, safeNumVal(st.svgH, 10000))}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">${gradDef}<path d="${safeSvgPath(st.svgPath)}" fill="${fillVal}" stroke="${strokeVal}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/></svg>`
    : def.toHtmlSvg(fillVal, strokeVal, sw, st.dash, gradDef)
  const txt = block.content
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;color:${safeColor(st.textColor, '#ffffff')};font-size:${safeNumVal(st.textSize, 16)}px;font-weight:${st.textBold !== false ? 700 : 400};text-align:${safeAlignVal(st.textAlign, 'center')};white-space:pre-wrap">${escHtml(block.content)}</div>`
    : ''
  const rot = safeNumVal(st.rotation, 0)
  return `<div style="${posStyle}opacity:${Math.max(0, Math.min(1, safeNumVal(st.opacity, 1)))};transform:${rot ? `rotate(${rot}deg)` : 'none'}">${svg}${txt}</div>`
}

export function renderTableHtml(block: any, posStyle: string): string {
  const tbl = block.table || {}
  const rows = Math.max(1, Math.min(50, Math.round(safeNumVal(tbl.rows, tbl.cells?.length || 3))))
  const cols = Math.max(1, Math.min(30, Math.round(safeNumVal(tbl.cols, tbl.cells?.[0]?.length || 3))))
  const theme = getTableTheme(tbl.theme)
  const headerRow = tbl.headerRow !== false
  const striped = tbl.striped !== false
  const fs = Math.max(8, Math.min(48, safeNumVal(tbl.fontSize, 13)))
  let body = ''
  for (let r = 0; r < rows; r++) {
    body += '<tr>'
    for (let c = 0; c < cols; c++) {
      const cell = tbl.cells?.[r]?.[c] || { text: '', style: {} }
      if (cell.merged) continue
      const isHdr = headerRow && r === 0
      const cs = cell.style || {}
      const bg = safeColor(cs.background, isHdr ? theme.headerBg : (striped && r % 2 === 0 ? theme.zebraBg : theme.cellBg))
      const col = safeColor(cs.color, isHdr ? theme.headerText : theme.text)
      const bold = cs.bold !== undefined ? cs.bold : isHdr
      const csSpan = Math.max(1, Math.min(30, Math.round(safeNumVal(cell.colspan, 1))))
      const rsSpan = Math.max(1, Math.min(50, Math.round(safeNumVal(cell.rowspan, 1))))
      body += `<td colspan="${csSpan}" rowspan="${rsSpan}" style="background:${bg};color:${col};border:1px solid ${safeColor(theme.border, '#cbd5e1')};padding:5px 7px;font-weight:${bold ? 700 : 400};text-align:${safeAlignVal(cs.align || tbl.align, 'left')};font-size:${fs}px">${escHtml(cell.text || '')}</td>`
    }
    body += '</tr>'
  }
  return `<div style="${posStyle}overflow:hidden;border-radius:8px;border:1.5px solid ${safeColor(theme.border, '#cbd5e1')}"><table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed">${body}</table></div>`
}

export function renderChartHtml(block: any, posStyle: string): string {
  const cfg = normalizeChart(block)
  const maxVal = Math.max(...cfg.values.map(v => Math.max(0, v)), 1)
  const total = cfg.values.reduce((a, b) => a + Math.max(0, b), 0) || 1
  let svg = ''
  if (cfg.chartType === 'pie' || cfg.chartType === 'donut') {
    const cx = 132, cy = 120, rO = 90, rI = cfg.chartType === 'donut' ? 50 : 0
    let ang = 0
    const parts = cfg.values.map((v, i) => {
      const sv = Math.max(0, v)
      const d = (sv / total) * 360
      const p = arcSlicePath(cx, cy, rO, rI, ang, ang + d)
      ang += d
      const pct = Math.round((sv / total) * 100)
      return { p, color: safeColor(cfg.colors[i], '#2563eb'), label: cfg.labels[i], sv, pct }
    })
    svg = `<svg viewBox="0 0 440 240" style="width:100%;height:100%">${parts.map(x => `<path d="${x.p}" fill="${x.color}" stroke="#fff" stroke-width="2"/>`).join('')}<g transform="translate(254,24)">${parts.slice(0, 8).map((x, i) => `<g transform="translate(0,${i * 24})"><rect width="12" height="12" rx="3" fill="${x.color}"/><text x="18" y="10" font-size="11" fill="#1e293b">${escHtml(x.label)} — ${x.sv} (${x.pct}%)</text></g>`).join('')}</g></svg>`
  } else if (cfg.chartType === 'hbar') {
    const W = 440, H = 240, padL = 96, padR = 44, padT = 16, padB = 22, pw = W - padL - padR, ph = H - padT - padB
    const rh = ph / Math.max(cfg.values.length, 1), bh = Math.min(28, rh * 0.62)
    svg = `<svg viewBox="0 0 440 240" style="width:100%;height:100%">${cfg.values.map((v, i) => {
      const sv = Math.max(0, v)
      const bw = Math.max(3, (sv / maxVal) * pw)
      const y = padT + i * rh + (rh - bh) / 2
      return `<text x="${padL - 8}" y="${y + bh / 2 + 4}" text-anchor="end" font-size="11" fill="#334155">${escHtml(cfg.labels[i])}</text><rect x="${padL}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${safeColor(cfg.colors[i], '#2563eb')}"/><text x="${padL + bw + 6}" y="${y + bh / 2 + 4}" font-size="11" font-weight="700" fill="#0f172a">${sv}</text>`
    }).join('')}</svg>`
  } else if (cfg.chartType === 'line' || cfg.chartType === 'area') {
    const W = 440, H = 240, padL = 42, padR = 20, padT = 22, padB = 34, pw = W - padL - padR, ph = H - padT - padB
    const pts = cfg.values.map((v, i) => ({
      x: padL + (cfg.values.length === 1 ? pw / 2 : (i / (cfg.values.length - 1)) * pw),
      y: padT + ph - (Math.max(0, v) / maxVal) * ph,
      v,
      l: cfg.labels[i],
    }))
    const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
    const col = safeColor(cfg.colors[0], '#2563eb')
    const area = cfg.chartType === 'area' && pts.length
      ? `<path d="M ${pts[0].x} ${padT + ph} L ${pts.map(p => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${padT + ph} Z" fill="${col}" fill-opacity="0.22"/>`
      : ''
    svg = `<svg viewBox="0 0 440 240" style="width:100%;height:100%">${area}<polyline points="${poly}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#fff" stroke="${col}" stroke-width="2.5"/><text x="${p.x}" y="${p.y - 9}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${p.v}</text><text x="${p.x}" y="${H - 12}" text-anchor="middle" font-size="10.5" fill="#475569">${escHtml(p.l)}</text>`).join('')}</svg>`
  } else {
    const W = 440, H = 240, padL = 42, padR = 16, padT = 22, padB = 34, pw = W - padL - padR, ph = H - padT - padB
    const sw = pw / Math.max(cfg.values.length, 1), bw = Math.min(48, sw * 0.58)
    svg = `<svg viewBox="0 0 440 240" style="width:100%;height:100%">${cfg.values.map((v, i) => {
      const sv = Math.max(0, v)
      const bh = Math.max(3, (sv / maxVal) * ph)
      const x = padL + i * sw + (sw - bw) / 2
      const y = padT + ph - bh
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${safeColor(cfg.colors[i], '#2563eb')}"/><text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${sv}</text><text x="${x + bw / 2}" y="${H - 12}" text-anchor="middle" font-size="10.5" fill="#475569">${escHtml(cfg.labels[i])}</text>`
    }).join('')}</svg>`
  }
  const safeBg = safeColor(cfg.bg, '#ffffff')
  const titleHtml = cfg.title ? `<div style="text-align:center;font-weight:700;font-size:14px;color:#1e293b;margin-bottom:4px">${escHtml(cfg.title)}</div>` : ''
  return `<div style="${posStyle}background:${safeBg};border:${safeBg === 'transparent' ? 'none' : '1px solid #e2e8f0'};border-radius:10px;padding:8px;display:flex;flex-direction:column">${titleHtml}<div style="flex:1;min-height:0">${svg}</div></div>`
}
