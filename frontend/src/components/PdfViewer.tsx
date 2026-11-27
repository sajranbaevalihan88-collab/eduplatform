import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../api/client'
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize,
  Loader2, Rows3, Square, Sparkles, AlertTriangle
} from 'lucide-react'

type PageMeta = { page: number; width: number; height: number }

export type PdfViewerProps = {
  blobUrl: string
  fileId?: number
  maxHeightClass?: string
  initialMode?: 'all' | 'single'
  onEngineChange?: (engine: 'pdfjs' | 'server') => void
}

/**
 * Одна страница PDF в режиме PDF.js — рендерится лениво через IntersectionObserver,
 * с автоподгоном под ширину контейнера (ничего не обрезается и не искажается).
 */
function PdfJsLazyPage({
  doc,
  pageNum,
  scale,
  fitWidth,
  containerWidth,
  eager,
  onRenderError,
  onVisible,
  registerRef,
}: {
  doc: any
  pageNum: number
  scale: number
  fitWidth: boolean
  containerWidth: number
  eager: boolean
  onRenderError: () => void
  onVisible: (p: number) => void
  registerRef: (p: number, el: HTMLDivElement | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [inView, setInView] = useState(eager || pageNum <= 3)
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 680, h: 920 })
  const [rendered, setRendered] = useState(false)
  const [pageErr, setPageErr] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            if (entry.intersectionRatio >= 0.35) onVisible(pageNum)
          }
        }
      },
      { rootMargin: '550px 0px', threshold: [0.01, 0.35, 0.6] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [pageNum, onVisible])

  useEffect(() => {
    if (!doc || !inView) return
    let cancelled = false
    let renderTask: any = null
    setRendered(false)
    setPageErr(false)

    doc.getPage(pageNum).then((page: any) => {
      if (cancelled) return
      const baseVp = page.getViewport({ scale: 1 })
      const availW = Math.max(240, containerWidth - 28)
      const cssScale = fitWidth ? Math.max(0.35, Math.min(2.6, availW / baseVp.width)) : scale
      const cssVp = page.getViewport({ scale: cssScale })
      const cssW = Math.max(1, Math.floor(cssVp.width))
      const cssH = Math.max(1, Math.floor(cssVp.height))
      setBoxSize({ w: cssW, h: cssH })

      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const renderVp = page.getViewport({ scale: cssScale * dpr })
      canvas.width = Math.max(1, Math.floor(renderVp.width))
      canvas.height = Math.max(1, Math.floor(renderVp.height))
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      renderTask = page.render({
        canvas,
        canvasContext: ctx,
        viewport: renderVp,
        // ENABLE_FORMS (2) — отрисовывает аннотации, выделения и поля форм внутри PDF
        annotationMode: 2,
      })
      renderTask.promise
        .then(() => {
          if (!cancelled) setRendered(true)
        })
        .catch((err: any) => {
          if (cancelled || err?.name === 'RenderingCancelledException') return
          setPageErr(true)
          onRenderError()
        })
    }).catch(() => {
      if (!cancelled) {
        setPageErr(true)
        onRenderError()
      }
    })

    return () => {
      cancelled = true
      try { renderTask?.cancel?.() } catch {}
    }
  }, [doc, pageNum, scale, fitWidth, containerWidth, inView, onRenderError])

  return (
    <div
      ref={el => {
        wrapRef.current = el
        registerRef(pageNum, el)
      }}
      data-pdf-page={pageNum}
      className="mx-auto w-fit bg-white rounded-xl shadow-md border border-slate-300/80 dark:border-slate-700 overflow-hidden"
    >
      <div
        className="relative bg-white"
        style={{ width: `${boxSize.w}px`, minHeight: `${Math.min(boxSize.h, 1400)}px` }}
      >
        {!rendered && !pageErr && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 size={22} className="animate-spin text-indigo-600" />
          </div>
        )}
        {pageErr && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-xs text-amber-700 bg-amber-50">
            Не удалось отрисовать страницу {pageNum}
          </div>
        )}
        <canvas ref={canvasRef} className="block" />
      </div>
      <div className="text-[11px] font-mono text-slate-500 text-center py-1 bg-slate-50 border-t border-slate-200 select-none">
        Стр. {pageNum}
      </div>
    </div>
  )
}

/**
 * Одна страница PDF в точном серверном HD-режиме (PyMuPDF):
 * рендерит 100% шрифтов, кириллицы, формул, графики и сканов в PNG.
 */
