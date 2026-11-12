import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { toast } from '../context/UIContext'
import {
  Sparkles, Users, AlertTriangle, Trophy, CheckCircle2, BookOpen,
  FileText, FlaskConical, Send, Download, Copy, ShieldCheck,
  TrendingUp, CalendarX, Target, Plus, Trash2, Save
} from 'lucide-react'

type GradeItem = {
  assignment_id: number; title: string; kind: string; topic_title: string
  score: number | null; max_score: number; pct: number | null; mark: string; status: string
}

type StudentAnalysis = {
  student_id: number; username: string; first_name: string
  classroom_id: number; classroom_title: string; subject_name: string
  avg_pct: number | null; avg_raw: number | null; kr_grade: number | null
  status_level: 'leader' | 'stable' | 'pull_up'
  needs_pull_up: boolean; pull_up_reasons: string[]; advice: string
  done_count: number; late_count: number; missed_count: number; pending_count: number
  attendance: { present: number; absent: number; late: number; excused: number }
  grades: GradeItem[]
  mastered_topics: Array<{ topic_id: number; title: string; pct: number }>
  learning_topics: Array<{ topic_id: number; title: string; pct: number }>
  gap_topics: Array<{ topic_id: number; title: string; pct: number }>
}

const krBadgeCls = (g: number | null) =>
  g === 5 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300'
  : g === 4 ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300'
  : g === 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300'
  : g === 2 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300'
  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300'

