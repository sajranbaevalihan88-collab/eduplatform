import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { Trash2, Save, Sparkles } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type Opt={text:string,is_correct:boolean}
type Q={text:string,type:string,points:number,options:Opt[],explanation?:string}

export default function TestBuilder(){
  const {id}=useParams()
  const nav=useNavigate()
  const {t}=useLang()
  const isNew=!id
  const [title,setTitle]=useState(t('tb_new_test'))
  const [desc,setDesc]=useState('')
  const [pass,setPass]=useState(60)
  const [timePerQ,setTimePerQ]=useState(30)
  const [questions,setQuestions]=useState<Q[]>([])
  const [showGen,setShowGen]=useState(false)
  const [genCount,setGenCount]=useState(5)
  const [generating,setGenerating]=useState(false)
  const [genSource,setGenSource]=useState<string|null>(null)
  const [genPrompt,setGenPrompt]=useState('')
  const [saving,setSaving]=useState(false)
  const [mode,setMode]=useState<'pick'|'form'|null>(isNew? 'pick' : 'form')
  const justPick=mode==='pick'
  const doGenerate=async()=>{
    if(genPrompt.trim().length < 10){ alert(t('tb_gen_prompt_min')); return }
    setGenerating(true)
    try{
      const payload:any={count:genCount, prompt:genPrompt.trim().slice(0,2000)}
      const r=await client.post('/tests/generate/',payload)
      const got=(r.data.questions||[]).map((q:any,i:number)=>({text:q.text,type:q.type,points:q.points||1,explanation:q.explanation||'',options:(q.options||[]).map((o:any)=>({text:o.text,is_correct:!!o.is_correct}))}))
      setQuestions(qs=>[...qs,...got])
      setGenSource(typeof r.data.source==='string' ? r.data.source : null)
      setShowGen(false)
    }catch(e:any){ alert(e.response?.data?.error||t('tb_gen_fail')) }
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
        toast(t('tb_saved'),'success')
        nav('/tests')
      }
      else {await client.patch(`/tests/${id}/`,payload); toast(t('tb_saved_short'),'success')}
    }catch(e:any){
      toast(e?.response?.data?.detail || t('tb_save_fail'),'error')
    }finally{
      setSaving(false)
    }
  }
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="sr-only">{t('tb_title')}</h1>
      {fromPath && <Link to={fromPath} className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">{t('tb_back_lesson')}</Link>}
      {justPick ? (
        <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-6 space-y-4">
          <div className="text-center pt-2">
            <div className="text-5xl mb-2">🧪</div>
            <div className="font-display font-extrabold text-xl dark:text-white">{t('tb_mode_title')}</div>
          </div>
          <button onClick={()=>{setMode('form')}} data-testid="tb-manual"
            className="w-full text-left px-5 py-4 min-h-[92px] rounded-2xl border-2 border-blue-400/60 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 hover:border-blue-500 flex items-center gap-4 transition-colors">
            <span className="text-4xl">✍️</span>
            <span>
              <span className="block font-extrabold text-lg dark:text-white">{t('tb_mode_manual')}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('tb_mode_manual_sub')}</span>
            </span>
          </button>
          <button onClick={()=>{setMode('form'); setShowGen(true)}} data-testid="tb-ai"
            className="w-full text-left px-5 py-4 min-h-[92px] rounded-2xl border-2 border-emerald-400/60 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 hover:border-emerald-500 flex items-center gap-4 transition-colors">
            <span className="text-4xl">✨</span>
            <span>
              <span className="block font-extrabold text-lg dark:text-white">{t('tb_mode_ai')}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('tb_mode_ai_sub')}</span>
            </span>
          </button>
        </div>
      ) : (<>
      <div className="bg-white rounded-2xl border p-6 space-y-3">
        <div className="flex gap-2">
          {isNew && (
            <button onClick={()=>setMode('pick')} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" title={t('tb_back_pick')}>← {t('tb_back_pick')}</button>
          )}
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 font-bold text-lg"/>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder={t('tb_desc_ph')} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50"/>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">{t('tb_pass')}</label><input type="number" value={pass} onChange={e=>setPass(parseInt(e.target.value)||0)} className="w-24 px-3 py-2 rounded-xl border"/>
          <label className="text-sm" title={t('tb_sec_per_q')}>{t('tb_sec_per_q')}</label><input type="number" min={0} max={300} value={timePerQ} onChange={e=>setTimePerQ(Math.max(0, parseInt(e.target.value)||0))} className="w-24 px-3 py-2 rounded-xl border"/>
          <span className="text-xs text-slate-400">{t('tb_no_limit_hint')}</span>
        </div>
      </div>
      {questions.map((q,qi)=>(
        <div key={qi} className="bg-white rounded-2xl border p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold shrink-0">{qi+1}</span>
            <textarea value={q.text} onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,text:e.target.value}:x))} className="flex-1 px-3 py-2.5 rounded-xl border bg-slate-50 font-medium"/>
            <button onClick={()=>setQuestions(qs=>qs.filter((_,i)=>i!==qi))} className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 size={16}/></button>
          </div>
          <div className="flex gap-2 text-sm">
            <select value={q.type} onChange={e=>{
              const nt=e.target.value
              setQuestions(qs=>qs.map((x,i)=>{
                if(i!==qi) return x
                if(nt==='true_false') return {...x, type:nt, options:[{text:t('tb_opt_true'),is_correct:true},{text:t('tb_opt_false'),is_correct:false}]}
                if(x.options.length===0) return {...x, type:nt, options:[{text:t('tb_opt_1'),is_correct:true},{text:t('tb_opt_2'),is_correct:false}]}
                return {...x, type:nt}
              }))
            }} className="px-3 py-2 rounded-xl border bg-slate-50">
              <option value="single">{t('tb_single')}</option><option value="multiple">{t('tb_multiple')}</option><option value="true_false">{t('tb_tf')}</option>
            </select>
            <input type="number" value={q.points} onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,points:parseInt(e.target.value)||1}:x))} className="w-20 px-3 py-2 rounded-xl border" placeholder={t('points')}/>
          </div>
          {(q as any).explanation !== undefined && (q as any).explanation !== '' && (
            <div className="text-xs px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">{t('tb_ai')} {(q as any).explanation}</div>
          )}
          {q.type==='text' ? (
            <div className="text-xs px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              Текстовый тип отключён. Смени тип выше на «Один ответ» / «Несколько» / «Верно/Неверно» и задай варианты.
            </div>
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
            <button onClick={()=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:[...x.options,{text:t('tb_new_opt'),is_correct:false}]}:x))} className="text-sm px-3 py-1.5 rounded-xl bg-slate-100">{t('tb_add_opt')}</button>
            )}
          </div>
          )}
        </div>
      ))}
      {questions.length===0 && (
        <div className="text-center py-8 bg-white rounded-2xl border text-slate-500 text-sm">
          {t('tb_empty_pre')} <b>«{t('tb_create_ai')}»</b>{t('tb_empty_post')}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={()=>setShowGen(true)} className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2"><Sparkles size={18}/> {t('tb_create_ai')}</button>
        <button onClick={save} disabled={saving} className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Save size={18}/> {saving?t('tb_saving'):t('tb_save_test')}</button>
      </div>
      {genSource && (
        <div className={`text-xs font-bold px-3 py-2 rounded-xl ${genSource.startsWith('gemini') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {genSource.startsWith('gemini') ? `${t('tb_gen_ai_pre')} ${genSource.split(':')[1] || 'Gemini'}` : t('tb_gen_offline')}
        </div>
      )}
      {showGen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 p-4" onClick={()=>setShowGen(false)}>
          <div onClick={e=>e.stopPropagation()} className="relative w-[560px] max-w-full bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-3 animate-scaleIn modal-safe">
            <button onClick={()=>setShowGen(false)} aria-label={t('close')} title={t('close')} className="absolute top-2 right-2 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-white text-lg font-bold">✕</button>
            <div className="font-bold dark:text-white">{t('tb_gen_title')}</div>
            <textarea value={genPrompt} onChange={e=>setGenPrompt(e.target.value)} placeholder={t('tb_gen_ph')} className="w-full h-28 px-3 py-2 rounded-xl border bg-blue-50/50 dark:bg-slate-700 dark:text-white text-sm" aria-label={t('tb_gen_aria')}/>
            <div className="flex items-center gap-3">
              <label className="text-sm dark:text-slate-300">{t('tb_gen_count')}</label>
              <input type="number" min={1} max={40} value={genCount} onChange={e=>setGenCount(Math.max(1, Math.min(40, parseInt(e.target.value)||5)))} className="w-20 px-3 py-2 rounded-xl border dark:bg-slate-700 dark:text-white"/>
              <button onClick={doGenerate} disabled={generating} className="ml-auto px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">{generating?t('tb_thinking'):t('tb_generate')}</button>
            </div>
            <div className="text-xs text-slate-400">{t('tb_gen_hint')}</div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
