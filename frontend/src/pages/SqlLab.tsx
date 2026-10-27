import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Database, Table2, Loader2, Download, CircleCheck, RefreshCw } from 'lucide-react'
import { useLang } from '../context/LangContext'

// ─────────────────────────────────────────────────────────────────────────────
// Практика баз данных: настоящий SQLite (WASM sql.js) прямо в браузере.
// Никакого бэкенда: «Выполнить» каждый раз пересобирает базу из поля «Схема
// и данные», затем исполняет SQL-запрос — результат всегда детерминированный,
// рассинхрона схемы и запроса не бывает.
// sql.js грузится лениво (динамический импорт + отдельный чанк vendor-sql),
// поэтому вес WASM не замедляет остальные страницы.
// ─────────────────────────────────────────────────────────────────────────────

type SqlRow = (string | number | Uint8Array | null)[]
type SqlRes = { columns: string[]; values: SqlRow[] }
interface SqlDbLike {
  run(sql: string): void
  exec(sql: string): SqlRes[]
  getRowsModified(): number
  close(): void
}
interface SqlEngineLike {
  Database: new (data?: ArrayLike<number> | null) => SqlDbLike
}

const STORE_KEY = 'sqllab-state'
const MAX_ROWS_SHOWN = 100

const P_SCHOOL_SCHEMA = `-- Учебная база: ученики, предметы, оценки
CREATE TABLE students (
  id    INTEGER PRIMARY KEY,
  name  TEXT    NOT NULL,
  klass TEXT    NOT NULL
);

CREATE TABLE subjects (
  id     INTEGER PRIMARY KEY,
  title  TEXT    NOT NULL,
  teacher TEXT   NOT NULL
);

CREATE TABLE grades (
  student_id INTEGER NOT NULL REFERENCES students(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  grade      INTEGER NOT NULL CHECK (grade BETWEEN 2 AND 5)
);

INSERT INTO students (name, klass) VALUES
  ('Айдана', '7А'), ('Иван',   '7Б'),
  ('Айбек',  '8А'), ('Мария',  '8А'),
  ('Данияр', '7А'), ('Ольга',  '7Б');

INSERT INTO subjects (title, teacher) VALUES
  ('Математика',  'Токтогулова Г.'),
  ('Информатика', 'Смирнова О.'),
  ('Физика',      'Петров А.');

INSERT INTO grades (student_id, subject_id, grade) VALUES
  (1,1,5),(1,2,5),(1,3,4),
  (2,1,4),(2,2,5),
  (3,1,3),(3,3,4),
  (4,2,5),(4,3,5),
  (5,1,5),(5,3,3);`

const P_SCHOOL_QUERY = `-- Средний балл каждого ученика по всем предметам
SELECT s.name, s.klass,
       ROUND(AVG(g.grade), 2) AS avg_grade,
       COUNT(*)               AS n_subjects
FROM grades g
JOIN students s ON s.id = g.student_id
GROUP BY s.id
ORDER BY avg_grade DESC;`

const P_LIB_SCHEMA = `-- Библиотека: книги и авторы
CREATE TABLE authors (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL
);

CREATE TABLE books (
  id        INTEGER PRIMARY KEY,
  title     TEXT    NOT NULL,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  year      INTEGER NOT NULL,
  price     REAL    NOT NULL
);

INSERT INTO authors (name) VALUES
  ('Ч. Айтматов'), ('А. Пушкин'), ('Дж. Роулинг'), ('Л. Толстой');

INSERT INTO books (title, author_id, year, price) VALUES
  ('Белый пар',        1, 1970, 350),
  ('Джамиля',          1, 1958, 280),
  ('Евгений Онегин',   2, 1833, 420),
  ('Гарри Поттер',     3, 1997, 950),
  ('Война и мир',      4, 1869, 780);`

const P_LIB_QUERY = `-- Книги с автором и ценой, дороже 300
SELECT b.title        AS книга,
       a.name         AS автор,
       b.year         AS год,
       b.price        AS цена
FROM books b
JOIN authors a ON a.id = b.author_id
WHERE b.price > 300
ORDER BY b.price DESC;`

