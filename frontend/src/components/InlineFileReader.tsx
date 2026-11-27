import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import PdfModal from './PdfModal'
import PdfViewer from './PdfViewer'
import { sanitizeWordHtml } from '../utils/sanitize'
import {
  FileText, Download, Maximize2, Eye, EyeOff, Loader2,
  Image as ImageIcon, FileSpreadsheet, Presentation,
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

type ExcelSheet = {
  name: string
  html: string
  rows_count: number
  cols_count: number
  truncated?: boolean
}

function getExt(f: FileObj): string {
  const src = f.file || f.url || f.title || ''
  const clean = src.split('?')[0].toLowerCase()
  const idx = clean.lastIndexOf('.')
  return idx >= 0 ? clean.slice(idx) : ''
}

const DOC_SHEET_CSS = `
.edu-doc-sheet { font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; word-break: break-word; }
.edu-doc-sheet h1 { font-family: Inter, system-ui, sans-serif; font-size: 1.45em; font-weight: 800; margin: 0.7em 0 0.4em; line-height: 1.3; }
.edu-doc-sheet h2 { font-family: Inter, system-ui, sans-serif; font-size: 1.22em; font-weight: 700; margin: 0.7em 0 0.35em; line-height: 1.35; }
.edu-doc-sheet h3 { font-family: Inter, system-ui, sans-serif; font-size: 1.08em; font-weight: 700; margin: 0.6em 0 0.3em; }
.edu-doc-sheet p { margin: 0.45em 0; }
.edu-doc-sheet ul { list-style: disc; padding-left: 1.6em; margin: 0.5em 0; }
.edu-doc-sheet li { margin: 0.25em 0; }
.edu-doc-sheet .docx-table-wrap { overflow-x: auto; margin: 0.9em 0; border-radius: 10px; }
.edu-doc-sheet table, .edu-doc-sheet .docx-table { width: 100%; border-collapse: collapse; font-family: Inter, system-ui, sans-serif; font-size: 0.9em; margin: 0.4em 0; }
.edu-doc-sheet th, .edu-doc-sheet td { border: 1px solid #cbd5e1; padding: 7px 10px; vertical-align: top; text-align: left; }
.edu-doc-sheet th { background: #f1f5f9; font-weight: 700; }
.edu-doc-sheet.edu-doc-dark th, .edu-doc-sheet.edu-doc-dark td { border-color: #334155; }
.edu-doc-sheet.edu-doc-dark th { background: #1e293b; color: #f8fafc; }
.edu-doc-sheet .docx-img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.75em auto; display: block; box-shadow: 0 4px 14px rgba(0,0,0,0.12); }
.edu-doc-sheet .docx-link { color: #2563eb; text-decoration: underline; }
.edu-doc-sheet.edu-doc-dark .docx-link { color: #60a5fa; }
.edu-doc-sheet .pptx-slide { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; margin: 0 0 14px; background: #f8fafc; }
.edu-doc-sheet.edu-doc-dark .pptx-slide { border-color: #334155; background: #0f172a; }
`

export default function InlineFileReader({ file, defaultOpen = true }: { file: FileObj; defaultOpen?: boolean }) {
  const ext = getExt(file)
  const isPdf = ext === '.pdf' || (file.mime_type || '').includes('pdf')
  const isImg = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) || (file.mime_type || '').startsWith('image/')
  const isExcel = ['.xlsx', '.xls', '.csv'].includes(ext) || (file.mime_type || '').includes('spreadsheet') || (file.mime_type || '').includes('excel')
  const isWord = ['.docx', '.doc'].includes(ext) || (file.mime_type || '').includes('word')
  const isPptx = ['.pptx', '.ppt'].includes(ext)
  const isTextDoc = isWord || isExcel || isPptx || ['.txt', '.md', '.py', '.json', '.xml', '.css', '.js'].includes(ext)

  const [open, setOpen] = useState(defaultOpen)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [docText, setDocText] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string>('')
  const [sheets, setSheets] = useState<ExcelSheet[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [fullOpen, setFullOpen] = useState(false)
  const [docFullOpen, setDocFullOpen] = useState(false)
  const [paperDark, setPaperDark] = useState(false)
  const [docFontPx, setDocFontPx] = useState(15)
  const loadedIdRef = useRef<number | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (loadedIdRef.current !== null && loadedIdRef.current !== file.id) {
      loadedIdRef.current = null
      const oldUrl = blobUrlRef.current
      blobUrlRef.current = null
      if (oldUrl) {
        setTimeout(() => URL.revokeObjectURL(oldUrl), 2500)
      }
      setBlobUrl(null)
      setDocText(null)
      setDocHtml('')
      setSheets([])
      setActiveSheet(0)
      setErr('')
    }
  }, [file.id])

  useEffect(() => {
    if (!open || !(isPdf || isImg || isTextDoc)) return
    if (loadedIdRef.current === file.id && (blobUrlRef.current || !isPdf && !isImg)) return
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
          const oldUrl = blobUrlRef.current
          blobUrlRef.current = nextUrl
          loadedIdRef.current = file.id
          setBlobUrl(nextUrl)
          if (oldUrl && oldUrl !== nextUrl) {
            setTimeout(() => URL.revokeObjectURL(oldUrl), 2000)
          }
        } else if (isTextDoc) {
          const r = await client.get(`/files/${file.id}/preview_text/`)
          if (cancelled) return
          loadedIdRef.current = file.id
          setDocText(r.data?.text || '')
          setDocHtml(r.data?.html ? sanitizeWordHtml(r.data.html) : '')
          const rawSheets: ExcelSheet[] = Array.isArray(r.data?.sheets) ? r.data.sheets : []
          setSheets(rawSheets.map(s => ({ ...s, html: sanitizeWordHtml(s.html || '') })))
          setActiveSheet(0)
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
      // При размонтировании (в т.ч. React StrictMode) сбрасываем loadedIdRef, чтобы при повторном монтировании создался свежий blob URL
      loadedIdRef.current = null
      const urlToRevoke = blobUrlRef.current
      blobUrlRef.current = null
      if (urlToRevoke) {
        setTimeout(() => URL.revokeObjectURL(urlToRevoke), 1500)
      }
    }
  }, [])

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

  const kindMeta = isPdf
    ? { bg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300', label: 'PDF-документ', Icon: FileText }
    : isImg
      ? { bg: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300', label: 'Фото / изображение', Icon: ImageIcon }
      : isExcel
        ? { bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Таблица Excel', Icon: FileSpreadsheet }
        : isPptx
          ? { bg: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300', label: 'Презентация', Icon: Presentation }
          : { bg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300', label: isWord ? 'Документ Word' : 'Текстовый документ', Icon: FileText }

  const activeSheetObj = sheets.length > 0 ? (sheets[activeSheet] || sheets[0]) : null

  const renderDocSheet = (isModal = false) => (
    <div
      className={`rounded-xl border shadow-md overflow-y-auto ${
        isModal ? 'flex-1 p-5 sm:p-8' : 'max-h-[600px] p-4 sm:p-7'
      } ${
        paperDark
          ? 'bg-slate-900 text-slate-100 border-slate-700'
          : 'bg-white text-slate-900 border-slate-200'
      }`}
    >
      <style>{DOC_SHEET_CSS}</style>
      <div
        className={`edu-doc-sheet mx-auto ${isExcel ? 'max-w-full' : 'max-w-[780px]'} ${paperDark ? 'edu-doc-dark' : ''}`}
        style={{ fontSize: `${docFontPx}px` }}
      >
        {activeSheetObj ? (
          <div dangerouslySetInnerHTML={{ __html: activeSheetObj.html }} />
        ) : docHtml ? (
          <div dangerouslySetInnerHTML={{ __html: docHtml }} />
        ) : (
          <div className="whitespace-pre-wrap font-sans">
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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kindMeta.bg}`}>
            <kindMeta.Icon size={20} />
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
          {(isTextDoc && (sheets.length > 0 || docHtml || docText !== null)) && (
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

          {/* PDF — все страницы лентой, автоподгон по ширине, zoom, HD PyMuPDF fallback */}
          {!loading && isPdf && blobUrl && (
            <PdfViewer blobUrl={blobUrl} fileId={file.id} maxHeightClass="max-h-[720px]" initialMode="all" />
          )}

          {/* Фото / картинка */}
          {!loading && isImg && blobUrl && (
            <div className="rounded-xl overflow-hidden bg-slate-900/5 dark:bg-slate-950 border dark:border-slate-700 flex justify-center p-2">
              <img
                src={blobUrl}
                alt={file.title}
                onClick={() => setFullOpen(true)}
                className="max-h-[540px] max-w-full object-contain rounded-lg cursor-zoom-in"
              />
            </div>
          )}

          {/* Word / Excel / CSV / PPTX / TXT */}
          {!loading && isTextDoc && (sheets.length > 0 || docHtml || docText !== null) && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {kindMeta.label}
                  {activeSheetObj ? ` • ${activeSheetObj.rows_count} стр. × ${activeSheetObj.cols_count} кол.` : ''}
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

              {/* Вкладки листов Excel */}
              {sheets.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" data-testid="excel-sheet-tabs">
                  {sheets.map((sh, i) => (
                    <button
                      key={`${sh.name}-${i}`}
                      type="button"
                      onClick={() => setActiveSheet(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition ${
                        activeSheet === i
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {sh.name}
                    </button>
                  ))}
                </div>
              )}

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
          fileId={file.id}
          isImage={isImg}
          onClose={() => setFullOpen(false)}
        />
      )}

      {/* Полноэкранный просмотрщик Word / Excel / TXT / PPTX */}
      {docFullOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col p-3 sm:p-6">
          <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl border border-slate-700 shrink-0">
              <span className="font-bold text-sm truncate flex items-center gap-2">
                <kindMeta.Icon size={16} className="text-blue-400 shrink-0" /> {file.title}
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
            {sheets.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
                {sheets.map((sh, i) => (
                  <button
                    key={`${sh.name}-${i}`}
                    type="button"
                    onClick={() => setActiveSheet(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                      activeSheet === i ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {sh.name}
                  </button>
                ))}
              </div>
            )}
            {renderDocSheet(true)}
          </div>
        </div>
      )}
    </div>
  )
}
