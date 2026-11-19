import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { TrendingUp, GraduationCap, Play, Wrench, Target, CheckCircle2, BookOpenCheck, Trophy } from 'lucide-react'

const pctCls = (p: number) => p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-sky-500' : 'bg-red-500'
const pctTxt = (p: number) => p >= 80 ? 'text-emerald-600' : p >= 50 ? 'text-sky-600' : 'text-red-600'

export default function Progress() {
  const { t } = useLang()
  const [data, setData] = useState<any>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    client.get('/classrooms/my_progress/')
      .then(r => { setData(r.data); setErrMsg(null) })
      .catch((e: any) => {
        setData(null)
        setErrMsg(e?.response?.data?.detail || e?.response?.data?.error || 'Раздел «Мой прогресс» предназначен для учеников. Учителя и администраторы видят аналитику классов в разделе «ИИ-помощник и аналитика».')
      })
  }, [])

  if (errMsg) return (
    <div className="max-w-xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 text-center space-y-3">
      <div className="text-4xl">📊</div>
      <h2 className="font-bold text-lg dark:text-white">{t('progress_t')}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{errMsg}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Link to="/classes" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('classes')}</Link>
        <Link to="/ai-assistant" className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm font-semibold">{t('ai_nav')}</Link>
      </div>
    </div>
  )
  if (data === null) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto" /></div>

  const topics = data.topics || []
  const gaps = data.gaps || []
  const mastered = data.mastered || []
  const inProgress = topics.filter((tp: any) => tp.pct >= 50 && tp.pct < 80)
  const diags = data.diagnostics || []
  const avail = data.diagnostics_available || []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white"><TrendingUp className="text-indigo-600" />{t('progress_t')}</h1>
        {data.overall_avg != null && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-300">{t('pr_overall')}</span>
            <b className={pctTxt(data.overall_avg)}>{data.overall_avg}%</b>
            {data.overall_kr_grade && <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-bold">{t('pr_kr_grade')} «{data.overall_kr_grade}»</span>}
          </div>
        )}
      </div>

      {/* Визуальная цепочка пути обучения ученика */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wider opacity-80 font-semibold mb-2">{t('pr_route_sub')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl border border-white/20 ${diags.length > 0 ? 'bg-white/20' : 'bg-white/10'}`}>
            <div className="font-bold">{t('pr_step1')}</div>
            <div className="opacity-85 mt-0.5">{diags.length > 0 ? `${t('pr_taken')} ${diags.length}` : avail.length > 0 ? `${t('pr_avail')} ${avail.length}` : t('pr_wait')}</div>
          </div>
          <div className={`p-2.5 rounded-xl border border-white/20 ${gaps.length > 0 ? 'bg-white/20' : 'bg-white/10'}`}>
            <div className="font-bold">{t('pr_step2')}</div>
            <div className="opacity-85 mt-0.5">{gaps.length > 0 ? `${t('pr_to_pull')} ${gaps.length} ${t('pr_topics_unit')}` : t('pr_no_gaps')}</div>
          </div>
          <div className={`p-2.5 rounded-xl border border-white/20 ${(data.personal_tasks || []).length > 0 ? 'bg-white/20' : 'bg-white/10'}`}>
            <div className="font-bold">{t('pr_step3')}</div>
            <div className="opacity-85 mt-0.5">{t('pr_assigned')} {(data.personal_tasks || []).length}</div>
          </div>
          <div className={`p-2.5 rounded-xl border border-white/20 ${mastered.length > 0 ? 'bg-white/20' : 'bg-white/10'}`}>
            <div className="font-bold">{t('pr_step4')}</div>
            <div className="opacity-85 mt-0.5">{t('pr_mastered')} {mastered.length} {t('pr_topics_unit')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <CheckCircle2 size={18} className="mx-auto text-emerald-600" />
          <div className="text-xl font-bold mt-1.5 dark:text-white">{mastered.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{t('pr_card_mastered')}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <Target size={18} className="mx-auto text-red-600" />
          <div className="text-xl font-bold mt-1.5 dark:text-white">{gaps.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{t('pr_card_gaps')}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <GraduationCap size={18} className="mx-auto text-indigo-600" />
          <div className="text-xl font-bold mt-1.5 dark:text-white">{diags.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{t('pr_card_diags')}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <BookOpenCheck size={18} className="mx-auto text-violet-600" />
          <div className="text-xl font-bold mt-1.5 dark:text-white">{(data.personal_tasks || []).length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{t('pr_card_tasks')}</div>
        </div>
      </div>

      {avail.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-2 flex items-center gap-1.5"><Play size={15} className="text-indigo-600" />{t('pr_diag_in')}</h2>
          <div className="space-y-2">
            {avail.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-blue-900/20 border border-indigo-100 dark:border-indigo-800/50">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white truncate">{d.title}</div>
                  <div className="text-xs text-slate-500">{d.subject}{d.diagnostic_grade ? ` · ${d.diagnostic_grade} ${t('prog_grade_cls')}` : ''}</div>
                </div>
                <Link to={`/tests/${d.id}/take`} data-testid={`diag-take-${d.id}`}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-1">
                  <Play size={14} />{t('subj_take')}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{t('pr_diag_hint')}</p>
        </div>
      )}

      {diags.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-2 flex items-center gap-1.5"><Trophy size={15} className="text-emerald-600" />{t('pf_diags_title')}</h2>
          {diags.map((d: any) => (
            <div key={d.test_id} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="font-semibold dark:text-white flex-1 truncate">{d.title}</span>
              <span className={`font-bold ${pctTxt(d.score)}`}>{d.score}%</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{d.passed ? '✓' : '✕'}</span>
              <span className="text-xs text-slate-400">{new Date(d.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {mastered.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 p-4">
          <h2 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={15} />{t('pr_what_i_know')}</h2>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {mastered.map((m: any) => (
              <div key={m.topic_id} className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold dark:text-white">{m.title}</div>
                  <span className="text-xs font-bold text-emerald-600">{m.pct}% {m.kr_grade ? `· «${m.kr_grade}»` : ''}</span>
                </div>
                {(m.subject_name || m.grade) && <div className="text-[11px] text-slate-500">{m.subject_name}{m.grade ? ` · ${m.grade}` : ''}</div>}
                {m.criteria && <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">✓ {t('pr_skill')} {m.criteria}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-sky-200 dark:border-sky-900/40 p-4">
          <h2 className="font-bold text-sm text-sky-700 dark:text-sky-400 flex items-center gap-1.5"><TrendingUp size={15} />{t('pr_in_progress')}</h2>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {inProgress.map((m: any) => (
              <div key={m.topic_id} className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold dark:text-white">{m.title}</div>
                  <span className="text-xs font-bold text-sky-600">{m.pct}% {m.kr_grade ? `· «${m.kr_grade}»` : ''}</span>
                </div>
                {m.criteria && <div className="text-[11px] text-slate-500 mt-0.5">{t('pr_criteria')} {m.criteria}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/40 p-4">
          <h2 className="font-bold text-sm text-red-600 flex items-center gap-1.5"><Wrench size={15} />{t('pr_what_to_pull')}</h2>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {gaps.map((g: any) => (
              <div key={g.topic_id} className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-sm" data-testid={`gap-${g.topic_id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold dark:text-white">{g.title}</div>
                  <div className={`text-xs font-bold ${pctTxt(g.pct)}`}>{g.pct}% {t('pr_mastery')}</div>
                </div>
                {(g.subject_name || g.grade) && <div className="text-[11px] text-slate-500">{g.subject_name}{g.grade ? ` · ${g.grade}` : ''}</div>}
                {g.criteria && <div className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">{t('pr_need_skill')} {g.criteria}</div>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{t('pr_gap_hint')}</p>
        </div>
      )}

      {(data.personal_tasks || []).length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-2">{t('pr_personal_tasks')}</h2>
          <div className="space-y-2">
            {data.personal_tasks.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700" data-testid={`pers-${a.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white truncate">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.classroom_title}{a.topic_title ? ` · ${t('pr_topic')} ${a.topic_title}` : ''}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{a.status}</span>
                {a.score != null && <span className="font-bold text-sm dark:text-white">{a.score}</span>}
                {a.kind === 'test' && a.object_id ? (
                  <Link to={`/tests/${a.object_id}/take`} className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold">{t('subj_take')}</Link>
                ) : a.kind === 'lesson' && a.object_id ? (
                  <Link to={`/lessons/${a.object_id}`} className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold">{t('subj_open')}</Link>
                ) : (
                  <Link to={`/classes/${a.classroom_id}`} className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold">{t('pr_to_task')}</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {topics.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-3">{t('pr_all_topics')}</h2>
          <div className="space-y-2.5">
            {topics.map((tp: any) => (
              <div key={tp.topic_id} data-testid={`topic-row-${tp.topic_id}`}>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="flex-1 font-medium truncate dark:text-white">
                    {tp.title}
                    {tp.subject_name && <span className="text-xs text-slate-400 ml-1.5">({tp.subject_name}{tp.grade ? `, ${tp.grade}` : ''})</span>}
                  </span>
                  {tp.kr_grade && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold dark:text-slate-300">{t('prog_grade_n')} «{tp.kr_grade}»</span>}
                  <span className={`font-bold ${pctTxt(tp.pct)}`}>{tp.pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${pctCls(tp.pct)}`} style={{ width: `${Math.max(2, tp.pct)}%` }} />
                </div>
                {tp.criteria && <div className="text-[11px] text-slate-400 mt-0.5">{t('pr_criteria')} {tp.criteria}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {topics.length === 0 && diags.length === 0 && avail.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center">
          <TrendingUp size={40} className="mx-auto mb-3 text-slate-300" />
          <div className="font-bold dark:text-white">{t('progress_t')}</div>
          <p className="text-sm text-slate-500 mt-1">{t('pr_empty')}</p>
        </div>
      )}
    </div>
  )
}
