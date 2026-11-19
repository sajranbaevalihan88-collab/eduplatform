import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { sfx } from '../utils/sfx'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { Bot, Users, RotateCcw, Trophy, Undo2, Sparkles, Bomb, Brain, CheckCircle2, XCircle } from 'lucide-react'

type Player = 1 | 2
type Cell = 0 | 1 | 2
type OpponentMode = 'ai' | 'pvp'
type AiLevel = 'easy' | 'medium' | 'hard'
type BoardSizeKey = '7x6' | '8x7'
type QuizTopicKey = 'python' | 'math' | 'kg' | 'custom'

type QuizQ = {
  text: string
  options: { text: string; is_correct: boolean }[]
}

const BUILTIN_QUIZ: Record<'python' | 'math' | 'kg', QuizQ[]> = {
  python: [
    { text: 'Что выведет print(3 * 4 + 2) в Python?', options: [{ text: '14', is_correct: true }, { text: '18', is_correct: false }, { text: '12', is_correct: false }, { text: '9', is_correct: false }] },
    { text: 'Какой метод добавляет элемент в конец списка list?', options: [{ text: 'append()', is_correct: true }, { text: 'push()', is_correct: false }, { text: 'add()', is_correct: false }, { text: 'put()', is_correct: false }] },
    { text: 'Какой оператор в Python возводит число в степень?', options: [{ text: '**', is_correct: true }, { text: '^', is_correct: false }, { text: '//', is_correct: false }, { text: '%%', is_correct: false }] },
    { text: 'Чему равно len("Бишкек")?', options: [{ text: '6', is_correct: true }, { text: '5', is_correct: false }, { text: '7', is_correct: false }, { text: '0', is_correct: false }] },
    { text: 'Как начинается объявление функции в Python?', options: [{ text: 'def', is_correct: true }, { text: 'func', is_correct: false }, { text: 'function', is_correct: false }, { text: 'fn', is_correct: false }] },
    { text: 'Чему равен остаток 17 % 5 в Python?', options: [{ text: '2', is_correct: true }, { text: '3', is_correct: false }, { text: '5', is_correct: false }, { text: '1', is_correct: false }] },
  ],
  math: [
    { text: 'Чему равен корень уравнения 2x + 8 = 20?', options: [{ text: '6', is_correct: true }, { text: '14', is_correct: false }, { text: '4', is_correct: false }, { text: '8', is_correct: false }] },
    { text: 'Чему равна площадь квадрата со стороной 9 см?', options: [{ text: '81 см²', is_correct: true }, { text: '36 см²', is_correct: false }, { text: '18 см²', is_correct: false }, { text: '72 см²', is_correct: false }] },
    { text: 'Чему равен квадратный корень √169?', options: [{ text: '13', is_correct: true }, { text: '14', is_correct: false }, { text: '12', is_correct: false }, { text: '16', is_correct: false }] },
    { text: 'Сумма углов любого треугольника равна:', options: [{ text: '180°', is_correct: true }, { text: '360°', is_correct: false }, { text: '90°', is_correct: false }, { text: '270°', is_correct: false }] },
    { text: 'Чему равно 15% от числа 200?', options: [{ text: '30', is_correct: true }, { text: '15', is_correct: false }, { text: '45', is_correct: false }, { text: '25', is_correct: false }] },
  ],
  kg: [
    { text: 'Столица Кыргызской Республики?', options: [{ text: 'Бишкек', is_correct: true }, { text: 'Ош', is_correct: false }, { text: 'Каракол', is_correct: false }, { text: 'Нарын', is_correct: false }] },
    { text: 'Сколько областей в Кыргызстане?', options: [{ text: '7 областей', is_correct: true }, { text: '5 областей', is_correct: false }, { text: '9 областей', is_correct: false }, { text: '6 областей', is_correct: false }] },
    { text: 'Самая высокая вершина Кыргызстана (7439 м):', options: [{ text: 'Пик Победы', is_correct: true }, { text: 'Пик Ленина', is_correct: false }, { text: 'Хан-Тенгри', is_correct: false }, { text: 'Пик Манаса', is_correct: false }] },
    { text: 'Национальный трёхструнный инструмент кыргызов:', options: [{ text: 'Комуз', is_correct: true }, { text: 'Кыл-кыяк', is_correct: false }, { text: 'Чоор', is_correct: false }, { text: 'Доол', is_correct: false }] },
  ],
}

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () => Array<Cell>(cols).fill(0))
}

