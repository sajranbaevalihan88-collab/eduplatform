import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sfx } from '../utils/sfx'
import { useLang } from '../context/LangContext'
import { Bot, Users, RotateCcw, Undo2, Trophy, Compass, Shield, Move, HelpCircle, Sparkles } from 'lucide-react'

type Player = 1 | 2 // 1 = Pink Hexagon (starts bottom, aims row 0), 2 = Cyan Diamond (starts top, aims row N-1)
type Dir = 'h' | 'v'
type Wall = { r: number; c: number; dir: Dir; owner: Player }
type Pos = { r: number; c: number }
type Mode = 'ai' | 'pvp'
type AiLevel = 'easy' | 'medium' | 'hard'
type Tool = 'move' | 'wall-h' | 'wall-v'

type GameSnapshot = {
  p1: Pos
  p2: Pos
  walls: Wall[]
  wLeft1: number
  wLeft2: number
  turn: Player
}

// Проверяет, перекрыт ли шаг между двумя соседними клетками (r1, c1) и (r2, c2)
function isBlockedByWalls(r1: number, c1: number, r2: number, c2: number, walls: Wall[]): boolean {
  const dr = r2 - r1
  const dc = c2 - c1
  if (Math.abs(dr) + Math.abs(dc) !== 1) return true

  if (dr === 1) {
    // Шаг ВНИЗ: пересекает горизонтальную границу между r1 и r1+1 в колонке c1
    return walls.some(w => w.dir === 'h' && w.r === r1 && (w.c === c1 || w.c === c1 - 1))
  }
  if (dr === -1) {
    // Шаг ВВЕРХ: пересекает горизонтальную границу между r2 и r2+1 в колонке c1
    return walls.some(w => w.dir === 'h' && w.r === r2 && (w.c === c1 || w.c === c1 - 1))
  }
  if (dc === 1) {
    // Шаг ВПРАВО: пересекает вертикальную границу между c1 и c1+1 в строке r1
    return walls.some(w => w.dir === 'v' && w.c === c1 && (w.r === r1 || w.r === r1 - 1))
  }
  // Шаг ВЛЕВО: пересекает вертикальную границу между c2 и c2+1 в строке r1
  return walls.some(w => w.dir === 'v' && w.c === c2 && (w.r === r1 || w.r === r1 - 1))
}

// BFS: находит кратчайший путь и расстояние от start до targetRow
function bfsShortestPath(start: Pos, targetRow: number, walls: Wall[], N: number): { dist: number; path: Pos[] } {
  if (start.r === targetRow) return { dist: 0, path: [start] }
  const visited = Array.from({ length: N }, () => Array<boolean>(N).fill(false))
  const parent = Array.from({ length: N }, () => Array<Pos | null>(N).fill(null))
  const queue: { r: number; c: number; d: number }[] = [{ r: start.r, c: start.c, d: 0 }]
  visited[start.r][start.c] = true

  // Порядок направлений: сначала в сторону цели (чтобы пути выглядели естественно)
  const drGoal = targetRow === 0 ? -1 : 1
  const dirs: [number, number][] = [
    [drGoal, 0],
    [0, -1],
    [0, 1],
    [-drGoal, 0],
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr
      const nc = cur.c + dc
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue
      if (visited[nr][nc]) continue
      if (isBlockedByWalls(cur.r, cur.c, nr, nc, walls)) continue
      visited[nr][nc] = true
      parent[nr][nc] = { r: cur.r, c: cur.c }
      if (nr === targetRow) {
        // Восстанавливаем путь
        const path: Pos[] = []
        let node: Pos | null = { r: nr, c: nc }
        while (node) {
          path.push(node)
          node = parent[node.r][node.c]
        }
        path.reverse()
        return { dist: cur.d + 1, path }
      }
      queue.push({ r: nr, c: nc, d: cur.d + 1 })
    }
  }
  return { dist: Infinity, path: [] }
}

// Допустимые ходы фишки (включая прямой и диагональный прыжок через соперника по правилам Quoridor / Blocade)
function getValidMoves(me: Pos, opp: Pos, walls: Wall[], N: number): Pos[] {
  const moves: Pos[] = []
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

  for (const [dr, dc] of dirs) {
    const nr = me.r + dr
    const nc = me.c + dc
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue
    if (isBlockedByWalls(me.r, me.c, nr, nc, walls)) continue

    if (nr === opp.r && nc === opp.c) {
      // Соперник стоит прямо на пути — пробуем прямой прыжок через него!
      const jr = opp.r + dr
      const jc = opp.c + dc
      if (jr >= 0 && jr < N && jc >= 0 && jc < N && !isBlockedByWalls(opp.r, opp.c, jr, jc, walls)) {
        moves.push({ r: jr, c: jc })
      } else {
        // Если за соперником стена или край поля — разрешён диагональный обход влево/вправо от соперника
        const perp: [number, number][] = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]
        for (const [pr, pc] of perp) {
          const dr2 = opp.r + pr
          const dc2 = opp.c + pc
          if (dr2 >= 0 && dr2 < N && dc2 >= 0 && dc2 < N && !isBlockedByWalls(opp.r, opp.c, dr2, dc2, walls)) {
            moves.push({ r: dr2, c: dc2 })
          }
        }
      }
    } else {
      moves.push({ r: nr, c: nc })
    }
  }
  return moves
}