const P_SHOP_SCHEMA = `-- Магазин: товары и продажи
CREATE TABLE products (
  id     INTEGER PRIMARY KEY,
  name   TEXT    NOT NULL,
  price  REAL    NOT NULL,
  stock  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sales (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  sold_at     TEXT    NOT NULL
);

INSERT INTO products (name, price, stock) VALUES
  ('Ноутбук', 55000, 8),
  ('Мышь',     1200, 60),
  ('Клавиатура', 3400, 25),
  ('Монитор', 24000, 12);

INSERT INTO sales (product_id, qty, sold_at) VALUES
  (1, 2, '2026-10-01'), (1, 1, '2026-10-03'),
  (2, 5, '2026-10-02'), (2, 3, '2026-10-05'),
  (3, 2, '2026-10-04'),
  (4, 1, '2026-10-05'), (4, 2, '2026-10-06');`

const P_SHOP_QUERY = `-- Выручка по каждому товару (JOIN + GROUP BY)
SELECT p.name                        AS товар,
       SUM(s.qty)                    AS штук,
       ROUND(SUM(s.qty * p.price),2) AS выручка
FROM sales s
JOIN products p ON p.id = s.product_id
GROUP BY p.id
ORDER BY выручка DESC;`

const PRESETS = [
  { id:'school', labelKey:'sql_ex_school', schema:P_SCHOOL_SCHEMA, query:P_SCHOOL_QUERY },
  { id:'lib',    labelKey:'sql_ex_lib',    schema:P_LIB_SCHEMA,    query:P_LIB_QUERY },
  { id:'shop',   labelKey:'sql_ex_shop',   schema:P_SHOP_SCHEMA,   query:P_SHOP_QUERY },
] as const

function loadState(): { schema: string; query: string } {
  try{
    const raw = localStorage.getItem(STORE_KEY)
    if(raw){
      const p = JSON.parse(raw)
      if(typeof p.schema==='string' && typeof p.query==='string') return p
    }
  }catch{ /* битый localStorage — берём пример по умолчанию */ }
  return { schema: P_SCHOOL_SCHEMA, query: P_SCHOOL_QUERY }
}

function listTables(db: SqlDbLike): string[] {
  try{
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    return r.length ? (r[0].values.map(v=>String(v[0]))) : []
  }catch{ return [] }
}

function toCsv(res: SqlRes): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const rows = [res.columns.map(esc).join(',')].concat(res.values.map(r => r.map(esc).join(',')))
  return '\ufeff' + rows.join('\n') // BOM: Excel открывает кириллицу без кракозябр
}

