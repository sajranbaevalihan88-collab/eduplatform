import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import PdfModal from './PdfModal'
import { sanitizeWordHtml } from '../utils/sanitize'
import {
  FileText, Download, Maximize2, Eye, EyeOff, Loader2,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Image as ImageIcon,
  Sun, Moon, X
} from 'lucide-react'

type FileObj = {
  id: number
  title: string
  file?: string
  url?: string
  file_type?: string
  mime_type?: string
  size?: number
}

function getExt(f: FileObj): string {
  const src = f.file || f.url || f.title || ''
  const clean = src.split('?')[0].toLowerCase()
  const idx = clean.lastIndexOf('.')
  return idx >= 0 ? clean.slice(idx) : ''
}

function InlinePdfCanvas({ blobUrl, scale, pageNum, onNumPages }: { blobUrl: string; scale: number; pageNum: number; onNumPages: (n: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')
    ;(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist')
        const workerMod: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default || workerMod
        }
        const task = pdfjs.getDocument({ url: blobUrl })
        const doc = await task.promise
        if (!cancelled) {
          setPdfDoc(doc)
          onNumPages(doc.numPages || 1)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setErr('Не удалось отобразить PDF встроенно — открой во весь экран или скачай файл.')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [blobUrl, onNumPages])

  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    let renderTask: any = null
    pdfDoc.getPage(pageNum).then((page: any) => {
      if (cancelled || !canvasRef.current) return
      const canvas = canvasRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: scale * dpr })
      const cssVp = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${Math.floor(cssVp.width)}px`
      canvas.style.height = `${Math.floor(cssVp.height)}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderTask = page.render({ canvasContext: ctx, viewport })
      renderTask.promise.catch(() => {})
    }).catch(() => {})
    return () => {
      cancelled = true
      try { renderTask?.cancel?.() } catch {}
    }
  }, [pdfDoc, pageNum, scale])

  if (loading) return <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" /> Открываю PDF…</div>
  if (err) return <div className="p-4 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-xl">{err}</div>
  return (
    <div className="overflow-auto max-h-[580px] bg-slate-200/80 dark:bg-slate-950 rounded-xl p-3 flex justify-center border dark:border-slate-700">
      <canvas ref={canvasRef} className="shadow-xl rounded-lg bg-white max-w-full h-auto" />
    </div>
  )
}

const DOC_SHEET_CSS = `
.edu-doc-sheet { font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; word-break: break-word; }
.edu-doc-sheet h1 { font-family: Inter, system-ui, sans-serif; font-size: 1.45em; font-weight: 800; margin: 0.7em 0 0.4em; line-height: 1.3; }
.edu-doc-sheet h2 { font-family: Inter, system-ui, sans-serif; font-size: 1.22em; font-weight: 700; margin: 0.7em 0 0.35em; line-height: 1.35; }
.edu-doc-sheet h3 { font-family: Inter, system-ui, sans-serif; font-size: 1.08em; font-weight: 700; margin: 0.6em 0 0.3em; }
.edu-doc-sheet p { margin: 0.45em 0; }
.edu-doc-sheet ul { list-style: disc; padding-left: 1.6em; margin: 0.5em 0; }
.edu-doc-sheet li { margin: 0.25em 0; }
.edu-doc-sheet .docx-table-wrap { overflow-x: auto; margin: 0.9em 0; }
.edu-doc-sheet table, .edu-doc-sheet .docx-table { width: 100%; border-collapse: collapse; font-family: Inter, system-ui, sans-serif; font-size: 0.92em; margin: 0.6em 0; }
.edu-doc-sheet th, .edu-doc-sheet td { border: 1px solid #cbd5e1; padding: 7px 10px; vertical-align: top; text-align: left; }
.edu-doc-sheet th { background: #f1f5f9; font-weight: 700; }
.edu-doc-sheet.edu-doc-dark th, .edu-doc-sheet.edu-doc-dark td { border-color: #334155; }
.edu-doc-sheet.edu-doc-dark th { background: #1e293b; color: #f8fafc; }
.edu-doc-sheet .docx-img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.75em auto; display: block; box-shadow: 0 4px 14px rgba(0,0,0,0.12); }
.edu-doc-sheet .docx-link { color: #2563eb; text-decoration: underline; }
.edu-doc-sheet.edu-doc-dark .docx-link { color: #60a5fa; }
`