function cloneBoard(b: Cell[][]): Cell[][] {
  return b.map(r => [...r])
}

function findLowestEmptyRow(b: Cell[][], col: number): number {
  for (let r = b.length - 1; r >= 0; r--) {
    if (b[r][col] === 0) return r
  }
  return -1
}

function checkWinner(b: Cell[][]): { winner: Player; cells: [number, number][] } | null {
  const rows = b.length
  const cols = b[0].length
  const dirs: [number, number][] = [
    [0, 1],  // горизонталь
    [1, 0],  // вертикаль
    [1, 1],  // диагональ ↘
    [1, -1], // диагональ ↙
  ]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = b[r][c]
      if (p === 0) continue
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]]
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step
          const nc = c + dc * step
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || b[nr][nc] !== p) break
          line.push([nr, nc])
        }
        if (line.length === 4) {
          return { winner: p as Player, cells: line }
        }
      }
    }
  }
  return null
}

function isBoardFull(b: Cell[][]): boolean {
  return b[0].every(cell => cell !== 0)
}

// Оценка окна из 4 клеток для Minimax ИИ
function scoreWindow(w: Cell[], aiPlayer: Player): number {
  const opp: Player = aiPlayer === 1 ? 2 : 1
  const aiCnt = w.filter(c => c === aiPlayer).length
  const oppCnt = w.filter(c => c === opp).length
  const emptyCnt = w.filter(c => c === 0).length

  if (aiCnt === 4) return 10000
  if (oppCnt === 4) return -10000
  if (aiCnt === 3 && emptyCnt === 1) return 45
  if (aiCnt === 2 && emptyCnt === 2) return 10
  if (oppCnt === 3 && emptyCnt === 1) return -80
  if (oppCnt === 2 && emptyCnt === 2) return -12
  return 0
}

function evaluateBoard(b: Cell[][], aiPlayer: Player): number {
  const rows = b.length
  const cols = b[0].length
  let score = 0

  // Бонус за контроль центральной колонки
  const centerCol = Math.floor(cols / 2)
  for (let r = 0; r < rows; r++) {
    if (b[r][centerCol] === aiPlayer) score += 12
  }

  // Горизонтальные окна
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += scoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], aiPlayer)
    }
  }
  // Вертикальные окна
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - 4; r++) {
      score += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], aiPlayer)
    }
  }
  // Диагонали ↘ и ↙
  for (let r = 0; r <= rows - 4; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += scoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], aiPlayer)
      score += scoreWindow([b[r + 3][c], b[r + 2][c + 1], b[r + 1][c + 2], b[r][c + 3]], aiPlayer)
    }
  }
  return score
}

function getValidCols(b: Cell[][]): number[] {
  const cols = b[0].length
  const center = Math.floor(cols / 2)
  const valid: number[] = []
  for (let c = 0; c < cols; c++) {
    if (b[0][c] === 0) valid.push(c)
  }
  // Сортируем от центра к краям для лучшего отсечения alpha-beta
  return valid.sort((a, b2) => Math.abs(a - center) - Math.abs(b2 - center))
}

function minimax(
  b: Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: Player
): { col: number; score: number } {
  const validCols = getValidCols(b)
  const win = checkWinner(b)
  if (win) {
    return { col: -1, score: win.winner === aiPlayer ? 100000 + depth * 100 : -100000 - depth * 100 }
  }
  if (depth === 0 || validCols.length === 0) {
    return { col: -1, score: evaluateBoard(b, aiPlayer) }
  }

  const opp: Player = aiPlayer === 1 ? 2 : 1
  if (maximizing) {
    let bestScore = -Infinity
    let bestCol = validCols[0]
    for (const col of validCols) {
      const row = findLowestEmptyRow(b, col)
      const nextB = cloneBoard(b)
      nextB[row][col] = aiPlayer
      const res = minimax(nextB, depth - 1, alpha, beta, false, aiPlayer)
      if (res.score > bestScore) {
        bestScore = res.score
        bestCol = col
      }
      alpha = Math.max(alpha, bestScore)
      if (alpha >= beta) break
    }
    return { col: bestCol, score: bestScore }
  } else {
    let bestScore = Infinity
    let bestCol = validCols[0]
    for (const col of validCols) {
      const row = findLowestEmptyRow(b, col)
      const nextB = cloneBoard(b)
      nextB[row][col] = opp
      const res = minimax(nextB, depth - 1, alpha, beta, true, aiPlayer)
      if (res.score < bestScore) {
        bestScore = res.score
        bestCol = col
      }
      beta = Math.min(beta, bestScore)
      if (alpha >= beta) break
    }
    return { col: bestCol, score: bestScore }
  }
}

