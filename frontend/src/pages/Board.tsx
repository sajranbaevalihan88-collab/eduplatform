import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { Tldraw, AssetRecordType, exportToBlob, createShapeId, toFixed } from 'tldraw'
import 'tldraw/tldraw.css'
import {
  Save, Plus, Maximize2, Download, Trash2, PenTool, PanelLeft, MoreHorizontal,
  X, Home, FolderOpen, TrendingUp, Image as ImageIcon, Highlighter, Pencil,
  Grid3X3, Sparkles, ChevronDown,
} from 'lucide-react'
import { extractPages, isLegacyBoardMeta, importLegacyPages } from '../board/legacy'
import { PenStrokeShapeUtil, type PenPoint } from '../board/PenStrokeShapeUtil'
import GraphBuilderModal from '../board/GraphBuilderModal'

const Board3D = lazy(() => import('../components/Board3D'))

const DRAFT_KEY = 'board-draft-v2'

// Локальные шрифты и переводы tldraw из /fonts/tldraw/ ('self'):
// доска запускается мгновенно, не зависит от внешнего CDN и никогда не блокируется CSP.
const TLDRAW_ASSET_URLS = {
  fonts: {
    draw: '/fonts/tldraw/Shantell_Sans-Tldrawish.woff2',
    serif: '/fonts/tldraw/IBMPlexSerif-Medium.woff2',
    sansSerif: '/fonts/tldraw/IBMPlexSans-Medium.woff2',
    monospace: '/fonts/tldraw/IBMPlexMono-Medium.woff2',
  },
  translations: {
    ru: '/fonts/tldraw/ru.json',
    en: '/fonts/tldraw/en.json',
  },
}

const CUSTOM_SHAPE_UTILS = [PenStrokeShapeUtil]

const PEN_SWATCHES = [
  '#0f172a', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#10b981', '#06b6d4', '#2563eb', '#7c3aed', '#ec4899',
]

const PEN_SIZE_PRESETS = [2, 5, 12, 24]

type BgStyle = 'plain' | 'grid' | 'lines' | 'dots' | 'chalk'

const BG_OPTIONS: { id: BgStyle; label: string; dot: string }[] = [
  { id: 'plain', label: 'Белая', dot: '#ffffff' },
  { id: 'grid', label: 'Клетка', dot: '#e0e7ff' },
  { id: 'lines', label: 'Линейка', dot: '#dbeafe' },
  { id: 'dots', label: 'Точки', dot: '#e2e8f0' },
  { id: 'chalk', label: 'Меловая', dot: '#113325' },
]

function readDraft2(): { snap: any; title: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d?.snap?.document?.store || d?.snap?.store) return d
  } catch { }
  return null
}

