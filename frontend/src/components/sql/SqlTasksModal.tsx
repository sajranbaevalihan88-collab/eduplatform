import { useState } from 'react'
import { X, ClipboardCheck, Plus, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react'
import client from '../../api/client'
import { toast } from '../../context/UIContext'
import type { SqlPracticeTask, SqlTestSpec } from './sqlTasks'
import type { SqlExecOutcome } from './sqlEngine'

export function SqlTasksModal({
  open,
  onClose,
  tasks,
  activeTaskId,
  canCreate,
  classrooms,
  currentSchemaSql,
  onSelectTask,
  onCaptureReferenceSql,
  onTaskCreated,
}: {
  open: boolean
  onClose: () => void
  tasks: SqlPracticeTask[]
  activeTaskId: string | number | null
  canCreate: boolean
  classrooms: { id: number; title: string }[]
  currentSchemaSql: string
  onSelectTask: (task: SqlPracticeTask) => void
  onCaptureReferenceSql: (schemaSql: string, solutionSql: string) => Promise<SqlExecOutcome | null>
  onTaskCreated: (task: SqlPracticeTask) => void
}) {
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [schemaSql, setSchemaSql] = useState(currentSchemaSql)
  const [starterSql, setStarterSql] = useState('-- Напишите SQL-запрос здесь\nSELECT * FROM students LIMIT 5;\n')
  const [solutionSql, setSolutionSql] = useState('')
  const [requiredKw, setRequiredKw] = useState('')
  const [ordered, setOrdered] = useState(true)
  const [maxScore, setMaxScore] = useState(100)
  const [classroomId, setClassroomId] = useState('')

  if (!open) return null

  const openCreator = () => {
    setSchemaSql(currentSchemaSql)
    setCreating(true)
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast('Введите название задачи', 'error')
      return
    }
    if (!solutionSql.trim()) {
      toast('Введите эталонный SQL-запрос для автопроверки', 'error')
      return
    }
    setSaving(true)
    try {
      // Выполняем эталонный запрос в PostgreSQL прямо в браузере, чтобы автоматически получить эталонную таблицу
      const out = await onCaptureReferenceSql(schemaSql, solutionSql)
      if (!out || out.error) {
        toast(`Ошибка в эталонном SQL: ${out?.error?.message || 'не удалось выполнить'}`, 'error')
        setSaving(false)
        return
      }
      const lastRes = out.results[out.results.length - 1]
      if (!lastRes) {
        toast('Эталонный запрос должен возвращать таблицу (SELECT)', 'error')
        setSaving(false)
        return
      }

      const tests: SqlTestSpec[] = []
      if (requiredKw.trim()) {
        tests.push({
          label: `Используется ${requiredKw.trim().toUpperCase()}`,
          required_sql: requiredKw.trim(),
        })
      }
      const colNames = lastRes.columns.map((c) => c.name)
      tests.push({
        label: `Колонки результата (${colNames.join(', ')})`,
        expected_columns: colNames,
      })
      tests.push({
        label: `Точное совпадение результата (${lastRes.rows.length} стр.)`,
        ordered,
        expected_rows: lastRes.rows,
      })

      const payload: any = {
        title: title.trim(),
        language: 'sql',
        description: description.trim(),
        schema_sql: schemaSql,
        starter_code: starterSql,
        solution: solutionSql,
        max_score: Math.max(1, Math.min(1000, Number(maxScore) || 100)),
        tests,
      }
      if (classroomId) payload.classroom = Number(classroomId)

      const res = await client.post('/code-tasks/', payload)
      toast(
        classroomId
          ? 'SQL-задача создана и добавлена в журнал класса'
          : 'SQL-задача с автопроверкой создана',
        'success'
      )
      onTaskCreated({ ...res.data, tests })
      setCreating(false)
      setTitle('')
      setDescription('')
      setSolutionSql('')
      onClose()
    } catch (e: any) {
      toast(e?.response?.data?.detail || e?.response?.data?.error || 'Не удалось сохранить SQL-задачу', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <div className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <ClipboardCheck size={16} className="text-emerald-400" />
            <span>Практические SQL-задачи с автопроверкой</span>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => (creating ? setCreating(false) : openCreator())}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1"
              >
                {creating ? '← К списку' : <><Plus size={13} /> Создать SQL-задачу</>}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 overflow-y-auto space-y-3">
          {creating ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">Название задачи</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Напр.: Средний балл по каждому предмету"
                    className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Макс. балл</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-white outline-none"
                  />
                </div>
              </div>

              {classrooms.length > 0 && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Класс (автоматическая колонка в журнале)</label>
                  <select
                    value={classroomId}
                    onChange={(e) => setClassroomId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-white outline-none"
                  >
                    <option value="">Без привязки к классу</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Условие для ученика</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Какие колонки нужно вывести и как отсортировать..."
                  className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Схема и таблицы (DDL / INSERT — подставлена текущая база)</label>
                <textarea
                  rows={4}
                  value={schemaSql}
                  onChange={(e) => setSchemaSql(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-[11px] font-mono text-slate-200 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Стартовый запрос для ученика</label>
                <textarea
                  rows={2}
                  value={starterSql}
                  onChange={(e) => setStarterSql(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-[11px] font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-emerald-300 font-semibold mb-1">
                  Эталонный SQL-запрос (система сама выполнит его и сохранит эталонную таблицу!)
                </label>
                <textarea
                  rows={3}
                  value={solutionSql}
                  onChange={(e) => setSolutionSql(e.target.value)}
                  placeholder="SELECT s.name, ROUND(AVG(g.grade), 2) AS avg_grade FROM ..."
                  className="w-full px-2.5 py-2 rounded-lg bg-[#161b22] border border-emerald-700/70 text-[11px] font-mono text-emerald-200 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[11px] text-slate-400 mb-1">Обязательная конструкция SQL (необязательно)</label>
                  <input
                    value={requiredKw}
                    onChange={(e) => setRequiredKw(e.target.value)}
                    placeholder="Напр.: JOIN, GROUP BY, HAVING, OVER"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-xs font-mono text-white outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-4">
                  <input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} />
                  Учитывать порядок строк
                </label>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleCreate}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Проверяем эталон и сохраняем…' : 'Проверить эталон и создать задачу'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isActive = String(activeTaskId) === String(task.id)
                return (
                  <div
                    key={String(task.id)}
                    className={`rounded-xl p-3 border transition flex flex-col sm:flex-row sm:items-center gap-3 ${
                      isActive
                        ? 'bg-[#162030] border-sky-500'
                        : 'bg-[#141921] border-[#262d38] hover:border-[#3c4657]'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-white">{task.title}</span>
                        {task.difficulty && (
                          <span className="px-1.5 py-0.5 rounded bg-[#21262d] text-[10px] font-semibold text-sky-300">
                            {task.difficulty}
                          </span>
                        )}
                        {task.classroom_title && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-[10px] text-indigo-300 flex items-center gap-1">
                            <GraduationCap size={10} /> {task.classroom_title}
                          </span>
                        )}
                        {task.my_passed && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-semibold flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> {task.my_best_score ?? task.max_score}/{task.max_score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{task.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onSelectTask(task); onClose() }}
                      className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0"
                    >
                      {isActive ? 'Активна' : 'Открыть'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