// Проверка, можно ли поставить стену (пересечение + перекрытие + BFS-проходимость для обоих игроков)
function validateWallPlacement(
  r: number,
  c: number,
  dir: Dir,
  walls: Wall[],
  p1: Pos,
  p2: Pos,
  N: number
): { ok: boolean; reason?: string } {
  if (r < 0 || r >= N - 1 || c < 0 || c >= N - 1) return { ok: false, reason: 'Вне поля' }

  for (const w of walls) {
    // Та же самая позиция или пересечение крест-накрест в центре
    if (w.r === r && w.c === c) return { ok: false, reason: 'Место занято другой стеной' }
    if (dir === 'h' && w.dir === 'h' && w.r === r && Math.abs(w.c - c) === 1) {
      return { ok: false, reason: 'Стены накладываются друг на друга' }
    }
    if (dir === 'v' && w.dir === 'v' && w.c === c && Math.abs(w.r - r) === 1) {
      return { ok: false, reason: 'Стены накладываются друг на друга' }
    }
  }

  const nextWalls: Wall[] = [...walls, { r, c, dir, owner: 1 }]
  const d1 = bfsShortestPath(p1, 0, nextWalls, N).dist
  if (!Number.isFinite(d1)) return { ok: false, reason: 'Нельзя полностью замуровать Розового!' }
  const d2 = bfsShortestPath(p2, N - 1, nextWalls, N).dist
  if (!Number.isFinite(d2)) return { ok: false, reason: 'Нельзя полностью замуровать Голубого!' }

  return { ok: true }
}

// Выбор лучшего хода для ИИ (Player 2 — Cyan Diamond, цель: row N - 1)
function computeAiAction(
  p1: Pos,
  p2: Pos,
  walls: Wall[],
  wLeft2: number,
  N: number,
  level: AiLevel
): { type: 'move'; to: Pos } | { type: 'wall'; r: number; c: number; dir: Dir } {
  const validMoves = getValidMoves(p2, p1, walls, N)
  // 1. Если ИИ может победить за 1 ход — сразу побеждаем!
  const winMove = validMoves.find(m => m.r === N - 1)
  if (winMove) return { type: 'move', to: winMove }

  const d1Cur = bfsShortestPath(p1, 0, walls, N)
  const d2Cur = bfsShortestPath(p2, N - 1, walls, N)

  // Находим лучший ход фишкой ИИ (минимальный dist до row N-1)
  let bestMove = validMoves[0]
  let bestMoveDist = Infinity
  for (const m of validMoves) {
    const md = bfsShortestPath(m, N - 1, walls, N).dist
    if (md < bestMoveDist || (md === bestMoveDist && m.r > bestMove.r)) {
      bestMoveDist = md
      bestMove = m
    }
  }

  // Новичок: чаще просто идёт к цели, иногда ставит случайную блокирующую стену
  if (level === 'easy' && (wLeft2 <= 0 || Math.random() < 0.72)) {
    return { type: 'move', to: bestMove }
  }

  // Оценка стен-блокад (особенно когда соперник в 1–5 шагах или опережает ИИ!)
  const shouldConsiderWall =
    wLeft2 > 0 &&
    (d1Cur.dist <= d2Cur.dist + (level === 'hard' ? 1 : 0) || d1Cur.dist <= 3)

  if (shouldConsiderWall) {
    // Кандидаты стен: рядом с позицией соперника p1, вдоль его кратчайшего пути и рядом со стенами
    const candMap = new Map<string, { r: number; c: number; dir: Dir }>()
    const addAround = (pos: Pos) => {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const wr = pos.r + dr
          const wc = pos.c + dc
          if (wr >= 0 && wr < N - 1 && wc >= 0 && wc < N - 1) {
            candMap.set(`${wr},${wc},h`, { r: wr, c: wc, dir: 'h' })
            candMap.set(`${wr},${wc},v`, { r: wr, c: wc, dir: 'v' })
          }
        }
      }
    }
    addAround(p1)
    d1Cur.path.slice(0, level === 'hard' ? 6 : 4).forEach(addAround)

    let bestWall: { r: number; c: number; dir: Dir } | null = null
    // Базовая ценность простого шага вперёд
    const moveEval = d1Cur.dist - bestMoveDist
    let bestWallScore = moveEval + (level === 'hard' ? 0.15 : 0.45)

    for (const cand of candMap.values()) {
      const check = validateWallPlacement(cand.r, cand.c, cand.dir, walls, p1, p2, N)
      if (!check.ok) continue
      const nextW: Wall[] = [...walls, { ...cand, owner: 2 }]
      const nd1 = bfsShortestPath(p1, 0, nextW, N).dist
      const nd2 = bfsShortestPath(p2, N - 1, nextW, N).dist
      const deltaOpp = nd1 - d1Cur.dist
      const deltaSelf = nd2 - d2Cur.dist
      // Стена полезна только если реально удлиняет путь сопернику больше, чем себе!
      if (deltaOpp <= 0) continue
      // Бонус если соперник был "в одном шаге" и мы отбросили его далеко назад!
      const urgentBonus = d1Cur.dist <= 2 && deltaOpp >= 2 ? 2.5 : 0
      const evalScore = (nd1 - nd2) + deltaOpp * 0.35 - deltaSelf * 0.5 + urgentBonus
      if (evalScore > bestWallScore) {
        bestWallScore = evalScore
        bestWall = cand
      }
    }

    if (bestWall) {
      return { type: 'wall', ...bestWall }
    }
  }

  return { type: 'move', to: bestMove }
}

