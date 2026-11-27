import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, TrendingUp, Axis3d } from 'lucide-react'

type CurveItem = {
  id: string
  expr: string
  color: string
}

const CURVE_COLORS = ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#06b6d4']

const QUICK_PRESETS = [
  { label: 'x²', expr: 'x^2' },
  { label: 'x² − 3', expr: 'x^2 - 3' },
  { label: '2x + 1', expr: '2*x + 1' },
  { label: 'x³', expr: 'x^3 / 4' },
  { label: '√x', expr: 'sqrt(x) * 2' },
  { label: '|x|', expr: 'abs(x)' },
  { label: 'sin(x)', expr: 'sin(x) * 3' },
  { label: 'cos(x)', expr: 'cos(x) * 3' },
  { label: '1/x', expr: '3 / x' },
]

/** Безопасный рекурсивный парсер y = f(x) без eval и new Function. */
export function evalMathExpr(raw: string, xVal: number): number {
  const src = String(raw || '')
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/[−–—]/g, '-')
    .replace(/[·×]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/π/g, 'pi')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([a-z0-9.]+)/g, 'sqrt($1)')
    .replace(/\s+/g, '')
  if (!src || src.length > 180) return NaN

  const FUNCS: Record<string, (v: number) => number> = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    tg: Math.tan,
    abs: Math.abs,
    sqrt: Math.sqrt,
    log: Math.log10,
    ln: Math.log,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
  }

  let pos = 0
  const peek = () => src[pos] || ''

  const parseExpr = (): number => {
    let left = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++]
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const parseTerm = (): number => {
    let left = parsePower()
    while (peek() === '*' || peek() === '/' || peek() === '(' || /[a-z]/.test(peek())) {
      if (peek() === '*' || peek() === '/') {
        const op = src[pos++]
        const right = parsePower()
        left = op === '*' ? left * right : left / right
      } else {
        left = left * parsePower()
      }
    }
    return left
  }

  const parsePower = (): number => {
    const base = parseUnary()
    if (peek() === '^') {
      pos++
      return Math.pow(base, parsePower())
    }
    return base
  }

  const parseUnary = (): number => {
    if (peek() === '+') { pos++; return parseUnary() }
    if (peek() === '-') { pos++; return -parseUnary() }
    return parsePrimary()
  }

  const parsePrimary = (): number => {
    if (peek() === '(') {
      pos++
      const val = parseExpr()
      if (peek() !== ')') return NaN
      pos++
      return val
    }
    if (peek() === '|') {
      pos++
      const val = parseExpr()
      if (peek() !== '|') return NaN
      pos++
      return Math.abs(val)
    }
    const numMatch = src.slice(pos).match(/^(?:\d+\.?\d*|\.\d+)/)
    if (numMatch) {
      pos += numMatch[0].length
      return Number(numMatch[0])
    }
    const idMatch = src.slice(pos).match(/^[a-z]+/)
    if (idMatch) {
      const id = idMatch[0]
      pos += id.length
      if (id === 'x') return xVal
      if (id === 'pi') return Math.PI
      if (id === 'e') return Math.E
      if (id in FUNCS) {
        if (peek() !== '(') return NaN
        pos++
        const arg = parseExpr()
        if (peek() !== ')') return NaN
        pos++
        return FUNCS[id](arg)
      }
      return NaN
    }
    return NaN
  }

  try {
    const y = parseExpr()
    if (pos !== src.length) return NaN
    return typeof y === 'number' && Number.isFinite(y) ? y : NaN
  } catch {
    return NaN
  }
}

