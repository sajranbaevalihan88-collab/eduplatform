import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { Trash2, Save, Sparkles } from 'lucide-react'
import { toast } from '../context/UIContext'

type Opt={text:string,is_correct:boolean}
type Q={text:string,type:string,points:number,options:Opt[],explanation?:string}

export default function TestBuilder(){
  const {id}=useParams()
  const nav=useNavigate()
  const isNew=!id
  const [title,setTitle]=useState('Новый тест')
  const [desc,setDesc]=useState('')
  const [pass,setPass]=useState(60)
  const [timePerQ,setTimePerQ]=useState(30)
  const [questions,setQuestions]=useState<Q[]>([])
  const [showGen,setShowGen]=useState(false)
  const [genText,setGenText]=useState('')
  const [lessons,setLessons]=useState<any[]>([])
  const [genLesson,setGenLesson]=useState('')
  const [genCount,setGenCount]=useState(5)
  const [generating,setGenerating]=useState(false)
  const [genSource,setGenSource]=useState<string|null>(null)
  const [genPrompt,setGenPrompt]=useState('')
  const [saving,setSaving]=useState(false)
  const openGen=async()=>{
    setShowGen(true)
    try{
      const r=await client.get('/lessons/?owner=me')
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setLessons(arr)
    }catch{}
  }
  const doGenerate=async()=>{
    setGenerating(true)
    try{
      const payload:any={count:genCount}
      if(genLesson) payload.lesson_id=genLesson
      else payload.text=genText
      if(genPrompt.trim()) payload.prompt=genPrompt.trim().slice(0,2000)
      const r=await client.post('/tests/generate/',payload)
      const got=(r.data.questions||[]).map((q:any,i:number)=>({text:q.text,type:q.type,points:q.points||1,explanation:q.explanation||'',options:(q.options||[]).map((o:any)=>({text:o.text,is_correct:!!o.is_correct}))}))
      setQuestions(qs=>[...qs,...got])
      setGenSource(typeof r.data.source==='string' ? r.data.source : null)
      setShowGen(false); setGenText('')
    }catch(e:any){ alert(e.response?.data?.error||'Не получилось сгенерировать') }
    setGenerating(false)
  }
  const [searchParams]=useSearchParams()
  const fromPath=searchParams.get('from') && searchParams.get('from')!.startsWith('/') ? searchParams.get('from')! : null
  useEffect(()=>{
    if(!isNew) client.get(`/tests/${id}/`).then(r=>{
      setTitle(r.data.title); setDesc(r.data.description); setPass(r.data.pass_score); setTimePerQ(r.data.time_per_question||0)
      if(r.data.questions?.length) setQuestions(r.data.questions.map((q:any)=>({text:q.text,type:q.type,points:q.points,explanation:q.explanation||'',options:q.options.map((o:any)=>({text:o.text,is_correct:o.is_correct}))})))
    })
  },[id])
  const save=async()=>{
    if(saving) return
    setSaving(true)
    try{
      const payload={title,description:desc,pass_score:pass,time_limit:0,time_per_question:Math.max(0, timePerQ||0),questions:questions.map((q,i)=>({...q,order:i,explanation:(q as any).explanation||'',options:q.options.map((o,j)=>({...o,order:j}))}))}
      if(isNew){
        await client.post('/tests/',payload)
        toast('Тест сохранён ✓','success')
        nav('/tests')
      }
      else {await client.patch(`/tests/${id}/`,payload); toast('Сохранено ✓','success')}
    }catch(e:any){
      toast(e?.response?.data?.detail || 'Не сохранилось — проверь связь','error')
    }finally{
      setSaving(false)
    }
  }
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="sr-only">Конструктор теста</h1>
      {fromPath && <Link to={fromPath} className="inline-block px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">← Вернуться к уроку</Link>}
      <div className="bg-white rounded-2xl border p-6 space-y-3">
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 font-bold text-lg"/>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Описание теста" className="w-full px-4 py-2.5 rounded-xl border bg-slate-50"/>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Проходной %</label><input type="number" value={pass} onChange={e=>setPass(parseInt(e.target.value)||0)} className="w-24 px-3 py-2 rounded-xl border"/>
          <label className="text-sm" title="При прохождении каждый вопрос даётся по одному с этим таймером. 0 — без лимита.">Секунд на вопрос</label><input type="number" min={0} max={300} value={timePerQ} onChange={e=>setTimePerQ(Math.max(0, parseInt(e.target.value)||0))} className="w-24 px-3 py-2 rounded-xl border"/>
          <span className="text-xs text-slate-400">0 — без лимита (антиспид-чит: не даст скриншотить)</span>
        </div>
      </div>
      {questions.map((q,qi)=>(
        <div key={qi} className="bg-white rounded-2xl border p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">{qi+1}</span>
            <textarea value={q.text} onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,text:e.target.value}:x))} className="flex-1 px-3 py-2.5 rounded-xl border bg-slate-50 font-medium"/>
            <button onClick={()=>setQuestions(qs=>qs.filter((_,i)=>i!==qi))} className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 size={16}/></button>
          </div>
          <div className="flex gap-2 text-sm">
            <select value={q.type} onChange={e=>{
              const nt=e.target.value
              setQuestions(qs=>qs.map((x,i)=>{
                if(i!==qi) return x
                if(nt==='text') return {...x, type:nt, options:[]}
                if(nt==='true_false') return {...x, type:nt, options:[{text:'Верно',is_correct:true},{text:'Неверно',is_correct:false}]}
                if(x.options.length===0) return {...x, type:nt, options:[{text:'Вариант 1',is_correct:true},{text:'Вариант 2',is_correct:false}]}
                return {...x, type:nt}
              }))
            }} className="px-3 py-2 rounded-xl border bg-slate-50">
              <option value="single">Один ответ</option><option value="multiple">Несколько</option><option value="text">Текст</option><option value="true_false">Верно/Неверно</option>
            </select>
            <input type="number" value={q.points} onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,points:parseInt(e.target.value)||1}:x))} className="w-20 px-3 py-2 rounded-xl border" placeholder="Баллы"/>
          </div>
          {(q as any).explanation !== undefined && (q as any).explanation !== '' && (
            <div className="text-xs px-3 py-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-100">✨ ИИ: {(q as any).explanation}</div>
          )}
          {q.type==='text' ? (
            <div className="text-xs text-slate-400 px-1">Свободный ответ — ученик впишет текст сам, варианты не нужны.</div>
          ) : (
          <div className="space-y-2">
            {q.options.map((o,oi)=>(
              <div key={oi} className="flex items-center gap-2">
                <input type={q.type==='multiple'?'checkbox':'radio'} checked={o.is_correct} onChange={e=>{
                  setQuestions(qs=>qs.map((x,i)=>{
                    if(i!==qi) return x
                    if(q.type==='single' || q.type==='true_false')
                      return {...x, options:x.options.map((op,idx)=>({...op,is_correct:idx===oi}))}
                    return {...x, options:x.options.map((op,idx)=>idx===oi?{...op,is_correct:e.target.checked}:op)}
                  }))
                }} className="w-4 h-4"/>
                <input value={o.text} onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:x.options.map((op,idx)=>idx===oi?{...op,text:e.target.value}:op)}:x))} className="flex-1 px-3 py-2 rounded-xl border bg-slate-50"/>
                {(q.type==='single'||q.type==='multiple') && (
                <button onClick={()=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:x.options.filter((_,idx)=>idx!==oi)}:x))} className="p-1.5 rounded-lg bg-slate-100"><Trash2 size={14}/></button>
                )}
              </div>
            ))}
            {(q.type==='single'||q.type==='multiple') && (
            <button onClick={()=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:[...x.options,{text:'Новый вариант',is_correct:false}]}:x))} className="text-sm px-3 py-1.5 rounded-xl bg-slate-100">+ Вариант</button>
            )}
          </div>
          )}
        </div>
      ))}
      {questions.length===0 && (
        <div className="text-center py-8 bg-white rounded-2xl border text-slate-500 text-sm">
          Вопросов пока нет — нажми <b>«Создать с ИИ»</b>: напиши тему и что спросить, остальное сделает нейросеть.
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={openGen} className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-violet-600 text-white font-semibold flex items-center justify-center gap-2"><Sparkles size={18}/> Создать с ИИ</button>
        <button onClick={save} disabled={saving} className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Save size={18}/> {saving?'Сохраняю...':'Сохранить тест'}</button>
      </div>
      {genSource && (
        <div className={`text-xs font-bold px-3 py-2 rounded-xl ${genSource.startsWith('gemini') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {genSource.startsWith('gemini') ? `⚡ Последние вопросы сгенерированы нейросетью ${genSource.split(':')[1] || 'Gemini'}` : '🔧 Офлайн-режим: вопросы собраны из текста без нейросети'}
        </div>
      )}
      {showGen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 p-4" onClick={()=>setShowGen(false)}>
          <div onClick={e=>e.stopPropagation()} className="w-[560px] max-w-full bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-3 animate-scaleIn">
            <div className="font-bold dark:text-white">✨ Сгенерировать вопросы</div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ШАГ 1 — ОТКУДА БРАТЬ: урок или свой текст</label>
            {lessons.length>0 && (
              <select value={genLesson} onChange={e=>setGenLesson(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white">
                <option value="">— Без урока: только текст ниже —</option>
                {lessons.map((l:any)=><option key={l.id} value={l.id}>📖 {l.title}</option>)}
              </select>
            )}
            {!genLesson && <textarea value={genText} onChange={e=>setGenText(e.target.value)} placeholder="Текст урока (необязательно, если указание ниже про другую тему)..." className="w-full h-32 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white"/>}
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ШАГ 2 — ЧТО СПРОСИТЬ (указание для ИИ)</label>
            <textarea value={genPrompt} onChange={e=>setGenPrompt(e.target.value)} placeholder="Например: тест на тему «Атомы», 5 вопросов с одним ответом..." className="w-full h-20 px-3 py-2 rounded-xl border bg-violet-50/50 dark:bg-slate-700 dark:text-white text-sm" aria-label="Указание для ИИ"/>
            <div className="flex items-center gap-3">
              <label className="text-sm dark:text-slate-300">Вопросов (макс 40):</label>
              <input type="number" min={1} max={40} value={genCount} onChange={e=>setGenCount(Math.max(1, Math.min(40, parseInt(e.target.value)||5)))} className="w-20 px-3 py-2 rounded-xl border dark:bg-slate-700 dark:text-white"/>
              <button onClick={doGenerate} disabled={generating} className="ml-auto px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-50">{generating?'Думаю...':'Сгенерировать'}</button>
            </div>
            <div className="text-xs text-slate-400">Вопросы добавятся ниже — проверь и поправь перед сохранением. 30–40 вопросов думает дольше (до минуты).</div>
          </div>
        </div>
      )}
    </div>
  )
}
