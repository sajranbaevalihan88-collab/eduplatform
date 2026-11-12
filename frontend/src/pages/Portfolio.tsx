import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { Medal, FolderKanban, TrendingUp, Star, Printer, Plus, Trash2, User as UserIcon, ChevronRight, X, FileText, Paperclip } from 'lucide-react'

type Work = { assignment_id: number; title: string; kind: string; classroom: string; topic: string; score: number | null; max_score: number; pct: number; answer?: string; url?: string; submitted_at: string }
type Ach = { id: number; title: string; kind: string; description: string; event_date: string | null; added_by_name: string; created_at: string; file?: string | null; is_image?: boolean }
type Student = { id: number; username: string; first_name: string; classes?: string[] }
type TopicRow = { topic_id: number; title: string; pct: number; status: string; subject_name?: string; grade?: string; criteria?: string; kr_grade?: number }
type Data = {
  username: string; first_name: string; is_self: boolean; diag_avg: number | null
  progress?: { topics?: TopicRow[]; mastered?: TopicRow[]; gaps?: TopicRow[]; diagnostics?: any[] }
  works: Work[]; achievements: Ach[]
}

const KIND_META: Record<string, { emoji: string; label: string }> = {
  project: { emoji: '💻', label: 'Проект / реальная работа' },
  skill: { emoji: '🎯', label: 'Освоенный навык' },
  gramota: { emoji: '📜', label: 'Грамота' },
  cubok: { emoji: '🏆', label: 'Кубок/место' },
  blagodarnost: { emoji: '💌', label: 'Благодарность' },
  olimpiad: { emoji: '🧠', label: 'Олимпиада' },
  other: { emoji: '⭐', label: 'Другое' },
}
const pctCls = (p: number) => p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-sky-500' : 'bg-red-500'
const pctTxt = (p: number) => p >= 80 ? 'text-emerald-600' : p >= 50 ? 'text-sky-600' : 'text-red-600'
const FILE_OK = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']
const FILE_MAX = 8 * 1024 * 1024

