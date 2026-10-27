import { useEffect, useRef, useState, type ReactNode } from 'react'
import client from '../api/client'
import { useAccessibility, toast } from '../context/UIContext'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link2, ImagePlus, Table as TableIcon, Eraser, Save,
  Upload, Download, Printer, Plus, Trash2, FileText,
  Undo2, Redo2, X, Maximize2, Minimize2, Scissors, Move,
  IndentIncrease, IndentDecrease,
} from 'lucide-react'

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
const CELL_STYLE = 'border:1px solid #94a3b8;padding:6px;min-width:40px;'

/** Группа инструментов ленты: кнопки сверху, подпись снизу — как в Word. */
function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-1 px-2 py-0.5 min-w-0 shrink-0" role="group" aria-label={label || undefined}>
      <div className="flex flex-wrap items-center justify-start gap-1">{children}</div>
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

/** Чистим HTML редактора: без скриптов и on*-обработчиков.
 *  div.page-break (разрыв страницы) сохраняем, остальные div — разворачиваем. */
function sanitize(html: string): string {
  try {
    const tpl = document.createElement('template')
    tpl.innerHTML = String(html || '')
    tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove())
    const walk = (el: Element) => {
      for (const a of Array.from(el.attributes)) {
        if (a.name.startsWith('on') || a.name === 'srcdoc') el.removeAttribute(a.name)
        if (a.name === 'href' && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name)
        if (a.name === 'class' && /\bsel\b/.test(a.value)) el.removeAttribute('class')
      }
      Array.from(el.children).forEach(walk)
    }
    Array.from(tpl.content.children).forEach(walk)
    // вытаскиваем содержимое обычных div, но храним разрывы страниц
    tpl.content.querySelectorAll('div:not(.page-break)').forEach(d => {
      const parent = d.parentNode
      if (!parent) return
      while (d.firstChild) parent.insertBefore(d.firstChild, d)
      parent.removeChild(d)
    })
    return tpl.innerHTML
  } catch { return '' }
}

const hasDocumentContent = (body: string) =>
  body.replace(/<[^>]+>/g, '').replace(/ /g, ' ').trim().length > 0 || /<img\b[^>]*\bsrc=/i.test(body)