function ServerPdfLazyPage({
  fileId,
  meta,
  scale,
  fitWidth,
  containerWidth,
  eager,
  onVisible,
  registerRef,
}: {
  fileId: number
  meta: PageMeta
  scale: number
  fitWidth: boolean
  containerWidth: number
  eager: boolean
  onVisible: (p: number) => void
  registerRef: (p: number, el: HTMLDivElement | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(eager || meta.page <= 3)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)

  const availW = Math.max(240, containerWidth - 28)
  const baseW = Math.max(100, meta.width || 595)
  const baseH = Math.max(100, meta.height || 842)
  const cssScale = fitWidth ? Math.max(0.35, Math.min(2.6, availW / baseW)) : scale
  const cssW = Math.max(1, Math.floor(baseW * cssScale))
  const cssH = Math.max(1, Math.floor(baseH * cssScale))
  const reqZoom = Math.max(1.2, Math.min(2.4, Number((cssScale * 1.6).toFixed(1))))

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            if (entry.intersectionRatio >= 0.35) onVisible(meta.page)
          }
        }
      },
      { rootMargin: '550px 0px', threshold: [0.01, 0.35, 0.6] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [meta.page, onVisible])

  const imgUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!inView) return
    let dead = false
    setLoading(true)
    setErr(false)
    client
      .get(`/files/${fileId}/pdf_page/`, {
        params: { page: meta.page, zoom: reqZoom },
        responseType: 'blob',
      })
      .then(r => {
        if (dead) return
        const nextUrl = URL.createObjectURL(r.data as Blob)
        const oldUrl = imgUrlRef.current
        imgUrlRef.current = nextUrl
        setImgUrl(nextUrl)
        if (oldUrl && oldUrl !== nextUrl) {
          setTimeout(() => URL.revokeObjectURL(oldUrl), 1500)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!dead) {
          setErr(true)
          setLoading(false)
        }
      })
    return () => {
      dead = true
    }
  }, [fileId, meta.page, reqZoom, inView])

  useEffect(() => {
    return () => {
      const u = imgUrlRef.current
      imgUrlRef.current = null
      if (u) setTimeout(() => URL.revokeObjectURL(u), 1500)
    }
  }, [])

  return (
    <div
      ref={el => {
        wrapRef.current = el
        registerRef(meta.page, el)
      }}
      data-pdf-page={meta.page}
      className="mx-auto w-fit bg-white rounded-xl shadow-md border border-slate-300/80 dark:border-slate-700 overflow-hidden"
    >
      <div className="relative bg-white" style={{ width: `${cssW}px`, minHeight: `${Math.min(cssH, 1400)}px` }}>
        {loading && !imgUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 size={22} className="animate-spin text-indigo-600" />
          </div>
        )}
        {err && (
          <div className="p-6 text-center text-xs text-amber-700 bg-amber-50">
            Не удалось загрузить страницу {meta.page}
          </div>
        )}
        {imgUrl && (
          <img
            src={imgUrl}
            alt={`Страница ${meta.page}`}
            style={{ width: `${cssW}px`, height: 'auto' }}
            className="block"
          />
        )}
      </div>
      <div className="text-[11px] font-mono text-slate-500 text-center py-1 bg-slate-50 border-t border-slate-200 select-none">
        Стр. {meta.page} • HD
      </div>
    </div>
  )
}