export default function Blocade() {
  const { t } = useLang()
  const [boardN, setBoardN] = useState<7 | 9>(9)
  const initialWalls = boardN === 9 ? 10 : 7

  const [mode, setMode] = useState<Mode>('ai')
  const [aiLevel, setAiLevel] = useState<AiLevel>('medium')
  const [tool, setTool] = useState<Tool>('move')
  const [showPathHint, setShowPathHint] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const [p1, setP1] = useState<Pos>({ r: 8, c: 4 })
  const [p2, setP2] = useState<Pos>({ r: 0, c: 4 })
  const [walls, setWalls] = useState<Wall[]>([])
  const [wLeft1, setWLeft1] = useState(10)
  const [wLeft2, setWLeft2] = useState(10)
  const [turn, setTurn] = useState<Player>(1)
  const [winner, setWinner] = useState<Player | null>(null)
  const [history, setHistory] = useState<GameSnapshot[]>([])
  const [hoverWall, setHoverWall] = useState<{ r: number; c: number; dir: Dir } | null>(null)
  const [errorTip, setErrorTip] = useState<string | null>(null)
  const [wins1, setWins1] = useState(0)
  const [wins2, setWins2] = useState(0)
  const [bestWins, setBestWins] = useState<number>(() => Number(localStorage.getItem('edu-blocade-best') || 0))
  const [dramaticBanner, setDramaticBanner] = useState<string | null>(null)

  const resetGame = useCallback((nextN: 7 | 9 = boardN) => {
    const mid = Math.floor(nextN / 2)
    const wCount = nextN === 9 ? 10 : 7
    setBoardN(nextN)
    setP1({ r: nextN - 1, c: mid })
    setP2({ r: 0, c: mid })
    setWalls([])
    setWLeft1(wCount)
    setWLeft2(wCount)
    setTurn(1)
    setWinner(null)
    setHistory([])
    setTool('move')
    setHoverWall(null)
    setErrorTip(null)
    setDramaticBanner(null)
    sfx('ui.click')
  }, [boardN])

  const p1Bfs = useMemo(() => bfsShortestPath(p1, 0, walls, boardN), [p1, walls, boardN])
  const p2Bfs = useMemo(() => bfsShortestPath(p2, boardN - 1, walls, boardN), [p2, walls, boardN])

  const activePos = turn === 1 ? p1 : p2
  const oppPos = turn === 1 ? p2 : p1
  const activeWallsLeft = turn === 1 ? wLeft1 : wLeft2

  const validMoves = useMemo(
    () => (winner ? [] : getValidMoves(activePos, oppPos, walls, boardN)),
    [activePos, oppPos, walls, boardN, winner]
  )

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-40), { p1, p2, walls, wLeft1, wLeft2, turn }])
  }, [p1, p2, walls, wLeft1, wLeft2, turn])

  const commitMove = useCallback((to: Pos, player: Player) => {
    pushHistory()
    if (player === 1) {
      setP1(to)
      if (to.r === 0) {
        setWinner(1)
        const nw = wins1 + 1
        setWins1(nw)
        if (nw > bestWins) {
          setBestWins(nw)
          try { localStorage.setItem('edu-blocade-best', String(nw)) } catch {}
        }
        sfx('lq.podium')
        return
      }
    } else {
      setP2(to)
      if (to.r === boardN - 1) {
        setWinner(2)
        setWins2(w => w + 1)
        sfx(mode === 'ai' ? 'hm.lose' : 'lq.podium')
        return
      }
    }
    sfx('fb.chip')
    setTurn(player === 1 ? 2 : 1)
    setErrorTip(null)
  }, [pushHistory, boardN, wins1, bestWins, mode])

  const commitWall = useCallback((r: number, c: number, dir: Dir, player: Player) => {
    const left = player === 1 ? wLeft1 : wLeft2
    if (left <= 0) {
      setErrorTip('Стены закончились! Ходи фишкой.')
      sfx('cm.wrong')
      return
    }
    const check = validateWallPlacement(r, c, dir, walls, p1, p2, boardN)
    if (!check.ok) {
      setErrorTip(check.reason || 'Сюда нельзя поставить стену')
      sfx('cm.wrong')
      return
    }

    // Проверка эффекта «В одном шаге!» (если стена откинула соперника назад)
    const oppPrevDist = player === 1 ? p2Bfs.dist : p1Bfs.dist
    const nextWalls: Wall[] = [...walls, { r, c, dir, owner: player }]
    const oppNewDist = player === 1
      ? bfsShortestPath(p2, boardN - 1, nextWalls, boardN).dist
      : bfsShortestPath(p1, 0, nextWalls, boardN).dist

    if (oppPrevDist <= 2 && oppNewDist >= oppPrevDist + 2) {
      setDramaticBanner('😱 В ОДНОМ ШАГЕ! Жёсткая блокада!')
      setTimeout(() => setDramaticBanner(null), 2200)
      sfx('mb.crit')
    } else {
      sfx('fb.plant')
    }

    pushHistory()
    setWalls(nextWalls)
    if (player === 1) setWLeft1(w => w - 1)
    else setWLeft2(w => w - 1)
    setTurn(player === 1 ? 2 : 1)
    setHoverWall(null)
    setErrorTip(null)
    if (mode === 'pvp') setTool('move')
  }, [wLeft1, wLeft2, walls, p1, p2, boardN, p1Bfs.dist, p2Bfs.dist, pushHistory, mode])

  // Ход ИИ (Player 2)
  useEffect(() => {
    if (mode !== 'ai' || turn !== 2 || winner) return
    const timer = window.setTimeout(() => {
      const action = computeAiAction(p1, p2, walls, wLeft2, boardN, aiLevel)
      if (action.type === 'move') {
        commitMove(action.to, 2)
      } else {
        commitWall(action.r, action.c, action.dir, 2)
      }
    }, 520)
    return () => window.clearTimeout(timer)
  }, [mode, turn, winner, p1, p2, walls, wLeft2, boardN, aiLevel, commitMove, commitWall])

  // Клавиатура: R / Space — поворот стены, стрелки / WASD — шаг фишкой
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (winner || (mode === 'ai' && turn === 2)) return
      const k = e.key.toLowerCase()
      if (k === 'r' || k === 'к') {
        setTool(cur => (cur === 'wall-h' ? 'wall-v' : 'wall-h'))
        sfx('ui.click')
        return
      }
      if (k === 'm' || k === 'ь') {
        setTool('move')
        sfx('ui.click')
        return
      }
      const dirMap: Record<string, [number, number]> = {
        arrowup: [-1, 0], w: [-1, 0], ц: [-1, 0],
        arrowdown: [1, 0], s: [1, 0], ы: [1, 0],
        arrowleft: [0, -1], a: [0, -1], ф: [0, -1],
        arrowright: [0, 1], d: [0, 1], в: [0, 1],
      }
      if (dirMap[k]) {
        const [dr, dc] = dirMap[k]
        const target = validMoves.find(mv => Math.sign(mv.r - activePos.r) === dr && Math.sign(mv.c - activePos.c) === dc)
        if (target) {
          e.preventDefault()
          commitMove(target, turn)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [winner, mode, turn, validMoves, activePos, commitMove])

  const undo = () => {
    if (!history.length) return
    const stepsBack = mode === 'ai' && history.length >= 2 && turn === 1 ? 2 : 1
    const snap = history[history.length - stepsBack]
    setP1(snap.p1)
    setP2(snap.p2)
    setWalls(snap.walls)
    setWLeft1(snap.wLeft1)
    setWLeft2(snap.wLeft2)
    setTurn(snap.turn)
    setWinner(null)
    setHistory(h => h.slice(0, -stepsBack))
    setErrorTip(null)
    sfx('ui.click')
  }

  // Геометрия неонового SVG поля (максимально близко к NanoBlocade из ролика!)
  const CELL = 52
  const GAP = 12
  const PAD = 22
  const STEP = CELL + GAP
  const BOARD_PX = PAD * 2 + boardN * CELL + (boardN - 1) * GAP

  const cellX = (c: number) => PAD + c * STEP
  const cellY = (r: number) => PAD + r * STEP

  const wallPreviewCheck = hoverWall
    ? validateWallPlacement(hoverWall.r, hoverWall.c, hoverWall.dir, walls, p1, p2, boardN)
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-4" data-testid="blocade-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
          ← {t('games')}
        </Link>
        <div className="flex items-center gap-2">
          {bestWins > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-extrabold flex items-center gap-1">
              <Trophy size={13} /> Побед: {bestWins}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowRules(v => !v)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
          >
            <HelpCircle size={14} /> Правила
          </button>
        </div>
      </div>

      {showRules && (
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-cyan-500/40 text-xs sm:text-sm space-y-1.5 shadow-xl">
          <div className="font-bold text-cyan-300 text-base">⚡ Как играть в BLOCADE (Блокада / Коридор):</div>
          <div>• <b>Цель Розового ⬡:</b> дойти снизу до <b>верхней бирюзовой линии</b> первым!</div>
          <div>• <b>Цель Голубого ◆:</b> дойти сверху до <b>нижней розовой линии</b> первым!</div>
          <div>• <b>В свой ход</b> ты либо делаешь <b>1 шаг фишкой</b> (или перепрыгиваешь через стоящего вплотную соперника), либо ставишь <b>1 неоновую стену</b> длиной в 2 клетки, чтобы удлинить путь сопернику!</div>
          <div>• <b>Главное правило:</b> полностью замуровать игрока без единого выхода к финишу нельзя — игра автоматически проверяет проходимость алгоритмом BFS.</div>
          <div>• <b>Горячие клавиши:</b> <code className="px-1.5 py-0.5 rounded bg-white/10">WASD / Стрелки</code> — шаг, <code className="px-1.5 py-0.5 rounded bg-white/10">R</code> — повернуть стену, <code className="px-1.5 py-0.5 rounded bg-white/10">Правый клик</code> — смена ориентации стены.</div>
        </div>
      )}

      {/* Верхняя панель управления и выбора режима */}
      <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 p-4 shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-wide flex items-center gap-2">
              <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                BLOCADE
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold">
                NEON STRATEGY
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Строй неоновый лабиринт-блокаду и доберись до противоположного края раньше соперника!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => { setMode('ai'); resetGame(boardN) }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition ${
                mode === 'ai' ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow' : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <Bot size={15} /> Против ИИ
            </button>
            <button
              type="button"
              onClick={() => { setMode('pvp'); resetGame(boardN) }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition ${
                mode === 'pvp' ? 'bg-pink-500 text-white border-pink-300 shadow' : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <Users size={15} /> 2 Игрока
            </button>

            {mode === 'ai' && (
              <div className="inline-flex rounded-xl border border-slate-700 overflow-hidden">
                {([
                  ['easy', 'Новичок'],
                  ['medium', 'Стратег'],
                  ['hard', 'Профи'],
                ] as Array<[AiLevel, string]>).map(([lvl, label]) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => { setAiLevel(lvl); resetGame(boardN) }}
                    className={`px-2.5 py-1.5 font-bold ${
                      aiLevel === lvl ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="inline-flex rounded-xl border border-slate-700 overflow-hidden">
              {([7, 9] as Array<7 | 9>).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => resetGame(n)}
                  className={`px-2.5 py-1.5 font-bold ${
                    boardN === n ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {n}×{n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Карточки игроков: Стены + Дистанция BFS до финиша + Счёт */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 ${
            turn === 1 && !winner
              ? 'bg-pink-950/50 border-pink-400 shadow-[0_0_20px_rgba(244,114,182,0.3)]'
              : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-400 flex items-center justify-center text-pink-400 font-black text-xl shrink-0">
                ⬡
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-pink-300 truncate">
                  {mode === 'ai' ? 'Ты (Розовый ↑)' : 'Игрок 1 (Розовый ↑)'}
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                  <span>🧱 Стен: <b className="text-pink-300">{wLeft1}</b>/{initialWalls}</span>
                  <span>• До финиша: <b className="text-white">{p1Bfs.dist}</b> ш.</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Победы</div>
              <div className="font-mono font-black text-xl text-pink-400">{wins1}</div>
            </div>
          </div>

          <div className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 ${
            turn === 2 && !winner
              ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
              : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-black text-xl shrink-0">
                ◆
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-cyan-300 truncate">
                  {mode === 'ai' ? 'ИИ-Блокада (Голубой ↓)' : 'Игрок 2 (Голубой ↓)'}
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                  <span>🧱 Стен: <b className="text-cyan-300">{wLeft2}</b>/{initialWalls}</span>
                  <span>• До финиша: <b className="text-white">{p2Bfs.dist}</b> ш.</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Победы</div>
              <div className="font-mono font-black text-xl text-cyan-300">{wins2}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ОСНОВНАЯ ЗОНА: НЕОНОВАЯ ДОСКА + ПАНЕЛЬ ДЕЙСТВИЙ */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-4 items-start">
        {/* Неоновая доска BLOCADE */}
        <div className="relative rounded-3xl bg-[#050814] p-3 sm:p-5 border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.16)] flex flex-col items-center">
          {/* Всплывающий баннер «В одном шаге!» */}
          {dramaticBanner && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-amber-500 text-white font-display font-black text-sm sm:text-base shadow-2xl animate-bounce whitespace-nowrap">
              {dramaticBanner}
            </div>
          )}

          {/* Баннер победы */}
          {winner && (
            <div className="w-full mb-3 p-4 rounded-2xl bg-gradient-to-r from-pink-600/90 via-indigo-600/90 to-cyan-600/90 text-white text-center flex flex-wrap items-center justify-center gap-3 shadow-xl">
              <span className="font-display font-black text-xl flex items-center gap-2">
                <Sparkles size={20} className="text-amber-300" />
                {winner === 1
                  ? (mode === 'ai' ? '🏆 Ты прорвал блокаду и победил!' : '🏆 Победил Розовый (⬡)!')
                  : (mode === 'ai' ? '🤖 ИИ-Блокада дошёл первым!' : '🏆 Победил Голубой (◆)!')}
              </span>
              <button
                type="button"
                onClick={() => resetGame(boardN)}
                className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-1.5"
              >
                <RotateCcw size={15} /> Реванш
              </button>
            </div>
          )}

          {errorTip && (
            <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-bold">
              ⚠️ {errorTip}
            </div>
          )}

          {/* Интерактивное SVG-поле точь-в-точь в стиле NanoBlocade */}
          <svg
            viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
            className="w-full max-w-[560px] h-auto select-none touch-manipulation"
            onContextMenu={e => {
              e.preventDefault()
              setTool(cur => (cur === 'wall-h' ? 'wall-v' : 'wall-h'))
              sfx('ui.click')
            }}
            onMouseLeave={() => setHoverWall(null)}
          >
            <defs>
              <filter id="glowPink" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowRed" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Внешняя неоновая рамка поля */}
            <rect
              x="4"
              y="4"
              width={BOARD_PX - 8}
              height={BOARD_PX - 8}
              rx="18"
              fill="#070c1c"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeOpacity="0.65"
            />
            <rect
              x="10"
              y="10"
              width={BOARD_PX - 20}
              height={BOARD_PX - 20}
              rx="13"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1.2"
              strokeOpacity="0.35"
            />

            {/* Клетки сетки N×N */}
            {Array.from({ length: boardN }, (_, r) =>
              Array.from({ length: boardN }, (_, c) => {
                const x = cellX(c)
                const y = cellY(r)
                const isTopGoal = r === 0
                const isBotGoal = r === boardN - 1
                const isValidTarget =
                  !winner &&
                  !(mode === 'ai' && turn === 2) &&
                  validMoves.some(m => m.r === r && m.c === c)

                return (
                  <g
                    key={`cell-${r}-${c}`}
                    onClick={() => {
                      if (isValidTarget && tool === 'move') commitMove({ r, c }, turn)
                    }}
                    style={{ cursor: isValidTarget && tool === 'move' ? 'pointer' : 'default' }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={CELL}
                      height={CELL}
                      rx="7"
                      fill={
                        isTopGoal
                          ? 'rgba(34, 211, 238, 0.14)'
                          : isBotGoal
                            ? 'rgba(236, 72, 153, 0.15)'
                            : '#0b1226'
                      }
                      stroke={
                        isValidTarget && tool === 'move'
                          ? (turn === 1 ? '#f472b6' : '#38bdf8')
                          : isTopGoal
                            ? 'rgba(56, 189, 248, 0.45)'
                            : isBotGoal
                              ? 'rgba(244, 114, 182, 0.45)'
                              : '#1e293b'
                      }
                      strokeWidth={isValidTarget && tool === 'move' ? 2.2 : 1.4}
                    />
                    {/* Подпись BLOCADE в левой верхней клетке как в ролике */}
                    {r === 0 && c === 0 && (
                      <text
                        x={x + CELL / 2}
                        y={y + CELL / 2 + 3}
                        fill="#e2e8f0"
                        fontSize="9"
                        fontWeight="900"
                        letterSpacing="0.8"
                        textAnchor="middle"
                        opacity="0.85"
                        style={{ pointerEvents: 'none' }}
                      >
                        BLOCADE
                      </text>
                    )}
                    {/* Подсветка доступного хода фишкой */}
                    {isValidTarget && tool === 'move' && (
                      <circle
                        cx={x + CELL / 2}
                        cy={y + CELL / 2}
                        r="8"
                        fill={turn === 1 ? '#f472b6' : '#38bdf8'}
                        opacity="0.55"
                      />
                    )}
                  </g>
                )
              })
            )}

            {/* Опциональная подсказка кратчайшего пути (BFS) */}
            {showPathHint && p1Bfs.path.length > 1 && (
              <polyline
                points={p1Bfs.path.map(pt => `${cellX(pt.c) + CELL / 2},${cellY(pt.r) + CELL / 2}`).join(' ')}
                fill="none"
                stroke="#f472b6"
                strokeWidth="3"
                strokeDasharray="6 6"
                strokeLinecap="round"
                opacity="0.65"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {showPathHint && p2Bfs.path.length > 1 && (
              <polyline
                points={p2Bfs.path.map(pt => `${cellX(pt.c) + CELL / 2},${cellY(pt.r) + CELL / 2}`).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="6 6"
                strokeLinecap="round"
                opacity="0.65"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Поставленные неоновые стены (Розовые и Голубые с Bloom-свечением!) */}
            {walls.map((w, idx) => {
              const isPink = w.owner === 1
              const color = isPink ? '#f472b6' : '#38bdf8'
              const core = isPink ? '#fbcfe8' : '#e0f2fe'
              const filt = isPink ? 'url(#glowPink)' : 'url(#glowCyan)'
              if (w.dir === 'h') {
                const wx = cellX(w.c) + 2
                const wy = cellY(w.r) + CELL + 2
                const ww = CELL * 2 + GAP - 4
                return (
                  <g key={`wall-${idx}`} filter={filt} style={{ pointerEvents: 'none' }}>
                    <rect x={wx} y={wy} width={ww} height={GAP - 4} rx="4" fill={color} />
                    <rect x={wx + 3} y={wy + 2.5} width={ww - 6} height={3} rx="1.5" fill={core} opacity="0.85" />
                  </g>
                )
              }
              const wx = cellX(w.c) + CELL + 2
              const wy = cellY(w.r) + 2
              const wh = CELL * 2 + GAP - 4
              return (
                <g key={`wall-${idx}`} filter={filt} style={{ pointerEvents: 'none' }}>
                  <rect x={wx} y={wy} width={GAP - 4} height={wh} rx="4" fill={color} />
                  <rect x={wx + 2.5} y={wy + 3} width={3} height={wh - 6} rx="1.5" fill={core} opacity="0.85" />
                </g>
              )
            })}

            {/* Предпросмотр устанавливаемой стены при наведении */}
            {hoverWall && wallPreviewCheck && !winner && !(mode === 'ai' && turn === 2) && (
              (() => {
                const valid = wallPreviewCheck.ok
                const fillColor = valid ? (turn === 1 ? '#f472b6' : '#38bdf8') : '#ef4444'
                const filt = valid ? (turn === 1 ? 'url(#glowPink)' : 'url(#glowCyan)') : 'url(#glowRed)'
                if (hoverWall.dir === 'h') {
                  return (
                    <rect
                      x={cellX(hoverWall.c) + 2}
                      y={cellY(hoverWall.r) + CELL + 2}
                      width={CELL * 2 + GAP - 4}
                      height={GAP - 4}
                      rx="4"
                      fill={fillColor}
                      opacity={valid ? 0.72 : 0.85}
                      filter={filt}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                }
                return (
                  <rect
                    x={cellX(hoverWall.c) + CELL + 2}
                    y={cellY(hoverWall.r) + 2}
                    width={GAP - 4}
                    height={CELL * 2 + GAP - 4}
                    rx="4"
                    fill={fillColor}
                    opacity={valid ? 0.72 : 0.85}
                    filter={filt}
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })()
            )}

            {/* Интерактивные зоны установки стен (в желобках между клетками) */}
            {!winner && !(mode === 'ai' && turn === 2) && activeWallsLeft > 0 && (
              <>
                {/* Горизонтальные желобки (или активный режим wall-h) */}
                {Array.from({ length: boardN - 1 }, (_, r) =>
                  Array.from({ length: boardN - 1 }, (_, c) => {
                    const gx = cellX(c) + CELL
                    const gy = cellY(r) + CELL
                    const isWallTool = tool === 'wall-h' || tool === 'wall-v'
                    const dirToUse: Dir = tool === 'wall-v' ? 'v' : 'h'

                    if (isWallTool) {
                      // В режиме установки стены кликабельна вся большая область вокруг перекрестия (удобно на телефонах!)
                      return (
                        <rect
                          key={`slot-${r}-${c}`}
                          x={gx - 18}
                          y={gy - 18}
                          width={GAP + 36}
                          height={GAP + 36}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoverWall({ r, c, dir: dirToUse })}
                          onClick={() => commitWall(r, c, dirToUse, turn)}
                        />
                      )
                    }
                    // В режиме «Ход» — можно всё равно навести прямо на тонкий желобок и быстро поставить стену!
                    return (
                      <g key={`quick-${r}-${c}`}>
                        <rect
                          x={cellX(c) + 8}
                          y={cellY(r) + CELL - 2}
                          width={CELL - 16}
                          height={GAP + 4}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoverWall({ r, c, dir: 'h' })}
                          onClick={() => commitWall(r, c, 'h', turn)}
                        />
                        <rect
                          x={cellX(c) + CELL - 2}
                          y={cellY(r) + 8}
                          width={GAP + 4}
                          height={CELL - 16}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoverWall({ r, c, dir: 'v' })}
                          onClick={() => commitWall(r, c, 'v', turn)}
                        />
                      </g>
                    )
                  })
                )}
              </>
            )}

            {/* ФИШКА ИГРОКА 1: НЕОНОВЫЙ РОЗОВЫЙ ШЕСТИУГОЛЬНИК (HEXAGON) */}
            <g
              transform={`translate(${cellX(p1.c) + CELL / 2}, ${cellY(p1.r) + CELL / 2})`}
              filter="url(#glowPink)"
              style={{ transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)', pointerEvents: 'none' }}
            >
              <polygon
                points="0,-18 16,-9 16,9 0,18 -16,9 -16,-9"
                fill="#ec4899"
                stroke="#fbcfe8"
                strokeWidth="2.5"
              />
              <polygon
                points="0,-9 8,-4.5 8,4.5 0,9 -8,4.5 -8,-4.5"
                fill="#fdf2f8"
                opacity="0.7"
              />
            </g>

            {/* ФИШКА ИГРОКА 2: НЕОНОВЫЙ ГОЛУБОЙ РОМБ (DIAMOND) */}
            <g
              transform={`translate(${cellX(p2.c) + CELL / 2}, ${cellY(p2.r) + CELL / 2})`}
              filter="url(#glowCyan)"
              style={{ transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)', pointerEvents: 'none' }}
            >
              <polygon
                points="0,-19 19,0 0,19 -19,0"
                fill="#06b6d4"
                stroke="#cffafe"
                strokeWidth="2.5"
              />
              <polygon
                points="0,-9 9,0 0,9 -9,0"
                fill="#ecfeff"
                opacity="0.8"
              />
            </g>
          </svg>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ ИГРОКА */}
        <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 p-4 space-y-4 shadow-xl">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Сейчас ходит</div>
            <div className={`px-3.5 py-2.5 rounded-2xl font-extrabold text-sm flex items-center gap-2 ${
              turn === 1
                ? 'bg-pink-500/20 border border-pink-400/50 text-pink-200'
                : 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
            }`}>
              <span className="text-lg">{turn === 1 ? '⬡' : '◆'}</span>
              <span>
                {turn === 1
                  ? (mode === 'ai' ? 'Твой ход (Розовый)' : 'Ход Розового')
                  : (mode === 'ai' ? 'ИИ думает…' : 'Ход Голубого')}
              </span>
            </div>
          </div>

          {/* Выбор действия: Шаг / Горизонтальная стена / Вертикальная стена */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Действие</div>
            <button
              type="button"
              onClick={() => { setTool('move'); setHoverWall(null); sfx('ui.click') }}
              data-testid="blocade-tool-move"
              className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 border transition ${
                tool === 'move'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Move size={17} /> 🕹️ Ходить фишкой
            </button>

            <button
              type="button"
              disabled={activeWallsLeft <= 0}
              onClick={() => { setTool('wall-h'); sfx('ui.click') }}
              data-testid="blocade-tool-wall-h"
              className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 border transition disabled:opacity-40 ${
                tool === 'wall-h'
                  ? 'bg-pink-600 border-pink-300 text-white shadow-lg'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Shield size={17} /> ➖ Стена горизонтально
            </button>

            <button
              type="button"
              disabled={activeWallsLeft <= 0}
              onClick={() => { setTool('wall-v'); sfx('ui.click') }}
              data-testid="blocade-tool-wall-v"
              className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 border transition disabled:opacity-40 ${
                tool === 'wall-v'
                  ? 'bg-cyan-600 border-cyan-300 text-white shadow-lg'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Shield size={17} /> ❘ Стена вертикально
            </button>

            <div className="text-[11px] text-slate-400 leading-snug pt-0.5">
              Совет: можно ставить стены даже в режиме хода — просто наведи прямо на полоску между клетками! Клавиша <b>R</b> или правый клик поворачивает стену.
            </div>
          </div>

          {/* Дополнительные кнопки */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => { setShowPathHint(v => !v); sfx('ui.click') }}
              className={`w-full px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition ${
                showPathHint
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Compass size={15} /> {showPathHint ? '✓ Путь BFS показан' : '🧭 Показать кратчайший путь (BFS)'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Undo2 size={14} /> Отмена
              </button>
              <button
                type="button"
                onClick={() => resetGame(boardN)}
                className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold flex items-center justify-center gap-1"
              >
                <RotateCcw size={14} /> Заново
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
