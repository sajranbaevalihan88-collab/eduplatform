import { useEffect, useLayoutEffect, useState, useRef, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client, { mediaUrl } from '../api/client'
import {
  Plus, Trash2, Save, Eye, Play, Type, Image as ImgIcon, Table, BarChart3, Video,
  Palette, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Copy, Layers,
  Maximize2, ZoomIn, ZoomOut, List, ListOrdered, Highlighter, Undo2, Redo2, Shapes,
  BookOpen, Pencil, Printer, ArrowUp, ArrowDown, BringToFront, SendToBack, CheckCircle2,
  Wand2, ChevronDown, Lock, Unlock, GripHorizontal, MessageSquare, FileImage, Sparkles,
  RotateCw, LayoutTemplate, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
} from 'lucide-react'
import { PdfPage, FitBox } from '../components/pptxView'
import {
  SlideShape, SlideTable, SlideChart, ChartDataModal, createDefaultTable, createDefaultChartData,
  renderShapeHtml, renderTableHtml, renderChartHtml, ChartKind, getShapeDef,
} from '../components/SlideVisuals'
import {
  ShapePickerPopover, TableSizePickerPopover, ChartPickerPopover,
  TextPresetPopover, SlideLayoutPopover, PresentationTemplatesModal, TEXT_PRESETS,
} from '../components/SlideInsertMenus'
import SlidePropsPanel from '../components/SlidePropsPanel'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

const resolveSrc = (src?: string) => src?.startsWith('/media') ? mediaUrl(src) : (src || '')

const imgMissing = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget
  t.style.display = 'none'
  t.parentElement?.classList.add('img-missing')
}

type Block = {
  id: string
  type: 'text' | 'image' | 'shape' | 'table' | 'chart' | 'video' | 'icon'
  content?: string
  src?: string
  shape?: string
  style?: any
  table?: any
  chartData?: any
  animation?: string
  paragraphs?: any
}
type Slide = {
  id?: number
  order: number
  background: string
  backgroundType?: 'solid' | 'gradient' | 'image'
  gradient?: string
  bgImage?: string
  content: { blocks: Block[] }
  notes?: string
  layout?: string
  transition?: string
  width?: number
  height?: number
}
type Snapshot = { slides: Slide[]; active: number }

