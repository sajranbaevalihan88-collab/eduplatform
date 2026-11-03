import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import client, { mediaUrl } from '../api/client'
import { GraduationCap, Megaphone, ClipboardList, Users, BarChart3, Copy, Check, Plus, Clock, ExternalLink, MessageSquare, Send, Sparkles, Share2, Video, PenLine, FlaskConical, BookOpen, X, Wallet, Lock } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import QuizBuilder from '../components/ClassroomQuizBuilder'
import { playUiSound } from '../utils/sound'
import { AI_FEATURES } from '../utils/features'

function fmtDl(s?: string){
  if(!s) return '—'
  try{ return new Date(s).toLocaleString() }catch{ return s }
}
function fmtCode(c?: string|null){
  if(!c) return '—'
  return c.length>3 ? c.slice(0,3)+'-'+c.slice(3) : c
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
  const [akind,setAkind]=useState<'lesson'|'test'|'link'|'write'>('test')
  const [objs,setObjs]=useState<any[]>([])
  const [aobj,setAobj]=useState('')
  const [adlDate,setAdlDate]=useState('')
  const [adlTime,setAdlTime]=useState('')
  const [ainstr,setAinstr]=useState('')
  const [atitle,setAtitle]=useState('')
  const [aurl,setAurl]=useState('')
  const [creating,setCreating]=useState(false)
  // письменный ответ ученика (kind=write)
  const [wOpen,setWOpen]=useState<number|null>(null)
  const [wText,setWText]=useState('')
  // комментарии к объявлениям (как в Google Classroom)
  const [cmOpen,setCmOpen]=useState<Record<number,boolean>>({})
  const [cmList,setCmList]=useState<Record<number,any[]>>({})
  const [cmText,setCmText]=useState<Record<number,string>>({})
  const [cmBusy,setCmBusy]=useState(false)
  // ✨ ИИ-отчёт по классу
  const [rep,setRep]=useState<string|null>(null)
  const [repSrc,setRepSrc]=useState<string|null>(null)
  const [repBusy,setRepBusy]=useState(false)
  // 📒 Журнал: ручные колонки и инлайн-оценки
  const [colOpen,setColOpen]=useState(false)
  const [colTitle,setColTitle]=useState('')
  const [colMax,setColMax]=useState('5')
  const [colBusy,setColBusy]=useState(false)
  const [editCell,setEditCell]=useState<{a:number,s:number}|null>(null)
  const [editVal,setEditVal]=useState('')
  // Журнал: быстрый поиск по ученикам + сортировка (по имени или по успеваемости)
  const [gbq,setGbq]=useState('')
  const [gbSort,setGbSort]=useState<'name'|'avg'>('name')
  // список «кто сдал» по заданию (как в Google Classroom): панель справа
  const [subListFor,setSubListFor]=useState<any>(null)
  // конструктор теста «как Google Forms» прямо в классруме
  const [qbOpen,setQbOpen]=useState(false)

  // ── Платный курс: инфо об оплате, очередь «Я оплатил», форма владельца ──
  const [payInfo,setPayInfo]=useState<any>(null)
  const [pendingPays,setPendingPays]=useState<any[]>([])
  const [paidOpen,setPaidOpen]=useState(false)
  const [pPrice,setPPrice]=useState('')
  const [pDetails,setPDetails]=useState('')
  const [pBusy,setPBusy]=useState(false)

  const load=()=>{
    client.get(`/classrooms/${id}/`).then(r=>setRoom(r.data)).catch(()=>nav('/classes'))
    client.get(`/classrooms/${id}/members/`).then(r=>setMembers(r.data.results||r.data||[])).catch(()=>{})
    client.get(`/assignments/?classroom=${id}`).then(r=>setTasks(r.data.results||r.data||[])).catch(()=>{})
    client.get(`/classrooms/${id}/my_tasks/`).then(r=>{
      const m:any={}; (r.data.results||r.data||[]).forEach((x:any)=>m[x.id]=x); setMyTasks(m)
    }).catch(()=>{})
    client.get(`/announcements/?classroom=${id}`).then(r=>setNotes(r.data.results||r.data||[])).catch(()=>{})
    client.get(`/classrooms/${id}/gradebook/`).then(r=>setGb(r.data)).catch(()=>setGb(null))
    client.get(`/classrooms/${id}/pay_info/`).then(r=>setPayInfo(r.data)).catch(()=>setPayInfo(null))
    // очередь «Я оплатил»: сервер отдаёт только владельцу, остальным 403 — не страшно
    client.get(`/classrooms/${id}/pending_payments/`).then(r=>setPendingPays(r.data.results||r.data||[])).catch(()=>setPendingPays([]))
    // id владельца — из СВЕЖЕГО /auth/me, а не только из localStorage:
    // если локальные данные устарели, инструменты учителя (Журнал, задания) пропадали
    try{ setMeId(JSON.parse(localStorage.getItem('user')||'{}').id) }catch{}
    client.get('/auth/me/').then(r=>{
      setMeId(r.data.id)
      try{ localStorage.setItem('user', JSON.stringify(r.data)) }catch{}
    }).catch(()=>{})
  }
  useEffect(()=>{load()},[id])
  useEffect(()=>{
    if(akind==='lesson') client.get('/lessons/?owner=me').then(r=>setObjs(r.data.results||r.data||[])).catch(()=>{})
    else client.get('/tests/?owner=me').then(r=>setObjs(r.data.results||r.data||[])).catch(()=>{})
  },[akind])

  if(!room) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto"/></div>
  const isOwner = String(room.owner)===String(meId)
  // платный класс и текущий ученик ещё не подтверждён владельцем
  const needsPay = !isOwner && room.is_paid && room.my_status==='pending'

  const markPaid=async()=>{
    setPBusy(true)
    try{ await client.post(`/classrooms/${id}/request_paid_access/`); toast('Заявка отправлена учителю','success'); load() }
    catch(e:any){ toast(e?.response?.data?.detail||'err','error') } finally{ setPBusy(false) }
  }
  // 5000.00 -> «5000» для красивого бейджа
  const fmtSom=(v:any)=> (v===null||v===undefined||v==='') ? '' : String(parseFloat(String(v)))
  const copyDetails=async()=>{
    try{ await navigator.clipboard.writeText(payInfo?.payment_details||room.payment_details||''); toast('Реквизиты скопированы','success') }catch{}
  }
  const uploadQr=async(f:File|undefined)=>{
    if(!f) return
    setPBusy(true)
    try{
      const fd=new FormData(); fd.append('file', f)
      await client.post(`/classrooms/${id}/payment_qr_upload/`, fd, {headers:{'Content-Type':'multipart/form-data'}})
      toast('QR банка загружен','success'); load()
    }catch(e:any){ toast(e?.response?.data?.file||e?.response?.data?.detail||'err','error') } finally{ setPBusy(false) }
  }
  const removeQr=async()=>{
    try{ await client.delete(`/classrooms/${id}/payment_qr_upload/`); toast('QR удалён','success'); load() }catch{}
  }
  const savePaid=async(fields:Record<string,any>)=>{
    setPBusy(true)
    try{
      const body:Record<string,any>={...fields}
      if(body.price!==undefined){
        const raw=String(body.price).trim().replace(',','.')
        if(raw==='') body.price=null
        else{
          const num=Number(raw)
          if(isNaN(num)||num<0){ toast('Цена — число больше 0','error'); setPBusy(false); return }
          body.price=num
        }
      }
      await client.patch(`/classrooms/${id}/`, body)
      toast('Настройки курса сохранены','success'); setPaidOpen(false); load()
    }catch(e:any){ toast(e?.response?.data?.detail||'err','error') } finally{ setPBusy(false) }
  }
  const approvePay=async(sid:any)=>{
    try{ await client.post(`/classrooms/${id}/approve_payment/`,{student:sid}); toast('Доступ открыт','success'); load() }
    catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
  }
  const declinePay=async(sid:any)=>{
    try{ await client.post(`/classrooms/${id}/decline_payment/`,{student:sid}); load() }catch{}
  }

  const post=async()=>{
    if(!text.trim()) return
    try{ await client.post('/announcements/', {classroom:id, text:text.trim()}); setText(''); load(); playUiSound('ui-notify') }
    catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
  }
  const mkTask=async()=>{
    const dl = adlDate? new Date(`${adlDate}T${adlTime||'23:59'}`).toISOString(): null
    try{
      if(akind==='link'){
        if(!aurl.trim()){ toast(t('cls_need_url'),'error'); return }
        await client.post('/assignments/', {classroom:id, kind:'link', manual_title: atitle.trim()||t('cls_k_link'), url:aurl.trim(), instructions:ainstr, deadline:dl})
      } else if(akind==='write'){
        if(!atitle.trim()){ toast(t('cls_need_task_title'),'error'); return }
        await client.post('/assignments/', {classroom:id, kind:'write', manual_title: atitle.trim(), instructions:ainstr, deadline:dl})
      } else {
        if(!aobj){ toast(t('cls_pick_obj'),'error'); return }
        await client.post('/assignments/', {classroom:id, kind:akind, [akind]:Number(aobj), deadline:dl, instructions: ainstr})
      }
      setAobj(''); setAdlDate(''); setAdlTime(''); setAinstr(''); setAtitle(''); setAurl(''); setCreating(false); load()
      toast(t('cls_added'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.url||e?.response?.data?.manual_title||JSON.stringify(e?.response?.data)||'err','error') }
  }
  // тест создан в конструкторе — сразу превращаем его в задание класса (как Google Classroom + Forms)
  const onQuizCreated=async(testId:number)=>{
    const dl = adlDate? new Date(`${adlDate}T${adlTime||'23:59'}`).toISOString(): null
    await client.post('/assignments/', {classroom:id, kind:'test', test:testId, deadline:dl, instructions:ainstr})
    setAobj(''); setAdlDate(''); setAdlTime(''); setAinstr(''); setCreating(false); load()
  }
  // письменная сдача задания (повторно — подставляем прежний ответ)
  const startWrite=async(aid:number)=>{
    setWOpen(aid); setWText('')
    try{
      const r=await client.get(`/submissions/?assignment=${aid}`)
      const list = r.data.results||r.data||[]
      const mine = list.find((x:any)=>x.answer)
      if(mine) setWText(mine.answer)
    }catch{}
  }
  const sendAnswer=async(aid:number)=>{
    const v=wText.trim(); if(!v){ toast(t('cls_need_answer'),'error'); return }
    try{ await client.post(`/assignments/${aid}/submit/`, {answer:v}); setWOpen(null); setWText(''); load(); toast(t('cls_submitted'),'success') }
    catch(e:any){ toast(e?.response?.data?.answer||e?.response?.data?.detail||'err','error') }
  }
  const dlPreset=(kind:'none'|'today'|'tomorrow'|'week')=>{
    const d=new Date()
    if(kind==='none'){ setAdlDate(''); setAdlTime(''); return }
    let target=new Date()
    if(kind==='today') target=new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0)
    if(kind==='tomorrow') target=new Date(d.getFullYear(), d.getMonth(), d.getDate()+1, 21, 0)
    if(kind==='week'){ const add=(7-d.getDay())%7||7; target=new Date(d.getFullYear(), d.getMonth(), d.getDate()+add, 21, 0) }
    const pad=(n:number)=>String(n).padStart(2,'0')
    setAdlDate(`${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}`)
    setAdlTime(`${pad(target.getHours())}:${pad(target.getMinutes())}`)
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
  const shareCode=async()=>{
    const text=`${room.title} — код ${fmtCode(room.invite_code)}`
    try{
      if(navigator.share){ await navigator.share({title:'EduPlatform', text}); return }
    }catch(e:any){ if(e?.name==='AbortError') return }
    try{ navigator.clipboard.writeText(room.invite_code); setCopied(true); setTimeout(()=>setCopied(false),1500); toast(t('cls_copy_code'),'success') }catch{}
  }

  // 📒 Журнал
  const addCol=async()=>{
    const nm=colTitle.trim(); if(!nm||colBusy) return
    setColBusy(true)
    try{
      await client.post('/assignments/', {classroom:id, kind:'manual', manual_title:nm, max_score:Number(colMax)||5, instructions:''})
      setColTitle(''); setColMax('5'); setColOpen(false); load()
      toast(t('cls_g_created'),'success')
    }catch(e:any){ toast(e?.response?.data?.manual_title||e?.response?.data?.detail||'err','error') }
    setColBusy(false)
  }
  const saveCell=async(aid:number,sid:number,val:string)=>{
    if(editCell && editCell.a===aid && editCell.s===sid) setEditCell(null)
    const v=val.trim()
    const blank = v===''
    // число (запятая = десятичный разделитель) или текстовая пометка «нб» и т.п.
    const isNum = v!=='' && !isNaN(Number(v.replace(',','.')))
    const numVal = isNum? Number(v.replace(',','.')) : null
    const mark = (!blank && !isNum)? v.slice(0,8) : ''
    try{
      await client.post(`/classrooms/${id}/gradebook_score/`, {assignment:aid, student:sid, score:numVal, mark})
      setGb((g:any)=>{
        if(!g) return g
        const cells=g.cells.map((c:any)=> c.assignment===aid&&c.student===sid
          ? (blank? {...c, score:null, mark:'', status:'pending'}
            : mark? {...c, score:null, mark, status:'submitted'}
            : {...c, score:numVal, mark:'', status:'submitted'}) : c)
        const sv=cells.filter((x:any)=>x.student===sid&&x.score!=null).map((x:any)=>x.score)
        const av=cells.filter((x:any)=>x.assignment===aid&&x.score!=null).map((x:any)=>x.score)
        return {...g, cells,
          avg_student:{...g.avg_student, [String(sid)]: sv.length? Math.round(sv.reduce((p:number,c:number)=>p+c,0)/sv.length*10)/10 : null},
          avg_assignment:{...g.avg_assignment, [String(aid)]: av.length? Math.round(av.reduce((p:number,c:number)=>p+c,0)/av.length*10)/10 : null}}
      })
      toast(t('cls_g_saved'),'success')
    }catch(e:any){
      toast(e?.response?.data?.mark||e?.response?.data?.score||e?.response?.data?.detail||'err','error'); load()
    }
  }
  const delCol=async(aid:number,title:string)=>{
    if(!confirm(`${t('cls_g_del')} «${title}»? ${t('cls_g_del_hint')}`)) return
    try{ await client.delete(`/assignments/${aid}/?kind=manual`); load(); toast(t('cls_g_del'),'success') }
    catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
  }
  const exportCSV=()=>{
    if(!gb) return
    const q=(v:string)=>'"'+String(v).replace(/"/g,'""')+'"'
    const num=(v:any)=> v!=null? String(Math.round(v*10)/10).replace('.',',') : ''
    const head=[t('cls_student'), ...gb.assignments.map((a:any)=>a.title), t('cls_g_avg')].map(q).join(';')
    const rows=gb.students.map((s:any)=>[
      s.username,
      ...gb.assignments.map((a:any)=>{
        const c=gb.cells.find((x:any)=>x.assignment===a.id&&x.student===s.id)
        return c?.mark || num(c?.score)
      }),
      num(gb.avg_student?.[String(s.id)])
    ].map(q).join(';'))
    const csv='\uFEFF'+[head,...rows].join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const aEl=document.createElement('a')
    aEl.href=url
    aEl.download=((room?.title||'gradebook').replace(/[\\/:*?"<>|]+/g,'').trim().slice(0,40)||'gradebook')+'.csv'
    aEl.click(); URL.revokeObjectURL(url)
  }

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

  // Журнал: видимый список учеников — поиск + сортировка (по имени / по успеваемости)
  const gbList = (gb?.students||[])
    .filter((s:any)=> !gbq.trim() || String(s.username||'').toLowerCase().includes(gbq.trim().toLowerCase()))
    .slice()
    .sort((x:any,y:any)=> gbSort==='name'
      ? String(x.username||'').localeCompare(String(y.username||''))
      : (gb.avg_student?.[String(y.id)] ?? -1) - (gb.avg_student?.[String(x.id)] ?? -1))

  const avgColor = (v:number|null|undefined)=> v==null? 'text-slate-400'
    : v>=85? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : v>=70? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
    : v>=50? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'

  const tabs:any[] = [
    {k:'stream', label:t('cls_tab_stream'), icon:Megaphone},
    {k:'tasks', label:t('cls_tab_tasks'), icon:ClipboardList},
    {k:'people', label:t('cls_tab_people'), icon:Users},
  ]
  if(isOwner) tabs.push({k:'grades', label:t('cls_tab_grades'), icon:BarChart3})

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="rounded-2xl p-4 sm:p-6 text-white flex flex-wrap items-end justify-between gap-3" style={{background:`linear-gradient(135deg, ${room.color}, ${room.color}99)`}}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm"><GraduationCap size={16} className="shrink-0"/>{room.owner_name} • {room.subject_name||t('cls_no_subject')}</div>
          <h1 className="text-xl sm:text-2xl font-bold mt-1 break-words">{room.title}</h1>
          {room.description && <p className="text-white/85 text-xs sm:text-sm mt-1">{room.description}</p>}
          {room.is_paid && (
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-white/20 border border-white/30 rounded-full px-2.5 py-1 mt-2" data-testid="paid-badge">
              💰 Платный курс — {fmtSom(room.price)} сом
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={shareCode} className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-white/15 border border-white/30 flex items-center justify-center" title={t('cls_share')} aria-label={t('cls_share')}>
            <Share2 size={16}/>
          </button>
          <button onClick={copy} className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-white/15 border border-white/30 font-mono font-bold text-sm" title={t('cls_copy_code')} aria-label={t('cls_copy_code')}>
            {fmtCode(room.invite_code)} {copied? <Check size={16}/> : <Copy size={16}/>}
          </button>
        </div>
      </div>

      {needsPay && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 sm:p-5" data-testid="pay-banner">
          <div className="flex flex-wrap items-start gap-4">
            {payInfo?.payment_qr ? (
              <a href={mediaUrl(payInfo.payment_qr)} target="_blank" rel="noopener noreferrer" title="Открыть в полном размере">
                <img src={mediaUrl(payInfo.payment_qr)} alt="QR банка для оплаты" className="w-44 h-44 object-contain rounded-xl border border-amber-300 bg-white" data-testid="pay-qr"/>
              </a>
            ) : payInfo?.qr && (
              <img src={payInfo.qr} alt="QR-код с реквизитами" className="w-28 h-28 rounded-lg border border-amber-300 bg-white" data-testid="pay-qr"/>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2"><Lock size={16}/> Платный курс — доступ ожидает оплаты</div>
              {payInfo?.payment_qr ? (
                <div className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Отсканируй QR камерой или приложением банка (<b>Мбанк / О!Деньги / Элсом</b>) и переведи <b>{fmtSom(payInfo?.price ?? room.price)} сом</b> учителю курса.
                </div>
              ) : (
                <div className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Цена: <b>{fmtSom(payInfo?.price ?? room.price)} сом</b>. Переведи по реквизитам: {payInfo?.payment_details || room.payment_details || '—'}
                </div>
              )}
              {(payInfo?.payment_details || room.payment_details) && (
                <button onClick={copyDetails} className="mt-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-300" data-testid="pay-copy-details">
                  📋 {payInfo?.payment_details || room.payment_details} — копировать
                </button>
              )}
              <div>
                <button onClick={markPaid} disabled={pBusy} data-testid="pay-mark-paid" className="mt-3 px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-600 text-white font-semibold disabled:opacity-50">
                  {pBusy ? '…' : '✅ Я оплатил — жду подтверждения'}
                </button>
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-2">Учитель проверит перевод и откроет доступ. Пока материалы класса закрыты.</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 overflow-hidden">
        <div className="flex overflow-x-auto sm:grid sm:grid-flow-col sm:auto-cols-fr border-b dark:border-slate-700">
          {tabs.map(tb=>(
            <button key={tb.k} onClick={()=>setTab(tb.k)} className={`py-3 min-h-[46px] px-3 text-[13px] sm:text-sm font-semibold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${tab===tb.k?'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <tb.icon size={15} className="shrink-0"/> <span>{tb.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {tab==='stream' && (
            <div className="space-y-4">
              {isOwner && (
                  <div className="flex gap-2">
                    <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&post()} placeholder={t('cls_announce_ph')} className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none focus:border-blue-400"/>
                    <button onClick={post} className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-700 text-white font-semibold">{t('cls_publish')}</button>
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
                            <button onClick={()=>delComment(n.id, c.id)} className="text-xs text-slate-400 hover:text-red-500 p-2 min-w-[32px] min-h-[32px]" aria-label={t('delete')}>✕</button>
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
              {!isOwner && tasks.length>0 && (()=>{
                const done = tasks.filter((a:any)=> ['submitted','late'].includes(myTasks[a.id]?.status)).length
                const pct = Math.round(done/tasks.length*100)
                return (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50" data-testid="stu-progress">
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-200 whitespace-nowrap">{t('cls_submitted_of').replace('{x}', String(done)).replace('{y}', String(tasks.length))}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-blue-100 dark:bg-blue-900/50 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{pct}%</span>
                  </div>
                )
              })()}
              {isOwner && !creating && <button onClick={()=>setCreating(true)} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-700 text-white text-sm font-semibold flex items-center gap-1"><Plus size={15}/>{t('cls_new_task')}</button>}
              {isOwner && creating && (
                <div className="p-4 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      {k:'test', l:t('tests'), i:FlaskConical},
                      {k:'lesson', l:t('lessons'), i:BookOpen},
                      {k:'link', l:t('cls_k_link'), i:Video},
                      {k:'write', l:t('cls_k_write'), i:PenLine},
                    ] as any).map((kt:any)=>{
                      const Ic = kt.i
                      return (
                        <button key={kt.k} onClick={()=>setAkind(kt.k)} className={`flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold border ${akind===kt.k?'bg-blue-700 text-white border-blue-700':'bg-white dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}><Ic size={15}/>{kt.l}</button>
                      )
                    })
                  }
                  </div>
                  {akind==='link' ? (
                    <>
                      <input value={atitle} onChange={e=>setAtitle(e.target.value)} placeholder={t('cls_title_ph')} className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 outline-none"/>
                      <input value={aurl} onChange={e=>setAurl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&mkTask()} placeholder={t('cls_url_ph')} inputMode="url" className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 outline-none"/>
                      <p className="text-[11px] text-slate-400">{t('cls_link_hint')}</p>
                    </>
                  ) : akind==='write' ? (
                    <input value={atitle} onChange={e=>setAtitle(e.target.value)} placeholder={t('cls_write_title_ph')} className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 outline-none"/>
                  ) : (
                    <select value={aobj} onChange={e=>setAobj(e.target.value)} className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none">
                      <option value="">{t('cls_pick_obj')}</option>
                      {objs.map((o:any)=><option key={o.id} value={o.id}>{o.title}</option>)}
                    </select>
                  )}
                  {akind==='test' && (
                    <button type="button" onClick={()=>setQbOpen(true)} data-testid="open-quiz-builder"
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 shadow-md">
                      <FlaskConical size={17}/>{t('cls_new_quiz')}
                    </button>
                  )}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Clock size={14}/>{t('cls_deadline')}</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={()=>dlPreset('none')} className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold border ${!adlDate?'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white':'bg-white dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>{t('cls_dl_none')}</button>
                      {[{k:'today', l:t('cls_dl_today')},{k:'tomorrow', l:t('cls_dl_tomorrow')},{k:'week', l:t('cls_dl_week')}].map(p=>(
                        <button key={(p as any).k} type="button" onClick={()=>dlPreset((p as any).k)} className="px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-300">{(p as any).l}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="date" value={adlDate} onChange={e=>setAdlDate(e.target.value)} aria-label={t('cls_dl_date')} className="flex-1 min-w-0 px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none"/>
                      <input type="time" value={adlTime} onChange={e=>setAdlTime(e.target.value)} aria-label={t('cls_dl_time')} className={`px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none ${adlDate?'':'opacity-60'}`}/>
                    </div>
                    <p className="text-[11px] text-slate-400">{t('cls_dl_hint')}</p>
                  </div>
                  <textarea value={ainstr} onChange={e=>setAinstr(e.target.value)} placeholder={t('cls_instr_ph')} rows={2} className="w-full px-3 py-2.5 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none"/>
                  <div className="flex gap-2">
                    <button onClick={mkTask} className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-700 text-white font-semibold">{t('cls_assign')}</button>
                    <button onClick={()=>setCreating(false)} className="px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-200 font-semibold dark:bg-slate-700 dark:text-white">{t('cancel')}</button>
                  </div>
                </div>
              )}
              {tasks.map(a=>{
                const my = myTasks[a.id]
                const st = my?.status || 'pending'
                const openTo = a.kind==='lesson' ? `/lessons/${a.lesson}` : `/tests/${a.test}/take`
                const cd = countdown(a.deadline)
                const kindCls = a.kind==='test'? 'bg-rose-100 text-rose-700' : a.kind==='link'? 'bg-violet-100 text-violet-700' : a.kind==='write'? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                const kindLbl = a.kind==='test'? t('tests') : a.kind==='lesson'? t('lessons') : a.kind==='link'? t('cls_k_link') : t('cls_k_write')
                const sm = a.submitted_count ?? 0
                return (
                  <div key={a.id} className="p-4 rounded-xl border dark:border-slate-700 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-bold flex items-center gap-2 dark:text-white flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${kindCls}`}>{kindLbl}</span>
                        {a.title}
                        {/* «Гугл-классрум»-фичa: учитель сразу видит, сколько кто сдал */}
                        {isOwner && room && (
                          <button onClick={()=>setSubListFor(a)} title={t('cls_who_title')}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold cursor-pointer hover:ring-2 hover:ring-emerald-400/60 transition ${sm>0?'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300':'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                            data-testid={`subm-count-${a.id}`}>
                            {t('cls_submitted_of').replace('{x}', String(sm)).replace('{y}', String(room.members_count ?? 0))}
                          </button>
                        )}
                      </div>
                      {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all mt-1 inline-block max-w-full">{a.url}</a>}
                      {a.instructions && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{a.instructions}</div>}
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-1"><Clock size={12}/>{fmtDl(a.deadline)}</span>
                        {cd && <span className="font-semibold text-blue-600">{cd}</span>}
                        {st==='overdue' && <span className="font-semibold text-red-600">{t('cls_overdue')}</span>}
                      </div>
                      {!isOwner && wOpen===a.id && (
                        <div className="mt-2 flex gap-2">
                          <textarea autoFocus value={wText} onChange={e=>setWText(e.target.value)} rows={2} placeholder={t('cls_ans_ph')}
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 outline-none"/>
                          <button onClick={()=>sendAnswer(a.id)} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold shrink-0">{t('cls_submit')}</button>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${ST_CLS[st]}`}>{ST_TXT[st]} {my?.score!=null? `${my.score}`:''}</span>
                    {!isOwner && a.kind==='link' && a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 min-h-[44px] rounded-xl bg-violet-50 text-violet-700 text-sm font-semibold flex items-center gap-1">{t('open')} <ExternalLink size={14}/></a>}
                    {!isOwner && (a.kind==='lesson'||a.kind==='test') && <Link to={openTo} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold flex items-center gap-1">{t('open')} <ExternalLink size={14}/></Link>}
                    {!isOwner && st!=='submitted' && st!=='late' && a.kind==='write' && wOpen!==a.id && <button onClick={()=>startWrite(a.id)} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-500 text-white text-sm font-semibold">{t('cls_write_do')}</button>}
                    {!isOwner && st!=='submitted' && st!=='late' && a.kind!=='write' && <button onClick={()=>submit(a.id)} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold">{t('cls_submit')}</button>}
                  </div>
                )
              })}
              {tasks.length===0 && <div className="text-center text-slate-400 py-8">{t('cls_no_tasks')}</div>}
            </div>
          )}

          {tab==='people' && (
            <div className="space-y-4">
              {isOwner && (
                <div className="rounded-xl border dark:border-slate-700 p-4" data-testid="paid-panel">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold dark:text-white flex items-center gap-2"><Wallet size={16}/> Платный курс</div>
                    <button onClick={()=>{setPaidOpen(v=>!v); setPPrice(room.price!=null?String(room.price):''); setPDetails(room.payment_details||'')}} className="text-sm font-semibold text-blue-700 dark:text-blue-400" data-testid="paid-toggle">
                      {paidOpen ? 'Скрыть' : (room.is_paid ? 'Настройки' : 'Сделать платным')}
                    </button>
                  </div>
                  {room.is_paid && !paidOpen && (
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Цена: <b>{fmtSom(room.price)} сом</b> • реквизиты: {room.payment_details||'—'} • ждут подтверждения: {pendingPays.length}
                    </div>
                  )}
                  {paidOpen && (
                    <div className="mt-3 space-y-3">
                      <label className="flex items-center gap-2 text-sm dark:text-white">
                        <input type="checkbox" checked={!!room.is_paid} onChange={e=>savePaid({is_paid:e.target.checked})} className="w-4 h-4"/>
                        Включить платный доступ (ученики ждут подтверждения оплаты)
                      </label>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input value={pPrice} onChange={e=>setPPrice(e.target.value)} placeholder="Цена, сом (например 500)" inputMode="decimal" data-testid="paid-price" className="px-3 py-2 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white"/>
                        <input value={pDetails} onChange={e=>setPDetails(e.target.value)} placeholder="Реквизиты: Мбанк 0500123456 / карта" data-testid="paid-details" className="px-3 py-2 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white"/>
                      </div>
                      <button onClick={()=>savePaid({is_paid:!!room.is_paid, price:pPrice, payment_details:pDetails})} disabled={pBusy} data-testid="paid-save" className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-700 text-white font-semibold disabled:opacity-50">{pBusy?'…':'Сохранить'}</button>
                      {room.is_paid && (
                        <div className="pt-2 border-t dark:border-slate-700 space-y-3">
                          <div>
                            <div className="text-sm font-semibold dark:text-white">QR твоего банка — ученики сканируют и платят напрямую</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Открой приложение банка → «Мой QR-код» / «Получить перевод» → сделай скриншот → загрузи сюда. Плюс продублируй номер в реквизитах выше — ученик сможет скопировать.</div>
                            <div className="flex items-start gap-3 mt-2">
                              {room.payment_qr ? (
                                <>
                                  <img src={mediaUrl(room.payment_qr)} alt="QR банка" className="w-36 h-36 object-contain rounded-xl border dark:border-slate-600 bg-white" data-testid="paid-qr-bank"/>
                                  <div className="space-y-2">
                                    <label className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm font-semibold cursor-pointer inline-block hover:bg-slate-200 dark:hover:bg-slate-700">
                                      Заменить
                                      <input type="file" accept="image/*" className="hidden" onChange={e=>uploadQr(e.target.files?.[0])}/>
                                    </label>
                                    <button onClick={removeQr} className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm font-semibold block">Удалить</button>
                                  </div>
                                </>
                              ) : (
                                <label className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-700 text-white text-sm font-semibold cursor-pointer inline-flex items-center gap-1" data-testid="paid-qr-upload">
                                  📷 Загрузить QR из банка
                                  <input type="file" accept="image/*" className="hidden" onChange={e=>uploadQr(e.target.files?.[0])}/>
                                </label>
                              )}
                            </div>
                          </div>
                          {payInfo?.qr && (
                            <div className="flex items-start gap-3 pt-2 border-t dark:border-slate-700">
                              <img src={payInfo.qr} alt="Запасной QR с реквизитами" className="w-24 h-24 rounded-lg border dark:border-slate-600 bg-white"/>
                              <div className="text-xs text-slate-500 dark:text-slate-400">Запасной QR с текстом реквизитов — покажется ученику, если свой QR банка не загружен.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {pendingPays.length>0 && (
                    <div className="mt-3 pt-3 border-t dark:border-slate-700">
                      <div className="text-sm font-semibold dark:text-white mb-1">«Я оплатил» — ждут подтверждения:</div>
                      {pendingPays.map((p:any)=>(
                        <div key={p.id} className="flex items-center gap-2 py-1.5">
                          <span className="text-sm dark:text-slate-200">{p.student_name}</span>
                          <span className="text-xs text-slate-400">{p.paid_requested_at ? new Date(p.paid_requested_at).toLocaleString() : ''}</span>
                          <button onClick={()=>approvePay(p.student)} data-testid={`pay-approve-${p.student}`} className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Принять</button>
                          <button onClick={()=>declinePay(p.student)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">Отклонить</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                    {m.status==='pending' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">не оплатил</span>}
                    {isOwner && <button onClick={async()=>{ await client.post(`/classrooms/${id}/remove_member/`, {username:m.student_name}).catch(()=>{}); load() }} className="ml-auto text-xs text-red-500 hover:text-red-700">✕</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==='grades' && isOwner && (
            <div className="space-y-4">
              {AI_FEATURES && (
              <div className="flex flex-wrap gap-2">
                <button onClick={genReport} disabled={repBusy}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold flex items-center gap-2 disabled:opacity-50" data-testid="cls-report">
                  <Sparkles size={17}/> {repBusy? t('cls_report_busy') : t('cls_report')}
                </button>
                <span className="text-xs text-slate-400 self-center">{t('cls_report_hint')}</span>
              </div>
              )}
              {AI_FEATURES && rep && (
                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20" data-testid="cls-report-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm dark:text-white">✨ {t('cls_report')}</span>
                    {repSrc && <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${repSrc.startsWith('gemini')?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{repSrc.startsWith('gemini')? (repSrc.split(':')[1]||'Gemini') : t('cls_report_off')}</span>}
                    <button onClick={()=>{try{navigator.clipboard.writeText(rep);toast(t('cls_report_copied'),'success')}catch{}}} className="ml-auto text-xs underline text-slate-500">{t('shared_copy')}</button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed dark:text-slate-100" data-testid="cls-report-text">{rep}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                {isOwner && gb && (gb.students||[]).length>1 && (
                  <input data-testid="gb-search" value={gbq} onChange={e=>setGbq(e.target.value)}
                    placeholder={t('cls_g_search')||'Поиск ученика…'} aria-label={t('cls_g_search')||'Поиск ученика…'}
                    className="px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm w-[180px]" />
                )}
                {isOwner && gb && (gb.students||[]).length>1 && (
                  <button onClick={()=>setGbSort(o=>o==='name'?'avg':'name')} data-testid="gb-sort"
                    title={gbSort==='name'? (t('cls_g_sort_avg')||'Сортировать по успеваемости') : (t('cls_g_sort_name')||'Сортировать по имени')}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 text-sm font-semibold dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700">
                    {gbSort==='name'? 'А→Я' : '🎯 По успеваемости'}
                  </button>
                )}
                {isOwner && (
                  <button onClick={()=>setColOpen(o=>!o)} data-testid="cls-addcol"
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold text-sm hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-1">
                    <Plus size={16}/>{t('cls_g_addcol')}
                  </button>
                )}
                {isOwner && gb && (
                  <button onClick={exportCSV} data-testid="cls-csv"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">
                    {t('cls_g_csv')}
                  </button>
                )}
                {isOwner && gb && <span className="text-xs text-slate-400">{t('cls_g_mark_hint')}</span>}
                {isOwner && gb && gb.assignments.some((a:any)=>a.kind==='manual') && (
                  <span className="text-xs text-slate-400">{t('cls_g_del_hint')}</span>
                )}
              </div>
              {colOpen && isOwner && (
                <div className="flex flex-wrap gap-2 p-3 rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800" data-testid="cls-colform">
                  <input data-testid="cls-colname" value={colTitle} onChange={e=>setColTitle(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') addCol() }}
                    placeholder={t('cls_g_col_name')} className="px-3 py-2 rounded-xl border flex-1 min-w-[220px]"/>
                  <input value={colMax} onChange={e=>setColMax(e.target.value.replace(/\D/g,''))}
                    placeholder={t('cls_g_col_max')} aria-label={t('cls_g_col_max')} className="px-3 py-2 rounded-xl border w-24 text-center"/>
                  <button data-testid="cls-colcreate" onClick={addCol} disabled={colBusy}
                    className="px-4 py-2 rounded-xl bg-blue-700 dark:bg-blue-600 text-white font-bold text-sm disabled:opacity-50">{t('cls_g_create')}</button>
                  <button onClick={()=>setColOpen(false)} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-sm">{t('cls_g_cancel')}</button>
                </div>
              )}
              {(!gb || !(gb.assignments||[]).length) && (
                <div className="text-center text-slate-400 py-8" data-testid="cls-journal-empty">{t('cls_no_tasks')}</div>
              )}
              {gb && gb.assignments.length>0 && (
                <div className="overflow-auto">
                <table className="w-full text-sm min-w-[560px] dark:text-slate-100">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b dark:border-slate-700 sticky left-0 z-10 min-w-[132px] bg-white dark:bg-slate-900">{t('cls_student')}</th>
                      {gb.assignments.map((a:any)=>(
                        <th key={a.id} className="p-2 border-b dark:border-slate-700 text-center" title={a.title}>
                          <div className="flex items-center justify-center gap-1">
                            <span>{a.title.slice(0,14)}{a.title.length>14?'…':''}</span>
                            {a.kind==='manual' && (
                              <button onClick={()=>delCol(a.id,a.title)} data-testid={`gb-delcol-${a.id}`}
                                title={t('cls_g_del')} aria-label={`${t('cls_g_del')}: ${a.title}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 leading-none text-base">✕</button>
                            )}
                          </div>
                          <div className="font-normal text-xs text-slate-400">max {a.max_score}</div>
                        </th>
                      ))}
                      <th className="p-2 border-b dark:border-slate-700 text-center text-blue-700 dark:text-blue-300">{t('cls_g_avg')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gbList.map((s:any, si:number)=>(
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-2 border-b dark:border-slate-700 font-semibold sticky left-0 z-10 bg-white dark:bg-slate-900 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]">{s.username}</td>
                        {gb.assignments.map((a:any)=>{
                          const c = gb.cells.find((x:any)=>x.assignment===a.id && x.student===s.id)
                          const isEdit = !!(editCell && editCell.a===a.id && editCell.s===s.id)
                          if(isEdit) return (
                            <td key={a.id} className="p-2 border-b dark:border-slate-700 text-center">
                              <input autoFocus maxLength={8} value={editVal} onChange={e=>setEditVal(e.target.value)}
                                onBlur={()=>saveCell(a.id,s.id,editVal)}
                                onKeyDown={e=>{
                                  // Enter: сохранить и перейти к следующему ученику в этой колонке — оценка всего класса «не отрывая рук»
                                  if(e.key==='Enter'){
                                    saveCell(a.id,s.id,editVal)
                                    const nx=gbList[si+1]
                                    if(nx){ setEditCell({a:a.id,s:nx.id}); setEditVal('') }
                                  }
                                  else if(e.key==='Escape') setEditCell(null)
                                }}
                                className="w-16 px-1 py-1 rounded-lg border-2 border-blue-500 text-center text-xs bg-white dark:bg-slate-800 dark:text-white"/>
                              {a.kind==='write' && c?.answer && (
                                <div className="mt-1 max-w-[230px] text-left text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-1.5 whitespace-pre-wrap" title={t('cls_g_answer')}>
                                  <span className="font-semibold">{t('cls_g_answer')}: </span>{c.answer}
                                </div>
                              )}
                            </td>
                          )
                          return (
                            <td key={a.id} className="p-2 border-b dark:border-slate-700 text-center">
                              <button data-testid={`gb-cell-${s.id}-${a.id}`} title={a.title}
                                onClick={()=>{ setEditCell({a:a.id,s:s.id}); setEditVal(c?.mark || (c?.score!=null? String(Math.round(c.score*10)/10) : '')) }}
                                className={`inline-flex items-center justify-center min-w-[64px] px-2 py-1 rounded-lg border text-xs font-bold ${c?.mark? 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' : ST_CLS[c?.status||'pending']} hover:ring-2 hover:ring-blue-200 dark:hover:ring-blue-700 transition cursor-pointer`}>
                                {c?.mark || (c?.score!=null? Math.round(c.score*10)/10 : ST_TXT[c?.status||'pending'])}
                              </button>
                            </td>
                          )
                        })}
                        <td className="p-2 border-b dark:border-slate-700 text-center" data-testid={`gb-avg-${s.id}`}>
                          {gb.avg_student?.[String(s.id)]!=null
                            ? <span className={`inline-block px-2 py-0.5 rounded-lg font-bold ${avgColor(gb.avg_student[String(s.id)])}`}>{gb.avg_student[String(s.id)]}</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/70 dark:bg-slate-800/60">
                      <td className="p-2 font-semibold text-slate-500 dark:text-slate-300 sticky left-0 z-10 bg-slate-50 dark:bg-slate-900">{t('cls_g_avg_class')}</td>
                      {gb.assignments.map((a:any)=>(
                        <td key={'avg'+a.id} data-testid={`gb-avgcol-${a.id}`} className="p-2 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                          {gb.avg_assignment?.[String(a.id)]!=null? gb.avg_assignment[String(a.id)] : '—'}
                        </td>
                      ))}
                      <td className="p-2"/>
                    </tr>
                  </tbody>
                </table>
                </div>
              )}
              {gb && gb.assignments.length>0 && gbList.length===0 && (
                <div className="text-center text-slate-400 py-6" data-testid="gb-search-empty">{t('cls_g_no_match')}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* «Кто сдал» — как в Google Classroom: список учеников по одному заданию */}
      {qbOpen && <QuizBuilder onClose={()=>setQbOpen(false)} onCreated={onQuizCreated}/>}
      {isOwner && subListFor && (
        <div className="fixed inset-0 z-50" data-testid="who-list">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setSubListFor(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 border-l dark:border-slate-700 shadow-2xl p-4 overflow-y-auto">
            <div className="flex items-start gap-2 mb-4">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('cls_who_title')}</div>
                <div className="font-bold dark:text-white break-words">{subListFor.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock size={12}/>{fmtDl(subListFor.deadline)}</div>
              </div>
              <button onClick={()=>setSubListFor(null)} aria-label={t('close')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white shrink-0"><X size={18}/></button>
            </div>
            <div className="space-y-2">
              {(gb?.students || []).map((s:any)=>{
                const c = (gb?.cells || []).find((x:any)=>x.assignment===subListFor.id && x.student===s.id)
                const st = c?.status || 'pending'
                const lbl = st==='submitted' ? t('cls_w_sub') : st==='late' ? t('cls_w_late') : st==='overdue' ? t('cls_w_ov') : t('cls_w_no')
                return (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border dark:border-slate-700" data-testid={`who-st-${s.id}`}>
                    <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold shrink-0">{s.username?.[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm dark:text-white truncate">{s.username}</div>
                      {c?.mark ? <div className="text-xs text-slate-400">{c.mark}</div> : null}
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${ST_CLS[st]}`}>
                      {ST_TXT[st]} {lbl}{c?.score!=null ? ` • ${c.score}` : ''}
                    </span>
                  </div>
                )
              })}
              {gb && !gb.students?.length && <div className="text-center text-slate-400 py-8 text-sm">{t('cls_no_members')}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
