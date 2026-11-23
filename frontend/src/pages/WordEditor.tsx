import { useEffect, useRef, useState, type ReactNode } from 'react'
import client from '../api/client'
import { useAccessibility, toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { sanitizeWordHtml as sanitize } from '../utils/sanitize'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link2, ImagePlus, Table as TableIcon, Eraser, Save,
  Upload, Download, Printer, Plus, Trash2, FileText,
  Undo2, Redo2, X, Maximize2, Minimize2, Scissors, Move,
  IndentIncrease, IndentDecrease, ChevronDown,
  Search, FolderOpen, ZoomIn, ZoomOut, ListTree, Minus, Calendar, Sparkles, Quote,
  Square, Columns2, Droplets, CheckSquare, ArrowUpDown, Grid, Palette,
} from 'lucide-react'

const SPECIAL_SYMBOLS = ['±', '×', '÷', '≤', '≥', '≠', '≈', '∞', '√', 'π', '°', '©', '№', '—', '«', '»', '→', '∑', 'α', 'β']

const MATH_FORMULAS = [
  'a² + b² = c²',
  'ax² + bx + c = 0',
  'D = b² − 4ac',
  'x = (−b ± √D) / 2a',
  'S = π · r²',
  'E = m · c²',
  'F = m · a',
  'H₂O + CO₂ → H₂CO₃',
]

type PageBorderKind = 'none' | 'solid' | 'double' | 'shadow' | 'dashed' | 'gold'

const PAGE_BORDER_PRESETS: Array<{ id: PageBorderKind; label: string; desc: string }> = [
  { id: 'none', label: 'Без рамки', desc: 'Чистый лист' },
  { id: 'solid', label: '▢ Обычная', desc: 'Чёткая сплошная линия' },
  { id: 'double', label: '▣ Двойная (ГОСТ)', desc: 'Для рефератов и титульных' },
  { id: 'shadow', label: '❏ С тенью', desc: 'Объёмная рамка' },
  { id: 'dashed', label: '⬚ Пунктир', desc: 'Декоративный штрих' },
  { id: 'gold', label: '🏆 Грамота', desc: 'Золотая торжественная' },
]

const BORDER_COLORS = ['#1e293b', '#2b579a', '#b45309', '#9f1239', '#047857', '#6d28d9']

const TABLE_THEMES = [
  { id: 'classic', label: 'Классика', border: '#94a3b8', headBg: '#f1f5f9', headFg: '#0f172a', zebra: '#f8fafc' },
  { id: 'blue', label: 'Синий Word', border: '#93c5fd', headBg: '#2b579a', headFg: '#ffffff', zebra: '#eff6ff' },
  { id: 'emerald', label: 'Изумруд', border: '#6ee7b7', headBg: '#047857', headFg: '#ffffff', zebra: '#ecfdf5' },
  { id: 'amber', label: 'Янтарь', border: '#fcd34d', headBg: '#b45309', headFg: '#ffffff', zebra: '#fffbeb' },
  { id: 'dark', label: 'Графит', border: '#64748b', headBg: '#1e293b', headFg: '#ffffff', zebra: '#f1f5f9' },
]

const TEXT_FRAME_PRESETS: Array<{ id: string; label: string; html: string }> = [
  {
    id: 'simple',
    label: '⬜ Обычная рамка',
    html: '<div class="word-frame" data-frame="simple" style="border:2px solid #334155;background-color:#ffffff;border-radius:6px;padding:12px 16px;margin:10px 0"><p><b>Текст в рамке:</b> напишите важный абзац здесь…</p></div><p><br></p>',
  },
  {
    id: 'double',
    label: '▣ Двойная (ГОСТ)',
    html: '<div class="word-frame" data-frame="double" style="border:4px double #2b579a;background-color:#f8fafc;border-radius:4px;padding:12px 16px;margin:10px 0"><p><b>Официальная рамка:</b> ключевое определение или формулировка…</p></div><p><br></p>',
  },
  {
    id: 'note',
    label: '💡 Синяя заметка',
    html: '<div class="word-frame" data-frame="note" style="border:1px solid #93c5fd;border-left:5px solid #2b579a;background-color:#eff6ff;border-radius:8px;padding:12px 16px;margin:10px 0"><p><b>💡 Заметка:</b> напишите важное правило или пояснение…</p></div><p><br></p>',
  },
  {
    id: 'warn',
    label: '⚠️ Важно! (Жёлтая)',
    html: '<div class="word-frame" data-frame="warn" style="border:1px solid #fcd34d;border-left:5px solid #d97706;background-color:#fffbeb;border-radius:8px;padding:12px 16px;margin:10px 0"><p><b>⚠️ Внимание!</b> Обратите особое внимание на этот пункт…</p></div><p><br></p>',
  },
  {
    id: 'tip',
    label: '✅ Совет / Правило',
    html: '<div class="word-frame" data-frame="tip" style="border:1px solid #6ee7b7;border-left:5px solid #059669;background-color:#ecfdf5;border-radius:8px;padding:12px 16px;margin:10px 0"><p><b>✅ Запомни:</b> полезный вывод или алгоритм решения…</p></div><p><br></p>',
  },
  {
    id: 'gold',
    label: '🏆 Почётная рамка',
    html: '<div class="word-frame" data-frame="gold" style="border:4px double #b45309;background-color:#fffdf5;border-radius:10px;padding:16px 20px;margin:12px 0;text-align:center"><p><b>🏆 ПОЗДРАВЛЯЕМ!</b><br>Текст награждения или важного объявления</p></div><p><br></p>',
  },
  {
    id: 'banner',
    label: '🏷️ Баннер-заголовок',
    html: '<div class="word-frame" data-frame="banner" style="border:2px solid #1e3a8a;background-color:#2b579a;color:#ffffff;border-radius:10px;padding:12px 18px;margin:10px 0;text-align:center"><p style="margin:0;color:#ffffff"><b>ЗАГОЛОВОК РАЗДЕЛА</b></p></div><p><br></p>',
  },
  {
    id: 'dashed',
    label: '✂️ Карточка-пунктир',
    html: '<div class="word-frame" data-frame="dashed" style="border:2px dashed #64748b;background-color:#f8fafc;border-radius:8px;padding:12px 16px;margin:10px 0"><p><b>✂️ Карточка задания:</b> вариант №1…</p></div><p><br></p>',
  },
]

const WORD_TEMPLATES: Array<{
  id: string
  label: string
  title: string
  html: string
  layout?: { orientation?: 'portrait' | 'landscape'; pageBorder?: PageBorderKind; pageBorderColor?: string; paperTint?: 'white' | 'cream' | 'sepia' }
}> = [
  {
    id: 'referat',
    label: '📄 Реферат',
    title: 'Реферат по предмету',
    layout: { orientation: 'portrait', pageBorder: 'double', pageBorderColor: '#1e293b', paperTint: 'white' },
    html: `<p style="text-align:center"><b>МИНИСТЕРСТВО ОБРАЗОВАНИЯ И НАУКИ КЫРГЫЗСКОЙ РЕСПУБЛИКИ</b></p><p style="text-align:center">Школа / Учебное заведение</p><p><br></p><h1 style="text-align:center">РЕФЕРАТ</h1><p style="text-align:center">на тему: <b>«Название темы»</b></p><p><br></p><p style="text-align:right">Выполнил(а): ученик(ца) ___ класса<br>ФИО: ______________________<br>Проверил(а): ______________________</p><p><br></p><h2>1. Введение</h2><p>Актуальность выбранной темы, цели и задачи работы...</p><h2>2. Основная часть</h2><p>Главные теоретические положения, примеры и анализ...</p><h2>3. Заключение</h2><p>Основные выводы по итогам исследования...</p><h2>4. Список литературы</h2><ol><li>Учебник, автор, год издания.</li></ol>`,
  },
  {
    id: 'diploma',
    label: '🏆 Грамота',
    title: 'Почётная грамота',
    layout: { orientation: 'landscape', pageBorder: 'gold', pageBorderColor: '#b45309', paperTint: 'cream' },
    html: `<p style="text-align:center;color:#92400e"><b>МИНИСТЕРСТВО ОБРАЗОВАНИЯ И НАУКИ · ШКОЛА № ___</b></p><h1 style="text-align:center;color:#b45309;font-size:36pt">ПОЧЁТНАЯ ГРАМОТА</h1><p style="text-align:center;font-size:14pt">награждается</p><h2 style="text-align:center;color:#1e3a8a;font-size:22pt">Фамилия Имя Отчество</h2><p style="text-align:center;font-size:13pt">ученик(ца) ___ класса за отличные успехи в учёбе,<br>активное участие в жизни школы и победу в олимпиаде!</p><p><br></p><p style="text-align:center"><b>Директор:</b> ___________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Дата:</b> ${new Date().toLocaleDateString()}</p>`,
  },
  {
    id: 'lesson_plan',
    label: '📚 Конспект',
    title: 'План-конспект урока',
    html: `<h1>План-конспект урока</h1><p><b>Предмет:</b> _____________ &nbsp;|&nbsp; <b>Класс:</b> _____ &nbsp;|&nbsp; <b>Дата:</b> ${new Date().toLocaleDateString()}</p><p><b>Тема урока:</b> ___________________________</p><h2>Цели урока</h2><ul><li><b>Образовательная:</b> изучить ключевые понятия темы...</li><li><b>Развивающая:</b> развить логическое и алгоритмическое мышление...</li><li><b>Воспитательная:</b> сформировать интерес к предмету...</li></ul><h2>Ход урока</h2><table data-fixed="1" style="border-collapse:collapse;table-layout:fixed;width:100%"><tr><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Этап урока</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Время</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Деятельность учителя и учеников</th></tr><tr><td style="border:1px solid #93c5fd;padding:6px">1. Организационный момент</td><td style="border:1px solid #93c5fd;padding:6px">3 мин</td><td style="border:1px solid #93c5fd;padding:6px">Приветствие, проверка готовности</td></tr><tr><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">2. Объяснение нового материала</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">20 мин</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">Теория + разбор примеров на доске</td></tr><tr><td style="border:1px solid #93c5fd;padding:6px">3. Закрепление и практика</td><td style="border:1px solid #93c5fd;padding:6px">17 мин</td><td style="border:1px solid #93c5fd;padding:6px">Практическое задание / мини-квиз</td></tr><tr><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">4. Домашнее задание и итоги</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">5 мин</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">Рефлексия, выставление оценок</td></tr></table>`,
  },
  {
    id: 'schedule',
    label: '📋 Расписание',
    title: 'Расписание уроков',
    html: `<h1 style="text-align:center">Расписание уроков — ____ класс</h1><table data-fixed="1" style="border-collapse:collapse;table-layout:fixed;width:100%"><tr><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">№</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Понедельник</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Вторник</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Среда</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Четверг</th><th style="border:1px solid #93c5fd;padding:7px;background-color:#2b579a;color:#ffffff">Пятница</th></tr><tr><td style="border:1px solid #93c5fd;padding:6px;text-align:center"><b>1</b></td><td style="border:1px solid #93c5fd;padding:6px">Математика</td><td style="border:1px solid #93c5fd;padding:6px">Кыргыз тили</td><td style="border:1px solid #93c5fd;padding:6px">Информатика</td><td style="border:1px solid #93c5fd;padding:6px">Физика</td><td style="border:1px solid #93c5fd;padding:6px">Алгебра</td></tr><tr><td style="border:1px solid #93c5fd;padding:6px;text-align:center;background-color:#eff6ff"><b>2</b></td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">Русский язык</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">История</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">Английский</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">Геометрия</td><td style="border:1px solid #93c5fd;padding:6px;background-color:#eff6ff">Биология</td></tr><tr><td style="border:1px solid #93c5fd;padding:6px;text-align:center"><b>3</b></td><td style="border:1px solid #93c5fd;padding:6px">Химия</td><td style="border:1px solid #93c5fd;padding:6px">География</td><td style="border:1px solid #93c5fd;padding:6px">Литература</td><td style="border:1px solid #93c5fd;padding:6px">Информатика</td><td style="border:1px solid #93c5fd;padding:6px">Физкультура</td></tr></table>`,
  },
  {
    id: 'lab',
    label: '🧪 Лаб. работа',
    title: 'Лабораторная работа №1',
    html: `<h1 style="text-align:center">ЛАБОРАТОРНАЯ РАБОТА № ___</h1><p><b>Тема:</b> ___________________________</p><p><b>ФИО ученика:</b> ___________________ &nbsp; <b>Класс/Группа:</b> _______</p><h2>Цель работы</h2><p>Освоить практические навыки и проверить закономерность на опыте.</p><h2>Оборудование и материалы</h2><ul><li>Прибор / компьютер / тетрадь</li></ul><h2>Ход работы и таблица измерений</h2><table data-fixed="1" style="border-collapse:collapse;table-layout:fixed;width:100%"><tr><th style="border:1px solid #94a3b8;padding:6px;background-color:#f1f5f9">№ опыта</th><th style="border:1px solid #94a3b8;padding:6px;background-color:#f1f5f9">Параметр A</th><th style="border:1px solid #94a3b8;padding:6px;background-color:#f1f5f9">Параметр B</th><th style="border:1px solid #94a3b8;padding:6px;background-color:#f1f5f9">Результат</th></tr><tr><td style="border:1px solid #94a3b8;padding:6px">1</td><td style="border:1px solid #94a3b8;padding:6px"></td><td style="border:1px solid #94a3b8;padding:6px"></td><td style="border:1px solid #94a3b8;padding:6px"></td></tr><tr><td style="border:1px solid #94a3b8;padding:6px">2</td><td style="border:1px solid #94a3b8;padding:6px"></td><td style="border:1px solid #94a3b8;padding:6px"></td><td style="border:1px solid #94a3b8;padding:6px"></td></tr></table><h2>Вывод</h2><p>В ходе лабораторной работы мы установили, что...</p>`,
  },
  {
    id: 'statement',
    label: '✍️ Заявление',
    title: 'Заявление',
    html: `<p style="text-align:right">Директору школы ___________________<br>от _________________________________<br>телефон: ___________________________</p><p><br></p><h2 style="text-align:center">ЗАЯВЛЕНИЕ</h2><p>Прошу Вас ________________________________________________________________________________.</p><p><br></p><p>Дата: ${new Date().toLocaleDateString()} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Подпись: ______________</p>`,
  },
]

type Doc = {
  id: number | string
  title: string
  body_html: string
  source_name?: string
  _local?: boolean
}

const LS_KEY = 'edu-word-docs-v1'
const LS_DRAFT = 'edu-word-draft'
const LS_PAGE = 'edu-word-page'
const MAX_IMPORT = 20 * 1024 * 1024 // 20МБ — лимит как на бэке

// Размеры листа (96dpi, чуть ужаты под экран). pageH — высота контента одной страницы.
const PAGE_SIZES: Record<string, { label: string; maxW: number; pageH: number }> = {
  A5: { label: 'А5 (148×210)', maxW: 520, pageH: 620 },
  A4: { label: 'А4 (210×297)', maxW: 750, pageH: 950 },
  A3: { label: 'А3 (297×420)', maxW: 1050, pageH: 1370 },
}
// Набор шрифтов — как в Word (только то, что есть у всех)
const FONT_FAMILIES = ['Times New Roman', 'Arial', 'Calibri', 'Georgia', 'Verdana', 'Courier New', 'Comic Sans MS']
// Кегли — как список размеров в Word
const FONT_SIZES: Array<{ pt: string; label: string }> = [
  { pt: '8', label: '8' }, { pt: '9', label: '9' }, { pt: '10', label: '10' },
  { pt: '11', label: '11' }, { pt: '12', label: '12' }, { pt: '14', label: '14' },
  { pt: '16', label: '16' }, { pt: '18', label: '18' }, { pt: '20', label: '20' },
  { pt: '24', label: '24' }, { pt: '28', label: '28' }, { pt: '36', label: '36' },
  { pt: '48', label: '48' }, { pt: '72', label: '72' },
]
const SHEET_PAD = 40 // отступ листа, совпадает с p-10
const SHEET_VIEW_OFFSET = 90 // лист останавливается ниже шапки, а не вплотную к краю экрана
const CELL_STYLE = 'border:1px solid #94a3b8;padding:6px;min-width:24px;word-break:break-word;'

/** Группа инструментов ленты: кнопки сверху, подпись снизу — как в Word. */
function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-1 px-2 py-0.5 min-w-0 shrink-0" role="group" aria-label={label || undefined}>
      <div className="flex flex-nowrap items-center justify-start gap-1 shrink-0">{children}</div>
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 text-center leading-[14px] select-none whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  )
}

/** Вертикальный разделитель между группами ленты. */
function RibbonSep() {
  return <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" aria-hidden="true" />
}


