import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useAccessibility } from '../context/UIContext'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link2, ImagePlus, Table as TableIcon, Eraser, Save,
  Upload, Download, Printer, Plus, Trash2, FileText, Volume2,
  Undo2, Redo2, X, MoveHorizontal, Maximize2, Minimize2, Scissors, Move,
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
const SHEET_PAD = 40 // отступ листа, совпадает с p-10
const CELL_STYLE = 'border:1px solid #94a3b8;padding:6px;min-width:40px;'

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

export default function WordEditor() {
  const { speak } = useAccessibility()
  const editRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
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
  const [showTblPicker, setShowTblPicker] = useState(false)
  const [tblRows, setTblRows] = useState(3)
  const [tblCols, setTblCols] = useState(3)
  const [pageSize, setPageSize] = useState(() => {
    const v = localStorage.getItem(LS_PAGE)
    return v && PAGE_SIZES[v] ? v : 'A4'
  })
  const [full, setFull] = useState(false)
  const [pages, setPages] = useState(1)
  const [curPage, setCurPage] = useState(1)
  const [hasDraft, setHasDraft] = useState(() => {
    try { return !!localStorage.getItem(LS_DRAFT) } catch { return false }
  })

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
  const onFreeMouseDown = (e: React.MouseEvent) => {
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
    const move = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      img.style.left = `${Math.max(0, d.origL + (ev.clientX - d.startX))}px`
      img.style.top = `${Math.max(0, d.origT + (ev.clientY - d.startY))}px`
      placeHandle()
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      dragRef.current = null
      setDirty(true)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  // уголок: тянешь — размер меняется
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const img = selImgRef.current
    if (!img) return
    const free = img.dataset.free === '1'
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width
    const base = editRef.current?.clientWidth || 1
    const move = (ev: MouseEvent) => {
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
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      setDirty(true)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
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
    if (t) lastTable.current = t
    setInTable(!!t)
  }
  const getTable = (): HTMLTableElement | null => {
    const t = curTable()
    if (t) { lastTable.current = t; return t }
    if (lastTable.current && editRef.current?.contains(lastTable.current)) return lastTable.current
    return null
  }

  const styleCell = (c: HTMLTableCellElement) => { c.style.cssText = CELL_STYLE }

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
    const r = t.insertRow()
    for (let i = 0; i < cols; i++) { const c = r.insertCell() as HTMLTableCellElement; c.innerHTML = ' '; styleCell(c) }
    setDirty(true)
  }
  const tableAddCol = () => {
    const t = getTable()
    if (!t) return
    for (const r of Array.from(t.rows)) { const c = r.insertCell() as HTMLTableCellElement; c.innerHTML = ' '; styleCell(c) }
    setDirty(true)
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
  }
  const tableDelete = () => {
    const t = getTable()
    if (!t) return
    t.remove()
    lastTable.current = null
    setInTable(false)
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

  // явная кнопка «+ Страница»: новый лист в конец + прокрутка к нему
  const addPage = () => {
    const ed = editRef.current
    if (!ed) return
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
    insertPageBreak()
    requestAnimationFrame(() => {
      try {
        const brs = ed.querySelectorAll('.page-break')
        brs[brs.length - 1]?.scrollIntoView({ block: 'center' })
      } catch {}
      updatePages()
    })
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
      if (e.key === 'Escape') {
        markSelImg(null)
        setFull(false)
      }
    }
    const onScrollResize = () => placeHandle()
    document.addEventListener('selectionchange', onSel)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', updateCurPage, { passive: true })
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    requestAnimationFrame(() => { updatePages(); updateCurPage() })
    return () => {
      document.removeEventListener('selectionchange', onSel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', updateCurPage)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
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
      if (body.replace(/<[^>]+>/g, '').trim().length === 0) return
      if (body.length > 1000000) return // с тяжёлыми картинками черновик не тащим
      localStorage.setItem(LS_DRAFT, JSON.stringify({
        title, body_html: body, page_size: pageSize, savedAt: Date.now(),
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
    } catch {}
  }

  const save = async () => {
    const body = sanitize(html())
    if (body.replace(/<[^>]+>/g, '').trim().length === 0) { alert('Пустой документ'); return }
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
    } finally { setBusy(false) }
  }

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
    if (body.replace(/<[^>]+>/g, '').trim().length === 0) { alert('Пустой документ'); return }
    try {
      const r = await client.post('/word-docs/export/', { title, body_html: body }, { responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(title || 'document').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'document'}.docx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch {
      // офлайн — скачиваем HTML
      const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`], { type: 'text/html' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(title || 'document').slice(0, 80)}.html`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    }
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
    requestAnimationFrame(updatePages)
  }

  const page = PAGE_SIZES[pageSize] || PAGE_SIZES.A4
  const pageHRef = useRef(page.pageH)
  pageHRef.current = page.pageH

  // постраничный вид: сколько листов занимает текст
  const updatePages = () => {
    try {
      const ed = editRef.current
      if (!ed) return
      const contentH = Math.max(ed.scrollHeight - SHEET_PAD * 2, page.pageH)
      setPages(Math.max(1, Math.min(50, Math.ceil(contentH / page.pageH))))
    } catch {}
  }

  const updateCurPage = () => {
    try {
      const ed = editRef.current
      if (!ed) return
      const ph = pageHRef.current
      const contentH = Math.max(ed.scrollHeight - SHEET_PAD * 2, ph)
      const total = Math.max(1, Math.min(50, Math.ceil(contentH / ph)))
      const rect = ed.getBoundingClientRect()
      const n = Math.max(1, Math.min(total, Math.floor((SHEET_PAD - rect.top) / ph) + 1))
      setCurPage(prev => (n === prev ? prev : n))
      setPages(prev => (total === prev ? prev : total))
    } catch {}
  }

  const insertPageBreak = () => {
    restoreSelection()
    try {
      document.execCommand('insertHTML', false, '<div class="page-break" contenteditable="false">Новая страница</div><p></p>')
    } catch {}
    saveSelection()
    setDirty(true)
    refreshCounts()
    requestAnimationFrame(updatePages)
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

  const fmtBtn = (isActive: boolean) =>
    `p-2 rounded-lg border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 dark:text-white hover:bg-slate-50'}`

  return (
    <div className="max-w-6xl mx-auto space-y-4 page-enter">
      <div className="flex flex-wrap items-center gap-3 animate-fadeIn">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white"><FileText size={20}/></span> Word <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{docs.length}</span></h1>
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
        <div className="mt-3 space-y-1 max-h-[50vh] overflow-auto">
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
      <div className={`flex-1 min-w-0 space-y-3 ${full ? 'fixed inset-0 z-50 overflow-auto bg-slate-100 dark:bg-slate-900 p-3 sm:p-6' : ''}`}>
        <div className="flex items-center gap-2">
          <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }}
            aria-label="Название документа" placeholder="Название документа"
            className="flex-1 px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 font-bold" />
          {!online && <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">офлайн</span>}
        </div>

        {/* тулбар */}
        <div role="toolbar" aria-label="Панель форматирования" className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-2">
          <button onMouseDown={keepFocus} onClick={() => cmd('undo')} title="Отменить" aria-label="Отменить" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><Undo2 size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('redo')} title="Вернуть" aria-label="Вернуть" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><Redo2 size={16} /></button>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
          <button onMouseDown={keepFocus} onClick={() => cmd('bold')} title="Жирный (Ctrl+B)" aria-label="Жирный" aria-pressed={!!active.bold} className={fmtBtn(!!active.bold)}><Bold size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('italic')} title="Курсив (Ctrl+I)" aria-label="Курсив" aria-pressed={!!active.italic} className={fmtBtn(!!active.italic)}><Italic size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('underline')} title="Подчёркнутый (Ctrl+U)" aria-label="Подчёркнутый" aria-pressed={!!active.underline} className={fmtBtn(!!active.underline)}><Underline size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('strikeThrough')} title="Зачёркнутый" aria-label="Зачёркнутый" aria-pressed={!!active.strikeThrough} className={fmtBtn(!!active.strikeThrough)}><Strikethrough size={16} /></button>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
          <select onChange={e => cmd('formatBlock', e.target.value)} defaultValue="p" title="Стиль абзаца" aria-label="Стиль абзаца"
            className="px-2 py-2 rounded-lg border bg-white dark:bg-slate-700 dark:text-white text-sm">
            <option value="p">Обычный</option>
            <option value="h1">Заголовок 1</option>
            <option value="h2">Заголовок 2</option>
            <option value="h3">Заголовок 3</option>
          </select>
          <select onChange={e => { cmd('fontSize', e.target.value); e.target.value = '3' }} defaultValue="3" title="Размер шрифта" aria-label="Размер шрифта"
            className="px-2 py-2 rounded-lg border bg-white dark:bg-slate-700 dark:text-white text-sm">
            <option value="2">Мелкий</option>
            <option value="3">Обычный</option>
            <option value="4">Крупный</option>
            <option value="5">Очень крупный</option>
            <option value="6">Огромный</option>
          </select>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
          <button onMouseDown={keepFocus} onClick={() => cmd('insertUnorderedList')} title="Маркированный список" aria-label="Маркированный список" aria-pressed={!!active.insertUnorderedList} className={fmtBtn(!!active.insertUnorderedList)}><List size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('insertOrderedList')} title="Нумерованный список" aria-label="Нумерованный список" aria-pressed={!!active.insertOrderedList} className={fmtBtn(!!active.insertOrderedList)}><ListOrdered size={16} /></button>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
          <button onMouseDown={keepFocus} onClick={() => cmd('justifyLeft')} title="По левому краю" aria-label="По левому краю" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><AlignLeft size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('justifyCenter')} title="По центру" aria-label="По центру" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><AlignCenter size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('justifyRight')} title="По правому краю" aria-label="По правому краю" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><AlignRight size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('justifyFull')} title="По ширине" aria-label="По ширине" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><AlignJustify size={16} /></button>
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
          <label className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white cursor-pointer" title="Цвет текста">
            <span className="text-sm font-bold underline decoration-red-500">A</span>
            <input type="color" className="sr-only" aria-label="Цвет текста" onChange={e => cmd('foreColor', e.target.value)} />
          </label>
          <label className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white cursor-pointer" title="Выделение маркером">
            <span className="text-sm font-bold bg-yellow-300 px-1 rounded">A</span>
            <input type="color" defaultValue="#ffff00" className="sr-only" aria-label="Цвет выделения" onChange={e => cmd('hiliteColor', e.target.value)} />
          </label>
          <button onClick={insertLink} title="Вставить ссылку" aria-label="Вставить ссылку" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><Link2 size={16} /></button>
          <button onClick={() => imgRef.current?.click()} title="Вставить картинку (до 2МБ)" aria-label="Вставить картинку" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><ImagePlus size={16} /></button>
          <button onClick={() => setShowTblPicker(v => !v)} title="Вставить таблицу: выбрать строки и столбцы" aria-label="Вставить таблицу" aria-expanded={showTblPicker} className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white ${showTblPicker ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}><TableIcon size={16} /></button>
          <button onMouseDown={keepFocus} onClick={() => cmd('removeFormat')} title="Очистить форматирование" aria-label="Очистить форматирование" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><Eraser size={16} /></button>
          <button onClick={insertPageBreak} title="Разрыв страницы — начать новый лист" aria-label="Разрыв страницы" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"><Scissors size={16} /></button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onImage} />
        </div>

        {/* панель картинки: размер + положение + свободное перемещение */}
        {selImg && (
          <div className="flex flex-wrap items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-3 text-sm" aria-label="Настройки картинки">
            <span className="font-bold dark:text-white flex items-center gap-1"><MoveHorizontal size={15} /> Картинка</span>
            <div className="flex gap-1" role="group" aria-label="Режим картинки">
              <button onClick={imgFree} title="Открепить от текста — таскай мышью куда хочешь"
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isFree(selImg) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>
                <Move size={12} /> Свободно
              </button>
              <button onClick={imgInline} title="Вернуть в текст"
                className={`px-2 py-1 rounded-lg text-xs font-bold ${!isFree(selImg) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>
                В текст
              </button>
            </div>
            {isFree(selImg) && <span className="text-xs text-blue-700 dark:text-blue-300">тяни фото мышью + уголок — размер</span>}
            <label className="flex items-center gap-2 dark:text-slate-200">
              Размер:
              <input type="range" min={isFree(selImg) ? 30 : 10} max={isFree(selImg) ? 1200 : 100} step={isFree(selImg) ? 10 : 5} value={imgW}
                onChange={e => imgSizeChange(parseInt(e.target.value))} aria-label="Размер картинки" className="w-32" />
              <span className="w-14 font-mono font-bold">{isFree(selImg) ? `${Math.round(imgW)}px` : `${imgW}%`}</span>
            </label>
            <div className="flex gap-1" role="group" aria-label="Положение картинки">
              {[25, 50, 75, 100].map(p => (
                <button key={p} onClick={() => imgSetWidth(p)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold ${imgW === p ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600'}`}>{p}%</button>
              ))}
            </div>
            <div className="flex gap-1" role="group" aria-label="Выравнивание картинки">
              <button onClick={() => imgAlign('left')} title="Слева, текст обтекает" aria-label="Картинка слева" className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Слева</button>
              <button onClick={() => imgAlign('center')} title="По центру" aria-label="Картинка по центру" className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Центр</button>
              <button onClick={() => imgAlign('right')} title="Справа, текст обтекает" aria-label="Картинка справа" className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">Справа</button>
            </div>
            <button onClick={imgDelete} className="ml-auto p-2 rounded-xl bg-red-50 text-red-600" title="Удалить картинку" aria-label="Удалить картинку"><X size={16} /></button>
          </div>
        )}

        {/* панель таблицы */}
        {inTable && !selImg && (
          <div className="flex flex-wrap items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-3 text-sm" aria-label="Настройки таблицы">
            <span className="font-bold dark:text-white flex items-center gap-1"><TableIcon size={15} /> Таблица</span>
            <button onMouseDown={keepFocus} onClick={tableAddRow} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">+ Строка</button>
            <button onMouseDown={keepFocus} onClick={tableAddCol} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">+ Столбец</button>
            <button onMouseDown={keepFocus} onClick={tableDelRow} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">− Строка</button>
            <button onMouseDown={keepFocus} onClick={tableDelCol} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 dark:text-white border dark:border-slate-600 text-xs font-bold">− Столбец</button>
            <button onMouseDown={keepFocus} onClick={tableDelete} className="ml-auto p-2 rounded-xl bg-red-50 text-red-600" title="Удалить таблицу" aria-label="Удалить таблицу"><Trash2 size={15} /></button>
          </div>
        )}

        {/* выбор размера новой таблицы */}
        {showTblPicker && (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-3 text-sm" aria-label="Размер новой таблицы">
            <span className="font-bold dark:text-white flex items-center gap-1"><TableIcon size={15} /> Новая таблица:</span>
            <label className="flex items-center gap-1 dark:text-slate-200">Строк
              <input type="number" min={1} max={10} value={tblRows}
                onChange={e => setTblRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                aria-label="Строк в таблице" className="w-14 px-2 py-1.5 rounded-lg border dark:bg-slate-700 dark:text-white text-center" />
            </label>
            <span className="dark:text-slate-400">×</span>
            <label className="flex items-center gap-1 dark:text-slate-200">Столбцов
              <input type="number" min={1} max={6} value={tblCols}
                onChange={e => setTblCols(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                aria-label="Столбцов в таблице" className="w-14 px-2 py-1.5 rounded-lg border dark:bg-slate-700 dark:text-white text-center" />
            </label>
            <button onClick={() => insertTable()} className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Вставить {tblRows}×{tblCols}</button>
          </div>
        )}

        {/* действия */}
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={busy} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {busy ? '...' : 'Сохранить'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Импорт .docx до 20МБ" className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2 disabled:opacity-50">
            <Upload size={16} /> Импорт .docx
          </button>
          <button onClick={onExport} title="Скачать .docx" className="px-4 py-2.5 rounded-xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-semibold flex items-center gap-2">
            <Download size={16} /> Скачать .docx
          </button>
          <button onClick={doPrint} title="Печать" aria-label="Печать документа" className="px-4 py-2.5 rounded-xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-semibold flex items-center gap-2">
            <Printer size={16} /> Печать
          </button>
          <button onClick={addPage} title="Добавить новый лист в конец документа" aria-label="Добавить страницу"
            className="px-4 py-2.5 rounded-xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-semibold flex items-center gap-2">
            <Plus size={16} /> Страница
          </button>
          <button onClick={() => text() && speak(text().slice(0, 1500))} title="Озвучить документ" aria-label="Озвучить документ" className="px-4 py-2.5 rounded-xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-semibold flex items-center gap-2">
            <Volume2 size={16} /> Слушать
          </button>
          <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm font-semibold" title="Размер листа">
            Лист:
            <select value={pageSize} onChange={e => pickPage(e.target.value)} aria-label="Размер листа"
              className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark] font-bold outline-none cursor-pointer rounded-lg px-1">
              {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <button onClick={() => setFull(f => !f)} title={full ? 'Выйти из полного экрана (Esc)' : 'Полный экран'}
            aria-label={full ? 'Выйти из полного экрана' : 'Полный экран'}
            className="px-4 py-2.5 rounded-xl bg-blue-700 dark:bg-white dark:text-slate-900 text-white font-semibold flex items-center gap-2">
            {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {full ? 'Выйти' : 'Во весь экран'}
          </button>
          <span className="px-3 py-2.5 rounded-xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm font-semibold" aria-live="polite" title="Какая страница на экране">
            Стр. {curPage} из {pages}
          </span>
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={onImport} />
        </div>

        {/* лист */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-2 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) focusEnd() }}>
          <div className="relative mx-auto" ref={wrapRef} style={{ maxWidth: page.maxW }}>
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Текст документа Word"
              onInput={() => { saveSelection(); setDirty(true); refreshCounts(); autoStash(); updatePages(); placeHandle() }}
              onMouseUp={() => { saveSelection(); refreshCounts() }}
              onKeyUp={() => { saveSelection(); refreshCounts(); updatePages() }}
              onKeyDown={onEditorKeyDown}
              onClick={onEditorClick}
              onMouseDown={onFreeMouseDown}
              className="word-page min-h-[500px] bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 prose-sm"
              style={{ lineHeight: 1.7, minHeight: page.pageH + SHEET_PAD * 2, padding: SHEET_PAD }}
            />
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {Array.from({ length: Math.max(0, pages - 1) }, (_, k) => (
                <div key={k} className="page-guide" style={{ top: SHEET_PAD + (k + 1) * page.pageH }}>
                  <span>Стр. {k + 2}</span>
                </div>
              ))}
            </div>
            {selImg && handle && (
              <div className="img-handle" style={{ left: handle.x, top: handle.y }}
                onMouseDown={startResize} title="Тяни — размер фото" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
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
