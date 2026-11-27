import { useEffect, useState } from 'react'
import client, { mediaUrl } from '../api/client'
import { Upload, FileText, Presentation, File, Image as ImgIcon, FileSpreadsheet, Trash2, Eye, X } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { openMediaFile } from '../utils/fileOpen'
import InlineFileReader from '../components/InlineFileReader'

function getFileExt(f: any): string {
  const s = (f?.file || f?.title || '').split('?')[0].toLowerCase()
  const i = s.lastIndexOf('.')
  return i >= 0 ? s.slice(i) : ''
}

export default function Files() {
  const { t } = useLang()
  const [list, setList] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'pdf' | 'word' | 'excel' | 'pptx' | 'txt' | 'image'>('all')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<any | null>(null)
  const [me, setMe] = useState<any>(null)

  const load = () => client.get('/files/').then(r => setList(Array.isArray(r.data) ? r.data : r.data.results || []))

  useEffect(() => {
    load()
    const raw = localStorage.getItem('user')
    if (raw) try { setMe(JSON.parse(raw)) } catch {}
    const h = () => {
      const r = localStorage.getItem('user')
      if (r) try { setMe(JSON.parse(r)) } catch {}
      else setMe(null)
    }
    window.addEventListener('auth-change', h as any)
    window.addEventListener('storage', h)
    return () => {
      window.removeEventListener('auth-change', h as any)
      window.removeEventListener('storage', h)
    }
  }, [])

  const canDelete = (f: any) => me && (String(f.owner) === String(me.id) || String(f.owner_id) === String(me.id) || me.role === 'admin' || me.is_staff)

  const onUpload = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['.ppt', '.pptx', '.doc', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) { alert(t('files_bad_type') + allowed.join(', ')); return }
    if (file.size > 100 * 1024 * 1024) { alert(t('files_too_big')); return }
    if (file.size === 0) { alert(t('files_empty_file')); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name.slice(0, 200))
      fd.append('is_public', 'true')
      await client.post('/files/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.error || t('files_upload_err'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const del = async (id: number) => {
    if (!confirm(t('files_del_confirm'))) return
    await client.delete(`/files/${id}/`)
    load()
  }

  const iconFor = (f: any) => {
    const ext = getFileExt(f)
    if (['.xlsx', '.xls', '.csv'].includes(ext)) return <FileSpreadsheet size={20} className="text-emerald-600" />
    if (f.file_type === 'presentation' || ['.ppt', '.pptx'].includes(ext)) return <Presentation size={20} className="text-orange-600" />
    if (f.file_type === 'pdf' || ext === '.pdf') return <File size={20} className="text-rose-600" />
    if (f.file_type === 'image' || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return <ImgIcon size={20} className="text-sky-600" />
    if (f.file_type === 'document') return <FileText size={20} className="text-indigo-600" />
    return <File size={20} />
  }

  const filtered = list.filter(f => {
    if (filter === 'all') return true
    const ext = getFileExt(f)
    if (filter === 'pdf') return ext === '.pdf' || f.file_type === 'pdf'
    if (filter === 'word') return ['.doc', '.docx'].includes(ext)
    if (filter === 'excel') return ['.xlsx', '.xls', '.csv'].includes(ext)
    if (filter === 'pptx') return ['.ppt', '.pptx'].includes(ext) || f.file_type === 'presentation'
    if (filter === 'txt') return ['.txt', '.md'].includes(ext)
    if (filter === 'image') return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) || f.file_type === 'image'
    return true
  })

  const chips: { id: typeof filter; label: string }[] = [
    { id: 'all', label: t('files_all') },
    { id: 'pdf', label: 'PDF' },
    { id: 'word', label: 'Word / DOCX' },
    { id: 'excel', label: 'Excel' },
    { id: 'txt', label: 'TXT' },
    { id: 'image', label: 'Фото' },
    { id: 'pptx', label: t('files_pptx') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold dark:text-white">{t('files_title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">DOCX, Word, PDF, Excel (.xlsx, .xls, .csv), TXT, Фото, PPTX</p>
        </div>
        <label className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer flex items-center gap-2 transition">
          <Upload size={18} /> {uploading ? t('files_uploading') : t('files_upload')}
          <input type="file" className="hidden" accept=".ppt,.pptx,.doc,.docx,.xlsx,.xls,.csv,.txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.gif,image/*" onChange={onUpload} />
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-2.5 flex gap-2 text-sm overflow-x-auto">
        {chips.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition ${
              filter === c.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(f => (
          <div key={f.id} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 flex items-center justify-center">{iconFor(f)}</div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 dark:text-slate-300 uppercase font-mono">
                {getFileExt(f).replace('.', '') || f.file_type}
              </span>
            </div>
            <h3 className="font-semibold mt-3 line-clamp-1 text-slate-900 dark:text-white" title={f.title}>{f.title}</h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(f.size / 1024).toFixed(1)} KB • {new Date(f.created_at).toLocaleDateString()}</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPreview(f)} className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium text-center flex items-center justify-center gap-1">
                <Eye size={14} /> {t('files_preview')}
              </button>
              <button onClick={() => openMediaFile(mediaUrl(f.file), f.title).catch(() => alert(t('books_load_err')))} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-slate-200 text-sm">
                {t('files_open')}
              </button>
              {canDelete(f) && (
                <button onClick={() => del(f.id)} className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center" aria-label={t('delete')}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="text-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800">{t('files_empty_list')}</div>}

      {preview && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" onClick={() => setPreview(null)}>
          <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white truncate">{preview.title}</h3>
              <button onClick={() => setPreview(null)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={t('close')}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
              <InlineFileReader file={preview} defaultOpen={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
