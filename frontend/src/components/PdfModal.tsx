import { useEffect } from 'react'
import { X, Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react'
import PdfViewer from './PdfViewer'

type Props = {
  title: string
  fileName: string
  blobUrl: string
  fileId?: number
  isImage?: boolean
  onClose: () => void
}

export default function PdfModal({ title, fileName, blobUrl, fileId, isImage, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      data-testid="pf-file-modal"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка просмотрщика */}
        <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isImage ? <ImageIcon size={18} className="text-sky-600 shrink-0" /> : <FileText size={18} className="text-indigo-600 shrink-0" />}
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{title || fileName}</div>
              {fileName && <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{fileName}</div>}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"
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
              className="p-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Тело просмотрщика */}
        <div className="flex-1 min-h-0 overflow-hidden p-3 sm:p-4 bg-slate-100 dark:bg-slate-950/80 flex flex-col">
          {isImage ? (
            <div className="flex-1 overflow-auto flex items-center justify-center">
              <img
                src={blobUrl}
                alt={title}
                className="max-w-full max-h-[80vh] rounded-xl shadow-lg object-contain bg-white"
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col [&>div]:flex-1 [&>div]:flex [&>div]:flex-col [&>div]:min-h-0">
              <PdfViewer blobUrl={blobUrl} fileId={fileId} maxHeightClass="flex-1 min-h-0" initialMode="all" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
