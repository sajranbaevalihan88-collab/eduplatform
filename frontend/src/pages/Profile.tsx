import { useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { User, Mail, Shield, BookOpen, Layers, Presentation, FlaskConical, LogOut, Trash2, Eye, EyeOff, Edit, Search, Filter, Gamepad2, Play, StickyNote, UserPlus, Users, Check, X as XIcon, KeyRound } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from '../context/UIContext'
import Notes from './Notes'
import QuizBuilder from '../components/QuizBuilder'
import { useLang } from '../context/LangContext'

export default function Profile(){
  const {t}=useLang()
  const nav=useNavigate()
  const [me,setMe]=useState<any>(null)
  const [stats,setStats]=useState({lessons:0,pres:0,tests:0})
  const [edit,setEdit]=useState(false)
  const [form,setForm]=useState({username:'',first_name:'',last_name:'',bio:'',email:''})
  const [myLessons,setMyLessons]=useState<any[]>([])
  const [myPres,setMyPres]=useState<any[]>([])
  const [myPresDrafts,setMyPresDrafts]=useState<any[]>([])
  const [myTests,setMyTests]=useState<any[]>([])
  const [subjects,setSubjects]=useState<any[]>([])
  const [tab,setTab]=useState<'lessons'|'presentations'|'tests'|'draft'|'notes'|'games'>('lessons')
  const [filterSubject,setFilterSubject]=useState<string>('')
  const [sort,setSort]=useState<'new'|'old'|'title'>('new')
  const [search,setSearch]=useState('')
  const [draft,setDraft]=useState<any>(null)
  const tabsRef=useRef<HTMLDivElement|null>(null)
  const showAndScroll=(t:'lessons'|'presentations'|'tests')=>{
    setTab(t)
    requestAnimationFrame(()=>{ tabsRef.current?.scrollIntoView({behavior:'smooth', block:'start'}) })
  }
  // Помощники: админ создаёт аккаунты (логин+пароль), помощник заходит на обычной странице входа
  const isAdmin=!!me && (me.role==='admin'||me.is_staff)
  const [asst,setAsst]=useState({username:'',password:'',first_name:''})
  const [asstRole,setAsstRole]=useState<'teacher'|'assistant'>('teacher')
  const [asstBusy,setAsstBusy]=useState(false)
  const createAssistant=async()=>{
    if(asstBusy) return
    if(asst.username.trim().length<3){ toast(t('assistant_err_short'),'error'); return }
    if(asst.password.length<8){ toast(t('assistant_err_pass'),'error'); return }
    setAsstBusy(true)
    try{
      await client.post('/auth/create-assistant/',{username:asst.username.trim(),password:asst.password,first_name:asst.first_name.trim(),role:asstRole})
      toast(t(asstRole==='teacher'?'assistant_created_teacher':'assistant_created'),'success')
      setAsst({username:'',password:'',first_name:''})
    }catch(e:any){
      toast(e?.response?.data?.error||e?.response?.data?.detail||t('error'),'error')
    }
    setAsstBusy(false)
  }
  // Удаление аккаунта по нику (только админ) + живая проверка «существует ли аккаунт»
  const [delNick,setDelNick]=useState('')
  const [delBusy,setDelBusy]=useState(false)
  const [usersList,setUsersList]=useState<any[]|null>(null)
  const [usersOpen,setUsersOpen]=useState(false)
  const [usersQ,setUsersQ]=useState('')
  const delFound=useMemo(()=>{
    const q=delNick.trim().toLowerCase()
    if(!usersList || q.length<2) return undefined
    return usersList.find((x:any)=>x.username.toLowerCase()===q) || null
  },[delNick, usersList])
  useEffect(()=>{
    if(!isAdmin || usersList) return
    client.get('/auth/users/').then(r=>setUsersList(Array.isArray(r.data)?r.data:[])).catch(()=>setUsersList([]))
  },[isAdmin])
  // Админ-панель: вкладки «Аккаунты», «Пользователи», «Родители»
  const [admTab,setAdmTab]=useState<'create'|'users'|'parents'>('create')
  // вкладка ролей в списке пользователей
  const [usersTab,setUsersTab]=useState<'all'|'student'|'teacher'|'admin'|'parent'>('all')
  // --- Родители: привязка ребёнка ---
  const [parentsList,setParentsList]=useState<any[]|null>(null)
  const [parentsOpen,setParentsOpen]=useState(false)
  const [linkParent,setLinkParent]=useState('')
  const [linkStudent,setLinkStudent]=useState('')
  const [linkBusy,setLinkBusy]=useState(false)
  const loadParents=()=>{
    client.get('/auth/parents/').then(r=>setParentsList(Array.isArray(r.data)?r.data:[])).catch(()=>setParentsList([]))
  }
  useEffect(()=>{ if(isAdmin && parentsOpen && parentsList===null) loadParents() },[isAdmin, parentsOpen])
  const refreshUsers=()=>client.get('/auth/users/').then(r=>setUsersList(Array.isArray(r.data)?r.data:[])).catch(()=>{})
  const doLink=async(action:'link'|'unlink')=>{
    if(linkBusy) return
    if(!linkParent.trim()||!linkStudent.trim()){ toast(t('parents_link_need_both'),'error'); return }
    setLinkBusy(true)
    try{
      await client.post('/auth/parents/link/',{parent_username:linkParent.trim(), student_username:linkStudent.trim(), action})
      toast(action==='link'? t('parents_linked_ok') : t('parents_unlinked_ok'),'success')
      if(action==='link'){ setLinkStudent('') }
      loadParents()
      refreshUsers()
    }catch(e:any){
      toast(e?.response?.data?.error||e?.response?.data?.detail||t('error'),'error')
    }
    setLinkBusy(false)
  }
  // Создание родительского аккаунта
  const [par,setPar]=useState({username:'',password:'',first_name:''})
  const [parBusy,setParBusy]=useState(false)
  const createParent=async()=>{
    if(parBusy) return
    if(par.username.trim().length<3){ toast(t('assistant_err_short'),'error'); return }
    if(par.password.length<8){ toast(t('assistant_err_pass'),'error'); return }
    setParBusy(true)
    try{
      await client.post('/auth/parents/create/',{username:par.username.trim(),password:par.password,first_name:par.first_name.trim()})
      toast(t('parents_created'),'success')
      setPar({username:'',password:'',first_name:''})
      loadParents(); refreshUsers()
    }catch(e:any){
      toast(e?.response?.data?.error||e?.response?.data?.detail||t('error'),'error')
    }
    setParBusy(false)
  }
  const usersGrouped=useMemo(()=>{
    if(!usersList) return []
    const q=usersQ.trim().toLowerCase()
    return usersList.filter(u=>{
      if(q && !u.username.toLowerCase().includes(q)) return false
      if(usersTab==='all') return true
      if(usersTab==='admin') return u.role==='admin'||u.is_superuser
      return u.role===usersTab
    })
  },[usersList, usersQ, usersTab])
  const usersCounts=useMemo(()=>{
    const c={all:0,student:0,teacher:0,admin:0,parent:0} as any
    for(const u of usersList||[]){
      c.all++
      if(u.role in c) c[u.role]++
      if(u.is_superuser && u.role!=='admin') c.admin++
    }
    return c
  },[usersList])
  const usersFiltered=useMemo(()=>usersGrouped,[usersGrouped])
  const ROLE_LABEL:any={admin:'admin_role', teacher:'login_teacher', student:'login_student', parent:'users_parent'}
  const canDeleteRow=(u:any)=>{
    const meName=(me?.username||'').toLowerCase()
    if(!meName || u.username.toLowerCase()===meName) return false
    if(u.is_superuser) return false
    if((u.is_staff || u.role==='admin') && !me?.is_superuser) return false
    return true
  }
  const deleteUser=async(nickArg?:string)=>{
    if(delBusy) return
    const nick=(nickArg ?? delNick).trim()
    if(!nick){ toast(t('admin_del_user_ph'),'error'); return }
    if(!nickArg && delFound===null){ toast(t('del_user_notfound'),'error'); return }
    if(!confirm(t('admin_del_user_confirm').replace('{nick}',nick))) return
    setDelBusy(true)
    try{
      await client.post('/auth/delete-user/',{username:nick})
      toast(t('admin_del_user_done'),'success')
      setDelNick('')
      setUsersList(prev=> prev? prev.filter((x:any)=>x.username.toLowerCase()!==nick.toLowerCase()) : prev)
      // тихий рефетч — чтобы список всегда сходился с сервером
      client.get('/auth/users/').then(r=>setUsersList(Array.isArray(r.data)?r.data:[])).catch(()=>{})
    }catch(e:any){
      toast(e?.response?.data?.error||e?.response?.data?.detail||t('error'),'error')
    }
    setDelBusy(false)
  }
  // Смена пароля пользователя (посмотреть чужой пароль нельзя — хеш; только задать новый)
  const [pwFor,setPwFor]=useState<string|null>(null)
  const [pwVal,setPwVal]=useState('')
  const [pwShowU,setPwShowU]=useState(true)
  const [pwDoneNick,setPwDoneNick]=useState<string|null>(null)
  const [upwBusy,setUpwBusy]=useState(false)
  const setUserPassword=async(nick:string)=>{
    if(upwBusy) return
    if(pwVal.length<8){ toast(t('assistant_err_pass'),'error'); return }
    setUpwBusy(true)
    try{
      await client.post('/auth/set-user-password/',{username:nick, new_password:pwVal})
      toast(t('users_pw_done').replace('{nick}',nick),'success')
      // строку НЕ закрываем: пароль, который ты сейчас задал, виден — запиши/скопируй
      setPwDoneNick(nick)
    }catch(e:any){
      toast(e?.response?.data?.error||e?.response?.data?.detail||t('error'),'error')
    }
    setUpwBusy(false)
  }

  const load=()=>{
    client.get('/auth/me/').then(r=>{
      setMe(r.data)
      setForm({username:r.data.username||'',first_name:r.data.first_name||'',last_name:r.data.last_name||'',bio:r.data.bio||'',email:r.data.email||''})
      // load subjects for filter
      client.get('/subjects/').then(rr=>{
        const arr=Array.isArray(rr.data)?rr.data: rr.data.results||[]
        setSubjects(arr)
      }).catch(()=>{})
      // check draft
      try{
        const rawDraft=localStorage.getItem('lesson-draft')
        if(rawDraft){
          const d=JSON.parse(rawDraft)
          // check if draft belongs to this user (if stored with owner, else assume current)
          // we store ts and check age 7 days
          const age=Date.now()-(d.ts||0)
          const hasContent=(d.title&&String(d.title).trim())||d.subject||(d.blocks&&d.blocks.length>1)
          if(hasContent && age<7*24*60*60*1000){
            setDraft(d)
            if(tab==='draft'){}
          } else {
            localStorage.removeItem('lesson-draft')
          }
        }
      }catch{}

      // stats + my content (owner=me) — презентации делим на опубликованные (is_public=true, не уроковые) и черновики (is_public=false)
      Promise.all([
        client.get('/lessons/?owner=me').then(r=>r.data.results||r.data).catch(()=> client.get('/lessons/').then(r=>r.data.results||r.data).catch(()=>[])),
        client.get('/presentations/?owner=me&is_public=true&is_lesson_private=false').then(r=>r.data.results||r.data).catch(()=> client.get('/presentations/?owner=me').then(r=>r.data.results||r.data).catch(()=>[])),
        client.get('/presentations/?owner=me&is_public=false').then(r=>r.data.results||r.data).catch(()=>[]),
        client.get('/tests/?owner=me').then(r=>r.data.results||r.data).catch(()=> client.get('/tests/').then(r=>r.data.results||r.data).catch(()=>[])),
      ]).then(([lessons,presPublished,presDrafts,tests])=>{
        const uid=r.data.id
        const filterOwner=(arr:any[])=> Array.isArray(arr)? arr.filter((x:any)=> String(x.owner)===String(uid) || String(x.owner_id)===String(uid)) : []
        let myL = Array.isArray(lessons)? (lessons.length && lessons[0]?.owner!==undefined ? lessons : filterOwner(lessons)) : []
        let myP = Array.isArray(presPublished)? (presPublished.length && presPublished[0]?.owner!==undefined ? presPublished.filter((x:any)=> String(x.owner)===String(uid) || String(x.owner_id)===String(uid) || String(x.owner)===String(uid)) : filterOwner(presPublished)) : []
        let myPDrafts = Array.isArray(presDrafts)? presDrafts.filter((x:any)=> String(x.owner)===String(uid) || String(x.owner_id)===String(uid)) : []
        let myT = Array.isArray(tests)? (tests.length && tests[0]?.owner!==undefined ? tests.filter((x:any)=> String(x.owner)===String(uid) || String(x.owner_id)===String(uid)) : filterOwner(tests)) : []
        if(myL.length===0 && Array.isArray(lessons) && lessons.length>0 && lessons[0]?.owner===undefined){
          myL = lessons
        }
        if(myP.length===0 && Array.isArray(presPublished) && presPublished.length>0 && presPublished[0]?.owner===undefined){
          myP = presPublished
        }
        if(myT.length===0 && Array.isArray(tests) && tests.length>0 && tests[0]?.owner===undefined){
          myT = tests
        }
        setMyLessons(myL)
        setMyPres(myP)
        setMyPresDrafts(myPDrafts)
        setMyTests(myT)
        setStats({
          lessons: myL.length,
          pres: myP.length,
          tests: myT.length,
        })
      })
    }).catch(()=>nav('/login'))
  }
  useEffect(()=>{load()},[])
  const student = me?.role === 'student'
  // ученику вкладки создания не показываем — перекидываем на заметки
  useEffect(()=>{
    if(student && (tab==='lessons'||tab==='presentations'||tab==='tests'||tab==='draft'||tab==='games')){
      setTab('notes')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[student])

  const [saveError,setSaveError]=useState<string|null>(null)
  const save=async()=>{
    setSaveError(null)
    if(form.email && !form.email.includes('@')){
      setSaveError(t('prof_email_err'))
      return
    }
    try{
      await client.patch('/auth/me/', form)
      const raw=localStorage.getItem('user')
      if(raw){
        const u=JSON.parse(raw)
        localStorage.setItem('user', JSON.stringify({...u, ...form}))
        window.dispatchEvent(new Event('auth-change'))
      }
      setEdit(false)
      load()
    }catch(e:any){
      const d=e?.response?.data||{}
      const msg=d.username?.[0] || d.email?.[0] || d.detail || JSON.stringify(d) || t('prof_save_err')
      setSaveError(msg)
    }
  }

  // Смена пароля: /auth/change-password/ (старый, новый, повтор) — на ответе обновляем JWT
  const [pw,setPw]=useState({old:'',n1:'',n2:''})
  const [pwShow,setPwShow]=useState(false)
  const pwInputType=pwShow?'text':'password'
  const pwEyeBtn=(showLabel:boolean)=>{
    return <button type="button" onClick={()=>setPwShow(v=>!v)} aria-label={showLabel ? t('login_hide_pass') : t('login_show_pass')} aria-pressed={showLabel}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 min-w-[36px] min-h-[36px] rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 flex items-center justify-center">
      {showLabel ? <EyeOff size={18}/> : <Eye size={18}/>}
    </button>
  }
  const [pwBusy,setPwBusy]=useState(false)
  const [pwError,setPwError]=useState<string|null>(null)
  const [pwOpen,setPwOpen]=useState(false)
  const changePassword=async()=>{
    setPwError(null)
    if(pw.n1!==pw.n2){ setPwError(t('profile_pw_mismatch')); return }
    setPwBusy(true)
    try{
      const r=await client.post('/auth/change-password/',{old_password:pw.old,new_password:pw.n1})
      if(r.data?.access) localStorage.setItem('access', r.data.access)
      if(r.data?.refresh) localStorage.setItem('refresh', r.data.refresh)
      setPw({old:'',n1:'',n2:''})
      setPwOpen(false)
      toast(t('profile_pw_changed'),'success')
    }catch(e:any){
      const d=e?.response?.data||{}
      setPwError(d.error || d.new_password?.[0] || d.detail || JSON.stringify(d) || t('error'))
    }
    setPwBusy(false)
  }

  const logout=()=>{
    localStorage.clear()
    window.dispatchEvent(new Event('auth-change'))
    nav('/login')
  }

  const deleteDraft=()=>{
    if(!confirm(t('prof_del_draft_confirm'))) return
    localStorage.removeItem('lesson-draft')
    setDraft(null)
  }
  const restoreDraft=()=>{
    if(!draft) return
    // we need to navigate to lesson builder with draft - the builder will auto-show banner, but we can also just go there
    nav('/lessons/new')
  }

  const getFilteredSorted=(items:any[], type:'lesson'|'pres'|'tests')=>{
    let arr=[...items]
    if(filterSubject && type!=='tests'){
      arr=arr.filter((x:any)=>{
        const subjObj=subjects.find(s=> String(s.id)===String(filterSubject) || s.slug===filterSubject)
        if(!subjObj) return true
        return (x.subject_name && x.subject_name===subjObj.name) || (x.subject_slug && x.subject_slug===subjObj.slug) || String(x.subject)===String(subjObj.id)
      })
    }
    if(search.trim()){
      const q=search.toLowerCase()
      arr=arr.filter((x:any)=> (x.title||'').toLowerCase().includes(q) || (x.description||'').toLowerCase().includes(q))
    }
    if(sort==='new') arr.sort((a,b)=> new Date(b.created_at||b.updated_at||0).getTime() - new Date(a.created_at||a.updated_at||0).getTime())
    else if(sort==='old') arr.sort((a,b)=> new Date(a.created_at||0).getTime() - new Date(b.created_at||0).getTime())
    else if(sort==='title') arr.sort((a,b)=> (a.title||'').localeCompare(b.title||''))
    return arr
  }

  if(!me) return <div className="text-center py-12">{t('prof_loading')}</div>

  const filteredLessons=getFilteredSorted(myLessons,'lesson')
  const filteredPres=getFilteredSorted(myPres,'pres')
  const filteredTests=getFilteredSorted(myTests,'tests')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-indigo-600 rounded-[24px] p-8 text-white relative overflow-hidden">
        <div className="flex gap-6 items-center relative">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold">{(me.username||'U')[0].toUpperCase()}</div>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">{me.username}</h1>
            <div className="text-white/80 flex flex-wrap gap-3 mt-1 text-sm">
              <span className="flex items-center gap-1"><Mail size={14}/>{me.email||t('prof_no_email')}</span>
              <span className="flex items-center gap-1"><User size={14}/>ID {me.id}</span>
            </div>
            {me.bio && <p className="mt-3 text-white/90 bg-white/10 rounded-xl p-3 text-sm">{me.bio}</p>}
          </div>
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-indigo-700 font-semibold"><LogOut size={16}/> {t('logout')}</button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-5">
          <h2 className="font-bold flex items-center gap-2 dark:text-white"><Shield size={18} className="text-indigo-600"/>{t('adm_panel_t')}</h2>
          {/* Вкладки админ-панели */}
          <div className="flex gap-2 mt-3 flex-wrap" data-testid="adm-tabs">
            <button onClick={()=>setAdmTab('create')} className={`px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${admTab==='create'?'bg-indigo-600 text-white border-indigo-600':'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}><UserPlus size={14}/>{t('adm_tab_accounts')}</button>
            <button onClick={()=>{setAdmTab('users'); setUsersOpen(true)}} className={`px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${admTab==='users'?'bg-indigo-600 text-white border-indigo-600':'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}><Users size={14}/>{t('adm_tab_users')}</button>
            <button onClick={()=>{setAdmTab('parents'); setParentsOpen(true)}} className={`px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${admTab==='parents'?'bg-indigo-600 text-white border-indigo-600':'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>👪 {t('adm_tab_parents')}</button>
          </div>

          {/* --- Вкладка 1: создание аккаунтов учителей/админов --- */}
          {admTab==='create' && (
            <div className="mt-4">
              <p className="text-xs text-slate-500">{asstRole==='teacher'? t('assistants_hint_teacher') : t('assistants_hint')}</p>
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-500 mb-1">{t('assistant_role_label')}</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={()=>setAsstRole('teacher')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${asstRole==='teacher'?'bg-indigo-600 text-white border-indigo-600':'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>🎓 {t('assistant_role_teacher')}</button>
                  <button onClick={()=>setAsstRole('assistant')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${asstRole==='assistant'?'bg-blue-700 text-white border-blue-700':'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>🛡 {t('assistant_role_admin')}</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <input value={asst.username} onChange={e=>setAsst({...asst,username:e.target.value})} placeholder={asstRole==='teacher'? t('assistant_username_teacher_ph') : t('assistant_username_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                <input value={asst.first_name} onChange={e=>setAsst({...asst,first_name:e.target.value})} placeholder={t('assistant_name_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                <input type="password" value={asst.password} onChange={e=>setAsst({...asst,password:e.target.value})} placeholder={t('assistant_pass_ph')} className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                <button onClick={createAssistant} disabled={asstBusy} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">{asstBusy?'...':(asstRole==='teacher'? t('assistant_create_teacher') : t('assistant_create'))}</button>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">{t('acct_created_note')}</div>
            </div>
          )}

          {/* --- Вкладка 2: список пользователей по вкладкам ролей --- */}
          {admTab==='users' && (
            <div className="mt-4">
              <div className="flex gap-1.5 flex-wrap" data-testid="users-role-tabs">
                {(['all','student','teacher','admin','parent'] as const).map(rt=>(
                  <button key={rt} onClick={()=>setUsersTab(rt)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition ${usersTab===rt?'bg-slate-800 dark:bg-indigo-600 text-white border-slate-800 dark:border-indigo-600':'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>
                    {t(rt==='all'?'users_tab_all':rt==='student'?'users_tab_students':rt==='teacher'?'users_tab_teachers':rt==='admin'?'users_tab_admins':'users_tab_parents')} {usersCounts[rt]??'…'}
                  </button>
                ))}
              </div>
              <input value={usersQ} onChange={e=>setUsersQ(e.target.value)} placeholder={t('users_search_ph')} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm mt-2"/>
              <div className="mt-2 max-h-[300px] overflow-y-auto rounded-xl border dark:border-slate-700 divide-y dark:divide-slate-800" data-testid="users-list">
                {usersFiltered.map(u=>(
                  <div key={u.id} className="bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="font-semibold text-sm dark:text-white flex-1 min-w-0 truncate">{u.username}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${u.role==='admin'?'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300':u.role==='teacher'?'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300':u.role==='parent'?'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{t(ROLE_LABEL[u.role]||'admin_role')}</span>
                      {String(u.username).toLowerCase()===String(me?.username||'').toLowerCase() ? (
                        <span className="text-[10px] text-slate-400 shrink-0 px-1">{t('users_you')}</span>
                      ) : (
                        <>
                          <button onClick={()=>{ setPwFor(pwFor===u.username? null : u.username); setPwShowU(true) }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 shrink-0" title={t('users_pw_set')} aria-label={`${t('users_pw_set')} ${u.username}`}>
                            <KeyRound size={13}/>
                          </button>
                          {canDeleteRow(u)
                            ? <button onClick={()=>deleteUser(u.username)} disabled={delBusy} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 disabled:opacity-40 shrink-0" title={t('admin_del_user_btn')} aria-label={`${t('admin_del_user_btn')} ${u.username}`}><Trash2 size={13}/></button>
                            : <span className="text-[11px] text-slate-300 dark:text-slate-600 shrink-0" title={u.is_superuser? t('del_superuser_note') : t('del_user_staff_warn')}>🔒</span>}
                        </>
                      )}
                    </div>
                    {pwFor===u.username && (
                      <div className="px-3 pb-2">
                        <div className="flex items-center gap-2">
                          <input autoFocus type={pwShowU? 'text':'password'} value={pwVal} onChange={e=>{setPwVal(e.target.value); setPwDoneNick(null)}} onKeyDown={e=>e.key==='Enter'&&setUserPassword(u.username)} placeholder={t('users_pw_ph')} className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-mono"/>
                          <button onClick={()=>setPwShowU(v=>!v)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0" title={pwShowU? t('pw_hide') : t('pw_show')} aria-label={pwShowU? t('pw_hide') : t('pw_show')}>
                            {pwShowU? <Eye size={13}/> : <EyeOff size={13}/>}
                          </button>
                          <button onClick={()=>{ if(pwVal){ try{ navigator.clipboard.writeText(pwVal); toast(t('pw_copied'),'success') }catch{ toast(pwVal,'success') } } }} disabled={!pwVal} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 disabled:opacity-40" title={t('pw_copy')} aria-label={t('pw_copy')}>
                            📋
                          </button>
                          <button onClick={()=>setUserPassword(u.username)} disabled={upwBusy||pwVal.length<8} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 shrink-0">{upwBusy?'...':t('users_pw_apply')}</button>
                          <button onClick={()=>{setPwFor(null); setPwVal(''); setPwDoneNick(null)}} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 shrink-0" title={t('close')}>✕</button>
                        </div>
                        {pwDoneNick===u.username && (
                          <div className="text-[11px] mt-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✅ {t('users_pw_done').replace('{nick}',u.username)} — {t('pw_note_now')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {usersFiltered.length===0 && <div className="px-3 py-4 text-center text-sm text-slate-400">{t('users_empty')}</div>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5">{t('users_hint')}</div>
              {/* Удаление по нику */}
              <div className="mt-4 pt-3 border-t dark:border-slate-800">
                <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white"><Trash2 size={15} className="text-red-600"/>{t('admin_del_user_t')}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <div className="flex-1 min-w-[160px]">
                    <input value={delNick} onChange={e=>setDelNick(e.target.value)} placeholder={t('admin_del_user_ph')} className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                    {delNick.trim().length>=2 && delFound!==undefined && (
                      delFound ? (
                        <div className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap" data-testid="del-user-found">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"><Check size={13}/>{t('del_user_found')}: <b className="dark:text-white">{delFound.username}</b></span>
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">{t(ROLE_LABEL[delFound.role]||'admin_role')}</span>
                          {(delFound.role==='admin') && <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"><Shield size={12}/>{t('del_user_staff_warn')}</span>}
                        </div>
                      ) : (
                        <div className="text-xs mt-1.5 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1" data-testid="del-user-notfound"><XIcon size={13}/>{t('del_user_notfound')}</div>
                      )
                    )}
                  </div>
                  <button onClick={()=>deleteUser()} disabled={delBusy||!delNick.trim()} className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1"><Trash2 size={14}/>{delBusy?'...':t('admin_del_user_btn')}</button>
                </div>
              </div>
            </div>
          )}

          {/* --- Вкладка 3: родители --- */}
          {admTab==='parents' && (
            <div className="mt-4">
              {/* Создание родителя */}
              <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white"><UserPlus size={15} className="text-violet-600"/>{t('parents_create_t')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('parents_create_hint')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <input value={par.username} onChange={e=>setPar({...par,username:e.target.value})} placeholder={t('parents_nick_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                <input value={par.first_name} onChange={e=>setPar({...par,first_name:e.target.value})} placeholder={t('assistant_name_ph')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                <input type="password" value={par.password} onChange={e=>setPar({...par,password:e.target.value})} placeholder={t('assistant_pass_ph')} className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                <button onClick={createParent} disabled={parBusy} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50">{parBusy?'...':t('parents_create_btn')}</button>
              </div>
              {/* Привязка ребёнка */}
              <div className="mt-4 pt-3 border-t dark:border-slate-800">
                <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white">🔗 {t('parents_link_t')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('parents_link_hint')}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <input value={linkParent} onChange={e=>setLinkParent(e.target.value)} placeholder={t('parents_link_ph_parent')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                  <input value={linkStudent} onChange={e=>setLinkStudent(e.target.value)} placeholder={t('parents_link_ph_student')} className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
                  <button onClick={()=>doLink('link')} disabled={linkBusy} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">{linkBusy?'...':t('parents_link_btn')}</button>
                  <button onClick={()=>doLink('unlink')} disabled={linkBusy} className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 dark:text-white hover:bg-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-50">{t('parents_unlink_btn')}</button>
                </div>
              </div>
              {/* Список родителей + дети */}
              <div className="mt-4 pt-3 border-t dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm flex items-center gap-2 dark:text-white">👪 {t('parents_list_t')}</h3>
                  <button onClick={()=>{setParentsOpen(v=>!v); if(!parentsOpen) loadParents()}} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30" data-testid="parents-toggle">
                    {parentsOpen? t('close') : `${t('open')} (${parentsList?.length ?? '…'})`}
                  </button>
                </div>
                {parentsOpen && (
                  <div className="mt-2 space-y-1.5 max-h-[300px] overflow-y-auto" data-testid="parents-list">
                    {(parentsList||[]).map(p=>(
                      <div key={p.id} className="px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm dark:text-white">{p.username}</span>
                          {p.first_name && <span className="text-xs text-slate-500 dark:text-slate-400">({p.first_name})</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold">{t('users_parent')}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('parents_children')}:</span>
                          {(p.children||[]).length===0 && <span className="text-[11px] text-slate-400 italic">{t('parents_no_children')}</span>}
                          {(p.children||[]).map((ch:any)=>(
                            <span key={ch.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border dark:border-slate-700 text-[11px] font-semibold dark:text-white">
                              🧒 {ch.username}
                              <button onClick={()=>{ setLinkParent(p.username); setLinkStudent(ch.username); doLink('unlink') }} disabled={linkBusy} className="text-slate-400 hover:text-red-600" title={t('parents_unlink_btn')}>✕</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {parentsList && parentsList.length===0 && <div className="px-3 py-4 text-center text-sm text-slate-400">{t('parents_none')}</div>}
                  </div>
                )}
                <div className="text-[11px] text-slate-400 mt-1.5">{t('parents_hint')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {!student && (
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5 text-center">
          <Layers className="mx-auto text-indigo-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.lessons}</div>
          <div className="text-sm text-slate-500">{t('prof_my_lessons')}</div>
          <button onClick={()=>showAndScroll('lessons')} className="text-xs text-indigo-600 font-semibold mt-2 inline-block">{t('prof_show')}</button>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <Presentation className="mx-auto text-orange-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.pres}</div>
          <div className="text-sm text-slate-500">{t('prof_my_pres')}</div>
          <button onClick={()=>showAndScroll('presentations')} className="text-xs text-indigo-600 font-semibold mt-2 inline-block">{t('prof_show')}</button>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <FlaskConical className="mx-auto text-rose-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.tests}</div>
          <div className="text-sm text-slate-500">{t('prof_my_tests')}</div>
          <button onClick={()=>showAndScroll('tests')} className="text-xs text-indigo-600 font-semibold mt-2 inline-block">{t('prof_show')}</button>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><User size={18}/> {t('profile')}</h3>
          <button onClick={()=>setEdit(!edit)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{edit?t('cancel'):t('edit')}</button>
        </div>
        {!edit ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-slate-500">{t('prof_login')}</span><span className="font-semibold">{me.username}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-slate-500">{t('prof_email')}</span><span className="font-semibold">{me.email||'—'}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-slate-500">{t('prof_name')}</span><span className="font-semibold">{me.first_name||'—'} {me.last_name||''}</span></div>
            <div className="py-2"><div className="text-slate-500">{t('prof_about')}</div><div className="mt-1 p-3 rounded-xl bg-slate-50 min-h-[60px]">{me.bio||t('prof_about_ph')}</div></div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {saveError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">⚠ {saveError}</div>}
            <div>
              <input autoFocus placeholder={t('profile_username_ph')} value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
              <div className="text-xs text-slate-500 mt-1">{t('profile_username_hint')}</div>
            </div>
            <input placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder={t('prof_ph_name')} value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
              <input placeholder={t('prof_ph_surname')} value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
            </div>
            <textarea placeholder={t('prof_ph_about')} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={3} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
            <button onClick={save} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-600">{t('save')}</button>
            <div className="text-xs text-slate-500 text-center">{t('prof_role_hint')}</div>
          </div>
        )}
      </div>

      {/* Настройки аккаунта: смена пароля */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><Shield size={18}/> {t('profile_password_t')}</h3>
          <button onClick={()=>{setPwOpen(!pwOpen); setPwError(null)}} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{pwOpen?t('cancel'):t('profile_pw_change')}</button>
        </div>
        {!pwOpen ? (
          <p className="mt-3 text-sm text-slate-500">{t('profile_password_hint')}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pwError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">⚠ {pwError}</div>}
            <div className="relative">
              <input autoFocus type={pwInputType} autoComplete="current-password" placeholder={t('profile_old_pw')} value={pw.old} onChange={e=>setPw({...pw,old:e.target.value})} className="w-full px-4 py-2.5 pr-11 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
              {pwEyeBtn(pwShow)}
            </div>
            <div className="relative">
              <input type={pwInputType} autoComplete="new-password" placeholder={t('profile_new_pw')} value={pw.n1} onChange={e=>setPw({...pw,n1:e.target.value})} className="w-full px-4 py-2.5 pr-11 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
              {pwEyeBtn(pwShow)}
            </div>
            <div className="relative">
              <input type={pwInputType} autoComplete="new-password" placeholder={t('profile_new_pw2')} value={pw.n2} onChange={e=>setPw({...pw,n2:e.target.value})} className="w-full px-4 py-2.5 pr-11 rounded-xl border bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none"/>
              {pwEyeBtn(pwShow)}
            </div>
            <button onClick={changePassword} disabled={pwBusy||!pw.old||!pw.n1} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50">{pwBusy?'...':t('profile_pw_save')}</button>
          </div>
        )}
      </div>

      <div ref={tabsRef} className="bg-white rounded-2xl border overflow-hidden scroll-mt-4">
        <div className="flex border-b">
          {!student && (<>
          <button onClick={()=>setTab('lessons')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='lessons'?'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600':'text-slate-500 hover:bg-slate-50'}`}><BookOpen size={16}/> {t('prof_tab_lessons')} ({myLessons.length})</button>
          <button onClick={()=>setTab('presentations')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='presentations'?'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600':'text-slate-500 hover:bg-slate-50'}`}><Presentation size={16}/> {t('prof_tab_pres')} ({myPres.length})</button>
          <button onClick={()=>setTab('tests')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='tests'?'bg-rose-50 text-rose-700 border-b-2 border-rose-500':'text-slate-500 hover:bg-slate-50'}`}><FlaskConical size={16}/> {t('prof_tab_tests')} ({myTests.length})</button>
          <button onClick={()=>setTab('draft')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='draft'?'bg-amber-50 text-amber-700 border-b-2 border-amber-500':'text-slate-500 hover:bg-slate-50'}`}>📝 {t('prof_tab_draft')} {(draft || myPresDrafts.length) ? `• ${myPresDrafts.length + (draft?1:0)}` : ''}</button>
          </>)}
          <button onClick={()=>setTab('notes')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='notes'?'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500':'text-slate-500 hover:bg-slate-50'}`}><StickyNote size={16}/> {t('prof_tab_notes')}</button>
          {!student && (
          <button onClick={()=>setTab('games')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='games'?'bg-indigo-50 text-indigo-700 border-b-2 border-blue-500':'text-slate-500 hover:bg-slate-50'}`}><Gamepad2 size={16}/> {t('prof_tab_games')} ({myTests.length})</button>
          )}
        </div>

        {(tab==='lessons'||tab==='presentations'||tab==='tests'||tab==='draft') && (
        <div className="p-4 flex flex-wrap gap-2 items-center bg-slate-50 border-b">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='lessons'?t('prof_search_lessons'):tab==='presentations'?t('prof_search_pres'):tab==='tests'?t('prof_search_tests'):t('prof_search_all')} className="flex-1 px-3 py-1.5 rounded-lg border bg-white text-sm"/>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400"/>
            <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-white text-sm">
              <option value="">{t('prof_all_subjects')}</option>
              {subjects.map((s:any)=><option key={s.id} value={String(s.id)}>{s.icon} {s.name}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value as any)} className="px-3 py-1.5 rounded-lg border bg-white text-sm">
              <option value="new">{t('prof_new')}</option>
              <option value="old">{t('prof_old')}</option>
              <option value="title">{t('prof_by_title')}</option>
            </select>
          </div>
        </div>
        )}

        <div className="p-4">
          {tab==='draft' ? (
            <div className="space-y-4">
              {/* урок черновик localStorage */}
              {draft ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-amber-900">{t('prof_draft_local')}</div>
                      <div className="text-sm text-amber-800 mt-1">{t('prof_name_is')} <b>{draft.title||'—'}</b></div>
                      <div className="text-xs text-amber-700 mt-1">{t('prof_subject')} {subjects.find(s=>String(s.id)===String(draft.subject))?.name || '—'} • {t('prof_blocks')} {draft.blocks?.length||0} • {new Date(draft.ts).toLocaleString()}</div>
                      <div className="text-xs text-slate-500 mt-2">{t('prof_draft_stored')}</div>
                    </div>
                    <span className="text-2xl">📝</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={restoreDraft} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold">{t('prof_restore')}</button>
                    <button onClick={deleteDraft} className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-sm flex items-center gap-1"><Trash2 size={14}/> {t('prof_del_draft')}</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 bg-slate-50 border rounded-xl p-3 text-center">{t('prof_no_drafts')}</div>
              )}
              {/* презентационные черновики из БД — is_public=false, только владелец */}
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-orange-900">{t('prof_pres_drafts')} ({myPresDrafts.length})</div>
                  <span className="text-xs text-orange-700">{t('prof_drafts_hint')}</span>
                </div>
                {myPresDrafts.length===0 ? (
                  <div className="text-sm text-slate-500 text-center py-4">{t('prof_no_pres_drafts')}</div>
                ) : (
                  <div className="grid gap-2">
                    {myPresDrafts.map((p:any)=>(
                      <div key={p.id} className="p-3 rounded-xl bg-white border flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{p.title}</div>
                          <div className="text-xs text-slate-500">{t('prof_draft_word')} • {new Date(p.updated_at).toLocaleDateString()} • {p.slides_count ?? p.slides?.length ?? '?'} {t('prof_slides')} • {p.subject_name||t('lessons_no_subject')}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Link to={`/presentations/${p.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                          <Link to={`/presentations/${p.id}/edit`} className="p-2 rounded-lg bg-indigo-600 text-white">{t('prof_finish')}</Link>
                          <button onClick={async()=>{if(!confirm(t('prof_del_draft2')))return; try{await client.delete(`/presentations/${p.id}/`); setMyPresDrafts(prev=>prev.filter(x=>x.id!==p.id)); toast(t('prof_draft_deleted'),'success')}catch(e:any){toast(t('prof_failed'),'error')}}} className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-200"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : tab==='lessons' ? (
            filteredLessons.length===0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_lessons')}{filterSubject || search ? t('prof_by_filter') : ''}</div>
                <Link to="/lessons/new" className="text-indigo-600 underline text-sm mt-2 inline-block">{t('prof_create_lesson')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredLessons.map((l:any)=>(
                  <div key={l.id} className="p-4 rounded-xl border hover:border-indigo-200 hover:bg-indigo-50/30 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{l.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100">{l.subject_name || t('lessons_no_subject')}</span>
                        <span>{new Date(l.created_at).toLocaleDateString()}</span>
                        <span>• {l.blocks?.length||0} {t('lessons_blocks')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/lessons/${l.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                      <Link to={`/lessons/${l.id}/edit`} className="p-2 rounded-lg bg-indigo-600 text-white"><Edit size={16}/></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab==='presentations' ? (
            filteredPres.length===0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_pres')}{filterSubject || search ? t('prof_by_filter') : ''}</div>
                <Link to="/presentations/new" className="text-indigo-600 underline text-sm mt-2 inline-block">{t('prof_create_pres')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredPres.map((p:any)=>(
                  <div key={p.id} className="p-4 rounded-xl border hover:border-orange-200 hover:bg-orange-50/30 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100">{p.subject_name || t('lessons_no_subject')}</span>
                        <span>{new Date(p.updated_at||p.created_at).toLocaleDateString()}</span>
                        <span>• {p.slides_count ?? p.slides?.length ?? 0} {t('pres_slides')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/presentations/${p.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                      <Link to={`/presentations/${p.id}/edit`} className="p-2 rounded-lg bg-orange-600 text-white"><Edit size={16}/></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab==='tests' ? (
            filteredTests.length===0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_tests')}{search ? t('prof_by_filter') : ''}</div>
                <Link to="/tests/new" className="text-indigo-600 underline text-sm mt-2 inline-block">{t('prof_create_test')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTests.map((it:any)=>(
                  <div key={it.id} className="p-4 rounded-xl border hover:border-rose-200 hover:bg-rose-50/30 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{it.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{new Date(it.created_at).toLocaleDateString()}</span>
                        <span>• {it.questions_count ?? it.questions?.length ?? 0} {t('tests_questions')}</span>
                      </div>
                      {it.description && <div className="text-xs text-slate-500 truncate mt-1">{it.description}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/tests/${it.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                      <Link to={`/tests/${it.id}/edit`} className="p-2 rounded-lg bg-rose-600 text-white"><Edit size={16}/></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab==='notes' ? (
            <Notes />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-sm text-blue-900">
                {t('prof_games_hint')}
              </div>
              {myTests.length===0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">{student ? (<>{t('prof_no_quiz_student_a')} <Link to="/games" className="text-indigo-600 underline">{t('games')}</Link>.</>) : t('prof_no_quiz')}</div>
              ) : (
                <div className="grid gap-2">
                  {myTests.map((it:any)=>(
                    <div key={it.id} className="p-3 rounded-xl border hover:border-indigo-200 hover:bg-indigo-50/40 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{it.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{it.questions_count ?? it.questions?.length ?? 0} {t('tests_questions')}</div>
                      </div>
                      <button onClick={()=>nav(`/games/arkan?test=${it.id}`)}
                        className="px-4 py-2.5 min-h-[48px] rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center gap-1 shrink-0">
                        <Play size={15}/> {t('prof_play')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!student && (
              <div>
                <div className="font-bold mb-2 flex items-center gap-2"><Gamepad2 size={17}/> {t('prof_new_quiz')}</div>
                <QuizBuilder lessons={myLessons} onSaved={(q)=>{ setMyTests(prev=>[{id:q.id, title:q.title, questions:q.questions}, ...prev]); setStats(s=>({...s, tests:s.tests+1})); toast(t('prof_quiz_saved'),'success') }} />
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
        {t('prof_global')}
      </div>
    </div>
  )
}
