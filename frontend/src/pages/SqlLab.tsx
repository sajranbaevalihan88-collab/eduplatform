import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import {
  Play, PlayCircle, Database, Table2, Loader2, CircleCheck, RefreshCw, Plus, Trash2,
  Sparkles, BookOpen, Download, SearchCode, AlertTriangle, ChevronDown, ChevronRight,
  GitFork, KeyRound, Link2, Eye, X, ClipboardCheck, CheckCircle2, XCircle, GraduationCap,
} from 'lucide-react'
import client from '../api/client'
import { canTeach } from '../utils/role'
import { toast } from '../context/UIContext'
import {
  SqlLabSession,
  type SqlExecOutcome, type TableSchemaInfo,
} from '../components/sql/sqlEngine'
import {
  SQL_PRESETS, SQL_SNIPPETS, makeCellId,
  type SqlPreset,
} from '../components/sql/sqlPresets'
import SqlResultTable from '../components/sql/SqlResultTable'
import { ErDiagramSvg } from '../components/sql/SqlSchemaPanel'
import {
  BUILTIN_SQL_TASKS,
  evaluateSqlLocal,
  type SqlPracticeTask,
  type SqlCheckResult,
} from '../components/sql/sqlTasks'
import { SqlTasksModal } from '../components/sql/SqlTasksModal'

const STORE_KEY = 'sqllab-pg-v3'

interface SqlBlock {
  id: string
  title: string
  sql: string
  isSchema?: boolean
}

function presetToBlocks(preset: SqlPreset): SqlBlock[] {
  return [
    { id: makeCellId(), title: '1. Таблицы и данные (CREATE / INSERT)', sql: preset.schema, isSchema: true },
    { id: makeCellId(), title: '2. SQL-запрос', sql: preset.query },
  ]
}

function loadSavedBlocks(): SqlBlock[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0]?.sql === 'string') {
        return parsed
      }
    }
  } catch {}
  return presetToBlocks(SQL_PRESETS[0])
}

function calcEditorHeight(code: string, minH = 110, maxH = 340): number {
  const lines = Math.max(4, code.split('\n').length)
  return Math.min(maxH, Math.max(minH, lines * 19 + 20))
}

const PG_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'ON',
  'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'DISTINCT', 'AS', 'WITH',
  'INSERT INTO', 'VALUES', 'RETURNING', 'UPDATE', 'SET', 'DELETE FROM',
  'CREATE TABLE', 'CREATE VIEW', 'DROP TABLE IF EXISTS', 'ALTER TABLE',
  'SERIAL PRIMARY KEY', 'INTEGER', 'TEXT', 'NUMERIC', 'BOOLEAN', 'DATE', 'TIMESTAMPTZ', 'JSONB',
  'NOT NULL', 'REFERENCES', 'CHECK', 'DEFAULT', 'UNIQUE',
  'COUNT(*)', 'SUM()', 'AVG()', 'MIN()', 'MAX()', 'ROUND()', 'COALESCE()',
  'RANK() OVER ()', 'ROW_NUMBER() OVER ()', 'STRING_AGG()', 'ILIKE', 'EXPLAIN ANALYZE',
]

let monacoRegistered = false
const completionTablesRef: { current: TableSchemaInfo[] } = { current: [] }