export default function PdfViewer({
  blobUrl,
  fileId,
  maxHeightClass = 'max-h-[720px]',
  initialMode = 'all',
  onEngineChange,
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [containerWidth, setContainerWidth] = useState(760)
  const [engine, setEngine] = useState<'pdfjs' | 'server'>('pdfjs')
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [serverPages, setServerPages] = useState<PageMeta[]>([])
  const [numPages, setNumPages] = useState(1)
  const [curPage, setCurPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [viewMode, setViewMode] = useState<'all' | 'single'>(initialMode)
  const [fitWidth, setFitWidth] = useState(true)
  const [scale, setScale] = useState(1.15)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 120) setContainerWidth(w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const switchToServer = useCallback(() => {
    if (!fileId) return
    setEngine('server')
    onEngineChange?.('server')
  }, [fileId, onEngineChange])

  // Загрузка PDF: либо через PDF.js (быстро в браузере), либо через PyMuPDF (точный серверный рендер)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')

    if (engine === 'server') {
      if (!fileId) {
        setErr('Серверный HD-режим недоступен для этого файла.')
        setLoading(false)
        return
      }
      client
        .get(`/files/${fileId}/pdf_info/`)
        .then(r => {
          if (cancelled) return
          const pages: PageMeta[] = Array.isArray(r.data?.pages) ? r.data.pages : []
          const total = Number(r.data?.num_pages || pages.length || 1)
          setServerPages(pages.length ? pages : Array.from({ length: total }, (_, i) => ({ page: i + 1, width: 595, height: 842 })))
          setNumPages(total)
          setCurPage(p => Math.min(p, total))
          setLoading(false)
        })
        .catch(() => {
          if (!cancelled) {
            setErr('Не удалось загрузить PDF — попробуй скачать файл.')
            setLoading(false)
          }
        })
      return () => { cancelled = true }
    }

    ;(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist')
        try {
          const workerMod: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
          if (pdfjs.GlobalWorkerOptions) {
            pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default || workerMod
          }
        } catch {}
        const res = await fetch(blobUrl)
        const buf = await res.arrayBuffer()
        const task = pdfjs.getDocument({
          data: new Uint8Array(buf),
          useSystemFonts: true,
          isEvalSupported: false,
          cMapPacked: true,
        })
        const doc = await task.promise
        if (cancelled) {
          try { doc?.destroy?.() } catch {}
          return
        }
        setPdfDoc(doc)
        const total = doc.numPages || 1
        setNumPages(total)
        setCurPage(1)
        setPageInput('1')
        setLoading(false)
      } catch {
        if (cancelled) return
        // Автоматический fallback на серверный PyMuPDF, если PDF.js не смог открыть файл
        if (fileId) {
          setEngine('server')
          onEngineChange?.('server')
        } else {
          setErr('Не удалось отобразить PDF встроенно — попробуй скачать файл.')
          setLoading(false)
        }
      }
    })()

    return () => { cancelled = true }
  }, [blobUrl, fileId, engine, onEngineChange])

  const registerRef = useCallback((p: number, el: HTMLDivElement | null) => {
    pageRefs.current[p] = el
  }, [])

  const onVisiblePage = useCallback((p: number) => {
    if (viewMode === 'all') {
      setCurPage(p)
      setPageInput(String(p))
    }
  }, [viewMode])

  const goToPage = useCallback((target: number) => {
    const clamped = Math.max(1, Math.min(numPages, target))
    setCurPage(clamped)
    setPageInput(String(clamped))
    if (viewMode === 'all') {
      const node = pageRefs.current[clamped]
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [numPages, viewMode])

  const zoomOut = () => {
    setFitWidth(false)
    setScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)))
  }
  const zoomIn = () => {
    setFitWidth(false)
    setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)))
  }

  return (
    <div className="space-y-2" data-testid="pdf-viewer" data-pdf-pages={numPages} data-pdf-engine={engine}>
      {/* Панель управления PDF */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
        {/* Навигация по страницам */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={curPage <= 1}
            onClick={() => goToPage(curPage - 1)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white disabled:opacity-40"
            title="Предыдущая страница"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-slate-500 dark:text-slate-400">Стр.</span>
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={e => setPageInput(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') goToPage(Number(pageInput) || 1) }}
            onBlur={() => goToPage(Number(pageInput) || curPage)}
            aria-label="Номер страницы PDF"
            className="w-11 px-1.5 py-0.5 text-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
          />
          <span className="font-semibold text-slate-700 dark:text-slate-300">/ {numPages}</span>
          <button
            type="button"
            disabled={curPage >= numPages}
            onClick={() => goToPage(curPage + 1)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white disabled:opacity-40"
            title="Следующая страница"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Режим просмотра: все страницы подряд / по одной */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
              viewMode === 'all'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Показать все страницы лентой"
          >
            <Rows3 size={12} /> Все ({numPages})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('single')}
            className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
              viewMode === 'single'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Листать по одной странице"
          >
            <Square size={12} /> По одной
          </button>
        </div>

        {/* Масштаб + HD PyMuPDF */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={zoomOut}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
            title="Уменьшить"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => setFitWidth(v => !v)}
            className={`px-2 py-1 rounded-lg font-semibold flex items-center gap-1 border transition ${
              fitWidth
                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200'
                : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-300'
            }`}
            title="Подогнать страницу точно по ширине окна"
          >
            <Maximize size={12} /> {fitWidth ? 'По ширине' : `${Math.round(scale * 100)}%`}
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
            title="Увеличить"
          >
            <ZoomIn size={14} />
          </button>
          {fileId && (
            <button
              type="button"
              onClick={() => {
                const next = engine === 'pdfjs' ? 'server' : 'pdfjs'
                setEngine(next)
                onEngineChange?.(next)
              }}
              data-testid="pdf-hd-toggle"
              className={`px-2 py-1 rounded-lg font-semibold flex items-center gap-1 border transition ${
                engine === 'server'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-transparent text-slate-700 dark:text-slate-200'
              }`}
              title="Точный серверный рендер (PyMuPDF): включи, если в PDF не отображаются редкие шрифты, формулы или графика"
            >
              <Sparkles size={12} /> {engine === 'server' ? 'HD ВКЛ' : 'HD PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Область страниц — block + mx-auto внутри overflow-auto, никогда не обрезает левый край */}
      <div
        ref={scrollRef}
        className={`overflow-auto ${maxHeightClass} bg-slate-200/80 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-700`}
      >
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
            <span>Открываю PDF…</span>
          </div>
        ) : err ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{err}</span>
          </div>
        ) : engine === 'server' && fileId ? (
          <div className="space-y-4">
            {(viewMode === 'all' ? serverPages : serverPages.filter(p => p.page === curPage)).map(meta => (
              <ServerPdfLazyPage
                key={meta.page}
                fileId={fileId}
                meta={meta}
                scale={scale}
                fitWidth={fitWidth}
                containerWidth={containerWidth}
                eager={viewMode === 'single'}
                onVisible={onVisiblePage}
                registerRef={registerRef}
              />
            ))}
          </div>
        ) : pdfDoc ? (
          <div className="space-y-4">
            {(viewMode === 'all' ? Array.from({ length: numPages }, (_, i) => i + 1) : [curPage]).map(p => (
              <PdfJsLazyPage
                key={p}
                doc={pdfDoc}
                pageNum={p}
                scale={scale}
                fitWidth={fitWidth}
                containerWidth={containerWidth}
                eager={viewMode === 'single'}
                onRenderError={switchToServer}
                onVisible={onVisiblePage}
                registerRef={registerRef}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
