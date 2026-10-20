import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { Tldraw, AssetRecordType, exportToBlob } from 'tldraw'
import 'tldraw/tldraw.css'
import { Save, Plus, Maximize2, Download, Trash2, PenTool, PanelLeft } from 'lucide-react'
import { extractPages, isLegacyBoardMeta, importLegacyPages } from '../board/legacy'

const Board3D = lazy(() => import('../components/Board3D'))

const DRAFT_KEY = 'board-draft-v2'

// ——— (старая геометрия разрезания удалена — ластик теперь работает как в Paint) ———
type Pt = { x: number; y: number }

function readDraft2(): { snap: any; title: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d?.snap?.document?.store || d?.snap?.store) return d
  } catch {}
  return null
}

export default function Board() {
  const { t, lang } = useLang()
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideSidebarLocal, setHideSidebarLocal] = useState(false)
  const [showBoards, setShowBoards] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<any>(null)
  const langRef = useRef(lang)
  langRef.current = lang

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
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
    // не дёргаем снапшот прямо во время рисования — иначе подлагивания
    try { if (editorRef.current.getInstanceState().isDrawing) { lastDrawRef.current = performance.now(); return } } catch {}
    if (performance.now() - lastDrawRef.current < 2500) return
    const doFlush = () => {
      try {
        if (!editorRef.current) return
        const snap = editorRef.current.getSnapshot()
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ fmt: 2, snap, title: title || t('board_new'), savedAt: Date.now() }))
      } catch {}
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
    ;(window as any).__tlEd = editor
    try { editor.user.updateUserPreferences({ locale: langRef.current === 'en' ? 'en' : 'ru' }) } catch {}
    try { editor.updateInstanceState({ isGridMode: false }) } catch {}
    // батчим: на каждый кадр максимум один колбэк — иначе на больших досках кисть отстаёт
    let pending = 0
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
    // черновик грузим вручную: битый снапшот не должен ронять всю доску
    if (initSnap) {
      try { editor.loadSnapshot(initSnap); setDraft(true) } catch {
        try { localStorage.removeItem(DRAFT_KEY) } catch {}
        setInitSnap(null)
        setDraft(false)
      }
    }
  }

  useEffect(() => {
    client.get('/boards/').then((r: any) => setBoards(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    const iv = setInterval(flushDraft, 30000)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
      if (e.key === 'Escape') {
        clipToolRef.current = null; setClipToolS(null); setAxesOpen(false)
        partToolRef.current = false; setPartToolS(false)
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        try {
          const snap = editorRef.current?.getSnapshot()
          if (snap) localStorage.setItem(DRAFT_KEY, JSON.stringify({ fmt: 2, snap, title: title || t('board_new'), savedAt: Date.now() }))
        } catch {}
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis)
      if (dirtyRef.current) {
        try {
          const snap = editorRef.current?.getSnapshot()
          if (snap) localStorage.setItem(DRAFT_KEY, JSON.stringify({ fmt: 2, snap, title: title || t('board_new'), savedAt: Date.now() }))
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, title])

  const save = async () => {
    if (!editorRef.current) return
    try {
      const editor = editorRef.current
      try { editor.deselectAll() } catch {}
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
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      try { localStorage.removeItem('board-draft-v1') } catch {}
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
      try {
        editorRef.current.loadSnapshot(snap)
      } catch {
        showToast(t('board_save_err'))
      }
      dirtyRef.current = true
      try { editorRef.current.zoomToFit({ animationDuration: 0 }) } catch {}
    }
  }

  const newBoard = () => {
    if (dirtyRef.current && !window.confirm(t('board_new_confirm'))) return
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    try { localStorage.removeItem('board-draft-v1') } catch {}
    dirtyRef.current = false
    setDraft(false)
    setBoardId(null)
    setInitSnap(null)
    setPendingImport(null)
    setTitle(t('board_new'))
    setResetKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const download = async () => {
    const editor = editorRef.current
    if (!editor) return
    try {
      editor.deselectAll()
      const blob = await exportToBlob({ editor, ids: editor.getCurrentPageShapeIds(), format: 'png', opts: { background: true, scale: 1, padding: 32 } as any })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `board-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e: any) {
      showToast(t('board_save_err'))
    }
  }

  const clearPage = () => {
    const editor = editorRef.current
    if (!editor) return
    try { editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()) as any) } catch {}
    dirtyRef.current = true
    setClipTool(null)
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
        const w = Math.round(natW * scale)
        const h = Math.round(natH * scale)
        addImageAsset(editor, dataUrl, w, h, `3d-${Date.now()}`)
        setMode('2d')
        dirtyRef.current = true
        showToast(t('bd3_saved'))
      } catch {}
    }
    img.src = dataUrl
  }

  type ClipKind = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'prism' | 'axes'
  type AxesCfg = { range: number; step: number; labels: boolean }
  const PALETTE = ['#0f172a', '#64748b', '#94a3b8', '#ffffff', '#78716c', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#16a34a', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#dc2626', '#1e3a8a', '#047857', '#7c2d12', '#111827']
  const shade = (hex: string, k: number): string => {
    const n = parseInt(hex.slice(1), 16)
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
    if (k > 1) {
      r = r + (255 - r) * (k - 1)
      g = g + (255 - g) * (k - 1)
      b = b + (255 - b) * (k - 1)
    } else {
      r = r * k; g = g * k; b = b * k
    }
    const f = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
    return '#' + f(r) + f(g) + f(b)
  }
  const clipColorRef = useRef<string>('#3b6ce0')
  const [clipColor, setClipColorS] = useState<string>('#3b6ce0')
  const setClipColor = (c: string) => { clipColorRef.current = c; setClipColorS(c) }
  const drawClip = (kind: ClipKind): { url: string; w: number; h: number } => {
    const cfg = axesCfgRef.current
    const base = clipColorRef.current
    const cc = {
      light: shade(base, 1.7),
      light2: shade(base, 1.45),
      mid: base,
      dark: shade(base, 0.55),
      edge: shade(base, 0.4),
    }
    if (kind === 'axes') {
      const per = 30
      const size = Math.round(cfg.range * 2 * per + 100)
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const x = c.getContext('2d')!
      const mid = size / 2
      x.strokeStyle = base
      x.fillStyle = base
      x.lineWidth = 2.5
      x.beginPath()
      x.moveTo(10, mid); x.lineTo(size - 10, mid)
      x.moveTo(mid, 10); x.lineTo(mid, size - 10)
      x.stroke()
      const head = (cx: number, cy: number, a: number, b: number, p: number, q: number) => {
        x.beginPath(); x.moveTo(cx, cy); x.lineTo(a, b); x.lineTo(p, q); x.closePath(); x.fill()
      }
      head(size - 10, mid, size - 26, mid - 7, size - 26, mid + 7)
      head(10, mid, 26, mid - 7, 26, mid + 7)
      head(mid, 10, mid - 7, 26, mid + 7, 26)
      head(mid, size - 10, mid - 7, size - 26, mid + 7, size - 26)
      x.font = '12px system-ui'
      x.lineWidth = 1.5
      const fmtNum = (v: number) => {
        const r = Math.round(v * 100) / 100
        return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : String(r)
      }
      const maxI = Math.round(cfg.range / cfg.step)
      for (let i = 1; i <= maxI; i++) {
        for (const sgn of [-1, 1]) {
          const v = Math.round(i * cfg.step * sgn * 10) / 10
          if (Math.abs(v) > cfg.range + 1e-9) continue
          const dx = mid + v * per
          const dy = mid - v * per
          x.beginPath(); x.moveTo(dx, mid - 4); x.lineTo(dx, mid + 4); x.stroke()
          x.beginPath(); x.moveTo(mid - 4, dy); x.lineTo(mid + 4, dy); x.stroke()
          if (cfg.labels && v !== 0) {
            x.textAlign = 'center'
            x.fillText(fmtNum(v), dx, mid + 18)
            x.textAlign = 'right'
            x.fillText(fmtNum(v), mid - 8, dy + 4)
          }
        }
      }
      if (cfg.labels) {
        x.textAlign = 'left'
        x.fillText('0', mid + 8, mid + 18)
        x.font = 'bold 14px system-ui'
        x.fillText('X', size - 26, mid + 22)
        x.fillText('Y', mid + 12, 20)
      }
      return { url: c.toDataURL('image/png'), w: size, h: size }
    }
    const c = document.createElement('canvas')
    c.width = 240
    c.height = 240
    const x = c.getContext('2d')!
    const grad = x.createLinearGradient(30, 30, 210, 210)
    grad.addColorStop(0, cc.light2)
    grad.addColorStop(1, cc.mid)
    x.strokeStyle = cc.edge
    x.lineWidth = 6
    x.lineJoin = 'round'
    if (kind === 'cube') {
      x.beginPath(); x.moveTo(70, 90); x.lineTo(130, 60); x.lineTo(190, 90); x.lineTo(130, 120); x.closePath(); x.fillStyle = cc.light; x.fill(); x.stroke()
      x.beginPath(); x.moveTo(70, 90); x.lineTo(70, 150); x.lineTo(130, 180); x.lineTo(130, 120); x.closePath(); x.fillStyle = grad; x.fill(); x.stroke()
      x.beginPath(); x.moveTo(190, 90); x.lineTo(190, 150); x.lineTo(130, 180); x.lineTo(130, 120); x.closePath(); x.fillStyle = cc.dark; x.fill(); x.stroke()
    } else if (kind === 'sphere') {
      x.beginPath(); x.arc(120, 120, 62, 0, Math.PI * 2); x.fillStyle = grad; x.fill(); x.stroke()
      x.beginPath(); x.ellipse(120, 120, 62, 20, 0, Math.PI, 0); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 4; x.stroke()
      x.beginPath(); x.ellipse(120, 120, 24, 62, 0, 0, Math.PI * 2); x.strokeStyle = 'rgba(255,255,255,.35)'; x.stroke()
    } else if (kind === 'cylinder') {
      x.fillStyle = grad
      x.beginPath(); x.moveTo(78, 88); x.lineTo(78, 160); x.lineTo(162, 160); x.lineTo(162, 88); x.closePath(); x.fill(); x.stroke()
      x.beginPath(); x.ellipse(120, 160, 42, 18, 0, 0, Math.PI); x.fillStyle = cc.dark; x.fill(); x.stroke()
      x.beginPath(); x.ellipse(120, 88, 42, 18, 0, 0, Math.PI * 2); x.fillStyle = cc.light; x.fill(); x.stroke()
    } else if (kind === 'cone') {
      x.beginPath(); x.moveTo(120, 50); x.lineTo(168, 164); x.lineTo(72, 164); x.closePath(); x.fillStyle = grad; x.fill(); x.stroke()
      x.beginPath(); x.ellipse(120, 164, 48, 20, 0, 0, Math.PI); x.fillStyle = cc.dark; x.fill(); x.stroke()
    } else if (kind === 'pyramid') {
      x.beginPath(); x.moveTo(120, 46); x.lineTo(196, 150); x.lineTo(120, 172); x.closePath(); x.fillStyle = cc.dark; x.fill(); x.stroke()
      x.beginPath(); x.moveTo(120, 46); x.lineTo(44, 150); x.lineTo(120, 172); x.closePath(); x.fillStyle = grad; x.fill(); x.stroke()
    } else {
      x.beginPath(); x.moveTo(70, 150); x.lineTo(104, 70); x.lineTo(138, 150); x.lineTo(104, 196); x.closePath(); x.fillStyle = grad; x.fill(); x.stroke()
      x.beginPath(); x.moveTo(70, 150); x.lineTo(104, 196); x.lineTo(172, 160); x.lineTo(138, 114); x.closePath(); x.fillStyle = cc.dark; x.fill(); x.stroke()
      x.beginPath(); x.moveTo(104, 70); x.lineTo(138, 114); x.lineTo(172, 160); x.lineTo(138, 78); x.closePath(); x.fillStyle = cc.light; x.fill(); x.stroke()
    }
    return { url: c.toDataURL('image/png'), w: 240, h: 240 }
  }

  const assetCacheRef = useRef<Map<string, string>>(new Map())
  const ensureAsset = (editor: any, key: string, url: string, w: number, h: number) => {
    let id = assetCacheRef.current.get(key)
    if (!id) {
      const asset = AssetRecordType.create({
        id: AssetRecordType.createId(),
        type: 'image',
        props: { src: url, w, h, name: key, mimeType: 'image/png', isAnimated: false },
      })
      editor.createAssets([asset])
      id = asset.id
      assetCacheRef.current.set(key, id)
    }
    return id
  }
  const placeClipRange = (kind: ClipKind, x0: number, y0: number, x1: number, y1: number) => {
    const editor = editorRef.current
    if (!editor) return
    try {
      const { url, w: aw, h: ah } = drawCached(kind)
      let w = Math.abs(x1 - x0)
      let h = Math.abs(y1 - y0)
      let x = Math.min(x0, x1)
      let y = Math.min(y0, y1)
      if (w < 24 && h < 24) {
        w = 240; h = 240
        x = x0 - 120; y = y0 - 120
      }
      const key = kind === 'axes' ? `axes:${axesCfgRef.current.range}:${axesCfgRef.current.step}:${axesCfgRef.current.labels}:${clipColorRef.current}` : `${kind}:${clipColorRef.current}`
      const id = ensureAsset(editor, key, url, aw, ah)
      editor.createShape({ type: 'image', x, y, props: { assetId: id, w, h } as any })
      dirtyRef.current = true
    } catch {}
  }

  const clipToolRef = useRef<ClipKind | null>(null)
  const [clipTool, setClipToolS] = useState<ClipKind | null>(null)
  const setClipTool = (k: ClipKind | null) => { clipToolRef.current = k; setClipToolS(k) }
  const axesCfgRef = useRef<AxesCfg>({ range: 10, step: 1, labels: true })
  const [axesCfg, setAxesCfg] = useState<AxesCfg>(axesCfgRef.current)
  const [axesOpen, setAxesOpen] = useState(false)
  const setAxes = (p: Partial<AxesCfg>) => {
    axesCfgRef.current = { ...axesCfgRef.current, ...p }
    setAxesCfg(axesCfgRef.current)
  }
  type ClipDrag = { x0: number; y0: number; px: number; py: number; box: DOMRect; kind: ClipKind }
  const clipDragRef = useRef<ClipDrag | null>(null)
  const justPlacedRef = useRef(0)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const ghostImgRef = useRef<HTMLImageElement | null>(null)
  const ghostCacheRef = useRef<Map<string, { url: string; w: number; h: number }>>(new Map())
  const drawCached = (kind: ClipKind) => {
    const key = kind === 'axes' ? `axes:${axesCfgRef.current.range}:${axesCfgRef.current.step}:${axesCfgRef.current.labels}:${clipColorRef.current}` : `${kind}:${clipColorRef.current}`
    let r = ghostCacheRef.current.get(key)
    if (!r) { r = drawClip(kind); ghostCacheRef.current.set(key, r) }
    return r
  }
  const ghostHide = () => {
    const g = ghostRef.current
    if (g) g.classList.add('hidden')
  }
  const ghostPreview = (kind: ClipKind, cx: number, cy: number) => {
    const g = ghostRef.current
    if (!g) return
    const box = g.parentElement!.getBoundingClientRect()
    const r = drawCached(kind)
    const img = ghostImgRef.current
    if (img) {
      const key = kind === 'axes' ? `axes:${axesCfgRef.current.range}:${axesCfgRef.current.step}:${axesCfgRef.current.labels}:${clipColorRef.current}` : `${kind}:${clipColorRef.current}`
      if (img.dataset.k !== key) { img.src = r.url; img.dataset.k = key }
      img.style.display = ''
    }
    g.classList.remove('hidden')
    g.style.outline = 'none'
    g.style.background = 'transparent'
    g.style.left = Math.round(cx - box.left - r.w / 2) + 'px'
    g.style.top = Math.round(cy - box.top - r.h / 2) + 'px'
    g.style.width = r.w + 'px'
    g.style.height = r.h + 'px'
  }
  const ghostDrag = (d: ClipDrag, cx: number, cy: number) => {
    const g = ghostRef.current
    if (!g) return
    const img = ghostImgRef.current
    if (img) img.style.display = 'none'
    g.classList.remove('hidden')
    g.style.outline = '2px dashed rgba(79,70,229,.95)'
    g.style.background = 'rgba(99,102,241,.07)'
    const x1 = cx - d.box.left
    const y1 = cy - d.box.top
    g.style.left = Math.min(d.x0 - d.box.left, x1) + 'px'
    g.style.top = Math.min(d.y0 - d.box.top, y1) + 'px'
    g.style.width = Math.abs(cx - d.x0) + 'px'
    g.style.height = Math.abs(cy - d.y0) + 'px'
  }
  const onAreaPointerDown = (e: React.PointerEvent) => {
    if (partToolRef.current) { onPartDown(e); return }
    const k = clipToolRef.current
    if (!k || !editorRef.current) return
    const el = e.target as Element
    if (!el || !el.closest('.tl-canvas')) return
    if (!e.isPrimary) return
    e.preventDefault()
    e.stopPropagation()
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch {}
    let page: any = { x: 0, y: 0 }
    try { page = editorRef.current.screenToPage({ x: e.clientX, y: e.clientY }) } catch {}
    const box = (e.currentTarget as Element).getBoundingClientRect()
    clipDragRef.current = { x0: e.clientX, y0: e.clientY, px: page.x, py: page.y, box, kind: k }
    ghostDrag(clipDragRef.current, e.clientX, e.clientY)
  }
  const onAreaPointerMove = (e: React.PointerEvent) => {
    if (partToolRef.current) { onPartMove(e); return }
    const k = clipToolRef.current
    if (!k) { ghostHide(); return }
    const d = clipDragRef.current
    if (d) ghostDrag(d, e.clientX, e.clientY)
    else ghostPreview(k, e.clientX, e.clientY)
  }
  const onAreaPointerUp = (e: React.PointerEvent) => {
    const d = clipDragRef.current
    if (d) {
      clipDragRef.current = null
      ghostHide()
      let p2: any = null
      try { p2 = editorRef.current?.screenToPage({ x: e.clientX, y: e.clientY }) } catch {}
      if (!p2) return
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch {}
      const quick = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) <= 12
      if (quick) {
        let hit: any = null
        try { hit = editorRef.current?.getShapeAtPoint?.({ x: p2.x, y: p2.y }, { hitInside: true, hitLabels: true } as any) } catch {}
        if (hit) { justPlacedRef.current = 0; setClipTool(null); return }
      }
      placeClipRange(d.kind, d.px, d.py, p2.x, p2.y)
      justPlacedRef.current = performance.now()
      return
    }
    if (partToolRef.current) onPartUp()
  }
  const onAreaClickCapture = (e: React.MouseEvent) => {
    if (!clipToolRef.current) return
    if (performance.now() - justPlacedRef.current < 450) return
    const el = e.target as Element
    if (!el) return
    if (el.closest('[data-clipbtn]')) return
    if (el.closest('.tl-canvas')) return
    setClipTool(null)
    ghostHide()
  }
  const onAreaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && clipToolRef.current) {
      e.stopPropagation()
      setClipTool(null)
      ghostHide()
    }
    if (e.key === 'Escape' && partToolRef.current) {
      e.stopPropagation()
      if (partDragRef.current) { try { editorRef.current?.squashToMark(partDragRef.current.markId) } catch {} partDragRef.current = null }
      setPartTool(false)
    }
  }

  // ——— Ластик: стирает как в Paint — рисует штрих цветом фона поверх рисунка ———
  const [partTool, setPartToolS] = useState(false)
  const partToolRef = useRef(false)
  type PartDrag = { pts: Pt[]; markId: string }
  const partDragRef = useRef<PartDrag | null>(null)
  const partPendingRef = useRef<Pt | null>(null)
  const partRafRef = useRef(0)
  const setPartTool = (v: boolean) => {
    partToolRef.current = v
    setPartToolS(v)
    if (v) setClipTool(null)
  }
  const eraseShapeRef = useRef<string | null>(null)
  const eraseStartRef = useRef<Pt>({ x: 0, y: 0 })
  const ERASE_W = 26
  const partSweep = (p: Pt) => {
    const ed = editorRef.current
    if (!ed) return
    try {
      if (!eraseShapeRef.current) {
        // первый касание — создаём штрих-маску цветом фона
        const id = ('shape:eraser' + Math.random().toString(36).slice(2, 8)) as any
        ed.createShape({
          id,
          type: 'draw',
          x: p.x, y: p.y,
          props: { color: 'white', size: 'xl', segments: [{ type: 'free', points: [{ x: 0, y: 0 }] }] } as any,
        } as any)
        eraseShapeRef.current = id as string
        eraseStartRef.current = p
        dirtyRef.current = true
        return
      }
      const id = eraseShapeRef.current
      const shape = ed.getShape(id)
      if (!shape) { eraseShapeRef.current = null; return }
      const segs: any[] = shape.props.segments
      const seg = segs[segs.length - 1]
      const pts: any[] = seg.points
      const lx = p.x - eraseStartRef.current.x
      const ly = p.y - eraseStartRef.current.y
      if (pts.length && Math.hypot((pts[pts.length - 1].x as number) - lx, (pts[pts.length - 1].y as number) - ly) < ERASE_W / 4) return
      pts.push({ x: lx, y: ly })
      ed.updateShape({ id, type: 'draw', props: { ...shape.props, segments: [{ type: 'free', points: pts }] } } as any)
      dirtyRef.current = true
    } catch {}
  }
  const queueSweep = (p: Pt) => {
    // сглаживаем: одна стирка на кадр, иначе на больших досках съезжает по кадрам
    partPendingRef.current = p
    if (partRafRef.current) return
    partRafRef.current = requestAnimationFrame(() => {
      partRafRef.current = 0
      const pt = partPendingRef.current
      partPendingRef.current = null
      if (pt) partSweep(pt)
    })
  }
  const onPartDown = (e: React.PointerEvent) => {
    const ed = editorRef.current
    if (!ed) return
    const el = e.target as Element
    if (!el || !el.closest('.tl-canvas')) return
    if (!e.isPrimary) return
    e.preventDefault()
    e.stopPropagation()
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch {}
    let page: Pt = { x: 0, y: 0 }
    try { page = ed.screenToPage({ x: e.clientX, y: e.clientY }) } catch {}
    const markId = 'part-erase-' + Math.random().toString(36).slice(2, 8)
    partDragRef.current = { pts: [page], markId }
    try { ed.mark(markId) } catch {}
    eraseShapeRef.current = null
    partSweep(page)
  }
  const onPartMove = (e: React.PointerEvent) => {
    if (!partToolRef.current) return
    const d = partDragRef.current
    if (!d) return
    const ed = editorRef.current
    if (!ed) return
    try {
      const page = ed.screenToPage({ x: e.clientX, y: e.clientY })
      const lastPt = d.pts[d.pts.length - 1]
      if (Math.hypot(page.x - lastPt.x, page.y - lastPt.y) < ERASE_W / 8) return
      d.pts.push(page)
      queueSweep(page)
    } catch {}
  }
  const onPartUp = () => {
    const d = partDragRef.current
    if (!d) return
    partDragRef.current = null
    eraseShapeRef.current = null
    try { if (partRafRef.current) { cancelAnimationFrame(partRafRef.current); partRafRef.current = 0 } } catch {}
    partPendingRef.current = null
    try { editorRef.current?.squashToMark(d.markId) } catch {}
  }

  const tldrawArea = (
    <div
      className={`relative rounded-2xl border overflow-hidden bg-white ${isFullscreen ? 'flex-1 min-h-0' : 'h-full w-full'} ${clipTool ? '[&_.tl-container]:!cursor-crosshair' : ''} ${partTool ? '[&_.tl-canvas]:!cursor-cell' : ''}`}
      onPointerDownCapture={onAreaPointerDown}
      onPointerMoveCapture={mode === '2d' && (clipTool || partTool) ? onAreaPointerMove : undefined}
      onPointerUpCapture={mode === '2d' && (clipTool || partTool) ? onAreaPointerUp : undefined}
      onClickCapture={onAreaClickCapture}
      onKeyDown={onAreaKeyDown}
    >
      <div ref={ghostRef} className="hidden absolute z-20 pointer-events-none rounded" style={{ overflow: 'visible' }}>
        <img ref={ghostImgRef} alt="" draggable={false} className="select-none pointer-events-none opacity-50 max-w-none" />
      </div>
      <div className="absolute inset-0">
        <Tldraw
          key={resetKey}
          onMount={onMount}
          components={mode === '3d' ? ({
            Toolbar: null, StylePanel: null, TopPanel: null, SharePanel: null, NavigationPanel: null,
            PageMenu: null, MainMenu: null, ActionsMenu: null, HelpMenu: null, ContextMenu: null,
            QuickActions: null, KeyboardShortcutsDialog: null, MenuPanel: null, HelperButtons: null, ZoomMenu: null,
          } as any) : ({ SharePanel: null } as any)}
        />
      </div>
      {partTool && mode === '2d' && (
        <div data-testid="bd2-part-hint" className="absolute right-3 bottom-16 z-30 pointer-events-none px-3 py-1.5 rounded-full bg-emerald-900/90 text-white text-xs font-medium shadow-lg">
          🧽 {t('bd2_part_hint')} · {t('bd2_part_exit')}
        </div>
      )}
      {mode === '2d' && (
        <button data-testid="bd2-partbtn" onPointerDown={e => e.stopPropagation()}
          onClick={() => setPartTool(!partTool)} title={t('bd2_part_hint')}
          className={`absolute z-30 bottom-3 right-3 w-12 h-12 rounded-2xl text-xl flex items-center justify-center shadow-lg border transition-colors ${partTool ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/95 dark:bg-slate-800/95 dark:text-white border-slate-200 dark:border-slate-600'}`}>
          🧽
        </button>
      )}
      {clipTool && mode === '2d' && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-16 z-30 pointer-events-none px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-lg">
          {t('bd2_click_place')}{clipTool === 'axes' ? ` ±${axesCfg.range} (${t('bd2_axes_step_short')} ${axesCfg.step})` : ''}
        </div>
      )}
      {mode === '3d' && (
        <div className="absolute inset-0 z-10 bg-slate-100">
          <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">...</div>}>
            <Board3D onSnapshot={on3dSnapshot} />
          </Suspense>
        </div>
      )}
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
        <div className="h-12 shrink-0 bg-slate-900 text-white flex items-center gap-3 px-4">
          <span className="font-bold">{t('board_fullscreen')}</span>
          <span className="text-xs text-white/70 hidden sm:inline">{title} • {mode === '2d' ? '2D' : '3D'}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={save} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold flex items-center gap-1"><Save size={14} /> {t('save')}</button>
            <button onClick={() => setIsFullscreen(false)} className="px-4 py-1.5 rounded-lg bg-white text-slate-900 font-bold">{t('board_exit_esc')}</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-2 flex flex-col">{tldrawArea}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/60 dark:border-slate-700/60">
        <span className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white inline-flex"><PenTool size={16} /></span>
        <input value={title} onChange={e => setTitle(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-800 dark:text-white text-sm font-medium min-w-[120px] max-w-[200px]" />
        {draft && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-bold" title={t('board_draft_hint')}>{t('board_draft_chip')}</span>}
        <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button onClick={() => { flushDraft(); setMode('2d') }} className={`px-3 py-1.5 rounded-md text-xs font-bold ${mode === '2d' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'}`}>{t('board_2d')}</button>
          <button onClick={() => { flushDraft(); setMode('3d') }} className={`px-3 py-1.5 rounded-md text-xs font-bold ${mode === '3d' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'}`}>{t('board_3d')}</button>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <span className="md:hidden text-xs text-slate-400">{boards.length}</span>
          <button onClick={() => { setHideSidebarLocal(v => !v); window.dispatchEvent(new CustomEvent('toggle-sidebar')) }} className="px-2 py-1.5 rounded-lg border text-xs font-medium bg-white dark:bg-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center" title={hideSidebarLocal ? t('board_show_menu') : t('board_hide_tabs')}><PanelLeft size={14} /></button>
          <button onClick={() => { flushDraft(); setIsFullscreen(true) }} className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white flex items-center gap-1 text-xs font-medium"><Maximize2 size={14} /> {t('board_fullscreen_btn')}</button>
          <button onClick={newBoard} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1 text-xs min-h-[36px]"><Plus size={14} /> {t('board_new')}</button>
          <button onClick={download} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 dark:text-white border flex items-center gap-1 text-xs min-h-[36px]"><Download size={14} /> {t('board_download')}</button>
          <button onClick={clearPage} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 dark:text-white border text-amber-700 dark:text-amber-400 flex items-center gap-1 text-xs min-h-[36px]"><Trash2 size={14} /></button>
          <button onClick={() => setShowBoards(v => !v)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white border text-xs font-medium flex items-center gap-1.5 min-h-[36px]">🗂 {t('board_mine')} <span className="px-1.5 rounded-full bg-slate-900 text-white text-[10px]">{boards.length}</span></button>
          <button onClick={save} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold flex items-center gap-1.5 text-xs min-h-[36px]"><Save size={14} /> {t('save')}</button>
        </div>
      </div>
      {mode === '2d' && !isFullscreen && (
        <div className="shrink-0 flex flex-wrap gap-1.5 items-center bg-white dark:bg-slate-800 border-b border-slate-200/60 dark:border-slate-700/60 px-3 py-1.5">
          <button data-clipbtn onClick={() => { setClipTool(clipTool === 'axes' ? null : 'axes'); setAxesOpen(o => !o) }} title={t('bd2_axes')} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-[32px] border ${clipTool === 'axes' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-amber-50 dark:bg-slate-900 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border-amber-200'}`}>{t('bd2_axes')}</button>
        </div>
      )}

      {mode === '2d' && axesOpen && !isFullscreen && (
        <div data-clipbtn className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200/60 dark:border-slate-700/60 px-3 py-2 flex flex-wrap items-center gap-2.5 text-sm">
          <span className="text-xs font-bold text-slate-500">{t('bd2_axes')}</span>
          <label className="flex items-center gap-2 text-xs font-medium dark:text-slate-200">
            {t('bd2_axes_range')}
            <select value={axesCfg.range} onChange={e => setAxes({ range: Number(e.target.value) })} className="px-2 py-1 rounded-md border bg-white dark:bg-slate-900 dark:text-white min-h-[34px]">
              {[5, 10, 15, 20, 30, 50].map(r => <option key={r} value={r}>±{r}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium dark:text-slate-200">
            {t('bd2_axes_step')}
            <select value={axesCfg.step} onChange={e => setAxes({ step: Number(e.target.value) })} className="px-2 py-1 rounded-md border bg-white dark:bg-slate-900 dark:text-white min-h-[34px]">
              {[0.5, 1, 2, 5].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium dark:text-slate-200">
            <input type="checkbox" checked={axesCfg.labels} onChange={e => setAxes({ labels: e.target.checked })} className="w-4 h-4" />
            {t('bd2_axes_labels')}
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium dark:text-slate-200">{t('bd3_color')}:</span>
            <div className="flex flex-wrap gap-1 max-w-[220px]">
              {PALETTE.map(cc => (
                <button key={cc} onClick={() => setClipColor(cc)} className={`w-5 h-5 rounded border ${clipColor === cc ? 'border-2 border-slate-900 dark:border-white' : 'border-slate-300'}`} style={{ background: cc }} />
              ))}
            </div>
            <input type="color" value={clipColor} onChange={e => setClipColor(e.target.value)} title={t('bd2_custom_color')} className="w-7 h-7 rounded border cursor-pointer bg-white p-0.5" />
          </div>
          <button onClick={() => setClipTool('axes')} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold min-h-[34px] text-xs">{t('bd2_axes_place')}</button>
        </div>
      )}
      <div className="flex-1 min-h-0 p-2">{tldrawArea}</div>

      {showBoards && (
        <div className="absolute top-2 right-2 z-40 w-80 max-w-[calc(100vw-16px)] max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl border shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <h3 className="font-bold text-sm dark:text-white">{t('board_mine')}</h3>
            <button onClick={() => setShowBoards(false)} className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white">{t('board_hide')}</button>
          </div>
          <div className="p-3 space-y-2 overflow-auto">
            <div className="text-xs text-slate-500">{t('board_private_hint')}</div>
            {boards.map(b => (
              <button key={b.id} onClick={() => { loadBoard(b); setShowBoards(false) }} className={`w-full text-left p-3 rounded-xl border hover:bg-white hover:shadow dark:hover:bg-slate-700 ${b.id === boardId ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 dark:bg-slate-900'}`}>
                <div className="font-medium text-sm line-clamp-1 dark:text-white">{b.title}</div>
                <div className="text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString()} • {b.data?.mode || '2d'} • {b.data?.pages || 1}</div>
                {typeof b.data?.image === 'string' && b.data.image.startsWith('data:image/png') && (
                  <img src={b.data.image} className="mt-2 rounded-lg border w-full" referrerPolicy="no-referrer" />
                )}
              </button>
            ))}
            {boards.length === 0 && <div className="text-sm text-slate-400 text-center py-6">{t('board_empty_a')}{t('save')}</div>}
          </div>
        </div>
      )}
      {showBoards && <div className="fixed inset-0 -z-10" onClick={() => setShowBoards(false)} />}
      {mode === '3d' && <div className="shrink-0 text-xs text-center text-slate-500 pb-1">{t('bd3_hint')}</div>}
      {toast && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-3 rounded-xl bg-slate-900 text-white text-sm shadow-xl">{toast}</div>}
    </div>
  )
}