export default function SqlLab() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'fail'>('loading')
  const [initErr, setInitErr] = useState('')
  const [pgVersion, setPgVersion] = useState('PostgreSQL')

  const [blocks, setBlocks] = useState<SqlBlock[]>(() => loadSavedBlocks())
  const [outcomes, setOutcomes] = useState<Record<string, SqlExecOutcome>>({})
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const [collapsedSchema, setCollapsedSchema] = useState(false)

  const [tables, setTables] = useState<TableSchemaInfo[]>([])
  const [inspectedTable, setInspectedTable] = useState<string | null>(null)
  const [showErModal, setShowErModal] = useState(false)
  const [selectedErTable, setSelectedErTable] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<null | 'presets' | 'snippets'>(null)

  const [showTasksModal, setShowTasksModal] = useState(false)
  const [serverSqlTasks, setServerSqlTasks] = useState<SqlPracticeTask[]>([])
  const [classrooms, setClassrooms] = useState<{ id: number; title: string }[]>([])
  const [activeTask, setActiveTask] = useState<SqlPracticeTask | null>(null)
  const [checkingTask, setCheckingTask] = useState(false)
  const [taskReport, setTaskReport] = useState<{
    passed: boolean
    score: number
    max_score: number
    passed_tests: number
    total_tests: number
    gradebook_synced?: boolean
    results: SqlCheckResult[]
  } | null>(null)
  const isTeacher = canTeach()
  const isAuth = Boolean(typeof window !== 'undefined' && localStorage.getItem('token'))

  useEffect(() => {
    client
      .get('/code-tasks/', { params: { language: 'sql' } })
      .then((r) => {
        const arr = Array.isArray(r.data) ? r.data : r.data?.results || []
        setServerSqlTasks(arr.map((x: any) => ({ ...x, tests: x.tests || x.public_tests || [] })))
      })
      .catch(() => {})
    if (isTeacher && isAuth) {
      client
        .get('/classrooms/')
        .then((r) => {
          const arr = Array.isArray(r.data) ? r.data : r.data?.results || []
          setClassrooms(arr.map((c: any) => ({ id: c.id, title: c.title })))
        })
        .catch(() => {})
    }
  }, [isAuth, isTeacher])

  const allSqlTasks: SqlPracticeTask[] = [...serverSqlTasks, ...BUILTIN_SQL_TASKS]

  const sessionRef = useRef<SqlLabSession | null>(null)
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const dbInitializedRef = useRef(false)

  useEffect(() => {
    completionTablesRef.current = tables
  }, [tables])

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(blocks)) } catch {}
  }, [blocks])

  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [openMenu])

  const refreshSchema = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    const list = await s.inspectSchema()
    setTables(list)
  }, [])

  // Пересобрать чистую БД и выполнить все блоки сверху вниз
  const runAllBlocks = useCallback(async (overrideBlocks?: SqlBlock[]) => {
    const s = sessionRef.current
    if (!s) return
    const list = overrideBlocks ?? blocksRef.current
    setRunningAll(true)
    setOutcomes({})
    try {
      await s.reset()
      setPgVersion(s.versionLabel)
      dbInitializedRef.current = true
      const next: Record<string, SqlExecOutcome> = {}
      for (const blk of list) {
        if (!blk.sql.trim()) continue
        setRunningId(blk.id)
        const out = await s.execute(blk.sql)
        next[blk.id] = out
        setOutcomes({ ...next })
        if (out.error && blk.isSchema) break
      }
      await refreshSchema()
    } finally {
      setRunningId(null)
      setRunningAll(false)
    }
  }, [refreshSchema])

  // Умный запуск одного блока:
  // • Если это Блок 1 (схема) — сбрасываем БД и создаём таблицы заново (никаких "already exists"!)
  // • Если это запрос (Блок 2+) и БД ещё пустая — сначала прогоняем Блок 1, затем этот запрос
  const runOneBlock = useCallback(async (blockId: string, explain = false) => {
    const s = sessionRef.current
    if (!s) return
    const list = blocksRef.current
    const idx = list.findIndex(b => b.id === blockId)
    if (idx < 0) return
    const blk = list[idx]
    if (!blk.sql.trim()) return

    setRunningId(blockId)
    try {
      const isFirstSchema = idx === 0 && (blk.isSchema || /\bCREATE\s+TABLE\b/i.test(blk.sql))
      if (isFirstSchema) {
        await s.reset()
        dbInitializedRef.current = true
        const out = await s.execute(blk.sql)
        setOutcomes(prev => ({ ...prev, [blk.id]: out }))
        await refreshSchema()
        return
      }

      if (!dbInitializedRef.current && list[0] && list[0].id !== blk.id && list[0].sql.trim()) {
        await s.reset()
        dbInitializedRef.current = true
        const schemaOut = await s.execute(list[0].sql)
        setOutcomes(prev => ({ ...prev, [list[0].id]: schemaOut }))
        if (schemaOut.error) {
          await refreshSchema()
          return
        }
      }

      const sqlToRun = explain ? `EXPLAIN ANALYZE\n${blk.sql}` : blk.sql
      const out = await s.execute(sqlToRun)
      setOutcomes(prev => ({ ...prev, [blk.id]: out }))
      await refreshSchema()
    } finally {
      setRunningId(null)
    }
  }, [refreshSchema])

  const runOneRef = useRef(runOneBlock)
  runOneRef.current = runOneBlock

  // Старт настоящего PostgreSQL (PGlite WASM) при открытии страницы
  const bootPostgres = useCallback(async (initialBlocks?: SqlBlock[]) => {
    setPhase('loading')
    setInitErr('')
    try {
      if (!sessionRef.current) sessionRef.current = new SqlLabSession()
      const ver = await sessionRef.current.init('postgres')
      setPgVersion(ver)
      setPhase('ready')
      await runAllBlocks(initialBlocks ?? blocksRef.current)
    } catch (e: any) {
      setInitErr(String(e?.message || e))
      setPhase('fail')
    }
  }, [runAllBlocks])

  useEffect(() => {
    bootPostgres()
    return () => {
      sessionRef.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Загрузить готовый пример
  const applyPreset = async (preset: SqlPreset) => {
    setOpenMenu(null)
    setInspectedTable(null)
    setCollapsedSchema(false)
    const nextBlocks = presetToBlocks(preset)
    setBlocks(nextBlocks)
    blocksRef.current = nextBlocks
    await runAllBlocks(nextBlocks)
    toast(`Загружен пример «${preset.name}»`, 'success')
  }

  // Пустая база для самостоятельной работы с нуля
  const startEmpty = async () => {
    setOpenMenu(null)
    setInspectedTable(null)
    setCollapsedSchema(false)
    const emptyBlocks: SqlBlock[] = [
      {
        id: makeCellId(),
        title: '1. Создание таблиц (CREATE TABLE / INSERT)',
        isSchema: true,
        sql: `-- Создайте свою таблицу в PostgreSQL\nCREATE TABLE users (\n  id   SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  age  INTEGER\n);\n\nINSERT INTO users (name, age) VALUES ('Алихан', 18), ('Айдана', 19);`,
      },
      {
        id: makeCellId(),
        title: '2. SQL-запрос',
        sql: `SELECT * FROM users ORDER BY id;`,
      },
    ]
    setBlocks(emptyBlocks)
    blocksRef.current = emptyBlocks
    await runAllBlocks(emptyBlocks)
    toast('Открыта чистая база PostgreSQL', 'info')
  }

  const resetToDefault = async () => {
    setActiveTask(null)
    setTaskReport(null)
    await applyPreset(SQL_PRESETS[0])
  }

  const openSqlTask = async (task: SqlPracticeTask) => {
    setActiveTask(task)
    setTaskReport(null)
    setInspectedTable(null)
    const nextBlocks: SqlBlock[] = [
      {
        id: makeCellId(),
        title: '1. Схема задачи (таблицы и данные)',
        sql: task.schema_sql || SQL_PRESETS[0].schema,
        isSchema: true,
      },
      {
        id: makeCellId(),
        title: `2. Ваше решение — ${task.title}`,
        sql: task.starter_code || '-- Напишите SQL-запрос здесь\n',
      },
    ]
    setBlocks(nextBlocks)
    blocksRef.current = nextBlocks
    setCollapsedSchema(true)
    if (sessionRef.current && phase === 'ready') {
      await sessionRef.current.reset()
      dbInitializedRef.current = true
      const schemaOut = await sessionRef.current.execute(nextBlocks[0].sql)
      setOutcomes({ [nextBlocks[0].id]: schemaOut })
      await refreshSchema()
    }
    toast(`Открыта SQL-задача «${task.title}»`, 'info')
  }

  const captureReferenceSql = async (schemaSql: string, solutionSql: string): Promise<SqlExecOutcome | null> => {
    const s = sessionRef.current
    if (!s || phase !== 'ready') return null
    await s.reset()
    dbInitializedRef.current = true
    if (schemaSql.trim()) {
      const schemaOut = await s.execute(schemaSql)
      if (schemaOut.error) return schemaOut
    }
    const solOut = await s.execute(solutionSql)
    await refreshSchema()
    return solOut
  }

  const verifyActiveSqlTask = async () => {
    if (!activeTask || checkingTask) return
    const s = sessionRef.current
    if (!s || phase !== 'ready') {
      toast('Подождите, PostgreSQL ещё запускается…', 'info')
      return
    }
    const schemaBlk = blocks[0]
    const queryBlk = blocks[1] || blocks[0]
    const querySql = queryBlk?.sql || ''
    if (!querySql.trim()) {
      toast('Напишите SQL-запрос перед проверкой', 'error')
      return
    }
    setCheckingTask(true)
    setTaskReport(null)
    try {
      // Всегда проверяем на чистой схеме задачи, чтобы правки предыдущих запусков не мешали
      await s.reset()
      dbInitializedRef.current = true
      const schemaSql = activeTask.schema_sql || schemaBlk?.sql || ''
      const nextOut: Record<string, SqlExecOutcome> = {}
      if (schemaSql.trim()) {
        const sOut = await s.execute(schemaSql)
        if (schemaBlk) nextOut[schemaBlk.id] = sOut
      }
      const qOut = await s.execute(querySql)
      if (queryBlk) nextOut[queryBlk.id] = qOut
      setOutcomes(nextOut)
      await refreshSchema()

      const lastTable = qOut.results[qOut.results.length - 1]
      const cols = (lastTable?.columns || []).map((c) => c.name)
      const rows = (lastTable?.rows || []) as any[][]
      const errMsg = qOut.error?.message || ''

      if (!activeTask.builtin) {
        if (!isAuth) {
          toast('Войдите в аккаунт, чтобы сдать задачу учителю', 'error')
          setCheckingTask(false)
          return
        }
        const res = await client.post(`/code-tasks/${activeTask.id}/submit_sql/`, {
          sql: querySql,
          columns: cols,
          rows,
          error: errMsg,
        })
        const rep = {
          passed: Boolean(res.data.passed),
          score: Number(res.data.score ?? 0),
          max_score: Number(res.data.max_score ?? activeTask.max_score ?? 100),
          passed_tests: Number(res.data.passed_tests ?? 0),
          total_tests: Number(res.data.total_tests ?? 0),
          gradebook_synced: Boolean(res.data.gradebook_synced),
          results: Array.isArray(res.data.test_results) ? res.data.test_results : [],
        }
        setTaskReport(rep)
        if (rep.passed) {
          setServerSqlTasks((prev) =>
            prev.map((x) =>
              String(x.id) === String(activeTask.id)
                ? { ...x, my_passed: true, my_best_score: Math.max(x.my_best_score || 0, rep.score) }
                : x
            )
          )
          toast(
            rep.gradebook_synced
              ? `SQL-задача решена (${rep.score}/${rep.max_score}) — записано в журнал!`
              : `SQL-задача решена (${rep.score}/${rep.max_score})!`,
            'success'
          )
        } else {
          toast(`Пройдено ${rep.passed_tests} из ${rep.total_tests} проверок`, 'info')
        }
        return
      }

      const ev = evaluateSqlLocal(activeTask.tests || [], querySql, cols, rows, errMsg)
      setTaskReport({
        passed: ev.passed,
        score: ev.score,
        max_score: activeTask.max_score,
        passed_tests: ev.passedTests,
        total_tests: ev.totalTests,
        results: ev.results,
      })
      toast(
        ev.passed
          ? `Отлично! Задача решена (${ev.score}/${activeTask.max_score})`
          : `Пройдено ${ev.passedTests} из ${ev.totalTests} проверок`,
        ev.passed ? 'success' : 'info'
      )
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Не удалось проверить SQL-задачу', 'error')
    } finally {
      setCheckingTask(false)
    }
  }

  const addQueryBlock = (sql = 'SELECT * FROM students LIMIT 10;', title?: string) => {
    const num = blocks.length + 1
    const nb: SqlBlock = {
      id: makeCellId(),
      title: title || `${num}. SQL-запрос`,
      sql,
    }
    setBlocks(prev => [...prev, nb])
    return nb.id
  }

  const updateBlock = (id: string, patch: Partial<SqlBlock>) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return
    setBlocks(prev => prev.filter(b => b.id !== id))
    setOutcomes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // Быстрый SELECT * по таблице из панели таблиц
  const previewTableRows = async (tableName: string) => {
    const safe = tableName.replace(/"/g, '""')
    const sql = `SELECT * FROM "${safe}" LIMIT 50;`
    setInspectedTable(null)
    // Ищем существующий блок просмотра или обновляем последний запрос
    const existing = blocks.find(b => b.title.startsWith('Просмотр:'))
    if (existing) {
      const next = blocks.map(b => (b.id === existing.id ? { ...b, title: `Просмотр: ${tableName}`, sql } : b))
      setBlocks(next)
      blocksRef.current = next
      await runOneBlock(existing.id)
    } else {
      const nid = addQueryBlock(sql, `Просмотр: ${tableName}`)
      setTimeout(() => runOneRef.current(nid), 60)
    }
  }

  const downloadSql = () => {
    const text = blocks.map(b => `-- ${b.title}\n${b.sql.trim()}`).join('\n\n') + '\n'
    const blob = new Blob([text], { type: 'text/sql;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'postgres-queries.sql'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Автодополнение таблиц, колонок и PostgreSQL-команд в Monaco
  const mountEditor = (blockId: string): OnMount => (editor, monaco) => {
    if (!monacoRegistered) {
      monacoRegistered = true
      monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems(model: any, position: any) {
          const word = model.getWordUntilPosition(position)
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          }
          const suggestions: any[] = []
          for (const tbl of completionTablesRef.current) {
            suggestions.push({
              label: tbl.name,
              kind: monaco.languages.CompletionItemKind.Class,
              detail: `таблица (${tbl.rowCount} строк)`,
              insertText: tbl.name,
              range,
            })
            for (const col of tbl.columns) {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                detail: `${tbl.name}.${col.name} (${col.type})`,
                insertText: col.name,
                range,
              })
            }
          }
          for (const kw of PG_KEYWORDS) {
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              detail: 'PostgreSQL',
              insertText: kw,
              range,
            })
          }
          return { suggestions }
        },
      })
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runOneRef.current(blockId)
    })
  }

  const editorOpts = {
    minimap: { enabled: false },
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: "'Cascadia Code','JetBrains Mono','Consolas',monospace",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on' as const,
    padding: { top: 8, bottom: 8 },
    tabSize: 2,
    lineNumbers: 'on' as const,
    renderLineHighlight: 'line' as const,
    folding: true,
    scrollbar: { alwaysConsumeMouseWheel: false },
  }

  const activeInspected = inspectedTable ? tables.find(t => t.name === inspectedTable) : null

  return (
    <div className="-m-4 mb-[-7rem] lg:-m-8 flex flex-col h-[calc(100dvh-64px-env(safe-area-inset-top))] pb-[calc(57px+env(safe-area-inset-bottom))] lg:pb-0 bg-[#0d1117] text-slate-200 overflow-hidden text-sm">
      {/* ==================== 1. ШАПКА SQL-ЛАБОРАТОРИИ ==================== */}
      <div className="min-h-[3rem] bg-[#161b22] border-b border-[#262d38] px-2.5 sm:px-3 py-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 relative z-30">
        {/* Бейдж PostgreSQL */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-0.5 sm:pr-1">
          <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Database size={15} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white text-xs sm:text-sm whitespace-nowrap hidden sm:inline">{pgVersion}</span>
            <span className="font-extrabold text-white text-xs whitespace-nowrap sm:hidden">PostgreSQL</span>
            {phase === 'ready' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="PostgreSQL готов к работе" />
            )}
            {phase === 'loading' && (
              <Loader2 size={13} className="animate-spin text-sky-400 shrink-0" />
            )}
          </div>
        </div>

        {/* Главная кнопка запуска */}
        <button
          type="button"
          disabled={phase !== 'ready' || runningAll}
          onClick={() => runAllBlocks()}
          className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow shrink-0 whitespace-nowrap"
          title="Создать базу заново и выполнить все SQL-блоки"
        >
          {runningAll ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={14} />}
          <span className="hidden sm:inline">Запустить всё</span>
          <span className="sm:hidden">Пуск</span>
        </button>

        {/* Примеры */}
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setOpenMenu(m => (m === 'presets' ? null : 'presets'))}
            className="h-8 px-2 sm:px-2.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
          >
            <Sparkles size={12} className="text-amber-400" />
            <span>Примеры</span>
            <ChevronDown size={12} />
          </button>
          {openMenu === 'presets' && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className="absolute left-0 top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-24px)] rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xl p-2 space-y-1"
            >
              {SQL_PRESETS.map(pr => (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => applyPreset(pr)}
                  className="w-full text-left p-2 rounded-lg hover:bg-[#21262d] transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{pr.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 text-[9.5px] font-mono">{pr.badge}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{pr.desc}</div>
                </button>
              ))}
              <div className="border-t border-[#262d38] pt-1">
                <button
                  type="button"
                  onClick={startEmpty}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#21262d] text-xs font-semibold text-sky-300"
                >
                  + Пустая база (написать с нуля)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Шпаргалка */}
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setOpenMenu(m => (m === 'snippets' ? null : 'snippets'))}
            className="h-8 px-2.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
          >
            <BookOpen size={12} className="text-sky-400" />
            <span className="hidden sm:inline">Шпаргалка</span>
            <ChevronDown size={12} />
          </button>
          {openMenu === 'snippets' && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className="absolute right-0 sm:left-0 top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-24px)] max-h-[65vh] overflow-y-auto rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xl p-2 space-y-1"
            >
              {SQL_SNIPPETS.map((sn, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    addQueryBlock(sn.code, sn.label)
                    setOpenMenu(null)
                    toast(`Добавлен блок «${sn.label}»`, 'info')
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-[#21262d] transition"
                >
                  <div className="text-xs font-bold text-slate-100">{sn.label}</div>
                  <pre className="text-[10px] font-mono text-slate-400 line-clamp-2 mt-0.5">{sn.code}</pre>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Задачи с автопроверкой */}
        <button
          type="button"
          onClick={() => setShowTasksModal(true)}
          className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap ${
            activeTask
              ? 'bg-emerald-700 border-emerald-500 text-white'
              : 'bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-emerald-300'
          }`}
          title="Практические задачи PostgreSQL с автопроверкой"
        >
          <ClipboardCheck size={12} />
          <span>Задачи</span>
        </button>

        {/* ER-схема */}
        <button
          type="button"
          onClick={() => setShowErModal(true)}
          disabled={tables.length === 0}
          className="h-8 px-2.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 border border-[#30363d] text-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap"
          title="Показать визуальную схему связей таблиц"
        >
          <GitFork size={12} className="text-sky-400" />
          <span className="hidden sm:inline">ER-схема</span>
        </button>

        {/* Справа: Сброс и Скачать .sql */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={resetToDefault}
            title="Сбросить к примеру «Школа»"
            className="h-8 px-2.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-300 text-xs flex items-center gap-1 whitespace-nowrap"
          >
            <RefreshCw size={12} />
            <span className="hidden md:inline">Сброс</span>
          </button>
          <button
            type="button"
            onClick={downloadSql}
            title="Скачать .sql файл"
            className="h-8 px-2.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-300 text-xs flex items-center gap-1 whitespace-nowrap"
          >
            <Download size={12} />
            <span className="hidden md:inline">.sql</span>
          </button>
        </div>
      </div>

      {/* ==================== 2. ПОЛОСА ТАБЛИЦ БАЗЫ (ВСЕГДА ПОД РУКОЙ) ==================== */}
      <div className="bg-[#12171f] border-b border-[#222a36] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
          <Table2 size={12} className="text-emerald-400" /> Таблицы:
        </span>
        {tables.length === 0 ? (
          <span className="text-[11px] text-slate-500">
            {phase === 'loading' ? 'Запускается PostgreSQL…' : 'Нет таблиц — нажмите «Запустить всё»'}
          </span>
        ) : (
          tables.map(tbl => {
            const active = inspectedTable === tbl.name
            return (
              <button
                key={tbl.name}
                type="button"
                onClick={() => setInspectedTable(active ? null : tbl.name)}
                className={`px-2.5 py-0.5 rounded-md border text-[11.5px] font-mono flex items-center gap-1.5 shrink-0 transition ${
                  active
                    ? 'bg-sky-600 text-white border-sky-500'
                    : 'bg-[#1a222d] hover:bg-[#222d3c] border-[#2c3645] text-slate-200'
                }`}
                title="Нажмите, чтобы увидеть колонки и содержимое таблицы"
              >
                {tbl.kind === 'view' ? <Eye size={11} className="text-violet-300" /> : null}
                <span className="font-bold">{tbl.name}</span>
                <span className={`text-[10px] ${active ? 'text-sky-100' : 'text-slate-400'}`}>({tbl.rowCount})</span>
              </button>
            )
          })
        )}
        <span className="ml-auto text-[10.5px] text-slate-500 hidden lg:inline shrink-0">
          Ctrl+Enter в любом блоке — выполнить
        </span>
      </div>

      {/* Быстрый просмотр структуры выбранной таблицы */}
      {activeInspected && (
        <div className="bg-[#161d27] border-b border-sky-800/60 px-4 py-2.5 shrink-0">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-white">{activeInspected.name}</span>
              <span className="text-xs text-slate-400">{activeInspected.rowCount} строк</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              {activeInspected.columns.map(col => (
                <span
                  key={col.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0d1117] border border-[#2c3645] text-[11px] font-mono"
                >
                  {col.isPk && <KeyRound size={10} className="text-amber-400" />}
                  {col.fkTarget && <Link2 size={10} className="text-sky-400" />}
                  <span className={col.isPk ? 'text-amber-200 font-bold' : 'text-slate-200'}>{col.name}</span>
                  <span className="text-sky-400/80 text-[10px]">{col.type}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => previewTableRows(activeInspected.name)}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                SELECT * FROM {activeInspected.name}
              </button>
              <button
                type="button"
                onClick={() => setInspectedTable(null)}
                className="p-1 rounded hover:bg-white/10 text-slate-400"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. РАБОЧАЯ ОБЛАСТЬ (ПРОСТОЙ ПОНЯТНЫЙ БЛОКНОТ) ==================== */}
      {phase === 'fail' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-4xl">🐘</div>
          <p className="text-slate-200 font-bold">Не удалось запустить PostgreSQL в браузере</p>
          {initErr && <p className="text-rose-400 text-xs font-mono max-w-lg break-all">{initErr}</p>}
          <button
            type="button"
            onClick={() => bootPostgres()}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Повторить запуск
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4">
          <div className="max-w-5xl mx-auto space-y-4 pb-10">
            {phase === 'loading' && (
              <div className="rounded-xl border border-sky-800/60 bg-sky-950/30 px-4 py-3 flex items-center gap-3 text-xs text-sky-200">
                <Loader2 size={16} className="animate-spin text-sky-400 shrink-0" />
                <span>Загружается настоящий PostgreSQL (WASM)… это займёт пару секунд.</span>
              </div>
            )}

            {/* Карточка активной SQL-задачи с автопроверкой */}
            {activeTask && (
              <div className="rounded-xl border border-emerald-700/60 bg-[#131d27] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardCheck size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-bold text-sm text-white">{activeTask.title}</span>
                  {activeTask.difficulty && (
                    <span className="px-2 py-0.5 rounded bg-[#21262d] text-[10px] font-semibold text-sky-300">
                      {activeTask.difficulty}
                    </span>
                  )}
                  {activeTask.classroom_title && (
                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-[10px] text-indigo-300 flex items-center gap-1">
                      <GraduationCap size={10} /> {activeTask.classroom_title}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={phase !== 'ready' || checkingTask}
                      onClick={verifyActiveSqlTask}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      {checkingTask ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      {checkingTask ? 'Проверяем…' : 'Проверить решение'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTask(null); setTaskReport(null) }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Закрыть задачу"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{activeTask.description}</p>
                {taskReport && (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-bold ${taskReport.passed ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {taskReport.passed
                          ? `✓ Все проверки пройдены — ${taskReport.score}/${taskReport.max_score} балл.`
                          : `Пройдено ${taskReport.passed_tests} из ${taskReport.total_tests} (${taskReport.score}/${taskReport.max_score} балл.)`}
                      </span>
                      {taskReport.gradebook_synced && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10.5px]">
                          Записано в журнал класса
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {taskReport.results.map((r, i) => (
                        <div
                          key={i}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                            r.passed
                              ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                              : 'bg-rose-950/50 border-rose-700/60 text-rose-200'
                          }`}
                        >
                          {r.passed ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-rose-400 shrink-0" />}
                          <span>{r.label}</span>
                          {r.detail && <span className="text-[10px] opacity-80">— {r.detail}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {blocks.map((blk, idx) => {
              const out = outcomes[blk.id]
              const isRunning = runningId === blk.id
              const isSchema = idx === 0 && blk.isSchema
              const isCollapsed = isSchema && collapsedSchema

              return (
                <div
                  key={blk.id}
                  className={`rounded-xl border overflow-hidden transition ${
                    out?.error ? 'border-rose-700/80 bg-[#141921]' : 'border-[#27303d] bg-[#141921]'
                  }`}
                >
                  {/* Шапка блока */}
                  <div className="px-2.5 sm:px-3 py-2 bg-[#181f29] border-b border-[#242d3a] flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {isSchema && (
                      <button
                        type="button"
                        onClick={() => setCollapsedSchema(v => !v)}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-400"
                        title={isCollapsed ? 'Развернуть код создания таблиц' : 'Свернуть код создания таблиц'}
                      >
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )}

                    <input
                      value={blk.title}
                      onChange={e => updateBlock(blk.id, { title: e.target.value })}
                      className="bg-transparent text-xs sm:text-sm font-bold text-slate-100 outline-none flex-1 min-w-[100px]"
                    />

                    {out && !out.error && (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                        <CircleCheck size={12} /> {out.durationMs} ms
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={phase !== 'ready' || isRunning || runningAll}
                      onClick={() => runOneBlock(blk.id, false)}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                      title="Выполнить этот блок (Ctrl+Enter)"
                    >
                      {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} className="fill-white" />}
                      <span>Выполнить</span>
                    </button>

                    {!isSchema && (
                      <button
                        type="button"
                        disabled={phase !== 'ready' || isRunning || runningAll}
                        onClick={() => runOneBlock(blk.id, true)}
                        className="px-2 py-1 rounded-lg bg-[#222a36] hover:bg-sky-700 text-sky-300 hover:text-white text-[11px] font-mono font-bold hidden sm:flex items-center gap-1 shrink-0"
                        title="План выполнения запроса (EXPLAIN ANALYZE)"
                      >
                        <SearchCode size={12} /> EXPLAIN
                      </button>
                    )}

                    {blocks.length > 1 && !isSchema && (
                      <button
                        type="button"
                        onClick={() => removeBlock(blk.id)}
                        title="Удалить блок"
                        className="p-1.5 rounded-lg hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Код SQL */}
                  {!isCollapsed && (
                    <div style={{ height: calcEditorHeight(blk.sql) }} className="relative bg-[#1e1e1e]">
                      <Editor
                        height="100%"
                        path={`pg-blk-${blk.id}`}
                        language="sql"
                        value={blk.sql}
                        onChange={v => updateBlock(blk.id, { sql: v || '' })}
                        onMount={mountEditor(blk.id)}
                        theme="vs-dark"
                        options={editorOpts}
                        loading={<div className="flex items-center justify-center h-full text-slate-500 text-xs">Загрузка редактора…</div>}
                      />
                    </div>
                  )}

                  {/* Результат прямо под блоком */}
                  {out && (
                    <div className="p-3 bg-[#0f141b] border-t border-[#242d3a] space-y-2.5">
                      {out.error && (
                        <div className="rounded-lg border border-rose-800/70 bg-rose-950/40 p-3 text-xs space-y-1.5">
                          <div className="flex items-center gap-2 text-rose-300 font-bold">
                            <AlertTriangle size={14} className="shrink-0" />
                            <span>Ошибка PostgreSQL</span>
                            {out.error.code && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-900/60 font-mono text-[10px]">
                                {out.error.code}
                              </span>
                            )}
                            {out.error.line && (
                              <span className="ml-auto font-mono text-[11px] text-amber-300">
                                строка {out.error.line}, кол. {out.error.col}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[12px] text-rose-200 break-words">{out.error.message}</div>
                          {out.error.snippet && (
                            <pre className="p-2 rounded bg-[#0d1117] text-[11px] font-mono text-amber-200 overflow-x-auto">
                              {out.error.snippet}
                            </pre>
                          )}
                          {out.error.detail && <div className="text-[11px] text-slate-300">{out.error.detail}</div>}
                          {out.error.hint && <div className="text-[11px] text-sky-300">Подсказка: {out.error.hint}</div>}
                        </div>
                      )}

                      {!out.error && out.results.length === 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-emerald-300">
                          <CircleCheck size={13} />
                          <span>
                            {isSchema
                              ? `Готово: создано таблиц — ${tables.length} (${tables.map(t => t.name).join(', ') || 'нет'})`
                              : out.notices.map(n => `${n.command}${n.rowCount ? ` (${n.rowCount})` : ''}`).join(' · ') || 'Выполнено успешно'}
                          </span>
                        </div>
                      )}

                      {out.results.map((res, ri) => (
                        <SqlResultTable key={ri} result={res} index={ri} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Кнопка добавить ещё запрос */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => addQueryBlock()}
                className="px-4 py-2 rounded-xl bg-[#1a222d] hover:bg-sky-600 border border-[#303a49] hover:border-sky-500 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus size={14} /> Добавить ещё SQL-запрос
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== МОДАЛКА: ER-СХЕМА ТАБЛИЦ ==================== */}
      {showErModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setShowErModal(false) }}
        >
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <GitFork size={16} className="text-sky-400" /> ER-схема базы данных
              </div>
              <button
                type="button"
                onClick={() => setShowErModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ErDiagramSvg
                tables={tables}
                selectedTable={selectedErTable}
                onSelectTable={name => setSelectedErTable(prev => (prev === name ? null : name))}
              />
            </div>
          </div>
        </div>
      )}
      <SqlTasksModal
        open={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        tasks={allSqlTasks}
        activeTaskId={activeTask?.id ?? null}
        canCreate={isTeacher && isAuth}
        classrooms={classrooms}
        currentSchemaSql={blocks[0]?.sql || SQL_PRESETS[0].schema}
        onSelectTask={openSqlTask}
        onCaptureReferenceSql={captureReferenceSql}
        onTaskCreated={(created) => {
          setServerSqlTasks((prev) => [created, ...prev])
          openSqlTask(created)
        }}
      />
    </div>
  )
}
