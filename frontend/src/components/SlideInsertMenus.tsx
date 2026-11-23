import React, { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import {
  SHAPE_CATALOG, SHAPE_GROUPS, ShapeThumb, TABLE_THEMES, CHART_TYPES, ChartKind,
  createDefaultTable, createDefaultChartData,
} from './SlideVisuals'

/* ==================== 1. Visual Shape Gallery Popover ==================== */
export function ShapePickerPopover({
  onSelect,
  onClose,
}: {
  onSelect: (shapeKey: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-auto top-full mt-1.5 z-50 sm:w-[340px] max-h-[70vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3 space-y-3"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2">
        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Вставить фигуру</span>
        <span className="text-[10px] text-slate-400">Двойной клик по фигуре — текст внутри</span>
      </div>
      {SHAPE_GROUPS.map(g => {
        const items = SHAPE_CATALOG.filter(s => s.cat === g.id && s.k !== 'ellipse')
        return (
          <div key={g.id}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{g.label}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {items.map(s => (
                <button
                  key={s.k}
                  type="button"
                  onClick={() => { onSelect(s.k); onClose() }}
                  title={s.label}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:border-[#b7472a] transition"
                >
                  <ShapeThumb shapeKey={s.k} color="#3b82f6" />
                  <span className="text-[10px] leading-tight text-slate-600 dark:text-slate-300 truncate w-full text-center">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ==================== 2. Interactive Grid Table Picker ==================== */
export function TableSizePickerPopover({
  onSelect,
  onClose,
}: {
  onSelect: (rows: number, cols: number, theme: string) => void
  onClose: () => void
}) {
  const [hover, setHover] = useState({ r: 3, c: 3 })
  const [theme, setTheme] = useState('blue')

  return (
    <div
      className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-auto top-full mt-1.5 z-50 sm:w-[250px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3 space-y-2.5"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Таблица</span>
        <span className="text-xs font-mono font-bold text-[#b7472a]">{hover.r} × {hover.c}</span>
      </div>

      <div className="grid grid-cols-6 gap-1 p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
        {Array.from({ length: 36 }).map((_, idx) => {
          const r = Math.floor(idx / 6) + 1
          const c = (idx % 6) + 1
          const active = r <= hover.r && c <= hover.c
          return (
            <button
              key={idx}
              type="button"
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => { onSelect(r, c, theme); onClose() }}
              className={`h-6 rounded transition border ${
                active
                  ? 'bg-[#b7472a] border-[#9c3a20]'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-[#b7472a]'
              }`}
              title={`Таблица ${r}×${c}`}
            />
          )
        })}
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Стиль таблицы</div>
        <div className="grid grid-cols-3 gap-1">
          {TABLE_THEMES.map(th => (
            <button
              key={th.id}
              type="button"
              onClick={() => setTheme(th.id)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${
                theme === th.id ? 'border-[#b7472a] ring-1 ring-[#b7472a]' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: th.headerBg }} />
              <span className="truncate dark:text-slate-200">{th.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => { onSelect(hover.r, hover.c, theme); onClose() }}
        className="w-full py-1.5 rounded-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white text-xs font-bold"
      >
        Вставить {hover.r} × {hover.c}
      </button>
    </div>
  )
}

/* ==================== 3. Visual Chart Type Picker ==================== */
function ChartMiniSvg({ kind }: { kind: ChartKind }) {
  if (kind === 'hbar') {
    return (
      <svg viewBox="0 0 48 32" className="w-11 h-7">
        <rect x="4" y="4" width="28" height="6" rx="2" fill="#2563eb" />
        <rect x="4" y="13" width="38" height="6" rx="2" fill="#0ea5e9" />
        <rect x="4" y="22" width="20" height="6" rx="2" fill="#10b981" />
      </svg>
    )
  }
  if (kind === 'line') {
    return (
      <svg viewBox="0 0 48 32" className="w-11 h-7">
        <polyline points="4,24 16,14 28,18 44,6" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy="24" r="2.5" fill="#2563eb" />
        <circle cx="16" cy="14" r="2.5" fill="#2563eb" />
        <circle cx="28" cy="18" r="2.5" fill="#2563eb" />
        <circle cx="44" cy="6" r="2.5" fill="#2563eb" />
      </svg>
    )
  }
  if (kind === 'area') {
    return (
      <svg viewBox="0 0 48 32" className="w-11 h-7">
        <path d="M4,28 L4,22 L16,12 L28,17 L44,6 L44,28 Z" fill="#3b82f6" fillOpacity="0.28" />
        <polyline points="4,22 16,12 28,17 44,6" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'pie') {
    return (
      <svg viewBox="0 0 36 36" className="w-8 h-7">
        <circle cx="18" cy="18" r="14" fill="#2563eb" />
        <path d="M18,18 L18,4 A14,14 0 0,1 32,18 Z" fill="#10b981" />
        <path d="M18,18 L32,18 A14,14 0 0,1 22,31.4 Z" fill="#f59e0b" />
      </svg>
    )
  }
  if (kind === 'donut') {
    return (
      <svg viewBox="0 0 36 36" className="w-8 h-7">
        <circle cx="18" cy="18" r="14" fill="#2563eb" />
        <path d="M18,18 L18,4 A14,14 0 0,1 32,18 Z" fill="#10b981" />
        <path d="M18,18 L32,18 A14,14 0 0,1 22,31.4 Z" fill="#f59e0b" />
        <circle cx="18" cy="18" r="7" fill="#ffffff" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 32" className="w-11 h-7">
      <rect x="4" y="14" width="8" height="14" rx="2" fill="#2563eb" />
      <rect x="15" y="6" width="8" height="22" rx="2" fill="#0ea5e9" />
      <rect x="26" y="11" width="8" height="17" rx="2" fill="#10b981" />
      <rect x="37" y="4" width="8" height="24" rx="2" fill="#f59e0b" />
    </svg>
  )
}

export function ChartPickerPopover({
  onSelect,
  onClose,
}: {
  onSelect: (kind: ChartKind) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-auto top-full mt-1.5 z-50 sm:w-[270px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3 space-y-2"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Вставить диаграмму</div>
      <div className="grid grid-cols-3 gap-1.5">
        {CHART_TYPES.map(ct => (
          <button
            key={ct.id}
            type="button"
            onClick={() => { onSelect(ct.id); onClose() }}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:border-[#b7472a] transition"
          >
            <ChartMiniSvg kind={ct.id} />
            <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-200">{ct.label}</span>
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-400">Данные, цвета и заголовок удобно менять справа в «Свойствах»</div>
    </div>
  )
}

/* ==================== 4. Text Preset Picker ==================== */
export const TEXT_PRESETS = [
  { id: 'heading', label: 'Заголовок', desc: 'Крупный жирный 34pt', content: 'Заголовок слайда', style: { fontSize: 34, bold: true, align: 'left', color: '#0f172a', fontFamily: 'Manrope', x: 8, y: 12, w: 84, h: 16 } },
  { id: 'subheading', label: 'Подзаголовок', desc: 'Средний 20pt', content: 'Подзаголовок или тезис', style: { fontSize: 20, bold: false, align: 'left', color: '#475569', fontFamily: 'Inter', x: 8, y: 30, w: 84, h: 12 } },
  { id: 'body', label: 'Обычный текст', desc: 'Абзац 16pt', content: 'Введите текст слайда…', style: { fontSize: 16, align: 'left', color: '#1e293b', fontFamily: 'Inter', x: 10, y: 42, w: 70, h: 20 } },
  { id: 'bullets', label: 'Список тезисов', desc: 'Пункты с маркерами', content: 'Ключевая идея 1\nКлючевая идея 2\nКлючевая идея 3', style: { fontSize: 18, bullet: true, align: 'left', color: '#1e293b', fontFamily: 'Inter', x: 10, y: 32, w: 78, h: 36 } },
  { id: 'card', label: 'Карточка-выноска', desc: 'Блок с фоном и рамкой', content: 'Важный вывод или определение для запоминания', style: { fontSize: 17, bold: true, align: 'left', color: '#1e3a8a', background: '#eff6ff', stroke: '#93c5fd', strokeWidth: 2, borderRadius: 12, fontFamily: 'Inter', x: 12, y: 34, w: 76, h: 24 } },
  { id: 'quote', label: 'Цитата', desc: 'Курсив по центру', content: '«Учение — свет, а неучение — тьма.»', style: { fontSize: 24, italic: true, align: 'center', color: '#334155', fontFamily: 'Georgia', x: 12, y: 34, w: 76, h: 24 } },
]

export function TextPresetPopover({
  onSelect,
  onClose,
}: {
  onSelect: (preset: typeof TEXT_PRESETS[number]) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-auto top-full mt-1.5 z-50 sm:w-[240px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 space-y-1"
      onMouseDown={e => e.stopPropagation()}
    >
      {TEXT_PRESETS.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => { onSelect(p); onClose() }}
          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.label}</div>
          <div className="text-[10px] text-slate-400">{p.desc}</div>
        </button>
      ))}
    </div>
  )
}

/* ==================== 5. Slide Layout Gallery ==================== */
export const SLIDE_LAYOUTS = [
  { id: 'blank', label: 'Пустой' },
  { id: 'title', label: 'Титульный' },
  { id: 'content', label: 'Список' },
  { id: 'two_col', label: '2 колонки' },
  { id: 'image', label: 'Картинка' },
  { id: 'table', label: 'Таблица' },
  { id: 'chart', label: 'Диаграмма' },
  { id: 'quote', label: 'Цитата' },
  { id: 'thanks', label: 'Финал' },
]

export function SlideLayoutPopover({
  onSelect,
  onClose,
}: {
  onSelect: (layout: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed sm:absolute left-2 right-2 sm:left-0 sm:right-auto bottom-full sm:bottom-auto sm:top-full mb-1.5 sm:mt-1.5 z-50 sm:w-[270px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2.5"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 mb-2">Выберите макет нового слайда</div>
      <div className="grid grid-cols-3 gap-1.5">
        {SLIDE_LAYOUTS.map(l => (
          <button
            key={l.id}
            type="button"
            onClick={() => { onSelect(l.id); onClose() }}
            className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#b7472a] hover:bg-orange-50/60 dark:hover:bg-orange-950/30 transition"
          >
            <div className="w-full aspect-video rounded bg-slate-100 dark:bg-slate-800 p-1 flex flex-col justify-center gap-0.5">
              {l.id === 'title' && <><div className="h-1.5 w-3/4 mx-auto bg-slate-400 rounded" /><div className="h-1 w-1/2 mx-auto bg-slate-300 rounded" /></>}
              {l.id === 'content' && <><div className="h-1.5 w-2/3 bg-slate-400 rounded mb-0.5" /><div className="h-1 w-full bg-slate-300 rounded" /><div className="h-1 w-5/6 bg-slate-300 rounded" /></>}
              {l.id === 'two_col' && <><div className="h-1.5 w-2/3 bg-slate-400 rounded mb-0.5" /><div className="grid grid-cols-2 gap-1 flex-1"><div className="bg-slate-300 rounded" /><div className="bg-slate-300 rounded" /></div></>}
              {l.id === 'image' && <><div className="h-1.5 w-1/2 bg-slate-400 rounded mb-0.5" /><div className="flex-1 bg-blue-200 dark:bg-blue-900 rounded" /></>}
              {l.id === 'table' && <div className="grid grid-cols-3 gap-0.5 flex-1"><div className="bg-blue-400 rounded-xs" /><div className="bg-blue-400 rounded-xs" /><div className="bg-blue-400 rounded-xs" /><div className="bg-slate-300 rounded-xs" /><div className="bg-slate-300 rounded-xs" /><div className="bg-slate-300 rounded-xs" /></div>}
              {l.id === 'chart' && <div className="flex items-end gap-0.5 h-full pt-1"><div className="flex-1 h-1/2 bg-blue-400 rounded-t-xs" /><div className="flex-1 h-full bg-emerald-400 rounded-t-xs" /><div className="flex-1 h-2/3 bg-amber-400 rounded-t-xs" /></div>}
              {l.id === 'quote' && <div className="h-1.5 w-4/5 mx-auto bg-slate-400 italic rounded" />}
              {l.id === 'thanks' && <div className="h-2 w-2/3 mx-auto bg-[#b7472a] rounded" />}
            </div>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ==================== 6. Ready-Made Presentation Templates Modal ==================== */
export interface DeckTemplate {
  id: string
  name: string
  subtitle: string
  slideCount: number
  previewBg: string
  accent: string
  buildSlides: () => any[]
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: 'lesson',
    name: 'Школьный урок',
    subtitle: 'Титул, цели урока, сравнительная таблица, итоги на графике и финал',
    slideCount: 5,
    previewBg: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 60%, #0ea5e9 100%)',
    accent: '#38bdf8',
    buildSlides: () => [
      {
        order: 0, background: '#1e3a8a', backgroundType: 'gradient',
        gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 60%, #0ea5e9 100%)',
        layout: 'title', transition: 'fade',
        content: {
          blocks: [
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: 'ОТКРЫТЫЙ УРОК', style: { fill: '#facc15', stroke: 'none', strokeWidth: 0, textColor: '#0f172a', textSize: 13, textBold: true, x: 38, y: 14, w: 24, h: 8, z: 1, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Тема урока: Введение в предмет', style: { fontSize: 38, bold: true, align: 'center', color: '#ffffff', fontFamily: 'Manrope', x: 6, y: 28, w: 88, h: 20, z: 2, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Класс · Учитель · Учебный год', style: { fontSize: 18, align: 'center', color: '#e0f2fe', fontFamily: 'Inter', x: 14, y: 54, w: 72, h: 12, z: 3, unit: '%' } },
          ],
        },
      },
      {
        order: 1, background: '#ffffff', backgroundType: 'solid', layout: 'content', transition: 'slide',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Цели и план урока', style: { fontSize: 30, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 7, w: 88, h: 12, z: 1, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: '1. Изучить\nключевые понятия', style: { fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, textColor: '#1e3a8a', textSize: 17, textBold: true, shadow: true, x: 6, y: 26, w: 27, h: 52, z: 2, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: '2. Разобрать\nпрактические примеры', style: { fill: '#ecfdf5', stroke: '#059669', strokeWidth: 2, textColor: '#065f46', textSize: 17, textBold: true, shadow: true, x: 36.5, y: 26, w: 27, h: 52, z: 3, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: '3. Закрепить\nна заданиях', style: { fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 2, textColor: '#9a3412', textSize: 17, textBold: true, shadow: true, x: 67, y: 26, w: 27, h: 52, z: 4, unit: '%' } },
          ],
        },
      },
      {
        order: 2, background: '#ffffff', backgroundType: 'solid', layout: 'table', transition: 'slide',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Сравнительная таблица', style: { fontSize: 26, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 6, w: 88, h: 11, z: 1, unit: '%' } },
            {
              id: uid('tb'), type: 'table',
              table: {
                ...createDefaultTable(4, 3),
                theme: 'blue',
                cells: [
                  [{ text: 'Критерий', style: {} }, { text: 'Вариант А', style: {} }, { text: 'Вариант Б', style: {} }],
                  [{ text: 'Особенности', style: {} }, { text: 'Быстрый старт', style: {} }, { text: 'Глубокий анализ', style: {} }],
                  [{ text: 'Применение', style: {} }, { text: 'Базовый уровень', style: {} }, { text: 'Профильный уровень', style: {} }],
                  [{ text: 'Результат', style: {} }, { text: 'Усвоение основ', style: {} }, { text: 'Проектная работа', style: {} }],
                ],
              },
              style: { x: 6, y: 21, w: 88, h: 64, z: 2, shadow: true, unit: '%' },
            },
          ],
        },
      },
      {
        order: 3, background: '#ffffff', backgroundType: 'solid', layout: 'chart', transition: 'fade',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Динамика успеваемости', style: { fontSize: 26, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 6, w: 88, h: 11, z: 1, unit: '%' } },
            {
              id: uid('ch'), type: 'chart',
              style: { chartType: 'bar', x: 8, y: 20, w: 84, h: 68, z: 2, shadow: true, unit: '%' },
              chartData: createDefaultChartData('Средний балл по четвертям'),
            },
          ],
        },
      },
      {
        order: 4, background: '#0f172a', backgroundType: 'gradient',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
        layout: 'thanks', transition: 'zoom',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Спасибо за внимание!', style: { fontSize: 44, bold: true, align: 'center', color: '#ffffff', fontFamily: 'Manrope', x: 8, y: 32, w: 84, h: 20, z: 1, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Вопросы, задания и домашняя работа', style: { fontSize: 20, align: 'center', color: '#cbd5e1', fontFamily: 'Inter', x: 16, y: 55, w: 68, h: 12, z: 2, unit: '%' } },
          ],
        },
      },
    ],
  },
  {
    id: 'project',
    name: 'Проект / Защита',
    subtitle: 'Тёмная современная тема, актуальность, статистика, таблица и выводы',
    slideCount: 4,
    previewBg: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
    accent: '#818cf8',
    buildSlides: () => [
      {
        order: 0, background: '#0f172a', backgroundType: 'gradient',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
        layout: 'title', transition: 'fade',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Название исследовательского проекта', style: { fontSize: 38, bold: true, align: 'center', color: '#f8fafc', fontFamily: 'Manrope', x: 7, y: 26, w: 86, h: 22, z: 1, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Выполнил(а): Имя Фамилия · Руководитель проекта', style: { fontSize: 18, align: 'center', color: '#94a3b8', fontFamily: 'Inter', x: 12, y: 54, w: 76, h: 12, z: 2, unit: '%' } },
          ],
        },
      },
      {
        order: 1, background: '#f8fafc', backgroundType: 'solid', layout: 'two_col', transition: 'slide',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Проблема и цель исследования', style: { fontSize: 28, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 7, w: 88, h: 12, z: 1, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Актуальность\n• Почему эта тема важна сегодня\n• Какие сложности существуют\n• Кому поможет решение', style: { fontSize: 17, color: '#1e293b', background: '#ffffff', stroke: '#cbd5e1', strokeWidth: 1, borderRadius: 12, shadow: true, x: 6, y: 24, w: 42, h: 60, z: 2, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Задачи проекта\n• Собрать и изучить данные\n• Провести эксперимент\n• Сформулировать выводы', style: { fontSize: 17, color: '#1e293b', background: '#eef2ff', stroke: '#a5b4fc', strokeWidth: 1, borderRadius: 12, shadow: true, x: 52, y: 24, w: 42, h: 60, z: 3, unit: '%' } },
          ],
        },
      },
      {
        order: 2, background: '#ffffff', backgroundType: 'solid', layout: 'chart', transition: 'slide',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Результаты опроса и измерений', style: { fontSize: 26, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 6, w: 88, h: 11, z: 1, unit: '%' } },
            {
              id: uid('ch'), type: 'chart',
              style: { chartType: 'donut', x: 10, y: 20, w: 80, h: 68, z: 2, shadow: true, unit: '%' },
              chartData: { ...createDefaultChartData('Распределение ответов (%)'), labels: ['Отлично', 'Хорошо', 'Удовл.', 'Сложно'], values: [48, 32, 14, 6], palette: 'vibrant' },
            },
          ],
        },
      },
      {
        order: 3, background: '#0f172a', backgroundType: 'gradient',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
        layout: 'thanks', transition: 'fade',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Главные выводы', style: { fontSize: 32, bold: true, color: '#f8fafc', fontFamily: 'Manrope', x: 8, y: 12, w: 84, h: 14, z: 1, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Гипотеза подтверждена результатами наблюдений\nПредложенное решение повышает эффективность на 35%\nГотов(а) ответить на ваши вопросы!', style: { fontSize: 20, bullet: true, color: '#e2e8f0', fontFamily: 'Inter', x: 10, y: 32, w: 80, h: 48, z: 2, unit: '%' } },
          ],
        },
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Аналитика и цифры',
    subtitle: 'Изумрудная тема, карточки KPI, подробная таблица и линейный тренд',
    slideCount: 4,
    previewBg: 'linear-gradient(135deg, #022c22 0%, #065f46 60%, #0d9488 100%)',
    accent: '#34d399',
    buildSlides: () => [
      {
        order: 0, background: '#064e3b', backgroundType: 'gradient',
        gradient: 'linear-gradient(135deg, #022c22 0%, #065f46 60%, #0d9488 100%)',
        layout: 'title', transition: 'fade',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Аналитический отчёт', style: { fontSize: 42, bold: true, align: 'center', color: '#ffffff', fontFamily: 'Manrope', x: 8, y: 28, w: 84, h: 18, z: 1, unit: '%' } },
            { id: uid('t'), type: 'text', content: 'Ключевые показатели · Сравнение · Динамика', style: { fontSize: 18, align: 'center', color: '#d1fae5', fontFamily: 'Inter', x: 14, y: 52, w: 72, h: 12, z: 2, unit: '%' } },
          ],
        },
      },
      {
        order: 1, background: '#ffffff', backgroundType: 'solid', layout: 'content', transition: 'slide',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Ключевые метрики', style: { fontSize: 28, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 7, w: 88, h: 12, z: 1, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: '94%\nВыполнение плана', style: { fill: '#059669', stroke: 'none', strokeWidth: 0, textColor: '#ffffff', textSize: 22, textBold: true, shadow: true, x: 6, y: 26, w: 27, h: 36, z: 2, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: '+28%\nРост за период', style: { fill: '#0284c7', stroke: 'none', strokeWidth: 0, textColor: '#ffffff', textSize: 22, textBold: true, shadow: true, x: 36.5, y: 26, w: 27, h: 36, z: 3, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'roundRect', content: '124\nАктивных участника', style: { fill: '#4f46e5', stroke: 'none', strokeWidth: 0, textColor: '#ffffff', textSize: 22, textBold: true, shadow: true, x: 67, y: 26, w: 27, h: 36, z: 4, unit: '%' } },
            { id: uid('sh'), type: 'shape', shape: 'callout', content: 'Все целевые показатели превысили прогноз на 12%', style: { fill: '#fef3c7', stroke: '#d97706', strokeWidth: 2, textColor: '#92400e', textSize: 15, textBold: true, x: 18, y: 69, w: 64, h: 20, z: 5, unit: '%' } },
          ],
        },
      },
      {
        order: 2, background: '#ffffff', backgroundType: 'solid', layout: 'table', transition: 'slide',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Сводная таблица показателей', style: { fontSize: 26, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 6, w: 88, h: 11, z: 1, unit: '%' } },
            { id: uid('tb'), type: 'table', table: { ...createDefaultTable(4, 4), theme: 'emerald' }, style: { x: 6, y: 21, w: 88, h: 64, z: 2, shadow: true, unit: '%' } },
          ],
        },
      },
      {
        order: 3, background: '#ffffff', backgroundType: 'solid', layout: 'chart', transition: 'fade',
        content: {
          blocks: [
            { id: uid('t'), type: 'text', content: 'Тренд роста по месяцам', style: { fontSize: 26, bold: true, color: '#0f172a', fontFamily: 'Manrope', x: 6, y: 6, w: 88, h: 11, z: 1, unit: '%' } },
            {
              id: uid('ch'), type: 'chart',
              style: { chartType: 'area', x: 8, y: 20, w: 84, h: 68, z: 2, shadow: true, unit: '%' },
              chartData: { ...createDefaultChartData('Рост показателей'), labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [30, 42, 38, 61, 74, 92], palette: 'emerald' },
            },
          ],
        },
      },
    ],
  },
]

export function PresentationTemplatesModal({
  onApply,
  onClose,
}: {
  onApply: (slides: any[], mode: 'replace' | 'append', title: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Sparkles size={17} className="text-[#b7472a]" /> Готовые шаблоны презентаций
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center dark:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
          {DECK_TEMPLATES.map(tpl => (
            <div key={tpl.id} className="rounded-xl border dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800/70 flex flex-col shadow-xs hover:shadow-md transition">
              <div className="aspect-video p-3.5 flex flex-col justify-between text-white relative" style={{ background: tpl.previewBg }}>
                <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/25 backdrop-blur-xs">
                  {tpl.slideCount} слайдов
                </span>
                <div>
                  <div className="font-extrabold text-sm leading-tight">{tpl.name}</div>
                  <div className="h-1 w-10 rounded-full mt-1.5" style={{ background: tpl.accent }} />
                </div>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex-1">{tpl.subtitle}</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => { onApply(tpl.buildSlides(), 'replace', tpl.name); onClose() }}
                    className="w-full py-1.5 rounded-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white text-xs font-bold"
                  >
                    Применить шаблон
                  </button>
                  <button
                    type="button"
                    onClick={() => { onApply(tpl.buildSlides(), 'append', tpl.name); onClose() }}
                    className="w-full py-1.5 rounded-lg border dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold"
                  >
                    + Добавить в конец
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
