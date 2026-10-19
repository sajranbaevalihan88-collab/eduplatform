import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { GraduationCap, Megaphone, ClipboardList, Users, BarChart3, Copy, Check, Plus, Clock, ExternalLink, MessageSquare, Send, Sparkles } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'

function fmtDl(s?: string){
  if(!s) return '—'
  try{ return new Date(s).toLocaleString() }catch{ return s }
}
function countdown(s?: string){
  if(!s) return ''
  const ms = new Date(s).getTime() - Date.now()
  if(ms <= 0) return null
  const d = Math.floor(ms/86400000), h = Math.floor(ms%86400000/3600000)
  return d>0 ? `⏳ ${d}д ${h}ч` : `⏳ ${h}ч ${Math.floor(ms%3600000/60000)}мин`
}

const ST_CLS:any = {
  submitted:'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  late:'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  overdue:'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  pending:'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
}
const ST_TXT:any = {submitted:'✓', late:'⏰', overdue:'⏰!', pending:'···'}

export default function ClassroomDetail(){
  const {t} = useLang()
  const {id} = useParams()
  const nav = useNavigate()
  const [room,setRoom]=useState<any>(null)
  const [tab,setTab]=useState<'stream'|'tasks'|'people'|'grades'>('stream')
  const [members,setMembers]=useState<any[]>([])
  const [tasks,setTasks]=useState<any[]>([])
  const [myTasks,setMyTasks]=useState<any>({})
  const [notes,setNotes]=useState<any[]>([])
  const [gb,setGb]=useState<any>(null)
  const [meId,setMeId]=useState<any>(null)
  const [text,setText]=useState('')
  const [addUser,setAddUser]=useState('')
  const [copied,setCopied]=useState(false)
  // assignment form
  const [akind,setAkind]=useState<'lesson'|'test'>('test')
  const [objs,setObjs]=useState<any[]>([])
  const [aobj,setAobj]=useState('')
  const [adl,setAdl]=useState('')
  const [ainstr,setAinstr]=useState('')
  const [creating,setCreating]=useState(false)
  // комментарии к объявлениям (как в Google Classroom)
  const [cmOpen,setCmOpen]=useState<Record<number,boolean>>({})
  const [cmList,setCmList]=useState<Record<number,any[]>>({})
  const [cmText,setCmText]=useState<Record<number,string>>({})
  const [cmBusy,setCmBusy]=useState(false)
  // ✨ ИИ-отчёт по классу
  const [rep,setRep]=useState<string|null>(null)
  const [repSrc,setRepSrc]=useState<string|null>(null)
  const [repBusy,setRepBusy]=useState(false)

  const load=()=>{
    client.get(`/classrooms/${id}/`).then(r=>setRoom(r.data)).catch(()=>nav('/classes'))
    client.get(`/classrooms/${id}/members/`).then(r=>setMembers(r.data.results||r.data||[])).catch(()=>{})
    client.get(`/assignments/?classroom=${id}`).then(r=>setTasks(r.data.results||r.data||[])).catch(()=>{})
    client.get(`/classrooms/${id}/my_tasks/`).then(r=>{
      const m:any={}; (r.data.results||r.data||[]).forEach((x:any)=>m[x.id]=x); setMyTasks(m)
    }).catch(()=>{})
    client.get(`/announcements/?classroom=${id}`).then(r=>setNotes(r.data.results||r.data||[])).catch(()=>{})
    client.get(`/classrooms/${id}/gradebook/`).then(r=>setGb(r.data)).catch(()=>setGb(null))
    try{ setMeId(JSON.parse(localStorage.getItem('user')||'{}').id) }catch{}
  }
  useEffect(()=>{load()},[id])
  useEffect(()=>{
    if(akind==='lesson') client.get('/lessons/?owner=me').then(r=>setObjs(r.data.results||r.data||[])).catch(()=>{})
    else client.get('/tests/?owner=me').then(r=>setObjs(r.data.results||r.data||[])).catch(()=>{})
  },[akind])

  if(!room) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto"/></div>
  const isOwner = String(room.owner)===String(meId)

  const post=async()=>{
    if(!text.trim()) return
    try{ await client.post('/announcements/', {classroom:id, text:text.trim()}); setText(''); load() }
    catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
  }
  const mkTask=async()=>{
    if(!aobj){ toast(t('cls_pick_obj'),'error'); return }
    try{
      await client.post('/assignments/', {classroom:id, kind:akind, [akind]:Number(aobj),
        deadline: adl? new Date(adl).toISOString(): null, instructions: ainstr})
      setAobj(''); setAdl(''); setAinstr(''); setCreating(false); load()
      toast(t('cls_task_created'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||JSON.stringify(e?.response?.data)||'err','error') }
  }
  const submit=async(aid:number)=>{
    try{ await client.post(`/assignments/${aid}/submit/`, {}); load(); toast(t('cls_submitted'),'success') }
    catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
  }
  const addMember=async()=>{
    if(!addUser.trim()) return
    try{ await client.post(`/classrooms/${id}/add_member/`, {username:addUser.trim()}); setAddUser(''); load(); toast(t('cls_added'),'success') }
    catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.username||'err','error') }
  }
  const copy=()=>{ try{ navigator.clipboard.writeText(room.invite_code); setCopied(true); setTimeout(()=>setCopied(false),1500) }catch{} }

  const toggleComments=async(nid:number)=>{
    const next=!cmOpen[nid]
    setCmOpen(m=>({...m,[nid]:next}))
    if(next && !cmList[nid]){
      try{ const r=await client.get(`/announcement-comments/?announcement=${nid}`); setCmList(m=>({...m,[nid]:(r.data.results||r.data||[])})) }catch{}
    }
  }
  const postComment=async(nid:number)=>{
    const v=(cmText[nid]||'').trim(); if(!v||cmBusy) return
    setCmBusy(true)
    try{
      const r=await client.post('/announcement-comments/', {announcement:nid, text:v})
      setCmList(m=>({...m,[nid]:[...(m[nid]||[]), r.data]})); setCmText(m=>({...m,[nid]:''}))
      toast(t('cls_comm_added'),'success')
    }catch(e:any){ toast(e?.response?.data?.text||e?.response?.data?.detail||'err','error') }
    setCmBusy(false)
  }
  const delComment=async(nid:number, cid:number)=>{
    try{ await client.delete(`/announcement-comments/${cid}/`); setCmList(m=>({...m,[nid]:(m[nid]||[]).filter((c:any)=>c.id!==cid)})) }catch{}
  }
  const genReport=async()=>{
    if(repBusy) return
    setRepBusy(true)
    try{
      const r=await client.post(`/classrooms/${id}/ai_report/`, {})
      setRep(String(r.data.report||'')); setRepSrc(typeof r.data.source==='string'? r.data.source : null)
      toast(t('cls_report_ready'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.error||'err','error') }
    setRepBusy(false)
  }

  const tabs:any[] = [
    {k:'stream', label:t('cls_tab_stream'), icon:Megaphone},
    {k:'tasks', label:t('cls_tab_tasks'), icon:ClipboardList},
    {k:'people', label:t('cls_tab_people'), icon:Users},
  ]
  if(isOwner) tabs.push({k:'grades', label:t('cls_tab_grades'), icon:BarChart3})

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="rounded-2xl p-6 text-white flex flex-wrap items-end justify-between gap-3" style={{background:`linear-gradient(135deg, ${room.color}, ${room.color}99)`}}>
        <div>
          <div className="flex items-center gap-2 text-white/80 text-sm"><GraduationCap size={16}/>{room.owner_name} • {room.subject_name||t('cls_no_subject')}</div>
          <h1 className="text-2xl font-bold mt-1">{room.title}</h1>
          {room.description && <p className="text-white/85 text-sm mt-1">{room.description}</p>}
        </div>
        <button onClick={copy} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/30 font-mono tracking-[0.2em] font-bold" title={t('cls_copy_code')}>
          {room.invite_code} {copied? <Check size={16}/> : <Copy size={16}/>}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 overflow-hidden">
        <div className="flex border-b dark:border-slate-700 overflow-auto">
          {tabs.map(tb=>(
            <button key={tb.k} onClick={()=>setTab(tb.k)} className={`flex-1 min-w-[130px] py-3 text-sm font-semibold flex items-center justify-center gap-2 ${tab===tb.k?'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <tb.icon size={16}/> {tb.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab==='stream' && (
            <div className="space-y-4">
              {isOwner && (
                <div className="flex gap-2">
                  <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&post()} placeholder={t('cls_announce_ph')} className="flex-1 px-4 py-2.5 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none focus:border-blue-400"/>
                  <button onClick={post} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-semibold">{t('cls_publish')}</button>
                </div>
              )}
              {notes.map(n=>(
                <div key={n.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">
                  <div className="text-sm whitespace-pre-wrap dark:text-slate-100">{n.text}</div>
                  <div className="text-xs text-slate-400 mt-2 flex items-center gap-3">
                    <span>{n.author_name} • {new Date(n.created_at).toLocaleString()}</span>
                    <button onClick={()=>toggleComments(n.id)} className="ml-auto font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1" data-testid={`comm-btn-${n.id}`}>
                      <MessageSquare size={13}/> {t('cls_comments')} {(cmList[n.id]?.length || n.comments_count || 0) ? `(${cmList[n.id]?.length ?? n.comments_count ?? 0})` : ''}
                    </button>
                  </div>
                  {cmOpen[n.id] && (
                    <div className="mt-2 space-y-2 border-t dark:border-slate-700 pt-2" data-testid={`comm-list-${n.id}`}>
                      {(cmList[n.id]||[]).map((c:any)=>(
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 flex items-center justify-center text-[10px] font-bold shrink-0">{c.author_name?.[0]?.toUpperCase()}</div>
                          <div className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700">
                            <span className="text-xs font-bold dark:text-white">{c.author_name}</span>
                            <div className="text-xs break-words dark:text-slate-200">{c.text}</div>
                          </div>
                          {(String(c.author)===String(meId) || isOwner) && (
                            <button onClick={()=>delComment(n.id, c.id)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input value={cmText[n.id]||''} onChange={e=>setCmText(m=>({...m,[n.id]:e.target.value}))}
                          onKeyDown={e=>e.key==='Enter'&&postComment(n.id)} placeholder={t('cls_comm_ph')}
                          className="flex-1 px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm outline-none"/>
                        <button onClick={()=>postComment(n.id)} disabled={cmBusy} className="px-3 py-2 rounded-xl bg-blue-700 text-white"><Send size={15}/></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {notes.length===0 && <div className="text-center text-slate-400 py-8">{t('cls_no_news')}</div>}
            </div>
          )}

          {tab==='tasks' && (
            <div className="space-y-3">
              {isOwner && !creating && <button onClick={()=>setCreating(true)} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold flex items-center gap-1"><Plus size={15}/>{t('cls_new_task')}</button>}
              {isOwner && creating && (
                <div className="p-4 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                  <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden w-fit bg-white dark:bg-slate-900">
                    <button onClick={()=>setAkind('test')} className={`px-4 py-2 text-sm font-semibold ${akind==='test'?'bg-blue-700 text-white':'bg-white dark:bg-slate-900 dark:text-slate-300'}`}>{t('tests')}</button>
                    <button onClick={()=>setAkind('lesson')} className={`px-4 py-2 text-sm font-semibold ${akind==='lesson'?'bg-blue-700 text-white':'bg-white dark:bg-slate-900 dark:text-slate-300'}`}>{t('lessons')}</button>
                  </div>
                  <select value={aobj} onChange={e=>setAobj(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none">
                    <option value="">{t('cls_pick_obj')}</option>
                    {objs.map((o:any)=><option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Clock size={15}/>{t('cls_deadline')}
                      <input type="datetime-local" value={adl} onChange={e=>setAdl(e.target.value)} className="px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none"/>
                    </label>
                  </div>
                  <textarea value={ainstr} onChange={e=>setAinstr(e.target.value)} placeholder={t('cls_instr_ph')} rows={2} className="w-full px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none"/>
                  <div className="flex gap-2">
                    <button onClick={mkTask} className="px-5 py-2 rounded-xl bg-blue-700 text-white font-semibold">{t('cls_assign')}</button>
                    <button onClick={()=>setCreating(false)} className="px-5 py-2 rounded-xl bg-slate-200 font-semibold">{t('cancel')}</button>
                  </div>
                </div>
              )}
              {tasks.map(a=>{
                const my = myTasks[a.id]
                const st = my?.status || 'pending'
                const openTo = a.kind==='lesson' ? `/lessons/${a.lesson}` : `/tests/${a.test}/take`
                const cd = countdown(a.deadline)
                return (
                  <div key={a.id} className="p-4 rounded-xl border dark:border-slate-700 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-bold flex items-center gap-2 dark:text-white">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.kind==='test'?'bg-rose-100 text-rose-700':'bg-blue-100 text-blue-700'}`}>{a.kind==='test'?t('tests'):t('lessons')}</span>
                        {a.title}
                      </div>
                      {a.instructions && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{a.instructions}</div>}
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-1"><Clock size={12}/>{fmtDl(a.deadline)}</span>
                        {cd && <span className="font-semibold text-blue-600">{cd}</span>}
                        {st==='overdue' && <span className="font-semibold text-red-600">{t('cls_overdue')}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${ST_CLS[st]}`}>{ST_TXT[st]} {my?.score!=null? `${my.score}`:''}</span>
                    {!isOwner && (a.lesson||a.test) && <Link to={openTo} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold flex items-center gap-1">{t('open')} <ExternalLink size={14}/></Link>}
                    {!isOwner && st!=='submitted' && st!=='late' && <button onClick={()=>submit(a.id)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">{t('cls_submit')}</button>}
                  </div>
                )
              })}
              {tasks.length===0 && <div className="text-center text-slate-400 py-8">{t('cls_no_tasks')}</div>}
            </div>
          )}

          {tab==='people' && (
            <div className="space-y-4">
              {isOwner && (
                <div className="flex gap-2">
                  <input value={addUser} onChange={e=>setAddUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()} placeholder={t('cls_add_ph')} className="flex-1 px-4 py-2.5 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none focus:border-blue-400"/>
                  <button onClick={addMember} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-semibold flex items-center gap-1"><Plus size={15}/>{t('add')}</button>
                </div>
              )}
              <div className="divide-y dark:divide-slate-700">
                <div className="py-2.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold">{room.owner_name?.[0]?.toUpperCase()}</div>
                  <div><div className="font-semibold dark:text-white">{room.owner_name}</div><div className="text-xs text-slate-400">{t('cls_owner')}</div></div>
                </div>
                {members.map((m:any)=>(
                  <div key={m.id} className="py-2.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 dark:text-white flex items-center justify-center font-bold">{m.student_name?.[0]?.toUpperCase()}</div>
                    <div className="font-semibold dark:text-white">{m.student_name}</div>
                    {isOwner && <button onClick={async()=>{ await client.post(`/classrooms/${id}/remove_member/`, {username:m.student_name}).catch(()=>{}); load() }} className="ml-auto text-xs text-red-500 hover:text-red-700">✕</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==='grades' && isOwner && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={genReport} disabled={repBusy}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold flex items-center gap-2 disabled:opacity-50" data-testid="cls-report">
                  <Sparkles size={17}/> {repBusy? t('cls_report_busy') : t('cls_report')}
                </button>
                <span className="text-xs text-slate-400 self-center">{t('cls_report_hint')}</span>
              </div>
              {rep && (
                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20" data-testid="cls-report-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm dark:text-white">✨ {t('cls_report')}</span>
                    {repSrc && <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${repSrc.startsWith('gemini')?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{repSrc.startsWith('gemini')? (repSrc.split(':')[1]||'Gemini') : t('cls_report_off')}</span>}
                    <button onClick={()=>{try{navigator.clipboard.writeText(rep);toast(t('cls_report_copied'),'success')}catch{}}} className="ml-auto text-xs underline text-slate-500">{t('shared_copy')}</button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed dark:text-slate-100" data-testid="cls-report-text">{rep}</div>
                </div>
              )}
              <div className="overflow-auto">
              {!gb || gb.assignments.length===0 ? <div className="text-center text-slate-400 py-8">{t('cls_no_tasks')}</div> : (
              <table className="w-full text-sm min-w-[500px] dark:text-slate-100">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b dark:border-slate-700">{t('cls_student')}</th>
                    {gb.assignments.map((a:any)=>(
                      <th key={a.id} className="p-2 border-b dark:border-slate-700 text-center" title={a.title}>{a.title.slice(0,18)}{a.title.length>18?'…':''}<div className="font-normal text-xs text-slate-400">max {a.max_score}</div></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gb.students.map((s:any)=>(
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="p-2 border-b dark:border-slate-700 font-semibold">{s.username}</td>
                      {gb.assignments.map((a:any)=>{
                        const c = gb.cells.find((x:any)=>x.assignment===a.id && x.student===s.id)
                        return <td key={a.id} className="p-2 border-b dark:border-slate-700 text-center">
                          <span className={`inline-block min-w-[64px] px-2 py-1 rounded-lg border text-xs font-bold ${ST_CLS[c?.status||'pending']}`}>
                            {c?.score!=null? Math.round(c.score*10)/10 : ST_TXT[c?.status||'pending']}
                          </span>
                        </td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