function downloadCsv(name: string, res: SqlRes){
  const blob = new Blob([toCsv(res)], { type:'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function cellText(v: string | number | Uint8Array | null): string {
  if(v == null) return 'NULL'
  if(v instanceof Uint8Array) return `BLOB(${v.length}Б)`
  return String(v)
}

export default function SqlLab(){
  const { t } = useLang()
  const [phase, setPhase] = useState<'loading'|'ready'|'fail'>('loading')
  const [initErr, setInitErr] = useState('')
  const [schema, setSchema] = useState(loadState().schema)
  const [query, setQuery] = useState(loadState().query)
  // Результаты НЕ храним в localStorage: они всегда пересчитываются на «Выполнить».
  const [results, setResults] = useState<SqlRes[]>([])
  const [runErr, setRunErr] = useState('')
  const [rowsChanged, setRowsChanged] = useState<number | null>(null)
  const [tables, setTables] = useState<string[]>([])
  const [ms, setMs] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  // Мобильные табы: на телефоне стек «схема+запрос» не влезает — переключаемся
  // между панелями; на десктопе (lg+) обе панели рядом, табы не рисуются.
  const [mobTab, setMobTab] = useState<'schema'|'run'>('run')
  const engineRef = useRef<SqlEngineLike | null>(null)
  const runRef = useRef<(s?: string, q?: string) => void>(()=>{})

  // Ленивая загрузка SQLite при заходе на страницу
  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try{
        const initmod = await import('sql.js') as unknown as { default?: (cfg?: object)=>Promise<SqlEngineLike> } & ((cfg?: object)=>Promise<SqlEngineLike>)
        const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default
        const engine = await (typeof initmod.default==='function' ? initmod.default : initmod)({ locateFile: () => wasmUrl })
        if(cancelled) return
        engineRef.current = engine
        setPhase('ready')
        // Первый прогон сразу: пользователь видит живые таблицы, а не пустоту
        const st = loadState()
        runRef.current(st.schema, st.query)
      }catch(e){
        if(cancelled) return
        setInitErr(String((e as Error)?.message || e))
        setPhase('fail')
      }
    })()
    return ()=>{ cancelled = true }
  },[])

  useEffect(()=>{
    try{ localStorage.setItem(STORE_KEY, JSON.stringify({ schema, query })) }catch{ /* переполнение — не критично */ }
  },[schema, query])

  // Выполнить = пересобрать базу из схемы + исполнить запрос (без рассинхрона)
  runRef.current = (schemaArg?: string, queryArg?: string)=>{
    const engine = engineRef.current
    if(!engine) return
    const s = schemaArg ?? schema
    const q = queryArg ?? query
    setRunning(true); setRunErr(''); setRowsChanged(null); setResults([])
    // На телефоне после выполнения сразу показать результат
    try{ if(window.innerWidth < 1024) setMobTab('run') }catch{}
    const t0 = performance.now()
    const db = new engine.Database()
    try{
      if(s.trim()) db.run(s)
      setTables(listTables(db))
      if(q.trim()){
        const res = db.exec(q)
        setResults(Array.isArray(res) ? res : [])
        try{ setRowsChanged(db.getRowsModified()) }catch{}
      }
      setMs(Math.round(performance.now() - t0))
    }catch(e){
      setResults([]); setRunErr(String((e as Error)?.message || e))
      setMs(Math.round(performance.now() - t0))
    }finally{
      setRunning(false)
      try{ db.close() }catch{}
    }
  }

  // Ctrl+Enter — выполнить, работает и когда фокус в Monaco
  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey) && e.key==='Enter'){ e.preventDefault(); runRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return ()=>{ window.removeEventListener('keydown', onKey) }
  },[])

  const loadPreset = (p: typeof PRESETS[number]) => {
    // Важно: не только выполнить, но и обновить поля схемы/запроса у редакторов,
    // иначе последующие чипы/Ctrl+Enter запустятся со СТАРОЙ схемой из state.
    setSchema(p.schema); setQuery(p.query)
    runRef.current(p.schema, p.query)
  }
  const resetAll = ()=>{
    try{ localStorage.setItem(STORE_KEY, JSON.stringify({schema:P_SCHOOL_SCHEMA, query:P_SCHOOL_QUERY})) }catch{}
    // Сброс = вернуться к базовому примеру, а не к пустым полям
    setSchema(P_SCHOOL_SCHEMA); setQuery(P_SCHOOL_QUERY)
    setResults([]); setRunErr(''); setRowsChanged(null); setMs(null)
    runRef.current(P_SCHOOL_SCHEMA, P_SCHOOL_QUERY)
  }
  const clickTable = (name: string)=>{
    const q = `SELECT * FROM "${name}" LIMIT 50;`
    setQuery(q)
    runRef.current(undefined, q)
  }

  const editorOpts = {
    minimap:{ enabled:false },
    fontSize:13,
    lineHeight:19,
    fontFamily:"'Cascadia Code','JetBrains Mono','Consolas',monospace",
    scrollBeyondLastLine:false,
    automaticLayout:true,
    wordWrap:'on' as const,
    padding:{ top:8, bottom:8 },
    tabSize:2,
    lineNumbers:'on' as const,
    renderLineHighlight:'line' as const,
    folding:true,
  }

  return (
    <div className="-m-4 lg:-m-8 mb-[-96px] lg:mb-0 flex flex-col h-[calc(100vh-64px)] pb-14 lg:pb-0 bg-[#1e1e1e] border border-[#2d2d2d] overflow-hidden text-sm">
      {/* Заголовок-бар */}
      <div className="h-9 bg-[#181818] border-b border-[#2d2d2d] flex items-center gap-2 px-3 shrink-0 overflow-x-auto">
        <Database size={14} className="text-emerald-400 shrink-0"/>
        <span className="text-slate-200 font-semibold whitespace-nowrap">{t('sql_title')}</span>
        {phase==='ready' && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#10331f] text-emerald-300 text-[11px] shrink-0">
            <CircleCheck size={11}/> {t('sql_ready')}
          </span>
        )}
        {phase==='loading' && (
          <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-[#2d2d2d] text-slate-300 text-[11px] shrink-0">
            <Loader2 size={11} className="animate-spin"/> {t('sql_loading')}
          </span>
        )}
        <span className="hidden md:inline text-slate-500 text-[11px] truncate">{t('sql_sub')}</span>
        <button onClick={resetAll} className="ml-auto flex items-center gap-1 h-8 px-2.5 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-slate-300 text-xs shrink-0" title="localStorage: sqllab-state">
          <RefreshCw size={11}/> {t('sql_reset')}
        </button>
      </div>

      {phase==='fail' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-5xl">🗄️</div>
          <p className="text-slate-300 font-semibold">{t('sql_fail')}</p>
          {initErr && <p className="text-red-400 text-xs font-mono max-w-xl break-all">{initErr}</p>}
          <button onClick={()=>{ /* перезагрузка движка без полной перезагрузки страницы */ (async()=>{
            setPhase('loading')
            try{
              const initmod = await import('sql.js') as unknown as { default?: (cfg?: object)=>Promise<SqlEngineLike> } & ((cfg?: object)=>Promise<SqlEngineLike>)
              const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default
              engineRef.current = await (typeof initmod.default==='function' ? initmod.default : initmod)({ locateFile: () => wasmUrl })
              setPhase('ready')
              const st = loadState()
              runRef.current(st.schema, st.query)
            }catch(e){ setInitErr(String((e as Error)?.message || e)); setPhase('fail') }
          })() }} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm">
            {t('sql_retry')}
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row relative">
          {/* Мобильные табы: на телефоне панели переключаются, Run всегда виден */}
          <div className="lg:hidden h-11 bg-[#252526] border-b border-[#2d2d2d] flex items-center gap-1 px-1.5 py-1 shrink-0">
            <button onClick={()=>setMobTab('schema')} aria-pressed={mobTab==='schema'}
              className={`h-9 min-h-[36px] px-3 rounded text-xs font-bold flex items-center gap-1.5 ${mobTab==='schema'?'bg-[#007acc] text-white':'text-slate-400 active:bg-white/10'}`}>
              <Table2 size={13}/> {t('sql_schema')}
            </button>
            <button onClick={()=>setMobTab('run')} aria-pressed={mobTab==='run'}
              className={`h-9 min-h-[36px] px-3 rounded text-xs font-bold flex items-center gap-1.5 ${mobTab==='run'?'bg-[#007acc] text-white':'text-slate-400 active:bg-white/10'}`}>
              <Play size={13}/> {t('sql_query')}
            </button>
            <button onClick={()=>runRef.current()} disabled={running || phase!=='ready'}
              className="ml-auto h-9 min-h-[36px] px-4 rounded bg-[#16825d] active:bg-[#1a9c6e] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1 shadow">
              {running ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>} {t('sql_run')}
            </button>
          </div>

          {/* Схема */}
          <div className={`${mobTab==='schema'?'flex':'hidden'} lg:flex flex-1 min-h-0 lg:flex-none lg:h-auto lg:w-[min(42%,560px)] lg:shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-[#2d2d2d] lg:min-w-0`}>
            <div className="min-h-[36px] bg-[#252526] border-b border-[#2d2d2d] flex items-center gap-1.5 px-2 py-0.5 shrink-0 overflow-x-auto">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase whitespace-nowrap">{t('sql_schema')}</span>
              <span className="ml-auto text-[11px] text-slate-500 whitespace-nowrap">{t('sql_examples')}</span>
              {PRESETS.map(p=>(
                <button key={p.id} onClick={()=>loadPreset(p)} className="min-h-[30px] px-2.5 py-0.5 rounded bg-[#3c3c3c] hover:bg-emerald-700 text-slate-200 hover:text-white text-[11px] whitespace-nowrap">
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 relative">
              <Editor
                height="100%"
                path="sqllab-schema"
                language="sql"
                value={schema}
                onChange={v=>setSchema(v||'')}
                theme="vs-dark"
                options={editorOpts}
                loading={<div className="flex items-center justify-center h-full text-slate-500 text-xs"><Loader2 size={12} className="animate-spin mr-1"/> {t('sql_loading')}</div>}
              />
            </div>
            {tables.length>0 && (
              <div className="h-24 lg:h-28 bg-[#181818] border-t border-[#2d2d2d] flex flex-col shrink-0">
                <div className="h-6 px-2 flex items-center gap-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase shrink-0">
                  <Table2 size={10}/> {t('sql_tables')} <span className="text-slate-600 normal-case font-normal hidden sm:inline">— {t('sql_tables_hint')}</span>
                </div>
                <div className="flex-1 overflow-auto px-2 pb-2 flex flex-wrap content-start gap-1">
                  {tables.map(name=>(
                    <button key={name} onClick={()=>clickTable(name)} className="min-h-[30px] px-2.5 py-1 rounded bg-[#2a3a2e] hover:bg-emerald-700 border border-emerald-900/60 text-emerald-200 hover:text-white text-[11px] font-mono">
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Запрос + результат */}
          <div className={`${mobTab==='run'?'flex':'hidden'} lg:flex flex-1 min-h-0 flex-col min-w-0`}>
            <div className="h-8 bg-[#252526] border-b border-[#2d2d2d] flex items-center gap-2 px-2 shrink-0">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase whitespace-nowrap">{t('sql_query')}</span>
              <span className="hidden sm:inline text-[10px] text-slate-600 whitespace-nowrap">{t('sql_hint')}</span>
              <button
                onClick={()=>runRef.current()}
                disabled={running || phase!=='ready'}
                className="ml-auto hidden lg:flex px-3 py-0.5 rounded bg-[#16825d] hover:bg-[#1a9c6e] disabled:opacity-60 text-white text-xs font-bold items-center gap-1 shrink-0"
              >
                {running ? <Loader2 size={11} className="animate-spin"/> : <Play size={11}/>} {t('sql_run')}
              </button>
            </div>
            <div className="h-40 lg:h-48 shrink-0 relative border-b border-[#2d2d2d]">
              <Editor
                height="100%"
                path="sqllab-query"
                language="sql"
                value={query}
                onChange={v=>setQuery(v||'')}
                theme="vs-dark"
                options={editorOpts}
                loading={<div className="flex items-center justify-center h-full text-slate-500 text-xs"><Loader2 size={12} className="animate-spin mr-1"/> {t('sql_loading')}</div>}
              />
            </div>

            {/* Результаты */}
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {runErr && (
                <div className="mb-3 rounded border border-red-900 bg-red-950/40 px-3 py-2">
                  <div className="text-red-400 font-bold text-xs flex items-center gap-1">✖ {t('sql_err')}</div>
                  <div className="text-red-300 text-[11px] font-mono mt-1 break-all">{runErr}</div>
                </div>
              )}
              {!runErr && results.length===0 && rowsChanged!==null && (
                <div className="rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-300 text-xs flex items-center gap-1">
                  <CircleCheck size={12}/> {t('sql_done_ok')} {rowsChanged}
                </div>
              )}
              {results.length===0 && rowsChanged===null && !runErr && (
                <div className="text-slate-600 text-xs font-mono">{t('sql_empty')}</div>
              )}
              {results.map((r,i)=>(
                <div key={i} className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] text-slate-500 font-mono">#{i+1} · {r.values.length} {t('sql_rows')} · {r.columns.length} cols</span>
                    <button onClick={()=>downloadCsv(`result-${i+1}.csv`, r)} className="ml-auto flex items-center gap-1 min-h-[30px] px-2.5 rounded bg-[#2d2d2d] hover:bg-[#3c3c3c] text-slate-300 hover:text-white text-[10px]">
                      <Download size={10}/> {t('sql_csv')}
                    </button>
                  </div>
                  <div className="overflow-auto rounded border border-[#2d2d2d] max-h-72">
                    <table className="w-full text-left border-collapse font-mono text-[11px]">
                      <thead className="sticky top-0">
                        <tr className="bg-[#252526]">
                          {r.columns.map((c,ci)=>(<th key={ci} className="px-2 py-1 border-b border-[#3c3c3c] text-amber-300 whitespace-nowrap font-bold">{c}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.values.slice(0, MAX_ROWS_SHOWN).map((row,ri)=>(
                          <tr key={ri} className={ri%2 ? 'bg-white/[0.03]' : ''}>
                            {row.map((cell,ci)=>(
                              <td key={ci} className={`px-2 py-1 border-t border-[#2a2a2a] whitespace-nowrap ${cell==null?'text-slate-600 italic':'text-emerald-200'}`}>
                                {cellText(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {r.values.length>MAX_ROWS_SHOWN && (
                    <div className="text-slate-600 text-[10px] mt-1">+{r.values.length-MAX_ROWS_SHOWN} {t('sql_more')} · CSV — все</div>
                  )}
                </div>
              ))}
            </div>

            {/* Статус-бар */}
            <div className="h-6 bg-[#181818] border-t border-[#2d2d2d] flex items-center gap-3 px-2 text-[10px] text-slate-500 font-mono shrink-0">
              <span>SQLite WASM</span>
              {ms!==null && <span>{ms} ms</span>}
              {tables.length>0 && <span>{tables.length} {t('sql_tables').toLowerCase()}</span>}
              <span className="ml-auto">{t('sql_hint')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
