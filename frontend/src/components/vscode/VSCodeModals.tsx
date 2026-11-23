import { useState } from 'react'
import { X, LayoutTemplate, CheckCircle2, Plus, Trash2, Lock, ClipboardCheck, GraduationCap } from 'lucide-react'
import client from '../../api/client'
import { toast } from '../../context/UIContext'
import {
  VSCODE_TEMPLATES,
  type VSCodeTemplate,
  type PracticeCodeTask,
  type AutoTestItem,
} from './vscodeTemplates'

export function VSCodeTemplatesModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean
  onClose: () => void
  onApply: (tpl: VSCodeTemplate) => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] rounded-xl bg-[#252526] border border-[#3c3c3c] shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <div className="px-4 py-3 bg-[#1e1e1e] border-b border-[#333333] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-white">
            <LayoutTemplate size={16} className="text-[#3794ff]" />
            <span>Шаблоны проектов (HTML / CSS / JS / Картинки / Python)</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-3 sm:p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VSCODE_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl bg-[#1e1e1e] border border-[#333333] hover:border-[#007acc] p-3.5 flex flex-col justify-between gap-3 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-white leading-snug">{tpl.title}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{tpl.desc}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {tpl.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-[#2d2d2d] text-[10px] font-mono text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] font-mono text-slate-500 pt-0.5">
                  Файлы: {tpl.files.map((f) => f.name).join(', ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { onApply(tpl); onClose() }}
                className="w-full py-2 rounded-lg bg-[#007acc] hover:bg-[#1186d4] text-white text-xs font-semibold transition-colors"
              >
                Открыть шаблон
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function VSCodeTasksModal({
  open,
  onClose,
  tasks,
  activeTaskId,
  canCreate,
  classrooms,
  onSelectTask,
  onTaskCreated,
}: {
  open: boolean
  onClose: () => void
  tasks: PracticeCodeTask[]
  activeTaskId: string | number | null
  canCreate: boolean
  classrooms: { id: number; title: string }[]
  onSelectTask: (task: PracticeCodeTask) => void
  onTaskCreated: (task: PracticeCodeTask) => void
}) {
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<'python' | 'javascript' | 'html' | 'css'>('python')
  const [description, setDescription] = useState('')
  const [starterCode, setStarterCode] = useState('a = int(input())\nb = int(input())\nprint(a + b)\n')
  const [maxScore, setMaxScore] = useState(100)
  const [classroomId, setClassroomId] = useState<string>('')
  const [tests, setTests] = useState<AutoTestItem[]>([
    { label: 'Тест 1', input: '2\n3\n', expected: '5', hidden: false, type: 'tag', value: 'h1' },
    { label: 'Тест 2 (скрытый)', input: '10\n25\n', expected: '35', hidden: true, type: 'tag', value: 'img' },
  ])

  if (!open) return null

  const isWeb = language === 'html' || language === 'css'

  const addTestRow = () => {
    setTests((prev) => [
      ...prev,
      {
        label: `Тест ${prev.length + 1}`,
        input: '',
        expected: '',
        hidden: false,
        type: language === 'css' ? 'css_prop' : 'tag',
        value: '',
      },
    ])
  }

  const updateTest = (idx: number, patch: Partial<AutoTestItem>) => {
    setTests((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const removeTest = (idx: number) => {
    setTests((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast('Введите название задачи', 'error')
      return
    }
    const cleanTests = tests
      .map((t, i) => {
        const label = (t.label || '').trim() || `Тест ${i + 1}`
        if (isWeb) {
          if (!(t.value || '').trim()) return null
          return { label, type: t.type || 'contains', value: (t.value || '').trim(), hidden: Boolean(t.hidden) }
        }
        if (!(t.expected || '').trim()) return null
        return { label, input: t.input || '', expected: (t.expected || '').trim(), hidden: Boolean(t.hidden) }
      })
      .filter(Boolean)

    if (!cleanTests.length) {
      toast('Добавьте хотя бы один тест для автопроверки', 'error')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        title: title.trim(),
        language,
        description: description.trim(),
        starter_code: starterCode,
        max_score: Math.max(1, Math.min(1000, Number(maxScore) || 100)),
        tests: cleanTests,
      }
      if (classroomId) payload.classroom = Number(classroomId)
      const res = await client.post('/code-tasks/', payload)
      toast(
        classroomId
          ? 'Задача создана и добавлена в журнал класса'
          : 'Практическая задача с автопроверкой создана',
        'success'
      )
      onTaskCreated(res.data)
      setCreating(false)
      setTitle('')
      setDescription('')
      onClose()
    } catch (e: any) {
      toast(e?.response?.data?.detail || e?.response?.data?.error || 'Не удалось создать задачу', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] rounded-xl bg-[#252526] border border-[#3c3c3c] shadow-2xl flex flex-col overflow-hidden text-slate-200">
        <div className="px-4 py-3 bg-[#1e1e1e] border-b border-[#333333] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-white">
            <ClipboardCheck size={16} className="text-emerald-400" />
            <span>Практические задачи с автопроверкой</span>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="px-2.5 py-1 rounded-lg bg-[#007acc] hover:bg-[#1186d4] text-white text-xs font-semibold flex items-center gap-1"
              >
                {creating ? '← К списку' : <><Plus size={13} /> Создать задачу</>}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 overflow-y-auto space-y-3">
          {creating ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Название задачи</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Факториал числа"
                    className="w-full px-2.5 py-2 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c] text-xs text-white outline-none focus:border-[#007acc]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Язык</label>
                    <select
                      value={language}
                      onChange={(e) => {
                        const l = e.target.value as any
                        setLanguage(l)
                        if (l === 'html') setStarterCode('<!DOCTYPE html>\n<html><body>\n  <h1>Заголовок</h1>\n</body></html>')
                        else if (l === 'css') setStarterCode('.card { padding: 16px; }\n')
                        else if (l === 'javascript') setStarterCode('console.log(2 + 3);\n')
                        else setStarterCode('a = int(input())\nb = int(input())\nprint(a + b)\n')
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c] text-xs text-white outline-none"
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="html">HTML</option>
                      <option value="css">CSS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Макс. балл</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maxScore}
                      onChange={(e) => setMaxScore(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c] text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {classrooms.length > 0 && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Привязать к классу (балл автоматически попадёт в журнал)
                  </label>
                  <select
                    value={classroomId}
                    onChange={(e) => setClassroomId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c] text-xs text-white outline-none"
                  >
                    <option value="">Без привязки к классу (общая практика)</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Условие задачи</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите, что должен сделать ученик и какой формат ввода/вывода..."
                  className="w-full px-2.5 py-2 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c] text-xs text-white outline-none focus:border-[#007acc]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Стартовый шаблон кода</label>
                <textarea
                  rows={3}
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c] text-xs font-mono text-white outline-none focus:border-[#007acc]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Автотесты ({tests.length})</span>
                  <button
                    type="button"
                    onClick={addTestRow}
                    className="px-2 py-1 rounded bg-[#333333] hover:bg-[#3c3c3c] text-xs text-slate-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> Добавить тест
                  </button>
                </div>

                {tests.map((tst, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#1e1e1e] border border-[#333333] space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={tst.label || ''}
                        onChange={(e) => updateTest(idx, { label: e.target.value })}
                        placeholder={`Тест ${idx + 1}`}
                        className="flex-1 px-2 py-1 rounded bg-[#252526] border border-[#3c3c3c] text-xs text-white outline-none"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(tst.hidden)}
                          onChange={(e) => updateTest(idx, { hidden: e.target.checked })}
                        />
                        <Lock size={11} className="text-amber-400" /> Скрытый
                      </label>
                      {tests.length > 1 && (
                        <button type="button" onClick={() => removeTest(idx)} className="p-1 text-slate-500 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {isWeb ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={tst.type || 'tag'}
                          onChange={(e) => updateTest(idx, { type: e.target.value as any })}
                          className="px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c] text-xs text-white outline-none"
                        >
                          <option value="tag">HTML-тег (напр. h1, img, button)</option>
                          <option value="attr">Атрибут (напр. src=, alt=)</option>
                          <option value="css_prop">CSS-свойство (напр. display: flex)</option>
                          <option value="contains">Содержит текст/код</option>
                        </select>
                        <input
                          value={tst.value || ''}
                          onChange={(e) => updateTest(idx, { value: e.target.value })}
                          placeholder="Значение проверки..."
                          className="px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c] text-xs font-mono text-white outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <textarea
                          rows={2}
                          value={tst.input || ''}
                          onChange={(e) => updateTest(idx, { input: e.target.value })}
                          placeholder="Ввод stdin (каждое значение с новой строки)"
                          className="px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c] text-xs font-mono text-white outline-none"
                        />
                        <textarea
                          rows={2}
                          value={tst.expected || ''}
                          onChange={(e) => updateTest(idx, { expected: e.target.value })}
                          placeholder="Ожидаемый вывод stdout"
                          className="px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c] text-xs font-mono text-emerald-300 outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleCreate}
                className="w-full py-2.5 rounded-lg bg-[#16825d] hover:bg-[#1a9c6e] disabled:opacity-50 text-white text-xs font-bold"
              >
                {saving ? 'Сохранение…' : 'Сохранить задачу с автопроверкой'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isActive = String(activeTaskId) === String(task.id)
                const testCount = task.tests_count ?? task.tests?.length ?? task.public_tests?.length ?? 0
                return (
                  <div
                    key={String(task.id)}
                    className={`rounded-xl p-3 border transition-colors flex flex-col sm:flex-row sm:items-center gap-3 ${
                      isActive
                        ? 'bg-[#1e293b] border-[#007acc]'
                        : 'bg-[#1e1e1e] border-[#333333] hover:border-[#4b5563]'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm text-white">{task.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#2d2d2d] text-[10px] font-mono uppercase text-sky-300">
                          {task.language}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#2d2d2d] text-[10px] text-slate-400">
                          {testCount} тест.
                        </span>
                        {task.classroom_title && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-[10px] text-indigo-300 flex items-center gap-1">
                            <GraduationCap size={10} /> {task.classroom_title}
                          </span>
                        )}
                        {task.my_passed && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-semibold flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> {task.my_best_score ?? task.max_score}/{task.max_score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onSelectTask(task); onClose() }}
                      className="px-3.5 py-2 rounded-lg bg-[#007acc] hover:bg-[#1186d4] text-white text-xs font-semibold shrink-0"
                    >
                      {isActive ? 'Открыта' : 'Решать'}
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
