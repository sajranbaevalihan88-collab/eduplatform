import { useEffect, useState } from 'react'
import client from '../api/client'
import { User, Mail, Shield, BookOpen, Layers, Presentation, FlaskConical, LogOut, Trash2, Eye, Edit, Search, Filter, Gamepad2, Play, StickyNote } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from '../context/UIContext'
import Notes from './Notes'
import QuizBuilder from '../components/QuizBuilder'

export default function Profile(){
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
      setSaveError('Введите корректный email с @')
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
      const msg=e?.response?.data?.email?.[0] || e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Ошибка сохранения'
      setSaveError(msg)
    }
  }

  const logout=()=>{
    localStorage.clear()
    window.dispatchEvent(new Event('auth-change'))
    nav('/login')
  }

  const deleteDraft=()=>{
    if(!confirm('Удалить черновик урока?')) return
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

  if(!me) return <div className="text-center py-12">Загрузка профиля...</div>

  const filteredLessons=getFilteredSorted(myLessons,'lesson')
  const filteredPres=getFilteredSorted(myPres,'pres')
  const filteredTests=getFilteredSorted(myTests,'tests')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-[24px] p-8 text-white relative overflow-hidden">
        <div className="flex gap-6 items-center relative">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold">{(me.username||'U')[0].toUpperCase()}</div>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">{me.username}</h1>
            <div className="text-white/80 flex flex-wrap gap-3 mt-1 text-sm">
              <span className="flex items-center gap-1"><Mail size={14}/>{me.email||'почта не указана'}</span>
              <span className="flex items-center gap-1"><User size={14}/>ID {me.id}</span>
            </div>
            {me.bio && <p className="mt-3 text-white/90 bg-white/10 rounded-xl p-3 text-sm">{me.bio}</p>}
          </div>
          <button onClick={logout} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-violet-700 font-semibold"><LogOut size={16}/> Выйти</button>
        </div>
      </div>

      {!student && (
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5 text-center">
          <Layers className="mx-auto text-blue-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.lessons}</div>
          <div className="text-sm text-slate-500">Моих уроков</div>
          <button onClick={()=>setTab('lessons')} className="text-xs text-violet-600 font-semibold mt-2 inline-block">Показать →</button>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <Presentation className="mx-auto text-orange-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.pres}</div>
          <div className="text-sm text-slate-500">Моих презентаций</div>
          <button onClick={()=>setTab('presentations')} className="text-xs text-violet-600 font-semibold mt-2 inline-block">Показать →</button>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <FlaskConical className="mx-auto text-rose-600" size={24}/>
          <div className="text-2xl font-bold mt-2">{stats.tests}</div>
          <div className="text-sm text-slate-500">Моих тестов</div>
          <button onClick={()=>setTab('tests')} className="text-xs text-violet-600 font-semibold mt-2 inline-block">Показать →</button>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><User size={18}/> Профиль</h3>
          <button onClick={()=>setEdit(!edit)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold">{edit?'Отменить':'Редактировать'}</button>
        </div>
        {!edit ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Логин</span><span className="font-semibold">{me.username}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Email</span><span className="font-semibold">{me.email||'—'}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Имя</span><span className="font-semibold">{me.first_name||'—'} {me.last_name||''}</span></div>
            <div className="py-2"><div className="text-slate-500">О себе</div><div className="mt-1 p-3 rounded-xl bg-slate-50 min-h-[60px]">{me.bio||'Расскажи о себе...'}</div></div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {saveError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">⚠ {saveError}</div>}
            <input autoFocus placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"/>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Имя" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"/>
              <input placeholder="Фамилия" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"/>
            </div>
            <textarea placeholder="О себе" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={3} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"/>
            <button onClick={save} className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700">Сохранить</button>
            <div className="text-xs text-slate-500 text-center">Смена роли — через админа. Пароль меняется отдельно.</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex border-b">
          {!student && (<>
          <button onClick={()=>setTab('lessons')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='lessons'?'bg-violet-50 text-violet-700 border-b-2 border-violet-600':'text-slate-500 hover:bg-slate-50'}`}><BookOpen size={16}/> Мои уроки ({myLessons.length})</button>
          <button onClick={()=>setTab('presentations')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='presentations'?'bg-violet-50 text-violet-700 border-b-2 border-violet-600':'text-slate-500 hover:bg-slate-50'}`}><Presentation size={16}/> Мои презентации ({myPres.length})</button>
          <button onClick={()=>setTab('tests')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='tests'?'bg-rose-50 text-rose-700 border-b-2 border-rose-500':'text-slate-500 hover:bg-slate-50'}`}><FlaskConical size={16}/> Мои тесты ({myTests.length})</button>
          <button onClick={()=>setTab('draft')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='draft'?'bg-amber-50 text-amber-700 border-b-2 border-amber-500':'text-slate-500 hover:bg-slate-50'}`}>📝 Черновик {(draft || myPresDrafts.length) ? `• ${myPresDrafts.length + (draft?1:0)}` : ''}</button>
          </>)}
          <button onClick={()=>setTab('notes')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='notes'?'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500':'text-slate-500 hover:bg-slate-50'}`}><StickyNote size={16}/> Заметки</button>
          {!student && (
          <button onClick={()=>setTab('games')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab==='games'?'bg-blue-50 text-blue-700 border-b-2 border-blue-500':'text-slate-500 hover:bg-slate-50'}`}><Gamepad2 size={16}/> Мои игры ({myTests.length})</button>
          )}
        </div>

        {(tab==='lessons'||tab==='presentations'||tab==='tests'||tab==='draft') && (
        <div className="p-4 flex flex-wrap gap-2 items-center bg-slate-50 border-b">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='lessons'?'Поиск по урокам...':tab==='presentations'?'Поиск по презентациям...':tab==='tests'?'Поиск по тестам...':'Поиск...'} className="flex-1 px-3 py-1.5 rounded-lg border bg-white text-sm"/>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400"/>
            <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-white text-sm">
              <option value="">Все предметы</option>
              {subjects.map((s:any)=><option key={s.id} value={String(s.id)}>{s.icon} {s.name}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value as any)} className="px-3 py-1.5 rounded-lg border bg-white text-sm">
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="title">По названию</option>
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
                      <div className="font-bold text-amber-900">Черновик урока (локально)</div>
                      <div className="text-sm text-amber-800 mt-1">Название: <b>{draft.title||'Без названия'}</b></div>
                      <div className="text-xs text-amber-700 mt-1">Предмет: {subjects.find(s=>String(s.id)===String(draft.subject))?.name || '—'} • Блоков: {draft.blocks?.length||0} • {new Date(draft.ts).toLocaleString()}</div>
                      <div className="text-xs text-slate-500 mt-2">Хранится в браузере, видно только вам.</div>
                    </div>
                    <span className="text-2xl">📝</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={restoreDraft} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold">Восстановить в редакторе</button>
                    <button onClick={deleteDraft} className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-sm flex items-center gap-1"><Trash2 size={14}/> Удалить черновик</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 bg-slate-50 border rounded-xl p-3 text-center">Локальных черновиков урока нет.</div>
              )}
              {/* презентационные черновики из БД — is_public=false, только владелец */}
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-orange-900">Черновики презентаций ({myPresDrafts.length})</div>
                  <span className="text-xs text-orange-700">только вы видите • из урока или импорта → Отмена</span>
                </div>
                {myPresDrafts.length===0 ? (
                  <div className="text-sm text-slate-500 text-center py-4">Нет черновиков презентаций — импортируй .pptx и нажми Отмена, останется здесь как черновик.</div>
                ) : (
                  <div className="grid gap-2">
                    {myPresDrafts.map((p:any)=>(
                      <div key={p.id} className="p-3 rounded-xl bg-white border flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{p.title}</div>
                          <div className="text-xs text-slate-500">Черновик • {new Date(p.updated_at).toLocaleDateString()} • {p.slides_count ?? p.slides?.length ?? '?'} слайдов • {p.subject_name||'Без предмета'}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Link to={`/presentations/${p.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                          <Link to={`/presentations/${p.id}/edit`} className="p-2 rounded-lg bg-violet-600 text-white">Доделать</Link>
                          <button onClick={async()=>{if(!confirm('Удалить черновик?'))return; try{await client.delete(`/presentations/${p.id}/`); setMyPresDrafts(prev=>prev.filter(x=>x.id!==p.id)); toast('Черновик удалён','success')}catch(e:any){toast('Не удалось','error')}}} className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-200"><Trash2 size={14}/></button>
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
                <div>Нет уроков{filterSubject || search ? ' по фильтру' : ''}</div>
                <Link to="/lessons/new" className="text-violet-600 underline text-sm mt-2 inline-block">Создать урок →</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredLessons.map((l:any)=>(
                  <div key={l.id} className="p-4 rounded-xl border hover:border-violet-200 hover:bg-violet-50/30 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{l.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100">{l.subject_name || 'Без предмета'}</span>
                        <span>{new Date(l.created_at).toLocaleDateString()}</span>
                        <span>• {l.blocks?.length||0} блоков</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/lessons/${l.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                      <Link to={`/lessons/${l.id}/edit`} className="p-2 rounded-lg bg-violet-600 text-white"><Edit size={16}/></Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab==='presentations' ? (
            filteredPres.length===0 ? (
              <div className="text-center py-8 text-slate-400">
                <div>Нет презентаций{filterSubject || search ? ' по фильтру' : ''}</div>
                <Link to="/presentations/new" className="text-violet-600 underline text-sm mt-2 inline-block">Создать презентацию →</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredPres.map((p:any)=>(
                  <div key={p.id} className="p-4 rounded-xl border hover:border-orange-200 hover:bg-orange-50/30 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100">{p.subject_name || 'Без предмета'}</span>
                        <span>{new Date(p.updated_at||p.created_at).toLocaleDateString()}</span>
                        <span>• {p.slides_count ?? p.slides?.length ?? 0} слайдов</span>
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
                <div>Нет тестов{search ? ' по фильтру' : ''}</div>
                <Link to="/tests/new" className="text-violet-600 underline text-sm mt-2 inline-block">Создать тест →</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTests.map((t:any)=>(
                  <div key={t.id} className="p-4 rounded-xl border hover:border-rose-200 hover:bg-rose-50/30 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{t.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        <span>• {t.questions_count ?? t.questions?.length ?? 0} вопросов</span>
                      </div>
                      {t.description && <div className="text-xs text-slate-500 truncate mt-1">{t.description}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Link to={`/tests/${t.id}`} className="p-2 rounded-lg bg-white border hover:bg-slate-50"><Eye size={16}/></Link>
                      <Link to={`/tests/${t.id}/edit`} className="p-2 rounded-lg bg-rose-600 text-white"><Edit size={16}/></Link>
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
                🤼 Здесь твои викторины для <b>Аркан тартыш</b>: собери ниже и жми «Играть» — бой откроется сразу с этой викториной.
              </div>
              {myTests.length===0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">{student ? (<>Викторин пока нет — загляни в <Link to="/games" className="text-violet-600 underline">Игры и практика</Link>.</>) : 'Пока нет викторин — создай первую ниже.'}</div>
              ) : (
                <div className="grid gap-2">
                  {myTests.map((t:any)=>(
                    <div key={t.id} className="p-3 rounded-xl border hover:border-blue-200 hover:bg-blue-50/40 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{t.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t.questions_count ?? t.questions?.length ?? 0} вопросов</div>
                      </div>
                      <button onClick={()=>nav(`/games/arkan?test=${t.id}`)}
                        className="px-4 py-2.5 min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-1 shrink-0">
                        <Play size={15}/> Играть
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!student && (
              <div>
                <div className="font-bold mb-2 flex items-center gap-2"><Gamepad2 size={17}/> Новая викторина</div>
                <QuizBuilder lessons={myLessons} onSaved={(t)=>{ setMyTests(prev=>[{id:t.id, title:t.title, questions:t.questions}, ...prev]); setStats(s=>({...s, tests:s.tests+1})); toast('Викторина сохранена — жми «Играть»','success') }} />
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
        <b>Глобально:</b> твои уроки/презентации/тесты видны всем без входа. Доска — только твоя (приватная).
      </div>
    </div>
  )
}