export default function Board() {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const [boards, setBoards] = useState<any[]>([])
  const [title, setTitle] = useState<string>(() => readDraft2()?.title || t('board_new'))
  const [boardId, setBoardId] = useState<null | number>(null)
  const [initSnap, setInitSnap] = useState<any>(() => readDraft2()?.snap || null)
  const [pendingImport, setPendingImport] = useState<{ pages: string[]; target: number } | null>(null)
  const [draft, setDraft] = useState<boolean>(() => !!readDraft2())
  const editorRef = useRef<any>(null)
  const dirtyRef = useRef(false)
  const lastDrawRef = useRef(0)
  const [resetKey, setResetKey] = useState(0)
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [isFullscreen, setIsFullscreen] = useState(() => {
    try { return window.matchMedia('(max-width: 639px)').matches } catch { return false }
  })
  const [hideSidebarLocal, setHideSidebarLocal] = useState(false)
  const [showBoards, setShowBoards] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [bgStyle, setBgStyle] = useState<BgStyle>('grid')
  const [bgMenuOpen, setBgMenuOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [laserOn, setLaserOn] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<any>(null)
  const imgInputRef = useRef<HTMLInputElement | null>(null)
  const bgMenuRef = useRef<HTMLDivElement | null>(null)
  const langRef = useRef(lang)
  langRef.current = lang

  // Регулируемый карандаш/маркер: произвольный цвет HEX + плавный размер 1..40 px
  const [penColor, setPenColor] = useState<string>('#0f172a')
  const [penSize, setPenSize] = useState<number>(4)
  const [penMode, setPenMode] = useState<'pen' | 'highlighter'>('pen')
  const [activeToolId, setActiveToolId] = useState<string>('draw')
  // На телефоне панель карандаша стартует свёрнутой в аккуратную кнопку, чтобы не перекрывать холст и меню Page 1
  const [penPanelOpen, setPenPanelOpen] = useState<boolean>(() => {
    try { return !window.matchMedia('(max-width: 639px)').matches } catch { return true }
  })

  const penColorRef = useRef(penColor)
  penColorRef.current = penColor
  const penSizeRef = useRef(penSize)
  penSizeRef.current = penSize
  const penModeRef = useRef(penMode)
  penModeRef.current = penMode
  const activeToolRef = useRef(activeToolId)
  activeToolRef.current = activeToolId

  const drawingRef = useRef<{
    shapeId: any
    originX: number
    originY: number
    points: PenPoint[]
    markId: string
    raf: number
    pendingPt: PenPoint | null
  } | null>(null)

  const isCustomPenActive = mode === '2d' && activeToolId === 'draw'

  useEffect(() => {
    try { editorRef.current?.user.updateUserPreferences({ locale: lang === 'en' ? 'en' : 'ru' }) } catch { }
  }, [lang])

  useEffect(() => {
    if (!bgMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (bgMenuRef.current && !bgMenuRef.current.contains(e.target as Node)) setBgMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [bgMenuOpen])

  // При выборе тёмной «Меловой» доски автоматически переключаем чёрный карандаш на белый мел (и наоборот)
  const selectBgStyle = (next: BgStyle) => {
    setBgStyle(next)
    setBgMenuOpen(false)
    if (next === 'chalk' && (penColor === '#0f172a' || penColor === '#000000')) {
      setPenColor('#ffffff')
    } else if (next !== 'chalk' && penColor === '#ffffff') {
      setPenColor('#0f172a')
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  const activatePenTool = (nextMode?: 'pen' | 'highlighter') => {
    if (nextMode) setPenMode(nextMode)
    setLaserOn(false)
    setActiveToolId('draw')
    try { editorRef.current?.setCurrentTool('draw') } catch { }
  }

  const addImageAsset = (editor: any, src: string, w: number, h: number, name: string, mime = 'image/png') => {
    const asset = AssetRecordType.create({
      id: AssetRecordType.createId(),
      type: 'image',
      props: { src, w, h, name, mimeType: mime, isAnimated: false },
    })
    editor.createAssets([asset])
    const c = editor.getViewportPageBounds().center
    editor.createShape({ type: 'image', x: c.x - w / 2, y: c.y - h / 2, props: { assetId: asset.id, w, h } as any })
  }

  const flushDraft = () => {
    if (!editorRef.current || !dirtyRef.current) return
    try { if (drawingRef.current || editorRef.current.getInstanceState().isDrawing) { lastDrawRef.current = performance.now(); return } } catch { }
    if (performance.now() - lastDrawRef.current < 2500) return
    const doFlush = () => {
      try {
        if (!editorRef.current) return
        const snap = editorRef.current.getSnapshot()
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ fmt: 2, snap, title: title || t('board_new'), savedAt: Date.now() }))
      } catch { }
    }
    try {
      const ric = (window as any).requestIdleCallback
      if (ric) ric(doFlush, { timeout: 2500 })
      else setTimeout(doFlush, 300)
    } catch {
      doFlush()
    }
  }

  const onMount = (editor: any) => {
    editorRef.current = editor
      ; (window as any).__tlEd = editor
    try { editor.user.updateUserPreferences({ locale: langRef.current === 'en' ? 'en' : 'ru' }) } catch { }
    try { editor.updateInstanceState({ isGridMode: false }) } catch { }
    try { editor.updateInstanceState({ debugMode: false } as any) } catch { }
    // По умолчанию сразу активен удобный регулируемый карандаш
    try { editor.setCurrentTool('draw') } catch { }
    setActiveToolId('draw')

    let pending = 0
    editor.store.listen(() => {
      try {
        const cur = editor.getCurrentToolId()
        if (cur && cur !== activeToolRef.current) {
          activeToolRef.current = cur
          setActiveToolId(cur)
          setLaserOn(cur === 'laser')
        }
      } catch { }
    }, { scope: 'session' })

    editor.store.listen(() => {
      if (pending) return
      pending = requestAnimationFrame(() => {
        pending = 0
        dirtyRef.current = true
      })
    }, { scope: 'document' })

    if (pendingImport) {
      const pi = pendingImport
      setPendingImport(null)
      setDraft(true)
      importLegacyPages(editor, pi.pages, pi.target, (n: number) => langRef.current === 'en' ? `Sheet ${n}` : `Лист ${n}`)
      return
    }
    if (initSnap) {
      try { editor.loadSnapshot(initSnap); setDraft(true) } catch {
        try { localStorage.removeItem(DRAFT_KEY) } catch { }
        setInitSnap(null)
        setDraft(false)
      }
    }
  }

  useEffect(() => {
    client.get('/boards/').then((r: any) => setBoards(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => { })
    const iv = setInterval(flushDraft, 30000)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (graphOpen) { setGraphOpen(false); return }
        if (isFullscreen) { setShowActions(false); setIsFullscreen(false) }
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        try {
          const snap = editorRef.current?.getSnapshot()
          if (snap) localStorage.setItem(DRAFT_KEY, JSON.stringify({ fmt: 2, snap, title: title || t('board_new'), savedAt: Date.now() }))
        } catch { }
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis)
      if (dirtyRef.current) {
        try {
          const snap = editorRef.current?.getSnapshot()
          if (snap) localStorage.setItem(DRAFT_KEY, JSON.stringify({ fmt: 2, snap, title: title || t('board_new'), savedAt: Date.now() }))
        } catch { }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, title, graphOpen])

  // ——— Плавное рисование нашим регулируемым карандашом / маркером поверх tldraw ———
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (mode !== '2d' || activeToolRef.current !== 'draw') return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (!e.isPrimary) return
    const ed = editorRef.current
    if (!ed) return
    const target = e.target as Element | null
    if (!target || !target.closest('.tl-canvas')) return
    // Не перехватываем клики по UI-элементам tldraw или нашему тулбару
    if (target.closest('.tlui-layout, [data-pen-panel], button, input')) return

    e.preventDefault()
    e.stopPropagation()
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { }

    let pagePt: PenPoint = { x: 0, y: 0 }
    try { pagePt = ed.screenToPage({ x: e.clientX, y: e.clientY }) } catch { }

    const shapeId = createShapeId()
    const markId = 'pen-' + Math.random().toString(36).slice(2, 8)
    const effectiveWidth = penModeRef.current === 'highlighter'
      ? Math.max(12, Math.round(penSizeRef.current * 2.2))
      : penSizeRef.current

    try { ed.mark(markId) } catch { }
    try {
      ed.createShape({
        id: shapeId,
        type: 'pen-stroke',
        x: toFixed(pagePt.x),
        y: toFixed(pagePt.y),
        props: {
          color: penColorRef.current,
          strokeWidth: effectiveWidth,
          isHighlighter: penModeRef.current === 'highlighter',
          points: [{ x: 0, y: 0 }],
        },
      })
    } catch {
      return
    }

    drawingRef.current = {
      shapeId,
      originX: pagePt.x,
      originY: pagePt.y,
      points: [{ x: 0, y: 0 }],
      markId,
      raf: 0,
      pendingPt: null,
    }
    dirtyRef.current = true
    lastDrawRef.current = performance.now()
  }

  const flushPenMove = () => {
    const d = drawingRef.current
    const ed = editorRef.current
    if (!d || !ed || !d.pendingPt) return
    const pt = d.pendingPt
    d.pendingPt = null
    const lx = toFixed(pt.x - d.originX)
    const ly = toFixed(pt.y - d.originY)
    const last = d.points[d.points.length - 1]
    if (last && Math.hypot(lx - last.x, ly - last.y) < 1.2) return
    d.points = [...d.points, { x: lx, y: ly }]
    try {
      ed.updateShape({
        id: d.shapeId,
        type: 'pen-stroke',
        props: { points: d.points },
      })
    } catch { }
    lastDrawRef.current = performance.now()
  }

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const d = drawingRef.current
    if (!d || !editorRef.current) return
    e.preventDefault()
    e.stopPropagation()
    try {
      const pagePt = editorRef.current.screenToPage({ x: e.clientX, y: e.clientY })
      d.pendingPt = { x: pagePt.x, y: pagePt.y }
      if (!d.raf) {
        d.raf = requestAnimationFrame(() => {
          if (drawingRef.current) drawingRef.current.raf = 0
          flushPenMove()
        })
      }
    } catch { }
  }

  const finishPenStroke = (e?: React.PointerEvent) => {
    const d = drawingRef.current
    if (!d) return
    if (d.raf) { cancelAnimationFrame(d.raf); d.raf = 0 }
    flushPenMove()
    drawingRef.current = null
    if (e) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { }
    }
    try { editorRef.current?.squashToMark(d.markId) } catch { }
    dirtyRef.current = true
  }

  const save = async () => {
    if (!editorRef.current) return
    try {
      const editor = editorRef.current
      try { editor.deselectAll() } catch { }
      const snap = editor.getSnapshot()
      if (JSON.stringify(snap).length > 3500000) {
        showToast(t('board_too_big'))
        return
      }
      const pagesAll = editor.getPages()
      const data = {
        fmt: 2,
        tldraw: snap,
        mode,
        pages: pagesAll.length,
        currentPage: Math.max(0, pagesAll.findIndex((p: any) => p.id === editor.getCurrentPageId())),
      }
      if (boardId) {
        await client.patch(`/boards/${boardId}/`, { title: title || t('board_new'), data })
      } else {
        const r = await client.post('/boards/', { title: title || t('board_new'), data })
        setBoardId(r.data.id)
      }
      dirtyRef.current = false
      setDraft(false)
      try { localStorage.removeItem(DRAFT_KEY) } catch { }
      try { localStorage.removeItem('board-draft-v1') } catch { }
      client.get('/boards/').then((r: any) => setBoards(Array.isArray(r.data) ? r.data : r.data.results || []))
      showToast(t('board_saved'))
    } catch (e: any) {
      showToast(e.response?.data?.detail || e.response?.data?.[0] || t('board_save_err'))
    }
  }

  const loadBoard = (b: any) => {
    if (b.id === boardId) return
    setBoardId(b.id)
    setTitle(b.title)
    setMode('2d')
    if (isLegacyBoardMeta(b)) {
      const { pages, target } = extractPages(b.data)
      setInitSnap(null)
      setPendingImport({ pages, target })
      setResetKey(k => k + 1)
      return
    }
    const t2 = b?.data?.tldraw
    const snap = t2 && (t2.store || t2.document?.store) ? t2 : null
    if (snap && editorRef.current) {
      try { editorRef.current.loadSnapshot(snap) } catch { showToast(t('board_save_err')) }
      dirtyRef.current = true
      try { editorRef.current.zoomToFit({ animationDuration: 0 }) } catch { }
    }
  }

  const newBoard = () => {
    if (dirtyRef.current && !window.confirm(t('board_new_confirm'))) return
    try { localStorage.removeItem(DRAFT_KEY) } catch { }
    try { localStorage.removeItem('board-draft-v1') } catch { }
    dirtyRef.current = false
    setDraft(false)
    setBoardId(null)
    setInitSnap(null)
    setPendingImport(null)
    setTitle(t('board_new'))
    setResetKey(k => k + 1)
  }

  const download = async () => {
    const editor = editorRef.current
    if (!editor) return
    try {
      editor.deselectAll()
      const blob = await exportToBlob({
        editor,
        ids: editor.getCurrentPageShapeIds(),
        format: 'png',
        opts: { background: true, scale: 1, padding: 32 } as any,
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `board-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      showToast(t('board_save_err'))
    }
  }

  const clearPage = () => {
    const editor = editorRef.current
    if (!editor) return
    try { editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()) as any) } catch { }
    dirtyRef.current = true
  }

  const on3dSnapshot = (dataUrl: string) => {
    const editor = editorRef.current
    if (!editor) return
    const img = new Image()
    img.onload = () => {
      try {
        const natW = img.naturalWidth || 1200
        const natH = img.naturalHeight || 700
        const scale = 1400 / Math.max(1, natW)
        addImageAsset(editor, dataUrl, Math.round(natW * scale), Math.round(natH * scale), `3d-${Date.now()}`)
        setMode('2d')
        dirtyRef.current = true
        showToast(t('bd3_saved'))
      } catch { }
    }
    img.src = dataUrl
  }

  const onInsertImageFile = (file: File | null) => {
    const editor = editorRef.current
    if (!editor || !file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const img = new Image()
      img.onload = () => {
        const maxW = 520
        const ratio = Math.min(1, maxW / Math.max(1, img.naturalWidth))
        addImageAsset(editor, dataUrl, Math.round(img.naturalWidth * ratio), Math.round(img.naturalHeight * ratio), file.name, file.type || 'image/png')
        dirtyRef.current = true
        showToast(`Картинка «${file.name}» вставлена ✓`)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const toggleLaserTool = () => {
    const editor = editorRef.current
    if (!editor) return
    const next = !laserOn
    setLaserOn(next)
    setActiveToolId(next ? 'laser' : 'draw')
    try { editor.setCurrentTool(next ? 'laser' : 'draw') } catch { }
  }

  const bgPatternStyle: React.CSSProperties =
    mode !== '2d' || bgStyle === 'plain'
      ? {}
      : bgStyle === 'grid'
        ? {
          backgroundImage: 'linear-gradient(to right, rgba(99,102,241,0.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.13) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }
        : bgStyle === 'lines'
          ? {
            backgroundImage: 'linear-gradient(to bottom, rgba(59,130,246,0.2) 1px, transparent 1px)',
            backgroundSize: '100% 34px',
          }
          : bgStyle === 'dots'
            ? {
              backgroundImage: 'radial-gradient(rgba(71,85,105,0.28) 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px',
            }
            : {
              backgroundColor: '#113325',
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }

  const tldrawComponents = useMemo(() => {
    if (mode === '3d') {
      return {
        Toolbar: null, StylePanel: null, TopPanel: null, SharePanel: null, NavigationPanel: null,
        PageMenu: null, MainMenu: null, ActionsMenu: null, HelpMenu: null, ContextMenu: null,
        QuickActions: null, KeyboardShortcutsDialog: null, MenuPanel: null, HelperButtons: null, ZoomMenu: null,
      } as any
    }
    // Когда активен наш регулируемый карандаш, скрываем стандартную панель tldraw (S/M/L/XL),
    // чтобы справа была одна удобная панель с плавным размером 1–40 px и палитрой любых цветов.
    // Для стрелок, текста и фигур tldraw его панель стилей появляется автоматически.
    return isCustomPenActive
      ? ({ SharePanel: null, DebugMenu: null, DebugPanel: null, StylePanel: null } as any)
      : ({ SharePanel: null, DebugMenu: null, DebugPanel: null } as any)
  }, [mode, isCustomPenActive])

  const currentBgLabel = BG_OPTIONS.find(b => b.id === bgStyle)?.label || 'Клетка'
  const effectivePreviewPx = penMode === 'highlighter'
    ? Math.min(28, Math.max(10, Math.round(penSize * 1.4)))
    : Math.min(28, Math.max(3, penSize))

  const tldrawArea = (
    <div
      className={`relative rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden ${bgStyle === 'chalk' && mode === '2d'
        ? 'bg-[#113325] [&_.tl-background]:!bg-transparent'
        : bgStyle !== 'plain' && mode === '2d'
          ? 'bg-white [&_.tl-background]:!bg-transparent'
          : 'bg-white'
        } ${isFullscreen ? 'flex-1 min-h-0' : 'h-full w-full'} ${isCustomPenActive ? '[&_.tl-canvas]:!cursor-crosshair' : ''}`}
      style={bgPatternStyle}
      onPointerDownCapture={onCanvasPointerDown}
      onPointerMoveCapture={onCanvasPointerMove}
      onPointerUpCapture={finishPenStroke}
      onPointerCancelCapture={finishPenStroke}
    >
      <div className="absolute inset-0">
        <Tldraw
          key={resetKey}
          assetUrls={TLDRAW_ASSET_URLS}
          shapeUtils={CUSTOM_SHAPE_UTILS}
          onMount={onMount}
          components={tldrawComponents}
        />
      </div>

      {/* Плавающая панель карандаша: плавный размер 1–40 px + выбор любого цвета */}
      {mode === '2d' && (
        <div
          data-pen-panel="1"
          onPointerDown={e => e.stopPropagation()}
          className={`absolute right-2.5 sm:right-3 z-30 select-none ${penPanelOpen ? 'top-14 sm:top-3' : 'top-2.5 sm:top-3'}`}
        >
          {penPanelOpen ? (
            <div className="w-[228px] sm:w-[236px] max-w-[calc(100vw-24px)] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-xl p-3 space-y-3">
              {/* Переключатель Карандаш / Маркер */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-2 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => activatePenTool('pen')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${isCustomPenActive && penMode === 'pen'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                      }`}
                  >
                    <Pencil size={13} /> Карандаш
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePenTool('highlighter')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${isCustomPenActive && penMode === 'highlighter'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                      }`}
                  >
                    <Highlighter size={13} /> Маркер
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPenPanelOpen(false)}
                  aria-label="Свернуть панель карандаша"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
                  title="Свернуть"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Регулируемый размер карандаша (1–40 px) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Размер</span>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <span
                        className="rounded-full transition-all"
                        style={{
                          width: `${effectivePreviewPx}px`,
                          height: `${effectivePreviewPx}px`,
                          backgroundColor: penColor,
                          opacity: penMode === 'highlighter' ? 0.45 : 1,
                          border: penColor.toLowerCase() === '#ffffff' ? '1px solid #94a3b8' : undefined,
                        }}
                      />
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white w-10 text-right">
                      {penSize} px
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={penSize}
                  onChange={e => { setPenSize(Number(e.target.value)); activatePenTool() }}
                  aria-label="Размер карандаша"
                  className="w-full accent-indigo-600 cursor-pointer h-2 rounded-lg"
                />
                <div className="grid grid-cols-4 gap-1">
                  {PEN_SIZE_PRESETS.map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => { setPenSize(sz); activatePenTool() }}
                      className={`py-1 rounded-lg text-[11px] font-mono font-bold border transition ${penSize === sz
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      {sz}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Цвет карандаша: быстрые цвета + выбор любого цвета */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Цвет</span>
                  <label className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-indigo-400 transition">
                    <input
                      type="color"
                      value={penColor}
                      onChange={e => { setPenColor(e.target.value); activatePenTool() }}
                      aria-label="Выбрать произвольный цвет карандаша"
                      className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0"
                    />
                    <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase">
                      {penColor}
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {PEN_SWATCHES.map(hex => {
                    const selected = penColor.toLowerCase() === hex.toLowerCase()
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => { setPenColor(hex); activatePenTool() }}
                        aria-label={`Цвет ${hex}`}
                        className={`h-7 rounded-lg border transition-transform ${selected
                          ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 scale-105 border-slate-400'
                          : 'border-slate-300/80 dark:border-slate-600 hover:scale-105'
                          }`}
                        style={{ backgroundColor: hex }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setPenPanelOpen(true); activatePenTool() }}
              className="px-2.5 sm:px-3 py-2 min-h-[38px] rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 sm:gap-2 hover:border-indigo-400 transition"
              title="Открыть настройки карандаша"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                style={{ backgroundColor: penColor }}
              />
              {penMode === 'highlighter' ? <Highlighter size={13} className="text-amber-500 shrink-0" /> : <Pencil size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
              <span className="hidden sm:inline">{penMode === 'highlighter' ? 'Маркер' : 'Карандаш'} ·</span>
              <span className="font-mono">{penSize}px</span>
            </button>
          )}
        </div>
      )}

      {mode === '3d' && (
        <div className="absolute inset-0 z-10 bg-slate-100">
          <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Загрузка 3D…</div>}>
            <Board3D onSnapshot={on3dSnapshot} />
          </Suspense>
        </div>
      )}
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col">
        <div className="h-14 sm:h-12 shrink-0 bg-slate-900 text-white flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
          <button onClick={() => nav('/')} aria-label={t('home')} title={t('home')}
            className="shrink-0 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <Home size={18} />
          </button>
          <span className="font-bold hidden sm:inline text-sm">{title}</span>
          <div className="hidden sm:flex p-0.5 rounded-lg bg-white/10 text-xs font-bold">
            <button onClick={() => { flushDraft(); setMode('2d') }} className={`px-2.5 py-1 rounded-md ${mode === '2d' ? 'bg-white text-slate-900' : 'text-white/75'}`}>2D</button>
            <button onClick={() => { flushDraft(); setMode('3d') }} className={`px-2.5 py-1 rounded-md ${mode === '3d' ? 'bg-white text-slate-900' : 'text-white/75'}`}>3D</button>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} aria-label={t('board_title')}
            className="sm:hidden flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white/10 text-white text-sm font-medium placeholder:text-white/50" />
          <div className="ml-auto flex items-center gap-2">
            {mode === '2d' && (
              <button onClick={() => setGraphOpen(true)} className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold items-center gap-1.5">
                <TrendingUp size={15} /> График
              </button>
            )}
            <button onClick={save} aria-label={t('save')} className="px-3.5 py-2 min-h-[38px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <Save size={15} /> <span className="hidden sm:inline">{t('save')}</span>
            </button>
            <button onClick={() => setShowActions(v => !v)} aria-label={t('board_actions')} aria-expanded={showActions}
              className="sm:hidden w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <MoreHorizontal size={20} />
            </button>
            <button onClick={() => setIsFullscreen(false)} className="hidden sm:flex px-3.5 py-2 min-h-[38px] rounded-lg bg-white text-slate-900 text-xs font-bold">{t('board_exit_esc')}</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-2 flex flex-col">{tldrawArea}</div>

        {showActions && (
          <div className="absolute inset-0 z-[1100] sm:hidden">
            <button onClick={() => setShowActions(false)} aria-label={t('board_hide')} className="absolute inset-0 bg-slate-950/45" />
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-slate-900 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold dark:text-white">{t('board_actions')}</span>
                <button onClick={() => setShowActions(false)} aria-label={t('board_hide')} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white flex items-center justify-center"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 mb-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button onClick={() => { flushDraft(); setMode('2d'); setShowActions(false) }} className={`min-h-[44px] rounded-lg text-sm font-bold ${mode === '2d' ? 'bg-white dark:bg-slate-700 dark:text-white shadow' : 'text-slate-500'}`}>{t('board_2d')}</button>
                <button onClick={() => { flushDraft(); setMode('3d'); setShowActions(false) }} className={`min-h-[44px] rounded-lg text-sm font-bold ${mode === '3d' ? 'bg-white dark:bg-slate-700 dark:text-white shadow' : 'text-slate-500'}`}>{t('board_3d')}</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setMode('2d'); setShowActions(false); setGraphOpen(true) }} className="min-h-[48px] px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-bold flex items-center justify-center gap-1.5"><TrendingUp size={16} /> График и оси</button>
                <button onClick={() => { flushDraft(); setShowActions(false); setIsFullscreen(false); setShowBoards(true) }} className="min-h-[48px] px-3 rounded-xl border dark:border-slate-700 dark:text-white text-sm font-bold">🗂 {t('board_mine_short')}</button>
                <button onClick={() => { newBoard(); setShowActions(false) }} className="min-h-[48px] px-3 rounded-xl bg-orange-500 text-white text-sm font-bold flex items-center justify-center gap-1.5"><Plus size={16} />{t('board_new')}</button>
                <button onClick={() => { download(); setShowActions(false) }} className="min-h-[48px] px-3 rounded-xl border dark:border-slate-700 dark:text-white text-sm font-bold flex items-center justify-center gap-1.5"><Download size={16} />PNG</button>
                <button onClick={() => { clearPage(); setShowActions(false) }} className="col-span-2 min-h-[44px] px-3 rounded-xl border text-rose-600 border-rose-200 bg-rose-50 text-sm font-bold flex items-center justify-center gap-1.5"><Trash2 size={16} />{t('board_clear_sheet')}</button>
              </div>
            </div>
          </div>
        )}
        <GraphBuilderModal
          open={graphOpen}
          onClose={() => setGraphOpen(false)}
          onInsert={(url, sz, label) => {
            if (!editorRef.current) return
            addImageAsset(editorRef.current, url, sz, sz, `graph-${Date.now()}`)
            dirtyRef.current = true
            showToast(`${label} добавлен на доску ✓`)
          }}
        />
        {toast && <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1200] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm shadow-xl">{toast}</div>}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Единая чистая верхняя панель без лишнего нагромождения */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/70 dark:border-slate-800">
        <button
          onClick={() => nav('/')}
          aria-label={t('home')}
          title={t('home')}
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center shrink-0"
        >
          <Home size={16} />
        </button>

        <button
          onClick={() => { setHideSidebarLocal(v => !v); window.dispatchEvent(new CustomEvent('toggle-sidebar')) }}
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center shrink-0"
          title={hideSidebarLocal ? t('board_show_menu') : t('board_hide_tabs')}
        >
          <PanelLeft size={16} />
        </button>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-semibold w-[140px] sm:w-[175px] focus:outline-none focus:border-indigo-500"
        />
        {draft && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold" title={t('board_draft_hint')}>
            {t('board_draft_chip')}
          </span>
        )}

        {/* Переключатель 2D / 3D */}
        <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
          <button
            onClick={() => { flushDraft(); setMode('2d') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === '2d' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            2D Доска
          </button>
          <button
            onClick={() => { flushDraft(); setMode('3d') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === '3d' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            3D Фигуры
          </button>
        </div>

        {/* Инструменты 2D — только самое полезное, компактно в одну строку */}
        {mode === '2d' && (
          <>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            {/* Компактный выбор фона доски */}
            <div className="relative" ref={bgMenuRef}>
              <button
                type="button"
                onClick={() => setBgMenuOpen(v => !v)}
                className="px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <Grid3X3 size={14} />
                <span>Фон: {currentBgLabel}</span>
                <ChevronDown size={13} className="opacity-60" />
              </button>
              {bgMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-[600] w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1 space-y-0.5">
                  {BG_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectBgStyle(opt.id)}
                      className={`w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold flex items-center gap-2 transition ${bgStyle === opt.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                      <span className="w-4 h-4 rounded border border-slate-300 shrink-0" style={{ backgroundColor: opt.dot }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setGraphOpen(true)}
              className="px-3 py-1.5 min-h-[36px] rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <TrendingUp size={14} /> График и оси
            </button>

            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { onInsertImageFile(e.target.files?.[0] || null); (e.target as HTMLInputElement).value = '' }}
            />
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              className="px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ImageIcon size={14} /> Картинка
            </button>

            <button
              type="button"
              onClick={toggleLaserTool}
              className={`px-3 py-1.5 min-h-[36px] rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${laserOn
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
            >
              <Sparkles size={14} /> Указка
            </button>
          </>
        )}

        {/* Правые действия */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={newBoard}
            title={t('board_new')}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={download}
            title={t('board_download')}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            <Download size={16} />
          </button>
          <button
            onClick={clearPage}
            title={t('board_clear_sheet')}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 flex items-center justify-center"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => { flushDraft(); setIsFullscreen(true) }}
            title={t('board_fullscreen_btn')}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={() => setShowBoards(v => !v)}
            className="px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <FolderOpen size={14} />
            <span className="hidden xl:inline">{t('board_mine')}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">{boards.length}</span>
          </button>
          <button
            onClick={save}
            className="px-3.5 py-1.5 min-h-[36px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Save size={14} /> {t('save')}
          </button>
        </div>
      </div>

      {/* Основная рабочая область доски */}
      <div className="flex-1 min-h-0 p-2">{tldrawArea}</div>

      {/* Модальное окно удобного построителя графиков и осей */}
      <GraphBuilderModal
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        onInsert={(url, sz, label) => {
          if (!editorRef.current) return
          addImageAsset(editorRef.current, url, sz, sz, `graph-${Date.now()}`)
          dirtyRef.current = true
          showToast(`${label} добавлен на доску ✓`)
        }}
      />

      {/* Список сохранённых досок */}
      {showBoards && (
        <div className="absolute top-14 right-3 z-[600] w-80 max-w-[calc(100vw-24px)] max-h-[78vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h3 className="font-bold text-sm dark:text-white flex items-center gap-1.5"><PenTool size={14} /> {t('board_mine')}</h3>
            <button onClick={() => setShowBoards(false)} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white text-xs font-semibold">{t('board_hide')}</button>
          </div>
          <div className="p-3 space-y-2 overflow-auto">
            <div className="text-xs text-slate-500">{t('board_private_hint')}</div>
            {boards.map(b => (
              <button
                key={b.id}
                onClick={() => { loadBoard(b); setShowBoards(false) }}
                className={`w-full text-left p-3 rounded-xl border hover:shadow-sm transition ${b.id === boardId
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
              >
                <div className="font-semibold text-sm line-clamp-1 dark:text-white">{b.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{new Date(b.created_at).toLocaleDateString()} • {b.data?.mode || '2d'}</div>
              </button>
            ))}
            {boards.length === 0 && <div className="text-sm text-slate-400 text-center py-6">{t('board_empty_a')}{t('save')}</div>}
          </div>
        </div>
      )}
      {showBoards && <div className="fixed inset-0 z-[590]" onClick={() => setShowBoards(false)} />}
      {mode === '3d' && <div className="shrink-0 text-xs text-center text-slate-500 pb-1">{t('bd3_hint')}</div>}
      {toast && <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[950] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-xl">{toast}</div>}
    </div>
  )
}