function loadLocal(): Doc[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

const hasDocumentContent = (body: string) =>
  body.replace(/<[^>]+>/g, '').replace(/ /g, ' ').trim().length > 0 || /<img\b[^>]*\bsrc=/i.test(body)

export default function WordEditor() {
  const { poor } = useAccessibility()
  const { t, lang } = useLang()
  const WUI = {
    ru: { newBtn: 'Новый', imp: 'Импорт', dl: 'Скачать', home: 'Главная', insert: 'Вставка', img: 'Картинка', tbl: 'Таблица', page: 'Стр.' },
    en: { newBtn: 'New', imp: 'Import', dl: 'Download', home: 'Home', insert: 'Insert', img: 'Picture', tbl: 'Table', page: 'Page' },
    kg: { newBtn: 'Жаңы', imp: 'Импорт', dl: 'Жүктөө', home: 'Башкы', insert: 'Киргизүү', img: 'Сүрөт', tbl: 'Таблица', page: 'Бет' },
  }[lang] || { newBtn: 'Новый', imp: 'Импорт', dl: 'Скачать', home: 'Главная', insert: 'Вставка', img: 'Картинка', tbl: 'Таблица', page: 'Стр.' }
  const editRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetScrollRef = useRef<HTMLDivElement>(null)
  const selImgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize', startX: number, startY: number, origW: number, origL: number, origT: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const savedRange = useRef<Range | null>(null)
  const lastStash = useRef(0)
  const autoStash = () => {
    const now = Date.now()
    if (now - lastStash.current < 5000) return
    lastStash.current = now
    stashDraft()
  }
  const [docs, setDocs] = useState<Doc[]>([])
  const [docsOpen, setDocsOpen] = useState(false)
  const [currentId, setCurrentId] = useState<number | string | null>(null)
  const [title, setTitle] = useState('Новый документ')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [words, setWords] = useState(0)
  const [chars, setChars] = useState(0)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [selImg, setSelImg] = useState<HTMLImageElement | null>(null)
  const [imgW, setImgW] = useState(100)
  const [handle, setHandle] = useState<{ x: number, y: number } | null>(null)
  const [inTable, setInTable] = useState(false)
  const lastTable = useRef<HTMLTableElement | null>(null)
  const tblOverlayRef = useRef<HTMLDivElement>(null)
  const tblDragRef = useRef<{ t: HTMLTableElement } | null>(null)
  const [showTblPicker, setShowTblPicker] = useState(false)
  const [tblRows, setTblRows] = useState(3)
  const [tblCols, setTblCols] = useState(3)
  const [pageSize, setPageSize] = useState(() => {
    const v = localStorage.getItem(LS_PAGE)
    return v && PAGE_SIZES[v] ? v : 'A4'
  })
  const [full, setFull] = useState(false)
  // Актуальные данные для Ctrl+S и аварийного черновика при уходе со страницы.
  // Ref не даёт обработчикам beforeunload/cleanup захватить устаревшие title/pageSize.
  const latestRef = useRef({ title, pageSize, dirty })
  latestRef.current = { title, pageSize, dirty }
  const saveRef = useRef<() => void>(() => { })
  // пагинация: реальные границы листов — стыки между абзацами (top — y внутри листа-контейнера, slot — величина естественного зазора)
  const [layout, setLayout] = useState<{ tops: Array<{ top: number; slot: number }>; bottom: number }>({
    tops: [{ top: 0, slot: 12 }],
    bottom: 1100,
  })
  const pages = layout.tops.length
  const [curPage, setCurPage] = useState(1)
  const [hasDraft, setHasDraft] = useState(() => {
    try { return !!localStorage.getItem(LS_DRAFT) } catch { return false }
  })
  // ── Лента как в Word: табы Главная/Вставка/Макет/Вид + контекстные Картинка/Таблица ──
  const [tab, setTab] = useState<'home' | 'insert' | 'layout' | 'view' | 'img' | 'tbl'>('home')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [marginMode, setMarginMode] = useState<'narrow' | 'normal' | 'wide'>('normal')
  const [paperTint, setPaperTint] = useState<'white' | 'cream' | 'sepia'>('white')
  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [showPageNums, setShowPageNums] = useState(true)
  const [pageBorder, setPageBorder] = useState<PageBorderKind>('none')
  const [pageBorderColor, setPageBorderColor] = useState('#2b579a')
  const [pageBorderWidth, setPageBorderWidth] = useState(2)
  const [watermark, setWatermark] = useState('')
  const [columns, setColumns] = useState<1 | 2>(1)
  const [wordZoom, setWordZoom] = useState(100)
  const [showRuler, setShowRuler] = useState(true)
  const [showOutline, setShowOutline] = useState(false)
  const [outlineItems, setOutlineItems] = useState<Array<{ tag: string; text: string; idx: number }>>([])
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [showSymbols, setShowSymbols] = useState(false)
  const [showFramePicker, setShowFramePicker] = useState(false)
  const [showFormulas, setShowFormulas] = useState(false)
  const [showPageBorders, setShowPageBorders] = useState(false)
  const [showWatermark, setShowWatermark] = useState(false)
  const [showTblBorders, setShowTblBorders] = useState(false)
  const [tblBorderColor, setTblBorderColor] = useState('#64748b')
  const [tblBorderWidth, setTblBorderWidth] = useState(1)
  const [tblIsFree, setTblIsFree] = useState(false)
  const [curFontPt, setCurFontPt] = useState(12)

  const togglePopover = (which: 'tbl' | 'sym' | 'frame' | 'formula' | 'pborder' | 'wm' | 'tborder') => {
    setShowTblPicker(v => (which === 'tbl' ? !v : false))
    setShowSymbols(v => (which === 'sym' ? !v : false))
    setShowFramePicker(v => (which === 'frame' ? !v : false))
    setShowFormulas(v => (which === 'formula' ? !v : false))
    setShowPageBorders(v => (which === 'pborder' ? !v : false))
    setShowWatermark(v => (which === 'wm' ? !v : false))
    setShowTblBorders(v => (which === 'tborder' ? !v : false))
  }

  const closeAllPopovers = () => {
    setShowTblPicker(false); setShowSymbols(false); setShowFramePicker(false)
    setShowFormulas(false); setShowPageBorders(false); setShowWatermark(false); setShowTblBorders(false)
  }

  useEffect(() => {
    const onFindKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', onFindKey)
    return () => window.removeEventListener('keydown', onFindKey)
  }, [])

  useEffect(() => {
    // контекстный таб открывается на выбор, как у Word; ушёл выбор — вернулись на Главную
    if (selImg) setTab('img')
    else if (inTable) setTab('tbl')
    else setTab(t => (t === 'img' || t === 'tbl') ? 'home' : t)
  }, [selImg, inTable])

  const html = () => editRef.current?.innerHTML || ''
  const text = () => editRef.current?.innerText || ''

  const refreshOutline = () => {
    try {
      const ed = editRef.current
      if (!ed) return
      const hs = Array.from(ed.querySelectorAll('h1,h2,h3'))
      setOutlineItems(hs.map((el, idx) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim() || 'Заголовок', idx })))
    } catch { }
  }

  const jumpToHeading = (idx: number) => {
    try {
      const hs = editRef.current?.querySelectorAll('h1,h2,h3')
      const el = hs?.[idx] as HTMLElement | undefined
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch { }
  }

  const insertHtmlAtCaret = (markup: string) => {
    restoreSelection()
    try {
      document.execCommand('insertHTML', false, markup)
    } catch {
      if (editRef.current) editRef.current.innerHTML += markup
    }
    saveSelection()
    setDirty(true)
    refreshCounts()
    refreshOutline()
    measureSoon()
  }

  const packHtmlWithMeta = (rawHtml: string): string => {
    const clean = sanitize(rawHtml).replace(/<div[^>]*class=["'][^"']*word-meta[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    const meta: Record<string, any> = {}
    if (pageBorder !== 'none') {
      meta.pb = pageBorder
      meta.pbc = pageBorderColor
      meta.pbw = pageBorderWidth
    }
    if (watermark.trim()) meta.wm = watermark.trim().slice(0, 48)
    if (columns === 2) meta.cols = 2
    if (orientation === 'landscape') meta.ori = 'landscape'
    if (marginMode !== 'normal') meta.mm = marginMode
    if (paperTint !== 'white') meta.pt = paperTint
    if (headerText.trim()) meta.ht = headerText.trim().slice(0, 120)
    if (footerText.trim()) meta.ft = footerText.trim().slice(0, 120)
    if (!showPageNums) meta.pn = 0
    if (Object.keys(meta).length === 0) return clean
    const encoded = encodeURIComponent(JSON.stringify(meta))
    return `<div class="word-meta" data-word-meta="${encoded}" style="display:none"></div>${clean}`
  }

  const unpackHtmlMeta = (rawHtml: string): string => {
    const m = rawHtml.match(/<div[^>]*data-word-meta=["']([^"']+)["'][^>]*>[\s\S]*?<\/div>/i)
    if (m && m[1]) {
      try {
        const meta = JSON.parse(decodeURIComponent(m[1]))
        setPageBorder((['none', 'solid', 'double', 'shadow', 'dashed', 'gold'].includes(meta.pb) ? meta.pb : 'none') as PageBorderKind)
        setPageBorderColor(typeof meta.pbc === 'string' && /^#[0-9a-fA-F]{6}$/.test(meta.pbc) ? meta.pbc : '#2b579a')
        setPageBorderWidth(typeof meta.pbw === 'number' ? Math.max(1, Math.min(4, meta.pbw)) : 2)
        setWatermark(typeof meta.wm === 'string' ? meta.wm : '')
        setColumns(meta.cols === 2 ? 2 : 1)
        setOrientation(meta.ori === 'landscape' ? 'landscape' : 'portrait')
        setMarginMode(meta.mm === 'narrow' || meta.mm === 'wide' ? meta.mm : 'normal')
        setPaperTint(meta.pt === 'cream' || meta.pt === 'sepia' ? meta.pt : 'white')
        setHeaderText(typeof meta.ht === 'string' ? meta.ht : '')
        setFooterText(typeof meta.ft === 'string' ? meta.ft : '')
        setShowPageNums(meta.pn !== 0)
      } catch { }
    } else {
      setPageBorder('none'); setWatermark(''); setColumns(1); setOrientation('portrait')
      setMarginMode('normal'); setPaperTint('white'); setHeaderText(''); setFooterText(''); setShowPageNums(true)
    }
    return sanitize(rawHtml).replace(/<div[^>]*class=["'][^"']*word-meta[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
  }

  const applyTemplate = (tpl: typeof WORD_TEMPLATES[number]) => {
    if (hasDocumentContent(html()) && !confirm(`Вставить шаблон «${tpl.title}»? Текущий текст будет заменён (можно вернуть через Ctrl+Z).`)) return
    if (editRef.current) {
      editRef.current.innerHTML = sanitize(tpl.html)
      if (!title.trim() || title === 'Новый документ') setTitle(tpl.title)
      if (tpl.layout) {
        if (tpl.layout.orientation) setOrientation(tpl.layout.orientation)
        if (tpl.layout.pageBorder) setPageBorder(tpl.layout.pageBorder)
        if (tpl.layout.pageBorderColor) setPageBorderColor(tpl.layout.pageBorderColor)
        if (tpl.layout.paperTint) setPaperTint(tpl.layout.paperTint)
      }
      setDirty(true)
      refreshCounts()
      refreshOutline()
      measureSoon()
      closeAllPopovers()
      toast(`Шаблон «${tpl.title}» применён ✓`, 'success')
    }
  }

  const toggleParaBorder = () => {
    restoreSelection()
    const ed = editRef.current
    if (!ed) return
    const sel = window.getSelection()
    let node: Node | null = sel?.anchorNode || null
    let block: HTMLElement | null = null
    while (node && node !== ed) {
      if (node.nodeType === 1) {
        const tag = (node as HTMLElement).tagName.toLowerCase()
        if (['p', 'h1', 'h2', 'h3', 'blockquote', 'li', 'div'].includes(tag)) {
          block = node as HTMLElement
          break
        }
      }
      node = node.parentNode
    }
    if (!block) {
      insertHtmlAtCaret('<div class="word-frame" data-frame="simple" style="border:2px solid #2b579a;background-color:#f8fafc;border-radius:6px;padding:10px 14px;margin:8px 0"><p>Текст в рамке…</p></div><p><br></p>')
      return
    }
    if (block.style.border && block.style.border !== 'none') {
      block.style.border = ''
      block.style.padding = ''
      block.style.borderRadius = ''
      block.style.backgroundColor = ''
      toast('Рамка абзаца снята', 'info')
    } else {
      block.style.border = `2px solid ${pageBorderColor || '#2b579a'}`
      block.style.padding = '8px 12px'
      block.style.borderRadius = '6px'
      block.style.backgroundColor = '#f8fafc'
      toast('Рамка абзаца добавлена ✓', 'success')
    }
    setDirty(true)
    measureSoon()
  }

  const cycleTextCase = () => {
    restoreSelection()
    const sel = window.getSelection()
    const txt = sel?.toString() || ''
    if (!txt) { toast('Выдели слово или фразу, чтобы сменить регистр', 'info'); return }
    let next = txt.toUpperCase()
    if (txt === txt.toUpperCase()) next = txt.toLowerCase()
    else if (txt === txt.toLowerCase()) next = txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    try { document.execCommand('insertText', false, next) } catch { }
    saveSelection()
    setDirty(true)
  }

  const insertBlockFrame = (markup: string) => {
    const ed = editRef.current
    if (!ed) return
    const holder = document.createElement('div')
    holder.innerHTML = markup
    const nodes = Array.from(holder.childNodes)
    if (!nodes.length) return

    // Находим верхнеуровневый блок внутри editRef (никогда не вкладываем рамку внутрь ячейки таблицы или другой рамки!)
    restoreSelection()
    const sel = window.getSelection()
    let anchor: Node | null = sel?.anchorNode || null
    let topChild: Node | null = null
    while (anchor && anchor !== ed) {
      if (anchor.parentNode === ed) { topChild = anchor; break }
      anchor = anchor.parentNode
    }

    let lastInserted: Node | null = null
    if (topChild && topChild.parentNode === ed) {
      let ref: Node | null = topChild.nextSibling
      for (const n of nodes) {
        ed.insertBefore(n, ref)
        lastInserted = n
      }
    } else {
      for (const n of nodes) {
        ed.appendChild(n)
        lastInserted = n
      }
    }

    // Ставим каретку в абзац сразу после вставленного блока — повторные вставки идут ровно друг за другом
    if (lastInserted) {
      try {
        const r = document.createRange()
        r.selectNodeContents(lastInserted)
        r.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(r)
        savedRange.current = r.cloneRange()
      } catch { }
    }
    setDirty(true)
    refreshCounts()
    refreshOutline()
    measureSoon()
    requestAnimationFrame(placeTblOverlay)
  }

  const insertChecklist = () => {
    insertHtmlAtCaret('<p>☐ Задача 1 — выполнить к сроку</p><p>☐ Задача 2 — проверить результат</p>')
  }

  const stepFontSize = (delta: number) => {
    const pts = FONT_SIZES.map(x => Number(x.pt))
    let idx = pts.findIndex(p => p >= curFontPt)
    if (idx < 0) idx = pts.length - 1
    const next = pts[Math.max(0, Math.min(pts.length - 1, idx + delta))]
    setCurFontPt(next)
    setFontSizePt(String(next))
  }

  const findNext = () => {
    const q = findQuery.trim()
    if (!q) return
    const w = window as any
    if (typeof w.find === 'function') {
      const ok = w.find(q, false, false, true, false, false, false)
      if (!ok) toast(`«${q}» не найдено`, 'info')
    } else {
      toast('Используй «Заменить всё» для поиска и замены', 'info')
    }
  }

  const replaceAll = () => {
    const q = findQuery
    if (!q || !editRef.current) return
    let count = 0
    const walker = document.createTreeWalker(editRef.current, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let n = walker.nextNode()
    while (n) { nodes.push(n as Text); n = walker.nextNode() }
    const escRe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escRe, 'gi')
    for (const tn of nodes) {
      const v = tn.nodeValue || ''
      if (re.test(v)) {
        re.lastIndex = 0
        const matches = v.match(re)
        count += matches ? matches.length : 0
        tn.nodeValue = v.replace(re, replaceQuery)
      }
    }
    if (count > 0) {
      setDirty(true)
      refreshCounts()
      measureSoon()
      toast(`Заменено совпадений: ${count} ✓`, 'success')
    } else {
      toast(`«${q}» не найдено`, 'info')
    }
  }

  const refreshCounts = () => {
    const t = text().trim()
    setWords(t ? t.split(/\s+/).length : 0)
    setChars(t ? t.replace(/\s+/g, '').length : 0)
    refreshOutline()
    try {
      const q = (c: string) => { try { return document.queryCommandState(c) } catch { return false } }
      setActive({
        bold: q('bold'), italic: q('italic'), underline: q('underline'),
        strikeThrough: q('strikeThrough'),
        insertUnorderedList: q('insertUnorderedList'), insertOrderedList: q('insertOrderedList'),
      })
    } catch { }
  }

  // --- выделение: запоминаем Range, чтобы кнопки тулбара не теряли его ---
  const saveSelection = () => {
    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editRef.current?.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange()
      }
    } catch { }
  }
  const restoreSelection = () => {
    try {
      const ed = editRef.current
      if (!ed) return
      ed.focus()
      const sel = window.getSelection()
      if (savedRange.current && sel) {
        sel.removeAllRanges()
        sel.addRange(savedRange.current)
      }
    } catch { }
  }

  const cmd = (command: string, value?: string) => {
    restoreSelection()
    try {
      // styleWithCSS — команды дают <span style="…">, а не старые <font>/<b> — так Word-образнее
      try { document.execCommand('styleWithCSS', false, 'true') } catch { }
      if (command === 'formatBlock' && value && !value.startsWith('<')) {
        try { document.execCommand(command, false, value) }
        catch { document.execCommand(command, false, `<${value}>`) }
      } else {
        document.execCommand(command, false, value)
      }
    } catch { }
    saveSelection()
    setDirty(true)
    refreshCounts()
  }

  // Размер шрифта в пунктах (8–72, кегли как в Word). execCommand умеет только
  // 1..7, поэтому ставим максимум «7» и на лету переписываем размер на настоящие pt.
  const setFontSizePt = (pt: string) => {
    restoreSelection()
    try {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('fontSize', false, '7')
    } catch { }
    requestAnimationFrame(() => {
      try {
        const ed = editRef.current
        ed?.querySelectorAll<HTMLElement>('span,font').forEach(el => {
          const cur = el.style.fontSize || ''
          if (/xxx-large|xx-large/i.test(cur) || el.getAttribute('size') === '7') {
            el.style.fontSize = `${pt}pt`
            el.removeAttribute('size')
          }
        })
      } catch { }
    })
    saveSelection()
    setDirty(true)
    refreshCounts()
  }

  const setFontFamily = (family: string) => {
    if (!family) return
    cmd('fontName', family)
  }

  // Межстрочный интервал: применяем ко всем абзацам, которые пересекает выделение
  const setLineSpacing = (m: string) => {
    if (!m) return
    const ed = editRef.current
    const sel = window.getSelection()
    if (!ed || !sel || sel.rangeCount === 0) return
    try {
      const range = sel.getRangeAt(0)
      if (!ed.contains(range.commonAncestorContainer)) return
      const blocks = ed.querySelectorAll<HTMLElement>('p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre,div:not(.page-break)')
      blocks.forEach(b => { if (range.intersectsNode(b)) b.style.lineHeight = m })
    } catch { }
    setDirty(true)
  }

  // Кнопка тулбара: mousedown не уводит фокус из редактора — выделение живёт
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  // --- картинка: выбор кликом + позиция уголка ---
  const placeHandle = () => {
    const img = selImgRef.current
    const wrap = wrapRef.current
    if (!img || !wrap || !wrap.contains(img)) { setHandle(null); return }
    try {
      const wr = wrap.getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      setHandle({ x: ir.right - wr.left, y: ir.bottom - wr.top })
      if (img.dataset.free === '1') setImgW(Math.round(ir.width))
      else {
        const base = editRef.current?.clientWidth || 1
        setImgW(Math.max(5, Math.min(100, Math.round((ir.width / base) * 100))))
      }
    } catch { }
  }

  const markSelImg = (img: HTMLImageElement | null) => {
    try {
      editRef.current?.querySelectorAll('img.sel').forEach(i => i.classList.remove('sel'))
      if (img) img.classList.add('sel')
    } catch { }
    selImgRef.current = img
    setSelImg(img)
    if (img) requestAnimationFrame(placeHandle)
    else setHandle(null)
  }

  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t && t.tagName === 'IMG') markSelImg(t as HTMLImageElement)
    else markSelImg(null)
    rememberTable()
  }
  const imgSetWidth = (pct: number) => {
    if (!selImg) return
    const v = Math.max(10, Math.min(100, pct))
    selImg.style.width = `${v}%`
    selImg.style.height = 'auto'
    setImgW(v)
    setDirty(true)
  }

  const imgAlign = (mode: 'left' | 'center' | 'right') => {
    if (!selImg) return
    restoreSelection()
    selImg.style.cssText += ';'
    selImg.style.float = ''
    selImg.style.display = ''
    selImg.style.margin = ''
    if (mode === 'center') { selImg.style.display = 'block'; selImg.style.margin = '8px auto' }
    if (mode === 'left') { selImg.style.float = 'left'; selImg.style.margin = '4px 12px 4px 0' }
    if (mode === 'right') { selImg.style.float = 'right'; selImg.style.margin = '4px 0 4px 12px' }
    setDirty(true)
  }

  const imgDelete = () => {
    if (!selImg) return
    selImg.remove()
    markSelImg(null)
    setDirty(true)
    refreshCounts()
  }

  const isFree = (img: HTMLImageElement | null) => !!img && img.dataset.free === '1'

  // режим «Свободно»: фото открепляется от текста, таскается мышью куда угодно
  const imgFree = () => {
    const img = selImgRef.current
    const wrap = wrapRef.current
    if (!img || !wrap) return
    const wr = wrap.getBoundingClientRect()
    const ir = img.getBoundingClientRect()
    img.dataset.free = '1'
    img.draggable = false
    img.style.position = 'absolute'
    img.style.left = `${Math.max(0, ir.left - wr.left)}px`
    img.style.top = `${Math.max(0, ir.top - wr.top)}px`
    img.style.width = `${Math.round(ir.width)}px`
    img.style.height = 'auto'
    img.style.margin = '0'
    img.style.float = 'none'
    img.style.zIndex = '5'
    img.style.cursor = 'move'
    setDirty(true)
    requestAnimationFrame(placeHandle)
  }

  // вернуть фото в текст
  const imgInline = () => {
    const img = selImgRef.current
    if (!img) return
    delete img.dataset.free
    img.draggable = true
    img.style.position = ''
    img.style.left = ''
    img.style.top = ''
    img.style.zIndex = ''
    img.style.cursor = ''
    img.style.display = 'block'
    img.style.margin = '8px auto'
    const base = editRef.current?.clientWidth || 1
    const pct = Math.max(10, Math.min(100, Math.round((img.getBoundingClientRect().width / base) * 100)))
    img.style.width = `${pct}%`
    img.style.height = 'auto'
    setDirty(true)
    requestAnimationFrame(placeHandle)
  }

  // таскание свободного фото мышью
  const onFreeMouseDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement
    if (!t || t.tagName !== 'IMG') {
      // клик по тексту — сразу снимаем выбор с фото, каретка встанет сама
      if (selImgRef.current) markSelImg(null)
      return
    }
    const img = t as HTMLImageElement
    if (img.dataset.free !== '1') return
    e.preventDefault()
    const wrap = wrapRef.current
    if (!wrap) return
    const wr = wrap.getBoundingClientRect()
    const ir = img.getBoundingClientRect()
    dragRef.current = {
      mode: 'move',
      startX: e.clientX, startY: e.clientY,
      origW: ir.width,
      origL: ir.left - wr.left, origT: ir.top - wr.top,
    }
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      img.style.left = `${Math.max(0, d.origL + (ev.clientX - d.startX))}px`
      img.style.top = `${Math.max(0, d.origT + (ev.clientY - d.startY))}px`
      placeHandle()
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      dragRef.current = null
      setDirty(true)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  // уголок: тянешь — размер меняется
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const img = selImgRef.current
    if (!img) return
    const free = img.dataset.free === '1'
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width
    const base = editRef.current?.clientWidth || 1
    const move = (ev: PointerEvent) => {
      const w = Math.max(30, startW + (ev.clientX - startX))
      if (free) {
        img.style.width = `${Math.round(w)}px`
        setImgW(Math.round(w))
      } else {
        const pct = Math.max(5, Math.min(100, Math.round((w / base) * 100)))
        img.style.width = `${pct}%`
        setImgW(pct)
      }
      img.style.height = 'auto'
      placeHandle()
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      setDirty(true)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const imgSizeChange = (v: number) => {
    const img = selImgRef.current
    if (!img) return
    if (img.dataset.free === '1') {
      const px = Math.max(30, Math.min(1600, v))
      img.style.width = `${px}px`
      img.style.height = 'auto'
      setImgW(px)
    } else {
      imgSetWidth(v)
    }
    setDirty(true)
    requestAnimationFrame(placeHandle)
  }

  // --- таблицы ---
  const curTable = (): HTMLTableElement | null => {
    try {
      const sel = window.getSelection()
      const n = sel?.anchorNode
      const el = (n instanceof Element ? n : (n as Node)?.parentElement) as HTMLElement | null
      const t = el?.closest?.('table')
      return (t && editRef.current?.contains(t)) ? (t as HTMLTableElement) : null
    } catch { return null }
  }

  // клик по кнопкам панели уводит фокус — таблицу помним отдельно, иначе +/- не находят её
  const rememberTable = () => {
    const t = curTable()
    if (t) { lastTable.current = t; prepareTable(t) } else { lastTable.current = null }
    setInTable(!!t)
    setTblIsFree(t ? t.dataset.free === '1' : false)
    requestAnimationFrame(placeTblOverlay)
  }
  const getTable = (): HTMLTableElement | null => {
    const t = curTable()
    if (t) { lastTable.current = t; return t }
    if (lastTable.current && editRef.current?.contains(lastTable.current)) return lastTable.current
    return null
  }

  const styleCell = (c: HTMLTableCellElement) => { c.style.cssText = CELL_STYLE }

  // каретка внутри ячейки (для кнопок панели)
  const curCell = (): HTMLTableCellElement | null => {
    try {
      const sel = window.getSelection()
      const n = sel?.anchorNode
      const el = (n instanceof Element ? n : (n as Node)?.parentElement) as HTMLElement | null
      const c = el?.closest?.('td,th') as HTMLTableCellElement | null
      return (c && editRef.current?.contains(c)) ? c : null
    } catch { return null }
  }

  // таблица одним куском: fixed-layout + равные колонки один раз
  const prepareTable = (t: HTMLTableElement) => {
    try {
      t.style.borderCollapse = 'collapse'
      t.style.margin = t.style.margin || '8px 0'
      if (t.dataset.fixed !== '1') {
        t.dataset.fixed = '1'
        t.style.tableLayout = 'fixed'
        const first = t.rows[0]
        if (first) {
          const w = `${(100 / Math.max(1, first.cells.length)).toFixed(2)}%`
          for (const c of Array.from(first.cells)) { c.style.width = w }
        }
      }
    } catch { }
  }

  // ——— оверлей живой таблицы: рамка, ручка «передвинуть» (✥), уголок «размер» (↘), ширины колонок (↔), высоты строк (↕) ———
  const placeTblOverlay = () => {
    const layer = tblOverlayRef.current
    const wrap = wrapRef.current
    const t = lastTable.current
    if (!layer || !wrap) return
    if (!t || !wrap.contains(t) || !document.contains(t)) {
      if (layer.childElementCount) layer.innerHTML = ''
      return
    }
    const tr = t.getBoundingClientRect()
    const wr = wrap.getBoundingClientRect()
    const zScale = wordZoom / 100 || 1
    const left = (tr.left - wr.left) / zScale
    const top = (tr.top - wr.top) / zScale
    const width = tr.width / zScale
    const height = tr.height / zScale
    if (!width || tr.bottom < -60 || tr.top > innerHeight + 60) {
      if (layer.childElementCount) layer.innerHTML = ''
      return
    }
    layer.innerHTML = ''
    const box = document.createElement('div')
    box.className = 'word-tbl-box'
    box.style.cssText = `position:absolute;pointer-events:none;border:2px solid #2b579a;border-radius:4px;left:${left - 2}px;top:${top - 2}px;width:${width + 4}px;height:${height + 4}px`
    layer.appendChild(box)

    // 1. Ручка «Передвинуть таблицу» (левый верхний угол, как в Word — width:auto чтобы текст НЕ обрезался!)
    const mv = document.createElement('div')
    mv.className = 'word-tbl-move'
    mv.title = t.dataset.free === '1' ? 'Тяни — свободно двигать таблицу по листу' : 'Тяни — передвинуть таблицу (или включи «Свободно»)'
    mv.style.cssText = `position:absolute;pointer-events:auto;cursor:move;touch-action:none;z-index:30;left:${Math.max(0, left - 2)}px;top:${Math.max(0, top - 24)}px;width:auto;height:22px;padding:0 8px;border-radius:6px 6px 0 0;background:#2b579a;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(0,0,0,0.22);user-select:none`
    mv.textContent = t.dataset.free === '1' ? '✥ Двигать' : '✥ Переместить'
    mv.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startTblMove(ev, t) })
    layer.appendChild(mv)

    // 2. Уголок «Изменить размер таблицы» (правый нижний угол — как в настоящем Word!)
    const corner = document.createElement('div')
    corner.title = 'Тяни — изменить ширину и высоту таблицы'
    corner.style.cssText = `position:absolute;pointer-events:auto;cursor:nwse-resize;touch-action:none;z-index:30;left:${left + width - 7}px;top:${top + height - 7}px;width:16px;height:16px;border-radius:4px;background:#2b579a;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;line-height:1`
    corner.textContent = '↘'
    corner.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startTblCornerResize(ev, t) })
    layer.appendChild(corner)

    // 3. Ширины столбцов — удобные ручки на каждой вертикальной границе
    const first = t.rows[0]
    if (first) {
      for (let i = 1; i < first.cells.length; i++) {
        const cr = (first.cells[i] as HTMLTableCellElement).getBoundingClientRect()
        const cLeft = (cr.left - wr.left) / zScale
        const h = document.createElement('div')
        h.className = 'word-col-h'
        h.title = 'Тяни влево/вправо — ширина столбца'
        h.style.cssText = `position:absolute;pointer-events:auto;cursor:col-resize;touch-action:none;z-index:25;left:${cLeft - 5}px;top:${top}px;width:10px;height:${height}px`
        h.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startColDrag(ev, t, i - 1) })
        layer.appendChild(h)
      }
    }

    // 4. Высоты строк — ручки по всей ширине нижней границы каждой строки
    for (let i = 0; i < t.rows.length; i++) {
      const rr = (t.rows[i] as HTMLTableRowElement).getBoundingClientRect()
      const rBot = (rr.bottom - wr.top) / zScale
      const h = document.createElement('div')
      h.className = 'word-row-h'
      h.title = 'Тяни вверх/вниз — высота строки'
      h.style.cssText = `position:absolute;pointer-events:auto;cursor:row-resize;touch-action:none;z-index:24;left:${left + 4}px;top:${rBot - 4}px;width:${Math.max(20, width - 20)}px;height:8px`
      h.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startRowDrag(ev, t, i) })
      layer.appendChild(h)
    }
  }

  const startTblCornerResize = (e: PointerEvent, t: HTMLTableElement) => {
    const ed = editRef.current
    if (!ed) return
    document.body.style.userSelect = 'none'
    const zScale = wordZoom / 100 || 1
    const startX = e.clientX
    const startY = e.clientY
    const tr = t.getBoundingClientRect()
    const startW = tr.width / zScale
    const startH = tr.height / zScale
    const maxW = Math.max(240, ed.clientWidth - (marginMode === 'narrow' ? 40 : marginMode === 'wide' ? 128 : 80))
    const rowCount = Math.max(1, t.rows.length)
    const origRowHs = Array.from(t.rows).map(r => r.getBoundingClientRect().height / zScale)

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zScale
      const dy = (ev.clientY - startY) / zScale
      const nextW = Math.max(160, Math.min(maxW, startW + dx))
      if (t.dataset.free === '1') {
        t.style.width = `${Math.round(nextW)}px`
      } else {
        const pct = Math.max(25, Math.min(100, Math.round((nextW / maxW) * 100)))
        t.style.width = `${pct}%`
      }
      if (Math.abs(dy) > 2) {
        const scaleY = Math.max(0.45, Math.min(4, (startH + dy) / Math.max(40, startH)))
        Array.from(t.rows).forEach((r, idx) => {
          r.style.height = `${Math.max(24, Math.round((origRowHs[idx] || startH / rowCount) * scaleY))}px`
        })
      }
      placeTblOverlay()
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      document.body.style.userSelect = ''
      setDirty(true)
      measureSoon()
      requestAnimationFrame(placeTblOverlay)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const startColDrag = (e: PointerEvent, t: HTMLTableElement, idx: number) => {
    const first = t.rows[0]
    const cell = first?.cells[idx] as HTMLTableCellElement | undefined
    const nextCell = first?.cells[idx + 1] as HTMLTableCellElement | undefined
    if (!cell) return
    document.body.style.userSelect = 'none'
    const zScale = wordZoom / 100 || 1
    const startX = e.clientX
    const startW = cell.getBoundingClientRect().width / zScale
    const startNextW = nextCell ? nextCell.getBoundingClientRect().width / zScale : 0
    const tableW = Math.max(1, t.getBoundingClientRect().width / zScale)
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zScale
      if (nextCell) {
        const pair = startW + startNextW
        const w1 = Math.max(30, Math.min(pair - 30, startW + dx))
        const w2 = pair - w1
        cell.style.width = `${((w1 / tableW) * 100).toFixed(2)}%`
        nextCell.style.width = `${((w2 / tableW) * 100).toFixed(2)}%`
      } else {
        const w = Math.max(30, Math.min(tableW - 30, startW + dx))
        cell.style.width = `${((w / tableW) * 100).toFixed(2)}%`
      }
      placeTblOverlay()
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      document.body.style.userSelect = ''
      tblDragRef.current = null
      setDirty(true)
    }
    tblDragRef.current = { t }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const startRowDrag = (e: PointerEvent, t: HTMLTableElement, idx: number) => {
    const row = t.rows[idx] as HTMLTableRowElement | undefined
    if (!row) return
    document.body.style.userSelect = 'none'
    const zScale = wordZoom / 100 || 1
    const startY = e.clientY
    const startH = row.getBoundingClientRect().height / zScale
    const move = (ev: PointerEvent) => {
      row.style.height = `${Math.max(24, Math.min(500, Math.round(startH + (ev.clientY - startY) / zScale)))}px`
      placeTblOverlay()
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      document.body.style.userSelect = ''
      setDirty(true)
      measureSoon()
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const tblFree = () => {
    const t = getTable()
    const wrap = wrapRef.current
    if (!t || !wrap) return
    const wr = wrap.getBoundingClientRect()
    const tr = t.getBoundingClientRect()
    const zScale = wordZoom / 100 || 1
    t.dataset.free = '1'
    t.style.position = 'absolute'
    t.style.left = `${Math.max(8, Math.round((tr.left - wr.left) / zScale))}px`
    t.style.top = `${Math.max(8, Math.round((tr.top - wr.top) / zScale))}px`
    t.style.width = `${Math.round(tr.width / zScale)}px`
    t.style.margin = '0'
    t.style.float = 'none'
    t.style.zIndex = '15'
    t.style.background = sheetBg
    setTblIsFree(true)
    setDirty(true)
    toast('Режим «Свободно»: тяни за синюю ручку ✥ куда угодно и за уголок ↘ для размера', 'info')
    requestAnimationFrame(placeTblOverlay)
  }

  const tblInline = () => {
    const t = getTable()
    if (!t) return
    delete t.dataset.free
    setTblIsFree(false)
    t.style.position = ''
    t.style.left = ''
    t.style.top = ''
    t.style.zIndex = ''
    t.style.background = ''
    t.style.float = ''
    t.style.width = '100%'
    t.style.margin = '8px 0'
    setDirty(true)
    measureSoon()
    requestAnimationFrame(placeTblOverlay)
  }

  // перестановка таблицы: в свободном режиме тащится X/Y куда угодно, в текстовом — между абзацами (и при сдвиге вбок легко переходит в свободный!)
  const startTblMove = (e: PointerEvent, t: HTMLTableElement) => {
    const ed = editRef.current
    const wrap = wrapRef.current
    if (!ed || !wrap) return
    e.preventDefault()
    document.body.style.userSelect = 'none'
    const zScale = wordZoom / 100 || 1

    // Если уже в свободном режиме — плавное перетаскивание X/Y по всему листу
    if (t.dataset.free === '1') {
      const wr = wrap.getBoundingClientRect()
      const tr = t.getBoundingClientRect()
      const origL = (tr.left - wr.left) / zScale
      const origT = (tr.top - wr.top) / zScale
      const sx = e.clientX
      const sy = e.clientY
      const moveFree = (ev: PointerEvent) => {
        const nl = Math.max(0, Math.min(wrap.clientWidth - 60, origL + (ev.clientX - sx) / zScale))
        const nt = Math.max(0, origT + (ev.clientY - sy) / zScale)
        t.style.left = `${Math.round(nl)}px`
        t.style.top = `${Math.round(nt)}px`
        placeTblOverlay()
      }
      const upFree = () => {
        document.removeEventListener('pointermove', moveFree)
        document.removeEventListener('pointerup', upFree)
        document.removeEventListener('pointercancel', upFree)
        document.body.style.userSelect = ''
        setDirty(true)
        requestAnimationFrame(placeTblOverlay)
      }
      document.addEventListener('pointermove', moveFree)
      document.addEventListener('pointerup', upFree)
      document.addEventListener('pointercancel', upFree)
      return
    }

    // В текстовом режиме: если потянуть сильно в сторону — автоматически открепляем в свободное перемещение; иначе переставляем между абзацами!
    const kids = Array.from(ed.children) as HTMLElement[]
    const line = document.createElement('div')
    line.className = 'word-drop-line'
    line.style.cssText = 'position:fixed;height:3px;background:#2b579a;border-radius:2px;pointer-events:none;z-index:60;display:none'
    document.body.appendChild(line)
    let dropBefore: Element | null = null
    let atEnd = false
    let switchedFree = false
    const startX = e.clientX
    const startY = e.clientY
    const wr0 = wrap.getBoundingClientRect()
    const tr0 = t.getBoundingClientRect()
    const origL0 = (tr0.left - wr0.left) / zScale
    const origT0 = (tr0.top - wr0.top) / zScale

    const compute = (ev: PointerEvent) => {
      if (!switchedFree && Math.abs(ev.clientX - startX) > 36) {
        switchedFree = true
        line.style.display = 'none'
        t.dataset.free = '1'
        setTblIsFree(true)
        t.style.position = 'absolute'
        t.style.width = `${Math.round(tr0.width / zScale)}px`
        t.style.margin = '0'
        t.style.float = 'none'
        t.style.zIndex = '15'
        t.style.background = sheetBg
      }
      if (switchedFree) {
        const nl = Math.max(0, Math.min(wrap.clientWidth - 60, origL0 + (ev.clientX - startX) / zScale))
        const nt = Math.max(0, origT0 + (ev.clientY - startY) / zScale)
        t.style.left = `${Math.round(nl)}px`
        t.style.top = `${Math.round(nt)}px`
        placeTblOverlay()
        return
      }
      const y = ev.clientY
      dropBefore = null
      atEnd = true
      line.style.display = 'block'
      for (const k of kids) {
        if (k === t || !ed.contains(k)) continue
        const r = k.getBoundingClientRect()
        if (y < (r.top + r.bottom) / 2) {
          dropBefore = k
          atEnd = false
          line.style.left = `${r.left}px`
          line.style.width = `${r.width}px`
          line.style.top = `${r.top}px`
          break
        }
      }
      if (atEnd) {
        const last = kids[kids.length - 1]
        const r = (last && ed.contains(last) && last !== t) ? last.getBoundingClientRect() : ed.getBoundingClientRect()
        line.style.left = `${r.left}px`
        line.style.width = `${r.width}px`
        line.style.top = `${r.bottom - 2}px`
      }
    }
    const up = () => {
      document.removeEventListener('pointermove', compute)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      line.remove()
      document.body.style.userSelect = ''
      if (!switchedFree) {
        try {
          if (atEnd) ed.appendChild(t)
          else if (dropBefore) ed.insertBefore(t, dropBefore)
        } catch { }
      }
      lastTable.current = t
      setDirty(true)
      measureSoon()
      requestAnimationFrame(placeTblOverlay)
    }
    document.addEventListener('pointermove', compute)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const insertTable = (rows?: number, cols?: number) => {
    const R = Math.max(1, Math.min(10, rows ?? tblRows ?? 3))
    const C = Math.max(1, Math.min(6, cols ?? tblCols ?? 3))
    restoreSelection()
    const colW = `${(100 / C).toFixed(2)}%`
    let t = '<table data-fixed="1" style="border-collapse:collapse;table-layout:fixed;width:100%;margin:10px 0">'
    for (let i = 0; i < R; i++) {
      t += '<tr>'
      for (let j = 0; j < C; j++) t += `<td style="${CELL_STYLE}width:${colW};">&nbsp;</td>`
      t += '</tr>'
    }
    t += '</table><p><br></p>'
    try { document.execCommand('insertHTML', false, t) } catch { }
    saveSelection()
    setDirty(true)
    setInTable(true)
    setShowTblPicker(false)
    requestAnimationFrame(() => {
      try {
        const tables = editRef.current?.querySelectorAll('table')
        const last = tables?.[tables.length - 1] as HTMLTableElement | undefined
        if (last) {
          lastTable.current = last
          prepareTable(last)
          if (last.rows[0]?.cells[0]) focusCell(last.rows[0].cells[0])
          placeTblOverlay()
        }
      } catch { }
      measureSoon()
    })
  }

  const tableAddRow = () => {
    const t = getTable()
    if (!t) return
    const cols = t.rows[0]?.cells.length || 1
    const cell = curCell()
    const rowEl = cell ? (cell.closest('tr') as HTMLTableRowElement | null) : null
    const at = rowEl ? rowEl.rowIndex + 1 : t.rows.length
    const r = t.insertRow(Math.max(0, at))
    for (let i = 0; i < cols; i++) { const c = r.insertCell() as HTMLTableCellElement; c.innerHTML = ' '; styleCell(c) }
    if (rowEl) focusCell(r.cells[0])
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }
  const tableAddCol = () => {
    const t = getTable()
    if (!t) return
    const cell = curCell()
    const n = (t.rows[0]?.cells.length || 0)
    const at = cell ? Math.max(0, Math.min(n, cell.cellIndex + 1)) : n
    for (const r of Array.from(t.rows)) { const c = r.insertCell(at) as HTMLTableCellElement; c.innerHTML = ' '; styleCell(c) }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }
  const tableDelRow = () => {
    const t = getTable()
    if (!t) return
    try {
      const sel = window.getSelection()
      const n = sel?.anchorNode
      const el = (n instanceof Element ? n : (n as Node)?.parentElement) as HTMLElement | null
      const row = el?.closest?.('tr')
      const idx = row ? row.rowIndex : t.rows.length - 1
      if (t.rows.length <= 1) { t.remove(); setInTable(false) } else t.deleteRow(idx)
    } catch { }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }
  const tableDelCol = () => {
    const t = getTable()
    if (!t) return
    try {
      const sel = window.getSelection()
      const n = sel?.anchorNode
      const el = (n instanceof Element ? n : (n as Node)?.parentElement) as HTMLElement | null
      const cell = el?.closest?.('td,th') as HTMLTableCellElement | null
      const idx = cell ? cell.cellIndex : (t.rows[0]?.cells.length || 1) - 1
      if ((t.rows[0]?.cells.length || 1) <= 1) { t.remove(); setInTable(false); return }
      for (const r of Array.from(t.rows)) { try { r.deleteCell(idx) } catch { } }
    } catch { }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }
  const tableDelete = () => {
    const t = getTable()
    if (!t) return
    t.remove()
    lastTable.current = null
    setInTable(false)
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // ширина всей таблицы (40%, 60%, 80%, 100%)
  const tblSetWidth = (pct: number) => {
    const t = getTable()
    if (!t) return
    if (t.dataset.free === '1') {
      const base = editRef.current?.clientWidth || 680
      t.style.width = `${Math.round((base * pct) / 100)}px`
    } else {
      t.style.width = `${pct}%`
    }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // отступы ячеек таблицы (Компакт / Обычная / Просторная)
  const tblSetPadding = (px: number) => {
    const t = getTable()
    if (!t) return
    t.querySelectorAll<HTMLElement>('td,th').forEach(c => { c.style.padding = `${px}px ${Math.round(px * 1.4)}px` })
    setDirty(true)
    measureSoon()
    requestAnimationFrame(placeTblOverlay)
  }

  // выравнивание всей таблицы в листе (не сбрасывает ширину!)
  const tblAlign = (mode: 'left' | 'center' | 'right') => {
    const t = getTable()
    if (!t) return
    if (t.dataset.free === '1') tblInline()
    t.style.float = 'none'
    if (!t.style.width || t.style.width === '100%') t.style.width = mode === 'center' ? '80%' : '100%'
    t.style.margin = mode === 'center' ? '10px auto' : mode === 'right' ? '10px 0 10px auto' : '8px 0'
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // обтекание как у Word-таблицы (картинка/текст сбоку)
  const tblFloat = (side: '' | 'left' | 'right') => {
    const t = getTable()
    if (!t) return
    if (t.dataset.free === '1') tblInline()
    if (!side) { t.style.float = ''; t.style.width = '100%'; t.style.margin = '8px 0' }
    else { t.style.float = side; t.style.width = '48%'; t.style.margin = side === 'left' ? '6px 12px 6px 0' : '6px 0 6px 12px' }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // первая строка — шапка (th) или обычная (td)
  const tblHeader = () => {
    const t = getTable()
    if (!t || !t.rows[0]) return
    const toTh = (t.rows[0].cells[0] as HTMLTableCellElement)?.tagName === 'TD'
    for (const c of Array.from(t.rows[0].cells) as HTMLTableCellElement[]) {
      const nc = document.createElement(toTh ? 'th' : 'td')
      nc.innerHTML = c.innerHTML
      nc.style.cssText = c.style.cssText
      if (toTh) nc.style.width = c.style.width
      c.replaceWith(nc)
    }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // фон текущей ячейки
  const tblCellBg = (v: string) => {
    const c = curCell()
    if (!c) return
    c.style.backgroundColor = v
    setDirty(true)
  }

  // выравнивание текста в текущей ячейке
  const tblCellAlign = (mode: 'left' | 'center' | 'right') => {
    const c = curCell()
    if (!c) return
    c.style.textAlign = mode
    setDirty(true)
  }

  // рамки таблицы (Все границы / Только внешняя / Только строки / Двойная рамка / Без границ)
  const tblApplyBorder = (mode: 'all' | 'outer' | 'horiz' | 'double' | 'none', colorOverride?: string, widthOverride?: number) => {
    const t = getTable()
    if (!t) return
    const col = colorOverride || tblBorderColor || '#64748b'
    const w = widthOverride ?? tblBorderWidth ?? 1
    const cells = Array.from(t.querySelectorAll<HTMLElement>('td,th'))
    if (mode === 'none') {
      t.style.border = 'none'
      cells.forEach(c => { c.style.border = 'none' })
    } else if (mode === 'outer') {
      t.style.border = `${Math.max(2, w)}px solid ${col}`
      cells.forEach(c => { c.style.border = 'none' })
    } else if (mode === 'horiz') {
      t.style.border = 'none'
      t.style.borderTop = `${Math.max(2, w)}px solid ${col}`
      t.style.borderBottom = `${Math.max(2, w)}px solid ${col}`
      cells.forEach(c => {
        c.style.border = 'none'
        c.style.borderBottom = `${w}px solid ${col}`
      })
    } else if (mode === 'double') {
      t.style.border = `${Math.max(3, w + 2)}px double ${col}`
      cells.forEach(c => { c.style.border = `${w}px solid ${col}` })
    } else {
      t.style.border = `${w}px solid ${col}`
      cells.forEach(c => { c.style.border = `${w}px solid ${col}` })
    }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // готовые цветовые стили таблиц (как «Конструктор таблиц» в MS Word)
  const tblApplyTheme = (themeId: string) => {
    const t = getTable()
    const th = TABLE_THEMES.find(x => x.id === themeId)
    if (!t || !th) return
    setTblBorderColor(th.border)
    t.style.border = `1px solid ${th.border}`
    t.dataset.zebra = '1'
    Array.from(t.rows).forEach((row, rIdx) => {
      Array.from(row.cells).forEach(cell => {
        const el = cell as HTMLElement
        el.style.border = `1px solid ${th.border}`
        if (rIdx === 0) {
          el.style.backgroundColor = th.headBg
          el.style.color = th.headFg
          el.style.fontWeight = '700'
        } else {
          el.style.color = '#0f172a'
          el.style.fontWeight = ''
          el.style.backgroundColor = rIdx % 2 === 0 ? th.zebra : '#ffffff'
        }
      })
    })
    setDirty(true)
    toast(`Стиль таблицы «${th.label}» применён ✓`, 'success')
    requestAnimationFrame(placeTblOverlay)
  }

  // зебра (чередование фона строк)
  const tblToggleZebra = () => {
    const t = getTable()
    if (!t) return
    const on = t.dataset.zebra !== '1'
    t.dataset.zebra = on ? '1' : '0'
    Array.from(t.rows).forEach((row, rIdx) => {
      if (rIdx === 0) return
      Array.from(row.cells).forEach(cell => {
        ;(cell as HTMLElement).style.backgroundColor = on && rIdx % 2 === 0 ? '#f1f5f9' : ''
      })
    })
    setDirty(true)
  }

  // сортировка строк таблицы А→Я по текущему столбцу
  const tblSortByCol = () => {
    const t = getTable()
    if (!t || t.rows.length < 2) return
    const c = curCell()
    const colIdx = c ? c.cellIndex : 0
    const tbody = t.tBodies[0] || t
    const rows = Array.from(t.rows)
    const hasHead = rows[0].cells[0]?.tagName === 'TH' || rows.length > 2
    const dataRows = hasHead ? rows.slice(1) : rows
    dataRows.sort((a, b) => {
      const av = (a.cells[colIdx]?.textContent || '').trim()
      const bv = (b.cells[colIdx]?.textContent || '').trim()
      const an = parseFloat(av.replace(',', '.'))
      const bn = parseFloat(bv.replace(',', '.'))
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
      return av.localeCompare(bv, 'ru')
    })
    dataRows.forEach(r => tbody.appendChild(r))
    setDirty(true)
    toast(`Таблица отсортирована по столбцу ${colIdx + 1} ✓`, 'success')
    requestAnimationFrame(placeTblOverlay)
  }

  // объединить текущую ячейку с соседней справа
  const tblMergeRight = () => {
    const c = curCell()
    if (!c) return
    const next = c.nextElementSibling as HTMLTableCellElement | null
    if (!next) { toast('Справа нет ячейки для объединения', 'info'); return }
    const addText = (next.innerHTML || '').replace(/&nbsp;/g, '').trim()
    if (addText) c.innerHTML = `${c.innerHTML} ${next.innerHTML}`
    c.colSpan = (c.colSpan || 1) + (next.colSpan || 1)
    next.remove()
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // разделить объединённую ячейку
  const tblSplitCell = () => {
    const c = curCell()
    if (!c || (c.colSpan || 1) <= 1) { toast('Эта ячейка не объединена', 'info'); return }
    const span = c.colSpan
    c.colSpan = 1
    for (let i = 1; i < span; i++) {
      const nc = document.createElement(c.tagName.toLowerCase()) as HTMLTableCellElement
      nc.innerHTML = '&nbsp;'
      nc.style.cssText = c.style.cssText
      c.after(nc)
    }
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  const focusCell = (c: HTMLTableCellElement) => {
    try {
      const r = document.createRange()
      r.selectNodeContents(c)
      r.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(r)
      editRef.current?.focus()
      saveSelection()
    } catch { }
  }

  // Tab / Shift+Tab между ячейками как в Word; Tab в последней — новая строка
  const tableTab = (e: React.KeyboardEvent, back: boolean): boolean => {
    const t = getTable()
    if (!t) return false
    try {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return false
      const n = sel.anchorNode
      const el = (n instanceof Element ? n : (n as Node)?.parentElement) as HTMLElement | null
      const cell = el?.closest?.('td,th') as HTMLTableCellElement | null
      if (!cell || !t.contains(cell)) return false
      e.preventDefault()
      const cells = Array.from(t.querySelectorAll('td,th')) as HTMLTableCellElement[]
      const i = cells.indexOf(cell)
      if (back) {
        focusCell(cells[Math.max(0, i - 1)])
        return true
      }
      if (i >= cells.length - 1) {
        tableAddRow()
        const fresh = Array.from(t.querySelectorAll('td,th')) as HTMLTableCellElement[]
        focusCell(fresh[cells.length] || fresh[fresh.length - 1])
        return true
      }
      focusCell(cells[i + 1])
      return true
    } catch { return false }
  }

  const onEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && getTable()) {
      if (tableTab(e, e.shiftKey)) return
    }
    // печатаешь после выбора фото — выбор снимается, текст идёт в каретку
    if (selImgRef.current && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete')) {
      markSelImg(null)
    }
  }

  // В обычном режиме прокручивается window, в полноэкранном — контейнер редактора.
  const scrollSheetIntoView = (n: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const tops = layoutRef.current.tops
    const idx = Math.min(Math.max(0, n - 1), tops.length - 1)
    const offset = (idx === 0 ? 0 : tops[idx].top) - SHEET_VIEW_OFFSET
    const wr = wrap.getBoundingClientRect()
    if (full) {
      const panel = sheetScrollRef.current
      if (!panel) return
      const pr = panel.getBoundingClientRect()
      const y = panel.scrollTop + wr.top - pr.top + offset
      panel.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    } else {
      const y = window.scrollY + wr.top + offset
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    }
  }

  // явная кнопка «+ Лист»: разрыв в конце документа + каретка на новом листе
  const addPage = () => {
    const ed = editRef.current
    if (!ed) return
    const wasPages = Math.max(1, layoutRef.current.tops.length)
    if (wasPages >= 50) return
    ed.focus()
    try {
      const r = document.createRange()
      r.selectNodeContents(ed)
      r.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(r)
      saveSelection()
    } catch { }
    insertPageBreak() // маркер + каретка на новый лист + релокация хвостов (внутри)
    window.setTimeout(() => {
      updateCurPage()
      scrollSheetIntoView(wasPages + 1)
    }, 120)
  }

  // переход к листу N (кнопки-страницы под тулбаром)
  const gotoSheet = (n: number) => {
    setCurPage(n)
    scrollSheetIntoView(n)
  }

  // загрузка списка: бэк, при ошибке — локально (стенд без интернета)
  useEffect(() => {
    if (editRef.current && !editRef.current.innerHTML) {
      editRef.current.innerHTML = '<p>Начни писать здесь… Выдели текст чтобы форматировать.</p>'
    }
    mergeRedundantBreaks(true)
    client.get('/word-docs/').then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data.results || []
      setDocs(arr)
      try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 30))) } catch { }
      setOnline(true)
    }).catch(() => {
      setDocs(loadLocal())
      setOnline(false)
    })
    const onSel = () => {
      saveSelection()
      rememberTable()
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
        return
      }
      if (e.key === 'Escape') {
        markSelImg(null)
        setFull(false)
      }
    }
    const backupDirty = () => { if (latestRef.current.dirty) stashDraft() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!latestRef.current.dirty) return
      stashDraft()
      e.preventDefault()
      e.returnValue = ''
    }
    const onScrollResize = () => { placeHandle(); placeTblOverlay() }
    document.addEventListener('selectionchange', onSel)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pagehide', backupDirty)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('scroll', updateCurPage, { passive: true })
    window.addEventListener('scroll', onScrollResize, true)
    // ресайз окна/поворот телефона меняют переносы строк → границы листов надо посчитать заново
    window.addEventListener('resize', onScrollResize)
    window.addEventListener('resize', measureSoon)
    // ширина редактора может меняться и без window.resize (сворачивание сайдбара, масштаб для слабовидящих)
    let ro: ResizeObserver | null = null
    try {
      ro = new ResizeObserver(() => measureSoon())
      if (editRef.current) ro.observe(editRef.current)
    } catch { }
    requestAnimationFrame(() => {
      measurePages()
      try { settleMarkers() } catch { }
      updateCurPage()
      // картинки дорисовываются после вставки — их загрузка меняет высоты, переизмеряем
      try {
        editRef.current?.querySelectorAll('img').forEach(img => {
          const el = img as HTMLImageElement
          if (!(el as any).__mBound) {
            ; (el as any).__mBound = 1
            el.addEventListener('load', measureSoon)
          }
        })
      } catch { }
    })
    return () => {
      backupDirty()
      document.removeEventListener('selectionchange', onSel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pagehide', backupDirty)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('scroll', updateCurPage)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
      window.removeEventListener('resize', measureSoon)
      try { ro?.disconnect() } catch { }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistLocal = (arr: Doc[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 30))) } catch { }
  }

  // черновик: ничего не теряется при кнопке «Новый»
  const stashDraft = () => {
    try {
      const body = packHtmlWithMeta(html())
      if (!hasDocumentContent(body)) return
      if (body.length > 1000000) return // с тяжёлыми картинками черновик не тащим
      const current = latestRef.current
      localStorage.setItem(LS_DRAFT, JSON.stringify({
        title: current.title, body_html: body, page_size: current.pageSize, savedAt: Date.now(),
      }))
      setHasDraft(true)
    } catch { }
  }

  const openDoc = (d: Doc) => {
    if (dirty && !confirm('Открыть другой документ? Несохранённое уедет в черновик и не пропадёт.')) return
    if (dirty) stashDraft()
    setDocsOpen(false)
    setCurrentId(d.id)
    setTitle(d.title)
    markSelImg(null)
    const ps = (d as any).page_size
    if (ps && PAGE_SIZES[ps]) { setPageSize(ps); try { localStorage.setItem(LS_PAGE, ps) } catch { } }
    if (editRef.current) editRef.current.innerHTML = sanitize(unpackHtmlMeta(d.body_html))
    mergeRedundantBreaks(true)
    try { measurePages(); settleMarkers() } catch { }
    setDirty(false)
    refreshCounts()
    measureSoon()
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => sheetScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  const newDoc = () => {
    // как у слайдов/досок: «Новый» ничего не удаляет — только спрашивает при несохранённом
    if (dirty && !confirm('Создать новый документ? Текущий не удалится — несохранённое уедет в черновик.')) return
    if (dirty) stashDraft()
    setDocsOpen(false)
    setCurrentId(null)
    setTitle('Новый документ')
    markSelImg(null)
    setPageBorder('none'); setWatermark(''); setColumns(1); setOrientation('portrait')
    setMarginMode('normal'); setPaperTint('white'); setHeaderText(''); setFooterText(''); setShowPageNums(true)
    if (editRef.current) editRef.current.innerHTML = '<p>Начни писать здесь…</p>'
    setDirty(false)
    refreshCounts()
    measureSoon()
    editRef.current?.focus()
  }

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(LS_DRAFT)
      if (!raw) return
      const d = JSON.parse(raw)
      setDocsOpen(false)
      setCurrentId(null)
      setTitle(d.title || 'Черновик')
      if (d.page_size && PAGE_SIZES[d.page_size]) setPageSize(d.page_size)
      if (editRef.current) editRef.current.innerHTML = sanitize(unpackHtmlMeta(d.body_html || ''))
      mergeRedundantBreaks(true)
      try { measurePages(); settleMarkers() } catch { }
      setDirty(true)
      refreshCounts()
      measureSoon()
    } catch { }
  }

  const save = async () => {
    const body = packHtmlWithMeta(html())
    if (!hasDocumentContent(body)) { alert('Пустой документ'); return }
    if (body.length > 2000000) { alert('Документ слишком большой для сервера — убери часть картинок'); return }
    setBusy(true)
    try {
      if (typeof currentId === 'number') {
        const r = await client.patch(`/word-docs/${currentId}/`, { title: title.slice(0, 300), body_html: body, page_size: pageSize })
        setDocs(ns => { const n = ns.map(d => d.id === currentId ? { ...r.data } : d); persistLocal(n); return n })
      } else {
        const r = await client.post('/word-docs/', { title: title.slice(0, 300), body_html: body, page_size: pageSize })
        setCurrentId(r.data.id)
        setDocs(ns => { const n = [{ ...r.data }, ...ns.filter(d => d.id !== currentId)]; persistLocal(n); return n })
      }
      setDirty(false)
      try { localStorage.removeItem(LS_DRAFT) } catch { }
      setHasDraft(false)
      toast('Документ сохранён', 'success')
    } catch {
      // офлайн — только локально
      const local: Doc = {
        id: typeof currentId === 'string' ? currentId : `local-${Date.now()}`,
        title: title.slice(0, 300), body_html: body, _local: true,
      }
      setCurrentId(local.id)
      setDocs(ns => { const n = [local, ...ns.filter(d => d.id !== local.id)]; persistLocal(n); return n })
      setOnline(false)
      setDirty(false)
      toast('Сервер недоступен: документ сохранён на этом устройстве', 'info')
    } finally { setBusy(false) }
  }
  saveRef.current = save

  const remove = async (id: number | string) => {
    if (!confirm('Удалить документ?')) return
    setDocs(ns => { const n = ns.filter(d => d.id !== id); persistLocal(n); return n })
    if (currentId === id) newDoc()
    if (typeof id === 'number') { try { await client.delete(`/word-docs/${id}/`) } catch { } }
  }

  const onImport = async (e: any) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/\.docx$/i.test(file.name)) { alert('Нужен именно .docx (старый .doc сохрани как .docx в Word)'); return }
    if (file.size > MAX_IMPORT) { alert(`Файл ${(file.size / 1024 / 1024).toFixed(1)}МБ больше лимита 20МБ`); return }
    if (file.size === 0) { alert('Пустой файл'); return }
    setBusy(true)
    try {
      // 1) пробуем бэк — он точнее (заголовки, списки, таблицы)
      const fd = new FormData()
      fd.append('file', file)
      const r = await client.post('/word-docs/import/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setTitle(String(r.data.title || file.name.replace(/\.docx$/i, '').slice(0, 200)))
      if (editRef.current) editRef.current.innerHTML = sanitize(r.data.body_html)
      mergeRedundantBreaks(true)
      try { measurePages(); settleMarkers() } catch { }
      setCurrentId(null)
      setDirty(true)
      refreshCounts()
      const s = r.data.stats || {}
      alert(`Импортировано: абзацев ${s.paragraphs ?? '?'}, таблиц ${s.tables ?? 0}`)
    } catch (err: any) {
      // 2) офлайн-фолбэк через mammoth прямо в браузере
      try {
        const mod: any = await import('mammoth')
        const buf = await file.arrayBuffer()
        const out = await mod.convertToHtml({ arrayBuffer: buf })
        setTitle(file.name.replace(/\.docx$/i, '').slice(0, 200))
        if (editRef.current) editRef.current.innerHTML = sanitize(out.value || '<p>Не получилось прочитать</p>')
        setCurrentId(null)
        setDirty(true)
        refreshCounts()
        setOnline(false)
      } catch {
        alert(err.response?.data?.error || 'Не получилось импортировать')
      }
    } finally { setBusy(false) }
  }

  const onExport = async () => {
    const body = sanitize(html())
    if (!hasDocumentContent(body)) { alert('Пустой документ'); return }
    setBusy(true)
    try {
      const r = await client.post('/word-docs/export/', { title, body_html: body, page_size: pageSize }, { responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(title || 'document').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'document'}.docx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      toast('Файл .docx скачан', 'success')
    } catch {
      // офлайн — скачиваем HTML
      const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${sanitize(body)}</body></html>`], { type: 'text/html' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(title || 'document').slice(0, 80)}.html`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      toast('Сервер недоступен: скачан HTML, который можно открыть в Word', 'info')
    } finally { setBusy(false) }
  }

  const onImage = (e: any) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Нужна картинка'); return }
    if (file.size > 2 * 1024 * 1024) { alert('Картинка больше 2МБ — сожми её, иначе документ не сохранится'); return }
    restoreSelection()
    const rd = new FileReader()
    rd.onload = () => {
      restoreSelection()
      try {
        document.execCommand('insertImage', false, String(rd.result))
        // новую картинку делаем на всю ширину листа
        const imgs = editRef.current?.querySelectorAll('img:not([data-sized])')
        imgs?.forEach(im => {
          const el = im as HTMLImageElement
          el.style.width = '100%'
          el.style.height = 'auto'
          el.draggable = true
          el.setAttribute('data-sized', '1')
        })
      } catch { }
      saveSelection()
      setDirty(true)
      measureSoon()
    }
    rd.readAsDataURL(file)
  }

  const insertLink = () => {
    const sel = window.getSelection()?.toString() || ''
    const rawUrl = prompt('Ссылка (https://…)?', 'https://')
    if (!rawUrl) return
    let parsed: URL
    try {
      parsed = new URL(rawUrl.trim())
    } catch {
      alert('Некорректный адрес ссылки')
      return
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      alert('Ссылка должна начинаться с http:// или https://')
      return
    }
    const safeUrl = parsed.href
    restoreSelection()
    try {
      if (!sel) document.execCommand('insertHTML', false, `<a href="${escapeHtml(safeUrl)}" rel="noopener noreferrer">${escapeHtml(safeUrl)}</a>`)
      else document.execCommand('createLink', false, safeUrl)
    } catch { }
    saveSelection()
    setDirty(true)
  }

  const doPrint = () => {
    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    document.body.appendChild(frame)
    try {
      const d = frame.contentDocument
      if (!d) return
      const marginMm = marginMode === 'narrow' ? '10mm' : marginMode === 'wide' ? '26mm' : '16mm'
      const safeBorderColor = /^#[0-9a-fA-F]{6}$/.test(pageBorderColor) ? pageBorderColor : '#2b579a'
      const safeBorderW = Math.max(1, Math.min(6, Number(pageBorderWidth) || 2))
      const safePageSize = ['A4', 'A5', 'Letter', 'Legal'].includes(pageSize) ? pageSize : 'A4'
      const safeOri = orientation === 'landscape' ? 'landscape' : 'portrait'
      const safeSheetBg = /^#[0-9a-fA-F]{6}$/.test(sheetBg) ? sheetBg : '#ffffff'
      const pBorderCss =
        pageBorder === 'none' ? '' :
        pageBorder === 'double' ? `border:${Math.max(4, safeBorderW + 2)}px double ${safeBorderColor};` :
        pageBorder === 'dashed' ? `border:${safeBorderW}px dashed ${safeBorderColor};` :
        pageBorder === 'shadow' ? `border:${safeBorderW}px solid ${safeBorderColor};box-shadow:4px 4px 0 ${safeBorderColor}44;` :
        pageBorder === 'gold' ? `border:6px double ${safeBorderColor};outline:2px solid ${safeBorderColor};outline-offset:-10px;` :
        `border:${safeBorderW}px solid ${safeBorderColor};`
      d.open()
      d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:${safePageSize} ${safeOri};margin:${marginMm}}body{font-family:Georgia,'Times New Roman',serif;line-height:1.65;color:#111;background:${safeSheetBg};${pBorderCss ? `padding:18px;min-height:92vh;box-sizing:border-box;${pBorderCss}` : ''}}header{font-size:11px;color:#64748b;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-bottom:14px}footer{font-size:11px;color:#64748b;border-top:1px solid #cbd5e1;padding-top:6px;margin-top:20px;text-align:center}.content{${columns === 2 ? 'column-count:2;column-gap:28px;column-rule:1px solid #cbd5e1;' : ''}}.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:68px;font-weight:900;color:#64748b;opacity:0.12;transform:rotate(-32deg);pointer-events:none;z-index:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #666;padding:6px}img{max-width:100%}blockquote{border-left:4px solid #2b579a;padding-left:12px;color:#475569;font-style:italic}</style></head><body>${watermark.trim() ? `<div class="wm">${escapeHtml(watermark)}</div>` : ''}${headerText.trim() ? `<header>${escapeHtml(headerText)}</header>` : ''}<div class="content">${sanitize(html())}</div>${footerText.trim() ? `<footer>${escapeHtml(footerText)}</footer>` : ''}</body></html>`)
      d.close()
      const w = frame.contentWindow
      if (w) { w.focus(); w.print() }
    } finally { setTimeout(() => frame.remove(), 2000) }
  }

  const pickPage = (p: string) => {
    if (!PAGE_SIZES[p]) return
    setPageSize(p)
    try { localStorage.setItem(LS_PAGE, p) } catch { }
    setDirty(true)
    requestAnimationFrame(() => { measurePages(); updateCurPage() })
  }

  const basePage = PAGE_SIZES[pageSize] || PAGE_SIZES.A4
  const page = orientation === 'landscape'
    ? { label: basePage.label, maxW: Math.round(basePage.pageH * 0.98), pageH: Math.round(basePage.maxW * 0.92) }
    : basePage
  const pageHRef = useRef(page.pageH)
  pageHRef.current = page.pageH
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // ── Пагинация «как в Word»: листы обрываются на стыках абзацев, а не режут строки ──
  // Измеряем реальные границы блоков и выбираем точки разрыва в естественных зазорах.
  const measurePages = () => {
    try {
      const ed = editRef.current
      const w = wrapRef.current
      if (!ed || !w) return
      const ph = pageHRef.current
      const pageVH = ph + SHEET_PAD * 2
      const wRect = w.getBoundingClientRect()
      const edRect = ed.getBoundingClientRect()
      const relY = (v: number) => v - wRect.top
      // центры естественных зазоров между верхнеуровневыми блоками
      const gaps: Array<{ mid: number; space: number; forced?: boolean }> = []
      let prevBottom = relY(edRect.top)
      let lastRealBottom = relY(edRect.top)
      for (const k of Array.from(ed.children)) {
        const el = k as HTMLElement
        const r = el.getBoundingClientRect()
        if (el.classList?.contains('page-break')) {
          // явный разрыв страницы: КАЖДЫЙ маркер — своя жёсткая граница (даже если маркеры подряд)
          const s = relY(r.top) - prevBottom
          gaps.push({ mid: prevBottom + Math.max(s, 3) / 2, space: Math.max(s, 3), forced: true })
          prevBottom = relY(r.bottom)
          continue
        }
        if (r.height <= 0) continue
        const space = relY(r.top) - prevBottom
        if (space >= 8) gaps.push({ mid: prevBottom + space / 2, space })
        prevBottom = relY(r.bottom)
        lastRealBottom = Math.max(lastRealBottom, relY(r.bottom))
      }
      // конец контента — по последнему реальному блоку (у ed minHeight, поэтому edRect.bottom не годится)
      const contentEnd = Math.max(lastRealBottom + SHEET_PAD, lastRealBottom + 40)
      // первая страница начинается сверху; последующие — где идеально проходит pageH.
      const tops: Array<{ top: number; slot: number }> = [{ top: 0, slot: 12 }]
      const MIN = 260                // минимальная высота естественного листа
      const TAIL_MIN = pageVH * 0.3  // после естественного разреза должно оставаться столько контента
      const markers = gaps.filter(g => g.forced)
      const hardBounds: number[] = [] // границы, поставленные маркерами: естественные разрезы, их пересекающие, — вне игры
      let scanIdx = -1 // индекс последнего ПОТРЕБЛЁННОГО маркера — маркер расходуется, только когда граница ставится по нему
      for (let guard = 0; guard < 60; guard++) {
        const from = tops[tops.length - 1].top
        const target = from + pageVH
        // ближайший неиспользованный маркер по порядку документа (не «сжигаем» его, пока он проигрывает natural)
        let marker: { mid: number; space: number } | null = null
        let markerIdx = -1
        for (let i = scanIdx + 1; i < markers.length; i++) {
          if (markers[i].mid < contentEnd - 4 && markers[i].mid > from) { marker = markers[i]; markerIdx = i; break }
        }
        // естественная граница, ближайшая к цели pageH
        let best: { mid: number; space: number } | null = null
        let bestD = Infinity
        for (const g of gaps) {
          if (g.forced) continue
          if (g.mid <= from + MIN || g.mid >= contentEnd - TAIL_MIN) continue
          // разрез, пересекающий жёсткую границу маркера (пустая зона «разрыва + сдвиг хвоста»), не делим
          if (hardBounds.some(b => g.mid - g.space / 2 < b && b < g.mid + g.space / 2)) continue
          const d = Math.abs(g.mid - target)
          if (d < bestD) { bestD = d; best = g }
        }
        if (marker && (!best || best.mid >= marker.mid - 0.5)) {
          scanIdx = markerIdx // маркер решил границу — потребляем
          // Разрыв страницы = новый лист ПОЛНОЙ высоты, как в Word: предыдущий лист
          // остаётся полным (пустое место под текстом), хвост начинается с нового листа.
          // +10 к маркеру — гарантированный свободный зазор, чтобы маска стыка не резала текст.
          const bound = Math.max(marker.mid + 10, from + pageVH)
          hardBounds.push(bound)
          tops.push({ top: bound, slot: Math.max(marker.space, 20) })
          continue
        }
        if (best) { tops.push({ top: best.mid, slot: best.space }); continue }
        break
      }
      // Каждый лист — полного размера (А4/А5/А3), включая последний: страница
      // не сжимается под содержимое, как и в настоящем Word.
      const bottom = Math.max(contentEnd, tops[tops.length - 1].top + pageVH)
      const prev = layoutRef.current
      const same =
        prev.bottom === bottom &&
        prev.tops.length === tops.length &&
        prev.tops.every((t, i) => t.top === tops[i].top && t.slot === tops[i].slot)
      const nl = { tops, bottom }
      layoutRef.current = nl
      if (!same) setLayout(nl)
    } catch { }
  }
  const measureTimer = useRef<number | undefined>(undefined)
  const measureSoon = () => {
    window.clearTimeout(measureTimer.current)
    measureTimer.current = window.setTimeout(() => { measurePages(); try { settleMarkers() } catch { }; updateCurPage() }, 90)
  }

  const updateCurPage = () => {
    try {
      const w = wrapRef.current
      if (!w) return
      const tops = layoutRef.current.tops
      const viewY = w.getBoundingClientRect().top + SHEET_VIEW_OFFSET
      let n = 1
      for (let i = 1; i < tops.length; i++) {
        if (w.getBoundingClientRect().top + tops[i].top <= viewY) n = i + 1
        else break
      }
      setCurPage(prev => (n === prev ? prev : n))
    } catch { }
  }

  // при смене размера/формата/полного экрана/масштаба для слабовидящих — переизмерить
  useEffect(() => {
    requestAnimationFrame(() => { measurePages(); try { settleMarkers() } catch { }; updateCurPage() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, full, poor])

  // хвост после каждого маркера относим на лист, следующий за маркером (Word-reflow):
  // первый блок за разрывом обязан начинаться на новом листе
  const settleMarkers = () => {
    try {
      const wr = wrapRef.current
      const ed = editRef.current
      if (!wr || !ed) return
      const pbs = Array.from(ed.querySelectorAll('.page-break')) as HTMLElement[]
      for (let pass = 0; pass < 2; pass++) {
        for (const pb of pbs) { // порядок документа — маркеры обрабатываются по очереди
          const tops = layoutRef.current.tops
          if (tops.length < 2) return
          const rel = pb.getBoundingClientRect().top - wr.getBoundingClientRect().top
          // лист, на который уходит хвост: первая граница, лежащая не выше маркера
          let target = tops[tops.length - 1].top
          for (const t of tops) { if (t.top > rel - 24) { target = t.top; break } }
          const after = pb.nextElementSibling as HTMLElement | null
          if (!after || after.classList?.contains('page-break')) continue
          for (let fix = 0; fix < 3; fix++) {
            const cur = after.getBoundingClientRect().top - wr.getBoundingClientRect().top
            const curMt = parseFloat(after.style.marginTop || '0') || 0
            const delta = target + SHEET_PAD + 12 - cur
            // выравниваем в ОБЕ стороны: после удаления текста выше хвост подтягиваем
            // обратно наверх своего листа, после дописывания — опускаем на новый лист
            if (Math.abs(delta) <= 1) break
            if (delta < 0 && curMt <= 0) break // естественный переполненный поток — не трогаем
            after.style.marginTop = `${Math.max(0, Math.round(curMt + delta))}px`
            measurePages()
          }
        }
      }
    } catch { }
  }

  // Подряд идущие разрывы страницы без контента между ними схлопываем в один —
  // иначе измеритель создаёт серию крошечных/пустых листов, и низ редактора
  // выглядит как гигантская белая пустота. Свежий маркер (data-fresh) не трогаем:
  // пользователь только что нажал «Разрыв» и ждёт новый лист.
  const mergeRedundantBreaks = (resetMargins = false) => {
    try {
      const ed = editRef.current
      if (!ed) return
      const kids = Array.from(ed.children) as HTMLElement[]
      const hasReal = (el: HTMLElement) => !!el.querySelector('img,table') || (el.textContent || '').trim().length > 0
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i]
        if (!el.classList.contains('page-break') || el.dataset.fresh === '1') continue
        let hasFurtherMarker = false
        let realBetween = false
        for (let j = i + 1; j < kids.length; j++) {
          const k = kids[j]
          if (k.classList.contains('page-break')) { hasFurtherMarker = true; break }
          if (hasReal(k)) { realBetween = true; break }
        }
        if (hasFurtherMarker && !realBetween) el.remove()
      }
      if (resetMargins) {
        // Старые сдвиги (marginTop от прошлой пагинации) сбрасываем —
        // settleMarkers расставит их заново по актуальным границам листов.
        let afterBreak = false
        for (const el of kids) {
          if (el.classList.contains('page-break')) { afterBreak = true; continue }
          if (afterBreak && el.style.marginTop) el.style.marginTop = ''
        }
      }
    } catch { }
  }

  // разрыв страницы в позиции каретки (лента) / в конце (кн. «+ Лист»):
  // строится вручную через DOM — execCommand в ряде состояний каретки молча не вставляет ничего
  const insertPageBreak = () => {
    const ed = editRef.current
    if (!ed) return
    const mk = document.createElement('div')
    mk.className = 'page-break'
    mk.setAttribute('contenteditable', 'false')
    mk.setAttribute('aria-hidden', 'true')
    mk.setAttribute('data-fresh', '1')
    window.setTimeout(() => { try { delete mk.dataset.fresh } catch { } }, 1500)
    const blank = document.createElement('p')
    blank.appendChild(document.createElement('br'))
    try {
      ed.focus()
      let r0: Range | null = null
      const sel = window.getSelection()
      try {
        if (savedRange.current && ed.contains(savedRange.current.startContainer)) {
          sel?.removeAllRanges()
          sel?.addRange(savedRange.current)
        }
        if (sel && sel.rangeCount > 0 && ed.contains(sel.getRangeAt(0).startContainer)) r0 = sel.getRangeAt(0).cloneRange()
      } catch { }
      // верхнеуровневый блок ed, содержащий каретку
      let anchor: HTMLElement | null = null
      if (r0) {
        let n: Node | null = r0.startContainer
        while (n && n !== ed && (n as HTMLElement).parentElement !== ed) n = n.parentElement
        if (n && n !== ed && (n as HTMLElement).parentElement === ed) anchor = n as HTMLElement
      }
      let caretTo: HTMLElement = blank
      if (!anchor) {
        // каретка вне редактора/не помечена — разрыв в конец документа (+ Лист)
        ed.appendChild(mk)
        ed.appendChild(blank)
      } else {
        // каретка в начале блока? — маркер ставится целиком перед блоком
        let atStart = false
        try {
          const probe = document.createRange()
          probe.setStart(anchor, 0)
          probe.setEnd(r0!.startContainer, r0!.startOffset)
          atStart = (probe.toString() || '').trim() === ''
        } catch { }
        if (atStart) {
          ed.insertBefore(mk, anchor)
          caretTo = anchor // блок уходит на новый лист, каретка на нём же
        } else {
          // каретка внутри текста — Word-splitting: всё после каретки переезжает на новый лист
          const right = document.createRange()
          right.selectNodeContents(anchor)
          try { right.setStart(r0!.startContainer, r0!.startOffset) } catch { }
          const frag = right.extractContents()
          ed.insertBefore(mk, anchor.nextSibling)
          let rightBlock: HTMLElement | null = null
          if (frag.hasChildNodes() && (frag.textContent || '').trim()) {
            rightBlock = document.createElement(anchor.tagName.toLowerCase() === 'li' ? 'p' : anchor.tagName)
            rightBlock.appendChild(frag)
            ed.insertBefore(rightBlock, mk.nextSibling)
          } else {
            ed.insertBefore(blank, mk.nextSibling)
          }
          caretTo = rightBlock || blank
        }
      }
      // каретка — в начало блока на новом листе
      const r = document.createRange()
      r.selectNodeContents(caretTo)
      r.collapse(true)
      const sel2 = window.getSelection()
      sel2?.removeAllRanges()
      sel2?.addRange(r)
      ed.focus()
      saveSelection()
    } catch {
      try { ed.appendChild(mk) } catch { }
      try { ed.appendChild(blank) } catch { }
    }
    saveSelection()
    setDirty(true)
    refreshCounts()
    try { measurePages(); settleMarkers() } catch { }
    requestAnimationFrame(() => { measurePages(); updateCurPage() })
  }

  // клик по пустому полю листа — каретка в конец, всегда можно писать
  const focusEnd = () => {
    const ed = editRef.current
    if (!ed) return
    ed.focus()
    try {
      const range = document.createRange()
      range.selectNodeContents(ed)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      saveSelection()
    } catch { }
  }

  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])

  // ── Лента: как Word — иконки в группах с подписями, разделители групп ──
  // rbBtn(on) — кнопка-иконка; вкл. состояние подсвечено как в Word
  const rbBtn = (on: boolean) =>
    `h-11 w-11 sm:h-9 sm:w-9 shrink-0 rounded-lg border flex items-center justify-center ${on
      ? 'bg-indigo-600 text-white border-indigo-600'
      : `bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-600`}`

  const sheetBg = paperTint === 'cream' ? '#fffdf5' : paperTint === 'sepia' ? '#f8f1e3' : '#ffffff'
  const sheetPadPx = marginMode === 'narrow' ? 20 : marginMode === 'wide' ? 64 : 40

  return (
    <div className="word-editor max-w-7xl mx-auto space-y-3 page-enter">
      {/* 1. ФИРМЕННАЯ ШАПКА MICROSOFT WORD — синяя панель быстрого доступа (Сохранить всегда видно!) */}
      <div className="bg-[#2b579a] dark:bg-[#1b3a6e] text-white rounded-2xl px-2.5 sm:px-3.5 py-2 shadow-lg flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-white text-[#2b579a] font-black text-base flex items-center justify-center shadow-xs">W</span>
          <button
            type="button"
            onClick={() => setDocsOpen(v => !v)}
            aria-expanded={docsOpen}
            data-testid="word-docs-btn"
            className="px-2.5 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition"
            title="Мои документы / Шаблоны / Импорт .docx"
          >
            <FolderOpen size={15} />
            <span className="hidden sm:inline">Документы</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/25 text-[10px] font-mono">{docs.length}</span>
          </button>
        </div>

        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setDirty(true) }}
          aria-label="Название документа"
          placeholder="Название документа"
          className="flex-1 min-w-[120px] px-3 h-9 rounded-lg bg-white/15 hover:bg-white/20 focus:bg-white focus:text-slate-900 text-white placeholder-white/70 font-bold text-xs sm:text-sm outline-none transition"
        />

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          <button type="button" onMouseDown={keepFocus} onClick={() => cmd('undo')} title="Отменить (Ctrl+Z)" className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><Undo2 size={15} /></button>
          <button type="button" onMouseDown={keepFocus} onClick={() => cmd('redo')} title="Вернуть (Ctrl+Y)" className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><Redo2 size={15} /></button>
          <button type="button" onClick={() => setFindOpen(v => !v)} title="Найти и заменить (Ctrl+F)" className={`h-9 w-9 rounded-lg flex items-center justify-center ${findOpen ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20'}`}><Search size={15} /></button>
          <button type="button" onClick={onExport} disabled={busy} title="Скачать как .docx" className="hidden sm:flex px-2.5 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold items-center gap-1 disabled:opacity-50"><Download size={14} /> .docx</button>
          <button type="button" onClick={doPrint} title="Печать / Сохранить в PDF" className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><Printer size={15} /></button>
          <button type="button" onClick={() => setFull(f => !f)} title={full ? 'Выйти из полного экрана' : 'Во весь экран'} className="hidden sm:flex h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center">{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            title={t('save')}
            data-testid="word-save-btn"
            className="flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm shrink-0 disabled:opacity-50 shadow-md"
          >
            <Save size={15} /> <span>{busy ? '…' : t('save')}</span>
            {dirty && <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* Скрытые файловые инпуты */}
      <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={onImport} />

      <div className="flex flex-col lg:flex-row gap-3">
        {/* Раскрывающаяся панель «Мои документы» (не сжимает лист, когда свернута!) */}
        {docsOpen && (
          <aside className="lg:w-64 shrink-0 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-3 h-fit shadow-lg space-y-2" aria-label="Мои документы">
            <div className="flex items-center justify-between pb-1 border-b dark:border-slate-700">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Мои документы ({docs.length})</span>
              <button type="button" onClick={() => setDocsOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300"><X size={14} /></button>
            </div>
            <button onClick={() => { newDoc(); setDocsOpen(false) }} className="w-full px-3 py-2 rounded-xl bg-[#2b579a] hover:bg-[#1f447d] text-white font-bold text-xs flex items-center justify-center gap-1.5">
              <Plus size={15} /> {WUI.newBtn} документ
            </button>
            {hasDraft && (
              <button onClick={() => { restoreDraft(); setDocsOpen(false) }} className="w-full px-3 py-2 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold">
                {t('board_draft_chip')} • ↺
              </button>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-2 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                <Upload size={13} /> {WUI.imp} .docx
              </button>
              <button onClick={onExport} disabled={busy} className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                <Download size={13} /> {WUI.dl}
              </button>
            </div>
            <div className="space-y-1 max-h-48 lg:max-h-[50vh] overflow-auto">
              {docs.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Пока нет сохранённых файлов</div>}
              {docs.map(d => (
                <div key={d.id} className={`group flex items-center gap-2 px-2 py-2 rounded-xl text-xs ${currentId === d.id ? 'bg-blue-50 dark:bg-blue-900/30 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                  <button onClick={() => { openDoc(d); setDocsOpen(false) }} className="flex-1 flex items-center gap-2 min-w-0 text-left dark:text-white" title={d.title}>
                    <FileText size={14} className="shrink-0 text-[#2b579a] dark:text-blue-400" />
                    <span className="truncate">{d.title}{dirty && currentId === d.id ? ' •' : ''}</span>
                  </button>
                  <button onClick={() => remove(d.id)} aria-label={`Удалить ${d.title}`} className="p-1 rounded-lg opacity-70 hover:opacity-100 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* редактор */}
        <div ref={sheetScrollRef} onScroll={updateCurPage} className={`flex-1 min-w-0 space-y-2.5 pb-28 lg:pb-0 scroll-mt-20 ${full ? 'fixed inset-0 z-50 overflow-auto overscroll-contain bg-slate-100 dark:bg-slate-950 p-3 sm:p-5' : ''}`}>
          {full && (
            <div className="flex items-center justify-between gap-2 bg-[#2b579a] text-white px-3 py-2 rounded-xl">
              <span className="font-bold text-sm truncate">{title}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={save} className="px-3 py-1.5 rounded-lg bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1"><Save size={14} /> {t('save')}</button>
                <button type="button" onClick={() => setFull(false)} className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1"><Minimize2 size={14} /> Выйти</button>
              </div>
            </div>
          )}

          {/* Панель «Найти и заменить» (Ctrl+F) */}
          {findOpen && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-[#2b579a]/50 p-2.5 flex flex-wrap items-center gap-2 shadow-md">
              <Search size={15} className="text-[#2b579a] dark:text-blue-400 shrink-0 ml-1" />
              <input
                value={findQuery}
                onChange={e => setFindQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && findNext()}
                placeholder="Найти в тексте…"
                className="flex-1 min-w-[140px] px-2.5 h-8 rounded-lg border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs outline-none"
              />
              <input
                value={replaceQuery}
                onChange={e => setReplaceQuery(e.target.value)}
                placeholder="Заменить на…"
                className="flex-1 min-w-[140px] px-2.5 h-8 rounded-lg border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs outline-none"
              />
              <button type="button" onClick={findNext} className="px-3 h-8 rounded-lg bg-[#2b579a] text-white text-xs font-bold">Найти</button>
              <button type="button" onClick={replaceAll} className="px-3 h-8 rounded-lg bg-emerald-600 text-white text-xs font-bold">Заменить всё</button>
              <button type="button" onClick={() => setFindOpen(false)} className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center justify-center"><X size={14} /></button>
            </div>
          )}

          {/* Лента как в настоящем Microsoft Word: Главная | Вставка | Макет | Вид + контекстные Картинка/Таблица */}
          {poor ? (
            <div role="toolbar" aria-label="Простые инструменты" className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-2">
              <button onMouseDown={keepFocus} onClick={() => cmd('bold')} aria-pressed={!!active.bold} title="Жирный (Ctrl+B)" aria-label="Жирный" className={`h-11 min-w-[52px] px-3 rounded-xl border text-lg font-bold ${!!active.bold ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Ж</button>
              <button onMouseDown={keepFocus} onClick={() => cmd('italic')} aria-pressed={!!active.italic} title="Курсив (Ctrl+I)" aria-label="Курсив" className={`h-11 min-w-[52px] px-3 rounded-xl border text-lg italic ${!!active.italic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>К</button>
              <button onMouseDown={keepFocus} onClick={() => cmd('underline')} aria-pressed={!!active.underline} title="Подчёркнутый (Ctrl+U)" aria-label="Подчёркнутый" className={`h-11 min-w-[52px] px-3 rounded-xl border text-lg underline ${!!active.underline ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Ч</button>
              <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />
              <select onChange={e => { setFontSizePt(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Размер шрифта" aria-label="Размер шрифта"
                className="h-11 px-2 rounded-xl border bg-white dark:bg-slate-700 dark:text-white text-base cursor-pointer">
                <option value="">Крупность</option>
                {FONT_SIZES.map(s => <option key={s.pt} value={s.pt}>{s.label}</option>)}
              </select>
              <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />
              <button onMouseDown={keepFocus} onClick={() => cmd('insertUnorderedList')} aria-pressed={!!active.insertUnorderedList} title="Список с точками" aria-label="Маркированный список"
                className={`h-11 min-w-[48px] px-3 rounded-xl border ${!!active.insertUnorderedList ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><List size={18} /></button>
              <button onMouseDown={keepFocus} onClick={() => cmd('insertOrderedList')} aria-pressed={!!active.insertOrderedList} title="Список с номерами" aria-label="Нумерованный список"
                className={`h-11 min-w-[48px] px-3 rounded-xl border ${!!active.insertOrderedList ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><ListOrdered size={18} /></button>
              <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />
              <button onMouseDown={keepFocus} onClick={() => cmd('justifyLeft')} title="Текст слева" aria-label="По левому краю" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={18} /></button>
              <button onMouseDown={keepFocus} onClick={() => cmd('justifyCenter')} title="Текст по центру" aria-label="По центру" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={18} /></button>
              <button onMouseDown={keepFocus} onClick={() => cmd('justifyRight')} title="Текст справа" aria-label="По правому краю" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={18} /></button>
              {selImg && (
                <div role="toolbar" aria-label="Выбранная картинка" className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="px-1 text-sm font-bold dark:text-white">Картинка:</span>
                  <button onClick={imgFree} className={`h-11 px-3 rounded-xl border text-sm font-bold ${isFree(selImg) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Свободно</button>
                  <button onClick={imgInline} className={`h-11 px-3 rounded-xl border text-sm font-bold ${!isFree(selImg) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>В текст</button>
                  {[25, 50, 100].map(p => (
                    <button key={p} onClick={() => imgSetWidth(p)} className={`h-11 w-16 rounded-xl border text-sm font-bold ${imgW === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>{p}%</button>
                  ))}
                  <button onClick={() => imgAlign('left')} className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={18} /></button>
                  <button onClick={() => imgAlign('center')} className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={18} /></button>
                  <button onClick={() => imgAlign('right')} className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={18} /></button>
                  <button onClick={imgDelete} className="h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold ml-auto">Удалить</button>
                </div>
              )}
              {inTable && !selImg && (
                <div role="toolbar" aria-label="Выбранная таблица" className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="px-1 text-sm font-bold dark:text-white">Таблица:</span>
                  <button onMouseDown={keepFocus} onClick={tableAddRow} className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">+ Строка</button>
                  <button onMouseDown={keepFocus} onClick={tableDelRow} className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">− Строка</button>
                  <button onMouseDown={keepFocus} onClick={tableAddCol} className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">+ Столбец</button>
                  <button onMouseDown={keepFocus} onClick={tableDelCol} className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">− Столбец</button>
                  <button onMouseDown={keepFocus} onClick={tableDelete} className="h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold ml-auto">Удалить</button>
                </div>
              )}
            </div>
          ) : (
            <div className="word-ribbon bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-visible shadow-sm">
              {/* табы ленты */}
              <div role="tablist" aria-label="Вкладки ленты" className="flex items-center gap-1 px-2 pt-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([
                  ['home', WUI.home],
                  ['insert', WUI.insert],
                  ['layout', 'Макет'],
                  ['view', 'Вид'],
                ] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => { closeAllPopovers(); setTab(k) }}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-t-lg whitespace-nowrap transition ${
                      tab === k
                        ? 'bg-white dark:bg-slate-800 text-[#2b579a] dark:text-blue-300 border border-b-0 border-slate-200 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
                {selImg && (
                  <button role="tab" aria-selected={tab === 'img'} onClick={() => setTab('img')}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-t-lg whitespace-nowrap ${tab === 'img' ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-b-0 border-slate-200 dark:border-slate-700' : 'text-amber-600 dark:text-amber-400'}`}>{WUI.img}</button>
                )}
                {(inTable && !selImg) && (
                  <button role="tab" aria-selected={tab === 'tbl'} onClick={() => setTab('tbl')}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-t-lg whitespace-nowrap ${tab === 'tbl' ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-b-0 border-slate-200 dark:border-slate-700' : 'text-emerald-600 dark:text-emerald-400'}`}>{WUI.tbl}</button>
                )}
                {!online && <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0 mr-1">офлайн</span>}
              </div>

              {/* 1. ГЛАВНАЯ: Шрифт | Абзац | Экспресс-стили Word */}
              {tab === 'home' && (
                <div role="toolbar" aria-label="Главная" className="flex flex-nowrap items-stretch gap-0 p-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <RibbonGroup label="Шрифт">
                    <select onChange={e => { setFontFamily(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Шрифт" aria-label="Шрифт"
                      className="h-9 px-2 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-xs sm:text-sm max-w-[125px] cursor-pointer">
                      <option value="">Шрифт</option>
                      {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
                    </select>
                    <select onChange={e => { if (e.target.value) { setCurFontPt(Number(e.target.value)); setFontSizePt(e.target.value) } e.currentTarget.selectedIndex = 0 }} title="Размер шрифта (кегль, пункты)" aria-label="Размер шрифта"
                      className="h-9 w-[66px] shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-xs sm:text-sm cursor-pointer">
                      <option value="">{curFontPt}pt</option>
                      {FONT_SIZES.map(s => <option key={s.pt} value={s.pt}>{s.label}</option>)}
                    </select>
                    <button onMouseDown={keepFocus} onClick={() => stepFontSize(1)} title="Увеличить шрифт" className={rbBtn(false)}><span className="text-xs font-black">A+</span></button>
                    <button onMouseDown={keepFocus} onClick={() => stepFontSize(-1)} title="Уменьшить шрифт" className={rbBtn(false)}><span className="text-xs font-bold">A−</span></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('bold')} aria-pressed={!!active.bold} title="Жирный (Ctrl+B)" aria-label="Жирный" className={rbBtn(!!active.bold)}><Bold size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('italic')} aria-pressed={!!active.italic} title="Курсив (Ctrl+I)" aria-label="Курсив" className={rbBtn(!!active.italic)}><Italic size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('underline')} aria-pressed={!!active.underline} title="Подчёркнутый (Ctrl+U)" aria-label="Подчёркнутый" className={rbBtn(!!active.underline)}><Underline size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('strikeThrough')} aria-pressed={!!active.strikeThrough} title="Зачёркнутый" aria-label="Зачёркнутый" className={rbBtn(!!active.strikeThrough)}><Strikethrough size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('subscript')} title="Нижний индекс" className={rbBtn(false)}><span className="text-xs font-bold leading-none">x₂</span></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('superscript')} title="Верхний индекс" className={rbBtn(false)}><span className="text-xs font-bold leading-none">x²</span></button>
                    <label className="h-9 w-9 shrink-0 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 dark:text-white cursor-pointer flex flex-col items-center justify-center" title="Цвет текста">
                      <span className="text-xs font-black leading-none">A</span>
                      <span className="block w-4 h-1 rounded-sm bg-red-600 mt-0.5" />
                      <input type="color" className="sr-only" aria-label="Цвет текста" onChange={e => cmd('foreColor', e.target.value)} />
                    </label>
                    <label className="h-9 w-9 shrink-0 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 dark:text-white cursor-pointer flex flex-col items-center justify-center" title="Маркер выделения">
                      <span className="text-xs font-black leading-none">ab</span>
                      <span className="block w-4 h-1 rounded-sm bg-yellow-300 mt-0.5" />
                      <input type="color" defaultValue="#ffff00" className="sr-only" aria-label="Цвет маркера" onChange={e => cmd('hiliteColor', e.target.value)} />
                    </label>
                    <button onMouseDown={keepFocus} onClick={() => cmd('removeFormat')} title="Очистить форматирование" className={rbBtn(false)}><Eraser size={15} /></button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Абзац">
                    <button onMouseDown={keepFocus} onClick={() => cmd('insertUnorderedList')} aria-pressed={!!active.insertUnorderedList} title="Маркированный список" className={rbBtn(!!active.insertUnorderedList)}><List size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('insertOrderedList')} aria-pressed={!!active.insertOrderedList} title="Нумерованный список" className={rbBtn(!!active.insertOrderedList)}><ListOrdered size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={insertChecklist} title="Вставить чек-лист (задачи)" className={rbBtn(false)}><CheckSquare size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('justifyLeft')} title="По левому краю" className={rbBtn(false)}><AlignLeft size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('justifyCenter')} title="По центру" className={rbBtn(false)}><AlignCenter size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('justifyRight')} title="По правому краю" className={rbBtn(false)}><AlignRight size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('justifyFull')} title="По ширине" className={rbBtn(false)}><AlignJustify size={15} /></button>
                    <select onChange={e => { setLineSpacing(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Межстрочный интервал"
                      className="h-9 w-[58px] shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-xs cursor-pointer">
                      <option value="">1.0</option>
                      <option value="1.15">1.15</option>
                      <option value="1.5">1.5</option>
                      <option value="2.0">2.0</option>
                    </select>
                    <button onMouseDown={keepFocus} onClick={() => cmd('indent')} title="Увеличить отступ" className={rbBtn(false)}><IndentIncrease size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('outdent')} title="Уменьшить отступ" className={rbBtn(false)}><IndentDecrease size={15} /></button>
                    <button onMouseDown={keepFocus} onClick={toggleParaBorder} title="Рамка вокруг текущего абзаца" className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap hover:bg-blue-50 dark:hover:bg-slate-600" data-testid="word-para-border"><Square size={13} /> Рамка</button>
                    <button onMouseDown={keepFocus} onClick={cycleTextCase} title="Сменить регистр выделенного (АБВ / абв / С заглавной)" className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-black hover:bg-blue-50 dark:hover:bg-slate-600">Aa</button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Экспресс-стили">
                    <button onMouseDown={keepFocus} onClick={() => cmd('formatBlock', 'p')} className="h-9 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-medium hover:bg-blue-50 dark:hover:bg-slate-600 whitespace-nowrap">Обычный</button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('formatBlock', 'h1')} className="h-9 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 text-[#2b579a] dark:text-blue-300 text-sm font-black hover:bg-blue-50 dark:hover:bg-slate-600 whitespace-nowrap">Заг. 1</button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('formatBlock', 'h2')} className="h-9 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 text-[#2b579a] dark:text-blue-300 text-xs font-extrabold hover:bg-blue-50 dark:hover:bg-slate-600 whitespace-nowrap">Заг. 2</button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('formatBlock', 'h3')} className="h-9 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-blue-50 dark:hover:bg-slate-600 whitespace-nowrap">Заг. 3</button>
                    <button onMouseDown={keepFocus} onClick={() => cmd('formatBlock', 'blockquote')} title="Цитата" className={rbBtn(false)}><Quote size={14} /></button>
                  </RibbonGroup>
                </div>
              )}

              {/* 2. ВСТАВКА: Таблица | Картинка | Рамки и Надписи | Элементы | Формулы/Символы | Шаблоны */}
              {tab === 'insert' && (
                <div role="toolbar" aria-label="Вставка" className="flex flex-nowrap items-stretch gap-0 p-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <RibbonGroup label="Объекты">
                    <button onClick={() => imgRef.current?.click()} title="Вставить картинку (до 2МБ)" className="h-9 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"><ImagePlus size={14} /> Картинка</button>
                    <button onClick={() => togglePopover('tbl')} title="Вставить таблицу" aria-expanded={showTblPicker} data-testid="word-insert-table-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${showTblPicker ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><TableIcon size={14} /> Таблица ▾</button>
                    <button type="button" onMouseDown={keepFocus} onClick={() => togglePopover('frame')} title="Вставить рамку, врезку, карточку или баннер" aria-expanded={showFramePicker} data-testid="word-insert-frame-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${showFramePicker ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><Square size={14} /> Рамка / Блок ▾</button>
                    <button onClick={insertLink} title="Вставить ссылку" className="h-9 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Link2 size={14} /> Ссылка</button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Элементы и формулы">
                    <button onMouseDown={keepFocus} onClick={insertPageBreak} title="Разрыв страницы" className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Scissors size={14} /> Разрыв</button>
                    <button onMouseDown={keepFocus} onClick={() => insertHtmlAtCaret('<hr style="border:none;border-top:2px solid #cbd5e1;margin:14px 0" /><p><br></p>')} title="Горизонтальная линия" className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Minus size={14} /> Линия</button>
                    <button onMouseDown={keepFocus} onClick={() => insertHtmlAtCaret(`<span>${new Date().toLocaleDateString()}</span>`)} title="Вставить текущую дату" className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Calendar size={14} /> Дата</button>
                    <button type="button" onClick={() => togglePopover('formula')} data-testid="word-insert-formula-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold whitespace-nowrap ${showFormulas ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>∑ Формула ▾</button>
                    <button type="button" onClick={() => togglePopover('sym')}
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold whitespace-nowrap ${showSymbols ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Ω Символ ▾</button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Школьные шаблоны">
                    {WORD_TEMPLATES.map(tpl => (
                      <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)} data-testid={`word-tpl-${tpl.id}`} className="h-9 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 text-xs font-bold whitespace-nowrap hover:bg-blue-100">
                        {tpl.label}
                      </button>
                    ))}
                  </RibbonGroup>
                </div>
              )}

              {/* 3. МАКЕТ (Рамка страницы, Водяной знак, Колонки, Ориентация, Поля, Цвет бумаги, Колонтитулы) */}
              {tab === 'layout' && (
                <div role="toolbar" aria-label="Макет" className="flex flex-nowrap items-stretch gap-0 p-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <RibbonGroup label="Оформление листа">
                    <button type="button" onClick={() => togglePopover('pborder')} data-testid="word-page-border-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${showPageBorders || pageBorder !== 'none' ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>
                      <Square size={14} /> Рамка листа ▾
                    </button>
                    <button type="button" onClick={() => togglePopover('wm')} data-testid="word-watermark-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${showWatermark || watermark.trim() ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>
                      <Droplets size={14} /> Водяной знак ▾
                    </button>
                    <button type="button" onClick={() => { setColumns(c => (c === 1 ? 2 : 1)); setDirty(true); measureSoon() }} data-testid="word-columns-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${columns === 2 ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>
                      <Columns2 size={14} /> {columns === 2 ? '2 колонки' : '1 колонка'}
                    </button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Ориентация и размер">
                    <button type="button" onClick={() => { setOrientation('portrait'); setDirty(true); requestAnimationFrame(() => { measurePages(); updateCurPage() }) }} className={`h-9 px-2 rounded-lg border text-xs font-bold whitespace-nowrap ${orientation === 'portrait' ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>📄 Книжная</button>
                    <button type="button" onClick={() => { setOrientation('landscape'); setDirty(true); requestAnimationFrame(() => { measurePages(); updateCurPage() }) }} className={`h-9 px-2 rounded-lg border text-xs font-bold whitespace-nowrap ${orientation === 'landscape' ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>🖼️ Альбомная</button>
                    <select value={pageSize} onChange={e => pickPage(e.target.value)} aria-label="Размер листа"
                      className="h-9 px-2 rounded-lg border bg-white text-slate-900 dark:bg-slate-700 dark:text-white dark:border-slate-600 text-xs font-bold cursor-pointer">
                      {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Поля и бумага">
                    {([['narrow', 'Узкие'], ['normal', 'Обычные'], ['wide', 'Широкие']] as const).map(([m, lbl]) => (
                      <button key={m} type="button" onClick={() => { setMarginMode(m); setDirty(true) }} className={`h-9 px-2 rounded-lg border text-xs font-bold whitespace-nowrap ${marginMode === m ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>{lbl}</button>
                    ))}
                    {([['white', 'Белый', '#ffffff'], ['cream', 'Кремовый', '#fffdf5'], ['sepia', 'Сепия', '#f8f1e3']] as const).map(([k, lbl, col]) => (
                      <button key={k} type="button" onClick={() => { setPaperTint(k); setDirty(true) }} title={`Цвет бумаги: ${lbl}`} className={`h-9 px-2 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${paperTint === k ? 'ring-2 ring-[#2b579a] border-[#2b579a]' : 'dark:border-slate-600'} bg-white dark:bg-slate-700 dark:text-white`}>
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-400" style={{ background: col }} />
                      </button>
                    ))}
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Колонтитулы">
                    <input value={headerText} onChange={e => { setHeaderText(e.target.value); setDirty(true) }} placeholder="Верхний…"
                      className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs w-28" />
                    <input value={footerText} onChange={e => { setFooterText(e.target.value); setDirty(true) }} placeholder="Нижний…"
                      className="h-9 px-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs w-28" />
                    <button type="button" onClick={() => { setShowPageNums(v => !v); setDirty(true) }} className={`h-9 px-2 rounded-lg border text-xs font-bold whitespace-nowrap ${showPageNums ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>
                      № {showPageNums ? 'ВКЛ' : 'ВЫКЛ'}
                    </button>
                  </RibbonGroup>
                </div>
              )}

              {/* 4. ВИД (как в Microsoft Word: Масштаб, Линейка, Оглавление, Фокус-режим) */}
              {tab === 'view' && (
                <div role="toolbar" aria-label="Вид" className="flex flex-nowrap items-stretch gap-0 p-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <RibbonGroup label="Масштаб">
                    {[75, 100, 125].map(z => (
                      <button key={z} type="button" onClick={() => setWordZoom(z)} className={`h-9 px-2.5 rounded-lg border text-xs font-bold ${wordZoom === z ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>{z}%</button>
                    ))}
                    <button type="button" onClick={() => setWordZoom(z => Math.max(65, z - 10))} className={rbBtn(false)}><ZoomOut size={15} /></button>
                    <button type="button" onClick={() => setWordZoom(z => Math.min(150, z + 10))} className={rbBtn(false)}><ZoomIn size={15} /></button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Отображение">
                    <button type="button" onClick={() => setShowRuler(v => !v)} className={`h-9 px-3 rounded-lg border text-xs font-bold whitespace-nowrap ${showRuler ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>📏 Линейка</button>
                    <button type="button" onClick={() => { refreshOutline(); setShowOutline(v => !v) }} className={`h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${showOutline ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><ListTree size={14} /> Оглавление</button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Окно и экспорт">
                    <button type="button" onClick={() => setFull(v => !v)} className="h-9 px-3 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap">{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />} Фокус-режим</button>
                    <button type="button" onClick={doPrint} className="h-9 px-3 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Printer size={14} /> Печать / PDF</button>
                  </RibbonGroup>
                </div>
              )}

              {/* контекстная вкладка Картинка — как «Средства рисования» у Word */}
              {tab === 'img' && selImg && (
                <div role="toolbar" aria-label="Настройки картинки" className="flex flex-nowrap items-stretch gap-0 p-1.5 overflow-x-auto scrollbar-thin">
                  <RibbonGroup label="Режим">
                    <button onClick={imgFree} title="Открепить от текста — таскать мышью"
                      className={`h-9 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isFree(selImg) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}><Move size={13} /> Свободно</button>
                    <button onClick={imgInline} title="Вернуть в текст"
                      className={`h-9 px-2.5 rounded-lg text-xs font-bold ${!isFree(selImg) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>В текст</button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Размер">
                    {[25, 50, 75, 100].map(p => (
                      <button key={p} onClick={() => imgSetWidth(p)} className={`h-9 px-2 rounded-lg text-xs font-bold ${imgW === p && !isFree(selImg) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>{p}%</button>
                    ))}
                    <input type="range" min={isFree(selImg) ? 30 : 10} max={isFree(selImg) ? 1200 : 100} step={isFree(selImg) ? 10 : 5} value={imgW}
                      onChange={e => imgSizeChange(parseInt(e.target.value))} aria-label="Размер картинки" className="w-24 sm:w-32" />
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Положение в тексте">
                    <button onClick={() => imgAlign('left')} title="Слева, текст обтекает" aria-label="Картинка слева" className="h-9 w-9 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={15} /></button>
                    <button onClick={() => imgAlign('center')} title="По центру" aria-label="Картинка по центру" className="h-9 w-9 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={15} /></button>
                    <button onClick={() => imgAlign('right')} title="Справа, текст обтекает" aria-label="Картинка справа" className="h-9 w-9 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={15} /></button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Упорядочение">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden xl:flex items-center">{isFree(selImg) ? 'тяни фото мышью + уголок — размер' : 'уголок у фото — размер'}</span>
                    <button onClick={imgDelete} className="ml-auto h-9 px-3 rounded-lg bg-red-50 text-red-600 font-bold text-xs flex items-center gap-1" title="Удалить картинку" aria-label="Удалить картинку"><X size={14} /> Удалить</button>
                  </RibbonGroup>
                </div>
              )}

              {/* контекстная вкладка Таблица — Конструктор и Макет таблиц Word */}
              {tab === 'tbl' && !selImg && (
                <div role="toolbar" aria-label="Настройки таблицы" className="flex flex-nowrap items-stretch gap-0 p-1.5 overflow-x-auto scrollbar-thin">
                  <RibbonGroup label="Перемещение и размер">
                    <button onMouseDown={keepFocus} onClick={tblFree} data-testid="word-tbl-free" title="Открепить таблицу — можно тащить мышкой в любую точку листа"
                      className={`h-9 px-2 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${tblIsFree ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><Move size={13} /> Свободно</button>
                    <button onMouseDown={keepFocus} onClick={tblInline} title="Вернуть таблицу в поток текста"
                      className={`h-9 px-2 rounded-lg border text-xs font-bold whitespace-nowrap ${!tblIsFree ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>В тексте</button>
                    {[50, 75, 100].map(pct => (
                      <button key={pct} onMouseDown={keepFocus} onClick={() => tblSetWidth(pct)} className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold hover:bg-blue-50 dark:hover:bg-slate-600">{pct}%</button>
                    ))}
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Рамки и дизайн">
                    <button type="button" onMouseDown={keepFocus} onClick={() => togglePopover('tborder')} data-testid="word-tbl-borders-btn"
                      className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 whitespace-nowrap ${showTblBorders ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>
                      <Grid size={13} /> Рамки и стили ▾
                    </button>
                    <button onMouseDown={keepFocus} onClick={() => tblHeader()} title="Первая строка — шапка или обычная" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Шапка</button>
                    <button onMouseDown={keepFocus} onClick={tblToggleZebra} title="Чередование цвета строк (Зебра)" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Зебра</button>
                    <label className="h-9 px-1.5 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 cursor-pointer flex items-center gap-1 text-xs font-bold" title="Фон ячейки">
                      Фон
                      <input type="color" onChange={e => tblCellBg(e.target.value)} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" aria-label="Фон ячейки" />
                    </label>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Строки, столбцы, ячейки">
                    <button onMouseDown={keepFocus} onClick={tableAddRow} title="Добавить строку ниже" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold whitespace-nowrap">+Стр</button>
                    <button onMouseDown={keepFocus} onClick={tableAddCol} title="Добавить столбец справа" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold whitespace-nowrap">+Стб</button>
                    <button onMouseDown={keepFocus} onClick={tableDelRow} title="Удалить строку" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold whitespace-nowrap">−Стр</button>
                    <button onMouseDown={keepFocus} onClick={tableDelCol} title="Удалить столбец" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold whitespace-nowrap">−Стб</button>
                    <button onMouseDown={keepFocus} onClick={tblMergeRight} title="Объединить ячейку с правой" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold whitespace-nowrap">Объед.</button>
                    <button onMouseDown={keepFocus} onClick={tblSplitCell} title="Разделить объединённую ячейку" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold whitespace-nowrap">Разд.</button>
                    <button onMouseDown={keepFocus} onClick={tblSortByCol} title="Сортировать строки А→Я по текущему столбцу" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold flex items-center gap-1 whitespace-nowrap"><ArrowUpDown size={13} /> А→Я</button>
                  </RibbonGroup>
                  <RibbonSep />
                  <RibbonGroup label="Положение">
                    <button onMouseDown={keepFocus} onClick={() => tblCellAlign('left')} title="Текст ячейки слева" className="h-9 w-8 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={14} /></button>
                    <button onMouseDown={keepFocus} onClick={() => tblCellAlign('center')} title="Текст ячейки по центру" className="h-9 w-8 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={14} /></button>
                    <button onMouseDown={keepFocus} onClick={() => tblCellAlign('right')} title="Текст ячейки справа" className="h-9 w-8 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={14} /></button>
                    <button onMouseDown={keepFocus} onClick={() => tblAlign('center')} title="Таблица по центру" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Центр</button>
                    <button onMouseDown={keepFocus} onClick={() => tblSetPadding(4)} title="Компактные ячейки" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Компакт</button>
                    <button onMouseDown={keepFocus} onClick={() => tblSetPadding(10)} title="Просторные ячейки" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Крупно</button>
                    <button onMouseDown={keepFocus} onClick={tableDelete} className="h-9 px-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold text-xs flex items-center gap-1 whitespace-nowrap" title="Удалить таблицу"><Trash2 size={13} /> Удалить</button>
                  </RibbonGroup>
                </div>
              )}

              {/* Выпадающая панель выбора таблицы (ВНЕ overflow-x-auto — НИКОГДА не обрезается!) */}
              {showTblPicker && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-3 rounded-b-2xl flex flex-wrap items-center gap-4" data-testid="word-tbl-popover">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Выбери размер мышкой: <span className="text-[#2b579a] dark:text-blue-300 font-mono">{tblRows} × {tblCols}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1 p-1.5 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 w-fit">
                      {Array.from({ length: 6 }, (_, r) =>
                        Array.from({ length: 6 }, (_, c) => {
                          const lit = r < tblRows && c < tblCols
                          return (
                            <button
                              key={`${r}-${c}`}
                              type="button"
                              onMouseEnter={() => { setTblRows(r + 1); setTblCols(c + 1) }}
                              onMouseDown={keepFocus}
                              onClick={() => { insertTable(r + 1, c + 1); setShowTblPicker(false) }}
                              aria-label={`Таблица ${r + 1} на ${c + 1}`}
                              className={`w-6 h-5 rounded-sm border transition ${
                                lit ? 'bg-[#2b579a] border-[#2b579a]' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                              }`}
                            />
                          )
                        })
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Или задай вручную:</div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs dark:text-slate-300">
                        Строк:
                        <input type="number" min={1} max={10} value={tblRows} onChange={e => setTblRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          className="w-12 h-8 px-1 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-center font-bold" />
                      </label>
                      <span className="text-slate-400">×</span>
                      <label className="flex items-center gap-1 text-xs dark:text-slate-300">
                        Столб.:
                        <input type="number" min={1} max={6} value={tblCols} onChange={e => setTblCols(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                          className="w-12 h-8 px-1 rounded-lg border dark:bg-slate-800 dark:border-slate-600 dark:text-white text-center font-bold" />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onMouseDown={keepFocus} onClick={() => { insertTable(tblRows, tblCols); setShowTblPicker(false) }} className="px-4 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                        Вставить {tblRows}×{tblCols}
                      </button>
                      <button type="button" onClick={() => setShowTblPicker(false)} className="px-3 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold">Закрыть</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Выпадающая галерея Рамок / Текстовых блоков / Баннеров */}
              {showFramePicker && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-3 rounded-b-2xl space-y-2" data-testid="word-frame-popover">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Вставить рамку / текстовый блок (нажми чтобы добавить на лист):</span>
                    <button type="button" onClick={() => setShowFramePicker(false)} className="px-2 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold dark:text-slate-200">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_FRAME_PRESETS.map(fr => (
                      <button key={fr.id} type="button" onMouseDown={keepFocus} data-testid={`word-frame-${fr.id}`}
                        onClick={() => { insertBlockFrame(fr.html); setShowFramePicker(false); toast(`Вставлено: ${fr.label}`, 'success') }}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 hover:border-[#2b579a] hover:bg-blue-50 dark:hover:bg-slate-700 dark:text-white text-xs font-bold transition">
                        {fr.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Выпадающая панель Рамки страницы (как «Границы страниц» в Microsoft Word!) */}
              {showPageBorders && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-3 rounded-b-2xl space-y-2.5" data-testid="word-page-border-popover">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">🖼️ Рамка страницы (применяется ко всем листам и печати):</span>
                    <button type="button" onClick={() => setShowPageBorders(false)} className="px-2 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold dark:text-slate-200">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PAGE_BORDER_PRESETS.map(pb => (
                      <button key={pb.id} type="button" data-testid={`word-pborder-${pb.id}`}
                        onClick={() => { setPageBorder(pb.id); if (pb.id === 'gold') setPageBorderColor('#b45309'); setDirty(true) }}
                        className={`px-3 py-1.5 rounded-xl border text-left transition ${
                          pageBorder === pb.id ? 'bg-[#2b579a] text-white border-[#2b579a] shadow' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 hover:bg-blue-50'
                        }`}>
                        <div className="text-xs font-bold">{pb.label}</div>
                        <div className={`text-[10px] ${pageBorder === pb.id ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>{pb.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Цвет:</span>
                      {BORDER_COLORS.map(col => (
                        <button key={col} type="button" onClick={() => { setPageBorderColor(col); if (pageBorder === 'none') setPageBorder('solid'); setDirty(true) }}
                          className={`w-6 h-6 rounded-full border-2 transition ${pageBorderColor === col ? 'ring-2 ring-[#2b579a] scale-110 border-white' : 'border-slate-300'}`}
                          style={{ background: col }} aria-label={`Цвет рамки ${col}`} />
                      ))}
                      <input type="color" value={pageBorderColor} onChange={e => { setPageBorderColor(e.target.value); if (pageBorder === 'none') setPageBorder('solid'); setDirty(true) }}
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" title="Свой цвет рамки" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1">Толщина:</span>
                      {[1, 2, 3, 4].map(w => (
                        <button key={w} type="button" onClick={() => { setPageBorderWidth(w); setDirty(true) }}
                          className={`px-2.5 h-7 rounded-lg border text-xs font-bold ${pageBorderWidth === w ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600'}`}>{w}px</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Выпадающая панель Водяного знака (Watermark) */}
              {showWatermark && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-3 rounded-b-2xl flex flex-wrap items-center gap-2" data-testid="word-watermark-popover">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">💧 Водяной знак:</span>
                  {['', 'ЧЕРНОВИК', 'ОБРАЗЕЦ', 'СЕКРЕТНО', 'ОРИГИНАЛ'].map(w => (
                    <button key={w || 'none'} type="button" data-testid={`word-wm-${w || 'none'}`}
                      onClick={() => { setWatermark(w); setDirty(true) }}
                      className={`px-2.5 h-8 rounded-lg border text-xs font-bold ${watermark === w ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600'}`}>
                      {w || 'Нет'}
                    </button>
                  ))}
                  <input value={watermark} onChange={e => { setWatermark(e.target.value); setDirty(true) }} placeholder="Свой текст…" maxLength={40}
                    className="h-8 px-2.5 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white text-xs w-40" />
                  <button type="button" onClick={() => setShowWatermark(false)} className="ml-auto px-2.5 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold dark:text-slate-200">✕</button>
                </div>
              )}

              {/* Выпадающая панель Рамок и Тем ТАБЛИЦЫ (Конструктор таблиц MS Word!) */}
              {showTblBorders && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-3 rounded-b-2xl space-y-2.5" data-testid="word-tbl-borders-popover">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"><Palette size={14} /> Рамки и готовые темы таблицы:</span>
                    <button type="button" onClick={() => setShowTblBorders(false)} className="px-2 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold dark:text-slate-200">✕</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Границы:</span>
                    {([
                      ['all', '⊞ Все границы'],
                      ['outer', '▢ Только внешняя'],
                      ['horiz', '☰ Только строки'],
                      ['double', '▣ Двойная рамка'],
                      ['none', '⬚ Без границ'],
                    ] as const).map(([m, lbl]) => (
                      <button key={m} type="button" onMouseDown={keepFocus} data-testid={`word-tborder-${m}`}
                        onClick={() => tblApplyBorder(m)}
                        className="px-2.5 h-8 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-600 hover:border-[#2b579a] dark:text-white text-xs font-bold">
                        {lbl}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                      {BORDER_COLORS.map(c => (
                        <button key={c} type="button" onMouseDown={keepFocus}
                          onClick={() => { setTblBorderColor(c); tblApplyBorder('all', c, tblBorderWidth) }}
                          className={`w-5 h-5 rounded-full border ${tblBorderColor === c ? 'ring-2 ring-[#2b579a] scale-110' : 'border-slate-300'}`}
                          style={{ background: c }} title={`Цвет границ ${c}`} />
                      ))}
                      {[1, 2, 3].map(w => (
                        <button key={w} type="button" onMouseDown={keepFocus}
                          onClick={() => { setTblBorderWidth(w); tblApplyBorder('all', tblBorderColor, w) }}
                          className={`px-2 h-7 rounded-lg border text-[11px] font-bold ${tblBorderWidth === w ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600'}`}>{w}px</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t dark:border-slate-700/70">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Готовые темы:</span>
                    {TABLE_THEMES.map(th => (
                      <button key={th.id} type="button" onMouseDown={keepFocus} data-testid={`word-ttheme-${th.id}`}
                        onClick={() => tblApplyTheme(th.id)}
                        className="px-2.5 h-8 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-600 hover:border-[#2b579a] dark:text-white text-xs font-bold flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-sm border border-black/20" style={{ background: th.headBg }} />
                        {th.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Выпадающая панель школьных формул */}
              {showFormulas && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-2.5 rounded-b-2xl flex flex-wrap items-center gap-1.5" data-testid="word-formula-popover">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">∑ Формула:</span>
                  {MATH_FORMULAS.map(fm => (
                    <button key={fm} type="button" onMouseDown={keepFocus}
                      onClick={() => { insertHtmlAtCaret(`<span style="font-family:'Times New Roman';font-style:italic;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px">${fm}</span>&nbsp;`); setShowFormulas(false) }}
                      className="px-2.5 h-8 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-slate-700 dark:text-white font-serif italic font-bold text-xs">{fm}</button>
                  ))}
                  <button type="button" onClick={() => setShowFormulas(false)} className="ml-auto px-2.5 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold dark:text-slate-200">✕</button>
                </div>
              )}

              {/* Выпадающая панель спецсимволов (ВНЕ overflow-x-auto — НИКОГДА не обрезается!) */}
              {showSymbols && (
                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-3 py-2.5 rounded-b-2xl flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Вставить символ:</span>
                  {SPECIAL_SYMBOLS.map(sym => (
                    <button key={sym} type="button" onMouseDown={keepFocus} onClick={() => { insertHtmlAtCaret(sym); setShowSymbols(false) }}
                      className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-slate-700 dark:text-white font-bold text-base">{sym}</button>
                  ))}
                  <button type="button" onClick={() => setShowSymbols(false)} className="ml-auto px-2.5 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold dark:text-slate-200">✕</button>
                </div>
              )}
            </div>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onImage} />

          {/* На телефоне панель листов всегда над нижним меню; на десктопе остаётся в потоке. */}
          <div className={`fixed inset-x-3 z-20 lg:static lg:z-auto ${full ? 'bottom-[calc(12px+env(safe-area-inset-bottom))]' : 'bottom-[calc(64px+env(safe-area-inset-bottom))]'}`}>
            <div className="flex items-center gap-1.5 rounded-2xl border bg-white/95 dark:bg-slate-800/95 dark:border-slate-600 p-1.5 shadow-xl backdrop-blur-xl lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none dark:lg:bg-transparent">
              <span className="shrink-0 px-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 lg:hidden" aria-live="polite">
                Стр. {curPage}/{pages}
              </span>
              <div className="flex flex-1 lg:flex-none gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Листы документа">
                {Array.from({ length: Math.max(1, pages) }, (_, k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={curPage === k + 1}
                    aria-label={`Перейти к листу ${k + 1}`}
                    onClick={() => gotoSheet(k + 1)}
                    title={`Перейти к листу ${k + 1}`}
                    className={`min-w-[44px] min-h-[44px] shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${curPage === k + 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-600'}`}
                  >
                    <span className="hidden sm:inline">Лист </span>{k + 1}
                  </button>
                ))}
              </div>
              <button onClick={addPage} className="min-h-[44px] shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-dashed bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-600" title="Добавить лист в конец">
                + Лист
              </button>
            </div>
          </div>

          {/* рабочая область: опциональное Оглавление + Линейка + А4-листы */}
          <div className="flex flex-col md:flex-row gap-3 items-start">
            {showOutline && (
              <aside className="w-full md:w-56 shrink-0 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1"><ListTree size={13} /> Оглавление</span>
                  <button type="button" onClick={() => setShowOutline(false)} className="p-0.5 hover:text-slate-800 dark:hover:text-white"><X size={13} /></button>
                </div>
                {outlineItems.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">Добавь «Заг. 1 / Заг. 2 / Заг. 3» на вкладке «Главная» — здесь появится навигация по документу.</div>
                ) : (
                  <div className="space-y-1 max-h-[60vh] overflow-auto">
                    {outlineItems.map((it) => (
                      <button
                        key={it.idx}
                        type="button"
                        onClick={() => jumpToHeading(it.idx)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-blue-50 dark:hover:bg-slate-700 dark:text-slate-200 truncate ${
                          it.tag === 'h1' ? 'font-bold' : it.tag === 'h2' ? 'pl-4 font-semibold' : 'pl-6 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {it.text}
                      </button>
                    ))}
                  </div>
                )}
              </aside>
            )}

            <div className="flex-1 min-w-0 w-full bg-slate-200/80 dark:bg-slate-900 rounded-2xl border border-slate-300/80 dark:border-slate-700 p-2 sm:p-5 overflow-x-auto"
              onClick={e => { if (e.target === e.currentTarget) focusEnd() }}>
              <style>{`
              .word-page table {
                display: table;
                max-width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                word-break: break-word;
              }
              .word-page td, .word-page th {
                word-break: break-word;
                overflow-wrap: break-word;
              }
              .word-col-h:hover { background: rgba(43, 87, 154, 0.35); border-radius: 2px; }
              .word-row-h:hover { background: rgba(43, 87, 154, 0.35); border-radius: 2px; }
              .word-page h1 { font-size: 1.75em; font-weight: 800; color: #1e3a8a; margin: 0.55em 0 0.35em; }
              .word-page h2 { font-size: 1.38em; font-weight: 700; color: #1d4ed8; margin: 0.55em 0 0.3em; }
              .word-page h3 { font-size: 1.15em; font-weight: 700; color: #334155; margin: 0.45em 0 0.25em; }
              .word-page blockquote { border-left: 4px solid #2b579a; padding: 8px 14px; background: #eff6ff; border-radius: 6px; margin: 8px 0; color: #1e293b; }
              .word-sheet-custom { background: ${sheetBg} !important; }
            `}</style>

              {/* Визуальная линейка Word (см) */}
              {showRuler && (
                <div className="hidden sm:flex items-end justify-between mx-auto mb-2 px-3 h-6 rounded-md bg-white/90 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono text-slate-500 dark:text-slate-400 select-none"
                  style={{ maxWidth: page.maxW }}>
                  {Array.from({ length: orientation === 'landscape' ? 24 : 18 }, (_, i) => (
                    <span key={i} className="flex flex-col items-center leading-none">
                      <span>{i + 1}</span>
                      <span className="w-px h-1.5 bg-slate-400 dark:bg-slate-500 mt-0.5" />
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mx-auto transition-transform origin-top" ref={wrapRef} style={{ maxWidth: page.maxW, minHeight: layout.bottom, zoom: wordZoom !== 100 ? (`${wordZoom}%` as any) : undefined }}>
                {/* визуальные листы: границы по реальным стыкам абзацев, разрез — только в зазоре */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                  {layout.tops.map((t, k) => {
                    const nx = layout.tops[k + 1]
                    const sliceH = nx && nx.slot >= 8 ? Math.max(6, Math.min(24, nx.slot - 2)) : 0
                    const top = k === 0 ? 0 : t.top + sliceH / 2
                    const bottom = nx ? nx.top - sliceH / 2 : layout.bottom
                    return (
                      <div key={k} className="word-sheet word-sheet-custom" style={{ top, height: Math.max(40, bottom - top), background: sheetBg }}>
                        {/* Рамка страницы (Page Border) */}
                        {pageBorder !== 'none' && (
                          <div
                            data-testid="word-sheet-border"
                            className="absolute pointer-events-none rounded-[4px]"
                            style={{
                              inset: 14,
                              border:
                                pageBorder === 'double'
                                  ? `${Math.max(4, pageBorderWidth + 2)}px double ${pageBorderColor}`
                                  : pageBorder === 'dashed'
                                    ? `${pageBorderWidth}px dashed ${pageBorderColor}`
                                    : pageBorder === 'gold'
                                      ? `5px double ${pageBorderColor}`
                                      : `${pageBorderWidth}px solid ${pageBorderColor}`,
                              boxShadow:
                                pageBorder === 'shadow'
                                  ? `4px 4px 0 ${pageBorderColor}44`
                                  : pageBorder === 'gold'
                                    ? `inset 0 0 0 4px #ffffff00, inset 0 0 0 5.5px ${pageBorderColor}88`
                                    : undefined,
                            }}
                          >
                            {pageBorder === 'gold' && (
                              <>
                                <span style={{ position: 'absolute', top: 3, left: 6, color: pageBorderColor, fontSize: 12, lineHeight: 1 }}>✦</span>
                                <span style={{ position: 'absolute', top: 3, right: 6, color: pageBorderColor, fontSize: 12, lineHeight: 1 }}>✦</span>
                                <span style={{ position: 'absolute', bottom: 3, left: 6, color: pageBorderColor, fontSize: 12, lineHeight: 1 }}>✦</span>
                                <span style={{ position: 'absolute', bottom: 3, right: 6, color: pageBorderColor, fontSize: 12, lineHeight: 1 }}>✦</span>
                              </>
                            )}
                          </div>
                        )}
                        {/* Водяной знак (Watermark) */}
                        {watermark.trim() && (
                          <div
                            data-testid="word-sheet-watermark"
                            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                          >
                            <div
                              className="font-black uppercase tracking-[0.18em] text-slate-500/15 whitespace-nowrap"
                              style={{ fontSize: 54, transform: 'rotate(-32deg)' }}
                            >
                              {watermark}
                            </div>
                          </div>
                        )}
                        {headerText.trim() && (
                          <div className="absolute top-5 inset-x-10 text-[11px] text-slate-400 border-b border-slate-200/80 pb-1 truncate">
                            {headerText}
                          </div>
                        )}
                        {footerText.trim() && (
                          <div className="absolute bottom-5 inset-x-10 text-[11px] text-slate-400 border-t border-slate-200/80 pt-1 text-center truncate">
                            {footerText}
                          </div>
                        )}
                        {showPageNums && (
                          <span style={pageBorder !== 'none' ? { top: 22, right: 24 } : undefined}>
                            Стр. {k + 1}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {layout.tops.slice(1).map((t, i) => {
                    if (t.slot < 8) return null
                    const sliceH = Math.max(6, Math.min(24, t.slot - 2))
                    return (
                      <div key={`gap-${i}`} className="word-sheet-gap"
                        style={{ top: t.top - sliceH / 2, height: sliceH }} />
                    )
                  })}
                </div>
                <div
                  ref={editRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Текст документа Word"
                  onInput={() => { saveSelection(); setDirty(true); refreshCounts(); autoStash(); mergeRedundantBreaks(); measureSoon(); placeHandle(); requestAnimationFrame(placeTblOverlay) }}
                  onMouseUp={() => { saveSelection(); refreshCounts() }}
                  onKeyUp={() => { saveSelection(); refreshCounts(); measureSoon() }}
                  onKeyDown={onEditorKeyDown}
                  onClick={onEditorClick}
                  onPointerDown={onFreeMouseDown}
                  className={`word-page relative z-10 min-h-[350px] bg-transparent text-slate-900 focus:outline-none focus:ring-0 prose-sm ${columns === 2 ? 'word-cols-2' : ''}`}
                  style={{ lineHeight: 1.7, minHeight: 350, paddingLeft: `${sheetPadPx}px`, paddingRight: `${sheetPadPx}px`, paddingTop: headerText.trim() || pageBorder !== 'none' ? '52px' : undefined, paddingBottom: footerText.trim() || pageBorder !== 'none' ? '52px' : undefined }}
                />
                <div ref={tblOverlayRef} className="absolute inset-0 pointer-events-none z-20" aria-hidden="true" />
                {selImg && handle && (
                  <div className="img-handle" style={{ left: handle.x, top: handle.y }}
                    onPointerDown={startResize} title="Тяни — размер фото" />
                )}
              </div>
            </div>
          </div>

          {/* Нижняя строка состояния как в настоящем Microsoft Word */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-[#2b579a] dark:text-blue-300">Стр. {curPage} из {pages}</span>
              <span>Слов: <b>{words}</b></span>
              <span aria-label="Количество символов без пробелов">Симв.: <b>{chars}</b></span>
              <span className="hidden sm:inline text-slate-400">•</span>
              <span className={dirty ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                {dirty ? '● Есть несохранённые изменения' : '✓ Всё сохранено'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setWordZoom(z => Math.max(65, z - 10))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Уменьшить масштаб"><ZoomOut size={13} /></button>
              <span className="font-mono font-bold w-10 text-center">{wordZoom}%</span>
              <button type="button" onClick={() => setWordZoom(z => Math.min(150, z + 10))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Увеличить масштаб"><ZoomIn size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
