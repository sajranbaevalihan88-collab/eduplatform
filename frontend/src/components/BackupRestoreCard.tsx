import { useRef, useState } from 'react'
import { Download, Upload, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import client from '../api/client'
import { toast } from '../context/UIContext'

interface BackupSummary {
  fileName: string
  version: string
  exportedAt: string
  exportedBy: string
  topicsCount: number
  classesCount: number
  scheduleCount: number
  assignmentsCount: number
  attendanceCount: number
  raw: Record<string, any>
}

interface RestoreResult {
  restored_topics: number
  restored_classes: number
  restored_schedule: number
  restored_substitutions: number
  restored_enrollments: number
  restored_assignments: number
  restored_submissions: number
  restored_attendance: number
  skipped_unknown_students: number
  topics_skipped_not_admin?: boolean
}

interface BackupRestoreActionsProps {
  isAdmin: boolean
  compact?: boolean
  onRestored?: (result: RestoreResult) => void
}

export default function BackupRestoreActions({ isAdmin, compact = false, onRestored }: BackupRestoreActionsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [preview, setPreview] = useState<BackupSummary | null>(null)
  const [restoreTopics, setRestoreTopics] = useState(isAdmin)
  const [restoreClasses, setRestoreClasses] = useState(true)
  const [lastResult, setLastResult] = useState<RestoreResult | null>(null)

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
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
      toast('Ошибка скачивания резервной копии', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleFilePick = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast('Файл больше 10 МБ', 'error')
      return
    }
    try {
      const txt = await file.text()
      const parsed = JSON.parse(txt)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast('Некорректный формат файла резервной копии', 'error')
        return
      }
      const topics = Array.isArray(parsed.topics) ? parsed.topics : []
      const classes = Array.isArray(parsed.classes) ? parsed.classes : []
      if (!topics.length && !classes.length) {
        toast('В файле нет тем программы или классов для восстановления', 'error')
        return
      }
      const scheduleCount = classes.reduce((acc: number, c: any) => acc + (Array.isArray(c?.schedule) ? c.schedule.length : 0), 0)
      const assignmentsCount = classes.reduce((acc: number, c: any) => acc + (Array.isArray(c?.assignments) ? c.assignments.length : 0), 0)
      const attendanceCount = classes.reduce((acc: number, c: any) => acc + (Array.isArray(c?.attendance) ? c.attendance.length : 0), 0)
      setRestoreTopics(isAdmin && topics.length > 0)
      setRestoreClasses(classes.length > 0)
      setLastResult(null)
      setPreview({
        fileName: file.name,
        version: String(parsed.version || '1.0'),
        exportedAt: parsed.exported_at ? new Date(parsed.exported_at).toLocaleString('ru-RU') : 'Неизвестно',
        exportedBy: String(parsed.exported_by || '—'),
        topicsCount: topics.length,
        classesCount: classes.length,
        scheduleCount,
        assignmentsCount,
        attendanceCount,
        raw: parsed,
      })
    } catch {
      toast('Не удалось прочитать JSON-файл резервной копии', 'error')
    }
  }

  const confirmRestore = async () => {
    if (!preview || restoring) return
    if (!restoreTopics && !restoreClasses) {
      toast('Выберите хотя бы один раздел для восстановления', 'error')
      return
    }
    setRestoring(true)
    try {
      const r = await client.post('/classrooms/restore_backup/', {
        ...preview.raw,
        restore_topics: isAdmin && restoreTopics,
        restore_classes: restoreClasses,
      })
      const res: RestoreResult = r.data
      setLastResult(res)
      const parts: string[] = []
      if (res.restored_topics) parts.push(`тем: ${res.restored_topics}`)
      if (res.restored_classes) parts.push(`классов: ${res.restored_classes}`)
      if (res.restored_schedule) parts.push(`расписание: ${res.restored_schedule}`)
      if (res.restored_assignments) parts.push(`заданий: ${res.restored_assignments}`)
      if (res.restored_submissions) parts.push(`оценок: ${res.restored_submissions}`)
      if (res.restored_attendance) parts.push(`посещаемость: ${res.restored_attendance}`)
      toast(parts.length ? `Восстановлено (${parts.join(', ')})` : 'Копия обработана', 'success')
      onRestored?.(res)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.file || 'Не удалось восстановить резервную копию'
      toast(String(msg), 'error')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) handleFilePick(f)
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          data-testid="exp-backup-json"
          className={
            compact
              ? 'px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 transition-colors'
              : 'px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-800 dark:border-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 transition-colors'
          }
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Скачать копию (JSON)
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="restore-backup-btn"
          className="px-3.5 py-2 min-h-[40px] rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Upload size={13} />
          Восстановить из JSON
        </button>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Восстановление резервной копии"
          onMouseDown={e => { if (e.target === e.currentTarget && !restoring) setPreview(null) }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-500" />
                Восстановление резервной копии
              </div>
              <button
                type="button"
                disabled={restoring}
                onClick={() => setPreview(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white truncate">{preview.fileName}</div>
                <div className="text-slate-500 dark:text-slate-400">
                  Создана: <b className="text-slate-700 dark:text-slate-200">{preview.exportedAt}</b> · Автор: <b className="text-slate-700 dark:text-slate-200">@{preview.exportedBy}</b> · v{preview.version}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-slate-400">Темы программы</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{preview.topicsCount}</div>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-slate-400">Классы</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{preview.classesCount}</div>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-slate-400">Расписание</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{preview.scheduleCount}</div>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-slate-400">Задания</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{preview.assignmentsCount}</div>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 col-span-2 sm:col-span-2">
                  <div className="text-slate-400">Отметки посещаемости</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{preview.attendanceCount}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${isAdmin && preview.topicsCount > 0 ? 'border-slate-200 dark:border-slate-700 cursor-pointer' : 'border-slate-100 dark:border-slate-800 opacity-60 cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={isAdmin && restoreTopics}
                    disabled={!isAdmin || preview.topicsCount === 0}
                    onChange={e => setRestoreTopics(e.target.checked)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Учебная программа КР ({preview.topicsCount} тем)</div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {isAdmin ? 'Обновит и добавит темы по предметам и классам.' : 'Общую учебную программу может восстанавливать только администратор.'}
                    </div>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${preview.classesCount > 0 ? 'border-slate-200 dark:border-slate-700 cursor-pointer' : 'border-slate-100 dark:border-slate-800 opacity-60 cursor-not-allowed'}`}>
                  <input
                    type="checkbox"
                    checked={restoreClasses}
                    disabled={preview.classesCount === 0}
                    onChange={e => setRestoreClasses(e.target.checked)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {isAdmin ? `Классы, расписание, замены и журнал (${preview.classesCount})` : `Мои классы, расписание, замены и журнал (${preview.classesCount})`}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Существующие записи не удаляются — отсутствующие классы, уроки и оценки восстанавливаются безопасно в одной транзакции.
                    </div>
                  </div>
                </label>
              </div>

              {!lastResult && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>Ученики из копии привязываются только к уже существующим аккаунтам платформы — пароли и роли пользователей не изменяются.</span>
                </div>
              )}

              {lastResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5" data-testid="restore-result-box">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                    Восстановление выполнено успешно
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span>Темы программы: <b>{lastResult.restored_topics}</b></span>
                    <span>Классы: <b>{lastResult.restored_classes}</b></span>
                    <span>Слоты расписания: <b>{lastResult.restored_schedule}</b></span>
                    <span>Замены уроков: <b>{lastResult.restored_substitutions}</b></span>
                    <span>Задания: <b>{lastResult.restored_assignments}</b></span>
                    <span>Оценки: <b>{lastResult.restored_submissions}</b></span>
                    <span>Посещаемость: <b>{lastResult.restored_attendance}</b></span>
                    <span>Новых зачислений: <b>{lastResult.restored_enrollments}</b></span>
                  </div>
                  {lastResult.skipped_unknown_students > 0 && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 pt-1">
                      Пропущено ненайденных аккаунтов учеников: {lastResult.skipped_unknown_students}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setPreview(null)}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                {lastResult ? 'Готово' : 'Отмена'}
              </button>
              {!lastResult && (
                <button
                  type="button"
                  disabled={restoring || (!restoreTopics && !restoreClasses)}
                  onClick={confirmRestore}
                  data-testid="confirm-restore-btn"
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {restoring ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {restoring ? 'Восстанавливаю…' : 'Подтвердить восстановление'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
