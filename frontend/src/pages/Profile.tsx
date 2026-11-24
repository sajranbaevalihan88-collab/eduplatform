import { useEffect, useMemo, useRef, useState } from 'react'
import client, { mediaSrc, clearLocalSession } from '../api/client'
import {
  User, Mail, Shield, BookOpen, Layers, Presentation, FlaskConical, LogOut, Trash2,
  Eye, EyeOff, Edit, Search, Filter, Gamepad2, Play, StickyNote, UserPlus, Users,
  Check, X as XIcon, KeyRound, Camera, Image as ImageIcon, Upload, Calendar,
  Loader2, SlidersHorizontal, Plus, ChevronDown, ChevronUp, FileText,
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from '../context/UIContext'
import Notes from './Notes'
import QuizBuilder from '../components/QuizBuilder'
import BackupRestoreActions from '../components/BackupRestoreCard'
import { useLang } from '../context/LangContext'

const BANNER_PRESETS = [
  { id: 'slate', name: 'Графит', css: 'linear-gradient(135deg, #334155 0%, #1e293b 55%, #0f172a 100%)' },
  { id: 'steel', name: 'Ала-Тоо', css: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 55%, #172554 100%)' },
  { id: 'ink', name: 'Индиго', css: 'linear-gradient(135deg, #4338ca 0%, #312e81 55%, #1e1b4b 100%)' },
  { id: 'pine', name: 'Изумруд', css: 'linear-gradient(135deg, #047857 0%, #065f46 55%, #064e3b 100%)' },
  { id: 'sand', name: 'Янтарь', css: 'linear-gradient(135deg, #b45309 0%, #78350f 55%, #451a03 100%)' },
  { id: 'burgundy', name: 'Бордо', css: 'linear-gradient(135deg, #be123c 0%, #881337 55%, #4c0519 100%)' },
] as const

const LEGACY_PRESET_MAP: Record<string, string> = {
  aurora: 'steel',
  ocean: 'steel',
  emerald: 'pine',
  sunset: 'sand',
  rose: 'burgundy',
}

function normalizeBannerPreset(presetId?: string): string {
  if (!presetId) return 'steel'
  const mapped = LEGACY_PRESET_MAP[presetId] || presetId
  return BANNER_PRESETS.some(p => p.id === mapped) ? mapped : 'steel'
}

function getBannerCss(presetId?: string): string {
  const norm = normalizeBannerPreset(presetId)
  return BANNER_PRESETS.find(p => p.id === norm)?.css || BANNER_PRESETS[1].css
}

function syncStoredUser(nextUser: any) {
  try {
    const raw = localStorage.getItem('user')
    const prev = raw ? JSON.parse(raw) : {}
    localStorage.setItem('user', JSON.stringify({ ...prev, ...nextUser }))
    window.dispatchEvent(new Event('auth-change'))
  } catch { }
}

export default function Profile() {
  const { t } = useLang()
  const nav = useNavigate()
  const [me, setMe] = useState<any>(null)
  const [stats, setStats] = useState({ lessons: 0, pres: 0, tests: 0 })
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', bio: '', email: '' })
  const [myLessons, setMyLessons] = useState<any[]>([])
  const [myPres, setMyPres] = useState<any[]>([])
  const [myPresDrafts, setMyPresDrafts] = useState<any[]>([])
  const [myTests, setMyTests] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [tab, setTab] = useState<'lessons' | 'presentations' | 'tests' | 'draft' | 'notes' | 'games'>('lessons')
  const [filterSubject, setFilterSubject] = useState<string>('')
  const [sort, setSort] = useState<'new' | 'old' | 'title'>('new')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<any>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)

  // Загрузка аватара и баннера
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerModalOpen, setBannerModalOpen] = useState(false)
  const [bannerPosDraft, setBannerPosDraft] = useState<number>(50)
  const [bannerDragOver, setBannerDragOver] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [bannerImgBroken, setBannerImgBroken] = useState(false)
  const [avatarImgBroken, setAvatarImgBroken] = useState(false)
  const [mediaVersion, setMediaVersion] = useState<number>(() => Date.now())
  const [deployOpen, setDeployOpen] = useState(false)

  const showAndScroll = (nextTab: 'lessons' | 'presentations' | 'tests') => {
    setTab(nextTab)
    requestAnimationFrame(() => { tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
  }

  // Помощники / Админ
  const isAdmin = !!me && (me.role === 'admin' || me.is_staff)
  const [asst, setAsst] = useState({ username: '', password: '', first_name: '' })
  const [asstRole, setAsstRole] = useState<'teacher' | 'assistant'>('teacher')
  const [asstBusy, setAsstBusy] = useState(false)
  const createAssistant = async () => {
    if (asstBusy) return
    if (asst.username.trim().length < 3) { toast(t('assistant_err_short'), 'error'); return }
    if (asst.password.length < 8) { toast(t('assistant_err_pass'), 'error'); return }
    setAsstBusy(true)
    try {
      await client.post('/auth/create-assistant/', { username: asst.username.trim(), password: asst.password, first_name: asst.first_name.trim(), role: asstRole })
      toast(t(asstRole === 'teacher' ? 'assistant_created_teacher' : 'assistant_created'), 'success')
      setAsst({ username: '', password: '', first_name: '' })
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || t('error'), 'error')
    }
    setAsstBusy(false)
  }

  const [delNick, setDelNick] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [usersList, setUsersList] = useState<any[] | null>(null)
  const [usersOpen, setUsersOpen] = useState(false)
  const [usersQ, setUsersQ] = useState('')
  const delFound = useMemo(() => {
    const q = delNick.trim().toLowerCase()
    if (!usersList || q.length < 2) return undefined
    return usersList.find((x: any) => x.username.toLowerCase() === q) || null
  }, [delNick, usersList])
  useEffect(() => {
    if (!isAdmin || usersList) return
    client.get('/auth/users/').then(r => setUsersList(Array.isArray(r.data) ? r.data : [])).catch(() => setUsersList([]))
  }, [isAdmin])

  const [admTab, setAdmTab] = useState<'create' | 'users' | 'parents'>('create')
  const [usersTab, setUsersTab] = useState<'all' | 'student' | 'teacher' | 'admin' | 'parent'>('all')
  const [parentsList, setParentsList] = useState<any[] | null>(null)
  const [parentsOpen, setParentsOpen] = useState(false)
  const [linkParent, setLinkParent] = useState('')
  const [linkStudent, setLinkStudent] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const loadParents = () => {
    client.get('/auth/parents/').then(r => setParentsList(Array.isArray(r.data) ? r.data : [])).catch(() => setParentsList([]))
  }
  useEffect(() => { if (isAdmin && parentsOpen && parentsList === null) loadParents() }, [isAdmin, parentsOpen])
  const refreshUsers = () => client.get('/auth/users/').then(r => setUsersList(Array.isArray(r.data) ? r.data : [])).catch(() => { })
  const doLink = async (action: 'link' | 'unlink') => {
    if (linkBusy) return
    if (!linkParent.trim() || !linkStudent.trim()) { toast(t('parents_link_need_both'), 'error'); return }
    setLinkBusy(true)
    try {
      await client.post('/auth/parents/link/', { parent_username: linkParent.trim(), student_username: linkStudent.trim(), action })
      toast(action === 'link' ? t('parents_linked_ok') : t('parents_unlinked_ok'), 'success')
      if (action === 'link') { setLinkStudent('') }
      loadParents()
      refreshUsers()
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || t('error'), 'error')
    }
    setLinkBusy(false)
  }

  const [par, setPar] = useState({ username: '', password: '', first_name: '' })
  const [parBusy, setParBusy] = useState(false)
  const createParent = async () => {
    if (parBusy) return
    if (par.username.trim().length < 3) { toast(t('assistant_err_short'), 'error'); return }
    if (par.password.length < 8) { toast(t('assistant_err_pass'), 'error'); return }
    setParBusy(true)
    try {
      await client.post('/auth/parents/create/', { username: par.username.trim(), password: par.password, first_name: par.first_name.trim() })
      toast(t('parents_created'), 'success')
      setPar({ username: '', password: '', first_name: '' })
      loadParents(); refreshUsers()
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || t('error'), 'error')
    }
    setParBusy(false)
  }

  const usersGrouped = useMemo(() => {
    if (!usersList) return []
    const q = usersQ.trim().toLowerCase()
    return usersList.filter(u => {
      if (q && !u.username.toLowerCase().includes(q)) return false
      if (usersTab === 'all') return true
      if (usersTab === 'admin') return u.role === 'admin' || u.is_superuser
      return u.role === usersTab
    })
  }, [usersList, usersQ, usersTab])

  const usersCounts = useMemo(() => {
    const c = { all: 0, student: 0, teacher: 0, admin: 0, parent: 0 } as any
    for (const u of usersList || []) {
      c.all++
      if (u.role in c) c[u.role]++
      if (u.is_superuser && u.role !== 'admin') c.admin++
    }
    return c
  }, [usersList])
  const usersFiltered = useMemo(() => usersGrouped, [usersGrouped])
  const ROLE_LABEL: any = { admin: 'admin_role', teacher: 'login_teacher', student: 'login_student', parent: 'users_parent' }
  const canDeleteRow = (u: any) => {
    const meName = (me?.username || '').toLowerCase()
    if (!meName || u.username.toLowerCase() === meName) return false
    if (u.is_superuser) return false
    if ((u.is_staff || u.role === 'admin') && !me?.is_superuser) return false
    return true
  }
  const deleteUser = async (nickArg?: string) => {
    if (delBusy) return
    const nick = (nickArg ?? delNick).trim()
    if (!nick) { toast(t('admin_del_user_ph'), 'error'); return }
    if (!nickArg && delFound === null) { toast(t('del_user_notfound'), 'error'); return }
    if (!confirm(t('admin_del_user_confirm').replace('{nick}', nick))) return
    setDelBusy(true)
    try {
      await client.post('/auth/delete-user/', { username: nick })
      toast(t('admin_del_user_done'), 'success')
      setDelNick('')
      setUsersList(prev => prev ? prev.filter((x: any) => x.username.toLowerCase() !== nick.toLowerCase()) : prev)
      client.get('/auth/users/').then(r => setUsersList(Array.isArray(r.data) ? r.data : [])).catch(() => { })
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || t('error'), 'error')
    }
    setDelBusy(false)
  }

  const [pwFor, setPwFor] = useState<string | null>(null)
  const [pwVal, setPwVal] = useState('')
  const [pwShowU, setPwShowU] = useState(true)
  const [pwDoneNick, setPwDoneNick] = useState<string | null>(null)
  const [upwBusy, setUpwBusy] = useState(false)
  const setUserPassword = async (nick: string) => {
    if (upwBusy) return
    if (pwVal.length < 8) { toast(t('assistant_err_pass'), 'error'); return }
    setUpwBusy(true)
    try {
      await client.post('/auth/set-user-password/', { username: nick, new_password: pwVal })
      toast(t('users_pw_done').replace('{nick}', nick), 'success')
      setPwDoneNick(nick)
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || t('error'), 'error')
    }
    setUpwBusy(false)
  }

  const load = () => {
    client.get('/auth/me/').then(r => {
      setMe(r.data)
      syncStoredUser(r.data)
      setBannerPosDraft(typeof r.data.banner_position === 'number' ? r.data.banner_position : 50)
      setForm({
        username: r.data.username || '',
        first_name: r.data.first_name || '',
        last_name: r.data.last_name || '',
        bio: r.data.bio || '',
        email: r.data.email || '',
      })
      client.get('/subjects/').then(rr => {
        const arr = Array.isArray(rr.data) ? rr.data : rr.data.results || []
        setSubjects(arr)
      }).catch(() => { })
      try {
        const rawDraft = localStorage.getItem('lesson-draft')
        if (rawDraft) {
          const d = JSON.parse(rawDraft)
          const age = Date.now() - (d.ts || 0)
          const hasContent = (d.title && String(d.title).trim()) || d.subject || (d.blocks && d.blocks.length > 1)
          if (hasContent && age < 7 * 24 * 60 * 60 * 1000) setDraft(d)
          else localStorage.removeItem('lesson-draft')
        }
      } catch { }

      Promise.all([
        client.get('/lessons/?owner=me').then(r => r.data.results || r.data).catch(() => client.get('/lessons/').then(r => r.data.results || r.data).catch(() => [])),
        client.get('/presentations/?owner=me&is_public=true&is_lesson_private=false').then(r => r.data.results || r.data).catch(() => client.get('/presentations/?owner=me').then(r => r.data.results || r.data).catch(() => [])),
        client.get('/presentations/?owner=me&is_public=false').then(r => r.data.results || r.data).catch(() => []),
        client.get('/tests/?owner=me').then(r => r.data.results || r.data).catch(() => client.get('/tests/').then(r => r.data.results || r.data).catch(() => [])),
      ]).then(([lessons, presPublished, presDrafts, tests]) => {
        const uid = r.data.id
        const filterOwner = (arr: any[]) => Array.isArray(arr) ? arr.filter((x: any) => String(x.owner) === String(uid) || String(x.owner_id) === String(uid)) : []
        let myL = Array.isArray(lessons) ? (lessons.length && lessons[0]?.owner !== undefined ? lessons : filterOwner(lessons)) : []
        let myP = Array.isArray(presPublished) ? (presPublished.length && presPublished[0]?.owner !== undefined ? presPublished.filter((x: any) => String(x.owner) === String(uid) || String(x.owner_id) === String(uid)) : filterOwner(presPublished)) : []
        const myPDrafts = Array.isArray(presDrafts) ? presDrafts.filter((x: any) => String(x.owner) === String(uid) || String(x.owner_id) === String(uid)) : []
        let myT = Array.isArray(tests) ? (tests.length && tests[0]?.owner !== undefined ? tests.filter((x: any) => String(x.owner) === String(uid) || String(x.owner_id) === String(uid)) : filterOwner(tests)) : []
        if (myL.length === 0 && Array.isArray(lessons) && lessons.length > 0 && lessons[0]?.owner === undefined) myL = lessons
        if (myP.length === 0 && Array.isArray(presPublished) && presPublished.length > 0 && presPublished[0]?.owner === undefined) myP = presPublished
        if (myT.length === 0 && Array.isArray(tests) && tests.length > 0 && tests[0]?.owner === undefined) myT = tests
        setMyLessons(myL)
        setMyPres(myP)
        setMyPresDrafts(myPDrafts)
        setMyTests(myT)
        setStats({ lessons: myL.length, pres: myP.length, tests: myT.length })
      })
    }).catch(() => nav('/login'))
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!avatarMenuOpen) return
    const close = () => setAvatarMenuOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [avatarMenuOpen])

  const student = me?.role === 'student'
  const isParent = me?.role === 'parent'
  const hideTeacherTools = student || isParent
  useEffect(() => {
    if (hideTeacherTools && (tab === 'lessons' || tab === 'presentations' || tab === 'tests' || tab === 'draft' || tab === 'games')) {
      setTab('notes')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideTeacherTools])

  // ==================== ЗАГРУЗКА / УДАЛЕНИЕ ФОТО ПРОФИЛЯ И БАННЕРА ====================
  const uploadAvatarFile = async (file: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast('Фото профиля больше 10 МБ', 'error'); return }
    setUploadingAvatar(true)
    setAvatarMenuOpen(false)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const r = await client.patch('/auth/me/', fd)
      setAvatarImgBroken(false)
      setMediaVersion(Date.now())
      setMe(r.data)
      syncStoredUser(r.data)
      toast('Фото профиля обновлено', 'success')
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || 'Не удалось загрузить фото', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatar = async () => {
    setUploadingAvatar(true)
    setAvatarMenuOpen(false)
    try {
      const r = await client.patch('/auth/me/', { remove_avatar: true })
      setAvatarImgBroken(false)
      setMediaVersion(Date.now())
      setMe(r.data)
      syncStoredUser(r.data)
      toast('Фото профиля удалено', 'info')
    } catch {
      toast('Не удалось удалить фото', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const uploadBannerFile = async (file: File) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { toast('Баннер больше 15 МБ', 'error'); return }
    setUploadingBanner(true)
    try {
      const fd = new FormData()
      fd.append('banner', file)
      fd.append('banner_position', String(Math.round(Number(bannerPosDraft) || 50)))
      const r = await client.patch('/auth/me/', fd)
      setBannerImgBroken(false)
      setMediaVersion(Date.now())
      setMe(r.data)
      syncStoredUser(r.data)
      toast('Баннер профиля обновлён', 'success')
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || 'Не удалось загрузить баннер', 'error')
    } finally {
      setUploadingBanner(false)
    }
  }

  const removeBannerImage = async () => {
    setUploadingBanner(true)
    try {
      const r = await client.patch('/auth/me/', { remove_banner: true })
      setBannerImgBroken(false)
      setMediaVersion(Date.now())
      setMe(r.data)
      syncStoredUser(r.data)
      toast('Фото баннера удалено — используется градиент', 'info')
    } catch {
      toast('Не удалось удалить баннер', 'error')
    } finally {
      setUploadingBanner(false)
    }
  }

  const selectBannerPreset = async (presetId: string) => {
    setUploadingBanner(true)
    try {
      const r = await client.patch('/auth/me/', { banner_preset: presetId, remove_banner: true })
      setBannerImgBroken(false)
      setMediaVersion(Date.now())
      setMe(r.data)
      syncStoredUser(r.data)
      toast('Тема баннера применена', 'success')
    } catch {
      toast('Не удалось применить тему баннера', 'error')
    } finally {
      setUploadingBanner(false)
    }
  }

  const saveBannerPosition = async (pos: number) => {
    setBannerPosDraft(pos)
    try {
      const r = await client.patch('/auth/me/', { banner_position: pos })
      setMe(r.data)
      syncStoredUser(r.data)
    } catch { }
  }

  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const save = async () => {
    setSaveError(null)
    if (form.email && !form.email.includes('@')) {
      setSaveError(t('prof_email_err'))
      return
    }
    setSavingProfile(true)
    try {
      const r = await client.patch('/auth/me/', form)
      setMe(r.data)
      syncStoredUser(r.data)
      setEdit(false)
      toast('Профиль сохранён', 'success')
    } catch (e: any) {
      const d = e?.response?.data || {}
      const msg = d.username?.[0] || d.email?.[0] || d.detail || JSON.stringify(d) || t('prof_save_err')
      setSaveError(msg)
    } finally {
      setSavingProfile(false)
    }
  }

  // Смена пароля
  const [pw, setPw] = useState({ old: '', n1: '', n2: '' })
  const [pwShow, setPwShow] = useState(false)
  const pwInputType = pwShow ? 'text' : 'password'
  const pwEyeBtn = (showLabel: boolean) => (
    <button
      type="button"
      onClick={() => setPwShow(v => !v)}
      aria-label={showLabel ? t('login_hide_pass') : t('login_show_pass')}
      aria-pressed={showLabel}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 min-w-[36px] min-h-[36px] rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 flex items-center justify-center"
    >
      {showLabel ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const changePassword = async () => {
    setPwError(null)
    if (pw.n1 !== pw.n2) { setPwError(t('profile_pw_mismatch')); return }
    setPwBusy(true)
    try {
      const r = await client.post('/auth/change-password/', { old_password: pw.old, new_password: pw.n1 })
      if (r.data?.access) localStorage.setItem('access', r.data.access)
      if (r.data?.refresh) localStorage.setItem('refresh', r.data.refresh)
      setPw({ old: '', n1: '', n2: '' })
      setPwOpen(false)
      toast(t('profile_pw_changed'), 'success')
    } catch (e: any) {
      const d = e?.response?.data || {}
      setPwError(d.error || d.new_password?.[0] || d.detail || JSON.stringify(d) || t('error'))
    }
    setPwBusy(false)
  }

  const logout = async () => {
    const refresh = localStorage.getItem('refresh')
    if (refresh) {
      try {
        await client.post('/auth/logout/', { refresh })
      } catch {
        // выход должен срабатывать даже при сетевой ошибке
      }
    }
    clearLocalSession()
    window.dispatchEvent(new Event('auth-change'))
    nav('/login')
  }

  const deleteDraft = () => {
    if (!confirm(t('prof_del_draft_confirm'))) return
    localStorage.removeItem('lesson-draft')
    setDraft(null)
  }
  const restoreDraft = () => {
    if (!draft) return
    nav('/lessons/new')
  }

  const getFilteredSorted = (items: any[], type: 'lesson' | 'pres' | 'tests') => {
    let arr = [...items]
    if (filterSubject && type !== 'tests') {
      arr = arr.filter((x: any) => {
        const subjObj = subjects.find(s => String(s.id) === String(filterSubject) || s.slug === filterSubject)
        if (!subjObj) return true
        return (x.subject_name && x.subject_name === subjObj.name) || (x.subject_slug && x.subject_slug === subjObj.slug) || String(x.subject) === String(subjObj.id)
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter((x: any) => (x.title || '').toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q))
    }
    if (sort === 'new') arr.sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime())
    else if (sort === 'old') arr.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    else if (sort === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    return arr
  }

  if (!me) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-slate-500 dark:text-slate-400">
        {t('prof_loading')}
      </div>
    )
  }

  const filteredLessons = getFilteredSorted(myLessons, 'lesson')
  const filteredPres = getFilteredSorted(myPres, 'pres')
  const filteredTests = getFilteredSorted(myTests, 'tests')
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ').trim()
  const roleMeta = me.role === 'admin' || me.is_staff
    ? { label: t('admin_role'), cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' }
    : me.role === 'teacher'
      ? { label: t('login_teacher'), cls: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/70' }
      : me.role === 'parent'
        ? { label: t('users_parent'), cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' }
        : { label: t('login_student'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/70' }

  const rawBannerUrl = me.banner ? mediaSrc(me.banner) : ''
  const rawAvatarUrl = me.avatar ? mediaSrc(me.avatar) : ''
  const bannerUrl = rawBannerUrl && !bannerImgBroken
    ? `${rawBannerUrl}${rawBannerUrl.includes('?') ? '&' : '?'}v=${mediaVersion}`
    : ''
  const avatarUrl = rawAvatarUrl && !avatarImgBroken
    ? `${rawAvatarUrl}${rawAvatarUrl.includes('?') ? '&' : '?'}v=${mediaVersion}`
    : ''
  const activeBannerPos = bannerPosDraft ?? me.banner_position ?? 50
  const joinedLabel = me.date_joined ? new Date(me.date_joined).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Скрытые инпуты загрузки фото профиля и баннера */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) uploadAvatarFile(f)
        }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) uploadBannerFile(f)
        }}
      />

      {/* ==================== 1. ПРОФИЛЬ: СДЕРЖАННАЯ ОБЛОЖКА И АВАТАР ==================== */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Обложка профиля (без декоративных пятен и неона) */}
        <div
          data-a11y-banner={!bannerUrl ? '1' : undefined}
          onClick={() => setBannerModalOpen(true)}
          onDragOver={e => { e.preventDefault(); setBannerDragOver(true) }}
          onDragLeave={() => setBannerDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setBannerDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) uploadBannerFile(f)
          }}
          className={`relative h-32 sm:h-44 w-full overflow-hidden border-b border-slate-200/70 dark:border-slate-800 transition cursor-pointer group/bn ${bannerDragOver ? 'ring-2 ring-inset ring-blue-500' : ''}`}
          style={{ background: getBannerCss(me.banner_preset) }}
          title="Нажмите или перетащите картинку, чтобы изменить обложку"
        >
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt="Обложка профиля"
              onError={() => setBannerImgBroken(true)}
              className="w-full h-full object-cover"
              style={{ objectPosition: `50% ${activeBannerPos}%` }}
            />
          )}

          {bannerDragOver && (
            <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center text-white text-xs sm:text-sm font-medium gap-2 z-20">
              <Upload size={16} /> Отпустите файл, чтобы установить обложку
            </div>
          )}

          {uploadingBanner && (
            <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center text-white text-xs font-medium gap-2 z-20">
              <Loader2 size={16} className="animate-spin" /> Сохраняем обложку…
            </div>
          )}

          {/* Одна спокойная кнопка управления обложкой */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setBannerModalOpen(true) }}
            className="absolute bottom-3 right-3 z-10 px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-950/65 hover:bg-slate-950/85 text-white/95 border border-white/20 text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
          >
            <ImageIcon size={13} />
            <span>Обложка</span>
          </button>
        </div>

        {/* Тело шапки профиля */}
        <div className="px-4 sm:px-7 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 relative z-10">
            {/* Круглый аватар с аккуратной кнопкой камеры */}
            <div className="flex items-end gap-3.5">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (avatarUrl) setAvatarMenuOpen(v => !v)
                    else avatarInputRef.current?.click()
                  }}
                  disabled={uploadingAvatar}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-4 ring-white dark:ring-slate-900 bg-slate-800 dark:bg-slate-700 overflow-hidden group/av block focus:outline-none"
                  title="Изменить фото профиля"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={me.username}
                      onError={() => setAvatarImgBroken(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold select-none">
                      {(me.username || 'U')[0].toUpperCase()}
                    </span>
                  )}

                  {uploadingAvatar ? (
                    <span className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-white">
                      <Loader2 size={18} className="animate-spin" />
                    </span>
                  ) : (
                    <span className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover/av:opacity-100 transition flex items-center justify-center text-white">
                      <Camera size={18} />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (avatarUrl) setAvatarMenuOpen(v => !v)
                    else avatarInputRef.current?.click()
                  }}
                  aria-label="Изменить фото профиля"
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center transition"
                >
                  <Camera size={13} />
                </button>

                {avatarMenuOpen && (
                  <div
                    onMouseDown={e => e.stopPropagation()}
                    className="absolute left-0 top-full mt-2 z-40 w-48 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-1 space-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => { setAvatarMenuOpen(false); avatarInputRef.current?.click() }}
                      className="w-full px-3 py-2 min-h-[40px] rounded-lg text-left text-xs font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <Upload size={13} /> Загрузить фото
                    </button>
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="w-full px-3 py-2 min-h-[40px] rounded-lg text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                    >
                      <Trash2 size={13} /> Удалить фото
                    </button>
                  </div>
                )}
              </div>

              <div className="pb-1 sm:hidden">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${roleMeta.cls}`}>
                  {roleMeta.label}
                </span>
              </div>
            </div>

            {/* Спокойные кнопки действий */}
            <div className="flex flex-wrap items-center gap-2 sm:pb-0.5">
              <button
                type="button"
                onClick={() => { setEdit(v => !v); setPwOpen(false) }}
                className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition ${edit
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                  }`}
              >
                <Edit size={14} /> {edit ? t('cancel') : t('edit')}
              </button>
              <button
                type="button"
                onClick={() => { setPwOpen(v => !v); setPwError(null); setEdit(false) }}
                className="px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
              >
                <KeyRound size={14} /> Пароль
              </button>
              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-2 min-h-[40px] rounded-xl bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
              >
                <LogOut size={14} /> {t('logout')}
              </button>
            </div>
          </div>

          {/* Имя, @username, роль, почта, ID и Bio */}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                {fullName || me.username}
              </h1>
              {fullName && (
                <span className="text-sm font-mono text-slate-500 dark:text-slate-400">@{me.username}</span>
              )}
              <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${roleMeta.cls}`}>
                {roleMeta.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 break-all">
                <Mail size={14} className="text-slate-400 shrink-0" />
                {me.email || t('prof_no_email')}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <User size={14} className="text-slate-400 shrink-0" />
                ID {me.id}
              </span>
              {joinedLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  С {joinedLabel}
                </span>
              )}
            </div>

            {me.bio ? (
              <p className="mt-2 pt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-w-2xl">
                {me.bio}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setEdit(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
              >
                + Добавить информацию о себе
              </button>
            )}
          </div>

          {/* Раскрываемая форма редактирования профиля прямо внутри карточки */}
          {edit && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <User size={16} className="text-indigo-500" /> Редактирование профиля
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <Camera size={12} /> Фото профиля
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <ImageIcon size={12} /> Баннер
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
                  ⚠ {saveError}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('prof_login')}</label>
                  <input
                    autoFocus
                    placeholder={t('profile_username_ph')}
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="text-[11px] text-slate-400 mt-1">{t('profile_username_hint')}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('prof_email')}</label>
                  <input
                    placeholder="Email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('prof_ph_name')}</label>
                  <input
                    placeholder={t('prof_ph_name')}
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('prof_ph_surname')}</label>
                  <input
                    placeholder={t('prof_ph_surname')}
                    value={form.last_name}
                    onChange={e => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('prof_about')}</label>
                <textarea
                  placeholder={t('prof_ph_about')}
                  value={form.bio}
                  onChange={e => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400">{t('prof_role_hint')}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEdit(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={savingProfile}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-sm"
                  >
                    {savingProfile ? 'Сохраняем…' : t('save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Раскрываемая форма смены пароля */}
          {pwOpen && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield size={16} className="text-indigo-500" /> {t('profile_password_t')}
                </h3>
                <button type="button" onClick={() => setPwOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">{t('cancel')}</button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile_password_hint')}</p>
              {pwError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
                  ⚠ {pwError}
                </div>
              )}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="relative">
                  <input autoFocus type={pwInputType} autoComplete="current-password" placeholder={t('profile_old_pw')} value={pw.old} onChange={e => setPw({ ...pw, old: e.target.value })} className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 outline-none" />
                  {pwEyeBtn(pwShow)}
                </div>
                <div className="relative">
                  <input type={pwInputType} autoComplete="new-password" placeholder={t('profile_new_pw')} value={pw.n1} onChange={e => setPw({ ...pw, n1: e.target.value })} className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 outline-none" />
                  {pwEyeBtn(pwShow)}
                </div>
                <div className="relative">
                  <input type={pwInputType} autoComplete="new-password" placeholder={t('profile_new_pw2')} value={pw.n2} onChange={e => setPw({ ...pw, n2: e.target.value })} className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-indigo-500 outline-none" />
                  {pwEyeBtn(pwShow)}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={pwBusy || !pw.old || !pw.n1}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {pwBusy ? '...' : t('profile_pw_save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 2. СТАТИСТИКА МАТЕРИАЛОВ (DARK-MODE NATIVE) ==================== */}
      {!hideTeacherTools && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 hover:border-indigo-400 dark:hover:border-indigo-500/60 transition flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('prof_my_lessons')}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.lessons}</div>
              <div className="flex items-center gap-3 mt-2.5">
                <button onClick={() => showAndScroll('lessons')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                  {t('prof_show')}
                </button>
                <Link to="/lessons/new" className="text-xs text-slate-400 hover:text-indigo-500 flex items-center gap-0.5 font-semibold">
                  <Plus size={12} /> Создать
                </Link>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers size={22} />
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 hover:border-orange-400 dark:hover:border-orange-500/60 transition flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('prof_my_pres')}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.pres}</div>
              <div className="flex items-center gap-3 mt-2.5">
                <button onClick={() => showAndScroll('presentations')} className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline">
                  {t('prof_show')}
                </button>
                <Link to="/presentations/new" className="text-xs text-slate-400 hover:text-orange-500 flex items-center gap-0.5 font-semibold">
                  <Plus size={12} /> Создать
                </Link>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Presentation size={22} />
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 hover:border-rose-400 dark:hover:border-rose-500/60 transition flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('prof_my_tests')}</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.tests}</div>
              <div className="flex items-center gap-3 mt-2.5">
                <button onClick={() => showAndScroll('tests')} className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline">
                  {t('prof_show')}
                </button>
                <Link to="/tests/new" className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-0.5 font-semibold">
                  <Plus size={12} /> Создать
                </Link>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <FlaskConical size={22} />
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. АДМИН-ПАНЕЛЬ (ТОЛЬКО ДЛЯ АДМИНА) ==================== */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Shield size={18} className="text-indigo-500" />{t('adm_panel_t')}</h2>
          <div className="flex gap-2 mt-3 flex-wrap" data-testid="adm-tabs">
            <button onClick={() => setAdmTab('create')} className={`px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${admTab === 'create' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}><UserPlus size={14} />{t('adm_tab_accounts')}</button>
            <button onClick={() => { setAdmTab('users'); setUsersOpen(true) }} className={`px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${admTab === 'users' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}><Users size={14} />{t('adm_tab_users')}</button>
            <button onClick={() => { setAdmTab('parents'); setParentsOpen(true) }} className={`px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${admTab === 'parents' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>👪 {t('adm_tab_parents')}</button>
          </div>

          {admTab === 'create' && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{asstRole === 'teacher' ? t('assistants_hint_teacher') : t('assistants_hint')}</p>
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('assistant_role_label')}</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setAsstRole('teacher')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${asstRole === 'teacher' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>🎓 {t('assistant_role_teacher')}</button>
                  <button onClick={() => setAsstRole('assistant')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${asstRole === 'assistant' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>🛡 {t('assistant_role_admin')}</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <input value={asst.username} onChange={e => setAsst({ ...asst, username: e.target.value })} placeholder={asstRole === 'teacher' ? t('assistant_username_teacher_ph') : t('assistant_username_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                <input value={asst.first_name} onChange={e => setAsst({ ...asst, first_name: e.target.value })} placeholder={t('assistant_name_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                <input type="password" value={asst.password} onChange={e => setAsst({ ...asst, password: e.target.value })} placeholder={t('assistant_pass_ph')} className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                <button onClick={createAssistant} disabled={asstBusy} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">{asstBusy ? '...' : (asstRole === 'teacher' ? t('assistant_create_teacher') : t('assistant_create'))}</button>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">{t('acct_created_note')}</div>
            </div>
          )}

          {admTab === 'users' && (
            <div className="mt-4">
              <div className="flex gap-1.5 flex-wrap" data-testid="users-role-tabs">
                {(['all', 'student', 'teacher', 'admin', 'parent'] as const).map(rt => (
                  <button key={rt} onClick={() => setUsersTab(rt)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition ${usersTab === rt ? 'bg-slate-800 dark:bg-indigo-600 text-white border-slate-800 dark:border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>
                    {t(rt === 'all' ? 'users_tab_all' : rt === 'student' ? 'users_tab_students' : rt === 'teacher' ? 'users_tab_teachers' : rt === 'admin' ? 'users_tab_admins' : 'users_tab_parents')} {usersCounts[rt] ?? '…'}
                  </button>
                ))}
              </div>
              <input value={usersQ} onChange={e => setUsersQ(e.target.value)} placeholder={t('users_search_ph')} className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm mt-2" />
              <div className="mt-2 max-h-[300px] overflow-y-auto rounded-xl border dark:border-slate-700 divide-y dark:divide-slate-800" data-testid="users-list">
                {usersFiltered.map(u => (
                  <div key={u.id} className="bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="font-semibold text-sm dark:text-white flex-1 min-w-0 truncate">{u.username}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${u.role === 'admin' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : u.role === 'teacher' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : u.role === 'parent' ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{t(ROLE_LABEL[u.role] || 'admin_role')}</span>
                      {String(u.username).toLowerCase() === String(me?.username || '').toLowerCase() ? (
                        <span className="text-[10px] text-slate-400 shrink-0 px-1">{t('users_you')}</span>
                      ) : (
                        <>
                          <button onClick={() => { setPwFor(pwFor === u.username ? null : u.username); setPwShowU(true) }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 shrink-0" title={t('users_pw_set')} aria-label={`${t('users_pw_set')} ${u.username}`}>
                            <KeyRound size={13} />
                          </button>
                          {canDeleteRow(u)
                            ? <button onClick={() => deleteUser(u.username)} disabled={delBusy} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 disabled:opacity-40 shrink-0" title={t('admin_del_user_btn')} aria-label={`${t('admin_del_user_btn')} ${u.username}`}><Trash2 size={13} /></button>
                            : <span className="text-[11px] text-slate-300 dark:text-slate-600 shrink-0" title={u.is_superuser ? t('del_superuser_note') : t('del_user_staff_warn')}>🔒</span>}
                        </>
                      )}
                    </div>
                    {pwFor === u.username && (
                      <div className="px-3 pb-2">
                        <div className="flex items-center gap-2">
                          <input autoFocus type={pwShowU ? 'text' : 'password'} value={pwVal} onChange={e => { setPwVal(e.target.value); setPwDoneNick(null) }} onKeyDown={e => e.key === 'Enter' && setUserPassword(u.username)} placeholder={t('users_pw_ph')} className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-mono" />
                          <button onClick={() => setPwShowU(v => !v)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0" title={pwShowU ? t('pw_hide') : t('pw_show')}>
                            {pwShowU ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button onClick={() => { if (pwVal) { try { navigator.clipboard.writeText(pwVal); toast(t('pw_copied'), 'success') } catch { toast(pwVal, 'success') } } }} disabled={!pwVal} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 disabled:opacity-40" title={t('pw_copy')}>
                            📋
                          </button>
                          <button onClick={() => setUserPassword(u.username)} disabled={upwBusy || pwVal.length < 8} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 shrink-0">{upwBusy ? '...' : t('users_pw_apply')}</button>
                          <button onClick={() => { setPwFor(null); setPwVal(''); setPwDoneNick(null) }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 shrink-0" title={t('close')}>✕</button>
                        </div>
                        {pwDoneNick === u.username && (
                          <div className="text-[11px] mt-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✅ {t('users_pw_done').replace('{nick}', u.username)} — {t('pw_note_now')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {usersFiltered.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-400">{t('users_empty')}</div>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5">{t('users_hint')}</div>
              <div className="mt-4 pt-3 border-t dark:border-slate-800">
                <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white"><Trash2 size={15} className="text-red-600" />{t('admin_del_user_t')}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <div className="flex-1 min-w-[160px]">
                    <input value={delNick} onChange={e => setDelNick(e.target.value)} placeholder={t('admin_del_user_ph')} className="w-full px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                    {delNick.trim().length >= 2 && delFound !== undefined && (
                      delFound ? (
                        <div className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap" data-testid="del-user-found">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"><Check size={13} />{t('del_user_found')}: <b className="dark:text-white">{delFound.username}</b></span>
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">{t(ROLE_LABEL[delFound.role] || 'admin_role')}</span>
                          {(delFound.role === 'admin') && <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"><Shield size={12} />{t('del_user_staff_warn')}</span>}
                        </div>
                      ) : (
                        <div className="text-xs mt-1.5 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1" data-testid="del-user-notfound"><XIcon size={13} />{t('del_user_notfound')}</div>
                      )
                    )}
                  </div>
                  <button onClick={() => deleteUser()} disabled={delBusy || !delNick.trim()} className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1"><Trash2 size={14} />{delBusy ? '...' : t('admin_del_user_btn')}</button>
                </div>
              </div>
            </div>
          )}

          {admTab === 'parents' && (
            <div className="mt-4">
              <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white"><UserPlus size={15} className="text-violet-600" />{t('parents_create_t')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('parents_create_hint')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <input value={par.username} onChange={e => setPar({ ...par, username: e.target.value })} placeholder={t('parents_nick_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                <input value={par.first_name} onChange={e => setPar({ ...par, first_name: e.target.value })} placeholder={t('assistant_name_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                <input type="password" value={par.password} onChange={e => setPar({ ...par, password: e.target.value })} placeholder={t('assistant_pass_ph')} className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                <button onClick={createParent} disabled={parBusy} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50">{parBusy ? '...' : t('parents_create_btn')}</button>
              </div>
              <div className="mt-4 pt-3 border-t dark:border-slate-800">
                <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white">🔗 {t('parents_link_t')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('parents_link_hint')}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <input value={linkParent} onChange={e => setLinkParent(e.target.value)} placeholder={t('parents_link_ph_parent')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                  <input value={linkStudent} onChange={e => setLinkStudent(e.target.value)} placeholder={t('parents_link_ph_student')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                  <button onClick={() => doLink('link')} disabled={linkBusy} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">{linkBusy ? '...' : t('parents_link_btn')}</button>
                  <button onClick={() => doLink('unlink')} disabled={linkBusy} className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 dark:text-white hover:bg-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-50">{t('parents_unlink_btn')}</button>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white">👪 {t('parents_list_t')}</h3>
                  <button onClick={() => { setParentsOpen(v => !v); if (!parentsOpen) loadParents() }} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30" data-testid="parents-toggle">
                    {parentsOpen ? t('close') : `${t('open')} (${parentsList?.length ?? '…'})`}
                  </button>
                </div>
                {parentsOpen && (
                  <div className="mt-2 space-y-1.5 max-h-[300px] overflow-y-auto" data-testid="parents-list">
                    {(parentsList || []).map(p => (
                      <div key={p.id} className="px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm dark:text-white">{p.username}</span>
                          {p.first_name && <span className="text-xs text-slate-500 dark:text-slate-400">({p.first_name})</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold">{t('users_parent')}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('parents_children')}:</span>
                          {(p.children || []).length === 0 && <span className="text-[11px] text-slate-400 italic">{t('parents_no_children')}</span>}
                          {(p.children || []).map((ch: any) => (
                            <span key={ch.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border dark:border-slate-700 text-[11px] font-semibold dark:text-white">
                              🧒 {ch.username}
                              <button onClick={() => { setLinkParent(p.username); setLinkStudent(ch.username); doLink('unlink') }} disabled={linkBusy} className="text-slate-400 hover:text-red-600" title={t('parents_unlink_btn')}>✕</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {parentsList && parentsList.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-400">{t('parents_none')}</div>}
                  </div>
                )}
                <div className="text-[11px] text-slate-400 mt-1.5">{t('parents_hint')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 4. ВКЛАДКИ МАТЕРИАЛОВ (DARK-MODE NATIVE) ==================== */}
      <div ref={tabsRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden scroll-mt-4 shadow-sm">
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto tab-scroll">
          {!hideTeacherTools && (
            <>
              <button onClick={() => setTab('lessons')} className={`shrink-0 px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === 'lessons' ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><BookOpen size={16} /> {t('prof_tab_lessons')} ({myLessons.length})</button>
              <button onClick={() => setTab('presentations')} className={`shrink-0 px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === 'presentations' ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-b-2 border-orange-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><Presentation size={16} /> {t('prof_tab_pres')} ({myPres.length})</button>
              <button onClick={() => setTab('tests')} className={`shrink-0 px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === 'tests' ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-b-2 border-rose-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><FlaskConical size={16} /> {t('prof_tab_tests')} ({myTests.length})</button>
              <button onClick={() => setTab('draft')} className={`shrink-0 px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === 'draft' ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-b-2 border-amber-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>📝 {t('prof_tab_draft')} {(draft || myPresDrafts.length) ? `• ${myPresDrafts.length + (draft ? 1 : 0)}` : ''}</button>
            </>
          )}
          <button onClick={() => setTab('notes')} className={`shrink-0 px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === 'notes' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><StickyNote size={16} /> {t('prof_tab_notes')}</button>
          {!hideTeacherTools && (
            <button onClick={() => setTab('games')} className={`shrink-0 px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === 'games' ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><Gamepad2 size={16} /> {t('prof_tab_games')} ({myTests.length})</button>
          )}
        </div>

        {(tab === 'lessons' || tab === 'presentations' || tab === 'tests' || tab === 'draft') && (
          <div className="p-3.5 flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 min-w-[180px] w-full sm:w-auto">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === 'lessons' ? t('prof_search_lessons') : tab === 'presentations' ? t('prof_search_pres') : tab === 'tests' ? t('prof_search_tests') : t('prof_search_all')}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <Filter size={14} className="text-slate-400 shrink-0" />
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm min-w-0">
                <option value="">{t('prof_all_subjects')}</option>
                {subjects.map((s: any) => <option key={s.id} value={String(s.id)}>{s.icon} {s.name}</option>)}
              </select>
              <select value={sort} onChange={e => setSort(e.target.value as any)} className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm min-w-0">
                <option value="new">{t('prof_new')}</option>
                <option value="old">{t('prof_old')}</option>
                <option value="title">{t('prof_by_title')}</option>
              </select>
            </div>
          </div>
        )}

        <div className="p-4">
          {tab === 'draft' ? (
            <div className="space-y-4">
              {draft ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-amber-900 dark:text-amber-200">{t('prof_draft_local')}</div>
                      <div className="text-sm text-amber-800 dark:text-amber-300 mt-1">{t('prof_name_is')} <b>{draft.title || '—'}</b></div>
                      <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t('prof_subject')} {subjects.find(s => String(s.id) === String(draft.subject))?.name || '—'} • {t('prof_blocks')} {draft.blocks?.length || 0} • {new Date(draft.ts).toLocaleString()}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('prof_draft_stored')}</div>
                    </div>
                    <span className="text-2xl">📝</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={restoreDraft} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold">{t('prof_restore')}</button>
                    <button onClick={deleteDraft} className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-1"><Trash2 size={14} /> {t('prof_del_draft')}</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">{t('prof_no_drafts')}</div>
              )}

              <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-orange-900 dark:text-orange-200">{t('prof_pres_drafts')} ({myPresDrafts.length})</div>
                  <span className="text-xs text-orange-700 dark:text-orange-300">{t('prof_drafts_hint')}</span>
                </div>
                {myPresDrafts.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t('prof_no_pres_drafts')}</div>
                ) : (
                  <div className="grid gap-2">
                    {myPresDrafts.map((p: any) => (
                      <div key={p.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{p.title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t('prof_draft_word')} • {new Date(p.updated_at).toLocaleDateString()} • {p.slides_count ?? p.slides?.length ?? '?'} {t('prof_slides')} • {p.subject_name || t('lessons_no_subject')}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Link to={`/presentations/${p.id}`} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"><Eye size={16} /></Link>
                          <Link to={`/presentations/${p.id}/edit`} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center">{t('prof_finish')}</Link>
                          <button onClick={async () => { if (!confirm(t('prof_del_draft2'))) return; try { await client.delete(`/presentations/${p.id}/`); setMyPresDrafts(prev => prev.filter(x => x.id !== p.id)); toast(t('prof_draft_deleted'), 'success') } catch { toast(t('prof_failed'), 'error') } }} className="p-2 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'lessons' ? (
            filteredLessons.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_lessons')}{filterSubject || search ? t('prof_by_filter') : ''}</div>
                <Link to="/lessons/new" className="text-indigo-600 dark:text-indigo-400 underline text-sm mt-2 inline-block">{t('prof_create_lesson')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredLessons.map((l: any) => (
                  <div key={l.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-3 transition">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{l.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{l.subject_name || t('lessons_no_subject')}</span>
                        <span>{new Date(l.created_at).toLocaleDateString()}</span>
                        <span>• {l.blocks?.length || 0} {t('lessons_blocks')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Link to={`/lessons/${l.id}`} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"><Eye size={16} /></Link>
                      <Link to={`/lessons/${l.id}/edit`} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"><Edit size={16} /></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === 'presentations' ? (
            filteredPres.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_pres')}{filterSubject || search ? t('prof_by_filter') : ''}</div>
                <Link to="/presentations/new" className="text-orange-600 dark:text-orange-400 underline text-sm mt-2 inline-block">{t('prof_create_pres')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredPres.map((p: any) => (
                  <div key={p.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-3 transition">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{p.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{p.subject_name || t('lessons_no_subject')}</span>
                        <span>{new Date(p.updated_at || p.created_at).toLocaleDateString()}</span>
                        <span>• {p.slides_count ?? p.slides?.length ?? 0} {t('pres_slides')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Link to={`/presentations/${p.id}`} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"><Eye size={16} /></Link>
                      <Link to={`/presentations/${p.id}/edit`} className="p-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white"><Edit size={16} /></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === 'tests' ? (
            filteredTests.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_tests')}{search ? t('prof_by_filter') : ''}</div>
                <Link to="/tests/new" className="text-rose-600 dark:text-rose-400 underline text-sm mt-2 inline-block">{t('prof_create_test')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTests.map((it: any) => (
                  <div key={it.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-3 transition">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{it.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span>{new Date(it.created_at).toLocaleDateString()}</span>
                        <span>• {it.questions_count ?? it.questions?.length ?? 0} {t('tests_questions')}</span>
                      </div>
                      {it.description && <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">{it.description}</div>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Link to={`/tests/${it.id}`} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"><Eye size={16} /></Link>
                      <Link to={`/tests/${it.id}/edit`} className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white"><Edit size={16} /></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === 'notes' ? (
            <Notes />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-sm text-blue-900 dark:text-indigo-200">
                {t('prof_games_hint')}
              </div>
              {myTests.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">{student ? (<>{t('prof_no_quiz_student_a')} <Link to="/games" className="text-indigo-600 dark:text-indigo-400 underline">{t('games')}</Link>.</>) : t('prof_no_quiz')}</div>
              ) : (
                <div className="grid gap-2">
                  {myTests.map((it: any) => (
                    <div key={it.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">{it.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{it.questions_count ?? it.questions?.length ?? 0} {t('tests_questions')}</div>
                      </div>
                      <button onClick={() => nav(`/games/arkan?test=${it.id}`)} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-1 shrink-0">
                        <Play size={15} /> {t('prof_play')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!student && (
                <div>
                  <div className="font-bold mb-2 flex items-center gap-2 text-slate-900 dark:text-white"><Gamepad2 size={17} /> {t('prof_new_quiz')}</div>
                  <QuizBuilder lessons={myLessons} onSaved={q => { setMyTests(prev => [{ id: q.id, title: q.title, questions: q.questions }, ...prev]); setStats(s => ({ ...s, tests: s.tests + 1 })); toast(t('prof_quiz_saved'), 'success') }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== 5. РЕЗЕРВНЫЕ КОПИИ И ВНЕДРЕНИЕ ==================== */}
      {!hideTeacherTools && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-3" data-testid="deployment-readiness-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDeployOpen(v => !v)}
              className="font-semibold text-sm flex items-center gap-2 text-slate-900 dark:text-white text-left"
            >
              <FileText size={15} className="text-slate-400" />
              <span>Резервные копии и памятка учителя</span>
              {deployOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
            </button>
            <BackupRestoreActions isAdmin={isAdmin} />
          </div>

          {deployOpen && (
            <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white mb-1">1. Простой перенос (за 5 минут)</div>
                Учебная программа КР загружается в 1 клик в разделе <Link to="/programs" className="text-indigo-500 underline">Учебная программа</Link>. Списки учеников и расписание вставляются прямо из Excel/CSV внутри класса.
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white mb-1">2. ИИ-помощник и аналитика</div>
                В разделе <Link to="/ai-assistant" className="text-indigo-500 underline">ИИ-помощник</Link> учитель видит оценки каждого ученика, кого нужно подтянуть, советы и генерирует черновики заданий.
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white mb-1">3. Работа при слабом интернете</div>
                Платформа адаптирована под телефоны и автоматически сохраняет загруженные страницы в память устройства при перебоях со связью.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
        {t('prof_global')}
      </div>

      {/* ==================== МОДАЛКА ОБЛОЖКИ И ФОТО ПРОФИЛЯ (СПОКОЙНЫЙ ДИЗАЙН) ==================== */}
      {bannerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setBannerModalOpen(false) }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-semibold text-sm text-slate-900 dark:text-white">
                Обложка и фото профиля
              </div>
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Чистый предпросмотр */}
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <div
                  className="h-28 relative overflow-hidden"
                  style={{ background: getBannerCss(me.banner_preset) }}
                >
                  {bannerUrl && (
                    <img
                      src={bannerUrl}
                      alt=""
                      onError={() => setBannerImgBroken(true)}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `50% ${activeBannerPos}%` }}
                    />
                  )}
                </div>
                <div className="px-4 pb-3 bg-white dark:bg-slate-900 flex items-end gap-3 -mt-7 relative z-10">
                  <div className="w-14 h-14 rounded-full ring-4 ring-white dark:ring-slate-900 bg-slate-800 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {avatarUrl ? <img src={avatarUrl} alt="" onError={() => setAvatarImgBroken(true)} className="w-full h-full object-cover" /> : (me.username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="pb-0.5 min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{fullName || me.username}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">@{me.username}</div>
                  </div>
                </div>
              </div>

              {/* Загрузка своих изображений */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Изображение обложки</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploadingBanner}
                      className="flex-1 py-2 px-3 min-h-[40px] rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {uploadingBanner ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      Загрузить
                    </button>
                    {bannerUrl && (
                      <button
                        type="button"
                        onClick={removeBannerImage}
                        disabled={uploadingBanner}
                        className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                        title="Удалить обложку"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Фото профиля</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex-1 py-2 px-3 min-h-[40px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                      Выбрать
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={uploadingAvatar}
                        className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                        title="Удалить фото"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Кадрирование обложки */}
              {bannerUrl && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-200">
                    <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} className="text-slate-400" /> Позиция обложки по вертикали</span>
                    <span className="font-mono text-slate-500">{activeBannerPos}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={activeBannerPos}
                    onChange={e => setBannerPosDraft(Number(e.target.value))}
                    onMouseUp={e => saveBannerPosition(Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={e => saveBannerPosition(Number((e.target as HTMLInputElement).value))}
                    className="w-full accent-slate-900 dark:accent-white"
                  />
                </div>
              )}

              {/* Спокойные цвета обложки */}
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Или выберите фоновый цвет обложки
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {BANNER_PRESETS.map(pr => {
                    const active = !bannerUrl && normalizeBannerPreset(me.banner_preset) === pr.id
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => selectBannerPreset(pr.id)}
                        className={`h-11 rounded-lg relative overflow-hidden border transition ${active ? 'border-slate-900 dark:border-white ring-2 ring-slate-400/50' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        style={{ background: pr.css }}
                        title={pr.name}
                      >
                        <span className="absolute bottom-1 left-1.5 text-[10px] font-medium text-white/90">
                          {pr.name}
                        </span>
                        {active && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-slate-900 flex items-center justify-center">
                            <Check size={10} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="px-5 py-2 min-h-[40px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