function renderGraphToCanvas(
  canvas: HTMLCanvasElement,
  opts: {
    curves: CurveItem[]
    range: number
    step: number
    showGrid: boolean
    showLabels: boolean
    transparentBg: boolean
    axesOnly: boolean
  }
): number {
  const { curves, range, step, showGrid, showLabels, transparentBg, axesOnly } = opts
  const size = canvas.width
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0

  ctx.clearRect(0, 0, size, size)
  if (!transparentBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = Math.max(1, size / 400)
    ctx.strokeRect(1, 1, size - 2, size - 2)
  }

  const scale = size / 560
  const pad = Math.round(44 * scale)
  const plotW = size - pad * 2
  const mid = size / 2
  const pxPerUnit = plotW / (range * 2)

  // Сетка
  if (showGrid) {
    ctx.strokeStyle = transparentBg ? 'rgba(99, 102, 241, 0.22)' : '#e2e8f0'
    ctx.lineWidth = Math.max(1, scale)
    const maxI = Math.floor(range / step)
    for (let i = -maxI; i <= maxI; i++) {
      const v = i * step
      const gx = mid + v * pxPerUnit
      const gy = mid - v * pxPerUnit
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, size - pad); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(size - pad, gy); ctx.stroke()
    }
  }

  // Оси X и Y со стрелками
  ctx.strokeStyle = '#0f172a'
  ctx.fillStyle = '#0f172a'
  ctx.lineWidth = Math.max(1.8, 2.2 * scale)
  ctx.beginPath()
  ctx.moveTo(pad, mid); ctx.lineTo(size - pad, mid)
  ctx.moveTo(mid, pad); ctx.lineTo(mid, size - pad)
  ctx.stroke()

  const arrow = 9 * scale
  // Стрелка X
  ctx.beginPath()
  ctx.moveTo(size - pad + 4 * scale, mid)
  ctx.lineTo(size - pad - arrow, mid - arrow * 0.55)
  ctx.lineTo(size - pad - arrow, mid + arrow * 0.55)
  ctx.closePath(); ctx.fill()
  // Стрелка Y
  ctx.beginPath()
  ctx.moveTo(mid, pad - 4 * scale)
  ctx.lineTo(mid - arrow * 0.55, pad + arrow)
  ctx.lineTo(mid + arrow * 0.55, pad + arrow)
  ctx.closePath(); ctx.fill()

  // Засечки и числа
  const fmt = (v: number) => {
    const r = Math.round(v * 100) / 100
    return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : String(r)
  }
  const maxI = Math.floor(range / step)
  ctx.font = `600 ${Math.round(11 * scale)}px system-ui, sans-serif`
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = Math.max(1.2, 1.5 * scale)
  for (let i = -maxI; i <= maxI; i++) {
    const v = Math.round(i * step * 100) / 100
    if (v === 0) continue
    const gx = mid + v * pxPerUnit
    const gy = mid - v * pxPerUnit
    ctx.beginPath(); ctx.moveTo(gx, mid - 4 * scale); ctx.lineTo(gx, mid + 4 * scale); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mid - 4 * scale, gy); ctx.lineTo(mid + 4 * scale, gy); ctx.stroke()
    if (showLabels) {
      ctx.fillStyle = '#475569'
      ctx.textAlign = 'center'
      ctx.fillText(fmt(v), gx, mid + 17 * scale)
      ctx.textAlign = 'right'
      ctx.fillText(fmt(v), mid - 8 * scale, gy + 4 * scale)
    }
  }
  if (showLabels) {
    ctx.fillStyle = '#0f172a'
    ctx.font = `700 ${Math.round(14 * scale)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('0', mid + 7 * scale, mid + 16 * scale)
    ctx.fillText('X', size - pad + 10 * scale, mid + 5 * scale)
    ctx.fillText('Y', mid + 10 * scale, pad - 6 * scale)
  }

  if (axesOnly) return 1

  // Построение всех графиков с отсечением по рабочей области
  ctx.save()
  ctx.beginPath()
  ctx.rect(pad, pad, plotW, plotW)
  ctx.clip()

  let totalValid = 0
  const legendEntries: { expr: string; color: string }[] = []

  for (const curve of curves) {
    const expr = curve.expr.trim()
    if (!expr) continue
    ctx.strokeStyle = curve.color
    ctx.lineWidth = Math.max(2.4, 3.2 * scale)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()

    let started = false
    let prevY = NaN
    let validPts = 0
    const samples = Math.max(400, Math.round(plotW * 1.5))
    for (let i = 0; i <= samples; i++) {
      const px = (i / samples) * plotW
      const xv = (px - plotW / 2) / pxPerUnit
      const yv = evalMathExpr(expr, xv)
      if (!Number.isFinite(yv) || Math.abs(yv) > range * 2.5) {
        started = false
        prevY = NaN
        continue
      }
      // Разрываем линию на вертикальных асимптотах (например, 1/x или tan(x))
      if (Number.isFinite(prevY) && Math.abs(yv - prevY) > range * 1.4) {
        started = false
      }
      const cx = pad + px
      const cy = mid - yv * pxPerUnit
      if (!started) {
        ctx.moveTo(cx, cy)
        started = true
      } else {
        ctx.lineTo(cx, cy)
      }
      prevY = yv
      validPts++
    }
    ctx.stroke()
    if (validPts >= 2) {
      totalValid += validPts
      legendEntries.push({ expr, color: curve.color })
    }
  }
  ctx.restore()

  // Аккуратная легенда формул в левом верхнем углу
  if (legendEntries.length > 0) {
    ctx.font = `700 ${Math.round(13 * scale)}px ui-monospace, SFMono-Regular, monospace`
    ctx.textAlign = 'left'
    legendEntries.forEach((item, idx) => {
      const ly = Math.round((20 + idx * 18) * scale)
      ctx.fillStyle = item.color
      ctx.fillText(`y = ${item.expr}`, pad, ly)
    })
  }

  return totalValid
}

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (dataUrl: string, sizePx: number, label: string) => void
}

export default function GraphBuilderModal({ open, onClose, onInsert }: Props) {
  const [curves, setCurves] = useState<CurveItem[]>([
    { id: 'c1', expr: 'x^2 - 3', color: '#4f46e5' },
  ])
  const [activeId, setActiveId] = useState<string>('c1')
  const [range, setRange] = useState<number>(10)
  const [step, setStep] = useState<number>(1)
  const [showGrid, setShowGrid] = useState<boolean>(true)
  const [showLabels, setShowLabels] = useState<boolean>(true)
  const [transparentBg, setTransparentBg] = useState<boolean>(false)
  const [hasValidCurve, setHasValidCurve] = useState<boolean>(true)
  const previewRef = useRef<HTMLCanvasElement | null>(null)

  // Автоподбор удобного шага при смене масштаба осей
  const changeRange = (nextRange: number) => {
    setRange(nextRange)
    if (nextRange <= 5) setStep(1)
    else if (nextRange <= 10) setStep(1)
    else if (nextRange <= 15) setStep(2)
    else setStep(5)
  }

  useEffect(() => {
    if (!open || !previewRef.current) return
    const pts = renderGraphToCanvas(previewRef.current, {
      curves,
      range,
      step,
      showGrid,
      showLabels,
      transparentBg,
      axesOnly: false,
    })
    setHasValidCurve(pts >= 2)
  }, [open, curves, range, step, showGrid, showLabels, transparentBg])

  if (!open) return null

  const updateCurve = (id: string, patch: Partial<CurveItem>) => {
    setCurves(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const addCurve = () => {
    if (curves.length >= 4) return
    const nextColor = CURVE_COLORS[curves.length % CURVE_COLORS.length]
    const id = 'c' + Date.now()
    const defaults = ['2*x + 1', 'sin(x) * 3', '-x^2 + 4']
    const expr = defaults[(curves.length - 1) % defaults.length]
    setCurves(prev => [...prev, { id, expr, color: nextColor }])
    setActiveId(id)
  }

  const removeCurve = (id: string) => {
    if (curves.length <= 1) {
      updateCurve(id, { expr: '' })
      return
    }
    const next = curves.filter(c => c.id !== id)
    setCurves(next)
    if (activeId === id && next[0]) setActiveId(next[0].id)
  }

  const applyPreset = (expr: string) => {
    const target = curves.find(c => c.id === activeId) || curves[0]
    if (target) updateCurve(target.id, { expr })
  }

  const exportAndInsert = (axesOnly: boolean) => {
    const c = document.createElement('canvas')
    c.width = 960
    c.height = 960
    const pts = renderGraphToCanvas(c, {
      curves,
      range,
      step,
      showGrid,
      showLabels,
      transparentBg,
      axesOnly,
    })
    if (!axesOnly && pts < 2) return
    const label = axesOnly
      ? `Оси X/Y (±${range})`
      : curves
          .map(x => x.expr.trim())
          .filter(Boolean)
          .map(e => `y = ${e}`)
          .join(', ')
    onInsert(c.toDataURL('image/png'), 460, label)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[900] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[780px] max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </span>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white leading-tight">
                График функций и оси координат
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Живой предпросмотр — вводи формулу и сразу вставляй на доску
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
          {/* Левая часть — формулы и настройки */}
          <div className="md:col-span-6 flex flex-col gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Функции y = f(x)</span>
                {curves.length < 4 && (
                  <button
                    type="button"
                    onClick={addCurve}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Добавить ещё график
                  </button>
                )}
              </div>

              {curves.map((curve, idx) => {
                const isActive = curve.id === activeId
                return (
                  <div
                    key={curve.id}
                    onClick={() => setActiveId(curve.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="color"
                      value={curve.color}
                      onChange={e => updateCurve(curve.id, { color: e.target.value })}
                      title="Цвет линии графика"
                      className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer shrink-0 p-0"
                    />
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
                      y{curves.length > 1 ? idx + 1 : ''} =
                    </span>
                    <input
                      value={curve.expr}
                      onFocus={() => setActiveId(curve.id)}
                      onChange={e => updateCurve(curve.id, { expr: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && exportAndInsert(false)}
                      placeholder="x^2 - 3, sin(x)*3, 2x+1…"
                      className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeCurve(curve.id) }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Удалить функцию"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Быстрые шаблоны функций */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                Быстрые функции (подставятся в активную строку):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.expr)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-700 dark:text-slate-200 text-xs font-mono font-semibold transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Настройки осей */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                  Оси:
                  <select
                    value={range}
                    onChange={e => changeRange(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-semibold"
                  >
                    {[5, 10, 15, 20, 30].map(r => (
                      <option key={r} value={r}>±{r}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                  Шаг:
                  <select
                    value={step}
                    onChange={e => setStep(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-semibold"
                  >
                    {[0.5, 1, 2, 5].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="rounded" />
                  Сетка
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="rounded" />
                  Цифры на осях
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={transparentBg} onChange={e => setTransparentBg(e.target.checked)} className="rounded" />
                  Прозрачный фон
                </label>
              </div>
            </div>
          </div>

          {/* Правая часть — живой предпросмотр */}
          <div className="md:col-span-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-[320px] aspect-square rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_75%,#f8fafc_75%),linear-gradient(45deg,#f8fafc_25%,#ffffff_25%,#ffffff_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] shadow-inner">
              <canvas ref={previewRef} width={560} height={560} className="w-full h-full block" />
            </div>
            {!hasValidCurve && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                Введите корректную формулу (например: x^2 - 3 или sin(x)*3)
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => exportAndInsert(true)}
            className="px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <Axis3d size={15} /> Вставить только оси X/Y
          </button>
          <button
            type="button"
            disabled={!hasValidCurve}
            onClick={() => exportAndInsert(false)}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <TrendingUp size={15} /> Вставить график на доску
          </button>
        </div>
      </div>
    </div>
  )
}