export default function Portfolio() {
  const { t } = useLang()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<Data | null>(null)
  const [people, setPeople] = useState<any[]>([])       // чьё портфолио можно открыть (учитель/админ)
  const [kids, setKids] = useState<any[]>([])           // дети родителя
  const [adding, setAdding] = useState(false)
  const [ntitle, setNtitle] = useState('')
  const [nkind, setNkind] = useState('gramota')
  const [ndesc, setNdesc] = useState('')
  const [ndate, setNdate] = useState('')
  // файл достижения
  const [nfile, setNfile] = useState<File | null>(null)
  const [nfileUrl, setNfileUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // комбобокс поиска ученика (учитель/админ)
  const [sq, setSq] = useState('')
  const [sOpen, setSOpen] = useState(false)
  const [sRes, setSRes] = useState<Student[]>([])
  const [selUser, setSelUser] = useState<Student | null>(null)
  const sqTimer = useRef<number | null>(null)
  const sqBlur = useRef<number | null>(null)

  const user = params.get('user') || ''

  const [dataErr, setDataErr] = useState(false)

  const load = useCallback(() => {
    client.get('/portfolio/', { params: user ? { user } : {} })
      .then(r => { setData(r.data); setDataErr(false) })
      .catch(() => { setData(null); setDataErr(true) })
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // чьи портфолио можно открыть: учителю/админу — их ученики; родителю — дети.
  // Реакция на state, а не на роль из localStorage (устойчиво при любых login-флоу).
  useEffect(() => {
    client.get('/portfolio/students/').then(r => {
      const arr = Array.isArray(r.data) ? r.data : (r.data as any)?.results || []
      setPeople(arr)
    }).catch(() => setPeople([]))
    client.get('/auth/children/').then(r => {
      const arr = Array.isArray(r.data) ? r.data : (r.data as any)?.results || []
      setKids(arr)
    }).catch(() => setKids([]))
  }, [])

  // авто-выбор пока не выбран никто
  useEffect(() => {
    if (!user && kids.length) setParams({ user: kids[0].username }, { replace: true })
  }, [kids, user, setParams])
  useEffect(() => {
    if (!user && people.length) setParams({ user: people[0].username }, { replace: true })
  }, [people, user, setParams])

  const pick = (username: string) => {
    setParams(username ? { user: username } : {}, { replace: true })
    setData(null)
  }

  // отражение выбранного ученика (в т.ч. авто-выбранного) для комбобокса
  useEffect(() => {
    if (!user) { setSelUser(null); return }
    setSelUser(prev => prev && prev.username === user ? prev : (people.find(p => p.username === user) || null))
  }, [user, people])

  const onSqChange = (v: string) => {
    setSq(v)
    if (sqTimer.current) window.clearTimeout(sqTimer.current)
    if (v.trim().length < 2) { setSRes([]); return }
    sqTimer.current = window.setTimeout(() => {
      client.get('/portfolio/students/', { params: { q: v.trim() } }).then(r => {
        const arr: Student[] = Array.isArray(r.data) ? r.data : (r.data as any)?.results || []
        setSRes(arr)
        setSOpen(true)
      }).catch(() => setSRes([]))
    }, 300)
  }
  const closeSearch = () => { setSOpen(false); setSq(''); setSRes([]) }

  const chooseStudent = (s: Student) => {
    setSelUser(s)
    pick(s.username)
    closeSearch()
  }

  const clearFile = () => {
    if (nfileUrl) URL.revokeObjectURL(nfileUrl)
    setNfile(null)
    setNfileUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }
  const onPickFile = (f: File | null) => {
    clearFile()
    if (!f) return
    const ext = f.name.toLowerCase().split('.').pop() || ''
    if (!FILE_OK.includes(ext) || f.size > FILE_MAX) { toast(t('pf_ach_file_err'), 'error'); return }
    setNfile(f)
    if (f.type.startsWith('image/')) setNfileUrl(URL.createObjectURL(f))
  }

  const addAch = async () => {
    const title = ntitle.trim()
    const targetUser = user || data?.username || ''
    if (!title || !targetUser) { toast(t('pf_ach_need_title'), 'error'); return }
    try {
      const fd = new FormData()
      fd.append('user', targetUser)
      fd.append('title', title)
      fd.append('kind', nkind)
      fd.append('description', ndesc.trim())
      fd.append('event_date', ndate || '')
      if (nfile) fd.append('file', nfile)
      // Content-Type явно multipart — иначе дефолт application/json у клиента роняет файл
      await client.post('/portfolio/achievements/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      clearFile()
      setAdding(false); setNtitle(''); setNdesc(''); setNdate(''); setNkind('gramota')
      toast(t('pf_ach_added'), 'success')
      load()
    } catch {
      toast(t('pf_ach_file_err'), 'error')
    }
  }

  const delAch = async (id: number) => {
    try { await client.delete(`/portfolio/achievements/${id}/`); load() } catch { /* noop */ }
  }

  if (data === null && dataErr) return (
    <div className="p-8 text-center max-w-3xl mx-auto">
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 border rounded-2xl p-6 flex flex-col items-center gap-3">
        <div className="text-3xl">📭</div>
        <h2 className="font-bold text-slate-800 dark:text-white">{t('portfolio_load_err_t')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('portfolio_load_err_s')}</p>
        <button onClick={load} className="px-4 py-2.5 min-h-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">{t('retry')}</button>
      </div>
    </div>
  )
  if (data === null) return <div className="p-8 text-center"><div className="skeleton h-40 rounded-2xl max-w-3xl mx-auto"/></div>

  const role = (JSON.parse(localStorage.getItem('user') || '{}') as any).role
  const canAdd = role === 'teacher' || role === 'admin'
  const prog = data.progress || {}
  const topics: TopicRow[] = prog.topics || []
  const mastered = prog.mastered || []
  const gaps: TopicRow[] = prog.gaps || []
  const diags = prog.diagnostics || []

  return (
    <div className="max-w-4xl mx-auto space-y-5" data-testid="portfolio-page">
      {/* Заголовок + выбор чьё портфолио */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
          <Medal className="text-amber-500"/>{t('pf_title')}
        </h1>
        {canAdd && people.length > 0 && (
          <div className="relative" data-testid="pf-pick-student">
            {selUser && !sOpen ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm">
                <span className="font-medium">{selUser.first_name || selUser.username}</span>
                {selUser.classes?.length ? <span className="text-xs text-slate-400">{selUser.classes.join(', ')}</span> : null}
                <button onClick={() => { setSOpen(true); setSq(''); setSRes([]) }} data-testid="pf-change-student"
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label={t('pf_pick_student')}>
                  <X size={14}/>
                </button>
              </div>
            ) : (
              <div>
                <input value={sq}
                  onChange={e => onSqChange(e.target.value)}
                  onFocus={() => { if (sqBlur.current) window.clearTimeout(sqBlur.current); if (sq.trim().length >= 2 && sRes.length) setSOpen(true) }}
                  onBlur={() => { sqBlur.current = window.setTimeout(() => setSOpen(false), 150) }}
                  onKeyDown={e => { if (e.key === 'Escape') closeSearch() }}
                  placeholder={t('pf_search_nick')}
                  data-testid="pf-search-input"
                  className="w-52 px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm outline-none focus:border-indigo-400"/>
                {sOpen && (
                  <div className="absolute z-20 left-0 mt-1 w-64 max-h-60 overflow-auto rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                    {sRes.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">{sq.trim().length >= 2 ? t('pf_search_no') : t('pf_search_nick')}</div>
                    ) : sRes.map(p => (
                      <button key={p.id} data-testid="pf-search-option"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => chooseStudent(p)}
                        className="w-full text-left px-3 py-2 text-sm dark:text-white hover:bg-indigo-50 dark:hover:bg-slate-800">
                        <b>{p.first_name || p.username}</b> <span className="text-xs text-slate-400">@{p.username}</span>
                        {p.classes?.length ? <span className="text-xs text-slate-400"> · {p.classes.join(', ')}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {kids.length > 1 && (
          <select value={user} onChange={e => pick(e.target.value)}
            data-testid="pf-pick-child"
            className="px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm">
            {kids.map(k => <option key={k.id} value={k.username}>{k.first_name || k.username}</option>)}
          </select>
        )}
        <button onClick={() => window.print()}
          className="ml-auto px-3 py-2 rounded-xl border dark:border-slate-700 text-sm dark:text-white flex items-center gap-1.5 bg-white dark:bg-slate-900">
          <Printer size={15}/>{t('pf_print')}
        </button>
      </div>

      {/* Шапка портфолио */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-5 flex flex-wrap items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-2xl">
          {(data.first_name || data.username).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-40">
          <div className="text-lg font-bold dark:text-white" data-testid="pf-name">{data.first_name || data.username}</div>
          <div className="text-xs text-slate-400">{data.username}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold text-emerald-600" data-testid="pf-count-mastered">{mastered.length || 0}</div>
            <div className="text-[11px] text-slate-400">{t('pf_topics_mastered')}</div>
          </div>
          <div>
            <div className="text-xl font-bold text-indigo-600" data-testid="pf-count-works">{data.works.length}</div>
            <div className="text-[11px] text-slate-400">{t('pf_works')}</div>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600" data-testid="pf-count-ach">{data.achievements.length}</div>
            <div className="text-[11px] text-slate-400">{t('pf_ach')}</div>
          </div>
        </div>
      </div>

      {/* Достижения, проекты и навыки */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold text-sm dark:text-white flex items-center gap-1.5"><Star size={15} className="text-amber-500"/>Проекты, достижения и освоенные навыки</h2>
          {((canAdd && user) || data.is_self) && (
            <button onClick={() => setAdding(v => !v)} data-testid="pf-add-ach-btn"
              className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1">
              <Plus size={13}/>{data.is_self && !canAdd ? 'Добавить свой проект / работу' : t('pf_ach_add')}
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 space-y-2 print:hidden" data-testid="pf-ach-form">
            <div className="flex flex-wrap gap-2">
              <input value={ntitle} onChange={e => setNtitle(e.target.value)} placeholder={t('pf_ach_title_ph')}
                data-testid="pf-ach-title" className="flex-1 min-w-40 px-3 py-2 rounded-xl border dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
              <select value={nkind} onChange={e => setNkind(e.target.value)} data-testid="pf-ach-kind"
                className="px-3 py-2 rounded-xl border dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white text-sm">
                {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.emoji} {m.label}</option>)}
              </select>
              <input type="date" value={ndate} onChange={e => setNdate(e.target.value)} data-testid="pf-ach-date"
                className="px-3 py-2 rounded-xl border dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
            </div>
            <textarea value={ndesc} onChange={e => setNdesc(e.target.value)} rows={2} placeholder={t('pf_ach_desc_ph')}
              data-testid="pf-ach-desc" className="w-full px-3 py-2 rounded-xl border dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
            <div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => onPickFile(e.target.files?.[0] || null)} data-testid="pf-ach-file-input"/>
              <button onClick={() => fileRef.current?.click()} data-testid="pf-ach-file-btn"
                className="px-3 py-1.5 rounded-xl border dark:border-slate-600 text-sm dark:text-slate-200 flex items-center gap-1.5 bg-white dark:bg-slate-900 hover:border-indigo-400">
                <Paperclip size={14}/>{t('pf_ach_file')}
              </button>
              {nfile && (
                <div className="mt-2 flex items-center gap-2" data-testid="pf-ach-file-preview">
                  {nfileUrl ? (
                    <img src={nfileUrl} alt={nfile.name} className="w-10 h-10 rounded-lg object-cover border dark:border-slate-700"/>
                  ) : (
                    <span className="w-10 h-10 rounded-lg border dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <FileText size={18}/>
                    </span>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-300 truncate max-w-56">{nfile.name}</span>
                  <button onClick={clearFile} data-testid="pf-ach-file-clear" className="p-0.5 text-slate-400 hover:text-red-500" aria-label="clear">
                    <X size={14}/>
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={addAch} data-testid="pf-ach-save"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('pf_save')}</button>
              <button onClick={() => { clearFile(); setAdding(false) }} className="px-4 py-2 rounded-xl border dark:border-slate-600 text-sm dark:text-white">{t('pf_cancel')}</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {data.achievements.map(a => {
            const meta = KIND_META[a.kind] || KIND_META.other
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30" data-testid={`pf-ach-${a.id}`}>
                <div className="text-2xl">{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white">{a.title}</div>
                  <div className="text-xs text-slate-500">{meta.label}{a.event_date ? ` · ${new Date(a.event_date).toLocaleDateString()}` : ''}{a.description ? ` · ${a.description}` : ''}</div>
                </div>
                {a.file && (() => {
                  const isImg = a.is_image != null ? a.is_image : /\.(jpe?g|png|webp|gif)$/i.test(a.file as string)
                  const fileName = (() => { try { return decodeURIComponent((a.file as string).split('/media/')[1]?.split('/').pop() || '') } catch { return a.file as string } })()
                  return (
                    <a href={a.file} target="_blank" rel="noreferrer" data-testid={`pf-ach-file-${a.id}`}
                      className={`shrink-0 ${isImg ? '' : 'flex flex-col items-center gap-0.5 text-slate-500 hover:text-indigo-600 dark:text-slate-300'}`} title={isImg ? '' : fileName}>
                      {isImg ? (
                        <img src={a.file} alt={a.title} className="w-14 h-14 rounded-lg object-cover border border-amber-200 dark:border-amber-900/40"/>
                      ) : (
                        <>
                          <FileText size={22}/>
                          <span className="text-[10px] max-w-24 truncate">{fileName}</span>
                        </>
                      )}
                    </a>
                  )
                })()}
                {canAdd && a.added_by_name && (
                  <button onClick={() => delAch(a.id)} data-testid={`pf-ach-del-${a.id}`} className="p-1.5 text-slate-300 hover:text-red-500 print:hidden" aria-label="Удалить достижении">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            )
          })}
          {data.achievements.length === 0 && <div className="text-xs text-slate-400 py-2">{t('pf_ach_empty')}</div>}
        </div>
      </div>

      {/* Освоенные навыки по программе КР */}
      {mastered.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 p-4">
          <h2 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
            🎯 Подтверждённые навыки и освоенные темы (≥80%)
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {mastered.map(m => (
              <div key={m.topic_id} className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <b className="dark:text-white text-sm">{m.title}</b>
                  <span className="font-bold text-emerald-600">{m.pct}% {m.kr_grade ? `· «${m.kr_grade}»` : ''}</span>
                </div>
                {m.subject_name && <div className="text-slate-400">{m.subject_name}{m.grade ? ` · ${m.grade} класс` : ''}</div>}
                {m.criteria && <div className="text-emerald-700 dark:text-emerald-300 mt-0.5">✓ Навык: {m.criteria}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Лучшие и реальные работы */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
        <h2 className="font-bold text-sm dark:text-white flex items-center gap-1.5 mb-3"><FolderKanban size={15} className="text-indigo-600"/>Реальные работы, письменные ответы и проекты ученика</h2>
        <div className="space-y-2">
          {data.works.map((w) => (
            <div key={w.assignment_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 space-y-1.5" data-testid={`pf-work-${w.assignment_id}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 ${pctCls(w.pct)}`}>{Math.round(w.pct)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white truncate">{w.title}</div>
                  <div className="text-xs text-slate-400">{w.classroom}{w.topic ? ` · тема: ${w.topic}` : ''} · {new Date(w.submitted_at).toLocaleDateString()}</div>
                </div>
                {w.score != null && <div className="text-xs font-bold dark:text-white">{w.score}/{w.max_score}</div>}
              </div>
              {w.answer && (
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 block mb-0.5">Работа ученика:</span>
                  {w.answer}
                </div>
              )}
              {w.url && (
                <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline inline-block">
                  🔗 Открыть материал / проект
                </a>
              )}
            </div>
          ))}
          {data.works.length === 0 && <div className="text-xs text-slate-400 py-2">{t('pf_works_empty')}</div>}
        </div>
      </div>

      {/* Карта знаний */}
      {topics.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white flex items-center gap-1.5 mb-3"><TrendingUp size={15} className="text-emerald-600"/>{t('pf_knowledge')}</h2>
          <div className="space-y-2.5">
            {topics.map(tp => (
              <div key={tp.topic_id}>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="flex-1 truncate dark:text-white">{tp.title}</span>
                  <span className={`font-bold ${pctTxt(tp.pct)}`}>{tp.pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${pctCls(tp.pct)}`} style={{ width: `${Math.max(2, tp.pct)}%` }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/40 text-sm">
          <b className="text-amber-700 dark:text-amber-300">{t('pf_gaps_tip')}</b>
          <span className="text-slate-500 dark:text-slate-300"> {gaps.map(g => g.title).join(', ')}</span>
        </div>
      )}

      {/* Диагностика */}
      <div>
        <h2 className="font-bold text-sm dark:text-white flex items-center gap-1.5 mb-3"><UserIcon size={15} className="text-sky-600"/>{t('pf_diags_title')}{data.diag_avg != null ? <span className="text-xs font-medium text-slate-400">· средний {data.diag_avg}%</span> : null}</h2>
        <div className="space-y-1.5">
          {diags.map((d: any) => (
            <div key={d.test_id} className="flex items-center gap-2 text-sm bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-3 py-2">
              <span className="flex-1 truncate dark:text-white">{d.title}</span>
              <b className={pctTxt(d.score)}>{d.score}%</b>
              <ChevronRight size={13} className="text-slate-300"/>
            </div>
          ))}
          {diags.length === 0 && <div className="text-xs text-slate-400 py-1">{t('pf_diags_empty')}</div>}
        </div>
      </div>
    </div>
  )
}