const FONTS = ['Inter', 'Manrope', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana']
const TRANSITIONS = ['нет', 'fade', 'slide', 'zoom', 'wipe', 'split', 'random']
const ANIMATIONS = ['нет', 'fadeIn', 'slideIn', 'zoomIn', 'bounce', 'flip', 'float']

const PPT_THEMES = [
  { id: 'office', name: 'Офис', bg: '#ffffff', type: 'solid' as const, grad: '', titleColor: '#1e293b', bodyColor: '#475569', accent: '#2563eb' },
  { id: 'midnight', name: 'Полночь', bg: '#0f172a', type: 'gradient' as const, grad: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)', titleColor: '#f8fafc', bodyColor: '#cbd5e1', accent: '#38bdf8' },
  { id: 'alatoo', name: 'Ала-Тоо', bg: '#1e3a8a', type: 'gradient' as const, grad: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 60%, #0ea5e9 100%)', titleColor: '#ffffff', bodyColor: '#e0f2fe', accent: '#facc15' },
  { id: 'emerald', name: 'Изумруд', bg: '#064e3b', type: 'gradient' as const, grad: 'linear-gradient(135deg, #022c22 0%, #065f46 60%, #0d9488 100%)', titleColor: '#ffffff', bodyColor: '#d1fae5', accent: '#34d399' },
  { id: 'sunset', name: 'Закат', bg: '#7c2d12', type: 'gradient' as const, grad: 'linear-gradient(135deg, #4c1d95 0%, #be123c 55%, #f97316 100%)', titleColor: '#ffffff', bodyColor: '#ffedd5', accent: '#fde047' },
  { id: 'academy', name: 'Академия', bg: '#fdf8ee', type: 'solid' as const, grad: '', titleColor: '#451a03', bodyColor: '#78350f', accent: '#b45309' },
  { id: 'cyber', name: 'Неон', bg: '#090d1f', type: 'gradient' as const, grad: 'linear-gradient(135deg, #090d1f 0%, #2e1065 50%, #831843 100%)', titleColor: '#f8fafc', bodyColor: '#f5d0fe', accent: '#22d3ee' },
  { id: 'minimal', name: 'Минимал', bg: '#f1f5f9', type: 'solid' as const, grad: '', titleColor: '#0f172a', bodyColor: '#334155', accent: '#0f172a' },
]

function isDarkColor(hex: string) {
  try {
    if (!hex || typeof hex !== 'string') return false
    const h = hex.trim().toUpperCase()
    if (h.startsWith('LINEAR-GRADIENT') || h.startsWith('RADIAL')) return false
    let c = h.replace('#', '')
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('')
    if (c.length !== 6) return false
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false
    return 0.299 * r + 0.587 * g + 0.114 * b < 128
  } catch { return false }
}

function slideDotsCls(bg: any) {
  try {
    if (typeof bg === 'string' && bg.startsWith('#') && isDarkColor(bg)) return 'slide-dots'
  } catch { }
  return ''
}

function anchoredInner(s: any) {
  const va = s.verticalAlign || 'top', hasH = s.h != null
  if (!hasH) return { position: 'relative' as const }
  if (va === 'middle') return { position: 'absolute' as const, left: 0, right: 0, top: '50%', transform: 'translateY(-50%)' }
  if (va === 'bottom') return { position: 'absolute' as const, left: 0, right: 0, bottom: 0 }
  return { position: 'absolute' as const, left: 0, right: 0, top: 0 }
}

const runHasStyle = (st: any) => !!st && ['fontSize', 'color', 'bold', 'italic', 'fontFamily', 'underline'].some(k => st[k] !== undefined)
function restyleParas(oldPs: any[], val: string) {
  const ps = Array.isArray(oldPs) ? oldPs : []
  let proto: any = null
  for (const p of ps) { for (const r of (p.runs || [])) { if (runHasStyle(r?.style)) { proto = r.style; break } } if (proto) break }
  const tmpl = ps.map((p: any) => {
    let t: any = null
    for (const r of (p.runs || [])) { if (runHasStyle(r?.style)) { t = r.style; break } }
    return { align: p.align, level: p.level ?? 0, lineHeight: p.lineHeight, style: t || {} }
  })
  for (const t of tmpl) { if (!Object.keys(t.style).length && proto) t.style = { ...proto } }
  const lines = String(val ?? '').split('\n')
  const out = (lines.length && (lines.length > 1 || lines[0] !== '')) ? lines : ['']
  return out.map((ln: string, i: number) => {
    const t = tmpl[Math.min(i, tmpl.length - 1)] || { style: {}, align: 'left', level: 0 }
    return { align: t.align || 'left', level: t.level ?? 0, lineHeight: t.lineHeight || null, runs: [{ text: ln, style: { ...(t.style || {}) } }] }
  })
}

function videoEmbedUrl(src: string) {
  const s = (src || '').trim()
  let m = s.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  m = s.match(/vk\.com\/video(-?\d+)_(\d+)/)
  if (m) return `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}`
  m = s.match(/rutube\.ru\/video\/([\w]+)/)
  if (m) return `https://rutube.ru/play/embed/${m[1]}`
  return s
}

function getSlideBgStyle(s: Slide): React.CSSProperties {
  const g = (s as any).gradient || (s as any).bg_image || (s as any).bgImage
  const bg = (s as any).background
  if (g && (g.startsWith('linear-gradient') || g.startsWith('radial-gradient'))) return { background: g }
  if (s.backgroundType === 'gradient' && s.gradient) return { background: s.gradient }
  if (s.backgroundType === 'image' && s.bgImage) return { backgroundImage: `url(${s.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (s.bgImage && s.bgImage.startsWith('data:image')) return { backgroundImage: `url(${s.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (bg && (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient') || bg.startsWith('url('))) return { background: bg }
  return { background: bg || '#ffffff' }
}

const getTransitionClass = (tr: string) => ({ fade: 'animate-enter', slide: 'animate-slide', zoom: 'animate-zoom', wipe: 'animate-wipe', split: 'animate-split', random: 'animate-random', 'нет': '' } as any)[tr] || ''
const getAnimationClass = (a: string) => ({ fadeIn: 'animate-fadeIn', slideIn: 'animate-slideIn', zoomIn: 'animate-zoomIn', bounce: 'animate-bounce', flip: 'animate-flip', float: 'animate-float', 'нет': '' } as any)[a] || ''
const slideAspectStyle = (s: any) => (s?.width && s?.height && s.width > 0 && s.height > 0) ? { aspectRatio: `${s.width} / ${s.height}` } : { aspectRatio: '16 / 9' }
const textLineHeight = (st: any) => st?.lineHeight && st.lineHeight >= 0.5 && st.lineHeight <= 3 ? st.lineHeight : 1.25
const fontStack = (f?: string) => f ? `'${f}', 'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', 'Noto Sans SC', sans-serif` : undefined

function renderStaticBlock(b: any, prefix: string, fontScale = 1) {
  const st = b.style || {}
  const anim = getAnimationClass(b.animation || 'нет')
  const boxPos: React.CSSProperties = {
    position: 'absolute',
    left: `${st.x ?? 0}%`,
    top: `${st.y ?? 0}%`,
    width: `${st.w ?? 80}%`,
    height: st.h != null ? `${st.h}%` : 'auto',
    zIndex: st.z || 0,
    opacity: st.opacity ?? 1,
    transform: st.rotation ? `rotate(${st.rotation}deg)` : undefined,
  }
  if (b.type === 'text') {
    return (
      <div
        key={b.id}
        className={anim}
        style={{
          ...boxPos,
          overflow: 'visible',
          display: 'block',
          padding: st.background ? '6px 8px' : '2px 7px',
          background: st.background || 'transparent',
          borderRadius: st.borderRadius ? `${st.borderRadius}px` : undefined,
          boxShadow: st.shadow ? '0 4px 14px rgba(15,23,42,0.1)' : undefined,
          border: st.stroke ? `${st.strokeWidth || 1}px ${st.dash || 'solid'} ${st.stroke}` : undefined,
        }}
      >
        <div style={anchoredInner(st)}>
          <div style={{
            fontSize: (st.fontSize || 18) * fontScale,
            fontFamily: fontStack(st.fontFamily),
            lineHeight: textLineHeight(st),
            color: st.color || '#1e293b',
            textAlign: st.align || 'left',
            fontWeight: st.bold ? 700 : 400,
            fontStyle: st.italic ? 'italic' : 'normal',
            textDecoration: st.underline ? 'underline' : 'none',
            whiteSpace: 'pre-wrap',
          }}>
            {b.paragraphs ? b.paragraphs.map((p: any, pi: number) => (
              <div key={pi} style={{ textAlign: p.align || st.align || 'left', marginBottom: '0.18em', lineHeight: p.lineHeight || textLineHeight(st) }}>
                {p.runs ? p.runs.map((r: any, ri: number) => (
                  <span key={ri} style={{
                    fontFamily: fontStack(r.style?.fontFamily),
                    fontSize: r.style?.fontSize ? r.style.fontSize * fontScale : undefined,
                    fontWeight: r.style?.bold ? 700 : undefined,
                    fontStyle: r.style?.italic ? 'italic' : undefined,
                    textDecoration: r.style?.underline ? 'underline' : undefined,
                    color: r.style?.color,
                    background: r.style?.highlight ? '#fef08a' : undefined,
                  }}>{r.text}</span>
                )) : p.text}
              </div>
            )) : (
              st.bullet
                ? String(b.content || '').split('\n').map((ln, idx) => <div key={idx}>• {ln}</div>)
                : st.numbered
                  ? String(b.content || '').split('\n').map((ln, idx) => <div key={idx}>{idx + 1}. {ln}</div>)
                  : b.content
            )}
          </div>
        </div>
      </div>
    )
  }
  if (b.type === 'image') {
    return (
      <div key={b.id} className={anim} style={boxPos}>
        {b.unrenderable ? (
          <div className="w-full h-full rounded flex items-center justify-center bg-slate-100 border border-dashed border-slate-300 text-slate-500 text-xs p-2 text-center">
            Изображение недоступно
          </div>
        ) : (
          <img
            onError={imgMissing}
            src={resolveSrc(b.src)}
            style={{
              width: '100%', height: '100%',
              objectFit: st.objectFit || 'contain',
              borderRadius: st.borderRadius ? `${st.borderRadius}px` : undefined,
              boxShadow: st.shadow ? '0 8px 24px rgba(15,23,42,0.18)' : undefined,
            }}
            alt=""
          />
        )}
      </div>
    )
  }
  if (b.type === 'shape') {
    return (
      <div key={b.id} className={anim} style={{ ...boxPos, overflow: 'visible' }}>
        <SlideShape block={b} gid={`${prefix}-sh-${b.id}`} />
      </div>
    )
  }
  if (b.type === 'table') {
    return (
      <div key={b.id} className={anim} style={boxPos}>
        <SlideTable block={b} />
      </div>
    )
  }
  if (b.type === 'chart') {
    return (
      <div key={b.id} className={anim} style={boxPos}>
        <SlideChart block={b} gid={`${prefix}-ch-${b.id}`} />
      </div>
    )
  }
  if (b.type === 'video') {
    return (
      <div key={b.id} className={anim} style={boxPos}>
        <iframe src={videoEmbedUrl(b.content || '')} title="video" className="w-full h-full rounded-lg" allowFullScreen sandbox="allow-scripts allow-presentation allow-popups" />
      </div>
    )
  }
  return <div key={b.id} className={anim} style={{ ...boxPos, fontSize: st.fontSize || 32, textAlign: 'center' }}>{b.content}</div>
}

const SlideThumbItem = memo(function SlideThumbItem({
  slide,
  index,
  isActive,
  canDelete,
  onSelect,
  onDelete,
}: {
  slide: Slide
  index: number
  isActive: boolean
  canDelete: boolean
  onSelect: (idx: number) => void
  onDelete: (idx: number) => void
}) {
  const hasG = (slide.content.blocks || []).some((b: any) => b.style?.x !== undefined)
  const sBg = (slide as any).background || '#ffffff'
  const isDark = isDarkColor(sBg)
  return (
    <div
      data-slide-index={index}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(index)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(index) } }}
      className={`text-left rounded-lg border-2 overflow-hidden bg-white dark:bg-slate-800 relative cursor-pointer group w-[118px] shrink-0 lg:w-auto ${isActive ? 'border-[#d24726] shadow-md' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
    >
      <div className="aspect-video shrink-0 overflow-hidden relative" style={{ ...getSlideBgStyle(slide), ...slideAspectStyle(slide) }}>
        {hasG ? (
          <div className="absolute inset-0 pointer-events-none" style={{ width: 960, height: 540, transform: 'scale(0.19)', transformOrigin: 'top left' }}>
            {slide.content.blocks.slice(0, 12).map((b: any) => renderStaticBlock(b, `th-${index}`, 1))}
          </div>
        ) : (
          <div className="p-1.5 flex flex-col gap-0.5 overflow-hidden h-full">
            {slide.content.blocks.slice(0, 3).map((b: any, bi: number) => (
              <div key={bi} className="truncate text-[9px] leading-tight" style={{ fontWeight: b.style?.bold ? 700 : 400, color: b.style?.color || (isDark ? '#fff' : '#1e293b') }}>
                {b.type === 'text' ? b.content?.slice(0, 30) : b.type}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-2 py-1 flex items-center justify-between bg-slate-50 dark:bg-slate-800/90 border-t dark:border-slate-700 dark:text-slate-200">
        <span className="text-[11px] font-bold">{index + 1} {slide.transition && slide.transition !== 'нет' ? `· ${slide.transition}` : ''}</span>
        <span className="text-[10px] text-slate-400">{slide.layout || 'slide'}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(index)
        }}
        disabled={!canDelete}
        title="Удалить слайд"
        className={`absolute top-1 right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border dark:border-slate-700 shadow flex items-center justify-center ${!canDelete ? 'opacity-30 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600'} transition-opacity`}
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
})

export default function PresentationEditor() {
  const { t, lang } = useLang()
  const PUI = {
    ru: { imp: 'Импорт', prev: 'Предпросмотр', show: 'Слайд-шоу', full: 'На весь', exit: 'Выйти', home: 'Главная', insert: 'Вставка', design: 'Дизайн', trans: 'Переходы', anim: 'Анимации', pub: 'Публичная', priv: 'Приватная' },
    en: { imp: 'Import', prev: 'Preview', show: 'Slideshow', full: 'Fullscreen', exit: 'Exit', home: 'Home', insert: 'Insert', design: 'Design', trans: 'Transitions', anim: 'Animations', pub: 'Public', priv: 'Private' },
    kg: { imp: 'Импорт', prev: 'Алдын ала', show: 'Слайд-шоу', full: 'Толук экран', exit: 'Чыгуу', home: 'Башкы', insert: 'Киргизүү', design: 'Дизайн', trans: 'Өтүүлөр', anim: 'Анимация', pub: 'Ачык', priv: 'Жеке' },
  }[lang] || { imp: 'Импорт', prev: 'Предпросмотр', show: 'Слайд-шоу', full: 'На весь', exit: 'Выйти', home: 'Главная', insert: 'Вставка', design: 'Дизайн', trans: 'Переходы', anim: 'Анимации', pub: 'Публичная', priv: 'Приватная' }

  const { id } = useParams()
  const nav = useNavigate()
  const isNew = !id

  const [title, setTitle] = useState('Новая презентация')
  const [desc, setDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [subject, setSubject] = useState<any>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjSlug, setSubjSlug] = useState('')
  const [slides, setSlidesRaw] = useState<Slide[]>([{
    order: 0, background: '#ffffff', backgroundType: 'solid', layout: 'title', transition: 'fade', content: {
      blocks: [
        { id: 'b1', type: 'text', content: 'Заголовок презентации', style: { fontSize: 36, bold: true, align: 'center', color: '#1e293b', fontFamily: 'Manrope', x: 5, y: 20, w: 90, h: 18, z: 1, unit: '%' } },
        { id: 'b2', type: 'text', content: 'Подзаголовок — идея урока, класс, цель', style: { fontSize: 18, align: 'center', color: '#64748b', fontFamily: 'Inter', x: 10, y: 42, w: 80, h: 12, z: 2, unit: '%' } },
      ],
    },
  }])
  const setSlides: React.Dispatch<React.SetStateAction<Slide[]>> = (v) => { setSlidesRaw(v); setDirty(true) }

  const [active, setActive] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const [editingText, setEditingText] = useState<string | null>(null)
  const [editingShape, setEditingShape] = useState<string | null>(null)
  const [clipboardBlock, setClipboardBlock] = useState<Block | null>(null)

  const [showPreview, setShowPreview] = useState(false)
  const [slideshow, setSlideshow] = useState(false)
  const [showIdx, setShowIdx] = useState(0)
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [pvMode, setPvMode] = useState<'orig' | 'blocks'>('orig')

  const [zoom, setZoom] = useState(100)
  const [canvasFit, setCanvasFit] = useState(1)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const slideListRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgImageRef = useRef<HTMLInputElement>(null)
  const pptxInputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  const [loadFailed, setLoadFailed] = useState(false)
  const [ribbonTab, setRibbonTab] = useState<'home' | 'insert' | 'design' | 'transitions' | 'animations'>('home')
  const [openMenu, setOpenMenu] = useState<null | 'text' | 'shapes' | 'table' | 'chart' | 'layout'>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [importing, setImporting] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [isEditFullscreen, setIsEditFullscreen] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [importedId, setImportedId] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [dragging, setDragging] = useState<{
    id: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; origRot: number
  } | null>(null)
  const [resizing, setResizing] = useState<{
    id: string; handle: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; origRot: number
  } | null>(null)
  const [rotating, setRotating] = useState<{
    id: string; cx: number; cy: number; startAngle: number; origRot: number; origX: number; origY: number; origW: number; origH: number
  } | null>(null)
  const [liveTransform, setLiveTransform] = useState<{
    id: string; x: number; y: number; w: number; h: number; rotation: number
  } | null>(null)
  const liveTransformRef = useRef<{ id: string; x: number; y: number; w: number; h: number; rotation: number } | null>(null)
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null })
  const [chartModalBlockId, setChartModalBlockId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockId: string } | null>(null)

  const cur = slides[active] || slides[0]
  const curSelected = cur?.content.blocks.find(b => b.id === selectedBlock)
  const isAbsolute = cur && (cur.content.blocks || []).some((b: any) => b.style && b.style.x !== undefined)

  useEffect(() => {
    if (!openMenu && !ctxMenu) return
    const close = () => { setOpenMenu(null); setCtxMenu(null) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [openMenu, ctxMenu])

  useEffect(() => {
    if (!editingText) return
    try {
      const el = (canvasRef.current || document).querySelector('[data-editing="1"]') as HTMLElement | null
      if (el) {
        const orig = el.getAttribute('data-orig') || ''
        if (!el.textContent && orig) el.innerText = orig
        el.focus()
        const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
        const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r)
      }
    } catch { }
  }, [editingText, active])

  const blockOrigText = (b: any) => {
    if (b.paragraphs && b.paragraphs.length) {
      return b.paragraphs.map((p: any) => p.runs ? p.runs.map((r: any) => r.text || '').join('') : (p.text || '')).join('\n')
    }
    return String(b.content || '')
  }

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-24), { slides: JSON.parse(JSON.stringify(slides)), active }])
    setRedoStack([])
  }, [slides, active])

  const commitText = (blockId: string, val: string) => {
    pushHistory()
    setSlides(sl => sl.map((si, i) => i !== active ? si : {
      ...si,
      content: {
        ...si.content,
        blocks: si.content.blocks.map(x => {
          if (x.id !== blockId) return x
          const oldPs = (x as any).paragraphs
          if (oldPs && oldPs.length) return { ...x, content: val, paragraphs: restyleParas(oldPs, val) }
          return { ...x, content: val }
        }),
      },
    }))
  }

  useEffect(() => {
    client.get('/subjects/').then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data.results || []
      setSubjects(arr)
    }).catch(() => { })
    if (!isNew) {
      client.get(`/presentations/${id}/`).then(r => {
        setTitle(r.data.title); setDesc(r.data.description || ''); setIsPublic(!!r.data.is_public)
        setSubject(r.data.subject ?? r.data.subject_id ?? null)
        if (r.data.pdf_url) setPdfUrl(resolveSrc(r.data.pdf_url))
        if (r.data.slides?.length) {
          const s = r.data.slides.sort((a: any, b: any) => a.order - b.order).map((s: any, idx: number) => ({
            id: s.id, order: idx, background: s.background || '#ffffff',
            backgroundType: s.backgroundType || s.background_type || 'solid',
            gradient: s.gradient, bgImage: s.bgImage || s.bg_image,
            layout: s.layout || 'blank', transition: s.transition || 'fade',
            width: s.width, height: s.height,
            content: s.content?.blocks ? s.content : { blocks: [{ id: 'b' + idx, type: 'text', content: 'Слайд ' + (idx + 1) }] },
            notes: s.notes || '',
          }))
          setSlidesRaw(s)
        }
      }).catch(() => {
        toast('Не удалось загрузить презентацию — проверь соединение и обнови страницу', 'error')
        setLoadFailed(true)
      })
    }
    const sp = new URLSearchParams(window.location.search)
    const subjFromUrl = sp.get('subject')
    setSubjSlug(subjFromUrl || '')
    if (subjFromUrl && isNew) {
      client.get('/subjects/').then(r => {
        const arr = Array.isArray(r.data) ? r.data : r.data.results || []
        const found = arr.find((x: any) => String(x.slug) === String(subjFromUrl) || String(x.id) === String(subjFromUrl))
        if (found) setSubject(found.id)
      }).catch(() => { })
    }
  }, [id])

  const selectSlide = useCallback((i: number) => {
    setActive(i)
    setSelectedBlock(null)
    setActiveCell(null)
    setEditingText(null)
    setEditingShape(null)
    setCtxMenu(null)
  }, [])

  useEffect(() => {
    const list = slideListRef.current
    if (!list) return
    const el = list.querySelector(`[data-slide-index="${active}"]`) as HTMLElement | null
    if (!el) return
    if (window.innerWidth >= 1024) {
      list.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: 'smooth' })
    } else {
      const left = el.offsetLeft - (list.clientWidth - el.clientWidth) / 2
      list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    }
  }, [active, slides.length])

  const undo = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setRedoStack(r => [...r.slice(-24), { slides: JSON.parse(JSON.stringify(slides)), active }])
    setSlidesRaw(prev.slides)
    setActive(Math.min(prev.active, prev.slides.length - 1))
    setHistory(h => h.slice(0, -1))
    setDirty(true)
  }

  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setHistory(h => [...h.slice(-24), { slides: JSON.parse(JSON.stringify(slides)), active }])
    setSlidesRaw(next.slides)
    setActive(Math.min(next.active, next.slides.length - 1))
    setRedoStack(r => r.slice(0, -1))
    setDirty(true)
  }

  // ==================== FIT-TO-STAGE (ИСПРАВЛЕНИЕ БАГА ПОСЛЕ СЛАЙД-ШОУ!) ====================
  const baseSlideW = 960
  const baseSlideH = (cur?.width && cur?.height && cur.width > 0 && cur.height > 0)
    ? Math.round(960 * (cur.height / cur.width))
    : 540

  const recalcFit = useCallback(() => {
    const wrap = canvasWrapRef.current
    if (!wrap) return
    const cw = wrap.clientWidth
    if (cw < 160) return
    const stageH = stageRef.current?.clientHeight || 0
    const maxW = Math.min(cw, baseSlideW)
    const fitByW = maxW / baseSlideW
    const fitByH = stageH > 220 ? Math.min(1, (stageH - 125) / baseSlideH) : 1
    const fit = Math.max(0.32, Math.min(1, fitByW, Math.max(0.45, fitByH)))
    setCanvasFit(prev => Math.abs(prev - fit) > 0.002 ? fit : prev)
  }, [baseSlideW, baseSlideH])

  useLayoutEffect(() => {
    if (!isAbsolute) return
    recalcFit()
    const raf = requestAnimationFrame(recalcFit)
    const wrap = canvasWrapRef.current
    const stage = stageRef.current
    const ro = new ResizeObserver(() => recalcFit())
    if (wrap) ro.observe(wrap)
    if (stage) ro.observe(stage)
    window.addEventListener('resize', recalcFit)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', recalcFit)
    }
  }, [isAbsolute, baseSlideW, baseSlideH, active, slides.length, slideshow, showPreview, isEditFullscreen, recalcFit])

  const canvasScale = Math.max(0.25, (zoom / 100) * canvasFit)

  // Горячие клавиши редактора
  useEffect(() => {
    if (slideshow || showPreview) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      const ctrl = e.ctrlKey || e.metaKey
      if (e.key === 'F5') { e.preventDefault(); setSlideshow(true) }
      else if (e.key === 'Escape') {
        if (chartModalBlockId) { setChartModalBlockId(null); return }
        if (showTemplates) { setShowTemplates(false); return }
        if (ctxMenu) { setCtxMenu(null); return }
        setSelectedBlock(null); setActiveCell(null); setOpenMenu(null)
      }
      else if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
      else if (ctrl && e.key.toLowerCase() === 'c' && curSelected) {
        e.preventDefault()
        setClipboardBlock(JSON.parse(JSON.stringify(curSelected)))
        toast('Блок скопирован (Ctrl+V чтобы вставить)', 'info')
      }
      else if (ctrl && e.key.toLowerCase() === 'v' && clipboardBlock) {
        e.preventDefault()
        pasteBlock(clipboardBlock)
      }
      else if (ctrl && e.key.toLowerCase() === 'd' && selectedBlock) { e.preventDefault(); duplicateBlock() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock) { e.preventDefault(); deleteBlock(selectedBlock) }
      else if (selectedBlock && !curSelected?.style?.locked && !e.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 5 : 1
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0
        setSlides(sl => sl.map((s, i) => i !== active ? s : {
          ...s,
          content: {
            ...s.content,
            blocks: s.content.blocks.map(b => b.id !== selectedBlock || b.style?.x === undefined ? b : {
              ...b, style: { ...b.style, x: Math.max(-10, Math.min(96, (b.style.x || 0) + dx)), y: Math.max(-10, Math.min(96, (b.style.y || 0) + dy)) },
            }),
          },
        }))
      }
      else if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) { e.preventDefault(); selectSlide(Math.min(active + 1, slides.length - 1)) }
      else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) { e.preventDefault(); selectSlide(Math.max(active - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slideshow, showPreview, chartModalBlockId, showTemplates, ctxMenu, history, redoStack, slides, selectedBlock, curSelected, active, clipboardBlock])

  // Слайд-шоу: клавиатура
  useEffect(() => {
    if (!slideshow) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setSlideshow(false) }
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); setShowIdx(i => Math.min(i + 1, slides.length - 1)) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') { e.preventDefault(); setShowIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Home') { e.preventDefault(); setShowIdx(0) }
      else if (e.key === 'End') { e.preventDefault(); setShowIdx(slides.length - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slideshow, slides.length])

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  // ==================== ПЛАВНОЕ 60 FPS ПЕРЕТАСКИВАНИЕ, РЕСАЙЗ И ПОВОРОТ ====================
  const commitLiveTransform = useCallback(() => {
    const lt = liveTransformRef.current
    liveTransformRef.current = null
    setLiveTransform(null)
    setGuides({ v: null, h: null })
    if (!lt) return
    pushHistory()
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(b => b.id === lt.id ? {
          ...b,
          style: {
            ...b.style,
            x: parseFloat(lt.x.toFixed(2)),
            y: parseFloat(lt.y.toFixed(2)),
            w: parseFloat(lt.w.toFixed(2)),
            h: parseFloat(lt.h.toFixed(2)),
            rotation: Math.round(lt.rotation),
          },
        } : b),
      },
    }))
  }, [active, pushHistory])

  const handleDragStart = (e: React.PointerEvent, blockId: string) => {
    if (e.button !== 0) return
    const block = cur?.content.blocks.find(b => b.id === blockId)
    if (!block || block.style?.x === undefined) return
    setCtxMenu(null)
    setSelectedBlock(blockId)
    if (block.style?.locked) return
    e.preventDefault()
    liveTransformRef.current = null
    setDragging({
      id: blockId,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.style.x ?? 10,
      origY: block.style.y ?? 10,
      origW: block.style.w ?? 30,
      origH: block.style.h ?? 20,
      origRot: block.style.rotation ?? 0,
    })
  }

  const handleDragMove = (e: PointerEvent) => {
    if (!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 10 || rect.height < 10) return
    if (Math.abs(e.clientX - dragging.startX) < 2 && Math.abs(e.clientY - dragging.startY) < 2 && !liveTransformRef.current) return
    const dx = ((e.clientX - dragging.startX) / rect.width) * 100
    const dy = ((e.clientY - dragging.startY) / rect.height) * 100
    const bw = dragging.origW
    const bh = dragging.origH
    let newX = Math.max(-5, Math.min(105 - bw, dragging.origX + dx))
    let newY = Math.max(-5, Math.min(105 - bh, dragging.origY + dy))

    let snapV: number | null = null
    let snapH: number | null = null

    if (!e.altKey) {
      const threshX = 1.0
      const threshY = 1.2
      // Опорные линии: центр/края слайда + соседние блоки
      const vTargets: number[] = [50, 5, 95]
      const hTargets: number[] = [50, 6, 94]
      for (const ob of (cur?.content.blocks || [])) {
        if (ob.id === dragging.id || ob.style?.x === undefined) continue
        const ox = ob.style.x, ow = ob.style.w || 20
        const oy = ob.style.y, oh = ob.style.h || 15
        vTargets.push(ox, ox + ow / 2, ox + ow)
        hTargets.push(oy, oy + oh / 2, oy + oh)
      }
      for (const tx of vTargets) {
        if (Math.abs((newX + bw / 2) - tx) < threshX) { newX = tx - bw / 2; snapV = tx; break }
        if (Math.abs(newX - tx) < threshX * 0.8) { newX = tx; snapV = tx; break }
        if (Math.abs((newX + bw) - tx) < threshX * 0.8) { newX = tx - bw; snapV = tx; break }
      }
      for (const ty of hTargets) {
        if (Math.abs((newY + bh / 2) - ty) < threshY) { newY = ty - bh / 2; snapH = ty; break }
        if (Math.abs(newY - ty) < threshY * 0.8) { newY = ty; snapH = ty; break }
        if (Math.abs((newY + bh) - ty) < threshY * 0.8) { newY = ty - bh; snapH = ty; break }
      }
    }

    setGuides({ v: snapV, h: snapH })
    const next = { id: dragging.id, x: newX, y: newY, w: bw, h: bh, rotation: dragging.origRot }
    liveTransformRef.current = next
    setLiveTransform(next)
  }

  const handleDragEnd = () => {
    if (!dragging) return
    setDragging(null)
    commitLiveTransform()
  }

  const handleResizeStart = (e: React.PointerEvent, blockId: string, handle: string) => {
    if (e.button !== 0) return
    const block = cur?.content.blocks.find(b => b.id === blockId)
    if (!block || block.style?.locked) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu(null)
    liveTransformRef.current = null
    setResizing({
      id: blockId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.style?.x ?? 10,
      origY: block.style?.y ?? 10,
      origW: block.style?.w ?? 30,
      origH: block.style?.h ?? 20,
      origRot: block.style?.rotation ?? 0,
    })
  }

  const handleResizeMove = (e: PointerEvent) => {
    if (!resizing) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 10 || rect.height < 10) return
    const dx = ((e.clientX - resizing.startX) / rect.width) * 100
    const dy = ((e.clientY - resizing.startY) / rect.height) * 100
    let newW = resizing.origW
    let newH = resizing.origH
    let newX = resizing.origX
    let newY = resizing.origY
    const handle = resizing.handle
    const isCorner = handle.length === 2

    if (handle.includes('e')) newW = Math.max(4, resizing.origW + dx)
    if (handle.includes('s')) newH = Math.max(3, resizing.origH + dy)
    if (handle.includes('w')) {
      const clampedW = Math.max(4, resizing.origW - dx)
      newX = resizing.origX + (resizing.origW - clampedW)
      newW = clampedW
    }
    if (handle.includes('n')) {
      const clampedH = Math.max(3, resizing.origH - dy)
      newY = resizing.origY + (resizing.origH - clampedH)
      newH = clampedH
    }

    // Shift + угловая ручка = сохраняем пропорции как в PowerPoint / Figma!
    if (e.shiftKey && isCorner && resizing.origW > 0 && resizing.origH > 0) {
      const ratio = resizing.origW / resizing.origH
      const propH = Math.max(3, newW / ratio)
      if (handle.includes('n')) newY = resizing.origY + (resizing.origH - propH)
      newH = propH
    }

    newX = Math.max(-5, Math.min(105 - newW, newX))
    newY = Math.max(-5, Math.min(105 - newH, newY))
    const next = { id: resizing.id, x: newX, y: newY, w: newW, h: newH, rotation: resizing.origRot }
    liveTransformRef.current = next
    setLiveTransform(next)
  }

  const handleResizeEnd = () => {
    if (!resizing) return
    setResizing(null)
    commitLiveTransform()
  }

  const handleRotateStart = (e: React.PointerEvent, blockId: string) => {
    if (e.button !== 0) return
    const block = cur?.content.blocks.find(b => b.id === blockId)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!block || block.style?.locked || !rect) return
    e.preventDefault()
    e.stopPropagation()
    const origX = block.style?.x ?? 10
    const origY = block.style?.y ?? 10
    const origW = block.style?.w ?? 30
    const origH = block.style?.h ?? 20
    const origRot = block.style?.rotation ?? 0
    const cx = rect.left + ((origX + origW / 2) / 100) * rect.width
    const cy = rect.top + ((origY + origH / 2) / 100) * rect.height
    const startAngle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
    liveTransformRef.current = null
    setRotating({ id: blockId, cx, cy, startAngle, origRot, origX, origY, origW, origH })
  }

  const handleRotateMove = (e: PointerEvent) => {
    if (!rotating) return
    const curAngle = (Math.atan2(e.clientY - rotating.cy, e.clientX - rotating.cx) * 180) / Math.PI
    let rot = rotating.origRot + (curAngle - rotating.startAngle)
    rot = ((rot % 360) + 360) % 360
    if (rot > 180) rot -= 360
    if (e.shiftKey) rot = Math.round(rot / 15) * 15
    else if (Math.abs(rot) < 4) rot = 0
    else if (Math.abs(Math.abs(rot) - 90) < 4) rot = rot > 0 ? 90 : -90
    const next = { id: rotating.id, x: rotating.origX, y: rotating.origY, w: rotating.origW, h: rotating.origH, rotation: Math.round(rot) }
    liveTransformRef.current = next
    setLiveTransform(next)
  }

  const handleRotateEnd = () => {
    if (!rotating) return
    setRotating(null)
    commitLiveTransform()
  }

  useEffect(() => {
    if (!dragging) return
    const mm = (e: PointerEvent) => handleDragMove(e)
    const mu = () => handleDragEnd()
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    window.addEventListener('pointercancel', mu)
    return () => {
      window.removeEventListener('pointermove', mm)
      window.removeEventListener('pointerup', mu)
      window.removeEventListener('pointercancel', mu)
    }
  }, [dragging, cur, active, commitLiveTransform])

  useEffect(() => {
    if (!resizing) return
    const mm = (e: PointerEvent) => handleResizeMove(e)
    const mu = () => handleResizeEnd()
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    window.addEventListener('pointercancel', mu)
    return () => {
      window.removeEventListener('pointermove', mm)
      window.removeEventListener('pointerup', mu)
      window.removeEventListener('pointercancel', mu)
    }
  }, [resizing, cur, active, commitLiveTransform])

  useEffect(() => {
    if (!rotating) return
    const mm = (e: PointerEvent) => handleRotateMove(e)
    const mu = () => handleRotateEnd()
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    window.addEventListener('pointercancel', mu)
    return () => {
      window.removeEventListener('pointermove', mm)
      window.removeEventListener('pointerup', mu)
      window.removeEventListener('pointercancel', mu)
    }
  }, [rotating, commitLiveTransform])

  const toggleEditFullscreen = async () => {
    const el = fullscreenRef.current as any
    try {
      if (!document.fullscreenElement) {
        if (el?.requestFullscreen) await el.requestFullscreen()
        else setIsEditFullscreen(v => !v)
      } else {
        if (document.exitFullscreen) await document.exitFullscreen()
        else setIsEditFullscreen(false)
      }
    } catch {
      setIsEditFullscreen(v => !v)
    }
  }
  useEffect(() => {
    const onFs = () => setIsEditFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // ==================== ОПЕРАЦИИ СО СЛАЙДАМИ ====================
  const addSlide = (layout = 'blank') => {
    pushHistory()
    const genId = () => 'b' + Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5)
    const layouts: Record<string, { blocks: Block[]; bg?: string; grad?: string; bgType?: 'solid' | 'gradient' }> = {
      blank: { blocks: [{ id: genId(), type: 'text', content: 'Новый слайд', style: { fontSize: 28, bold: true, fontFamily: 'Manrope', color: '#1e293b', x: 8, y: 12, w: 84, h: 15, z: 1, unit: '%' } }] },
      title: {
        blocks: [
          { id: genId(), type: 'text', content: 'Заголовок слайда', style: { fontSize: 36, bold: true, align: 'center', fontFamily: 'Manrope', color: '#0f172a', x: 6, y: 24, w: 88, h: 18, z: 1, unit: '%' } },
          { id: genId(), type: 'text', content: 'Подзаголовок или имя автора', style: { fontSize: 18, align: 'center', color: '#64748b', x: 12, y: 46, w: 76, h: 12, z: 2, unit: '%' } },
        ],
      },
      content: {
        blocks: [
          { id: genId(), type: 'text', content: 'Заголовок раздела', style: { fontSize: 28, bold: true, fontFamily: 'Manrope', color: '#0f172a', x: 6, y: 8, w: 88, h: 14, z: 1, unit: '%' } },
          { id: genId(), type: 'text', content: 'Главный тезис 1\nГлавный тезис 2\nГлавный тезис 3', style: { fontSize: 18, bullet: true, color: '#334155', x: 8, y: 26, w: 84, h: 52, z: 2, unit: '%' } },
        ],
      },
      two_col: {
        blocks: [
          { id: genId(), type: 'text', content: 'Сравнение / Две колонки', style: { fontSize: 26, bold: true, fontFamily: 'Manrope', color: '#0f172a', x: 5, y: 7, w: 90, h: 13, z: 1, unit: '%' } },
          { id: genId(), type: 'text', content: 'Левая колонка\n• Тезис 1\n• Тезис 2', style: { fontSize: 17, x: 5, y: 24, w: 43, h: 60, z: 2, background: '#f8fafc', borderRadius: 10, color: '#1e293b', unit: '%' } },
          { id: genId(), type: 'text', content: 'Правая колонка\n• Тезис 1\n• Тезис 2', style: { fontSize: 17, x: 52, y: 24, w: 43, h: 60, z: 3, background: '#f8fafc', borderRadius: 10, color: '#1e293b', unit: '%' } },
        ],
      },
      image: {
        blocks: [
          { id: genId(), type: 'text', content: 'Слайд с иллюстрацией', style: { fontSize: 26, bold: true, color: '#0f172a', x: 6, y: 8, w: 88, h: 12, z: 1, unit: '%' } },
          { id: genId(), type: 'image', src: 'https://picsum.photos/800/450', style: { x: 8, y: 24, w: 50, h: 62, z: 2, borderRadius: 10, unit: '%' } },
          { id: genId(), type: 'text', content: 'Описание иллюстрации и ключевые выводы по теме.', style: { fontSize: 17, color: '#334155', x: 62, y: 28, w: 32, h: 52, z: 3, unit: '%' } },
        ],
      },
      table: {
        blocks: [
          { id: genId(), type: 'text', content: 'Таблица данных', style: { fontSize: 24, bold: true, color: '#0f172a', x: 6, y: 7, w: 88, h: 12, z: 1, unit: '%' } },
          { id: genId(), type: 'table', table: createDefaultTable(4, 3), style: { x: 6, y: 22, w: 88, h: 64, z: 2, unit: '%' } },
        ],
      },
      chart: {
        blocks: [
          { id: genId(), type: 'text', content: 'Аналитика и график', style: { fontSize: 24, bold: true, color: '#0f172a', x: 6, y: 7, w: 88, h: 12, z: 1, unit: '%' } },
          { id: genId(), type: 'chart', style: { chartType: 'bar', x: 10, y: 22, w: 80, h: 66, z: 2, unit: '%' }, chartData: createDefaultChartData('Результаты по четвертям') },
        ],
      },
      quote: {
        blocks: [
          { id: genId(), type: 'text', content: '«Образование — самое мощное оружие, с помощью которого можно изменить мир.»', style: { fontSize: 28, italic: true, bold: true, align: 'center', fontFamily: 'Georgia', color: '#0f172a', x: 10, y: 26, w: 80, h: 32, z: 1, unit: '%' } },
          { id: genId(), type: 'text', content: '— Нельсон Мандела', style: { fontSize: 17, align: 'center', color: '#64748b', x: 20, y: 62, w: 60, h: 10, z: 2, unit: '%' } },
        ],
      },
      thanks: {
        bg: '#0f172a',
        bgType: 'gradient',
        grad: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
        blocks: [
          { id: genId(), type: 'text', content: 'Спасибо за внимание!', style: { fontSize: 44, bold: true, align: 'center', fontFamily: 'Manrope', color: '#ffffff', x: 8, y: 34, w: 84, h: 20, z: 1, unit: '%' } },
          { id: genId(), type: 'text', content: 'Вопросы и обсуждение', style: { fontSize: 20, align: 'center', color: '#cbd5e1', x: 18, y: 56, w: 64, h: 12, z: 2, unit: '%' } },
        ],
      },
    }
    const spec = layouts[layout] || layouts.blank
    spec.blocks.forEach((b: any, i: number) => { if (!b.style) b.style = {}; if (b.style.z === undefined) b.style.z = i + 1; if (!b.style.unit) b.style.unit = '%' })
    const insertAt = active + 1
    const nextSlide: Slide = {
      order: insertAt,
      background: spec.bg || '#ffffff',
      backgroundType: spec.bgType || 'solid',
      gradient: spec.grad,
      layout,
      transition: cur?.transition || 'fade',
      content: { blocks: spec.blocks },
    }
    setSlides(s => {
      const copy = [...s]
      copy.splice(insertAt, 0, nextSlide)
      return copy.map((x, idx) => ({ ...x, order: idx }))
    })
    selectSlide(insertAt)
  }

  const moveSlide = (dir: -1 | 1) => {
    const ni = active + dir
    if (ni < 0 || ni >= slides.length) return
    pushHistory()
    setSlides(s => {
      const c = [...s]
      const tmp = c[active]; c[active] = c[ni]; c[ni] = tmp
      return c.map((x, i) => ({ ...x, order: i }))
    })
    setActive(ni)
  }

  const duplicateSlide = () => {
    pushHistory()
    const copy = { ...cur, id: undefined, content: JSON.parse(JSON.stringify(cur.content)) }
    const at = active + 1
    setSlides(s => { const c = [...s]; c.splice(at, 0, { ...copy, order: at }); return c.map((s2, i2) => ({ ...s2, order: i2 })) })
    selectSlide(at)
  }

  const deleteSlide = () => {
    if (slides.length <= 1) return
    pushHistory()
    setSlides(s => s.filter((_, i) => i !== active).map((x, i) => ({ ...x, order: i })))
    selectSlide(Math.max(0, active - 1))
  }

  // ==================== ОПЕРАЦИИ С БЛОКАМИ ====================
  const addBlock = (type: Block['type'], extra: any = {}) => {
    pushHistory()
    const nid = 'b' + Date.now() + Math.random().toString(36).slice(2, 4)
    const maxZ = Math.max(0, ...(cur?.content.blocks || []).map(b => b.style?.z || 0))
    const geomByType: any = {
      text: { x: 18, y: 36, w: 64, h: 18 },
      image: { x: 20, y: 18, w: 56, h: 56 },
      shape: { x: 34, y: 30, w: 28, h: 32 },
      table: { x: 8, y: 20, w: 84, h: 52 },
      chart: { x: 12, y: 18, w: 76, h: 62 },
      video: { x: 15, y: 20, w: 70, h: 54 },
      icon: { x: 42, y: 34, w: 16, h: 24 },
    }
    let block: Block = { id: nid, type } as any
    const baseGeom = { ...(geomByType[type] || { x: 20, y: 30, w: 50, h: 30 }), z: maxZ + 1, unit: '%' }

    if (type === 'text') {
      block = {
        id: nid, type,
        content: extra.content || 'Введите текст…',
        style: { fontSize: 18, color: '#1e293b', align: 'left', fontFamily: 'Inter', lineHeight: 1.35, ...baseGeom, ...(extra.style || {}) },
      }
    } else if (type === 'video') {
      block = { id: nid, type, content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', style: { ...baseGeom } }
    } else if (type === 'image') {
      block = { id: nid, type, src: extra.src || 'https://picsum.photos/800/450', style: { borderRadius: 8, objectFit: 'contain', ...baseGeom } }
    } else if (type === 'shape') {
      const shKey = extra.shape || 'rect'
      const def = getShapeDef(shKey)
      const shGeom = def.isLine
        ? { ...baseGeom, x: 25, y: 46, w: 50, h: 8 }
        : ['circle', 'star', 'heart', 'plus', 'diamond', 'pentagon', 'hexagon', 'badge'].includes(shKey)
          ? { ...baseGeom, x: 38, y: 26, w: 24, h: 42 }
          : shKey === 'callout'
            ? { ...baseGeom, x: 30, y: 26, w: 36, h: 30 }
            : { ...baseGeom, x: 32, y: 30, w: 34, h: 26 }
      block = {
        id: nid, type, shape: shKey,
        content: shKey === 'callout' ? 'Важная заметка!' : '',
        style: {
          fill: def.isLine ? 'transparent' : '#3b82f6',
          stroke: '#1d4ed8',
          strokeWidth: def.isLine ? 4 : 2,
          dash: 'solid',
          opacity: 1,
          textColor: '#ffffff',
          textSize: 16,
          textBold: true,
          ...shGeom,
        },
      }
    } else if (type === 'table') {
      const tRows = extra.rows || 3
      const tCols = extra.cols || 3
      const tbl = createDefaultTable(tRows, tCols)
      if (extra.theme) tbl.theme = extra.theme
      block = { id: nid, type, table: tbl, style: { ...baseGeom } }
    } else if (type === 'chart') {
      const kind: ChartKind = extra.chartType || 'bar'
      block = {
        id: nid, type, content: '',
        style: { chartType: kind, ...baseGeom },
        chartData: createDefaultChartData(kind === 'pie' || kind === 'donut' ? 'Распределение' : 'Показатели'),
      }
    } else if (type === 'icon') {
      block = { id: nid, type, content: extra.icon || '★', style: { fontSize: 42, ...baseGeom } }
    }

    setSlides(sl => sl.map((s, i) => i !== active ? s : { ...s, content: { ...s.content, blocks: [...s.content.blocks, block] } }))
    setSelectedBlock(nid)
    setActiveCell(type === 'table' ? { r: 0, c: 0 } : null)
    if (type === 'text') setEditingText(nid)
  }

  const pasteBlock = (src: Block) => {
    pushHistory()
    const nid = 'b' + Date.now()
    const clone: Block = JSON.parse(JSON.stringify(src))
    clone.id = nid
    const maxZ = Math.max(1, ...(cur?.content.blocks || []).map(b => b.style?.z || 1))
    if (clone.style?.x !== undefined) {
      clone.style.x = Math.min(86, (clone.style.x || 0) + 3)
      clone.style.y = Math.min(86, (clone.style.y || 0) + 3)
      clone.style.z = maxZ + 1
      clone.style.locked = false
    }
    setSlides(sl => sl.map((s, i) => i !== active ? s : { ...s, content: { ...s.content, blocks: [...s.content.blocks, clone] } }))
    setSelectedBlock(nid)
    toast('Блок вставлен', 'success')
  }

  const duplicateBlock = () => {
    if (!selectedBlock || !curSelected) return
    pasteBlock(curSelected)
  }

  const updateSlide = (patch: Partial<Slide>) => {
    setSlides(sl => sl.map((s, i) => i === active ? { ...s, ...patch } : s))
  }

  const applyTransitionAll = (tr: string) => {
    pushHistory()
    setSlides(sl => sl.map(s => ({ ...s, transition: tr })))
    toast(`Переход «${tr}» применён ко всем слайдам`, 'success')
  }

  const updateSelected = (patch: any) => {
    if (!selectedBlock) return
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(b => b.id === selectedBlock ? {
          ...b, ...patch,
          style: patch.style ? { ...b.style, ...patch.style } : b.style,
        } : b),
      },
    }))
  }

  const updateSelectedStyle = (patch: any) => {
    if (!selectedBlock) return
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(b => {
          if (b.id !== selectedBlock) return b
          const paras = (b as any).paragraphs
          let np = paras
          if (Array.isArray(paras) && paras.length) {
            const RK = ['fontSize', 'color', 'fontFamily', 'bold', 'italic', 'underline', 'highlight', 'highlightColor', 'textShadow']
            const keys = Object.keys(patch).filter(k => RK.includes(k))
            np = paras.map((p: any) => ({
              ...p,
              ...(patch.align !== undefined ? { align: patch.align } : {}),
              runs: keys.length ? (Array.isArray(p.runs) && p.runs.length) ? p.runs.map((r: any) => ({ ...r, style: { ...(r.style || {}), ...Object.fromEntries(keys.map(k => [k, patch[k]])) } })) : p.runs : p.runs,
            }))
          }
          return { ...b, style: { ...b.style, ...patch }, ...(np !== paras ? { paragraphs: np } : {}) }
        }),
      },
    }))
  }

  const deleteBlock = (blockId: string | null) => {
    if (!blockId) return
    pushHistory()
    setSlides(sl => sl.map((s, i) => i !== active ? s : { ...s, content: { ...s.content, blocks: s.content.blocks.filter(b => b.id !== blockId) } }))
    setSelectedBlock(prev => prev === blockId ? null : prev)
    setActiveCell(null)
  }

  const bringForward = () => {
    if (!selectedBlock || !curSelected) return
    const maxZ = Math.max(1, ...(cur?.content.blocks || []).map(b => b.style?.z || 1))
    updateSelectedStyle({ z: maxZ + 1 })
  }

  const sendBackward = () => {
    if (!selectedBlock || !curSelected) return
    updateSelectedStyle({ z: Math.max(0, (curSelected.style?.z || 1) - 1) })
  }

  const centerBlock = (axis: 'h' | 'v') => {
    if (!selectedBlock || !curSelected || curSelected.style?.x === undefined) return
    if (axis === 'h') updateSelectedStyle({ x: Math.max(0, Math.round((100 - (curSelected.style.w || 40)) / 2)) })
    else updateSelectedStyle({ y: Math.max(0, Math.round((100 - (curSelected.style.h || 20)) / 2)) })
  }

  // ---- Операции с таблицей ----
  const updateTableCell = (blockId: string, r: number, c: number, text: string) => {
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(bb => {
          if (bb.id !== blockId) return bb
          const tbl = bb.table || createDefaultTable(3, 3)
          const rows = Math.max(tbl.rows || 3, r + 1)
          const cols = Math.max(tbl.cols || 3, c + 1)
          const cells = Array.from({ length: rows }, (_, ri) =>
            Array.from({ length: cols }, (_, ci) => tbl.cells?.[ri]?.[ci] ? { ...tbl.cells[ri][ci] } : { text: '', style: {} })
          )
          cells[r][c] = { ...cells[r][c], text }
          return { ...bb, table: { ...tbl, rows, cols, cells } }
        }),
      },
    }))
  }

  const updateTableColWidths = (blockId: string, colWidths: number[]) => {
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(bb => bb.id !== blockId ? bb : {
          ...bb, table: { ...(bb.table || createDefaultTable(3, 3)), colWidths },
        }),
      },
    }))
  }

  const updateBlockById = (blockId: string, patch: any) => {
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(b => b.id === blockId ? {
          ...b,
          ...patch,
          style: patch.style ? { ...b.style, ...patch.style } : b.style,
        } : b),
      },
    }))
  }

  const applyTemplate = (tplSlides: Slide[], mode: 'replace' | 'append', tplName: string) => {
    pushHistory()
    if (mode === 'replace') {
      setSlides(tplSlides.map((s, idx) => ({ ...s, order: idx })))
      selectSlide(0)
      if (!title || title === 'Новая презентация') setTitle(tplName)
      toast(`Применён шаблон «${tplName}» (${tplSlides.length} слайдов)`, 'success')
    } else {
      const startIdx = slides.length
      setSlides(prev => [...prev, ...tplSlides].map((s, idx) => ({ ...s, order: idx })))
      selectSlide(startIdx)
      toast(`Добавлено ${tplSlides.length} слайдов из шаблона «${tplName}»`, 'success')
    }
  }

  const deleteSlideAt = useCallback((idx: number) => {
    if (slides.length <= 1) { toast('Должен остаться хотя бы один слайд', 'error'); return }
    if (!confirm(`Удалить слайд ${idx + 1}?`)) return
    pushHistory()
    setSlides(sl => sl.filter((_, i) => i !== idx).map((x, i) => ({ ...x, order: i })))
    if (idx <= active) setActive(Math.max(0, active - 1))
    if (active === idx) setSelectedBlock(null)
  }, [slides.length, active, pushHistory])

  const editTableSize = (action: 'addRow' | 'delRow' | 'addCol' | 'delCol', targetId?: string) => {
    const bid = targetId || selectedBlock
    if (!bid) return
    pushHistory()
    setSlides(sl => sl.map((s, i) => i !== active ? s : {
      ...s,
      content: {
        ...s.content,
        blocks: s.content.blocks.map(bb => {
          if (bb.id !== bid || bb.type !== 'table') return bb
          const tbl = bb.table || createDefaultTable(3, 3)
          let rows = tbl.rows || tbl.cells?.length || 3
          let cols = tbl.cols || tbl.cells?.[0]?.length || 3
          let cells: any[][] = Array.from({ length: rows }, (_, ri) =>
            Array.from({ length: cols }, (_, ci) => tbl.cells?.[ri]?.[ci] ? JSON.parse(JSON.stringify(tbl.cells[ri][ci])) : { text: '', style: {} })
          )
          let colWidths = tbl.colWidths
          if (action === 'addRow' && rows < 14) {
            rows += 1
            cells.push(Array.from({ length: cols }, (_, ci) => ({ text: ci === 0 ? `Строка ${rows - 1}` : '', style: {} })))
          } else if (action === 'delRow' && rows > 1) {
            rows -= 1
            cells = cells.slice(0, rows)
          } else if (action === 'addCol' && cols < 10) {
            cols += 1
            cells = cells.map((row, ri) => [...row, { text: ri === 0 ? `Столбец ${cols}` : '', style: {} }])
            colWidths = Array.from({ length: cols }, () => Number((100 / cols).toFixed(2)))
          } else if (action === 'delCol' && cols > 1) {
            cols -= 1
            cells = cells.map(row => row.slice(0, cols))
            colWidths = Array.from({ length: cols }, () => Number((100 / cols).toFixed(2)))
          }
          return { ...bb, table: { ...tbl, rows, cols, cells, colWidths } }
        }),
      },
    }))
  }

  const updateTableProps = (patch: any) => {
    if (!selectedBlock || curSelected?.type !== 'table') return
    updateSelected({ table: { ...(curSelected.table || createDefaultTable(3, 3)), ...patch } })
  }

  const updateActiveCellStyle = (patch: any) => {
    if (!selectedBlock || curSelected?.type !== 'table' || !activeCell) return
    const { r, c } = activeCell
    const tbl = curSelected.table || createDefaultTable(3, 3)
    const rows = tbl.rows || 3, cols = tbl.cols || 3
    const cells = Array.from({ length: rows }, (_, ri) =>
      Array.from({ length: cols }, (_, ci) => tbl.cells?.[ri]?.[ci] ? JSON.parse(JSON.stringify(tbl.cells[ri][ci])) : { text: '', style: {} })
    )
    cells[r][c] = { ...cells[r][c], style: { ...(cells[r][c]?.style || {}), ...patch } }
    updateSelected({ table: { ...tbl, cells } })
  }

  // ---- Темы и медиа ----
  const applyTheme = (th: typeof PPT_THEMES[number], allSlides = false) => {
    pushHistory()
    setSlides(sl => sl.map((s, i) => {
      if (!allSlides && i !== active) return s
      const updatedBlocks = (s.content.blocks || []).map((b, bi) => {
        if (b.type === 'text') {
          const isHeading = (b.style?.fontSize || 18) >= 24 || bi === 0
          const nextCol = isHeading ? th.titleColor : th.bodyColor
          const paras = Array.isArray((b as any).paragraphs)
            ? (b as any).paragraphs.map((p: any) => ({
                ...p,
                runs: Array.isArray(p.runs) ? p.runs.map((r: any) => ({ ...r, style: { ...(r.style || {}), color: nextCol } })) : p.runs,
              }))
            : (b as any).paragraphs
          return { ...b, style: { ...b.style, color: nextCol }, ...(paras ? { paragraphs: paras } : {}) }
        }
        if (b.type === 'shape') return { ...b, style: { ...b.style, fill: th.accent } }
        return b
      })
      return {
        ...s,
        background: th.bg,
        backgroundType: th.type,
        gradient: th.grad || undefined,
        content: { ...s.content, blocks: updatedBlocks },
      }
    }))
    toast(allSlides ? `Тема «${th.name}» применена ко всем слайдам` : `Тема «${th.name}» применена к слайду`, 'success')
  }

  const addVideo = () => {
    addBlock('video')
    toast('Видео добавлено — вставьте ссылку YouTube / VK / Rutube в панели «Свойства»', 'info')
  }

  const handleImageUpload = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { toast('Картинка больше 8MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      addBlock('image', { src: reader.result as string })
      toast('Картинка добавлена на слайд', 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const replaceSelectedImage = (file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast('Картинка больше 8MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      pushHistory()
      updateSelected({ src: reader.result as string })
      toast('Изображение заменено', 'success')
    }
    reader.readAsDataURL(file)
  }

  const handleBgImage = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      pushHistory()
      updateSlide({ backgroundType: 'image', bgImage: reader.result as string })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ==================== ЭКСПОРТ PDF ====================
  const exportSlidesPdf = () => {
    const win = window.open('', '_blank')
    if (!win) { toast('Разреши всплывающие окна для экспорта в PDF / печати', 'error'); return }
    const esc = (s: string) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])
    const pagesHtml = slides.map(s => {
      const bg = s.backgroundType === 'gradient' && s.gradient ? s.gradient : (s.background || '#ffffff')
      const blocksHtml = (s.content.blocks || [])
        .slice()
        .sort((a: any, b: any) => (a.style?.z || 0) - (b.style?.z || 0))
        .map((b: any) => {
          const st = b.style || {}
          const pos = `position:absolute;left:${st.x ?? 5}%;top:${st.y ?? 10}%;width:${st.w ?? 90}%;height:${st.h != null ? `${st.h}%` : 'auto'};z-index:${st.z || 1};`
          if (b.type === 'text') {
            const txt = b.paragraphs ? b.paragraphs.map((p: any) => p.runs ? p.runs.map((r: any) => r.text || '').join('') : (p.text || '')).join('\n') : (b.content || '')
            return `<div style="${pos}font-size:${st.fontSize || 18}px;font-weight:${st.bold ? 700 : 400};font-style:${st.italic ? 'italic' : 'normal'};color:${st.color || '#1e293b'};text-align:${st.align || 'left'};white-space:pre-wrap;font-family:${st.fontFamily || 'Inter'},sans-serif;background:${st.background || 'transparent'};border-radius:${st.borderRadius || 0}px;padding:${st.background ? '6px 8px' : '2px 6px'}">${esc(txt)}</div>`
          }
          if (b.type === 'image' && b.src) return `<img src="${esc(resolveSrc(b.src))}" style="${pos}object-fit:${st.objectFit || 'contain'};border-radius:${st.borderRadius || 0}px;" />`
          if (b.type === 'shape') return renderShapeHtml(b, pos)
          if (b.type === 'table') return renderTableHtml(b, pos)
          if (b.type === 'chart') return renderChartHtml(b, pos)
          return ''
        }).join('')
      return `<section class="slide" style="background:${bg}">${blocksHtml}</section>`
    }).join('')
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px;font-family:Inter,system-ui,sans-serif}.slide{width:960px;height:540px;position:relative;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.4);page-break-after:always}@media print{body{background:#fff;padding:0;gap:0}.slide{width:100vw;height:100vh;box-shadow:none}}</style></head><body>${pagesHtml}<script>setTimeout(()=>window.print(),350)</script></body></html>`)
    win.document.close()
  }

  // ==================== СОХРАНЕНИЕ И ИМПОРТ ====================
  const save = async (silent = false) => {
    if (loadFailed) { toast('Презентация не загружена — обновите страницу', 'error'); return }
    const token = localStorage.getItem('token') || localStorage.getItem('access')
    if (!token) { toast('Войди чтобы сохранить', 'error'); nav('/login'); return }
    if (!title.trim()) { toast('Укажи название презентации', 'error'); return }
    if (!silent && !subject && !confirm('Сохранить без предмета? Презентация не попадёт в уроки — предмет можно выбрать позже.')) return
    setSaving(true); savingRef.current = true
    try {
      const targetId = isNew ? importedId : id
      if (isNew && !importedId) {
        const r = await client.post('/presentations/', { title: title.trim(), description: desc.trim(), subject: subject || null, is_public: isPublic })
        const pid = r.data.id
        for (let i = 0; i < slides.length; i++) {
          await client.post(`/presentations/${pid}/slides/`, {
            order: i, background: slides[i].background, backgroundType: slides[i].backgroundType,
            gradient: slides[i].gradient, bgImage: slides[i].bgImage, content: slides[i].content,
            notes: slides[i].notes || '', layout: slides[i].layout, transition: slides[i].transition,
          })
        }
        setDirty(false)
        toast('Презентация сохранена', 'success')
        nav(`/presentations/${pid}`)
      } else if (targetId) {
        await client.patch(`/presentations/${targetId}/`, { title: title.trim(), description: desc.trim(), subject: subject || null, is_public: isPublic })
        const existing = await client.get(`/presentations/${targetId}/`).then(r => r.data.slides || [])
        for (const s of existing) await client.delete(`/slides/${s.id}/`).catch(() => { })
        for (let i = 0; i < slides.length; i++) {
          await client.post(`/presentations/${targetId}/slides/`, {
            order: i, background: slides[i].background, backgroundType: slides[i].backgroundType,
            gradient: slides[i].gradient, bgImage: slides[i].bgImage, content: slides[i].content,
            notes: slides[i].notes || '', layout: slides[i].layout, transition: slides[i].transition,
          })
        }
        setDirty(false)
        if (!silent) toast('Презентация сохранена', 'success')
        if (isNew && importedId) nav(`/presentations/${importedId}`)
      }
    } catch (e: any) {
      toast(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Ошибка сохранения', 'error')
    }
    setSaving(false); savingRef.current = false
  }

  useEffect(() => {
    if (isNew || !id) return
    const iv = setInterval(() => { if (dirty && !savingRef.current) save(true) }, 5000)
    return () => clearInterval(iv)
  }, [isNew, id, dirty])

  const handleCancel = () => {
    if (dirty && !confirm('Есть несохранённые правки. Выйти без сохранения?')) return
    if (importedId) { nav('/profile?tab=draft'); return }
    if (window.history.length > 2) nav(-1)
    else nav('/presentations')
  }

  const handlePptxImport = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) { alert('Файл >100MB'); return }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!['.pptx', '.ppt', '.pdf'].includes(ext)) { alert('Только .pptx/.ppt/.pdf'); return }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name.replace(/\.[^/.]+$/, ''))
      if (subject) fd.append('subject', String(subject))
      fd.append('is_public', 'false')
      const r = await client.post('/presentations/import/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const imported = (r.data.slides || []).sort((a: any, b: any) => a.order - b.order).map((s: any, idx: number) => ({
        id: s.id, order: idx, background: s.background || '#ffffff',
        backgroundType: s.backgroundType || s.background_type || 'solid',
        gradient: s.gradient, bgImage: s.bgImage || s.bg_image,
        layout: s.layout || 'blank', transition: s.transition || 'fade',
        width: s.width, height: s.height, content: s.content, notes: s.notes || '',
      }))
      if (isNew) {
        if (imported.length) { setSlides(imported); setTitle(r.data.title); setDesc(r.data.description || '') }
        setImportedId(r.data.id)
        toast(`Импортировано ${imported.length} слайдов из ${file.name}`, 'success')
      } else {
        for (const s of imported) {
          await client.post(`/presentations/${id}/slides/`, { order: slides.length, background: s.background, content: s.content, notes: s.notes || '' })
        }
        const fresh = await client.get(`/presentations/${id}/`)
        const s = fresh.data.slides.sort((a: any, b: any) => a.order - b.order).map((x: any, idx: number) => ({ id: x.id, order: idx, background: x.background || '#ffffff', content: x.content, notes: x.notes || '' }))
        setSlides(s)
        toast(`Добавлено ${imported.length} слайдов`, 'success')
        try { await client.delete(`/presentations/${r.data.id}/`) } catch { }
      }
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Ошибка импорта', 'error')
    } finally {
      setImporting(false)
      if (pptxInputRef.current) pptxInputRef.current.value = ''
    }
  }

  useEffect(() => { if (slideshow) setShowIdx(active) }, [slideshow, active])

  // ==================== РЕНДЕР-ХЕЛПЕРЫ ====================
  const runStyleOf = (cb: any) => {
    if (Array.isArray(cb?.paragraphs) && cb.paragraphs.length) {
      const f = (cb.paragraphs[0]?.runs || []).find((r: any) => r?.style && (r.style.fontSize || r.style.color || r.style.fontFamily))
      if (f) return f.style
      const s = cb.style || {}
      if (s.fontSize || s.color || s.fontFamily) return s
      for (const pp of cb.paragraphs.slice(1)) {
        const r2 = (pp.runs || []).find((r: any) => r?.style && (r.style.fontSize || r.style.color || r.style.fontFamily))
        if (r2) return r2.style
      }
    }
    return {}
  }
  const editInline = (b: any, s: any) => {
    const rs = runStyleOf(b) as any
    return {
      fontSize: ((rs.fontSize || s?.fontSize || 16)) + 'px',
      color: rs.color || s?.color || '#1e293b',
      fontFamily: fontStack(rs.fontFamily || s?.fontFamily),
      fontWeight: (rs.bold || s?.bold) ? 700 : 400,
      fontStyle: rs.italic || s?.italic ? 'italic' : undefined,
      textAlign: s?.align || 'left',
      lineHeight: textLineHeight(s),
    }
  }

  const renderBlockOverlay = (b: Block, isSelected: boolean) => {
    if (!isSelected) return null
    const locked = !!b.style?.locked
    const isTransforming = liveTransform?.id === b.id
    return (
      <>
        {/* Плавающая мини-панель действий */}
        {!isTransforming && (
          <div
            data-pe-overlay
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="absolute -top-9 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-slate-900/95 text-white shadow-xl border border-white/15 whitespace-nowrap"
            style={{ transform: `translateX(-50%) scale(var(--pe-inv, 1))`, transformOrigin: 'bottom center' }}
          >
            {b.type === 'table' && (
              <>
                <span
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => handleDragStart(e, b.id)}
                  className="px-1.5 py-0.5 rounded hover:bg-white/15 cursor-move flex items-center gap-1 text-[11px] font-semibold text-orange-300 touch-none"
                  title="Перетащить таблицу"
                >
                  <GripHorizontal size={13} /> Двигать
                </span>
                <span className="w-px h-3.5 bg-white/20 mx-0.5" />
                <button type="button" onClick={() => editTableSize('addRow', b.id)} className="px-1.5 py-0.5 rounded hover:bg-white/15 text-[11px] font-semibold">+Стр</button>
                <button type="button" onClick={() => editTableSize('addCol', b.id)} className="px-1.5 py-0.5 rounded hover:bg-white/15 text-[11px] font-semibold">+Стлб</button>
                <span className="w-px h-3.5 bg-white/20 mx-0.5" />
              </>
            )}
            {b.type === 'chart' && (
              <>
                <button
                  type="button"
                  onClick={() => setChartModalBlockId(b.id)}
                  className="px-2 py-0.5 rounded bg-[#b7472a] hover:bg-[#d24726] text-white text-[11px] font-bold flex items-center gap-1"
                  title="Редактировать таблицу значений диаграммы"
                >
                  <BarChart3 size={12} /> Изменить данные
                </button>
                <span className="w-px h-3.5 bg-white/20 mx-0.5" />
              </>
            )}
            {(b.type === 'text' || (b.type === 'shape' && b.shape !== 'line' && b.shape !== 'lineArrow')) && (
              <button
                type="button"
                onClick={() => b.type === 'text' ? setEditingText(b.id) : setEditingShape(b.id)}
                title="Редактировать текст"
                className="p-1 rounded hover:bg-white/15"
              >
                <Pencil size={12} />
              </button>
            )}
            <button type="button" onClick={duplicateBlock} title="Дублировать (Ctrl+D)" className="p-1 rounded hover:bg-white/15"><Copy size={12} /></button>
            <button type="button" onClick={bringForward} title="На передний план" className="p-1 rounded hover:bg-white/15"><BringToFront size={12} /></button>
            <button type="button" onClick={sendBackward} title="На задний план" className="p-1 rounded hover:bg-white/15"><SendToBack size={12} /></button>
            <button type="button" onClick={() => updateSelectedStyle({ locked: !locked })} title={locked ? 'Разблокировать' : 'Заблокировать'} className={`p-1 rounded hover:bg-white/15 ${locked ? 'text-amber-400' : ''}`}>
              {locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <button type="button" onClick={() => deleteBlock(b.id)} title="Удалить (Del)" className="p-1 rounded hover:bg-red-500/80 text-red-300 hover:text-white"><Trash2 size={12} /></button>
          </div>
        )}

        {/* Живая подсказка координат/размера/угла при перетаскивании */}
        {isTransforming && liveTransform && (
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-40 px-2 py-0.5 rounded-md bg-slate-900/95 text-white text-[11px] font-mono font-bold shadow-lg whitespace-nowrap pointer-events-none"
            style={{ transform: `translateX(-50%) scale(var(--pe-inv, 1))`, transformOrigin: 'bottom center' }}
          >
            {rotating
              ? `${Math.round(liveTransform.rotation)}°`
              : resizing
                ? `${Math.round(liveTransform.w)}% × ${Math.round(liveTransform.h)}%`
                : `X ${Math.round(liveTransform.x)}% · Y ${Math.round(liveTransform.y)}%`}
          </div>
        )}

        {/* 8 ручек масштабирования */}
        {!locked && ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => (
          <div
            key={h}
            className="absolute z-20"
            style={{
              left: h.includes('w') ? 0 : h.includes('e') ? undefined : '50%',
              right: h.includes('e') ? 0 : undefined,
              top: h.includes('n') ? 0 : h.includes('s') ? undefined : '50%',
              bottom: h.includes('s') ? 0 : undefined,
              transform: (h === 'n' || h === 's') ? 'translateX(-50%)' : (h === 'e' || h === 'w') ? 'translateY(-50%)' : undefined,
              width: 0, height: 0,
            }}
          >
            <span
              data-resize-handle={h}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => handleResizeStart(e, b.id, h)}
              className="absolute block w-6 h-6 touch-none"
              style={{
                left: -12, top: -12,
                cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : h === 'ne' || h === 'sw' ? 'nesw-resize' : h === 'n' || h === 's' ? 'ns-resize' : 'ew-resize',
              }}
            >
              <span className="resize-dot pointer-events-none absolute block bg-white border-2 border-[#b7472a] rounded-full shadow" style={{ width: 11, height: 11, left: 6.5, top: 6.5 }} />
            </span>
          </div>
        ))}

        {/* Ручка вращения прямо на холсте (как в PowerPoint / Figma) */}
        {!locked && b.type !== 'table' && (
          <div
            data-pe-overlay
            className="absolute left-1/2 -bottom-8 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-auto"
            style={{ transform: `translateX(-50%) scale(var(--pe-inv, 1))`, transformOrigin: 'top center' }}
          >
            <div className="w-px h-3 bg-[#b7472a]" />
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => handleRotateStart(e, b.id)}
              onDoubleClick={e => { e.stopPropagation(); pushHistory(); updateSelectedStyle({ rotation: 0 }) }}
              title="Потяните для поворота (Shift — шаг 15°, двойной клик — сброс 0°)"
              className="w-6 h-6 rounded-full bg-white border-2 border-[#b7472a] text-[#b7472a] hover:bg-[#b7472a] hover:text-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-colors"
            >
              <RotateCw size={11} />
            </button>
          </div>
        )}
      </>
    )
  }

  const propsPanelNode = (
    <SlidePropsPanel
      cur={cur}
      curSelected={curSelected}
      selectedBlock={selectedBlock}
      activeCell={activeCell}
      runStyleOf={runStyleOf}
      restyleParas={restyleParas}
      updateSelected={updateSelected}
      updateSelectedStyle={updateSelectedStyle}
      updateSlide={updateSlide}
      applyTransitionAll={applyTransitionAll}
      centerBlock={centerBlock}
      bringForward={bringForward}
      sendBackward={sendBackward}
      duplicateBlock={duplicateBlock}
      deleteSelected={() => deleteBlock(selectedBlock)}
      onUploadReplaceImage={replaceSelectedImage}
      onPickBgImage={() => bgImageRef.current?.click()}
      onEditTableSize={act => editTableSize(act)}
      onUpdateTableProps={updateTableProps}
      onUpdateActiveCellStyle={updateActiveCellStyle}
      onOpenChartModal={() => selectedBlock && setChartModalBlockId(selectedBlock)}
    />
  )

  return (
    <div ref={fullscreenRef} className={`${isEditFullscreen ? 'fixed inset-0 z-50 bg-slate-200 dark:bg-slate-950 flex flex-col' : 'flex flex-col h-[calc(100dvh-7.5rem)] -m-4 -mb-28 lg:h-[calc(100vh-64px)] lg:-m-8 lg:mb-0 bg-slate-100 dark:bg-slate-950'}`}>
      <h1 className="sr-only">Редактор презентаций</h1>

      {/* 1. ШАПКА POWERPOINT */}
      <div className="bg-[#b7472a] dark:bg-[#8f2d14] text-white px-2 sm:px-3 py-1.5 flex items-center gap-1.5 sm:gap-2 shrink-0 shadow-md z-20">
        <button
          type="button"
          onClick={() => nav(subjSlug ? `/subjects/${subjSlug}` : '/my-lessons')}
          className="px-2 sm:px-2.5 h-9 rounded-lg bg-black/20 hover:bg-black/35 text-white text-xs sm:text-sm font-bold shrink-0 flex items-center justify-center"
          title={t('back')}
        >
          <span>←</span><span className="hidden md:inline ml-1">{t('back')}</span>
        </button>
        <div className="hidden sm:flex w-8 h-8 rounded-lg bg-white text-[#b7472a] items-center justify-center font-black text-sm shrink-0 shadow">P</div>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setDirty(true) }}
          className="flex-1 min-w-[80px] px-2.5 h-9 rounded-lg bg-white/15 hover:bg-white/20 focus:bg-white focus:text-slate-900 text-white placeholder-white/70 font-bold text-xs sm:text-sm outline-none transition"
          title={title}
          placeholder={t('prog_title_ph')}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={undo} disabled={!history.length} title="Отменить (Ctrl+Z)" className="w-8 h-9 sm:w-9 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-35 flex items-center justify-center shrink-0"><Undo2 size={15} /></button>
          <button type="button" onClick={redo} disabled={!redoStack.length} title="Вернуть (Ctrl+Y)" className="w-8 h-9 sm:w-9 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-35 flex items-center justify-center shrink-0"><Redo2 size={15} /></button>
          <button
            type="button"
            onClick={() => setSlideshow(true)}
            title="Запустить слайд-шоу (F5)"
            className="px-2.5 sm:px-3 h-9 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center gap-1 shrink-0"
          >
            <Play size={14} className="fill-white" /> <span className="hidden sm:inline">{PUI.show}</span>
          </button>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving}
            data-testid="pe-save-btn"
            className="px-3 sm:px-4 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md shrink-0 whitespace-nowrap disabled:opacity-60"
          >
            <Save size={15} />
            <span>{saving ? '…' : t('save')}</span>
            {dirty && <span className="w-2 h-2 rounded-full bg-amber-300 ring-2 ring-slate-950/30 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* 2. СТРОКА ДОКУМЕНТА */}
      <div className="px-2 sm:px-3 py-1.5 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <BookOpen size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
          <select
            value={subject || ''}
            onChange={e => setSubject(e.target.value ? Number(e.target.value) : null)}
            className="px-2.5 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold max-w-[165px]"
          >
            <option value="">{t('subj_no_subject')}</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setIsPublic(v => !v)}
          data-testid="pres-visibility"
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 ${
            isPublic
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          {isPublic ? '🌐' : '🔒'} {isPublic ? PUI.pub : PUI.priv}
        </button>
        <input ref={pptxInputRef} type="file" accept=".pptx,.ppt,.pdf" className="hidden" onChange={handlePptxImport} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={handleBgImage} />
        <button
          type="button"
          onClick={() => setShowTemplates(true)}
          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 hover:bg-indigo-100"
        >
          <LayoutTemplate size={13} /> Шаблоны
        </button>
        <button
          type="button"
          onClick={() => pptxInputRef.current?.click()}
          disabled={importing}
          className="px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 hover:bg-orange-100"
        >
          {importing ? 'Импорт…' : `⬆ ${PUI.imp} PPTX/PDF`}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <Eye size={13} /> {PUI.prev}
        </button>
        <button
          type="button"
          onClick={exportSlidesPdf}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <Printer size={13} /> PDF / Печать
        </button>
        <button
          type="button"
          onClick={toggleEditFullscreen}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <Maximize2 size={13} /> {isEditFullscreen ? PUI.exit : PUI.full}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="ml-auto px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          {t('cancel')}
        </button>
      </div>

      {/* 3. ЛЕНТА ИНСТРУМЕНТОВ (RIBBON) */}
      <div className="bg-white dark:bg-slate-900 order-3 lg:order-2 border-t lg:border-t-0 border-b-0 lg:border-b dark:border-slate-800 shrink-0 relative z-20">
        <div className="flex items-center gap-1 px-2 py-1 border-b dark:border-slate-800 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['home', 'insert', 'design', 'transitions', 'animations'] as const).map(rt => (
            <button
              key={rt}
              type="button"
              onClick={() => { setRibbonTab(rt); setOpenMenu(null) }}
              className={`px-3.5 py-1.5 shrink-0 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition ${
                ribbonTab === rt
                  ? 'bg-[#b7472a] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {rt === 'home' ? PUI.home : rt === 'insert' ? PUI.insert : rt === 'design' ? PUI.design : rt === 'transitions' ? PUI.trans : PUI.anim}
            </button>
          ))}

          <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0 pr-1">
            <button type="button" onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut size={14} /></button>
            <input type="range" min={50} max={150} value={zoom} onChange={e => setZoom(parseInt(e.target.value))} className="w-20 accent-[#b7472a]" />
            <button type="button" onClick={() => setZoom(z => Math.min(150, z + 10))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn size={14} /></button>
            <button type="button" onClick={() => { setZoom(100); recalcFit() }} title="По размеру окна" className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">{zoom}%</button>
          </div>
        </div>

        <div className="px-2.5 py-2 flex flex-wrap items-center gap-2 min-h-[54px] dark:text-slate-100">
          {ribbonTab === 'home' && (
            <>
              <div className="relative flex items-center gap-0.5 pr-2.5 border-r dark:border-slate-700 shrink-0">
                <button type="button" onClick={() => addSlide('content')} className="px-2.5 h-9 rounded-l-lg bg-[#b7472a]/10 dark:bg-[#b7472a]/25 text-[#b7472a] dark:text-orange-300 border border-[#b7472a]/30 font-bold text-xs flex items-center gap-1 hover:bg-[#b7472a]/20">
                  <Plus size={14} /> Слайд
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setOpenMenu(m => m === 'layout' ? null : 'layout')}
                  title="Выбрать макет нового слайда"
                  className="px-1.5 h-9 rounded-r-lg bg-[#b7472a]/10 dark:bg-[#b7472a]/25 text-[#b7472a] dark:text-orange-300 border border-l-0 border-[#b7472a]/30 hover:bg-[#b7472a]/20 flex items-center"
                >
                  <ChevronDown size={13} />
                </button>
                <button type="button" onClick={duplicateSlide} title="Дублировать слайд" className="ml-1 h-9 w-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0"><Copy size={14} /></button>
                {openMenu === 'layout' && <SlideLayoutPopover onSelect={addSlide} onClose={() => setOpenMenu(null)} />}
              </div>

              <div className="flex items-center gap-1 pr-2.5 border-r dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBlock && curSelected?.type === 'text') setEditingText(selectedBlock)
                    else if (selectedBlock && curSelected?.type === 'shape') setEditingShape(selectedBlock)
                  }}
                  disabled={!selectedBlock || (curSelected?.type !== 'text' && curSelected?.type !== 'shape')}
                  title="Редактировать текст"
                  className={`h-9 w-9 rounded-lg border dark:border-slate-700 flex items-center justify-center disabled:opacity-35 ${editingText || editingShape ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                ><Pencil size={14} /></button>
                <select value={curSelected?.style?.fontFamily || runStyleOf(curSelected).fontFamily || 'Inter'} onChange={e => selectedBlock && updateSelectedStyle({ fontFamily: e.target.value })} className="px-2 h-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-xs w-[108px] shrink-0">
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={curSelected?.style?.fontSize || runStyleOf(curSelected).fontSize || 18} onChange={e => selectedBlock && updateSelectedStyle({ fontSize: parseInt(e.target.value) })} className="px-1.5 h-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-xs shrink-0">
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 64, 72].map(s => <option key={s} value={s}>{s}pt</option>)}
                </select>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ bold: !curSelected?.style?.bold })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.bold ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Bold size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ italic: !curSelected?.style?.italic })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.italic ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Italic size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ underline: !curSelected?.style?.underline })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.underline ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Underline size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ highlight: !curSelected?.style?.highlight })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.highlight ? 'bg-amber-400 text-slate-950' : 'hover:bg-amber-100 dark:hover:bg-slate-800'}`}><Highlighter size={15} /></button>
                <input type="color" value={curSelected?.style?.color || '#1e293b'} onChange={e => selectedBlock && updateSelectedStyle({ color: e.target.value })} className="w-8 h-9 rounded-lg border dark:border-slate-700 shrink-0 cursor-pointer bg-transparent" title="Цвет текста" />
              </div>

              <div className="flex items-center gap-1 pr-2.5 border-r dark:border-slate-700 shrink-0">
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ align: 'left' })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.align === 'left' ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><AlignLeft size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ align: 'center' })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.align === 'center' ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><AlignCenter size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ align: 'right' })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.align === 'right' ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><AlignRight size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ bullet: !curSelected?.style?.bullet, numbered: false })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.bullet ? 'bg-indigo-200 dark:bg-indigo-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><List size={15} /></button>
                <button type="button" onClick={() => selectedBlock && updateSelectedStyle({ numbered: !curSelected?.style?.numbered, bullet: false })} className={`h-9 w-9 rounded-lg flex items-center justify-center ${curSelected?.style?.numbered ? 'bg-indigo-200 dark:bg-indigo-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><ListOrdered size={15} /></button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => addBlock('text')} title="Добавить текст" className="px-2.5 h-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><Type size={13} /> Текст</button>
                <button type="button" onClick={() => { setRibbonTab('insert'); setOpenMenu('shapes') }} title="Вставить фигуру" className="px-2.5 h-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><Shapes size={13} /> Фигуры</button>
                <button type="button" onClick={duplicateBlock} disabled={!selectedBlock} title="Дублировать (Ctrl+D)" className="h-9 w-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center disabled:opacity-35"><Copy size={14} /></button>
                <button type="button" onClick={bringForward} disabled={!selectedBlock} title="На передний план" className="h-9 w-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center disabled:opacity-35"><BringToFront size={14} /></button>
                <button type="button" onClick={sendBackward} disabled={!selectedBlock} title="На задний план" className="h-9 w-9 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center disabled:opacity-35"><SendToBack size={14} /></button>
              </div>
            </>
          )}

          {ribbonTab === 'insert' && (
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex">
                <button type="button" onClick={() => addBlock('text')} className="px-3 h-9 rounded-l-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white font-bold flex items-center gap-1.5 text-xs">
                  <Type size={14} /> Текст
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setOpenMenu(m => m === 'text' ? null : 'text')}
                  className="px-1.5 h-9 rounded-r-lg bg-[#9c3a20] hover:bg-[#822f19] text-white border-l border-white/20 flex items-center"
                  title="Стили текстовых блоков"
                >
                  <ChevronDown size={13} />
                </button>
                {openMenu === 'text' && (
                  <TextPresetPopover
                    onSelect={(p: typeof TEXT_PRESETS[number]) => addBlock('text', { content: p.content, style: p.style })}
                    onClose={() => setOpenMenu(null)}
                  />
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setOpenMenu(m => m === 'shapes' ? null : 'shapes')}
                  className={`px-3 h-9 rounded-lg border font-bold flex items-center gap-1.5 text-xs transition ${
                    openMenu === 'shapes'
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Shapes size={14} /> Фигуры <ChevronDown size={13} />
                </button>
                {openMenu === 'shapes' && (
                  <ShapePickerPopover
                    onSelect={sh => addBlock('shape', { shape: sh })}
                    onClose={() => setOpenMenu(null)}
                  />
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setOpenMenu(m => m === 'table' ? null : 'table')}
                  className={`px-3 h-9 rounded-lg border font-bold flex items-center gap-1.5 text-xs transition ${
                    openMenu === 'table'
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Table size={14} /> Таблица <ChevronDown size={13} />
                </button>
                {openMenu === 'table' && (
                  <TableSizePickerPopover
                    onSelect={(rows, cols, theme) => addBlock('table', { rows, cols, theme })}
                    onClose={() => setOpenMenu(null)}
                  />
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setOpenMenu(m => m === 'chart' ? null : 'chart')}
                  className={`px-3 h-9 rounded-lg border font-bold flex items-center gap-1.5 text-xs transition ${
                    openMenu === 'chart'
                      ? 'bg-[#b7472a] text-white border-[#b7472a]'
                      : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <BarChart3 size={14} /> Диаграмма <ChevronDown size={13} />
                </button>
                {openMenu === 'chart' && (
                  <ChartPickerPopover
                    onSelect={kind => addBlock('chart', { chartType: kind })}
                    onClose={() => setOpenMenu(null)}
                  />
                )}
              </div>

              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 h-9 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold flex items-center gap-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                <ImgIcon size={14} /> Картинка
              </button>

              <button type="button" onClick={addVideo} className="px-3 h-9 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold flex items-center gap-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                <Video size={14} /> Видео
              </button>

              <button
                type="button"
                onClick={() => addBlock('shape', { shape: 'callout' })}
                className="px-3 h-9 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold flex items-center gap-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <MessageSquare size={14} /> Выноска
              </button>
            </div>
          )}

          {ribbonTab === 'design' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="px-3 h-9 rounded-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <LayoutTemplate size={14} /> Готовые шаблоны
              </button>
              <div className="w-px h-6 bg-slate-300 dark:bg-slate-700" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Темы:</span>
              {PPT_THEMES.map(th => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => applyTheme(th, false)}
                  onDoubleClick={() => applyTheme(th, true)}
                  title={`Тема «${th.name}» (клик — на слайд, двойной клик — на все слайды)`}
                  className="px-2.5 h-9 rounded-lg border-2 border-white/60 dark:border-slate-600 shadow-xs text-[11px] font-extrabold transition hover:scale-105"
                  style={{ background: th.grad || th.bg, color: th.titleColor }}
                >
                  {th.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const matched = PPT_THEMES.find(th => th.bg === cur.background || (th.grad && th.grad === cur.gradient))
                  if (matched) applyTheme(matched, true)
                  else {
                    pushHistory()
                    setSlides(sl => sl.map(s => ({ ...s, background: cur.background, backgroundType: cur.backgroundType, gradient: cur.gradient, bgImage: cur.bgImage })))
                    toast('Фон применён ко всем слайдам', 'success')
                  }
                }}
                className="px-2.5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1"
              >
                <CheckCircle2 size={13} /> Ко всем слайдам
              </button>
              <div className="w-px h-6 bg-slate-300 dark:bg-slate-700" />
              <button type="button" onClick={() => bgImageRef.current?.click()} className="px-2.5 h-9 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 text-xs font-bold flex items-center gap-1">
                <ImgIcon size={13} /> Фон-фото
              </button>
              <input type="color" value={cur.background?.startsWith('#') ? cur.background : '#ffffff'} onChange={e => updateSlide({ background: e.target.value, backgroundType: 'solid', gradient: undefined })} className="w-9 h-9 rounded-lg border dark:border-slate-700 cursor-pointer" title="Цвет фона" />
            </div>
          )}

          {ribbonTab === 'transitions' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Переход:</span>
              {TRANSITIONS.map(tr => (
                <button key={tr} type="button" onClick={() => updateSlide({ transition: tr })} className={`px-3 h-9 rounded-lg border text-xs font-bold capitalize ${cur.transition === tr ? 'bg-[#b7472a] text-white border-[#b7472a]' : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{tr}</button>
              ))}
              <button type="button" onClick={() => applyTransitionAll(cur.transition || 'fade')} className="ml-2 px-3 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> Ко всем слайдам
              </button>
            </div>
          )}

          {ribbonTab === 'animations' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Sparkles size={13} /> Анимация блока:</span>
              {ANIMATIONS.map(a => (
                <button key={a} type="button" onClick={() => selectedBlock ? updateSelected({ animation: a }) : toast('Сначала выдели блок на слайде', 'info')} className={`px-3 h-9 rounded-lg border text-xs font-bold capitalize ${curSelected?.animation === a ? 'bg-[#b7472a] text-white border-[#b7472a]' : 'bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{a}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. РАБОЧАЯ ОБЛАСТЬ */}
      <div className="flex-1 order-2 lg:order-3 flex flex-col-reverse lg:flex-row min-h-0 bg-slate-200 dark:bg-slate-950">
        {/* Левая панель слайдов */}
        <div className="lg:w-[220px] bg-slate-50 dark:bg-slate-900 border-r dark:border-slate-800 border-t lg:border-t-0 p-2 flex flex-col gap-2 overflow-auto max-h-[168px] lg:max-h-none shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold tracking-widest text-slate-500 dark:text-slate-400">СЛАЙДЫ ({slides.length})</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSlide(-1)} disabled={active === 0} title="Выше" className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 dark:text-slate-200 disabled:opacity-35"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => moveSlide(1)} disabled={active >= slides.length - 1} title="Ниже" className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 dark:text-slate-200 disabled:opacity-35"><ArrowDown size={12} /></button>
              <button type="button" onClick={() => addSlide('content')} className="p-1 rounded bg-[#b7472a] text-white" title="Новый слайд"><Plus size={13} /></button>
            </div>
          </div>

          <div ref={slideListRef} className="flex gap-2 overflow-x-auto lg:grid lg:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slides.map((s, i) => (
              <SlideThumbItem
                key={i}
                slide={s}
                index={i}
                isActive={i === active}
                canDelete={slides.length > 1}
                onSelect={selectSlide}
                onDelete={deleteSlideAt}
              />
            ))}
          </div>

          <div className="relative flex gap-1 mt-auto pt-1">
            <button onClick={() => addSlide('content')} className="flex-1 py-2 rounded-l-xl bg-[#b7472a] hover:bg-[#9c3a20] text-white font-bold flex items-center justify-center gap-1 text-xs">
              <Plus size={14} /> Новый слайд
            </button>
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setOpenMenu(m => m === 'layout' ? null : 'layout')}
              className="px-2 py-2 rounded-r-xl bg-[#9c3a20] hover:bg-[#822f19] text-white border-l border-white/20 flex items-center"
              title="Выбрать макет слайда"
            >
              <ChevronDown size={13} />
            </button>
            <button onClick={duplicateSlide} title="Дублировать слайд" className="px-2.5 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"><Copy size={14} /></button>
            <button onClick={deleteSlide} disabled={slides.length <= 1} title="Удалить слайд" className="px-2.5 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 disabled:opacity-40"><Trash2 size={14} /></button>
          </div>
        </div>

        {/* Центральный холст */}
        <div
          ref={stageRef}
          className="flex-1 p-2 sm:p-4 lg:p-6 flex flex-col items-center overflow-auto bg-slate-200 dark:bg-slate-950"
          onMouseDown={() => { setSelectedBlock(null); setActiveCell(null); setEditingText(null); setEditingShape(null) }}
        >
          <div className="hidden sm:flex items-center gap-2 mb-3 text-xs text-slate-600 dark:text-slate-300" onMouseDown={e => e.stopPropagation()}>
            <Layers size={14} /> Слайд {active + 1} из {slides.length} · {cur.layout || 'slide'} · {cur.transition || 'нет'}
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700"><ZoomOut size={12} /></button>
            <button onClick={() => { setZoom(100); recalcFit() }} className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 font-mono font-bold" title="Сбросить масштаб 100%">{zoom}%</button>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700"><ZoomIn size={12} /></button>
            <button onClick={() => setShowGrid(v => !v)} className={`ml-1 px-2 py-1 rounded border text-xs font-semibold ${showGrid ? 'bg-[#b7472a] text-white border-[#b7472a]' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
              ⊞ Сетка {showGrid ? 'вкл' : 'выкл'}
            </button>
          </div>

          {isAbsolute ? (
            <div
              ref={canvasWrapRef}
              className="w-full max-w-[960px] shrink-0 flex justify-center"
              style={{ height: Math.round(baseSlideH * canvasScale) + 28 }}
            >
              <div
                style={{
                  width: Math.round(baseSlideW * canvasScale),
                  height: Math.round(baseSlideH * canvasScale),
                  position: 'relative',
                }}
              >
                <div
                  className="rounded-lg shadow-2xl border border-slate-300/80 dark:border-slate-700 relative flex flex-col pe-canvas"
                  style={{
                    ...getSlideBgStyle(cur),
                    width: baseSlideW,
                    height: baseSlideH,
                    transform: `scale(${canvasScale})`,
                    transformOrigin: 'top left',
                    ['--pe-inv' as any]: 1 / canvasScale,
                  }}
                >
                  <div ref={canvasRef} className="flex-1 relative">
                    {showGrid && (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-[0.18]"
                        style={{ backgroundImage: 'radial-gradient(circle, #64748b 1.2px, transparent 1.2px)', backgroundSize: '24px 24px' }}
                      />
                    )}

                    {guides.v != null && (
                      <div className="absolute top-0 bottom-0 pointer-events-none z-40 border-l-2 border-dashed border-[#d24726]" style={{ left: `${guides.v}%` }} />
                    )}
                    {guides.h != null && (
                      <div className="absolute left-0 right-0 pointer-events-none z-40 border-t-2 border-dashed border-[#d24726]" style={{ top: `${guides.h}%` }} />
                    )}

                    {(() => {
                      const hasShape = cur.content.blocks.some((x: any) => x.type === 'shape')
                      const isCardBg = (cur.background || '').toUpperCase() === '#F8F9FA'
                      return cur.content.blocks.map((b: any) => {
                        const s = b.style || {}
                        const lt = liveTransform?.id === b.id ? liveTransform : null
                        const bx = lt ? lt.x : s.x
                        const by = lt ? lt.y : s.y
                        const bw = lt ? lt.w : s.w
                        const bh = lt ? lt.h : s.h
                        const brot = lt ? lt.rotation : (s.rotation || 0)
                        const isSelected = selectedBlock === b.id
                        const needCard = !hasShape && isCardBg && !s.background && (s.fontSize || 16) < 24 && (cur.content.blocks.length || 0) > 12 && (s.w || 0) < 60
                        const common: React.CSSProperties = {
                          position: 'absolute',
                          left: bx != null ? `${bx}%` : '0%',
                          top: by != null ? `${by}%` : '0%',
                          width: bw != null ? `${bw}%` : '90%',
                          height: bh != null ? `${bh}%` : 'auto',
                          transform: brot ? `rotate(${brot}deg)` : undefined,
                          zIndex: isSelected ? Math.max(s.z || 1, 20) : (s.z || 0),
                          opacity: s.opacity ?? 1,
                          overflow: 'visible',
                          touchAction: 'none',
                          willChange: lt ? 'left, top, width, height, transform' : undefined,
                        }
                        const openBlockMenu = (e: React.MouseEvent) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedBlock(b.id)
                          const mx = Math.min(e.clientX, window.innerWidth - 220)
                          const my = Math.min(e.clientY, window.innerHeight - 320)
                          setCtxMenu({ x: Math.max(8, mx), y: Math.max(8, my), blockId: b.id })
                        }
                        const animCls = getAnimationClass(b.animation || 'нет')
                        const selCls = isSelected
                          ? 'ring-2 ring-[#d24726] ring-offset-1 ring-offset-transparent'
                          : 'hover:ring-1 hover:ring-blue-400/70'

                        if (b.type === 'text') {
                          const edParas = (b.paragraphs && b.paragraphs.length) || 1
                          const isEdit = editingText === b.id
                          return (
                            <FitBox
                              key={b.id}
                              onMouseDown={(e: any) => e.stopPropagation()}
                              onPointerDown={(e: any) => { e.stopPropagation(); if (isEdit) return; handleDragStart(e, b.id) }}
                              onContextMenu={openBlockMenu}
                              boxStyle={{
                                ...common,
                                height: bh != null ? `${bh}%` : 'auto',
                                display: 'block',
                                padding: needCard ? '8px 10px' : s.background ? '6px 8px' : '2px 7px',
                                background: needCard ? '#ffffff' : s.background && !['#FFE66D', '#FF8C69', '#FFE600'].includes(s.background) ? s.background : 'transparent',
                                borderRadius: needCard ? '8px' : s.borderRadius ? `${s.borderRadius}px` : (s.background ? '6px' : 0),
                                boxShadow: needCard ? '0 2px 10px rgba(0,0,0,0.06)' : s.shadow ? '0 6px 18px rgba(15,23,42,0.12)' : undefined,
                                border: needCard ? '1px solid #f1f5f9' : (s.stroke ? `${s.strokeWidth || 1}px ${s.dash || 'solid'} ${s.stroke}` : undefined),
                                cursor: s.locked ? 'default' : 'move',
                              }}
                              innerStyle={anchoredInner(s)}
                              hasH={bh != null}
                              paras={edParas}
                              fit={false}
                              className={`group rounded-md ${selCls} ${animCls}`}
                              overlay={renderBlockOverlay(b, isSelected)}
                            >
                              {isEdit ? (
                                <div
                                  key={'e' + b.id}
                                  contentEditable
                                  suppressContentEditableWarning
                                  data-editing="1"
                                  data-orig={blockOrigText(b)}
                                  style={editInline(b, s) as any}
                                  onBlur={e => { try { commitText(b.id, (e.target as HTMLElement).innerText) } finally { setEditingText(null) } }}
                                  onKeyDown={e => { if (e.key === 'Escape') { (e.target as HTMLElement).blur() } }}
                                  onDoubleClick={e => e.stopPropagation()}
                                  onMouseDown={e => e.stopPropagation()}
                                  onPointerDown={e => e.stopPropagation()}
                                  className="w-full bg-transparent focus:outline-none min-h-[1em] whitespace-pre-wrap outline-none cursor-text"
                                />
                              ) : (
                                <div
                                  key={'v' + b.id}
                                  onDoubleClick={(e: any) => { e.stopPropagation(); setEditingText(b.id); setSelectedBlock(b.id) }}
                                  className="w-full cursor-move"
                                >
                                  {b.paragraphs ? b.paragraphs.map((p: any, pi: number) => (
                                    <div key={pi} style={{ textAlign: p.align || s.align || 'left', marginBottom: '0.2em', paddingLeft: p.level ? '1em' : 0, position: 'relative', fontSize: s.fontSize || 16, fontFamily: fontStack(s.fontFamily), lineHeight: p.lineHeight || textLineHeight(s), color: s.color || '#1e293b' }}>
                                      {(p.level || s.bullet) && <span style={{ position: 'absolute', left: 0, color: '#e11d48' }}>•</span>}
                                      {p.runs ? p.runs.map((r: any, ri: number) => (
                                        <span key={ri} style={{ fontSize: r.style?.fontSize, fontFamily: fontStack(r.style?.fontFamily), fontWeight: r.style?.bold ? 700 : undefined, fontStyle: r.style?.italic ? 'italic' : undefined, textDecoration: r.style?.underline ? 'underline' : undefined, color: r.style?.color, background: r.style?.highlight ? '#fef08a' : undefined }}>{r.text}</span>
                                      )) : p.text}
                                    </div>
                                  )) : (
                                    <div style={{ fontSize: s.fontSize || 18, fontFamily: fontStack(s.fontFamily), lineHeight: textLineHeight(s), fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? 'italic' : 'normal', textDecoration: s.underline ? 'underline' : 'none', color: s.color || '#1e293b', textAlign: s.align || 'left', whiteSpace: 'pre-wrap' }}>
                                      {s.bullet
                                        ? String(b.content || '').split('\n').map((ln, idx) => <div key={idx}>• {ln}</div>)
                                        : s.numbered
                                          ? String(b.content || '').split('\n').map((ln, idx) => <div key={idx}>{idx + 1}. {ln}</div>)
                                          : b.content}
                                    </div>
                                  )}
                                </div>
                              )}
                            </FitBox>
                          )
                        }

                        if (b.type === 'image') {
                          return (
                            <div
                              key={b.id}
                              onMouseDown={e => e.stopPropagation()}
                              onPointerDown={e => { e.stopPropagation(); handleDragStart(e, b.id) }}
                              onContextMenu={openBlockMenu}
                              style={{ ...common, cursor: s.locked ? 'default' : 'move' }}
                              className={`group rounded-lg ${selCls} ${animCls}`}
                            >
                              <div className="w-full h-full overflow-hidden" style={{ borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined, boxShadow: s.shadow ? '0 8px 24px rgba(15,23,42,0.18)' : undefined }}>
                                {b.unrenderable ? (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-100 border border-dashed border-slate-300 text-slate-500 text-xs p-2 text-center">Картинка недоступна</div>
                                ) : (
                                  <img onError={imgMissing} src={resolveSrc(b.src)} style={{ width: '100%', height: '100%', objectFit: s.objectFit || 'contain', pointerEvents: 'none' }} alt="" />
                                )}
                              </div>
                              {renderBlockOverlay(b, isSelected)}
                            </div>
                          )
                        }

                        if (b.type === 'shape') {
                          const isEditingThisShape = editingShape === b.id
                          return (
                            <div
                              key={b.id}
                              onMouseDown={e => e.stopPropagation()}
                              onPointerDown={e => { e.stopPropagation(); if (isEditingThisShape) return; handleDragStart(e, b.id) }}
                              onContextMenu={openBlockMenu}
                              style={{ ...common, cursor: s.locked ? 'default' : 'move' }}
                              className={`group ${selCls} ${animCls}`}
                            >
                              <SlideShape
                                block={b}
                                gid={`ed-sh-${b.id}`}
                                editable
                                editing={isEditingThisShape}
                                onStartEdit={() => { setSelectedBlock(b.id); setEditingShape(b.id) }}
                                onStopEdit={() => setEditingShape(null)}
                                onCommitText={val => { pushHistory(); updateSelected({ content: val }) }}
                              />
                              {renderBlockOverlay(b, isSelected)}
                            </div>
                          )
                        }

                        if (b.type === 'table') {
                          return (
                            <div
                              key={b.id}
                              onMouseDown={e => e.stopPropagation()}
                              onPointerDown={e => {
                                e.stopPropagation()
                                if (!isSelected) { handleDragStart(e, b.id); setActiveCell({ r: 0, c: 0 }) }
                              }}
                              onContextMenu={openBlockMenu}
                              style={{ ...common, cursor: isSelected ? 'default' : 'move' }}
                              className={`group rounded-lg ${selCls} ${animCls}`}
                            >
                              <SlideTable
                                block={b}
                                editable
                                selected={isSelected}
                                activeCell={isSelected ? activeCell : null}
                                onSelectCell={(r, c) => { setSelectedBlock(b.id); setActiveCell({ r, c }) }}
                                onUpdateCell={(r, c, txt) => updateTableCell(b.id, r, c, txt)}
                                onResizeColumns={widths => updateTableColWidths(b.id, widths)}
                              />
                              {renderBlockOverlay(b, isSelected)}
                            </div>
                          )
                        }

                        if (b.type === 'chart') {
                          return (
                            <div
                              key={b.id}
                              onMouseDown={e => e.stopPropagation()}
                              onPointerDown={e => { e.stopPropagation(); handleDragStart(e, b.id) }}
                              onDoubleClick={e => { e.stopPropagation(); setSelectedBlock(b.id); setChartModalBlockId(b.id) }}
                              onContextMenu={openBlockMenu}
                              title="Двойной клик — изменить данные диаграммы"
                              style={{ ...common, cursor: s.locked ? 'default' : 'move' }}
                              className={`group rounded-xl ${selCls} ${animCls}`}
                            >
                              <SlideChart block={b} gid={`ed-ch-${b.id}`} />
                              {renderBlockOverlay(b, isSelected)}
                            </div>
                          )
                        }

                        if (b.type === 'video') {
                          return (
                            <div
                              key={b.id}
                              onMouseDown={e => e.stopPropagation()}
                              onPointerDown={e => { e.stopPropagation(); handleDragStart(e, b.id) }}
                              onContextMenu={openBlockMenu}
                              style={{ ...common, cursor: 'move' }}
                              className={`group rounded-lg ${selCls} bg-black`}
                            >
                              <iframe src={videoEmbedUrl(b.content || '')} title="video" className="w-full h-full pointer-events-none rounded-lg" allowFullScreen sandbox="allow-scripts allow-presentation allow-popups" />
                              {renderBlockOverlay(b, isSelected)}
                            </div>
                          )
                        }

                        return (
                          <div
                            key={b.id}
                            onMouseDown={e => e.stopPropagation()}
                            onPointerDown={e => { e.stopPropagation(); handleDragStart(e, b.id) }}
                            onContextMenu={openBlockMenu}
                            style={{ ...common, cursor: 'move', fontSize: s.fontSize || 36, textAlign: 'center' }}
                            className={`group ${selCls}`}
                          >
                            {b.content || ''}
                            {renderBlockOverlay(b, isSelected)}
                          </div>
                        )
                      })
                    })()}

                    {cur.content.blocks.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 border-2 border-dashed m-4 rounded-xl pointer-events-none">
                        Пустой слайд — добавьте текст, фигуру, таблицу или диаграмму из вкладки «Вставка»
                      </div>
                    )}
                  </div>

                  <div
                    className="h-7 bg-slate-50 border-t hidden sm:flex items-center justify-between px-3 text-[11px] text-slate-500 shrink-0 rounded-b-lg"
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <span className="flex items-center gap-2">
                      <FileImage size={12} /> Заметки:
                      <input
                        value={cur.notes || ''}
                        onChange={e => updateSlide({ notes: e.target.value })}
                        placeholder="Подсказки докладчику…"
                        className="bg-transparent border-none focus:outline-none w-44 md:w-[320px] max-w-full"
                      />
                    </span>
                    <span className="flex items-center gap-1">
                      <Palette size={12} /> Фон:
                      <input
                        type="color"
                        value={cur.background?.startsWith('#') ? cur.background : '#ffffff'}
                        onChange={e => updateSlide({ background: e.target.value, backgroundType: 'solid', gradient: undefined })}
                        className="w-5 h-5 rounded border ml-1 align-middle cursor-pointer"
                      />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[960px] aspect-video shrink-0 bg-white rounded-lg shadow-xl border flex flex-col overflow-hidden p-8 gap-3" style={getSlideBgStyle(cur)} onMouseDown={e => e.stopPropagation()}>
              {cur.content.blocks.map((b: any) => (
                <div key={b.id} onClick={() => setSelectedBlock(b.id)} className={`p-2 rounded-lg border-2 cursor-pointer ${selectedBlock === b.id ? 'border-[#d24726]' : 'border-transparent hover:border-slate-200'}`}>
                  {b.type === 'text' && <div style={{ fontSize: b.style?.fontSize || 20, color: b.style?.color || '#1e293b' }}>{b.content}</div>}
                  {b.type === 'image' && <img onError={imgMissing} src={resolveSrc(b.src)} className="rounded-lg max-h-[260px] w-full object-contain" alt="" />}
                  {b.type === 'shape' && <div className="h-24"><SlideShape block={b} gid={`leg-sh-${b.id}`} /></div>}
                  {b.type === 'table' && <div className="h-44"><SlideTable block={b} editable selected={selectedBlock === b.id} onUpdateCell={(r, c, txt) => updateTableCell(b.id, r, c, txt)} /></div>}
                  {b.type === 'chart' && <div className="h-52"><SlideChart block={b} gid={`leg-ch-${b.id}`} /></div>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 w-full max-w-[960px] flex items-center justify-between gap-2" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <button onClick={() => selectSlide(Math.max(0, active - 1))} disabled={active === 0} className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700 text-sm font-semibold disabled:opacity-40">‹ Назад</button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 px-1.5 font-mono">{active + 1}/{slides.length}</span>
              <button onClick={() => selectSlide(Math.min(slides.length - 1, active + 1))} disabled={active === slides.length - 1} className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700 text-sm font-semibold disabled:opacity-40">Вперед ›</button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setSlideshow(true)} className="px-3.5 py-2 rounded-lg bg-[#b7472a] hover:bg-[#9c3a20] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Play size={14} className="fill-white" /> Слайд-шоу
              </button>
              <button onClick={() => setPropsOpen(true)} className="xl:hidden px-3 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1" data-testid="pe-props-open">
                <Wand2 size={14} /> Свойства
              </button>
            </div>
          </div>
        </div>

        <div className="w-[300px] bg-white dark:bg-slate-900 border-l dark:border-slate-800 hidden xl:flex flex-col shrink-0">
          {propsPanelNode}
        </div>
      </div>

      {propsOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" data-testid="pe-props-sheet">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPropsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl animate-enterUp flex flex-col max-h-[70dvh]">
            <div className="p-3 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
              <span className="font-bold text-sm dark:text-white flex items-center gap-1.5"><Wand2 size={14} /> Свойства</span>
              <button onClick={() => setPropsOpen(false)} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 flex flex-col dark:text-white">
              {propsPanelNode}
            </div>
          </div>
        </div>
      )}

      {/* ОВЕРЛЕЙ: ПРЕДПРОСМОТР (НЕ РАЗМОНТИРУЕТ ХОЛСТ!) */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
          <div className="h-12 bg-slate-800 flex items-center justify-between px-4 text-white shrink-0">
            <span className="font-bold text-sm">{title} — предпросмотр · {slides.length} слайдов</span>
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <div className="flex rounded-lg overflow-hidden text-xs">
                  <button onClick={() => setPvMode('orig')} className={`px-3 py-1.5 ${pvMode === 'orig' ? 'bg-white text-slate-900 font-bold' : 'bg-slate-700 text-slate-200'}`}>Оригинал</button>
                  <button onClick={() => setPvMode('blocks')} className={`px-3 py-1.5 ${pvMode === 'blocks' ? 'bg-white text-slate-900 font-bold' : 'bg-slate-700 text-slate-200'}`}>Конструктор</button>
                </div>
              )}
              <button onClick={() => setShowPreview(false)} className="px-4 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold">✕ Закрыть</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 sm:p-8 bg-slate-800 flex flex-col items-center gap-6">
            {slides.map((s, i) => {
              if (pvMode === 'orig' && pdfUrl) {
                return (
                  <div key={i} className="w-[900px] max-w-[92vw] aspect-video shrink-0 rounded-xl border-4 border-white shadow-2xl overflow-hidden relative flex items-center justify-center bg-black">
                    <PdfPage url={pdfUrl} page={i + 1} scale={1.5} className="w-full h-full object-contain" onError={() => setPvMode('blocks')} />
                  </div>
                )
              }
              return (
                <div
                  key={`${i}-${s.transition}`}
                  className={`w-[960px] max-w-[92vw] shrink-0 rounded-xl border-4 border-white shadow-2xl overflow-hidden relative ${getTransitionClass(s.transition || 'нет')} ${slideDotsCls(s.background)}`}
                  style={{ ...getSlideBgStyle(s), ...slideAspectStyle(s) }}
                >
                  <div className="absolute inset-0">
                    {(s.content.blocks || []).slice().sort((a: any, b: any) => (a.style?.z || 0) - (b.style?.z || 0)).map((b: any) => renderStaticBlock(b, `pv-${i}`, 1))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ОВЕРЛЕЙ: СЛАЙД-ШОУ (НЕ РАЗМОНТИРУЕТ ХОЛСТ!) */}
      {slideshow && (() => {
        const s = slides[showIdx] || slides[0]
        const pct = slides.length > 1 ? ((showIdx + 1) / slides.length) * 100 : 100
        return (
          <div className="fixed inset-0 z-50 bg-black flex flex-col select-none">
            <div
              className="flex-1 flex items-center justify-center p-4 sm:p-8 cursor-pointer overflow-hidden"
              onClick={() => { if (showIdx < slides.length - 1) setShowIdx(i => i + 1) }}
              title="Нажмите по слайду для перехода к следующему"
            >
              <div
                key={`${showIdx}-${s.transition}`}
                className={`w-[1060px] max-w-[95vw] max-h-[82vh] shrink-0 rounded-xl overflow-hidden shadow-2xl relative ${getTransitionClass(s.transition || 'нет')} ${slideDotsCls(s.background)}`}
                style={{ ...getSlideBgStyle(s), ...slideAspectStyle(s) }}
              >
                <div className="absolute inset-0">
                  {(s.content.blocks || [])
                    .slice()
                    .sort((a: any, b: any) => (a.style?.z || 0) - (b.style?.z || 0))
                    .map((b: any) => renderStaticBlock(b, `show-${showIdx}`, 1.08))}
                </div>
              </div>
            </div>

            {showSpeakerNotes && (
              <div className="mx-auto mb-2 w-[900px] max-w-[92vw] rounded-xl bg-slate-900/95 border border-white/15 px-4 py-2.5 text-slate-200 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-orange-400 font-bold mb-0.5">Заметки докладчика</div>
                <div>{s.notes?.trim() || 'Для этого слайда заметок нет.'}</div>
              </div>
            )}

            <div className="h-1 bg-white/10 w-full">
              <div className="h-full bg-[#d24726] transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>

            <div className="h-14 bg-slate-950/90 backdrop-blur border-t border-white/10 flex items-center justify-center gap-2 sm:gap-3 px-4 text-white shrink-0">
              <button onClick={() => setShowIdx(i => Math.max(0, i - 1))} disabled={showIdx === 0} className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-xs sm:text-sm font-semibold">‹ Назад</button>
              <span className="font-mono text-xs sm:text-sm font-bold px-2">{showIdx + 1} / {slides.length}</span>
              <button onClick={() => setShowIdx(i => Math.min(slides.length - 1, i + 1))} disabled={showIdx >= slides.length - 1} className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-xs sm:text-sm font-semibold">Вперед ›</button>
              <button onClick={() => setShowSpeakerNotes(v => !v)} className={`ml-2 px-3 py-2 rounded-lg text-xs font-semibold ${showSpeakerNotes ? 'bg-amber-500 text-slate-950' : 'bg-white/10 hover:bg-white/20'}`}>Заметки</button>
              <button onClick={() => setSlideshow(false)} className="ml-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs sm:text-sm font-bold">Выйти (Esc)</button>
            </div>
          </div>
        )
      })()}

      {/* МОДАЛКА: РЕДАКТОР ДАННЫХ ДИАГРАММЫ (КАК В EXCEL / POWERPOINT) */}
      {chartModalBlockId && (() => {
        const blk = cur?.content.blocks.find(b => b.id === chartModalBlockId)
        if (!blk || blk.type !== 'chart') return null
        return (
          <ChartDataModal
            block={blk}
            onChange={patch => updateBlockById(blk.id, patch)}
            onClose={() => setChartModalBlockId(null)}
          />
        )
      })()}

      {/* МОДАЛКА: ГОТОВЫЕ ШАБЛОНЫ ПРЕЗЕНТАЦИЙ */}
      {showTemplates && (
        <PresentationTemplatesModal
          onApply={(tplSlides, mode, tplName) => applyTemplate(tplSlides as Slide[], mode, tplName)}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ ПО ПРАВОЙ КНОПКЕ МЫШИ */}
      {ctxMenu && (() => {
        const blk = cur?.content.blocks.find(b => b.id === ctxMenu.blockId)
        if (!blk) return null
        const locked = !!blk.style?.locked
        const itemCls = 'w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 rounded-lg'
        return (
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            className="fixed z-50 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 space-y-0.5"
          >
            {(blk.type === 'text' || (blk.type === 'shape' && blk.shape !== 'line' && blk.shape !== 'lineArrow')) && (
              <button type="button" onClick={() => { blk.type === 'text' ? setEditingText(blk.id) : setEditingShape(blk.id); setCtxMenu(null) }} className={itemCls}>
                <Pencil size={13} /> Редактировать текст
              </button>
            )}
            {blk.type === 'chart' && (
              <button type="button" onClick={() => { setChartModalBlockId(blk.id); setCtxMenu(null) }} className={`${itemCls} text-[#b7472a] dark:text-orange-400 font-bold`}>
                <BarChart3 size={13} /> Изменить данные…
              </button>
            )}
            {blk.type === 'table' && (
              <>
                <button type="button" onClick={() => { editTableSize('addRow', blk.id); setCtxMenu(null) }} className={itemCls}><Plus size={13} /> Добавить строку</button>
                <button type="button" onClick={() => { editTableSize('addCol', blk.id); setCtxMenu(null) }} className={itemCls}><Plus size={13} /> Добавить столбец</button>
              </>
            )}
            <button type="button" onClick={() => { setClipboardBlock(JSON.parse(JSON.stringify(blk))); toast('Скопировано (Ctrl+V)', 'info'); setCtxMenu(null) }} className={itemCls}>
              <Copy size={13} /> Копировать <span className="ml-auto text-[10px] text-slate-400">Ctrl+C</span>
            </button>
            <button type="button" onClick={() => { pasteBlock(blk); setCtxMenu(null) }} className={itemCls}>
              <Copy size={13} /> Дублировать <span className="ml-auto text-[10px] text-slate-400">Ctrl+D</span>
            </button>
            <div className="my-1 border-t dark:border-slate-800" />
            <button type="button" onClick={() => { bringForward(); setCtxMenu(null) }} className={itemCls}><BringToFront size={13} /> На передний план</button>
            <button type="button" onClick={() => { sendBackward(); setCtxMenu(null) }} className={itemCls}><SendToBack size={13} /> На задний план</button>
            <button type="button" onClick={() => { centerBlock('h'); setCtxMenu(null) }} className={itemCls}><AlignHorizontalJustifyCenter size={13} /> По центру (гориз.)</button>
            <button type="button" onClick={() => { centerBlock('v'); setCtxMenu(null) }} className={itemCls}><AlignVerticalJustifyCenter size={13} /> По центру (верт.)</button>
            <button type="button" onClick={() => { updateSelectedStyle({ locked: !locked }); setCtxMenu(null) }} className={itemCls}>
              {locked ? <Unlock size={13} /> : <Lock size={13} />} {locked ? 'Разблокировать' : 'Заблокировать'}
            </button>
            <div className="my-1 border-t dark:border-slate-800" />
            <button type="button" onClick={() => { deleteBlock(blk.id); setCtxMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 rounded-lg">
              <Trash2 size={13} /> Удалить <span className="ml-auto text-[10px] opacity-60">Del</span>
            </button>
          </div>
        )
      })()}
    </div>
  )
}