export default function ConnectFour() {
  const { t } = useLang()
  const [sizeKey, setSizeKey] = useState<BoardSizeKey>('7x6')
  const rows = sizeKey === '8x7' ? 7 : 6
  const cols = sizeKey === '8x7' ? 8 : 7

  const [oppMode, setOppMode] = useState<OpponentMode>('ai')
  const [aiLevel, setAiLevel] = useState<AiLevel>('medium')
  const [board, setBoard] = useState<Cell[][]>(() => createEmptyBoard(6, 7))
  const [history, setHistory] = useState<Cell[][][]>([])
  const [turn, setTurn] = useState<Player>(1)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const [lastDrop, setLastDrop] = useState<[number, number] | null>(null)
  const [winInfo, setWinInfo] = useState<{ winner: Player; cells: [number, number][] } | null>(null)
  const [isDraw, setIsDraw] = useState(false)

  // Имена игроков и счёт серии
  const [name1, setName1] = useState('Игрок 1 (Красные)')
  const [name2, setName2] = useState('ИИ-Стратег (Жёлтые)')
  const [wins1, setWins1] = useState(0)
  const [wins2, setWins2] = useState(0)
  const [bestWins, setBestWins] = useState<number>(() => Number(localStorage.getItem('edu-c4-best') || 0))

  // Тактическая Бомба-фишка (по 1 на матч у каждого игрока)
  const [bombMode, setBombMode] = useState(false)
  const [bombsLeft, setBombsLeft] = useState<{ 1: number; 2: number }>({ 1: 1, 2: 1 })

  // Учебный режим «4 в ряд + Блиц-вопрос» с конструктором учителя и ИИ
  const [quizGate, setQuizGate] = useState(false)
  const [quizTopic, setQuizTopic] = useState<QuizTopicKey>('python')
  const [customQs, setCustomQs] = useState<QuizQ[]>([])
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(10)
  const [aiBusy, setAiBusy] = useState(false)
  const [pendingMove, setPendingMove] = useState<{ col: number; q: QuizQ } | null>(null)

  const resetBoard = useCallback((rCount = rows, cCount = cols) => {
    setBoard(createEmptyBoard(rCount, cCount))
    setHistory([])
    setTurn(1)
    setLastDrop(null)
    setWinInfo(null)
    setIsDraw(false)
    setBombMode(false)
    setBombsLeft({ 1: 1, 2: 1 })
    setPendingMove(null)
    sfx('ui.click')
  }, [rows, cols])

  const changeSize = (nextKey: BoardSizeKey) => {
    setSizeKey(nextKey)
    const r = nextKey === '8x7' ? 7 : 6
    const c = nextKey === '8x7' ? 8 : 7
    resetBoard(r, c)
  }

  const parsePromptCount = (promptStr: string, fallback: number): number => {
    const s = promptStr.toLowerCase()
    const m = s.match(/\b(\d{1,2})\s*(?:вопрос\S*|вопр\.?|суроо\S*|question\S*|задани\S*|шт\.?|штук\S*)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 40) return n
    }
    const cleaned = s.replace(/\b\d{1,2}\s*[-–]?\s*(?:класс\S*|кл\.?|grade\S*)/gi, '').replace(/python\s*3/gi, '')
    const nums = (cleaned.match(/\b(\d{1,2})\b/g) || []).map(Number).filter(n => n >= 1 && n <= 40)
    if (nums.length > 0) return nums[nums.length - 1]
    return Math.max(1, Math.min(40, fallback || 10))
  }

  const generateQuizAI = async () => {
    if (!aiPrompt.trim()) {
      toast('Напиши тему, напр.: «сделай мне вопросы по пайтону 14 вопросов»', 'error')
      return
    }
    const targetCount = parsePromptCount(aiPrompt, aiCount)
    setAiCount(targetCount)
    setAiBusy(true)
    try {
      const r = await client.post('/tests/generate/', {
        count: targetCount,
        prompt: aiPrompt.trim(),
        text: '',
      })
      const qs: QuizQ[] = (r.data?.questions || []).map((q: any) => ({
        text: q.text || '',
        options: (q.options || []).slice(0, 4).map((o: any) => ({ text: o.text || '', is_correct: !!o.is_correct })),
      })).filter((q: QuizQ) => q.text && q.options.length >= 2)
      if (!qs.length) throw new Error('empty')
      setCustomQs(qs)
      setQuizTopic('custom')
      sfx('ui.success')
      toast(`✨ Сгенерировано ровно ${qs.length} вопросов для блиц-ходов!`, 'success')
    } catch {
      toast('Не удалось сгенерировать вопросы с сервера', 'error')
    }
    setAiBusy(false)
  }

  // Выполнение хода в выбранную колонку
  const executeDrop = useCallback((col: number, currentBoard: Cell[][], activePlayer: Player, useBomb = false) => {
    const targetRow = findLowestEmptyRow(currentBoard, col)
    if (targetRow === -1) return

    const nextB = cloneBoard(currentBoard)
    let landedRow = targetRow

    if (useBomb && bombsLeft[activePlayer] > 0 && targetRow < currentBoard.length - 1) {
      // Бомба-фишка уничтожает фишку прямо под собой и встаёт на её место!
      landedRow = targetRow + 1
      nextB[landedRow][col] = activePlayer
      setBombsLeft(prev => ({ ...prev, [activePlayer]: prev[activePlayer] - 1 }))
      setBombMode(false)
      sfx('mb.crit')
    } else {
      nextB[targetRow][col] = activePlayer
      sfx('fb.plant')
    }

    setHistory(h => [...h, currentBoard])
    setBoard(nextB)
    setLastDrop([landedRow, col])

    const win = checkWinner(nextB)
    if (win) {
      setWinInfo(win)
      if (win.winner === 1) {
        const nw = wins1 + 1
        setWins1(nw)
        if (nw > bestWins) {
          setBestWins(nw)
          try { localStorage.setItem('edu-c4-best', String(nw)) } catch {}
        }
        sfx('lq.podium')
      } else {
        setWins2(w => w + 1)
        sfx(oppMode === 'ai' ? 'hm.lose' : 'lq.podium')
      }
      return
    }

    if (isBoardFull(nextB)) {
      setIsDraw(true)
      sfx('cm.wrong')
      return
    }

    setTurn(activePlayer === 1 ? 2 : 1)
  }, [bombsLeft, wins1, bestWins, oppMode])

  // Запрос хода игрока (с проверкой учебного блиц-вопроса, если включён)
  const handleColumnClick = (col: number) => {
    if (winInfo || isDraw || pendingMove) return
    if (oppMode === 'ai' && turn === 2) return
    if (findLowestEmptyRow(board, col) === -1) return

    if (quizGate) {
      const pool = quizTopic === 'custom' && customQs.length > 0
        ? customQs
        : BUILTIN_QUIZ[quizTopic === 'custom' ? 'python' : quizTopic]
      const randomQ = pool[Math.floor(Math.random() * pool.length)]
      setPendingMove({ col, q: randomQ })
      sfx('ui.click')
      return
    }

    executeDrop(col, board, turn, bombMode)
  }

  const answerQuizGate = (opt: { text: string; is_correct: boolean }) => {
    if (!pendingMove) return
    const { col } = pendingMove
    setPendingMove(null)
    if (opt.is_correct) {
      toast('✓ Верно! Фишка падает в колонку!', 'success')
      executeDrop(col, board, turn, bombMode)
    } else {
      sfx('cm.wrong')
      toast('✕ Неверно! Ход переходит сопернику', 'error')
      setBombMode(false)
      setTurn(turn === 1 ? 2 : 1)
    }
  }

  // Автоматический ход ИИ
  useEffect(() => {
    if (oppMode !== 'ai' || turn !== 2 || winInfo || isDraw || pendingMove) return
    const valid = getValidCols(board)
    if (!valid.length) return

    const timer = window.setTimeout(() => {
      let chosenCol = valid[0]
      if (aiLevel === 'easy') {
        // Новичок: 45% лучший ход глубины 2, иначе случайный
        if (Math.random() < 0.45) {
          const res = minimax(board, 2, -Infinity, Infinity, true, 2)
          chosenCol = res.col >= 0 ? res.col : valid[0]
        } else {
          chosenCol = valid[Math.floor(Math.random() * valid.length)]
        }
      } else if (aiLevel === 'medium') {
        const res = minimax(board, 4, -Infinity, Infinity, true, 2)
        chosenCol = res.col >= 0 ? res.col : valid[0]
      } else {
        const res = minimax(board, 5, -Infinity, Infinity, true, 2)
        chosenCol = res.col >= 0 ? res.col : valid[0]
      }
      executeDrop(chosenCol, board, 2, false)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [oppMode, turn, winInfo, isDraw, pendingMove, board, aiLevel, executeDrop])

  // Отмена хода
  const undoMove = () => {
    if (!history.length || pendingMove) return
    if (oppMode === 'ai' && history.length >= 2) {
      const prevBoard = history[history.length - 2]
      setBoard(prevBoard)
      setHistory(h => h.slice(0, -2))
      setTurn(1)
    } else {
      const prevBoard = history[history.length - 1]
      setBoard(prevBoard)
      setHistory(h => h.slice(0, -1))
      setTurn(turn === 1 ? 2 : 1)
    }
    setWinInfo(null)
    setIsDraw(false)
    setLastDrop(null)
    sfx('ui.click')
  }

  // Горячие клавиши 1..8 для броска фишки в колонку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= cols) {
        handleColumnClick(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn, winInfo, isDraw, pendingMove, cols, quizGate, bombMode])

  const isWinCell = (r: number, c: number) =>
    winInfo?.cells.some(([wr, wc]) => wr === r && wc === c) || false

  return (
    <div className="max-w-5xl mx-auto space-y-5" data-testid="connect-four-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
          ← {t('games')}
        </Link>
        {bestWins > 0 && (
          <div className="px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-extrabold flex items-center gap-1.5">
            <Trophy size={14} /> Побед в серии: {bestWins}
          </div>
        )}
      </div>

      {/* Верхняя панель настроек игры */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-700 p-4 sm:p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl dark:text-white flex items-center gap-2">
              <span>🔴🟡 4 в ряд (Connect Four)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Собери 4 фишки своего цвета по горизонтали, вертикали или диагонали раньше соперника!
            </p>
          </div>

          {/* Переключатель режима: Против ИИ / 2 Игрока */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setOppMode('ai'); setName2('ИИ-Стратег (Жёлтые)'); resetBoard() }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border transition ${
                oppMode === 'ai' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 dark:bg-slate-800 dark:text-white dark:border-slate-700'
              }`}
            >
              <Bot size={16} /> Против ИИ
            </button>
            <button
              type="button"
              onClick={() => { setOppMode('pvp'); setName2('Игрок 2 (Жёлтые)'); resetBoard() }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border transition ${
                oppMode === 'pvp' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 dark:bg-slate-800 dark:text-white dark:border-slate-700'
              }`}
            >
              <Users size={16} /> 2 игрока на экране
            </button>
          </div>
        </div>

        {/* Сложность ИИ + Размер поля + Учебный блиц-режим */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t dark:border-slate-800 text-xs">
          {oppMode === 'ai' && (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">Интеллект ИИ:</span>
              {([
                ['easy', '🟢 Новичок'],
                ['medium', '🔵 Тактик'],
                ['hard', '🟣 Гроссмейстер'],
              ] as Array<[AiLevel, string]>).map(([lvl, label]) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => { setAiLevel(lvl); resetBoard() }}
                  className={`px-3 py-1.5 rounded-xl font-bold ${
                    aiLevel === lvl ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500">Поле:</span>
            {(['7x6', '8x7'] as BoardSizeKey[]).map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => changeSize(sz)}
                className={`px-3 py-1.5 rounded-xl font-bold ${
                  sizeKey === sz ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {sz === '7x6' ? '7×6 Классика' : '8×7 Большая арена'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setQuizGate(v => !v); sfx('ui.click') }}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition ${
              quizGate
                ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            <Brain size={15} /> {quizGate ? '✓ Учебный блиц-вопрос перед ходом: ВКЛ' : '🧠 Включить блиц-вопрос перед ходом'}
          </button>
        </div>

        {/* Если включён учебный блиц-режим — выбор темы и ИИ-генератор учителя */}
        {quizGate && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-slate-800/80 border border-indigo-200 dark:border-slate-700 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold dark:text-white">Тема вопросов перед броском фишки:</span>
              {([
                ['python', '🐍 Python и IT'],
                ['math', '📐 Математика'],
                ['kg', '🏔️ Кыргызстан'],
                ['custom', `✨ Свои вопросы ИИ (${customQs.length})`],
              ] as Array<[QuizTopicKey, string]>).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setQuizTopic(k)}
                  className={`px-3 py-1 rounded-lg font-bold ${
                    quizTopic === k ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={aiPrompt}
                onChange={e => {
                  setAiPrompt(e.target.value)
                  if (/\d/.test(e.target.value)) setAiCount(parsePromptCount(e.target.value, aiCount))
                }}
                onKeyDown={e => e.key === 'Enter' && generateQuizAI()}
                placeholder="Сгенерировать вопросы с ИИ, напр.: «сделай мне вопросы по пайтону 14 вопросов»"
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-xl border dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white text-xs"
              />
              <input
                type="number"
                min={1}
                max={40}
                value={aiCount}
                onChange={e => setAiCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 10)))}
                className="w-14 px-2 py-1.5 rounded-xl border dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white text-xs text-center font-bold"
              />
              <button
                type="button"
                onClick={generateQuizAI}
                disabled={aiBusy}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles size={13} /> {aiBusy ? 'Генерируем…' : `Сгенерировать (${aiCount})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Счёт игроков + панель хода + кнопка Бомба-фишки */}
      <div className="grid sm:grid-cols-3 gap-3 items-center">
        <div className={`p-3.5 rounded-2xl border-2 flex items-center justify-between transition ${
          turn === 1 && !winInfo ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-md' : 'bg-white dark:bg-slate-900 dark:border-slate-700'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-red-600 shadow-inner border-2 border-rose-200 inline-block shrink-0" />
            <input
              value={name1}
              onChange={e => setName1(e.target.value)}
              className="bg-transparent font-extrabold text-sm dark:text-white outline-none w-36 truncate"
            />
          </div>
          <span className="font-mono font-black text-xl text-rose-600 dark:text-rose-400">{wins1}</span>
        </div>

        {/* Центральный статус + спец-кнопки */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={bombsLeft[turn] <= 0 || !!winInfo || isDraw || (oppMode === 'ai' && turn === 2)}
            onClick={() => { setBombMode(v => !v); sfx('ui.click') }}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition disabled:opacity-40 ${
              bombMode
                ? 'bg-amber-400 text-slate-950 border-amber-500 animate-pulse shadow-lg'
                : 'bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700'
            }`}
            title="Взрывная фишка уничтожает фишку соперника прямо под собой!"
          >
            <Bomb size={15} /> 💣 Бомба ({bombsLeft[turn]})
          </button>

          <button
            type="button"
            onClick={undoMove}
            disabled={history.length === 0}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs font-bold dark:text-white flex items-center gap-1 disabled:opacity-40"
          >
            <Undo2 size={14} /> Ход назад
          </button>

          <button
            type="button"
            onClick={() => resetBoard()}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow"
          >
            <RotateCcw size={14} /> Новая партия
          </button>
        </div>

        <div className={`p-3.5 rounded-2xl border-2 flex items-center justify-between transition ${
          turn === 2 && !winInfo ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 shadow-md' : 'bg-white dark:bg-slate-900 dark:border-slate-700'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-inner border-2 border-amber-100 inline-block shrink-0" />
            <input
              value={name2}
              onChange={e => setName2(e.target.value)}
              className="bg-transparent font-extrabold text-sm dark:text-white outline-none w-36 truncate"
            />
          </div>
          <span className="font-mono font-black text-xl text-amber-500">{wins2}</span>
        </div>
      </div>

      {/* Баннер победы или ничьей */}
      {(winInfo || isDraw) && (
        <div className={`p-4 rounded-2xl border-2 text-center flex flex-wrap items-center justify-center gap-4 shadow-lg ${
          isDraw
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:text-white'
            : winInfo?.winner === 1
              ? 'bg-rose-600 text-white border-rose-300'
              : 'bg-amber-400 text-slate-950 border-amber-200'
        }`}>
          <span className="font-display font-black text-xl">
            {isDraw ? '🤝 Ничья! Все колонки заполнены!' : `🏆 Победил: ${winInfo?.winner === 1 ? name1 : name2}!`}
          </span>
          <button
            type="button"
            onClick={() => resetBoard()}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center gap-1.5"
          >
            <RotateCcw size={15} /> Играть ещё раз
          </button>
        </div>
      )}

      {/* ИГРОВАЯ СТОЙКА «4 В РЯД» */}
      <div className="max-w-xl mx-auto">
        {/* Верхняя полоса предпросмотра падающей фишки по колонкам */}
        <div
          className="grid gap-2 px-3 sm:px-4 mb-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }, (_, c) => {
            const canDrop = board[0]?.[c] === 0 && !winInfo && !isDraw
            const isHovered = hoverCol === c && canDrop
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleColumnClick(c)}
                onMouseEnter={() => setHoverCol(c)}
                disabled={!canDrop}
                data-testid={`c4-col-${c}`}
                className="h-10 rounded-xl flex flex-col items-center justify-center group transition"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isHovered
                      ? turn === 1
                        ? 'bg-gradient-to-br from-rose-400 to-red-600 text-white scale-110 shadow-lg'
                        : 'bg-gradient-to-br from-amber-300 to-yellow-500 text-slate-950 scale-110 shadow-lg'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 group-hover:scale-105'
                  }`}
                >
                  {bombMode && isHovered ? '💣' : `↓${c + 1}`}
                </div>
              </button>
            )
          })}
        </div>

        {/* Синяя классическая стойка Connect Four */}
        <div className="rounded-3xl bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-900 p-3 sm:p-4 shadow-2xl border-4 border-blue-500/80">
          <div
            className="grid gap-2 sm:gap-2.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isWin = isWinCell(r, c)
                const isLast = lastDrop && lastDrop[0] === r && lastDrop[1] === c
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleColumnClick(c)}
                    onMouseEnter={() => setHoverCol(c)}
                    data-testid={`c4-cell-${r}-${c}`}
                    className="aspect-square rounded-full bg-slate-900/85 p-1 sm:p-1.5 shadow-inner flex items-center justify-center relative overflow-hidden focus:outline-none"
                  >
                    {cell !== 0 && (
                      <div
                        className={`w-full h-full rounded-full transition-all duration-300 ${
                          cell === 1
                            ? 'bg-gradient-to-br from-rose-400 via-red-500 to-rose-700 border-2 border-rose-300 shadow-[inset_0_3px_6px_rgba(255,255,255,0.45)]'
                            : 'bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 border-2 border-yellow-100 shadow-[inset_0_3px_6px_rgba(255,255,255,0.55)]'
                        } ${isWin ? 'ring-4 ring-white scale-105 animate-pulse' : ''} ${
                          isLast ? 'animate-bounce' : ''
                        }`}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
        <div className="h-3 mx-6 rounded-b-2xl bg-indigo-950 shadow-lg" />
      </div>

      {/* Модальное окно блиц-вопроса перед броском фишки */}
      {pendingMove && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" data-testid="c4-quiz-modal">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-400 p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold">
                🧠 Блиц-ход в колонку #{pendingMove.col + 1} ({turn === 1 ? name1 : name2})
              </span>
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="font-display font-bold text-lg dark:text-white">
              {pendingMove.q.text}
            </div>
            <div className="grid gap-2">
              {pendingMove.q.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => answerQuizGate(opt)}
                  className="w-full text-left px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-800 dark:text-white font-bold text-sm transition flex items-center gap-2.5"
                >
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Верно = бросок фишки</span>
              <span className="flex items-center gap-1"><XCircle size={13} className="text-rose-500" /> Ошибка = потеря хода</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
