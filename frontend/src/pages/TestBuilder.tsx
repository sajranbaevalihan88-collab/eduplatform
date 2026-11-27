import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { Trash2, Save, Sparkles, Plus, Copy, Globe, Lock } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { AI_FEATURES } from '../utils/features'

type Opt={text:string,is_correct:boolean}
type Q={text:string,type:string,points:number,topic?:number|null,options:Opt[],explanation?:string}

export default function TestBuilder(){
  const {id}=useParams()
  const nav=useNavigate()
  const {t}=useLang()
  const isNew=!id
  const [title,setTitle]=useState(t('tb_new_test'))
  const [desc,setDesc]=useState('')
  const [pass,setPass]=useState(60)
  const [timePerQ,setTimePerQ]=useState(30)
  const [isPublic,setIsPublic]=useState(true)
  const [isDiag,setIsDiag]=useState(false)
  const [diagGrade,setDiagGrade]=useState('')
  const [topics,setTopics]=useState<any[]>([])
  const [questions,setQuestions]=useState<Q[]>([])
  const [showGen,setShowGen]=useState(false)
  const [genCount,setGenCount]=useState(10)
  const [genCountInput,setGenCountInput]=useState('10')
  const [generating,setGenerating]=useState(false)
  const [genSource,setGenSource]=useState<string|null>(null)
  const [genPrompt,setGenPrompt]=useState('')
  const [saving,setSaving]=useState(false)
  const [subject,setSubject]=useState<any>(null)
  const [subjects,setSubjects]=useState<any[]>([])
  const [mode,setMode]=useState<'pick'|'form'|null>(isNew? 'pick' : 'form')
  const justPick=mode==='pick'

  const makeEmptyQuestion = (): Q => ({
    text: '',
    type: 'single',
    points: 1,
    topic: null,
    explanation: '',
    options: [
      { text: t('tb_opt_1'), is_correct: true },
      { text: t('tb_opt_2'), is_correct: false },
      { text: 'Вариант 3', is_correct: false },
      { text: 'Вариант 4', is_correct: false },
    ],
  })

  const addManualQuestion = () => {
    setQuestions(qs => [...qs, makeEmptyQuestion()])
  }

  const duplicateQuestion = (qi: number) => {
    setQuestions(qs => {
      const src = qs[qi]
      if (!src) return qs
      const clone: Q = {
        ...src,
        options: src.options.map(o => ({ ...o })),
      }
      return [...qs.slice(0, qi + 1), clone, ...qs.slice(qi + 1)]
    })
  }

  const moveQuestion = (qi: number, dir: -1 | 1) => {
    setQuestions(qs => {
      const ni = qi + dir
      if (ni < 0 || ni >= qs.length) return qs
      const next = [...qs]
      const tmp = next[qi]
      next[qi] = next[ni]
      next[ni] = tmp
      return next
    })
  }

  const parsePromptCount=(s:string,fallback:number):number=>{
    const m=s.toLowerCase().match(/\b(\d{1,2})\s*(?:вопрос\S*|вопр\.?|суроо\S*|question\S*|задани\S*|шт\.?|штук\S*)/i)
    if(m){ const n=parseInt(m[1],10); if(n>=1&&n<=40) return n }
    return Math.max(1,Math.min(40,fallback||10))
  }
  const onPromptChange=(val:string)=>{
    setGenPrompt(val)
    const m=val.toLowerCase().match(/\b(\d{1,2})\s*(?:вопрос\S*|вопр\.?|суроо\S*|question\S*|задани\S*|шт\.?|штук\S*)/i)
    if(m){
      const c=parseInt(m[1],10)
      if(c>=1&&c<=40){ setGenCount(c); setGenCountInput(String(c)) }
    }
  }
  const doGenerate=async()=>{
    if(genPrompt.trim().length < 2){ toast(t('tb_gen_prompt_min'), 'error'); return }
    const typedNum = parseInt(genCountInput, 10)
    const baseCount = (!isNaN(typedNum) && typedNum >= 1) ? Math.min(40, typedNum) : genCount
    const targetCount=parsePromptCount(genPrompt,baseCount)
    setGenCount(targetCount)
    setGenCountInput(String(targetCount))
    setGenerating(true)
    try{
      const payload:any={count:targetCount, prompt:genPrompt.trim().slice(0,2000)}
      const r=await client.post('/tests/generate/',payload)
      const got=(r.data.questions||[]).map((q:any)=>({text:q.text,type:q.type,points:q.points||1,explanation:q.explanation||'',options:(q.options||[]).map((o:any)=>({text:o.text,is_correct:!!o.is_correct}))}))
      setQuestions(qs=>[...qs,...got])
      setGenSource(typeof r.data.source==='string' ? r.data.source : null)
      toast(`✨ Сгенерировано вопросов: ${got.length}`, 'success')
      setShowGen(false)
    }catch(e:any){ toast(e.response?.data?.error||t('tb_gen_fail'), 'error') }
    setGenerating(false)
  }
  const [searchParams]=useSearchParams()
  const subjectBack=searchParams.get('subject')?`/subjects/${searchParams.get('subject')}`:null
  useEffect(()=>{
    const tParam=searchParams.get('title')
    if(tParam && isNew){
      setTitle(tParam)
      setGenPrompt(tParam)
    }
    client.get('/subjects/').then(r=>{
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setSubjects(arr)
      const s=searchParams.get('subject')
      if(s && isNew){
        const f=arr.find((x:any)=>String(x.slug)===String(s)||String(x.id)===String(s))
        if(f) setSubject(f.id)
      }
    }).catch(()=>{})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  const rawFrom=searchParams.get('from')||''
  const fromPath=rawFrom.startsWith('/') && !rawFrom.startsWith('//') && !rawFrom.startsWith('/\\') ? rawFrom : null
  useEffect(()=>{
    if(!isNew) client.get(`/tests/${id}/`).then(r=>{
      setTitle(r.data.title); setDesc(r.data.description||''); setPass(r.data.pass_score); setTimePerQ(r.data.time_per_question||0); if(r.data.subject!=null) setSubject(Number(r.data.subject))
      if(typeof r.data.is_public === 'boolean') setIsPublic(r.data.is_public)
      setIsDiag(!!(r.data as any).is_diagnostic); setDiagGrade((r.data as any).diagnostic_grade||'')
      if(r.data.questions?.length) setQuestions(r.data.questions.map((q:any)=>({text:q.text,type:q.type,points:q.points,topic:q.topic??null,explanation:q.explanation||'',options:q.options.map((o:any)=>({text:o.text,is_correct:o.is_correct}))})))
    })
  },[id])
  useEffect(()=>{
    const params:any = {}
    if(subject) params.subject = subject
    client.get('/topics/', { params }).then(r=>setTopics(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>setTopics([]))
  },[subject])
  const save=async()=>{
    if(saving) return
    if(!title.trim()){ toast('Укажи название теста', 'error'); return }
    const cleaned = questions.filter(q => q.text.trim())
    if(cleaned.length === 0){ toast('Добавь хотя бы 1 вопрос с текстом', 'error'); return }
    setSaving(true)
    try{
      const payload={
        title: title.trim(),
        description: desc,
        subject: subject||null,
        pass_score: pass,
        time_limit: 0,
        time_per_question: Math.max(0, timePerQ||0),
        is_public: isPublic,
        is_diagnostic: isDiag,
        diagnostic_grade: isDiag ? diagGrade.trim() : '',
        questions: cleaned.map((q,i)=>({...q,topic:q.topic||null,order:i,explanation:(q as any).explanation||'',options:q.options.map((o,j)=>({...o,order:j}))}))
      }
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
      <div className="flex items-center justify-between gap-2">
        <Link to={(fromPath||subjectBack||'/tests')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition">
          ← {t('nav_back')}
        </Link>
        {!justPick && questions.length > 0 && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            Вопросов: {questions.length}
          </span>
        )}
      </div>

      {justPick ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="text-center pt-2">
            <div className="font-display font-extrabold text-xl text-slate-900 dark:text-white">{t('tb_mode_title')}</div>
          </div>
          <button
            type="button"
            onClick={()=>{
              setMode('form')
              if(questions.length === 0) setQuestions([makeEmptyQuestion()])
            }}
            data-testid="tb-manual"
            className="w-full text-left px-5 py-4 min-h-[92px] rounded-2xl border-2 border-indigo-300/80 dark:border-indigo-700/80 bg-indigo-50/80 hover:bg-indigo-50 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 hover:border-indigo-500 flex items-center gap-4 transition-colors"
          >
            <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shrink-0">✏️</span>
            <span>
              <span className="block font-extrabold text-lg text-slate-900 dark:text-white">{t('tb_mode_manual')}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t('tb_mode_manual_sub')}</span>
            </span>
          </button>
          {AI_FEATURES && (
          <button
            type="button"
            onClick={()=>{setMode('form'); setShowGen(true)}}
            data-testid="tb-ai"
            className="w-full text-left px-5 py-4 min-h-[92px] rounded-2xl border-2 border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50/80 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 hover:border-emerald-500 flex items-center gap-4 transition-colors"
          >
            <span className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shrink-0">✨</span>
            <span>
              <span className="block font-extrabold text-lg text-slate-900 dark:text-white">{t('tb_mode_ai')}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t('tb_mode_ai_sub')}</span>
            </span>
          </button>
          )}
        </div>
      ) : (<>
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isNew ? (
            <button type="button" onClick={()=>setMode('pick')} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition" title={t('tb_back_pick')}>
              ← {t('tb_back_pick')}
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={()=>setIsPublic(v=>!v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              isPublic
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            }`}
          >
            {isPublic ? <><Globe size={13}/> {t('tests_public')}</> : <><Lock size={13}/> {t('tests_private')}</>}
          </button>
        </div>
        <input
          value={title}
          onChange={e=>setTitle(e.target.value)}
          placeholder={t('tb_new_test')}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-bold text-lg focus-ring"
        />
        <textarea
          value={desc}
          onChange={e=>setDesc(e.target.value)}
          placeholder={t('tb_desc_ph')}
          rows={2}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus-ring"
        />
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('subj_label')}</label>
          <select
            value={subject||''}
            onChange={e=>setSubject(e.target.value?Number(e.target.value):null)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus-ring"
          >
            <option value="">{t('subj_no_subject')}</option>
            {subjects.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-slate-700 dark:text-slate-200">
          <label className="flex items-center gap-2 text-sm font-medium">
            <span>{t('tb_pass')}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={pass}
              onChange={e=>setPass(parseInt(e.target.value)||0)}
              className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center font-semibold focus-ring"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium" title={t('tb_sec_per_q')}>
            <span>{t('tb_sec_per_q')}</span>
            <input
              type="number"
              min={0}
              max={300}
              value={timePerQ}
              onChange={e=>setTimePerQ(Math.max(0, parseInt(e.target.value)||0))}
              className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center font-semibold focus-ring"
            />
          </label>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t('tb_no_limit_hint')}</span>
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={isDiag} onChange={e=>setIsDiag(e.target.checked)}
            data-testid="tb-diag" className="w-4 h-4 accent-indigo-600"/>
          <span className="font-semibold">Входная диагностика</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">(результат попадёт в путь обучения ученика)</span>
          {isDiag && (
            <input value={diagGrade} onChange={e=>setDiagGrade(e.target.value)} placeholder="Класс: 8"
              data-testid="tb-diag-grade" aria-label="Класс диагностики"
              className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"/>
          )}
        </label>
      </div>

      {questions.map((q,qi)=>(
        <div key={qi} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">{qi+1}</span>
            <textarea
              value={q.text}
              onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,text:e.target.value}:x))}
              placeholder={`Текст вопроса #${qi+1}...`}
              rows={2}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium text-sm sm:text-base focus-ring"
            />
            <div className="flex flex-col sm:flex-row gap-1 shrink-0">
              <button type="button" onClick={()=>moveQuestion(qi,-1)} disabled={qi===0} title="Выше" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 text-xs font-bold">↑</button>
              <button type="button" onClick={()=>moveQuestion(qi,1)} disabled={qi===questions.length-1} title="Ниже" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 text-xs font-bold">↓</button>
              <button type="button" onClick={()=>duplicateQuestion(qi)} title="Дублировать вопрос" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Copy size={15}/></button>
              <button type="button" onClick={()=>setQuestions(qs=>qs.filter((_,i)=>i!==qi))} title={t('delete')} className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"><Trash2 size={15}/></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <select
              value={q.type}
              onChange={e=>{
                const nt=e.target.value
                setQuestions(qs=>qs.map((x,i)=>{
                  if(i!==qi) return x
                  if(nt==='true_false') return {...x, type:nt, options:[{text:t('tb_opt_true'),is_correct:true},{text:t('tb_opt_false'),is_correct:false}]}
                  if(x.options.length===0) return {...x, type:nt, options:[{text:t('tb_opt_1'),is_correct:true},{text:t('tb_opt_2'),is_correct:false}]}
                  return {...x, type:nt}
                }))
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="single">{t('tb_single')}</option>
              <option value="multiple">{t('tb_multiple')}</option>
              <option value="true_false">{t('tb_tf')}</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('points')}:
              <input
                type="number"
                min={1}
                value={q.points}
                onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,points:parseInt(e.target.value)||1}:x))}
                className="w-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold text-center"
                placeholder={t('points')}
              />
            </label>
            {topics.length>0 && (
              <select
                value={q.topic||''}
                onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,topic:e.target.value?Number(e.target.value):null}:x))}
                data-testid={`q-topic-${qi}`}
                aria-label="Тема вопроса"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value="">Без темы</option>
                {topics.map((tp:any)=><option key={tp.id} value={tp.id}>{tp.num}. {tp.title}</option>)}
              </select>
            )}
          </div>
          {(q as any).explanation !== undefined && (q as any).explanation !== '' && (
            <div className="text-xs px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60">
              {t('tb_ai')} {(q as any).explanation}
            </div>
          )}
          {q.type==='text' ? (
            <div className="text-xs px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
              Текстовый тип отключён. Смени тип выше на «Один ответ» / «Несколько» / «Верно/Неверно» и задай варианты.
            </div>
          ) : (
          <div className="space-y-2">
            {q.options.map((o,oi)=>(
              <div
                key={oi}
                className={`flex items-center gap-2 p-1.5 rounded-xl border transition ${
                  o.is_correct
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/70'
                    : 'bg-transparent border-transparent'
                }`}
              >
                <input
                  type={q.type==='multiple'?'checkbox':'radio'}
                  name={`tb-q-${qi}`}
                  checked={o.is_correct}
                  onChange={e=>{
                    setQuestions(qs=>qs.map((x,i)=>{
                      if(i!==qi) return x
                      if(q.type==='single' || q.type==='true_false')
                        return {...x, options:x.options.map((op,idx)=>({...op,is_correct:idx===oi}))}
                      return {...x, options:x.options.map((op,idx)=>idx===oi?{...op,is_correct:e.target.checked}:op)}
                    }))
                  }}
                  className="w-4 h-4 ml-1 accent-emerald-600 shrink-0 cursor-pointer"
                  title="Отметить как правильный ответ"
                />
                <input
                  value={o.text}
                  onChange={e=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:x.options.map((op,idx)=>idx===oi?{...op,text:e.target.value}:op)}:x))}
                  placeholder={`Вариант ${oi+1}`}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus-ring"
                />
                {(q.type==='single'||q.type==='multiple') && (
                <button
                  type="button"
                  onClick={()=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:x.options.filter((_,idx)=>idx!==oi)}:x))}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition"
                  title={t('remove')}
                >
                  <Trash2 size={14}/>
                </button>
                )}
              </div>
            ))}
            {(q.type==='single'||q.type==='multiple') && (
            <button
              type="button"
              onClick={()=>setQuestions(qs=>qs.map((x,i)=>i===qi?{...x,options:[...x.options,{text:t('tb_new_opt'),is_correct:false}]}:x))}
              className="text-sm px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition"
            >
              {t('tb_add_opt')}
            </button>
            )}
          </div>
          )}
        </div>
      ))}

      {questions.length===0 && (
        <div className="text-center py-8 px-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 text-sm space-y-3">
          <div>{t('tb_empty_pre')} <b>«{t('tb_create_ai')}»</b>{t('tb_empty_post')}</div>
          <button
            type="button"
            onClick={addManualQuestion}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-sm transition"
          >
            <Plus size={16}/> Добавить вопрос вручную
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={addManualQuestion}
          data-testid="tb-add-q"
          className="px-4 py-3 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold flex items-center justify-center gap-2 transition"
        >
          <Plus size={18}/> Добавить вопрос
        </button>
        {AI_FEATURES && (
          <button
            type="button"
            onClick={()=>setShowGen(true)}
            className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <Sparkles size={18}/> {t('tb_create_ai')}
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition"
        >
          <Save size={18}/> {saving?t('tb_saving'):t('tb_save_test')}
        </button>
      </div>

      {AI_FEATURES && genSource && (
        <div className={`text-xs font-bold px-3 py-2 rounded-xl border ${genSource.startsWith('gemini') ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>
          {genSource.startsWith('gemini') ? t('tb_gen_ai_pre') : t('tb_gen_offline')}
        </div>
      )}

      {AI_FEATURES && showGen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-16 p-4" onClick={()=>setShowGen(false)}>
          <div onClick={e=>e.stopPropagation()} className="relative w-[560px] max-w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 animate-scaleIn modal-safe shadow-2xl">
            <button type="button" onClick={()=>setShowGen(false)} aria-label={t('close')} title={t('close')} className="absolute top-2.5 right-2.5 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-lg font-bold transition">✕</button>
            <div className="font-bold text-slate-900 dark:text-white pr-10">{t('tb_gen_title')}</div>
            <textarea
              value={genPrompt}
              onChange={e=>onPromptChange(e.target.value)}
              placeholder="Напр.: «сделай мне вопросы по пайтону 14 вопросов»"
              className="w-full h-28 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus-ring"
              aria-label={t('tb_gen_aria')}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-700 dark:text-slate-300">{t('tb_gen_count')}</label>
              <input
                type="text"
                inputMode="numeric"
                value={genCountInput}
                onChange={e=>{
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  setGenCountInput(raw)
                  if(raw !== ''){
                    const n = Math.max(1, Math.min(40, parseInt(raw, 10) || 1))
                    setGenCount(n)
                  }
                }}
                onBlur={()=>{
                  const n = Math.max(1, Math.min(40, parseInt(genCountInput, 10) || genCount || 10))
                  setGenCount(n)
                  setGenCountInput(String(n))
                }}
                placeholder="10"
                className="w-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center font-bold focus-ring"
              />
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20, 30, 40].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setGenCount(n); setGenCountInput(String(n)) }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                      genCount === n && genCountInput === String(n)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={doGenerate} disabled={generating} className="ml-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 transition">
                {generating?t('tb_thinking'):t('tb_generate')}
              </button>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{t('tb_gen_hint')}</div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