export default function WordEditor() {
  const { poor } = useAccessibility()
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
  const [currentId, setCurrentId] = useState<number | string | null>(null)
  const [title, setTitle] = useState('Новый документ')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [words, setWords] = useState(0)
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
  const saveRef = useRef<() => void>(() => {})
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
  // ── Лента как в Word: табы Главная/Вставка + контекстные Картинка/Таблица ──
  const [tab, setTab] = useState<'home' | 'insert' | 'img' | 'tbl'>('home')
  useEffect(() => {
    // контекстный таб открывается на выбор, как у Word; ушёл выбор — вернулись на Главную
    if (selImg) setTab('img')
    else if (inTable) setTab('tbl')
    else setTab(t => (t === 'img' || t === 'tbl') ? 'home' : t)
  }, [selImg, inTable])

  const html = () => editRef.current?.innerHTML || ''
  const text = () => editRef.current?.innerText || ''

  const refreshCounts = () => {
    const t = text().trim()
    setWords(t ? t.split(/\s+/).length : 0)
    try {
      const q = (c: string) => { try { return document.queryCommandState(c) } catch { return false } }
      setActive({
        bold: q('bold'), italic: q('italic'), underline: q('underline'),
        strikeThrough: q('strikeThrough'),
        insertUnorderedList: q('insertUnorderedList'), insertOrderedList: q('insertOrderedList'),
      })
    } catch {}
  }

  // --- выделение: запоминаем Range, чтобы кнопки тулбара не теряли его ---
  const saveSelection = () => {
    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editRef.current?.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange()
      }
    } catch {}
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
    } catch {}
  }

  const cmd = (command: string, value?: string) => {
    restoreSelection()
    try {
      // styleWithCSS — команды дают <span style="…">, а не старые <font>/<b> — так Word-образнее
      try { document.execCommand('styleWithCSS', false, 'true') } catch {}
      if (command === 'formatBlock' && value && !value.startsWith('<')) {
        try { document.execCommand(command, false, value) }
        catch { document.execCommand(command, false, `<${value}>`) }
      } else {
        document.execCommand(command, false, value)
      }
    } catch {}
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
    } catch {}
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
      } catch {}
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
    } catch {}
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
    } catch {}
  }

  const markSelImg = (img: HTMLImageElement | null) => {
    try {
      editRef.current?.querySelectorAll('img.sel').forEach(i => i.classList.remove('sel'))
      if (img) img.classList.add('sel')
    } catch {}
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
    } catch {}
  }

  // ——— оверлей живой таблицы: рамка, ручка «передвинуть», ширины колонок, высоты строк ———
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
    if (!tr.width || tr.bottom < -40 || tr.top > innerHeight + 40) {
      if (layer.childElementCount) layer.innerHTML = ''
      return
    }
    layer.innerHTML = ''
    const box = document.createElement('div')
    box.className = 'word-tbl-box'
    box.style.cssText = `left:${tr.left - wr.left - 3}px;top:${tr.top - wr.top - 3}px;width:${tr.width + 4}px;height:${tr.height + 4}px`
    layer.appendChild(box)
    // ручка «тащи таблицу»
    const mv = document.createElement('div')
    mv.className = 'word-tbl-move'
    mv.title = 'Тяни — переставить таблицу'
    mv.style.cssText = `left:${Math.max(0, tr.left - wr.left + 2)}px;top:${tr.top - wr.top - 13}px`
    mv.textContent = '⠿'
    mv.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startTblMove(ev as unknown as MouseEvent, t) })
    layer.appendChild(mv)
    // ширины столбцов — ручки на границах
    const first = t.rows[0]
    if (first) {
      for (let i = 1; i < first.cells.length; i++) {
        const cr = (first.cells[i] as HTMLTableCellElement).getBoundingClientRect()
        const h = document.createElement('div')
        h.className = 'word-col-h'
        h.title = 'Тяни — ширина столбца'
        h.style.cssText = `left:${cr.left - wr.left - 4}px;top:${tr.top - wr.top}px;height:${tr.height}px`
        h.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startColDrag(ev as unknown as MouseEvent, t, i - 1) })
        layer.appendChild(h)
      }
    }
    // высоты строк — ручки слева
    for (let i = 0; i < t.rows.length; i++) {
      const rr = (t.rows[i] as HTMLTableRowElement).getBoundingClientRect()
      const h = document.createElement('div')
      h.className = 'word-row-h'
      h.title = 'Тяни — высота строки'
      h.style.cssText = `left:${Math.max(0, tr.left - wr.left - 5)}px;top:${rr.bottom - wr.top - 4}px;width:${Math.min(34, tr.width)}px`
      h.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); startRowDrag(ev as unknown as MouseEvent, t, i) })
      layer.appendChild(h)
    }
  }

  const startColDrag = (e: MouseEvent, t: HTMLTableElement, idx: number) => {
    const first = t.rows[0]
    const cell = first?.cells[idx] as HTMLTableCellElement | undefined
    if (!cell) return
    const startX = e.clientX
    const startW = cell.getBoundingClientRect().width
    const tableW = t.getBoundingClientRect().width || 1
    const move = (ev: PointerEvent) => {
      const w = Math.max(24, Math.min(tableW - 24, startW + (ev.clientX - startX)))
      cell.style.width = `${((w / tableW) * 100).toFixed(2)}%`
      placeTblOverlay()
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      tblDragRef.current = null
      setDirty(true)
    }
    tblDragRef.current = { t }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const startRowDrag = (e: MouseEvent, t: HTMLTableElement, idx: number) => {
    const row = t.rows[idx] as HTMLTableRowElement | undefined
    if (!row) return
    const startY = e.clientY
    const startH = row.getBoundingClientRect().height
    const move = (ev: PointerEvent) => {
      row.style.height = `${Math.max(24, Math.min(500, startH + (ev.clientY - startY)))}px`
      placeTblOverlay()
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

  // перестановка таблицы: тяни ручку — синяя линия показывает, куда встанет
  const startTblMove = (e: MouseEvent, t: HTMLTableElement) => {
    const ed = editRef.current
    if (!ed) return
    e.preventDefault()
    document.body.style.userSelect = 'none'
    const kids = Array.from(ed.children) as HTMLElement[]
    const line = document.createElement('div')
    line.className = 'word-drop-line'
    line.style.display = 'none'
    document.body.appendChild(line)
    let dropBefore: Element | null = null
    let atEnd = false
    const compute = (ev: MouseEvent) => {
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
    compute(e)
    const move = (ev: MouseEvent) => compute(ev)
    const moveU = (ev: PointerEvent) => compute(ev)
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.removeEventListener('pointermove', moveU)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      line.remove()
      document.body.style.userSelect = ''
      try {
        if (atEnd) ed.appendChild(t)
        else if (dropBefore) ed.insertBefore(t, dropBefore)
      } catch {}
      lastTable.current = t
      setDirty(true)
      requestAnimationFrame(placeTblOverlay)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    document.addEventListener('pointermove', moveU)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const insertTable = (rows?: number, cols?: number) => {
    const R = Math.max(1, Math.min(10, rows ?? tblRows ?? 3))
    const C = Math.max(1, Math.min(6, cols ?? tblCols ?? 3))
    restoreSelection()
    let t = '<table style="border-collapse:collapse;width:100%;margin:8px 0">'
    for (let i = 0; i < R; i++) {
      t += '<tr>'
      for (let j = 0; j < C; j++) t += `<td style="${CELL_STYLE}"> </td>`
      t += '</tr>'
    }
    t += '</table><p></p>'
    try { document.execCommand('insertHTML', false, t) } catch {}
    saveSelection()
    setDirty(true)
    setInTable(true)
    setShowTblPicker(false)
    try {
      const tables = editRef.current?.querySelectorAll('table')
      const last = tables?.[tables.length - 1] as HTMLTableElement | undefined
      if (last) lastTable.current = last
    } catch {}
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
    } catch {}
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
      for (const r of Array.from(t.rows)) { try { r.deleteCell(idx) } catch {} }
    } catch {}
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

  // выравнивание всей таблицы в листе
  const tblAlign = (mode: 'left' | 'center' | 'right') => {
    const t = getTable()
    if (!t) return
    t.style.float = 'none'
    t.style.width = '100%'
    t.style.margin = mode === 'center' ? '10px auto' : mode === 'right' ? '10px 0 10px auto' : '8px 0'
    setDirty(true)
    requestAnimationFrame(placeTblOverlay)
  }

  // обтекание как у Word-таблицы (картинка/текст сбоку)
  const tblFloat = (side: '' | 'left' | 'right') => {
    const t = getTable()
    if (!t) return
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
    } catch {}
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
    } catch {}
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
    client.get('/word-docs/').then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data.results || []
      setDocs(arr)
      try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 30))) } catch {}
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
    } catch {}
    requestAnimationFrame(() => {
      measurePages()
      updateCurPage()
      // картинки дорисовываются после вставки — их загрузка меняет высоты, переизмеряем
      try {
        editRef.current?.querySelectorAll('img').forEach(img => {
          const el = img as HTMLImageElement
          if (!(el as any).__mBound) {
            ;(el as any).__mBound = 1
            el.addEventListener('load', measureSoon)
          }
        })
      } catch {}
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
      try { ro?.disconnect() } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistLocal = (arr: Doc[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 30))) } catch {}
  }

  // черновик: ничего не теряется при кнопке «Новый»
  const stashDraft = () => {
    try {
      const body = sanitize(html())
      if (!hasDocumentContent(body)) return
      if (body.length > 1000000) return // с тяжёлыми картинками черновик не тащим
      const current = latestRef.current
      localStorage.setItem(LS_DRAFT, JSON.stringify({
        title: current.title, body_html: body, page_size: current.pageSize, savedAt: Date.now(),
      }))
      setHasDraft(true)
    } catch {}
  }

  const openDoc = (d: Doc) => {
    if (dirty && !confirm('Открыть другой документ? Несохранённое уедет в черновик и не пропадёт.')) return
    if (dirty) stashDraft()
    setCurrentId(d.id)
    setTitle(d.title)
    markSelImg(null)
    const ps = (d as any).page_size
    if (ps && PAGE_SIZES[ps]) { setPageSize(ps); try { localStorage.setItem(LS_PAGE, ps) } catch {} }
    if (editRef.current) editRef.current.innerHTML = sanitize(d.body_html)
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
    setCurrentId(null)
    setTitle('Новый документ')
    markSelImg(null)
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
      setCurrentId(null)
      setTitle(d.title || 'Черновик')
      if (d.page_size && PAGE_SIZES[d.page_size]) setPageSize(d.page_size)
      if (editRef.current) editRef.current.innerHTML = sanitize(d.body_html || '')
      setDirty(true)
      refreshCounts()
      measureSoon()
    } catch {}
  }

  const save = async () => {
    const body = sanitize(html())
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
      try { localStorage.removeItem(LS_DRAFT) } catch {}
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
    if (typeof id === 'number') { try { await client.delete(`/word-docs/${id}/`) } catch {} }
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
      const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`], { type: 'text/html' })
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
      } catch {}
      saveSelection()
      setDirty(true)
      measureSoon()
    }
    rd.readAsDataURL(file)
  }

  const insertLink = () => {
    const sel = window.getSelection()?.toString() || ''
    const url = prompt('Ссылка (https://…)?', 'https://')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) { alert('Ссылка должна начинаться с http:// или https://'); return }
    restoreSelection()
    try {
      if (!sel) document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`)
      else document.execCommand('createLink', false, url)
    } catch {}
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
      d.open()
      d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #666;padding:6px}img{max-width:100%}</style></head><body><h1>${escapeHtml(title)}</h1>${sanitize(html())}</body></html>`)
      d.close()
      const w = frame.contentWindow
      if (w) { w.focus(); w.print() }
    } finally { setTimeout(() => frame.remove(), 2000) }
  }

  const pickPage = (p: string) => {
    if (!PAGE_SIZES[p]) return
    setPageSize(p)
    try { localStorage.setItem(LS_PAGE, p) } catch {}
    setDirty(true)
    requestAnimationFrame(() => { measurePages(); updateCurPage() })
  }

  const page = PAGE_SIZES[pageSize] || PAGE_SIZES.A4
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
          // маркер старше естественной границы — рвём по нему (как в Word).
          // «Пустая страница»: после маркера нет контента, либо следом огромный сдвинутый
          // абзац — тогда новый лист начинается на полной высоте, как за разрывом в Word.
          const nextNatural = gaps.find(g => !g.forced && g.mid > marker!.mid)
          const isBlankPage =
            contentEnd - marker.mid < 200 ||
            (!!nextNatural && (nextNatural.mid - marker.mid > pageVH * 0.45 || nextNatural.space > pageVH * 0.55))
          const bound = isBlankPage ? from + pageVH : Math.max(marker.mid, from + 1)
          hardBounds.push(bound)
          tops.push({ top: bound, slot: marker.space })
          continue
        }
        if (best) { tops.push({ top: best.mid, slot: best.space }); continue }
        break
      }
      // Низ последнего листа — по фактическому концу контента, но не короче
      // разумного минимума. Полную высоту листа (pageVH) даём только одиночному
      // (пустому) листу: иначе после разрыва страницы последний лист растягивается
      // в огромное белое полотно, вылезающее за контейнер редактора.
      const minBottom = tops.length === 1 ? pageVH : tops[tops.length - 1].top + 350
      const bottom = Math.max(contentEnd, minBottom)
      const prev = layoutRef.current
      const same =
        prev.bottom === bottom &&
        prev.tops.length === tops.length &&
        prev.tops.every((t, i) => t.top === tops[i].top && t.slot === tops[i].slot)
      const nl = { tops, bottom }
      layoutRef.current = nl
      if (!same) setLayout(nl)
    } catch {}
  }
  const measureTimer = useRef<number | undefined>(undefined)
  const measureSoon = () => {
    window.clearTimeout(measureTimer.current)
    measureTimer.current = window.setTimeout(() => { measurePages(); updateCurPage() }, 90)
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
    } catch {}
  }

  // при смене размера/формата/полного экрана/масштаба для слабовидящих — переизмерить
  useEffect(() => {
    requestAnimationFrame(() => { measurePages(); updateCurPage() })
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
          for (let fix = 0; fix < 2; fix++) {
            const cur = after.getBoundingClientRect().top - wr.getBoundingClientRect().top
            const curMt = parseFloat(after.style.marginTop || '0') || 0
            const want = curMt + (target + 12 - cur)
            if (want <= curMt + 1) break // тянуть вверх не нужно — хвост и так ниже листа
            after.style.marginTop = `${Math.round(want)}px`
            measurePages()
          }
        }
      }
    } catch {}
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
      } catch {}
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
        } catch {}
        if (atStart) {
          ed.insertBefore(mk, anchor)
          caretTo = anchor // блок уходит на новый лист, каретка на нём же
        } else {
          // каретка внутри текста — Word-splitting: всё после каретки переезжает на новый лист
          const right = document.createRange()
          right.selectNodeContents(anchor)
          try { right.setStart(r0!.startContainer, r0!.startOffset) } catch {}
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
      try { ed.appendChild(mk) } catch {}
      try { ed.appendChild(blank) } catch {}
    }
    saveSelection()
    setDirty(true)
    refreshCounts()
    try { measurePages(); settleMarkers() } catch {}
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
    } catch {}
  }

  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])

  // ── Лента: как Word — иконки в группах с подписями, разделители групп ──
  // rbBtn(on) — кнопка-иконка; вкл. состояние подсвечено как в Word
  const rbBtn = (on: boolean) =>
    `h-11 w-11 sm:h-9 sm:w-9 shrink-0 rounded-lg border flex items-center justify-center ${on
      ? 'bg-blue-600 text-white border-blue-600'
      : `bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600`}`

  return (
    <div className="word-editor max-w-6xl mx-auto space-y-4 page-enter">
      <div className="flex flex-wrap items-center gap-3 animate-fadeIn">
        {/* счётчик — вне h1: из h1 собирается заголовок вкладки браузера («Word 0» смотрелся как баг) */}
        <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white"><FileText size={20}/></span> Word</h1>
        <span className="text-sm font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-full" aria-label="Количество документов">{docs.length}</span>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
      {/* список документов */}
      <aside className="lg:w-64 shrink-0 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-3 h-fit" aria-label="Мои документы">
        <button onClick={newDoc} title="Чистый лист: начать новый документ. Текущий не удаляется — несохранённое уедет в черновик."
          aria-label="Создать новый документ"
          className="w-full px-3 py-2.5 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2">
          <Plus size={16} /> Новый
        </button>
        {hasDraft && (
          <button onClick={restoreDraft} title="Вернуть несохранённый черновик" className="mt-2 w-full px-3 py-2 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold">
            Черновик • восстановить
          </button>
        )}
        {/* Файл: открыть .docx / сохранить в .docx — как в Word файловые операции */}
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Файл">
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Открыть .docx (до 20МБ)"
            className="px-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Upload size={13} /> Импорт
          </button>
          <button onClick={onExport} disabled={busy} title="Сохранить документ как .docx"
            className="min-h-[44px] px-2 py-2.5 rounded-xl bg-white border dark:bg-slate-700 dark:text-white dark:border-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Download size={13} /> Скачать
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={onImport} />
        <div className="mt-3 space-y-1 max-h-40 lg:max-h-[50vh] overflow-auto overscroll-contain">
          {docs.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Пока пусто</div>}
          {docs.map(d => (
            <div key={d.id} className={`group flex items-center gap-2 px-2 py-2 rounded-xl text-sm ${currentId === d.id ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <button onClick={() => openDoc(d)} className="flex-1 flex items-center gap-2 min-w-0 text-left dark:text-white" title={d.title}>
                <FileText size={15} className="shrink-0 text-blue-600" />
                <span className="truncate">{d.title}{dirty && currentId === d.id ? ' •' : ''}</span>
              </button>
              <button onClick={() => remove(d.id)} aria-label={`Удалить ${d.title}`}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-red-50 text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </aside>

      {/* редактор */}
      <div ref={sheetScrollRef} onScroll={updateCurPage} className={`flex-1 min-w-0 space-y-3 pb-28 lg:pb-0 scroll-mt-20 ${full ? 'fixed inset-0 z-50 overflow-auto overscroll-contain bg-slate-100 dark:bg-slate-900 p-3 sm:p-6' : ''}`}>
        {/* Быстрый доступ — как у Word сверху: сохранение, отмена/возврат, печать */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 px-1.5 py-1 flex flex-wrap sm:flex-nowrap items-center gap-1">
          <button onClick={save} disabled={busy} title="Сохранить" aria-label="Сохранить документ"
            className="flex items-center gap-2 px-3 h-11 sm:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shrink-0 disabled:opacity-50">
            <Save size={15} /> {busy ? '…' : 'Сохранить'}
          </button>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" />
          <button onMouseDown={keepFocus} onClick={() => cmd('undo')} title="Отменить (Ctrl+Z)" aria-label="Отменить"
            className="p-2.5 h-11 w-11 sm:h-10 sm:w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white shrink-0 flex items-center justify-center"><Undo2 size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('redo')} title="Вернуть (Ctrl+Y)" aria-label="Вернуть"
            className="p-2.5 h-11 w-11 sm:h-10 sm:w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white shrink-0 flex items-center justify-center"><Redo2 size={16} /></button>
          <button onClick={doPrint} title="Печать" aria-label="Печать документа"
            className="p-2.5 h-11 w-11 sm:h-10 sm:w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white shrink-0 flex items-center justify-center"><Printer size={16} /></button>
          {!online && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">офлайн</span>}
          <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }}
            aria-label="Название документа" placeholder="Название документа"
            className="order-first sm:order-none basis-full sm:basis-auto flex-1 min-w-0 px-3 h-11 sm:h-10 rounded-xl border bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700 font-bold text-base sm:text-sm" />
          <span className="hidden lg:block shrink-0 text-xs text-slate-500 dark:text-slate-400 px-2 font-mono whitespace-nowrap" aria-live="polite">Стр. {curPage}/{pages}</span>
          <button onClick={() => setFull(f => !f)} title={full ? 'Выйти из полного экрана (Esc)' : 'Во весь экран'}
            aria-label={full ? 'Выйти из полного экрана' : 'Полный экран'}
            className="p-2.5 h-11 w-11 sm:h-10 sm:w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white shrink-0 flex items-center justify-center">
            {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Лента как в Word: табы Главная/Вставка, группы с подписями. В режиме
            слабовидящих лента заменена на простые крупные кнопки — без вкладок и
            вставок, только самое нужное. */}
        {poor ? (
          <div role="toolbar" aria-label="Простые инструменты" className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-2">
            <button onMouseDown={keepFocus} onClick={() => cmd('bold')} aria-pressed={!!active.bold} title="Жирный (Ctrl+B)" aria-label="Жирный" className={`h-11 min-w-[52px] px-3 rounded-xl border text-lg font-bold ${!!active.bold ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Ж</button>
            <button onMouseDown={keepFocus} onClick={() => cmd('italic')} aria-pressed={!!active.italic} title="Курсив (Ctrl+I)" aria-label="Курсив" className={`h-11 min-w-[52px] px-3 rounded-xl border text-lg italic ${!!active.italic ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>К</button>
            <button onMouseDown={keepFocus} onClick={() => cmd('underline')} aria-pressed={!!active.underline} title="Подчёркнутый (Ctrl+U)" aria-label="Подчёркнутый" className={`h-11 min-w-[52px] px-3 rounded-xl border text-lg underline ${!!active.underline ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Ч</button>
            <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />
            <select onChange={e => { setFontSizePt(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Размер шрифта" aria-label="Размер шрифта"
              className="h-11 px-2 rounded-xl border bg-white dark:bg-slate-700 dark:text-white text-base cursor-pointer">
              <option value="">Крупность</option>
              {FONT_SIZES.map(s => <option key={s.pt} value={s.pt}>{s.label}</option>)}
            </select>
            <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />
            <button onMouseDown={keepFocus} onClick={() => cmd('insertUnorderedList')} aria-pressed={!!active.insertUnorderedList} title="Список с точками" aria-label="Маркированный список"
              className={`h-11 min-w-[48px] px-3 rounded-xl border ${!!active.insertUnorderedList ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><List size={18} /></button>
            <button onMouseDown={keepFocus} onClick={() => cmd('insertOrderedList')} aria-pressed={!!active.insertOrderedList} title="Список с номерами" aria-label="Нумерованный список"
              className={`h-11 min-w-[48px] px-3 rounded-xl border ${!!active.insertOrderedList ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}><ListOrdered size={18} /></button>
            <span className="w-px self-stretch bg-slate-200 dark:bg-slate-600 mx-1" />
            <button onMouseDown={keepFocus} onClick={() => cmd('justifyLeft')} title="Текст слева" aria-label="По левому краю" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={18} /></button>
            <button onMouseDown={keepFocus} onClick={() => cmd('justifyCenter')} title="Текст по центру" aria-label="По центру" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={18} /></button>
            <button onMouseDown={keepFocus} onClick={() => cmd('justifyRight')} title="Текст справа" aria-label="По правому краю" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={18} /></button>
            {/* В poor ленты нет, поэтому панель картинки нужна отдельно — иначе не удалить фото */}
            {selImg && (
              <div role="toolbar" aria-label="Выбранная картинка" className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="px-1 text-sm font-bold dark:text-white">Картинка:</span>
                <button onClick={imgFree} title="Открепить от текста" aria-label="Картинка свободно" className={`h-11 px-3 rounded-xl border text-sm font-bold ${isFree(selImg) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>Свободно</button>
                <button onClick={imgInline} title="Вернуть в текст" aria-label="Картинка в текст" className={`h-11 px-3 rounded-xl border text-sm font-bold ${!isFree(selImg) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>В текст</button>
                {[25, 50, 100].map(p => (
                  <button key={p} onClick={() => imgSetWidth(p)} aria-label={`Размер ${p} процентов`} className={`h-11 w-16 rounded-xl border text-sm font-bold ${imgW === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>{p}%</button>
                ))}
                <button onClick={() => imgAlign('left')} title="Слева" aria-label="Картинка слева" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={18} /></button>
                <button onClick={() => imgAlign('center')} title="По центру" aria-label="Картинка по центру" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={18} /></button>
                <button onClick={() => imgAlign('right')} title="Справа" aria-label="Картинка справа" className="h-11 w-11 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={18} /></button>
                <button onClick={imgDelete} title="Удалить картинку" aria-label="Удалить картинку" className="h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold ml-auto">Удалить</button>
              </div>
            )}
            {/* и панель таблицы — крупно, минимум кнопок */}
            {inTable && !selImg && (
              <div role="toolbar" aria-label="Выбранная таблица" className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="px-1 text-sm font-bold dark:text-white">Таблица:</span>
                <button onMouseDown={keepFocus} onClick={tableAddRow} title="Добавить строку" className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">+ Строка</button>
                <button onMouseDown={keepFocus} onClick={tableDelRow} title="Удалить последнюю строку" className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">− Строка</button>
                <button onMouseDown={keepFocus} onClick={tableAddCol} title="Добавить столбец" className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">+ Столбец</button>
                <button onMouseDown={keepFocus} onClick={tableDelCol} title="Удалить последний столбец" className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 text-sm font-bold">− Столбец</button>
                <button onMouseDown={keepFocus} onClick={tableDelete} title="Удалить таблицу целиком" aria-label="Удалить таблицу" className="h-11 px-4 rounded-xl bg-red-600 text-white text-sm font-bold ml-auto">Удалить</button>
              </div>
            )}
          </div>
        ) : (
          <div className="word-ribbon bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden">
            {/* табы ленты */}
            <div role="tablist" aria-label="Вкладки ленты" className="flex items-center gap-1 px-2 pt-1 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 overflow-x-auto">
              <button role="tab" aria-selected={tab === 'home'} onClick={() => setTab('home')}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === 'home' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-b-0 border-slate-200 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Главная</button>
              <button role="tab" aria-selected={tab === 'insert'} onClick={() => setTab('insert')}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === 'insert' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-b-0 border-slate-200 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Вставка</button>
              {selImg && (
                <button role="tab" aria-selected={tab === 'img'} onClick={() => setTab('img')}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === 'img' ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-b-0 border-slate-200 dark:border-slate-700' : 'text-amber-600 dark:text-amber-400/80 hover:text-amber-800'}`}>Картинка</button>
              )}
              {(inTable && !selImg) && (
                <button role="tab" aria-selected={tab === 'tbl'} onClick={() => setTab('tbl')}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === 'tbl' ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-b-0 border-slate-200 dark:border-slate-700' : 'text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-800'}`}>Таблица</button>
              )}
            </div>

            {/* тело главной вкладки: Шрифт | Абзац | Стили — порядок как у Word */}
            {tab === 'home' && (
              <div role="toolbar" aria-label="Главная" className="flex flex-nowrap sm:flex-wrap items-stretch gap-0 p-1.5 overflow-x-auto sm:overflow-visible scrollbar-thin">
                <RibbonGroup label="Шрифт">
                  <select onChange={e => { setFontFamily(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Шрифт" aria-label="Шрифт"
                    className="h-9 px-2 rounded-lg border bg-white dark:bg-slate-700 dark:text-white text-sm max-w-[130px] cursor-pointer">
                    <option value="">Шрифт</option>
                    {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
                  </select>
                  <select onChange={e => { setFontSizePt(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Размер шрифта (кегль, пункты)" aria-label="Размер шрифта"
                    className="h-9 w-[72px] shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white text-sm cursor-pointer">
                    <option value="">Кегль</option>
                    {FONT_SIZES.map(s => <option key={s.pt} value={s.pt}>{s.label}</option>)}
                  </select>
                  <button onMouseDown={keepFocus} onClick={() => cmd('bold')} aria-pressed={!!active.bold} title="Жирный (Ctrl+B)" aria-label="Жирный" className={rbBtn(!!active.bold)}><Bold size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('italic')} aria-pressed={!!active.italic} title="Курсив (Ctrl+I)" aria-label="Курсив" className={rbBtn(!!active.italic)}><Italic size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('underline')} aria-pressed={!!active.underline} title="Подчёркнутый (Ctrl+U)" aria-label="Подчёркнутый" className={rbBtn(!!active.underline)}><Underline size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('strikeThrough')} aria-pressed={!!active.strikeThrough} title="Зачёркнутый" aria-label="Зачёркнутый" className={rbBtn(!!active.strikeThrough)}><Strikethrough size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('subscript')} title="Нижний индекс" aria-label="Нижний индекс" className={rbBtn(false)}><span className="text-sm font-bold leading-none">x₂</span></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('superscript')} title="Верхний индекс" aria-label="Верхний индекс" className={rbBtn(false)}><span className="text-sm font-bold leading-none">x²</span></button>
                  <label className="h-9 w-9 shrink-0 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-600 dark:text-white cursor-pointer flex flex-col items-center justify-center" title="Цвет текста">
                    <span className="text-sm font-bold leading-none">A</span>
                    <span className="block w-4 h-1 rounded-sm bg-red-600" />
                    <input type="color" className="sr-only" aria-label="Цвет текста" onChange={e => cmd('foreColor', e.target.value)} />
                  </label>
                  <label className="h-9 w-9 shrink-0 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-600 dark:text-white cursor-pointer flex flex-col items-center justify-center" title="Выделить маркером">
                    <span className="text-sm font-bold leading-none">A</span>
                    <span className="block w-4 h-1 rounded-sm bg-yellow-300" />
                    <input type="color" defaultValue="#ffff00" className="sr-only" aria-label="Цвет выделения маркером" onChange={e => cmd('hiliteColor', e.target.value)} />
                  </label>
                  <button onMouseDown={keepFocus} onClick={() => cmd('removeFormat')} title="Очистить всё форматирование" aria-label="Очистить форматирование" className={rbBtn(false)}><Eraser size={16} /></button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Абзац">
                  <button onMouseDown={keepFocus} onClick={() => cmd('insertUnorderedList')} aria-pressed={!!active.insertUnorderedList} title="Список с точками" aria-label="Маркированный список" className={rbBtn(!!active.insertUnorderedList)}><List size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('insertOrderedList')} aria-pressed={!!active.insertOrderedList} title="Список с номерами" aria-label="Нумерованный список" className={rbBtn(!!active.insertOrderedList)}><ListOrdered size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('justifyLeft')} title="По левому краю" aria-label="По левому краю" className={rbBtn(false)}><AlignLeft size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('justifyCenter')} title="По центру" aria-label="По центру" className={rbBtn(false)}><AlignCenter size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('justifyRight')} title="По правому краю" aria-label="По правому краю" className={rbBtn(false)}><AlignRight size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('justifyFull')} title="По ширине страницы" aria-label="По ширине" className={rbBtn(false)}><AlignJustify size={16} /></button>
                  <select onChange={e => { setLineSpacing(e.target.value); e.currentTarget.selectedIndex = 0 }} title="Межстрочный интервал" aria-label="Межстрочный интервал"
                    className="h-9 w-[64px] shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white text-xs cursor-pointer">
                    <option value="" title="Интервал">1.0</option>
                    <option value="1.15">1.15</option>
                    <option value="1.5">1.5</option>
                    <option value="2.0">2.0</option>
                    <option value="3.0">3.0</option>
                  </select>
                  <button onMouseDown={keepFocus} onClick={() => cmd('indent')} title="Увеличить отступ" aria-label="Увеличить отступ" className={rbBtn(false)}><IndentIncrease size={16} /></button>
                  <button onMouseDown={keepFocus} onClick={() => cmd('outdent')} title="Уменьшить отступ" aria-label="Уменьшить отступ" className={rbBtn(false)}><IndentDecrease size={16} /></button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Стили">
                  <select onChange={e => cmd('formatBlock', e.target.value)} defaultValue="p" title="Стиль абзаца" aria-label="Стиль абзаца"
                    className="h-9 px-2 rounded-lg border bg-white dark:bg-slate-700 dark:text-white text-sm max-w-[150px] cursor-pointer">
                    <option value="p">Обычный текст</option>
                    <option value="h1">Заголовок 1</option>
                    <option value="h2">Заголовок 2</option>
                    <option value="h3">Заголовок 3</option>
                  </select>
                </RibbonGroup>
              </div>
            )}

            {/* Вставка: Ссылки | Иллюстрации | Таблицы | Страница — как у Word */}
            {tab === 'insert' && (
              <div role="toolbar" aria-label="Вставка" className="flex flex-nowrap sm:flex-wrap items-stretch gap-0 p-1.5 overflow-x-auto sm:overflow-visible scrollbar-thin">
                <RibbonGroup label="Ссылки">
                  <button onClick={insertLink} title="Вставить ссылку" aria-label="Вставить ссылку" className={rbBtn(false)}><Link2 size={16} /></button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Иллюстрации">
                  <button onClick={() => imgRef.current?.click()} title="Вставить картинку (до 2МБ)" aria-label="Вставить картинку" className={rbBtn(false)}><ImagePlus size={16} /></button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Таблицы">
                  <button onClick={() => setShowTblPicker(v => !v)} title="Вставить таблицу: выбрать строки и столбцы" aria-label="Вставить таблицу" aria-expanded={showTblPicker}
                    className={`${rbBtn(false)} ${showTblPicker ? 'bg-blue-600 text-white border-blue-600' : ''}`}><TableIcon size={16} /></button>
                  {showTblPicker && (
                    <span className="flex items-center gap-1.5 h-9 px-1">
                      <input type="number" min={1} max={10} value={tblRows} onChange={e => setTblRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                        aria-label="Строк в таблице" className="w-12 h-9 px-1 rounded-lg border dark:bg-slate-700 dark:text-white text-center" />
                      <span className="text-slate-400 dark:text-slate-500">×</span>
                      <input type="number" min={1} max={6} value={tblCols} onChange={e => setTblCols(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                        aria-label="Столбцов в таблице" className="w-12 h-9 px-1 rounded-lg border dark:bg-slate-700 dark:text-white text-center" />
                      <button onMouseDown={keepFocus} onClick={() => { insertTable(); }} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold">Вставить {tblRows}×{tblCols}</button>
                    </span>
                  )}
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Страница">
                  <button onClick={insertPageBreak} title="Разрыв страницы — начать новый лист" aria-label="Разрыв страницы" className={rbBtn(false)}><Scissors size={16} /></button>
                  <label className="flex items-center gap-1.5 text-xs font-semibold dark:text-white pl-1" title="Размер листа">
                    Лист:
                    <select value={pageSize} onChange={e => pickPage(e.target.value)} aria-label="Размер листа"
                      className="h-9 px-1.5 rounded-lg border bg-white text-slate-900 dark:bg-slate-700 dark:text-white dark:[color-scheme:dark] text-xs cursor-pointer">
                      {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                </RibbonGroup>
              </div>
            )}

            {/* контекстная вкладка Картинка — как «Средства рисования» у Word */}
            {tab === 'img' && selImg && (
              <div role="toolbar" aria-label="Настройки картинки" className="flex flex-nowrap sm:flex-wrap items-stretch gap-0 p-1.5 overflow-x-auto sm:overflow-visible scrollbar-thin">
                <RibbonGroup label="Режим">
                  <button onClick={imgFree} title="Открепить от текста — таскать мышью"
                    className={`h-9 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isFree(selImg) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}><Move size={13} /> Свободно</button>
                  <button onClick={imgInline} title="Вернуть в текст"
                    className={`h-9 px-2.5 rounded-lg text-xs font-bold ${!isFree(selImg) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>В текст</button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Размер">
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} onClick={() => imgSetWidth(p)} className={`h-9 px-2 rounded-lg text-xs font-bold ${imgW === p && !isFree(selImg) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>{p}%</button>
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

            {/* контекстная вкладка Таблица — как «Макет» у Word */}
            {tab === 'tbl' && !selImg && (
              <div role="toolbar" aria-label="Настройки таблицы" className="flex flex-nowrap sm:flex-wrap items-stretch gap-0 p-1.5 overflow-x-auto sm:overflow-visible scrollbar-thin">
                <RibbonGroup label="Строки и столбцы">
                  <button onMouseDown={keepFocus} onClick={tableAddRow} title="Добавить строку ниже" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">+ Строка</button>
                  <button onMouseDown={keepFocus} onClick={tableAddCol} title="Добавить столбец справа" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">+ Столбец</button>
                  <button onMouseDown={keepFocus} onClick={tableDelRow} title="Удалить строку" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">− Строка</button>
                  <button onMouseDown={keepFocus} onClick={tableDelCol} title="Удалить столбец" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">− Столбец</button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Данные">
                  <button onMouseDown={keepFocus} onClick={() => tblHeader()} title="Первая строка — шапка или обычная" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Шапка</button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Ячейка">
                  <button onMouseDown={keepFocus} onClick={() => tblCellAlign('left')} title="Текст ячейки слева" className="h-9 w-9 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignLeft size={14} /></button>
                  <button onMouseDown={keepFocus} onClick={() => tblCellAlign('center')} title="Текст ячейки по центру" className="h-9 w-9 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignCenter size={14} /></button>
                  <button onMouseDown={keepFocus} onClick={() => tblCellAlign('right')} title="Текст ячейки справа" className="h-9 w-9 shrink-0 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 flex items-center justify-center"><AlignRight size={14} /></button>
                  <label className="h-9 px-1.5 rounded-lg border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 cursor-pointer flex items-center gap-1 text-xs font-bold" title="Фон ячейки">
                    Фон
                    <input type="color" onChange={e => tblCellBg(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" aria-label="Фон ячейки" />
                  </label>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="Положение таблицы">
                  <button onMouseDown={keepFocus} onClick={() => tblAlign('center')} title="Таблица по центру" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Центр</button>
                  <button onMouseDown={keepFocus} onClick={() => tblFloat('left')} title="Текст обтекает слева" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Слева</button>
                  <button onMouseDown={keepFocus} onClick={() => tblFloat('right')} title="Текст обтекает справа" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Справа</button>
                  <button onMouseDown={keepFocus} onClick={() => tblFloat('')} title="Вернуть в полную ширину" className="h-9 px-2 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">В строку</button>
                </RibbonGroup>
                <RibbonSep />
                <RibbonGroup label="">
                  <button onMouseDown={keepFocus} onClick={tableDelete} className="ml-auto h-9 px-3 rounded-lg bg-red-50 text-red-600 font-bold text-xs flex items-center gap-1" title="Удалить таблицу" aria-label="Удалить таблицу"><Trash2 size={14} /> Удалить</button>
                </RibbonGroup>
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
                  className={`min-w-[44px] min-h-[44px] shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${curPage === k + 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600'}`}
                >
                  <span className="hidden sm:inline">Лист </span>{k + 1}
                </button>
              ))}
            </div>
            <button onClick={addPage} className="min-h-[44px] shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-dashed bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600" title="Добавить лист в конец">
              + Лист
            </button>
          </div>
        </div>

        {/* страница */}
        <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) focusEnd() }}>
          <div className="relative mx-auto" ref={wrapRef} style={{ maxWidth: page.maxW }}>
            {/* визуальные листы: границы по реальным стыкам абзацев, разрез — только в зазоре */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {layout.tops.map((t, k) => {
                const nx = layout.tops[k + 1]
                // полоса-шов рисуется только если зазор >= 8px; иначе листы бесшовные (граница и чип работают)
                const sliceH = nx && nx.slot >= 8 ? Math.max(6, Math.min(12, nx.slot - 2)) : 0
                const top = k === 0 ? 0 : t.top + sliceH / 2
                const bottom = nx ? nx.top - sliceH / 2 : layout.bottom
                return (
                  <div key={k} className="word-sheet" style={{ top, height: Math.max(40, bottom - top) }}>
                    <span>Стр. {k + 1}</span>
                  </div>
                )
              })}
              {layout.tops.slice(1).map((t, i) => {
                if (t.slot < 8) return null
                const sliceH = Math.max(6, Math.min(12, t.slot - 2))
                return (
                  <div key={`gap-${i}`} className="word-sheet-gap bg-slate-100 dark:bg-slate-900"
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
              onInput={() => { saveSelection(); setDirty(true); refreshCounts(); autoStash(); measureSoon(); placeHandle(); requestAnimationFrame(placeTblOverlay) }}
              onMouseUp={() => { saveSelection(); refreshCounts() }}
              onKeyUp={() => { saveSelection(); refreshCounts(); measureSoon() }}
              onKeyDown={onEditorKeyDown}
              onClick={onEditorClick}
              onPointerDown={onFreeMouseDown}
              className="word-page relative z-10 min-h-[500px] bg-transparent text-slate-900 focus:outline-none focus:ring-0 prose-sm"
              style={{ lineHeight: 1.7, minHeight: page.pageH + SHEET_PAD * 2 }}
            />
            <div ref={tblOverlayRef} className="absolute inset-0 pointer-events-none z-[6]" aria-hidden="true" />
            {selImg && handle && (
              <div className="img-handle" style={{ left: handle.x, top: handle.y }}
                onPointerDown={startResize} title="Тяни — размер фото" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          <span>Слов: {words}</span>
          <span>•</span>
          <span>{dirty ? 'Есть несохранённые изменения' : 'Всё сохранено'}</span>
          <span>•</span>
          <span>Импорт .docx до 20МБ</span>
        </div>
      </div>
      </div>
    </div>
  )
}
