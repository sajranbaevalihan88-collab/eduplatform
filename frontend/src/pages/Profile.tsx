import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { User, Mail, Shield, BookOpen, Layers, Presentation, FlaskConical, LogOut, Trash2, Eye, Edit, Search, Filter, Gamepad2, Play, StickyNote } from 'lucide-react'
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
  const [form,setForm]=useState({first_name:'',last_name:'',bio:'',email:''})
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

  const load=()=>{
    client.get('/auth/me/').then(r=>{
      setMe(r.data)
      setForm({first_name:r.data.first_name||'',last_name:r.data.last_name||'',bio:r.data.bio||'',email:r.data.email||''})
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
      const msg=e?.response?.data?.email?.[0] || e?.response?.data?.detail || JSON.stringify(e?.response?.data) || t('prof_save_err')
      setSaveError(msg)
    }
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
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-[24px] p-8 text-white relative overflow-hidden">
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
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-blue-700 font-semibold"><LogOut size={16}/> {t('logout')}</button>
        </div>
      </div>

      {!student && (
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5 text-center">
          <Layers className="mx-auto text-blue-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.lessons}</div>
          <div className="text-sm text-slate-500">{t('prof_my_lessons')}</div>
          <button onClick={()=>showAndScroll('lessons')} className="text-xs text-blue-600 font-semibold mt-2 inline-block">{t('prof_show')}</button>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <Presentation className="mx-auto text-orange-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.pres}</div>
          <div className="text-sm text-slate-500">{t('prof_my_pres')}</div>
          <button onClick={()=>showAndScroll('presentations')} className="text-xs text-blue-600 font-semibold mt-2 inline-block">{t('prof_show')}</button>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <FlaskConical className="mx-auto text-rose-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.tests}</div>
          <div className="text-sm text-slate-500">{t('prof_my_tests')}</div>
          <button onClick={()=>showAndScroll('tests')} className="text-xs text-blue-600 font-semibold mt-2 inline-block">{t('prof_show')}</button>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><User size={18}/> {t('profile')}</h3>
          <button onClick={()=>setEdit(!edit)} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold">{edit?t('cancel'):t('edit')}</button>
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
            <input autoFocus placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"/>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder={t('prof_ph_name')} value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"/>
              <input placeholder={t('prof_ph_surname')} value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"/>
            </div>
            <textarea placeholder={t('prof_ph_about')} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={3} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"/>
            <button onClick={save} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">{t('save')}</button>
            <div className="text-xs text-slate-500 text-center">{t('prof_role_hint')}</div>
          </div>
        )}
      </div>

      <div ref={tabsRef} className="bg-white rounded-2xl border overflow-hidden scroll-mt-4">
        <div className="flex border-b">
          {!student && (<>
          <button onClick={()=>setTab('lessons')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='lessons'?'bg-blue-50 text-blue-700 border-b-2 border-blue-600':'text-slate-500 hover:bg-slate-50'}`}><BookOpen size={16}/> {t('prof_tab_lessons')} ({myLessons.length})</button>
          <button onClick={()=>setTab('presentations')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='presentations'?'bg-blue-50 text-blue-700 border-b-2 border-blue-600':'text-slate-500 hover:bg-slate-50'}`}><Presentation size={16}/> {t('prof_tab_pres')} ({myPres.length})</button>
          <button onClick={()=>setTab('tests')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='tests'?'bg-rose-50 text-rose-700 border-b-2 border-rose-500':'text-slate-500 hover:bg-slate-50'}`}><FlaskConical size={16}/> {t('prof_tab_tests')} ({myTests.length})</button>
          <button onClick={()=>setTab('draft')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='draft'?'bg-amber-50 text-amber-700 border-b-2 border-amber-500':'text-slate-500 hover:bg-slate-50'}`}>📝 {t('prof_tab_draft')} {(draft || myPresDrafts.length) ? `• ${myPresDrafts.length + (draft?1:0)}` : ''}</button>
          </>)}
          <button onClick={()=>setTab('notes')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='notes'?'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500':'text-slate-500 hover:bg-slate-50'}`}><StickyNote size={16}/> {t('prof_tab_notes')}</button>
          {!student && (
          <button onClick={()=>setTab('games')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='games'?'bg-blue-50 text-blue-700 border-b-2 border-blue-500':'text-slate-500 hover:bg-slate-50'}`}><Gamepad2 size={16}/> {t('prof_tab_games')} ({myTests.length})</button>
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
                          <Link to={`/presentations/${p.id}/edit`} className="p-2 rounded-lg bg-blue-600 text-white">{t('prof_finish')}</Link>
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
                <Link to="/lessons/new" className="text-blue-600 underline text-sm mt-2 inline-block">{t('prof_create_lesson')}</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredLessons.map((l:any)=>(
                  <div key={l.id} className="p-4 rounded-xl border hover:border-blue-200 hover:bg-blue-50/30 flex items-center justify-between gap-3">
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
                      <Link to={`/lessons/${l.id}/edit`} className="p-2 rounded-lg bg-blue-600 text-white"><Edit size={16}/></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab==='presentations' ? (
            filteredPres.length===0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>{t('prof_no_pres')}{filterSubject || search ? t('prof_by_filter') : ''}</div>
                <Link to="/presentations/new" className="text-blue-600 underline text-sm mt-2 inline-block">{t('prof_create_pres')}</Link>
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
                <Link to="/tests/new" className="text-blue-600 underline text-sm mt-2 inline-block">{t('prof_create_test')}</Link>
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
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-sm text-blue-900">
                {t('prof_games_hint')}
              </div>
              {myTests.length===0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">{student ? (<>{t('prof_no_quiz_student_a')} <Link to="/games" className="text-blue-600 underline">{t('games')}</Link>.</>) : t('prof_no_quiz')}</div>
              ) : (
                <div className="grid gap-2">
                  {myTests.map((it:any)=>(
                    <div key={it.id} className="p-3 rounded-xl border hover:border-blue-200 hover:bg-blue-50/40 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{it.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{it.questions_count ?? it.questions?.length ?? 0} {t('tests_questions')}</div>
                      </div>
                      <button onClick={()=>nav(`/games/arkan?test=${it.id}`)}
                        className="px-4 py-2.5 min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-1 shrink-0">
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