export default function InlineFileReader({ file, defaultOpen = true }: { file: FileObj; defaultOpen?: boolean }) {
  const ext = getExt(file)
  const isPdf = ext === '.pdf' || (file.mime_type || '').includes('pdf')
  const isImg = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) || (file.mime_type || '').startsWith('image/')
  const isTextDoc = ['.docx', '.txt', '.md', '.csv', '.py', '.json'].includes(ext)

  const [open, setOpen] = useState(defaultOpen)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [docText, setDocText] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [fullOpen, setFullOpen] = useState(false)
  const [docFullOpen, setDocFullOpen] = useState(false)
  const [paperDark, setPaperDark] = useState(false)
  const [docFontPx, setDocFontPx] = useState(15)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [scale, setScale] = useState(1.1)
  const loadedIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (loadedIdRef.current !== null && loadedIdRef.current !== file.id) {
      loadedIdRef.current = null
      setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
      setDocText(null)
      setDocHtml('')
      setErr('')
      setPageNum(1)
      setNumPages(1)
    }
  }, [file.id])

  useEffect(() => {
    if (!open || !(isPdf || isImg || isTextDoc)) return
    if (loadedIdRef.current === file.id) return
    let cancelled = false
    setLoading(true)
    setErr('')
    ;(async () => {
      try {
        if (isPdf || isImg) {
          const r = await client.get(`/files/${file.id}/raw/`, { responseType: 'blob' })
          if (cancelled) return
          const raw = r.data as Blob
          const b = isPdf && raw.type !== 'application/pdf' ? new Blob([raw], { type: 'application/pdf' }) : raw
          const nextUrl = URL.createObjectURL(b)
          loadedIdRef.current = file.id
          setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return nextUrl })
        } else if (isTextDoc) {
          const r = await client.get(`/files/${file.id}/preview_text/`)
          if (cancelled) return
          loadedIdRef.current = file.id
          setDocText(r.data?.text || '')
          setDocHtml(r.data?.html ? sanitizeWordHtml(r.data.html) : '')
        }
      } catch {
        if (!cancelled) setErr('Не удалось загрузить предпросмотр — попробуй скачать файл.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, file.id, isPdf, isImg, isTextDoc])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  const downloadFile = async () => {
    try {
      const r = await client.get(`/files/${file.id}/raw/?download=1`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.title.includes('.') ? file.title : `${file.title}${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {}
  }

  const sizeLabel = file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''
  const fileName = file.title.includes('.') ? file.title : `${file.title}${ext}`

  const renderDocSheet = (isModal = false) => (
    <div
      className={`rounded-xl border shadow-md overflow-y-auto ${
        isModal ? 'flex-1 p-6 sm:p-10' : 'max-h-[540px] p-5 sm:p-8'
      } ${
        paperDark
          ? 'bg-slate-900 text-slate-100 border-slate-700'
          : 'bg-white text-slate-900 border-slate-200'
      }`}
    >
      <style>{DOC_SHEET_CSS}</style>
      <div
        className={`edu-doc-sheet mx-auto max-w-[740px] ${paperDark ? 'edu-doc-dark' : ''}`}
        style={{ fontSize: `${docFontPx}px` }}
      >
        {docHtml ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeWordHtml(docHtml) }} />
        ) : (
          <div className="whitespace-pre-wrap">
            {(docText || '').trim() || 'Документ не содержит текстового содержимого — используй кнопку «Скачать».'}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/70 p-3.5 space-y-3" data-testid={`inline-file-${file.id}`}>
      {/* Заголовок и кнопки действий */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isPdf ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
              : isImg ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
          }`}>
            {isImg ? <ImageIcon size={20} /> : <FileText size={20} />}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm dark:text-white truncate">{file.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {(ext.replace('.', '').toUpperCase() || file.file_type || 'ФАЙЛ')}{sizeLabel ? ` • ${sizeLabel}` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(isPdf || isImg || isTextDoc) && (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              {open ? <><EyeOff size={14} /> Свернуть</> : <><Eye size={14} /> Читать здесь</>}
            </button>
          )}
          {((isPdf || isImg) && blobUrl) && (
            <button
              type="button"
              onClick={() => setFullOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
            >
              <Maximize2 size={13} /> Во весь экран
            </button>
          )}
          {(isTextDoc && (docHtml || docText !== null)) && (
            <button
              type="button"
              onClick={() => setDocFullOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
            >
              <Maximize2 size={13} /> Во весь экран
            </button>
          )}
          <button
            type="button"
            onClick={downloadFile}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
          >
            <Download size={13} /> Скачать
          </button>
        </div>
      </div>

      {/* Встроенное чтение файла прямо на месте */}
      {open && (
        <div className="space-y-2">
          {loading && (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Загружаю содержимое документа…
            </div>
          )}
          {err && <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-xs text-amber-700 dark:text-amber-300">{err}</div>}

          {/* PDF */}
          {!loading && isPdf && blobUrl && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pageNum <= 1}
                    onClick={() => setPageNum(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-bold dark:text-white px-1">Стр. {pageNum} / {numPages}</span>
                  <button
                    type="button"
                    disabled={pageNum >= numPages}
                    onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setScale(s => Math.max(0.6, +(s - 0.15).toFixed(2)))} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white"><ZoomOut size={14} /></button>
                  <span className="font-mono font-bold dark:text-slate-300">{Math.round(scale * 100)}%</span>
                  <button type="button" onClick={() => setScale(s => Math.min(2.2, +(s + 0.15).toFixed(2)))} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white"><ZoomIn size={14} /></button>
                </div>
              </div>
              <InlinePdfCanvas blobUrl={blobUrl} scale={scale} pageNum={pageNum} onNumPages={setNumPages} />
            </div>
          )}

          {/* Картинка */}
          {!loading && isImg && blobUrl && (
            <div className="rounded-xl overflow-hidden bg-slate-900/5 dark:bg-slate-950 border dark:border-slate-700 flex justify-center p-2">
              <img
                src={blobUrl}
                alt={file.title}
                onClick={() => setFullOpen(true)}
                className="max-h-[460px] object-contain rounded-lg cursor-zoom-in"
              />
            </div>
          )}

          {/* Word .docx / .txt / .md / .csv — оформленный лист документа */}
          {!loading && isTextDoc && (docHtml || docText !== null) && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  📄 Документ (оригинальное форматирование и таблицы)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDocFontPx(s => Math.max(12, s - 1))}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white font-bold"
                    title="Уменьшить шрифт"
                  >
                    A−
                  </button>
                  <span className="font-mono text-[11px] dark:text-slate-300">{docFontPx}px</span>
                  <button
                    type="button"
                    onClick={() => setDocFontPx(s => Math.min(22, s + 1))}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white font-bold"
                    title="Увеличить шрифт"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperDark(v => !v)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white font-semibold flex items-center gap-1"
                    title="Переключить фон листа"
                  >
                    {paperDark ? <><Sun size={12} /> Светлый лист</> : <><Moon size={12} /> Тёмный лист</>}
                  </button>
                </div>
              </div>
              {renderDocSheet(false)}
            </div>
          )}
        </div>
      )}

      {/* Полноэкранный просмотрщик PDF / картинок */}
      {fullOpen && blobUrl && (
        <PdfModal
          title={file.title}
          fileName={fileName}
          blobUrl={blobUrl}
          isImage={isImg}
          onClose={() => setFullOpen(false)}
        />
      )}

      {/* Полноэкранный просмотрщик Word / TXT */}
      {docFullOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col p-3 sm:p-6">
          <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl border border-slate-700 shrink-0">
              <span className="font-bold text-sm truncate flex items-center gap-2">
                <FileText size={16} className="text-blue-400 shrink-0" /> {file.title}
              </span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setDocFontPx(s => Math.max(12, s - 1))} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold">A−</button>
                <button type="button" onClick={() => setDocFontPx(s => Math.min(24, s + 1))} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold">A+</button>
                <button type="button" onClick={() => setPaperDark(v => !v)} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1">
                  {paperDark ? <Sun size={13} /> : <Moon size={13} />}
                </button>
                <button type="button" onClick={downloadFile} className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold flex items-center gap-1">
                  <Download size={13} /> Скачать
                </button>
                <button type="button" onClick={() => setDocFullOpen(false)} className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white">
                  <X size={16} />
                </button>
              </div>
            </div>
            {renderDocSheet(true)}
          </div>
        </div>
      )}
    </div>
  )
}
