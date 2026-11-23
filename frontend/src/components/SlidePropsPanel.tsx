import React from 'react'
import {
  Wand2, Copy, Trash2, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  BringToFront, SendToBack, Lock, Unlock, Plus, Minus, AlignLeft, AlignCenter,
  AlignRight, Bold, RotateCcw, Image as ImgIcon, Layers,
} from 'lucide-react'
import {
  SHAPE_CATALOG, SHAPE_GRADIENTS, SHAPE_QUICK_STYLES, ShapeThumb,
  TABLE_THEMES,
  CHART_TYPES, CHART_PALETTES, ChartKind, createDefaultChartData,
} from './SlideVisuals'

const FONTS = ['Inter', 'Manrope', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana']
const ANIMATIONS = [
  { id: 'нет', label: 'Нет' },
  { id: 'fadeIn', label: 'Плавное появление' },
  { id: 'slideIn', label: 'Выезд снизу' },
  { id: 'zoomIn', label: 'Увеличение' },
  { id: 'bounce', label: 'Отскок' },
  { id: 'flip', label: 'Поворот' },
  { id: 'float', label: 'Парение' },
]
const TRANSITIONS = ['нет', 'fade', 'slide', 'zoom', 'wipe', 'split', 'random']

const SLIDE_GRADIENTS = [
  { name: 'Полночь', css: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)' },
  { name: 'Океан', css: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 60%, #0ea5e9 100%)' },
  { name: 'Изумруд', css: 'linear-gradient(135deg, #022c22 0%, #065f46 60%, #0d9488 100%)' },
  { name: 'Закат', css: 'linear-gradient(135deg, #4c1d95 0%, #be123c 55%, #f97316 100%)' },
  { name: 'Светлый', css: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)' },
  { name: 'Тёплый', css: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' },
]

export interface SlidePropsPanelProps {
  cur: any
  curSelected: any
  selectedBlock: string | null
  activeCell: { r: number; c: number } | null
  runStyleOf: (cb: any) => any
  restyleParas: (oldPs: any[], val: string) => any[]
  updateSelected: (patch: any) => void
  updateSelectedStyle: (patch: any) => void
  updateSlide: (patch: any) => void
  applyTransitionAll: (tr: string) => void
  centerBlock: (axis: 'h' | 'v') => void
  bringForward: () => void
  sendBackward: () => void
  duplicateBlock: () => void
  deleteSelected: () => void
  onUploadReplaceImage: (file: File) => void
  onPickBgImage: () => void
  onEditTableSize: (action: 'addRow' | 'delRow' | 'addCol' | 'delCol') => void
  onUpdateTableProps: (patch: any) => void
  onUpdateActiveCellStyle: (patch: any) => void
  onOpenChartModal?: () => void
}

export default function SlidePropsPanel({
  cur,
  curSelected,
  selectedBlock,
  activeCell,
  runStyleOf,
  restyleParas,
  updateSelected,
  updateSelectedStyle,
  updateSlide,
  applyTransitionAll,
  centerBlock,
  bringForward,
  sendBackward,
  duplicateBlock,
  deleteSelected,
  onUploadReplaceImage,
  onPickBgImage,
  onEditTableSize,
  onUpdateTableProps,
  onUpdateActiveCellStyle,
  onOpenChartModal,
}: SlidePropsPanelProps) {
  const typeLabel: Record<string, string> = {
    text: 'Текстовый блок',
    shape: 'Фигура',
    table: 'Таблица',
    chart: 'Диаграмма',
    image: 'Изображение',
    video: 'Видео',
    icon: 'Стикер / Иконка',
  }

  // ---- Хелперы редактирования данных диаграммы ----
  const chartData = curSelected?.type === 'chart'
    ? { ...createDefaultChartData(), ...(curSelected.chartData || {}) }
    : null

  const patchChart = (patch: any) => {
    if (!curSelected) return
    updateSelected({ chartData: { ...(chartData || createDefaultChartData()), ...patch } })
  }

  const updateChartRow = (idx: number, field: 'label' | 'value' | 'color', val: any) => {
    if (!chartData) return
    const labels = [...(chartData.labels || [])]
    const values = [...(chartData.values || [])]
    const colors = [...(chartData.colors || [])]
    while (labels.length < values.length) labels.push(`Пункт ${labels.length + 1}`)
    if (field === 'label') labels[idx] = String(val)
    if (field === 'value') values[idx] = Number(val) || 0
    if (field === 'color') colors[idx] = String(val)
    patchChart({ labels, values, colors })
  }

  const addChartRow = () => {
    if (!chartData) return
    const labels = [...(chartData.labels || []), `Пункт ${(chartData.values?.length || 0) + 1}`]
    const values = [...(chartData.values || []), 50]
    patchChart({ labels, values })
  }

  const removeChartRow = (idx: number) => {
    if (!chartData || (chartData.values?.length || 0) <= 1) return
    const labels = (chartData.labels || []).filter((_: any, i: number) => i !== idx)
    const values = (chartData.values || []).filter((_: any, i: number) => i !== idx)
    const colors = (chartData.colors || []).filter((_: any, i: number) => i !== idx)
    patchChart({ labels, values, colors })
  }

  const activeCellObj =
    curSelected?.type === 'table' && activeCell
      ? curSelected.table?.cells?.[activeCell.r]?.[activeCell.c]
      : null

  return (
    <>
      <div className="p-3 border-b dark:border-slate-700 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm dark:text-white flex items-center gap-1.5">
            <Wand2 size={14} className="text-[#d24726]" />
            {selectedBlock && curSelected ? (typeLabel[curSelected.type] || 'Свойства') : 'Свойства слайда'}
          </h3>
          {selectedBlock && curSelected && (
            <button
              type="button"
              onClick={() => updateSelectedStyle({ locked: !curSelected.style?.locked })}
              title={curSelected.style?.locked ? 'Разблокировать элемент' : 'Заблокировать положение'}
              className={`p-1 rounded-md text-xs flex items-center gap-1 ${
                curSelected.style?.locked
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {curSelected.style?.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
          )}
        </div>
        {!selectedBlock && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Настройки текущего слайда или кликните по элементу
          </div>
        )}
      </div>

      <div className="flex-1 p-3 space-y-3.5 overflow-y-auto dark:text-slate-200 text-xs">
        {/* ================= СВОЙСТВА СЛАЙДА (если ничего не выделено) ================= */}
        {!selectedBlock && cur && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Фон слайда</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cur.background?.startsWith('#') ? cur.background : '#ffffff'}
                  onChange={e => updateSlide({ background: e.target.value, backgroundType: 'solid', gradient: undefined, bgImage: undefined })}
                  className="w-10 h-9 rounded-lg border dark:border-slate-600 cursor-pointer shrink-0"
                />
                <button
                  type="button"
                  onClick={onPickBgImage}
                  className="flex-1 h-9 px-2.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 font-semibold flex items-center justify-center gap-1.5"
                >
                  <ImgIcon size={13} /> Фото фона
                </button>
                {(cur.bgImage || cur.gradient) && (
                  <button
                    type="button"
                    onClick={() => updateSlide({ background: '#ffffff', backgroundType: 'solid', gradient: undefined, bgImage: undefined })}
                    className="h-9 px-2 rounded-lg border dark:border-slate-700 text-slate-500 hover:text-red-500"
                    title="Сбросить фон"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {SLIDE_GRADIENTS.map(g => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => updateSlide({ backgroundType: 'gradient', gradient: g.css, bgImage: undefined })}
                    className="h-7 rounded-md border border-slate-300/70 dark:border-slate-600 text-[10px] font-bold shadow-xs hover:scale-[1.03] transition"
                    style={{ background: g.css, color: g.name === 'Светлый' || g.name === 'Тёплый' ? '#1e293b' : '#ffffff' }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t dark:border-slate-700">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Переход слайда</label>
              <div className="flex flex-wrap gap-1">
                {TRANSITIONS.map(tr => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => updateSlide({ transition: tr })}
                    className={`px-2 py-1 rounded-md border text-[11px] font-semibold capitalize ${
                      (cur.transition || 'нет') === tr
                        ? 'bg-[#b7472a] text-white border-[#b7472a]'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tr}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => applyTransitionAll(cur.transition || 'fade')}
                className="mt-2 w-full py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
              >
                <Layers size={12} /> Применить переход ко всем слайдам
              </button>
            </div>

            <div className="pt-2 border-t dark:border-slate-700">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Соотношение сторон</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateSlide({ width: 960, height: 540 })}
                  className={`py-1.5 rounded-lg border text-[11px] font-bold ${
                    !cur.width || cur.width / (cur.height || 540) > 1.5
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  16:9 Широкий
                </button>
                <button
                  type="button"
                  onClick={() => updateSlide({ width: 960, height: 720 })}
                  className={`py-1.5 rounded-lg border text-[11px] font-bold ${
                    cur.width && cur.height && cur.width / cur.height <= 1.5
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  4:3 Стандарт
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ОБЩАЯ ГЕОМЕТРИЯ БЛОКА ================= */}
        {selectedBlock && curSelected?.style?.x !== undefined && (
          <div className="space-y-2 pb-3 border-b dark:border-slate-700">
            <div className="grid grid-cols-4 gap-1.5">
              {[['X', 'x'], ['Y', 'y'], ['Ш', 'w'], ['В', 'h']].map(([lab, k]: any) => (
                <label key={k} className="text-[10px] font-semibold text-slate-500">
                  {lab}
                  <input
                    type="number"
                    min={-20}
                    max={200}
                    step={1}
                    value={Math.round(curSelected.style?.[k] ?? 0)}
                    onChange={e => updateSelectedStyle({ [k]: Number(e.target.value) || 0 })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs font-mono"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1">
              <button type="button" onClick={() => centerBlock('h')} title="По центру горизонтально" className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"><AlignHorizontalJustifyCenter size={14} /></button>
              <button type="button" onClick={() => centerBlock('v')} title="По центру вертикально" className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"><AlignVerticalJustifyCenter size={14} /></button>
              <button type="button" onClick={bringForward} title="На передний план" className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"><BringToFront size={14} /></button>
              <button type="button" onClick={sendBackward} title="На задний план" className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"><SendToBack size={14} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10.5px] text-slate-500">
                <span className="flex justify-between">
                  <span>Поворот</span>
                  <button type="button" onClick={() => updateSelectedStyle({ rotation: 0 })} className="font-mono text-slate-700 dark:text-slate-300 hover:text-[#b7472a]" title="Сбросить 0°">
                    {curSelected.style?.rotation || 0}°
                  </button>
                </span>
                <input type="range" min={-180} max={180} value={curSelected.style?.rotation || 0} onChange={e => updateSelectedStyle({ rotation: parseInt(e.target.value) })} className="w-full accent-[#b7472a]" />
              </label>
              <label className="text-[10.5px] text-slate-500">
                <span className="flex justify-between">
                  <span>Прозрач.</span>
                  <span className="font-mono">{Math.round((curSelected.style?.opacity ?? 1) * 100)}%</span>
                </span>
                <input type="range" min={10} max={100} value={Math.round((curSelected.style?.opacity ?? 1) * 100)} onChange={e => updateSelectedStyle({ opacity: parseInt(e.target.value) / 100 })} className="w-full accent-[#b7472a]" />
              </label>
            </div>

            <label className="block text-[10.5px] text-slate-500">
              Анимация появления
              <select
                value={curSelected.animation || 'нет'}
                onChange={e => updateSelected({ animation: e.target.value })}
                className="w-full mt-0.5 px-2 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs"
              >
                {ANIMATIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {/* ================= ТЕКСТ ================= */}
        {selectedBlock && curSelected?.type === 'text' && (
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Текст (или двойной клик на слайде)</label>
              <textarea
                value={curSelected.content || ''}
                onChange={e => updateSelected({
                  content: e.target.value,
                  paragraphs: curSelected.paragraphs ? restyleParas(curSelected.paragraphs, e.target.value) : undefined,
                })}
                rows={3}
                className="w-full px-2 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px]">
                Шрифт
                <select value={curSelected.style?.fontFamily || runStyleOf(curSelected).fontFamily || 'Inter'} onChange={e => updateSelectedStyle({ fontFamily: e.target.value })} className="w-full mt-0.5 px-1.5 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs">
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="text-[11px]">
                Размер ({curSelected.style?.fontSize || runStyleOf(curSelected).fontSize || 18}pt)
                <input type="range" min={10} max={96} value={curSelected.style?.fontSize || runStyleOf(curSelected).fontSize || 18} onChange={e => updateSelectedStyle({ fontSize: parseInt(e.target.value) })} className="w-full mt-2 accent-[#b7472a]" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px]">
                Цвет текста
                <input type="color" value={curSelected.style?.color || runStyleOf(curSelected).color || '#1e293b'} onChange={e => updateSelectedStyle({ color: e.target.value })} className="w-full h-8 mt-0.5 rounded-lg border dark:border-slate-600 cursor-pointer" />
              </label>
              <div>
                <div className="flex justify-between text-[11px]">
                  <span>Фон блока</span>
                  {curSelected.style?.background && (
                    <button type="button" onClick={() => updateSelectedStyle({ background: '' })} className="text-[10px] text-red-500 hover:underline">Убрать</button>
                  )}
                </div>
                <input type="color" value={curSelected.style?.background || '#ffffff'} onChange={e => updateSelectedStyle({ background: e.target.value })} className="w-full h-8 mt-0.5 rounded-lg border dark:border-slate-600 cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {(['top', 'middle', 'bottom'] as const).map(va => (
                <button
                  key={va}
                  type="button"
                  onClick={() => updateSelectedStyle({ verticalAlign: va })}
                  className={`py-1 rounded-md border text-[11px] font-semibold ${
                    (curSelected.style?.verticalAlign || 'top') === va
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  {va === 'top' ? 'Верх' : va === 'middle' ? 'Центр' : 'Низ'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px]">
                Интервал ({(curSelected.style?.lineHeight || 1.25).toFixed(2)})
                <input type="range" min={100} max={220} step={5} value={Math.round((curSelected.style?.lineHeight || 1.25) * 100)} onChange={e => updateSelectedStyle({ lineHeight: parseInt(e.target.value) / 100 })} className="w-full accent-[#b7472a]" />
              </label>
              <label className="text-[11px]">
                Скругление ({curSelected.style?.borderRadius || 0}px)
                <input type="range" min={0} max={32} value={curSelected.style?.borderRadius || 0} onChange={e => updateSelectedStyle({ borderRadius: parseInt(e.target.value) })} className="w-full accent-[#b7472a]" />
              </label>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!curSelected.style?.shadow} onChange={e => updateSelectedStyle({ shadow: e.target.checked })} className="w-4 h-4 accent-[#b7472a]" />
              <span>Тень блока</span>
            </label>
          </div>
        )}

        {/* ================= ФИГУРА ================= */}
        {selectedBlock && curSelected?.type === 'shape' && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Экспресс-стили (PowerPoint)</label>
              <div className="grid grid-cols-4 gap-1">
                {SHAPE_QUICK_STYLES.map(qs => (
                  <button
                    key={qs.name}
                    type="button"
                    onClick={() => updateSelectedStyle({ fill: qs.fill, stroke: qs.stroke, strokeWidth: qs.strokeWidth, textColor: qs.textColor, shadow: qs.shadow, dash: qs.dash })}
                    className="h-7 rounded-md text-[10px] font-bold border transition hover:scale-[1.03]"
                    style={{
                      background: qs.fill === 'transparent' ? '#ffffff' : qs.fill,
                      borderColor: qs.stroke,
                      borderStyle: qs.dash as any,
                      color: qs.textColor,
                    }}
                  >
                    {qs.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Тип фигуры</label>
              <div className="grid grid-cols-6 gap-1 max-h-[124px] overflow-y-auto p-1 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">
                {SHAPE_CATALOG.filter(s => s.k !== 'ellipse').map(s => (
                  <button
                    key={s.k}
                    type="button"
                    onClick={() => updateSelected({ shape: s.k, style: { svgPath: undefined } })}
                    title={s.label}
                    className={`p-1 rounded-md flex items-center justify-center border ${
                      curSelected.shape === s.k
                        ? 'border-[#b7472a] bg-orange-50 dark:bg-orange-950/50'
                        : 'border-transparent hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    <ShapeThumb shapeKey={s.k} color={curSelected.style?.fill?.startsWith('#') ? curSelected.style.fill : '#3b82f6'} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-bold text-slate-500">Заливка</span>
                <button
                  type="button"
                  onClick={() => updateSelectedStyle({ fill: curSelected.style?.fill === 'transparent' ? '#3b82f6' : 'transparent' })}
                  className="text-[10px] text-[#b7472a] font-bold hover:underline"
                >
                  {curSelected.style?.fill === 'transparent' ? 'Вернуть цвет' : 'Без заливки'}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={curSelected.style?.fill?.startsWith('#') ? curSelected.style.fill : '#3b82f6'}
                  onChange={e => updateSelectedStyle({ fill: e.target.value })}
                  className="w-10 h-8 rounded border dark:border-slate-600 cursor-pointer shrink-0"
                />
                <div className="flex-1 grid grid-cols-6 gap-1">
                  {SHAPE_GRADIENTS.map(g => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => updateSelectedStyle({ fill: g.css })}
                      title={`Градиент: ${g.name}`}
                      className="h-7 rounded-md border border-white/50 shadow-xs hover:scale-105 transition"
                      style={{ background: g.css }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px]">
                Контур
                <input type="color" value={curSelected.style?.stroke?.startsWith('#') ? curSelected.style.stroke : '#1d4ed8'} onChange={e => updateSelectedStyle({ stroke: e.target.value })} className="w-full h-8 mt-0.5 rounded border dark:border-slate-600 cursor-pointer" />
              </label>
              <label className="text-[11px]">
                Толщина ({curSelected.style?.strokeWidth ?? 2}px)
                <input type="range" min={0} max={10} value={curSelected.style?.strokeWidth ?? 2} onChange={e => updateSelectedStyle({ strokeWidth: parseInt(e.target.value) })} className="w-full mt-2 accent-[#b7472a]" />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {([['solid', 'Сплошная'], ['dashed', 'Пунктир'], ['dotted', 'Точки']] as const).map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => updateSelectedStyle({ dash: d })}
                  className={`py-1 rounded-md border text-[10.5px] font-semibold ${
                    (curSelected.style?.dash || 'solid') === d
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(curSelected.shape === 'rect' || curSelected.shape === 'rounded') && (
              <label className="block text-[11px]">
                Скругление углов ({curSelected.style?.borderRadius ?? (curSelected.shape === 'rounded' ? 14 : 0)}px)
                <input type="range" min={0} max={60} value={curSelected.style?.borderRadius ?? (curSelected.shape === 'rounded' ? 14 : 0)} onChange={e => updateSelectedStyle({ borderRadius: parseInt(e.target.value) })} className="w-full accent-[#b7472a]" />
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!curSelected.style?.shadow} onChange={e => updateSelectedStyle({ shadow: e.target.checked })} className="w-4 h-4 accent-[#b7472a]" />
              <span>Тень фигуры</span>
            </label>

            {curSelected.shape !== 'line' && curSelected.shape !== 'lineArrow' && (
              <div className="pt-2 border-t dark:border-slate-700 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 block">Текст внутри фигуры</label>
                <textarea
                  value={curSelected.content || ''}
                  onChange={e => updateSelected({ content: e.target.value })}
                  rows={2}
                  placeholder="Двойной клик по фигуре или введите сюда…"
                  className="w-full px-2 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={curSelected.style?.textColor || '#ffffff'}
                    onChange={e => updateSelectedStyle({ textColor: e.target.value })}
                    className="w-8 h-8 rounded border dark:border-slate-600 cursor-pointer shrink-0"
                    title="Цвет текста в фигуре"
                  />
                  <input
                    type="number"
                    min={10}
                    max={64}
                    value={curSelected.style?.textSize || 16}
                    onChange={e => updateSelectedStyle({ textSize: Number(e.target.value) || 16 })}
                    className="w-16 px-2 py-1 rounded border dark:bg-slate-800 dark:border-slate-600 text-xs font-mono"
                    title="Размер текста"
                  />
                  <button
                    type="button"
                    onClick={() => updateSelectedStyle({ textBold: curSelected.style?.textBold === false })}
                    className={`px-2.5 h-8 rounded border flex items-center justify-center ${
                      curSelected.style?.textBold !== false ? 'bg-slate-900 dark:bg-indigo-600 text-white border-transparent' : 'dark:border-slate-600'
                    }`}
                  >
                    <Bold size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= ТАБЛИЦА ================= */}
        {selectedBlock && curSelected?.type === 'table' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500">Строки и столбцы</span>
                <span className="font-mono font-bold text-[#b7472a]">
                  {curSelected.table?.rows || 3} × {curSelected.table?.cols || 3}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => onEditTableSize('addRow')} className="py-1.5 px-2 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 font-semibold flex items-center justify-center gap-1"><Plus size={12} /> Строка</button>
                <button type="button" onClick={() => onEditTableSize('delRow')} className="py-1.5 px-2 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 font-semibold flex items-center justify-center gap-1"><Minus size={12} /> Строка</button>
                <button type="button" onClick={() => onEditTableSize('addCol')} className="py-1.5 px-2 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 font-semibold flex items-center justify-center gap-1"><Plus size={12} /> Столбец</button>
                <button type="button" onClick={() => onEditTableSize('delCol')} className="py-1.5 px-2 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 font-semibold flex items-center justify-center gap-1"><Minus size={12} /> Столбец</button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Стиль таблицы</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TABLE_THEMES.map(th => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => onUpdateTableProps({ theme: th.id })}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 ${
                      (curSelected.table?.theme || 'blue') === th.id
                        ? 'border-[#b7472a] ring-1 ring-[#b7472a]'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: th.headerBg }} />
                    <span className="truncate">{th.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={curSelected.table?.headerRow !== false} onChange={e => onUpdateTableProps({ headerRow: e.target.checked })} className="w-4 h-4 accent-[#b7472a]" />
                <span>Выделять первую строку (шапка)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={curSelected.table?.striped !== false} onChange={e => onUpdateTableProps({ striped: e.target.checked })} className="w-4 h-4 accent-[#b7472a]" />
                <span>Чередование строк (зебра)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!curSelected.style?.shadow} onChange={e => updateSelectedStyle({ shadow: e.target.checked })} className="w-4 h-4 accent-[#b7472a]" />
                <span>Тень таблицы</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 items-center">
              <label className="text-[11px]">
                Шрифт ({curSelected.table?.fontSize || 13}px)
                <input type="range" min={10} max={22} value={curSelected.table?.fontSize || 13} onChange={e => onUpdateTableProps({ fontSize: parseInt(e.target.value) })} className="w-full accent-[#b7472a]" />
              </label>
              <div className="flex gap-1 justify-end">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([al, Ic]) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => onUpdateTableProps({ align: al })}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                      (curSelected.table?.align || 'left') === al
                        ? 'bg-[#b7472a] text-white border-[#b7472a]'
                        : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    <Ic size={13} />
                  </button>
                ))}
              </div>
            </div>

            {activeCell && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Ячейка ({activeCell.r + 1}, {activeCell.c + 1})
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateActiveCellStyle({ background: '', color: '', bold: undefined, align: undefined })}
                    className="text-[10px] text-[#b7472a] hover:underline font-semibold"
                  >
                    Сброс
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] flex-1">
                    Фон
                    <input type="color" value={activeCellObj?.style?.background || '#ffffff'} onChange={e => onUpdateActiveCellStyle({ background: e.target.value })} className="w-full h-7 mt-0.5 rounded border cursor-pointer" />
                  </label>
                  <label className="text-[10px] flex-1">
                    Текст
                    <input type="color" value={activeCellObj?.style?.color || '#0f172a'} onChange={e => onUpdateActiveCellStyle({ color: e.target.value })} className="w-full h-7 mt-0.5 rounded border cursor-pointer" />
                  </label>
                  <button
                    type="button"
                    onClick={() => onUpdateActiveCellStyle({ bold: !activeCellObj?.style?.bold })}
                    className={`mt-4 w-8 h-7 rounded border flex items-center justify-center ${
                      activeCellObj?.style?.bold ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-700'
                    }`}
                    title="Жирный текст ячейки"
                  >
                    <Bold size={12} />
                  </button>
                </div>
              </div>
            )}
            <div className="text-[10.5px] text-slate-400">
              Кликайте в ячейку, чтобы печатать. Клавиша <b>Tab</b> — переход к следующей ячейке.
            </div>
          </div>
        )}

        {/* ================= ДИАГРАММА ================= */}
        {selectedBlock && curSelected?.type === 'chart' && chartData && (
          <div className="space-y-3">
            {onOpenChartModal && (
              <button
                type="button"
                onClick={onOpenChartModal}
                className="w-full py-2 px-3 rounded-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                Открыть большой редактор данных
              </button>
            )}
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Тип диаграммы</label>
              <div className="grid grid-cols-3 gap-1">
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => updateSelectedStyle({ chartType: ct.id as ChartKind })}
                    className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-bold ${
                      (curSelected.style?.chartType || 'bar') === ct.id
                        ? 'bg-[#b7472a] text-white border-[#b7472a]'
                        : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Заголовок диаграммы</label>
              <input
                value={chartData.title || ''}
                onChange={e => patchChart({ title: e.target.value })}
                placeholder="Например: Успеваемость класса"
                className="w-full px-2 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Цветовая палитра</label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(CHART_PALETTES).map(([pid, pal]) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => patchChart({ palette: pid, colors: [] })}
                    className={`p-1.5 rounded-lg border text-left ${
                      (chartData.palette || 'corporate') === pid
                        ? 'border-[#b7472a] ring-1 ring-[#b7472a]'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold mb-1">{pal.name}</div>
                    <div className="flex gap-0.5">
                      {pal.colors.slice(0, 5).map((c, i) => (
                        <span key={i} className="h-2 flex-1 rounded-xs" style={{ background: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input type="checkbox" checked={chartData.showValues !== false} onChange={e => patchChart({ showValues: e.target.checked })} className="accent-[#b7472a]" />
                Значения
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input type="checkbox" checked={chartData.showLegend !== false} onChange={e => patchChart({ showLegend: e.target.checked })} className="accent-[#b7472a]" />
                Легенда
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input type="checkbox" checked={chartData.showGrid !== false} onChange={e => patchChart({ showGrid: e.target.checked })} className="accent-[#b7472a]" />
                Сетка
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input type="checkbox" checked={chartData.bg === 'transparent'} onChange={e => patchChart({ bg: e.target.checked ? 'transparent' : '#ffffff' })} className="accent-[#b7472a]" />
                Без фона
              </label>
            </div>

            <div className="pt-2 border-t dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">Данные диаграммы</span>
                <button
                  type="button"
                  onClick={addChartRow}
                  className="px-2 py-0.5 rounded-md bg-[#b7472a] text-white text-[10.5px] font-bold flex items-center gap-1"
                >
                  <Plus size={11} /> Пункт
                </button>
              </div>
              <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                {(chartData.values || []).map((val: number, idx: number) => {
                  const pal = CHART_PALETTES[chartData.palette || 'corporate']?.colors || CHART_PALETTES.corporate.colors
                  const col = chartData.colors?.[idx] || pal[idx % pal.length]
                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="color"
                        value={col}
                        onChange={e => updateChartRow(idx, 'color', e.target.value)}
                        className="w-6 h-7 rounded border dark:border-slate-600 cursor-pointer shrink-0 p-0"
                        title="Цвет элемента"
                      />
                      <input
                        value={chartData.labels?.[idx] ?? ''}
                        onChange={e => updateChartRow(idx, 'label', e.target.value)}
                        placeholder="Подпись"
                        className="flex-1 min-w-0 px-1.5 py-1 rounded border dark:bg-slate-800 dark:border-slate-600 text-[11px]"
                      />
                      <input
                        type="number"
                        value={val}
                        onChange={e => updateChartRow(idx, 'value', e.target.value)}
                        className="w-14 px-1.5 py-1 rounded border dark:bg-slate-800 dark:border-slate-600 text-[11px] font-mono text-right"
                      />
                      <button
                        type="button"
                        onClick={() => removeChartRow(idx)}
                        disabled={(chartData.values?.length || 0) <= 1}
                        className="w-6 h-7 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 flex items-center justify-center shrink-0"
                        title="Удалить пункт"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= КАРТИНКА ================= */}
        {selectedBlock && curSelected?.type === 'image' && (
          <div className="space-y-2.5">
            <label className="block w-full py-2 px-3 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-center font-semibold cursor-pointer">
              Заменить изображение
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) onUploadReplaceImage(f)
                  e.target.value = ''
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {([['contain', 'Вписать'], ['cover', 'Заполнить']] as const).map(([fit, label]) => (
                <button
                  key={fit}
                  type="button"
                  onClick={() => updateSelectedStyle({ objectFit: fit })}
                  className={`py-1.5 rounded-lg border text-[11px] font-bold ${
                    (curSelected.style?.objectFit || 'contain') === fit
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="block text-[11px]">
              Скругление ({curSelected.style?.borderRadius || 0}px)
              <input type="range" min={0} max={50} value={curSelected.style?.borderRadius || 0} onChange={e => updateSelectedStyle({ borderRadius: parseInt(e.target.value) })} className="w-full accent-[#b7472a]" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!curSelected.style?.shadow} onChange={e => updateSelectedStyle({ shadow: e.target.checked })} className="w-4 h-4 accent-[#b7472a]" />
              <span>Тень изображения</span>
            </label>
          </div>
        )}

        {/* ================= ВИДЕО ================= */}
        {selectedBlock && curSelected?.type === 'video' && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 block">Ссылка на видео (YouTube / VK / Rutube)</label>
            <textarea
              value={curSelected.content || ''}
              onChange={e => updateSelected({ content: e.target.value })}
              rows={2}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-2 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs break-all"
            />
            <div className="text-[10.5px] text-slate-400">Поддерживаются обычные ссылки, Shorts, youtu.be, VK и Rutube.</div>
          </div>
        )}

        {/* ================= ЗАМЕТКИ ДОКЛАДЧИКА ================= */}
        <div className="pt-3 border-t dark:border-slate-700">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Заметки к слайду</label>
          <textarea
            value={cur?.notes || ''}
            onChange={e => updateSlide({ notes: e.target.value })}
            placeholder="Подсказки докладчику (видны в слайд-шоу по кнопке «Заметки»)…"
            rows={3}
            className="w-full px-2 py-1.5 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-xs"
          />
        </div>
      </div>

      <div className="p-3 border-t dark:border-slate-700 flex gap-2 shrink-0">
        <button onClick={duplicateBlock} disabled={!selectedBlock} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700">
          <Copy size={13} /> Копия
        </button>
        <button onClick={deleteSelected} disabled={!selectedBlock} className="flex-1 py-2 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40 hover:bg-red-100">
          <Trash2 size={13} /> Удалить
        </button>
      </div>
    </>
  )
}
