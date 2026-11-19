import { useEffect, useRef, useState } from 'react'
import { X, Download, ExternalLink, ZoomIn, ZoomOut, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  title: string
  fileName: string
  blobUrl: string
  isImage?: boolean
  onClose: () => void
}

function PdfPageCanvas({ doc, pageNum, scale }: { doc: any; pageNum: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    let cancelled = false
    let renderTask: any = null
    setRendering(true)

    doc.getPage(pageNum).then((page: any) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: scale * dpr })
      const cssViewport = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${Math.floor(cssViewport.width)}px`
      canvas.style.height = `${Math.floor(cssViewport.height)}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderTask = page.render({ canvasContext: ctx, viewport })
      renderTask.promise
        .then(() => { if (!cancelled) setRendering(false) })
        .catch(() => { if (!cancelled) setRendering(false) })
    }).catch(() => { if (!cancelled) setRendering(false) })

    return () => {
      cancelled = true
      try { renderTask?.cancel?.() } catch {}
    }
  }, [doc, pageNum, scale])

  return (
    <div className="relative bg-white rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden mx-auto w-fit max-w-full">
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
        </div>
      )}
      <canvas ref={canvasRef} className="block max-w-full h-auto" />
      <div className="text-[11px] text-slate-400 text-center py-1 bg-slate-50 border-t border-slate-100">
        {pageNum}
      </div>
    </div>
  )
}

export default function PdfModal({ title, fileName, blobUrl, isImage, onClose }: Props) {
  const [doc, setDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState(0)
  const [curPage, setCurPage] = useState(1)
  const [scale, setScale] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 0.85 : 1.25))
  const [loading, setLoading] = useState(!isImage)
  const [fallbackIframe, setFallbackIframe] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (isImage || !blobUrl) { setLoading(false); return }
    let dead = false
    setLoading(true)
    setFallbackIframe(false)
    setDoc(null)

    ;(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist')
        try {
          const w: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
          pdfjs.GlobalWorkerOptions.workerSrc = w.default || w
        } catch {}
        const res = await fetch(blobUrl)
        const buf = await res.arrayBuffer()
        const loaded = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
        if (dead) return
        setDoc(loaded)
        setNumPages(loaded.numPages || 1)
        setCurPage(1)
      } catch {
        if (!dead) setFallbackIframe(true)
      } finally {
        if (!dead) setLoading(false)
      }
    })()

    return () => { dead = true }
  }, [blobUrl, isImage])

  const downloadFile = () => {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName || (isImage ? 'image' : 'document.pdf')
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      data-testid="pf-file-modal"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка просмотрщика */}
        <div className="px-3 sm:px-4 py-3 border-b dark:border-slate-700 flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText size={18} className="text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm dark:text-white truncate">{title || fileName}</div>
              {fileName && <div className="text-[11px] text-slate-400 truncate">{fileName}</div>}
            </div>
          </div>

          {!isImage && doc && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-1.5 py-1">
              {numPages > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurPage(p => Math.max(1, p - 1))}
                    disabled={curPage <= 1}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 dark:text-white"
                    title="Предыдущая страница"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs font-semibold px-1.5 dark:text-slate-200 whitespace-nowrap">
                    {curPage} / {numPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurPage(p => Math.min(numPages, p + 1))}
                    disabled={curPage >= numPages}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 dark:text-white"
                    title="Следующая страница"
                  >
                    <ChevronRight size={15} />
                  </button>
                  <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                </>
              )}
              <button
                type="button"
                onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(2)))}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white"
                title="Уменьшить"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-mono font-bold px-1 dark:text-slate-200 min-w-[44px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale(s => Math.min(2.6, +(s + 0.2).toFixed(2)))}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white"
                title="Увеличить"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold dark:text-slate-200 flex items-center gap-1"
              title="Открыть в новой вкладке"
            >
              <ExternalLink size={14} /> <span className="hidden sm:inline">В новой вкладке</span>
            </a>
            <button
              type="button"
              onClick={downloadFile}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1"
              title="Скачать"
            >
              <Download size={14} /> <span className="hidden sm:inline">Скачать</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 dark:text-white"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Тело просмотрщика */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 bg-slate-100 dark:bg-slate-950/70">
          {isImage ? (
            <div className="flex items-center justify-center min-h-full">
              <img
                src={blobUrl}
                alt={title}
                className="max-w-full max-h-[78vh] rounded-xl shadow-lg object-contain bg-white"
              />
            </div>
          ) : loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 size={28} className="animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Загружаем PDF…</span>
            </div>
          ) : doc ? (
            <div className="space-y-4">
              {numPages <= 12 ? (
                Array.from({ length: numPages }, (_, i) => (
                  <PdfPageCanvas key={i + 1} doc={doc} pageNum={i + 1} scale={scale} />
                ))
              ) : (
                <PdfPageCanvas doc={doc} pageNum={curPage} scale={scale} />
              )}
            </div>
          ) : fallbackIframe ? (
            <iframe src={blobUrl} title={title} className="w-full h-full min-h-[70vh] rounded-xl border bg-white" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              <FileText size={36} />
              <p className="text-sm">Не удалось отобразить PDF встроенным просмотрщиком.</p>
              <button
                type="button"
                onClick={downloadFile}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
              >
                Скачать файл
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