export default function TeacherAI() {
  const [tab, setTab] = useState<'students' | 'drafts' | 'analytics'>('students')
  const [classId, setClassId] = useState<string>('')
  const [filterMode, setFilterMode] = useState<'all' | 'pull_up' | 'leader'>('all')
  const [searchQ, setSearchQ] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // ИИ-анализ
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiSource, setAiSource] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  // Вкладка Черновики ИИ
  const [draftKind, setDraftKind] = useState<'assignment' | 'explanation' | 'test'>('assignment')
  const [topics, setTopics] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [dClassId, setDClassId] = useState<string>('')
  const [dStudentId, setDStudentId] = useState<string>('')
  const [dStudentName, setDStudentName] = useState<string>('')
  const [dTopicId, setDTopicId] = useState<string>('')
  const [dTopicTitle, setDTopicTitle] = useState<string>('')
  const [dGrade, setDGrade] = useState<string>('8')
  const [dPrompt, setDPrompt] = useState<string>('')
  const [dBusy, setDBusy] = useState(false)

  // Результат черновика задания (проверяется и утверждается учителем)
  const [draftTaskTitle, setDraftTaskTitle] = useState('')
  const [draftTaskInstr, setDraftTaskInstr] = useState('')
  const [draftTaskMax, setDraftTaskMax] = useState(5)
  const [draftTaskDeadline, setDraftTaskDeadline] = useState('')
  const [draftSaving, setDraftSaving] = useState(false)

  // Результат черновика объяснения
  const [draftExplText, setDraftExplText] = useState('')

  // Результат черновика теста
  const [dSubjectId, setDSubjectId] = useState<string>('')
  const [dTestCount, setDTestCount] = useState(5)
  const [dTestIsDiag, setDTestIsDiag] = useState(false)
  const [draftTestTitle, setDraftTestTitle] = useState('')
  const [draftQuestions, setDraftQuestions] = useState<any[]>([])

  // Школьная аналитика
  const [schoolStats, setSchoolStats] = useState<any>(null)

  const loadAnalysis = (cid: string) => {
    setLoading(true)
    const params: any = {}
    if (cid) params.classroom_id = cid
    client.get('/ai/teacher-assistant/', { params })
      .then(r => {
        setData(r.data)
        if (!dClassId && r.data?.classes?.length) {
          setDClassId(String(r.data.classes[0].id))
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAnalysis(classId)
  }, [classId])

  useEffect(() => {
    client.get('/topics/').then(r => setTopics(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    client.get('/subjects/').then(r => setSubjects(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    client.get('/classrooms/school_analytics/').then(r => setSchoolStats(r.data)).catch(() => {})
  }, [])

  const runAIAnalysis = async () => {
    if (aiBusy) return
    setAiBusy(true)
    try {
      const r = await client.post('/ai/teacher-assistant/', {
        mode: 'analyze',
        classroom_id: classId || undefined,
        prompt: aiPrompt.trim(),
      })
      setAiReport(r.data.report || '')
      setAiSource(r.data.source || 'offline')
      if (r.data.students) setData(r.data)
      toast('ИИ-анализ учеников готов', 'success')
    } catch (e: any) {
      toast(e?.response?.data?.detail || e?.response?.data?.error || 'Ошибка анализа', 'error')
    }
    setAiBusy(false)
  }

  const openPullUpDraft = (stu: StudentAnalysis) => {
    setTab('drafts')
    setDraftKind('assignment')
    setDClassId(String(stu.classroom_id))
    setDStudentId(String(stu.student_id))
    setDStudentName(stu.first_name || stu.username)
    if (stu.gap_topics.length > 0) {
      setDTopicId(String(stu.gap_topics[0].topic_id))
      setDTopicTitle(stu.gap_topics[0].title)
    } else {
      setDTopicTitle(stu.subject_name || 'Повторение базовых тем')
    }
    toast(`Подготовка персонального задания для ${stu.first_name || stu.username}`, 'success')
  }

  const generateDraft = async () => {
    setDBusy(true)
    try {
      if (draftKind === 'assignment') {
        const tpObj = topics.find(t => String(t.id) === String(dTopicId))
        const topicName = dTopicTitle.trim() || tpObj?.title || 'Базовая тема программы КР'
        const r = await client.post('/ai/teacher-assistant/', {
          mode: 'draft_assignment',
          topic_title: topicName,
          grade: dGrade || tpObj?.grade || '8',
          student_name: dStudentName,
          prompt: dPrompt,
        })
        setDraftTaskTitle(r.data.title || `Задание: ${topicName}`)
        setDraftTaskInstr(r.data.instructions || '')
        setDraftTaskMax(r.data.recommended_max_score || 5)
        toast('Черновик задания создан — проверьте и утвердите', 'success')
      } else if (draftKind === 'explanation') {
        const tpObj = topics.find(t => String(t.id) === String(dTopicId))
        const topicName = dTopicTitle.trim() || tpObj?.title || 'Учебная тема КР'
        const r = await client.post('/ai/teacher-assistant/', {
          mode: 'draft_explanation',
          topic_title: topicName,
          grade: dGrade || tpObj?.grade || '8',
          prompt: dPrompt,
        })
        setDraftExplText(r.data.explanation || '')
        toast('Черновик объяснения готов', 'success')
      } else if (draftKind === 'test') {
        const tpObj = topics.find(t => String(t.id) === String(dTopicId))
        const topicName = dTopicTitle.trim() || tpObj?.title || 'Проверка знаний'
        const promptText = `Тема: ${topicName} (${dGrade} класс). ${dPrompt}`.trim()
        const r = await client.post('/tests/generate/', {
          count: dTestCount,
          prompt: promptText.length >= 10 ? promptText : `Школьный тест по теме ${topicName} для ${dGrade} класса`,
          text: `${topicName} — основная тема школьной программы. ${tpObj?.description || ''} ${dPrompt}`.repeat(2),
        })
        setDraftTestTitle(`${dTestIsDiag ? 'Входная диагностика: ' : 'Тест: '}${topicName}`)
        setDraftQuestions((r.data.questions || []).map((q: any) => ({
          text: q.text,
          type: q.type || 'single',
          points: q.points || 1,
          topic: dTopicId ? Number(dTopicId) : null,
          explanation: q.explanation || '',
          options: (q.options || []).map((o: any) => ({ text: o.text, is_correct: !!o.is_correct })),
        })))
        toast('Черновик теста готов — проверьте вопросы перед сохранением', 'success')
      }
    } catch (e: any) {
      toast(e?.response?.data?.error || e?.response?.data?.detail || 'Ошибка генерации черновика', 'error')
    }
    setDBusy(false)
  }

  const approveAndAssignTask = async () => {
    if (!dClassId) { toast('Выберите класс для назначения задания', 'error'); return }
    if (!draftTaskTitle.trim()) { toast('Введите название задания', 'error'); return }
    setDraftSaving(true)
    try {
      await client.post('/assignments/', {
        classroom: Number(dClassId),
        kind: 'write',
        manual_title: draftTaskTitle.trim(),
        instructions: draftTaskInstr.trim(),
        max_score: Number(draftTaskMax) || 5,
        topic: dTopicId ? Number(dTopicId) : null,
        assigned_to: dStudentId ? Number(dStudentId) : null,
        deadline: draftTaskDeadline ? new Date(draftTaskDeadline).toISOString() : null,
      })
      toast('Задание утверждено учителем и назначено!', 'success')
      setDraftTaskTitle('')
      setDraftTaskInstr('')
      loadAnalysis(classId)
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Не удалось назначить задание', 'error')
    }
    setDraftSaving(false)
  }

  const approveAndPostExplanation = async () => {
    if (!dClassId) { toast('Выберите класс для публикации объяснения', 'error'); return }
    if (!draftExplText.trim()) return
    setDraftSaving(true)
    try {
      await client.post('/announcements/', {
        classroom: Number(dClassId),
        text: draftExplText.trim(),
      })
      toast('Объяснение утверждено и опубликовано в ленте класса!', 'success')
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Не удалось опубликовать', 'error')
    }
    setDraftSaving(false)
  }

  const approveAndSaveTest = async () => {
    if (!draftTestTitle.trim() || draftQuestions.length === 0) {
      toast('Добавьте хотя бы один вопрос', 'error')
      return
    }
    setDraftSaving(true)
    try {
      const r = await client.post('/tests/', {
        title: draftTestTitle.trim(),
        description: 'Утверждено учителем (на основе черновика ИИ-помощника)',
        subject: dSubjectId ? Number(dSubjectId) : null,
        pass_score: 60,
        time_limit: 0,
        time_per_question: 30,
        is_diagnostic: dTestIsDiag,
        diagnostic_grade: dTestIsDiag ? dGrade : '',
        questions: draftQuestions.map((q, i) => ({
          ...q,
          order: i,
          options: q.options.map((o: any, j: number) => ({ ...o, order: j })),
        })),
      })
      if (dClassId && r.data?.id) {
        await client.post('/assignments/', {
          classroom: Number(dClassId),
          kind: 'test',
          test: r.data.id,
          topic: dTopicId ? Number(dTopicId) : null,
          assigned_to: dStudentId ? Number(dStudentId) : null,
        })
        toast('Тест утверждён, сохранён и назначен классу!', 'success')
      } else {
        toast('Тест утверждён учителем и сохранён в разделе «Тесты»!', 'success')
      }
      setDraftQuestions([])
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Не удалось сохранить тест', 'error')
    }
    setDraftSaving(false)
  }

  const downloadSchoolCsv = async (type: 'classes' | 'lagging' | 'topics') => {
    try {
      const r = await client.get('/classrooms/school_export_csv/', {
        params: { type },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${type}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Не удалось скачать CSV', 'error')
    }
  }

  const downloadBackup = async () => {
    try {
      const r = await client.get('/classrooms/backup_data/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/json;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `eduplatform-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Резервная копия скачана', 'success')
    } catch {
      toast('Не удалось скачать резервную копию', 'error')
    }
  }

  const students: StudentAnalysis[] = useMemo(() => {
    const arr: StudentAnalysis[] = data?.students || []
    return arr.filter(s => {
      if (filterMode === 'pull_up' && !s.needs_pull_up) return false
      if (filterMode === 'leader' && s.status_level !== 'leader') return false
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase()
        const matchName = s.username.toLowerCase().includes(q) || (s.first_name || '').toLowerCase().includes(q)
        const matchClass = (s.classroom_title || '').toLowerCase().includes(q)
        if (!matchName && !matchClass) return false
      }
      return true
    })
  }, [data, filterMode, searchQ])

  const classesList = data?.classes || []
  const summary = data?.summary || {}

  return (
    <div className="max-w-6xl mx-auto space-y-5" data-testid="teacher-ai-page">
      {/* Шапка + политика ИИ */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-700 to-emerald-700 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold mb-2">
              <ShieldCheck size={14} /> Только для учителей и администрации
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="text-amber-300" /> ИИ-помощник учителя и Аналитика
            </h1>
            <p className="text-white/85 text-xs sm:text-sm mt-1 max-w-3xl">
              Анализ каждого ученика (кто как учится, у кого какие оценки, кого нужно подтянуть и по каким темам), методические советы, а также генерация черновиков заданий, тестов и объяснений. Учитель проверяет и утверждает результат; ИИ не выставляет итоговые оценки.
            </p>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-700">
        <button onClick={() => setTab('students')} data-testid="tai-tab-students"
          className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${tab === 'students' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <Users size={16} /> Анализ учеников, оценок и советы
        </button>
        <button onClick={() => setTab('drafts')} data-testid="tai-tab-drafts"
          className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${tab === 'drafts' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <Sparkles size={16} /> Черновики заданий, тестов и объяснений
        </button>
        <button onClick={() => setTab('analytics')} data-testid="tai-tab-analytics"
          className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${tab === 'analytics' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          <TrendingUp size={16} /> Сводная аналитика школы и Экспорт
        </button>
      </div>

      {/* ==================== ВКЛАДКА 1: АНАЛИЗ УЧЕНИКОВ И ОЦЕНОК ==================== */}
      {tab === 'students' && (
        <div className="space-y-5">
          {/* Сводные карточки */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
              <Users size={20} className="mx-auto text-indigo-600" />
              <div className="text-2xl font-bold mt-1 dark:text-white">{summary.total_students ?? 0}</div>
              <div className="text-xs text-slate-500">всего учеников</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-4 text-center">
              <AlertTriangle size={20} className="mx-auto text-red-600" />
              <div className="text-2xl font-bold mt-1 text-red-600" data-testid="tai-pullup-count">{summary.needs_pull_up_count ?? 0}</div>
              <div className="text-xs text-slate-500">нужно подтянуть</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
              <Trophy size={20} className="mx-auto text-emerald-600" />
              <div className="text-2xl font-bold mt-1 text-emerald-600">{summary.leaders_count ?? 0}</div>
              <div className="text-xs text-slate-500">лидеры («5», ≥80%)</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
              <TrendingUp size={20} className="mx-auto text-sky-600" />
              <div className="text-2xl font-bold mt-1 dark:text-white">{summary.overall_avg_pct != null ? `${summary.overall_avg_pct}%` : '—'}</div>
              <div className="text-xs text-slate-500">средний % освоения</div>
            </div>
          </div>

          {/* Панель запуска ИИ-разбора и фильтров */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select value={classId} onChange={e => setClassId(e.target.value)} data-testid="tai-class-select"
                className="w-full sm:w-auto px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-semibold">
                <option value="">Все мои классы</option>
                {classesList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.title} ({c.students_count} уч.)</option>
                ))}
              </select>
              <div className="overflow-x-auto tab-scroll [scrollbar-width:none] max-w-full">
                <div className="inline-flex rounded-xl border dark:border-slate-700 overflow-hidden text-xs font-bold shrink-0">
                  <button onClick={() => setFilterMode('all')}
                    className={`px-3 py-2.5 whitespace-nowrap min-h-[40px] ${filterMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-slate-300'}`}>
                    Все ({summary.total_students ?? 0})
                  </button>
                  <button onClick={() => setFilterMode('pull_up')} data-testid="tai-filter-pullup"
                    className={`px-3 py-2.5 whitespace-nowrap min-h-[40px] border-l dark:border-slate-700 ${filterMode === 'pull_up' ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-800 text-red-600'}`}>
                    ⚠️ Кого подтянуть ({summary.needs_pull_up_count ?? 0})
                  </button>
                  <button onClick={() => setFilterMode('leader')}
                    className={`px-3 py-2.5 whitespace-nowrap min-h-[40px] border-l dark:border-slate-700 ${filterMode === 'leader' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-emerald-600'}`}>
                    🏆 Лидеры ({summary.leaders_count ?? 0})
                  </button>
                </div>
              </div>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Поиск ученика по имени/нику…"
                className="flex-1 min-w-[180px] w-full sm:w-auto px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-slate-800">
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAIAnalysis()}
                placeholder="Дополнительный вопрос ИИ (необязательно): напр. «Кому дать задачи по дробям и как подтянуть троечников?»"
                className="flex-1 min-w-0 w-full sm:w-auto px-3.5 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-indigo-50/40 dark:bg-slate-800 dark:text-white text-sm" />
              <button onClick={runAIAnalysis} disabled={aiBusy} data-testid="tai-run-btn"
                className="w-full sm:w-auto justify-center px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 shadow">
                <Sparkles size={16} /> {aiBusy ? 'Анализирую оценки и темы…' : 'Сформировать ИИ-анализ и советы'}
              </button>
            </div>
          </div>

          {/* Текстовый отчёт от ИИ */}
          {aiReport && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5 space-y-2" data-testid="tai-report-box">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-600" />
                <span className="font-bold text-sm dark:text-white">Педагогический разбор и рекомендации для учителя</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
                  {aiSource?.startsWith('gemini') ? 'ИИ Gemini' : 'Автоаналитика журнала'}
                </span>
                <button onClick={() => { navigator.clipboard.writeText(aiReport); toast('Отчёт скопирован', 'success') }}
                  className="ml-auto text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                  <Copy size={13} /> Скопировать
                </button>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed dark:text-slate-100">{aiReport}</div>
            </div>
          )}

          {/* Карточки по каждому ученику: оценки, темы, кого подтянуть, советы */}
          {loading ? (
            <div className="skeleton h-40 rounded-2xl" />
          ) : students.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center text-slate-400">
              Ученики по выбранному фильтру не найдены. Добавьте учеников в класс во вкладке «Люди».
            </div>
          ) : (
            <div className="space-y-3">
              {students.map(stu => (
                <div key={`${stu.classroom_id}-${stu.student_id}`} data-testid={`tai-stu-${stu.username}`}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 space-y-3 ${stu.needs_pull_up ? 'border-red-200 dark:border-red-900/60' : 'dark:border-slate-700'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${stu.needs_pull_up ? 'bg-red-600' : stu.status_level === 'leader' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                        {(stu.first_name || stu.username)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold dark:text-white flex items-center gap-2 flex-wrap">
                          <span>{stu.first_name ? `${stu.first_name} (@${stu.username})` : stu.username}</span>
                          <Link to={`/classes/${stu.classroom_id}`} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:underline">
                            {stu.classroom_title}
                          </Link>
                          {stu.needs_pull_up && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold">
                              ⚠️ Нужно подтянуть
                            </span>
                          )}
                          {stu.status_level === 'leader' && (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
                              🏆 Отличник / Лидер
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-3">
                          <span>Сдано работ: <b>{stu.done_count}</b></span>
                          {stu.missed_count > 0 && <span className="text-red-600 font-semibold">Просрочено: {stu.missed_count}</span>}
                          <span>Посещаемость (30д): был <b className="text-emerald-600">{stu.attendance.present}</b> · пропустил <b className="text-red-600">{stu.attendance.absent}</b> · опоздал <b className="text-amber-600">{stu.attendance.late}</b></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${krBadgeCls(stu.kr_grade)}`}>
                        {stu.avg_pct != null ? `Средний: ${stu.avg_pct}% · Оценка КР «${stu.kr_grade}»` : 'Нет оценок'}
                      </div>
                      <button onClick={() => openPullUpDraft(stu)} data-testid={`tai-assign-${stu.username}`}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1">
                        <Target size={14} /> Персональное задание
                      </button>
                    </div>
                  </div>

                  {/* Оценки ученика по заданиям и тестам */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Оценки по заданиям и тестам:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {stu.grades.length === 0 && <span className="text-xs text-slate-400">В классе пока нет заданий</span>}
                      {stu.grades.map(g => (
                        <span key={g.assignment_id}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                            g.score != null
                              ? (g.pct != null && g.pct >= 70
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/25 dark:border-emerald-800 dark:text-emerald-200'
                                  : g.pct != null && g.pct >= 50
                                  ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/25 dark:border-amber-800 dark:text-amber-200'
                                  : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/25 dark:border-red-800 dark:text-red-300')
                              : g.mark
                              ? 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : g.status === 'overdue'
                              ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20'
                              : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/50 dark:border-slate-700'
                          }`}>
                          {g.title}:{' '}
                          <b>
                            {g.score != null ? `${g.score}/${g.max_score}` : g.mark ? g.mark : g.status === 'overdue' ? 'не сдано!' : 'ждёт'}
                          </b>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Что уже умеет и что подтянуть по темам */}
                  {(stu.mastered_topics.length > 0 || stu.gap_topics.length > 0) && (
                    <div className="flex flex-wrap gap-4 text-xs pt-1">
                      {stu.mastered_topics.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">✓ Уже умеет:</span>
                          {stu.mastered_topics.map(m => (
                            <span key={m.topic_id} className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-semibold">
                              {m.title} ({m.pct}%)
                            </span>
                          ))}
                        </div>
                      )}
                      {stu.gap_topics.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-red-600 dark:text-red-400">⚠️ Подтянуть темы:</span>
                          {stu.gap_topics.map(g => (
                            <span key={g.topic_id} className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 font-semibold">
                              {g.title} ({g.pct}%)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Персональный совет учителю */}
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700 text-xs dark:text-slate-200 flex items-start gap-2">
                    <Sparkles size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <b>Совет учителю:</b> {stu.advice}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== ВКЛАДКА 2: ЧЕРНОВИКИ ЗАДАНИЙ, ТЕСТОВ И ОБЪЯСНЕНИЙ ==================== */}
      {tab === 'drafts' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <ShieldCheck size={16} className="shrink-0 text-amber-600" />
            <span>
              <b>Правило контроля качества:</b> ИИ-помощник генерирует только <b>черновики</b> заданий, тестов и объяснений по учебным материалам КР. Учитель проверяет, при необходимости редактирует и лично утверждает результат. ИИ никогда не выставляет итоговые оценки.
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <button onClick={() => setDraftKind('assignment')} data-testid="draft-kind-assignment"
              className={`p-3 rounded-xl border text-left font-bold text-sm flex items-center gap-2 ${draftKind === 'assignment' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700'}`}>
              <FileText size={16} /> Черновик задания (с критериями КР)
            </button>
            <button onClick={() => setDraftKind('explanation')} data-testid="draft-kind-explanation"
              className={`p-3 rounded-xl border text-left font-bold text-sm flex items-center gap-2 ${draftKind === 'explanation' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700'}`}>
              <BookOpen size={16} /> Черновик объяснения темы
            </button>
            <button onClick={() => setDraftKind('test')} data-testid="draft-kind-test"
              className={`p-3 rounded-xl border text-left font-bold text-sm flex items-center gap-2 ${draftKind === 'test' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700'}`}>
              <FlaskConical size={16} /> Черновик теста / диагностики
            </button>
          </div>

          {/* Параметры генерации черновика */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-5 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-500 space-y-1">
                <span>Класс (куда назначить):</span>
                <select value={dClassId} onChange={e => setDClassId(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm">
                  <option value="">Выберите класс…</option>
                  {classesList.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500 space-y-1">
                <span>Тема из программы КР:</span>
                <select value={dTopicId} onChange={e => {
                  setDTopicId(e.target.value)
                  const found = topics.find(t => String(t.id) === e.target.value)
                  if (found) { setDTopicTitle(found.title); if (found.grade) setDGrade(found.grade) }
                }}
                  className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm">
                  <option value="">Выбрать тему из списка…</option>
                  {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.subject_name} ({tp.grade || 'общ.'} кл.) — {tp.num}. {tp.title}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500 space-y-1">
                <span>Или введите тему вручную + класс:</span>
                <div className="flex gap-1.5">
                  <input value={dTopicTitle} onChange={e => setDTopicTitle(e.target.value)} placeholder="Напр. Квадратные уравнения"
                    data-testid="draft-topic-input"
                    className="flex-1 px-3 py-2 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                  <input value={dGrade} onChange={e => setDGrade(e.target.value)} placeholder="8" title="Класс"
                    className="w-16 px-2 py-2 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm text-center" />
                </div>
              </label>
            </div>

            {draftKind === 'assignment' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-500 space-y-1">
                  <span>Кому назначить (весь класс или персонально отстающему):</span>
                  <select value={dStudentId} onChange={e => {
                    setDStudentId(e.target.value)
                    const st = (data?.students || []).find((x: any) => String(x.student_id) === e.target.value)
                    setDStudentName(st ? (st.first_name || st.username) : '')
                  }}
                    className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm">
                    <option value="">Всему классу (общее задание)</option>
                    {(data?.students || [])
                      .filter((s: any) => !dClassId || String(s.classroom_id) === String(dClassId))
                      .map((s: any) => (
                        <option key={`${s.classroom_id}-${s.student_id}`} value={s.student_id}>
                          {s.first_name || s.username} (@{s.username}) {s.needs_pull_up ? '⚠️ нужно подтянуть' : ''}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500 space-y-1">
                  <span>Пожелания учителя к черновику:</span>
                  <input value={dPrompt} onChange={e => setDPrompt(e.target.value)}
                    placeholder="Напр.: 3 задачи с подсказками для закрепления темы"
                    className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                </label>
              </div>
            )}

            {draftKind === 'test' && (
              <div className="flex flex-wrap items-center gap-3">
                <select value={dSubjectId} onChange={e => setDSubjectId(e.target.value)}
                  className="px-3 py-2 min-h-[42px] rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm">
                  <option value="">Предмет теста…</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  Вопросов:
                  <input type="number" min={1} max={25} value={dTestCount} onChange={e => setDTestCount(Number(e.target.value) || 5)}
                    className="w-16 px-2 py-1.5 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" />
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold dark:text-slate-200">
                  <input type="checkbox" checked={dTestIsDiag} onChange={e => setDTestIsDiag(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  Отметить как входную диагностику
                </label>
              </div>
            )}

            <button onClick={generateDraft} disabled={dBusy} data-testid="draft-generate-btn"
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
              <Sparkles size={16} /> {dBusy ? 'Создаю черновик…' : 'Сгенерировать черновик для проверки'}
            </button>
          </div>

          {/* Редактор черновика задания (проверка и утверждение учителем) */}
          {draftKind === 'assignment' && draftTaskInstr && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 p-5 space-y-3" data-testid="draft-task-editor">
              <div className="font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <CheckCircle2 size={16} /> Черновик задания — проверьте, отредактируйте и утвердите:
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <input value={draftTaskTitle} onChange={e => setDraftTaskTitle(e.target.value)}
                  placeholder="Название задания"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white font-semibold text-sm" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Макс. балл (КР):</label>
                  <input type="number" min={1} max={100} value={draftTaskMax} onChange={e => setDraftTaskMax(Number(e.target.value) || 5)}
                    className="w-20 px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-bold" />
                </div>
              </div>
              <textarea value={draftTaskInstr} onChange={e => setDraftTaskInstr(e.target.value)} rows={8}
                className="w-full px-3.5 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm leading-relaxed" />
              <div className="flex flex-wrap items-center gap-3">
                <input type="datetime-local" value={draftTaskDeadline} onChange={e => setDraftTaskDeadline(e.target.value)}
                  className="px-3 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-xs" />
                <button onClick={approveAndAssignTask} disabled={draftSaving} data-testid="draft-approve-task"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Утвердить и назначить {dStudentName ? `ученику (${dStudentName})` : 'классу'}
                </button>
              </div>
            </div>
          )}

          {/* Редактор черновика объяснения */}
          {draftKind === 'explanation' && draftExplText && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 p-5 space-y-3" data-testid="draft-expl-editor">
              <div className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
                Черновик объяснения учебного материала — проверьте и утвердите:
              </div>
              <textarea value={draftExplText} onChange={e => setDraftExplText(e.target.value)} rows={10}
                className="w-full px-3.5 py-2.5 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm leading-relaxed" />
              <div className="flex flex-wrap gap-2">
                <button onClick={approveAndPostExplanation} disabled={draftSaving} data-testid="draft-approve-expl"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-1.5">
                  <Send size={15} /> Утвердить и опубликовать в классе
                </button>
                <button onClick={() => { navigator.clipboard.writeText(draftExplText); toast('Конспект скопирован', 'success') }}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 text-sm font-semibold dark:text-white flex items-center gap-1.5">
                  <Copy size={15} /> Скопировать для конструктора урока
                </button>
              </div>
            </div>
          )}

          {/* Редактор черновика теста */}
          {draftKind === 'test' && draftQuestions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 p-5 space-y-3" data-testid="draft-test-editor">
              <div className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
                Черновик теста ({draftQuestions.length} вопр.) — проверьте вопросы и ответы перед утверждением:
              </div>
              <input value={draftTestTitle} onChange={e => setDraftTestTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white font-bold text-sm" />
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {draftQuestions.map((q, qi) => (
                  <div key={qi} className="p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">{qi + 1}</span>
                      <input value={q.text} onChange={e => setDraftQuestions(qs => qs.map((x, i) => i === qi ? { ...x, text: e.target.value } : x))}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm font-medium" />
                      <button onClick={() => setDraftQuestions(qs => qs.filter((_, i) => i !== qi))} className="text-red-500 p-1"><Trash2 size={15} /></button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5 pl-8">
                      {q.options.map((o: any, oi: number) => (
                        <label key={oi} className="flex items-center gap-1.5 text-xs dark:text-slate-200">
                          <input type="checkbox" checked={!!o.is_correct}
                            onChange={e => setDraftQuestions(qs => qs.map((x, i) => i === qi ? {
                              ...x,
                              options: x.options.map((op: any, idx: number) => idx === oi ? { ...op, is_correct: e.target.checked } : op)
                            } : x))} />
                          <input value={o.text}
                            onChange={e => setDraftQuestions(qs => qs.map((x, i) => i === qi ? {
                              ...x,
                              options: x.options.map((op: any, idx: number) => idx === oi ? { ...op, text: e.target.value } : op)
                            } : x))}
                            className="flex-1 px-2 py-1 rounded border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white" />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={approveAndSaveTest} disabled={draftSaving} data-testid="draft-approve-test"
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-1.5">
                <Save size={16} /> Утвердить и сохранить тест {dClassId ? '+ назначить классу' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== ВКЛАДКА 3: СВОДНАЯ АНАЛИТИКА ШКОЛЫ И ЭКСПОРТ ==================== */}
      {tab === 'analytics' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm dark:text-white mr-auto">Отчёты и экспорт данных (Excel CSV + Резервная копия):</span>
            <button onClick={() => downloadSchoolCsv('classes')} data-testid="exp-classes-csv"
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5">
              <Download size={14} /> Сводка по классам и посещаемости (CSV)
            </button>
            <button onClick={() => downloadSchoolCsv('lagging')} data-testid="exp-lagging-csv"
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-red-50 dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5">
              <Download size={14} /> Кто отстаёт и оценки (CSV)
            </button>
            <button onClick={() => downloadSchoolCsv('topics')} data-testid="exp-topics-csv"
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5">
              <Download size={14} /> Проблемные темы КР (CSV)
            </button>
            <button onClick={downloadBackup} data-testid="exp-backup-json"
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
              <Download size={14} /> Резервная копия (JSON)
            </button>
          </div>

          {/* Таблица классов: какие классы пропускают занятия и где отстают */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 space-y-3">
            <h2 className="font-bold text-sm dark:text-white flex items-center gap-2">
              <CalendarX size={16} className="text-red-600" /> Сводка по классам: успеваемость и пропуски занятий (за 30 дней)
            </h2>
            <div className="overflow-auto">
              <table className="w-full text-sm min-w-[580px] dark:text-slate-100">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b dark:border-slate-700">
                    <th className="p-2">Класс</th>
                    <th className="p-2">Предмет</th>
                    <th className="p-2">Учеников</th>
                    <th className="p-2">Средний %</th>
                    <th className="p-2">Отстают</th>
                    <th className="p-2">Пропусков (НБ)</th>
                    <th className="p-2">Опозданий</th>
                    <th className="p-2">Посещаемость</th>
                  </tr>
                </thead>
                <tbody>
                  {(schoolStats?.classes || []).map((c: any) => (
                    <tr key={c.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-2 font-bold">
                        <Link to={`/classes/${c.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{c.title}</Link>
                      </td>
                      <td className="p-2 text-xs text-slate-500">{c.subject || '—'}</td>
                      <td className="p-2">{c.students_count}</td>
                      <td className="p-2 font-bold">{c.avg_pct != null ? `${c.avg_pct}%` : '—'}</td>
                      <td className="p-2">
                        {c.lagging_count > 0
                          ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs font-bold">{c.lagging_count}</span>
                          : <span className="text-emerald-600 text-xs font-bold">0</span>}
                      </td>
                      <td className="p-2 font-bold text-red-600">{c.absent_count || 0}</td>
                      <td className="p-2 text-amber-600">{c.late_count || 0}</td>
                      <td className="p-2 font-bold">{c.attendance_pct != null ? `${c.attendance_pct}%` : '—'}</td>
                    </tr>
                  ))}
                  {!(schoolStats?.classes || []).length && (
                    <tr><td colSpan={8} className="p-4 text-center text-slate-400">Нет данных по классам</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Проблемные темы учебной программы */}
          {(schoolStats?.problem_topics || []).length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 space-y-2">
              <h2 className="font-bold text-sm dark:text-white flex items-center gap-2">
                <Target size={16} className="text-amber-600" /> По каким темам учебной программы больше всего пробелов
              </h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {schoolStats.problem_topics.map((tp: any) => (
                  <div key={tp.topic_id} className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-xs space-y-1">
                    <div className="font-bold text-sm dark:text-white">{tp.title}</div>
                    <div className="text-slate-500">{tp.subject_name} · средний результат: <b className="text-red-600">{tp.avg_pct}%</b></div>
                    <div className="text-slate-600 dark:text-slate-300">Отстают ({tp.students_count}): <b>{tp.students.join(', ')}</b></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

