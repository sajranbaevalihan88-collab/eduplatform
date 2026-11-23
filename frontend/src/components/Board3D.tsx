import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  Camera, Trash2, RotateCcw,
  Shapes, X, MousePointer2, Plus, Copy, Layers, Undo2, Magnet, Grid3X3,
  RefreshCw, MoveUpRight, Sparkles, RotateCw, Eraser
} from 'lucide-react'
import { useLang } from '../context/LangContext'
import { compressDataUrl } from '../board/legacy'

type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'prism' | 'torus' | 'octahedron' | 'plane'
type ToolMode = 'select' | 'place' | 'vector'
type MatStyle = 'solid' | 'glass' | 'wire'
type PresetId = 'stereometry' | 'solar' | 'molecule' | 'vectors'

type SItem = {
  id: number
  type: ShapeType
  mesh: THREE.Mesh
  edges?: THREE.LineSegments
  size: number
  colorHex: string
  style: MatStyle
  spawnT: number
  scaleMul: number
  elevY: number
  rotY: number
}

type VectorItem = {
  id: number
  arrow: THREE.ArrowHelper
  from: THREE.Vector3
  to: THREE.Vector3
  colorHex: string
}

type UndoEntry =
  | { kind: 'add_shape'; id: number }
  | { kind: 'del_shape'; snap: { type: ShapeType; size: number; colorHex: string; style: MatStyle; scaleMul: number; pos: [number, number, number]; elevY: number; rotY: number } }
  | { kind: 'add_vec'; id: number }

const COLORS = [
  '#3B82F6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#0f172a', '#64748b', '#eab308'
]

function createGeometry(ty: ShapeType, s: number): THREE.BufferGeometry {
  switch (ty) {
    case 'cube': return new THREE.BoxGeometry(s, s, s)
    case 'sphere': return new THREE.SphereGeometry(s / 2, 32, 22)
    case 'cylinder': return new THREE.CylinderGeometry(s / 2, s / 2, s, 30)
    case 'cone': return new THREE.ConeGeometry(s / 2, s, 30)
    case 'pyramid': return new THREE.ConeGeometry(s * 0.65, s, 4)
    case 'prism': return new THREE.CylinderGeometry(s * 0.55, s * 0.55, s, 3)
    case 'torus': return new THREE.TorusGeometry(s * 0.42, s * 0.16, 16, 36)
    case 'octahedron': return new THREE.OctahedronGeometry(s * 0.58)
    case 'plane': return new THREE.BoxGeometry(s * 2.2, 0.06, s * 2.2)
  }
}

function shapeBaseY(ty: ShapeType, effSize: number): number {
  if (ty === 'plane') return 0.04
  if (ty === 'torus') return effSize * 0.58
  if (ty === 'octahedron') return effSize * 0.58
  return effSize / 2
}

function makeAxisLabel(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 42px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 32, 34)
  const tex = new THREE.CanvasTexture(c)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sp.scale.set(0.75, 0.75, 1)
  return sp
}

function calcMetrics(ty: ShapeType, rawSize: number, scaleMul: number): { formula: string; volume: string; area: string } | null {
  const a = +(rawSize * scaleMul).toFixed(2)
  const r = +(a / 2).toFixed(2)
  switch (ty) {
    case 'cube':
      return { formula: `a = ${a}`, volume: `V = a³ = ${(a ** 3).toFixed(2)}`, area: `S = 6a² = ${(6 * a * a).toFixed(2)}` }
    case 'sphere':
      return { formula: `r = ${r}`, volume: `V = ⁴⁄₃πr³ = ${((4 / 3) * Math.PI * r ** 3).toFixed(2)}`, area: `S = 4πr² = ${(4 * Math.PI * r * r).toFixed(2)}` }
    case 'cylinder':
      return { formula: `r = ${r}, h = ${a}`, volume: `V = πr²h = ${(Math.PI * r * r * a).toFixed(2)}`, area: `S = 2πr(r+h) = ${(2 * Math.PI * r * (r + a)).toFixed(2)}` }
    case 'cone': {
      const l = Math.hypot(r, a)
      return { formula: `r = ${r}, h = ${a}`, volume: `V = ⅓πr²h = ${((1 / 3) * Math.PI * r * r * a).toFixed(2)}`, area: `S = πr(r+l) = ${(Math.PI * r * (r + l)).toFixed(2)}` }
    }
    case 'pyramid': {
      const base = +(a * 0.65 * Math.SQRT2).toFixed(2)
      return { formula: `b = ${base}, h = ${a}`, volume: `V = ⅓b²h = ${((1 / 3) * base * base * a).toFixed(2)}`, area: `S ≈ ${(base * base + 2 * base * Math.hypot(base / 2, a)).toFixed(2)}` }
    }
    case 'prism':
      return { formula: `h = ${a}`, volume: `V = S₀·h = ${(0.433 * a * a * a).toFixed(2)}`, area: `S ≈ ${(3.86 * a * a).toFixed(2)}` }
    case 'torus': {
      const R = a * 0.42, rr = a * 0.16
      return { formula: `R = ${R.toFixed(2)}, r = ${rr.toFixed(2)}`, volume: `V = 2π²Rr² = ${(2 * Math.PI * Math.PI * R * rr * rr).toFixed(2)}`, area: `S = 4π²Rr = ${(4 * Math.PI * Math.PI * R * rr).toFixed(2)}` }
    }
    case 'octahedron':
      return { formula: `a = ${a}`, volume: `V = √2/3·a³ = ${((Math.SQRT2 / 3) * a ** 3).toFixed(2)}`, area: `S = 2√3·a² = ${(2 * Math.sqrt(3) * a * a).toFixed(2)}` }
    case 'plane':
      return { formula: `${(a * 2.2).toFixed(1)} × ${(a * 2.2).toFixed(1)}`, volume: 'S = w · h', area: `S = ${((a * 2.2) ** 2).toFixed(2)}` }
  }
}

export default function Board3D({ onSnapshot }: { onSnapshot: (dataUrl: string) => void }) {
  const { t } = useLang()
  const hostRef = useRef<HTMLDivElement>(null)
  const threeRef = useRef<any>(null)
  const itemsRef = useRef<SItem[]>([])
  const vectorsRef = useRef<VectorItem[]>([])
  const presetGroupRef = useRef<THREE.Group | null>(null)
  const animHookRef = useRef<((dt: number, elapsed: number) => void) | null>(null)
  const undoStackRef = useRef<UndoEntry[]>([])
  const idRef = useRef(1)

  const [sel, setSel] = useState<number | null>(null)
  const [selInfo, setSelInfo] = useState<{ type: ShapeType; size: number; scaleMul: number; colorHex: string; style: MatStyle; elevY: number; rotY: number } | null>(null)
  const [hudOpen, setHudOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true))
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [tool, setTool] = useState<ToolMode>('place')
  const [type, setType] = useState<ShapeType>('cube')
  const [color, setColor] = useState('#3B82F6')
  const [style, setStyle] = useState<MatStyle>('solid')
  const [size, setSize] = useState(1.2)
  const [elevY, setElevY] = useState(0)
  const [rotY, setRotY] = useState(0)
  const [snapGrid, setSnapGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [autoRot, setAutoRot] = useState(false)
  const [count, setCount] = useState(0)
  const [activePreset, setActivePreset] = useState<PresetId | null>(null)
  const [vecStartSet, setVecStartSet] = useState(false)
  const [webglFail, setWebglFail] = useState(false)

  const selRef = useRef<number | null>(null)
  const uiRef = useRef({ tool, type, color, style, size, snapGrid, showGrid, autoRot })
  uiRef.current = { tool, type, color, style, size, snapGrid, showGrid, autoRot }

  const syncSelInfo = useCallback(() => {
    const it = itemsRef.current.find(i => i.id === selRef.current)
    if (!it) {
      setSelInfo(null)
      return
    }
    setSelInfo({
      type: it.type,
      size: it.size,
      scaleMul: it.scaleMul,
      colorHex: it.colorHex,
      style: it.style,
      elevY: it.elevY,
      rotY: it.rotY,
    })
    setColor(it.colorHex)
    setStyle(it.style)
    setSize(+(it.size * it.scaleMul).toFixed(1))
    setElevY(+it.elevY.toFixed(1))
    setRotY(Math.round(THREE.MathUtils.radToDeg(it.rotY) % 360))
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const lowEnd = ((navigator as any).hardwareConcurrency || 4) <= 4 || ((navigator as any).deviceMemory || 8) <= 4
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !lowEnd,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: lowEnd ? 'low-power' : 'default',
      })
    } catch {
      setWebglFail(true)
      return
    }
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, (host.clientWidth || 640) / (host.clientHeight || 420), 0.1, 500)
    camera.position.set(7.5, 6.2, 9.5)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75))
    renderer.shadowMap.enabled = !lowEnd
    if (!lowEnd) renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setSize(host.clientWidth || 640, host.clientHeight || 420)
    renderer.domElement.style.touchAction = 'none'
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 1.88
    controls.minDistance = 2.5
    controls.maxDistance = 35
    controls.target.set(0, 1.0, 0)
    controls.autoRotate = false
    controls.autoRotateSpeed = 0.9

    const stopAuto = () => {
      if (uiRef.current.autoRot) {
        controls.autoRotate = false
        setAutoRot(false)
      }
    }
    renderer.domElement.addEventListener('pointerdown', stopAuto)

    // Студийное 3-точечное освещение
    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x64748b, 1.05))
    const dir = new THREE.DirectionalLight(0xffffff, 1.25)
    dir.position.set(8, 13, 8)
    dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    dir.shadow.camera.left = -15
    dir.shadow.camera.right = 15
    dir.shadow.camera.top = 15
    dir.shadow.camera.bottom = -15
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 42
    dir.shadow.bias = -0.0005
    scene.add(dir)
    const rim = new THREE.DirectionalLight(0x93c5fd, 0.4)
    rim.position.set(-9, 6, -7)
    scene.add(rim)

    // Пол с тенями, сетка и координатные оси с подписями X, Y, Z
    const ground = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.ShadowMaterial({ opacity: 0.16 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.015
    ground.receiveShadow = true
    scene.add(ground)

    const gridGroup = new THREE.Group()
    const grid = new THREE.GridHelper(24, 24, 0x64748b, 0x94a3b8)
    const gridMat = grid.material as THREE.Material
    gridMat.transparent = true
    gridMat.opacity = 0.45
    gridGroup.add(grid)

    const mkAxis = (dirV: THREE.Vector3, c: number, lbl: string, lblCol: string) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.015, 0), dirV])
      gridGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 })))
      const sp = makeAxisLabel(lbl, lblCol)
      sp.position.copy(dirV).multiplyScalar(1.05)
      if (lbl === 'X' || lbl === 'Z') sp.position.y = 0.35
      gridGroup.add(sp)
    }
    mkAxis(new THREE.Vector3(11.5, 0, 0), 0xef4444, 'X', '#ef4444')
    mkAxis(new THREE.Vector3(0, 8.5, 0), 0x22c55e, 'Y', '#22c55e')
    mkAxis(new THREE.Vector3(0, 0, 11.5), 0x3b82f6, 'Z', '#3b82f6')
    scene.add(gridGroup)

    // Ghost-превью для режима размещения фигур
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.36, roughness: 0.4, depthWrite: false,
    })
    const ghost = new THREE.Mesh(createGeometry('cube', 1), ghostMat)
    ghost.visible = false
    ghost.userData.ty = 'cube'
    scene.add(ghost)

    // Маркер начальной точки для инструмента 3D-вектора
    const vecStartMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    )
    vecStartMarker.visible = false
    scene.add(vecStartMarker)
    let pendingVecStart: THREE.Vector3 | null = null

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const planePoint = new THREE.Vector3()
    let draggingId: number | null = null
    let dragStartY = 0
    let dragInitElev = 0
    let dragVertical = false
    let downAt = 0
    let downXY = { x: 0, y: 0 }
    const activePointers = new Set<number>()

    const setPointer = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
    }
    const snapVal = (v: number) => (uiRef.current.snapGrid ? Math.round(v * 2) / 2 : v)

    const floorPoint = (): THREE.Vector3 | null => {
      const hit = raycaster.ray.intersectPlane(groundPlane, planePoint)
      if (hit) {
        planePoint.x = snapVal(Math.max(-11, Math.min(11, planePoint.x)))
        planePoint.z = snapVal(Math.max(-11, Math.min(11, planePoint.z)))
        planePoint.y = 0
        return planePoint
      }
      return null
    }

    const pickMesh = () => raycaster.intersectObjects(itemsRef.current.map(i => i.mesh), false)[0]

    const applyMaterialStyle = (it: SItem) => {
      const m = it.mesh.material as THREE.MeshStandardMaterial
      m.color.set(it.colorHex)
      if (it.style === 'wire') {
        m.wireframe = true
        m.transparent = false
        m.opacity = 1
        m.depthWrite = true
      } else if (it.style === 'glass') {
        m.wireframe = false
        m.transparent = true
        m.opacity = 0.38
        m.roughness = 0.15
        m.metalness = 0.1
        m.depthWrite = false
      } else {
        m.wireframe = false
        m.transparent = false
        m.opacity = 1
        m.roughness = 0.42
        m.metalness = 0.08
        m.depthWrite = true
      }
      m.needsUpdate = true
      if (it.edges) {
        it.edges.visible = it.style === 'glass' || it.type === 'cube' || it.type === 'pyramid' || it.type === 'prism' || it.type === 'octahedron'
        const em = it.edges.material as THREE.LineBasicMaterial
        em.opacity = it.style === 'glass' ? 0.9 : 0.25
        em.color.set(it.id === selRef.current ? 0xfacc15 : it.style === 'glass' ? it.colorHex : 0x0f172a)
      }
    }

    const markSel = () => {
      const cur = selRef.current
      itemsRef.current.forEach(i => {
        const m = i.mesh.material as THREE.MeshStandardMaterial
        m.emissive.set(i.id === cur ? i.colorHex : 0x000000)
        m.emissiveIntensity = i.id === cur ? 0.35 : 0
        applyMaterialStyle(i)
      })
    }

    const setSelRaw = (id: number | null) => {
      selRef.current = id
      setSel(id)
      markSel()
      syncSelInfo()
    }

    const addItem = (
      x: number,
      z: number,
      opts?: { ty?: ShapeType; s?: number; col?: string; st?: MatStyle; elevY?: number; rotY?: number; scaleMul?: number; noUndo?: boolean; noSelect?: boolean }
    ): SItem => {
      const ui = uiRef.current
      const ty = opts?.ty ?? ui.type
      const s = opts?.s ?? ui.size
      const col = opts?.col ?? ui.color
      const st = opts?.st ?? ui.style
      const eY = opts?.elevY ?? 0
      const rY = opts?.rotY ?? 0
      const sc = opts?.scaleMul ?? 1

      const geo = createGeometry(ty, s)
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: 0.42, metalness: 0.08 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, shapeBaseY(ty, s * sc) + eY, z)
      mesh.rotation.y = rY
      mesh.scale.setScalar(sc)
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Контурные рёбра для стереометрии и режима стекла
      const edgeGeo = new THREE.EdgesGeometry(geo, 18)
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.25 })
      const edges = new THREE.LineSegments(edgeGeo, edgeMat)
      mesh.add(edges)

      const it: SItem = {
        id: idRef.current++,
        type: ty,
        mesh,
        edges,
        size: s,
        colorHex: col,
        style: st,
        spawnT: performance.now(),
        scaleMul: sc,
        elevY: eY,
        rotY: rY,
      }
      applyMaterialStyle(it)
      itemsRef.current.push(it)
      scene.add(mesh)
      setCount(itemsRef.current.length + vectorsRef.current.length)
      if (!opts?.noUndo) undoStackRef.current.push({ kind: 'add_shape', id: it.id })
      if (!opts?.noSelect) setSelRaw(it.id)
      return it
    }

    const addVector = (from: THREE.Vector3, to: THREE.Vector3, colHex: string, noUndo = false) => {
      const dirV = new THREE.Vector3().subVectors(to, from)
      const len = dirV.length()
      if (len < 0.15) return
      const arrow = new THREE.ArrowHelper(dirV.clone().normalize(), from, len, new THREE.Color(colHex).getHex(), Math.min(0.45, len * 0.25), 0.22)
      scene.add(arrow)
      const id = idRef.current++
      vectorsRef.current.push({ id, arrow, from: from.clone(), to: to.clone(), colorHex: colHex })
      setCount(itemsRef.current.length + vectorsRef.current.length)
      if (!noUndo) undoStackRef.current.push({ kind: 'add_vec', id })
    }

    const clearPreset = () => {
      animHookRef.current = null
      if (presetGroupRef.current) {
        scene.remove(presetGroupRef.current)
        presetGroupRef.current.traverse(o => {
          const m = o as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
          const mat = m.material as THREE.Material | THREE.Material[] | undefined
          if (Array.isArray(mat)) mat.forEach(x => x.dispose())
          else if (mat) mat.dispose()
        })
        presetGroupRef.current = null
      }
      setActivePreset(null)
    }

    const clearAll = () => {
      clearPreset()
      itemsRef.current.forEach(it => {
        scene.remove(it.mesh)
        it.mesh.geometry.dispose()
        ;(it.mesh.material as THREE.Material).dispose()
        if (it.edges) { it.edges.geometry.dispose(); (it.edges.material as THREE.Material).dispose() }
      })
      itemsRef.current = []
      vectorsRef.current.forEach(v => scene.remove(v.arrow))
      vectorsRef.current = []
      undoStackRef.current = []
      pendingVecStart = null
      vecStartMarker.visible = false
      setVecStartSet(false)
      setCount(0)
      setSelRaw(null)
    }

    const loadPreset = (preset: PresetId) => {
      clearAll()
      setActivePreset(preset)
      if (preset === 'stereometry') {
        // Стереометрия: стеклянный куб, вписанная сфера, пирамида рядом и диагональ куба
        addItem(0, 0, { ty: 'cube', s: 3.0, col: '#3B82F6', st: 'glass', noUndo: true, noSelect: true })
        addItem(0, 0, { ty: 'sphere', s: 2.9, col: '#f59e0b', st: 'solid', elevY: 0.05, noUndo: true, noSelect: true })
        addItem(4.0, 0, { ty: 'pyramid', s: 2.6, col: '#14b8a6', st: 'glass', noUndo: true, noSelect: true })
        addItem(-4.0, 0, { ty: 'cone', s: 2.6, col: '#a855f7', st: 'glass', noUndo: true, noSelect: true })
        addVector(new THREE.Vector3(-1.5, 0.02, -1.5), new THREE.Vector3(1.5, 3.0, 1.5), '#ef4444', true)
        camera.position.set(7.5, 5.5, 9.5)
        controls.target.set(0, 1.4, 0)
      } else if (preset === 'vectors') {
        // 3D Векторы: правило параллелограмма в пространстве
        const o = new THREE.Vector3(0, 0.02, 0)
        const a = new THREE.Vector3(4, 1.5, 0.5)
        const b = new THREE.Vector3(1, 2.5, 4)
        const sum = new THREE.Vector3().addVectors(a, b)
        addVector(o, a, '#ef4444', true)
        addVector(o, b, '#3B82F6', true)
        addVector(o, sum, '#22c55e', true)
        addVector(a, sum, '#94a3b8', true)
        addVector(b, sum, '#94a3b8', true)
        camera.position.set(8.5, 6.5, 9.5)
        controls.target.set(2.5, 2, 2)
      } else if (preset === 'solar') {
        // Солнечная система с живыми орбитами
        const grp = new THREE.Group()
        const sun = new THREE.Mesh(
          new THREE.SphereGeometry(1.15, 28, 20),
          new THREE.MeshBasicMaterial({ color: 0xfde047 })
        )
        sun.position.set(0, 1.8, 0)
        const sunHalo = new THREE.Mesh(
          new THREE.SphereGeometry(1.42, 24, 16),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.28 })
        )
        sun.add(sunHalo)
        grp.add(sun)

        const planets: { mesh: THREE.Object3D; r: number; speed: number; phase: number }[] = []
        const mkOrbit = (r: number) => {
          const pts: THREE.Vector3[] = []
          for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2
            pts.push(new THREE.Vector3(Math.cos(a) * r, 1.8, Math.sin(a) * r))
          }
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 })
          )
          grp.add(line)
        }
        const defs: [number, number, number, number, boolean?][] = [
          [2.3, 0.25, 0x94a3b8, 1.6],      // Меркурий
          [3.6, 0.44, 0x3b82f6, 1.0],      // Земля
          [5.0, 0.34, 0xef4444, 0.72],     // Марс
          [7.0, 0.65, 0xeab308, 0.45, true], // Сатурн с кольцом
        ]
        defs.forEach(([r, rad, col, spd, hasRing], idx) => {
          mkOrbit(r)
          const pGrp = new THREE.Group()
          const pMesh = new THREE.Mesh(
            new THREE.SphereGeometry(rad, 22, 16),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })
          )
          pMesh.castShadow = true
          pGrp.add(pMesh)
          if (hasRing) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(rad * 1.35, rad * 2.1, 32),
              new THREE.MeshStandardMaterial({ color: 0xfde68a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
            )
            ring.rotation.x = Math.PI / 2.6
            pGrp.add(ring)
          }
          if (idx === 1) {
            // Луна вокруг Земли
            const moon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }))
            moon.position.set(0.85, 0.1, 0)
            pGrp.add(moon)
          }
          grp.add(pGrp)
          planets.push({ mesh: pGrp, r, speed: spd, phase: idx * 1.7 })
        })
        scene.add(grp)
        presetGroupRef.current = grp
        animHookRef.current = (_dt, el) => {
          planets.forEach(p => {
            const ang = el * p.speed + p.phase
            p.mesh.position.set(Math.cos(ang) * p.r, 1.8, Math.sin(ang) * p.r)
            p.mesh.rotation.y = el * 1.4
          })
        }
        camera.position.set(0, 9.5, 13)
        controls.target.set(0, 1.8, 0)
      } else if (preset === 'molecule') {
        // Молекула воды H2O (угол 104.5°) + орбитали электронов
        const grp = new THREE.Group()
        const ox = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 20), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.15 }))
        ox.position.set(0, 2.2, 0); ox.castShadow = true
        const ang = THREE.MathUtils.degToRad(52.25)
        const d = 2.05
        const h1Pos = new THREE.Vector3(-Math.sin(ang) * d, 2.2 - Math.cos(ang) * d, 0)
        const h2Pos = new THREE.Vector3(Math.sin(ang) * d, 2.2 - Math.cos(ang) * d, 0)
        const hMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 })
        const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), hMat)
        h1.position.copy(h1Pos); h1.castShadow = true
        const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), hMat)
        h2.position.copy(h2Pos); h2.castShadow = true

        const mkBond = (p1: THREE.Vector3, p2: THREE.Vector3) => {
          const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
          const len = p1.distanceTo(p2)
          const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 14), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 }))
          cyl.position.copy(mid)
          cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize())
          cyl.castShadow = true
          return cyl
        }
        grp.add(ox, h1, h2, mkBond(ox.position, h1Pos), mkBond(ox.position, h2Pos))

        // Электроны на орбитах
        const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }))
        const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }))
        grp.add(e1, e2)
        scene.add(grp)
        presetGroupRef.current = grp
        animHookRef.current = (_dt, el) => {
          grp.rotation.y = Math.sin(el * 0.6) * 0.35
          e1.position.set(Math.cos(el * 2.5) * 2.6, 2.2 + Math.sin(el * 2.5) * 1.1, Math.sin(el * 2.5) * 1.4)
          e2.position.set(Math.cos(el * 2.5 + Math.PI) * 2.6, 2.2 - Math.sin(el * 2.5 + Math.PI) * 1.1, Math.sin(el * 2.5 + Math.PI) * 1.4)
        }
        camera.position.set(0, 3.8, 7.2)
        controls.target.set(0, 1.8, 0)
      }
      setTool('select')
      setPresetsOpen(false)
      controls.update()
    }

    const onDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId)
      downAt = Date.now()
      downXY = { x: e.clientX, y: e.clientY }
      if (activePointers.size > 1) return
      if (e.button !== 0 && e.pointerType === 'mouse') return
      setPointer(e)
      const hit = pickMesh()
      if (hit && uiRef.current.tool !== 'vector') {
        const it = itemsRef.current.find(i => i.mesh === hit.object)
        if (it) {
          setSelRaw(it.id)
          draggingId = it.id
          dragStartY = e.clientY
          dragInitElev = it.elevY
          dragVertical = e.shiftKey
          controls.enabled = false
          try { renderer.domElement.setPointerCapture(e.pointerId) } catch {}
        }
      }
    }

    const onMove = (e: PointerEvent) => {
      setPointer(e)
      if (draggingId != null) {
        const it = itemsRef.current.find(i => i.id === draggingId)
        if (it) {
          if (dragVertical || e.shiftKey) {
            const dy = (dragStartY - e.clientY) * 0.03
            const nextElev = Math.max(0, Math.min(8, snapVal(dragInitElev + dy)))
            it.elevY = nextElev
            it.mesh.position.y = shapeBaseY(it.type, it.size * it.scaleMul) + nextElev
            setElevY(+nextElev.toFixed(1))
          } else {
            const pt = floorPoint()
            if (pt) {
              it.mesh.position.x = pt.x
              it.mesh.position.z = pt.z
            }
          }
        }
        ghost.visible = false
        return
      }
      if (activePointers.size > 1 || uiRef.current.tool !== 'place') {
        ghost.visible = false
        return
      }
      const hitM = pickMesh()
      if (hitM) { ghost.visible = false; return }
      const ui = uiRef.current
      const pt = floorPoint()
      if (pt) {
        if (ghost.userData.ty !== ui.type) {
          ghost.geometry.dispose()
          ghost.geometry = createGeometry(ui.type, 1)
          ghost.userData.ty = ui.type
        }
        ghost.scale.setScalar(ui.size)
        ghost.position.set(pt.x, shapeBaseY(ui.type, ui.size), pt.z)
        ghostMat.color.set(ui.color)
        ghost.visible = true
      } else {
        ghost.visible = false
      }
    }

    const onUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId)
      ghost.visible = false
      if (draggingId != null) {
        controls.enabled = true
        draggingId = null
        return
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (Date.now() - downAt > 500) return
      if (Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y) > 10) return
      setPointer(e)

      const curTool = uiRef.current.tool
      if (curTool === 'vector') {
        const pt = floorPoint()
        if (!pt) return
        if (!pendingVecStart) {
          pendingVecStart = pt.clone()
          pendingVecStart.y = 0.05
          vecStartMarker.position.copy(pendingVecStart)
          vecStartMarker.visible = true
          setVecStartSet(true)
        } else {
          const endPt = pt.clone()
          endPt.y = 0.05
          addVector(pendingVecStart, endPt, uiRef.current.color)
          pendingVecStart = null
          vecStartMarker.visible = false
          setVecStartSet(false)
        }
        return
      }

      if (pickMesh()) return
      if (curTool === 'select') {
        // В режиме выбора клик по пустому полу просто снимает выделение, не спавня лишних кубов!
        setSelRaw(null)
        return
      }
      const pt = floorPoint()
      if (!pt) return
      addItem(pt.x, pt.z)
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointerleave', () => { ghost.visible = false })
    renderer.domElement.addEventListener('pointercancel', onUp)

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(host)

    let raf = 0
    const clock = new THREE.Clock()
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.08)
      gridGroup.visible = uiRef.current.showGrid
      controls.autoRotate = uiRef.current.autoRot
      controls.update()

      if (animHookRef.current) animHookRef.current(dt, clock.elapsedTime)

      const now = performance.now()
      itemsRef.current.forEach(it => {
        if (!it.spawnT) return
        const k = Math.min(1, (now - it.spawnT) / 240)
        const ease = 1 - Math.pow(1 - k, 3)
        const s = it.scaleMul * (0.4 + 0.6 * ease)
        it.mesh.scale.setScalar(s)
        it.mesh.position.y = shapeBaseY(it.type, it.size * s) + it.elevY
        if (k >= 1) it.spawnT = 0
      })

      renderer.render(scene, camera)
      if (!document.hidden) raf = requestAnimationFrame(tick)
      else raf = 0
    }
    const onVis = () => {
      if (!document.hidden && !raf) {
        clock.getDelta()
        raf = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    tick()

    const removeById = (id: number, recordUndo = true) => {
      const it = itemsRef.current.find(i => i.id === id)
      if (!it) return null
      if (recordUndo) {
        undoStackRef.current.push({
          kind: 'del_shape',
          snap: {
            type: it.type, size: it.size, colorHex: it.colorHex, style: it.style,
            scaleMul: it.scaleMul, pos: [it.mesh.position.x, it.mesh.position.y, it.mesh.position.z],
            elevY: it.elevY, rotY: it.rotY,
          },
        })
      }
      scene.remove(it.mesh)
      it.mesh.geometry.dispose()
      ;(it.mesh.material as THREE.Material).dispose()
      if (it.edges) { it.edges.geometry.dispose(); (it.edges.material as THREE.Material).dispose() }
      itemsRef.current = itemsRef.current.filter(i => i.id !== id)
      setCount(itemsRef.current.length + vectorsRef.current.length)
      if (selRef.current === id) setSelRaw(null)
      return id
    }

    threeRef.current = {
      scene,
      camera,
      renderer,
      removeSelected() {
        if (selRef.current == null) return null
        return removeById(selRef.current, true)
      },
      duplicateSelected() {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        addItem(it.mesh.position.x + 1.2, it.mesh.position.z + 1.2, {
          ty: it.type, s: it.size, col: it.colorHex, st: it.style,
          elevY: it.elevY, rotY: it.rotY, scaleMul: it.scaleMul,
        })
      },
      undo() {
        const last = undoStackRef.current.pop()
        if (!last) return
        if (last.kind === 'add_shape') removeById(last.id, false)
        else if (last.kind === 'del_shape') {
          const sn = last.snap
          addItem(sn.pos[0], sn.pos[2], { ty: sn.type, s: sn.size, col: sn.colorHex, st: sn.style, elevY: sn.elevY, rotY: sn.rotY, scaleMul: sn.scaleMul, noUndo: true })
        } else if (last.kind === 'add_vec') {
          const v = vectorsRef.current.find(x => x.id === last.id)
          if (v) {
            scene.remove(v.arrow)
            vectorsRef.current = vectorsRef.current.filter(x => x.id !== last.id)
            setCount(itemsRef.current.length + vectorsRef.current.length)
          }
        }
      },
      clearAll,
      loadPreset,
      resizeSelected(newTotalSize: number) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        const sc = newTotalSize / it.size
        it.scaleMul = sc
        it.spawnT = 0
        it.mesh.scale.setScalar(sc)
        it.mesh.position.y = shapeBaseY(it.type, it.size * sc) + it.elevY
        syncSelInfo()
      },
      elevateSelected(y: number) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        it.elevY = y
        it.mesh.position.y = shapeBaseY(it.type, it.size * it.scaleMul) + y
        syncSelInfo()
      },
      rotateSelected(deg: number) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        it.rotY = THREE.MathUtils.degToRad(deg)
        it.mesh.rotation.y = it.rotY
        syncSelInfo()
      },
      recolorSelected(hex: string) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        it.colorHex = hex
        markSel()
        syncSelInfo()
      },
      restyleSelected(st: MatStyle) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        it.style = st
        applyMaterialStyle(it)
        syncSelInfo()
      },
      setCameraView(view: 'iso' | 'top' | 'front' | 'side') {
        if (view === 'iso') { camera.position.set(7.5, 6.2, 9.5); controls.target.set(0, 1, 0) }
        else if (view === 'top') { camera.position.set(0, 14, 0.01); controls.target.set(0, 0, 0) }
        else if (view === 'front') { camera.position.set(0, 2.5, 12); controls.target.set(0, 1.5, 0) }
        else if (view === 'side') { camera.position.set(12, 2.5, 0); controls.target.set(0, 1.5, 0) }
        controls.update()
      },
      snapshot(): string {
        renderer.render(scene, camera)
        return renderer.domElement.toDataURL('image/png', 0.95)
      },
    }
    ;(window as any).__bd3 = { count: () => itemsRef.current.length, sel: () => selRef.current }

    // Горячие клавиши 3D-доски
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selRef.current != null) { e.preventDefault(); threeRef.current?.removeSelected() }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); threeRef.current?.undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selRef.current != null) { e.preventDefault(); threeRef.current?.duplicateSelected() }
      } else if (e.key === 'Escape') {
        pendingVecStart = null; vecStartMarker.visible = false; setVecStartSet(false)
        setTool('select'); setSelRaw(null)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointercancel', onUp)
      renderer.domElement.removeEventListener('pointerdown', stopAuto)
      controls.dispose()
      clearAll()
      ghost.geometry.dispose()
      ghostMat.dispose()
      renderer.dispose()
      try { host.removeChild(renderer.domElement) } catch {}
      try { delete (window as any).__bd3 } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const snap = useCallback(async () => {
    const a = threeRef.current
    if (!a) return
    try {
      const raw = a.snapshot()
      const small = (await compressDataUrl(raw, 1200, 0.86)) || raw
      onSnapshot(small)
    } catch {}
  }, [onSnapshot])

  if (webglFail) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-2">
          <div className="font-bold">{t('bd3_panel_title')}</div>
          <div className="text-sm text-slate-500">{t('bd3_webgl_fail')}</div>
        </div>
      </div>
    )
  }

  const shapeBtns: [ShapeType, string, string][] = [
    ['cube', t('bd3_add_cube'), '🧊'],
    ['sphere', t('bd3_add_sphere'), '⚪'],
    ['cylinder', t('bd3_add_cyl'), '🛢️'],
    ['cone', t('bd3_add_cone'), '🔺'],
    ['pyramid', t('bd3_add_pyramid'), '📐'],
    ['prism', t('bd3_add_prism'), '🔷'],
    ['torus', t('bd3_add_torus'), '🍩'],
    ['octahedron', t('bd3_add_octa'), '💎'],
    ['plane', t('bd3_add_plane'), '▭'],
  ]

  const metrics = selInfo ? calcMetrics(selInfo.type, selInfo.size, selInfo.scaleMul) : null

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      <div
        ref={hostRef}
        className="w-full h-full bg-gradient-to-b from-sky-100 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-black"
      />

      {/* Кнопка открытия панели инструментов если свернута */}
      {!hudOpen && (
        <button
          onClick={() => setHudOpen(true)}
          title={t('bd3_panel_title')}
          aria-label={t('bd3_panel_title')}
          className="absolute top-3 left-3 z-10 px-3.5 h-11 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white"
        >
          <Shapes size={18} className="text-indigo-600 dark:text-indigo-400" />
          <span>{t('bd3_panel_title')}</span>
        </button>
      )}

      {/* Левая компактная панель инструментов */}
      {hudOpen && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-3 shadow-2xl w-[248px] max-w-[calc(100vw-24px)] max-h-[calc(100%-84px)] overflow-y-auto scrollbar-thin">
          {/* Заголовок */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400" />
              {t('bd3_panel_title')}
              {count > 0 && <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px]">{count}</span>}
            </div>
            <button
              onClick={() => setHudOpen(false)}
              title={t('a11y_close')}
              aria-label={t('a11y_close')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          {/* 3 режима работы: Выбор / Добавить фигуру / 3D-Вектор */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setTool('select')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                tool === 'select' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
              title={t('bd3_mode_select')}
            >
              <MousePointer2 size={13} /> {t('bd3_mode_select')}
            </button>
            <button
              onClick={() => setTool('place')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                tool === 'place' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
              title={t('bd3_mode_place')}
            >
              <Plus size={13} /> {t('bd3_mode_place')}
            </button>
            <button
              onClick={() => setTool('vector')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                tool === 'vector' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
              title={t('bd3_mode_vector')}
            >
              <MoveUpRight size={13} /> {t('bd3_mode_vector')}
            </button>
          </div>

          {/* Подсказка режима вектора */}
          {tool === 'vector' && (
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 text-[11px] text-amber-800 dark:text-amber-200">
              {vecStartSet ? t('bd3_vec_step2') : t('bd3_vec_step1')}
            </div>
          )}

          {/* Библиотека 9 фигур (в режиме place) */}
          {tool === 'place' && (
            <div className="grid grid-cols-3 gap-1">
              {shapeBtns.map(([ty, label, emo]) => (
                <button
                  key={ty}
                  onClick={() => setType(ty)}
                  title={label}
                  className={`py-1.5 px-1 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-0.5 transition ${
                    type === ty
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-base leading-none">{emo}</span>
                  <span className="truncate max-w-full text-[10px]">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Стиль материала: Сплошной / Стекло / Каркас */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Layers size={11} /> {t('bd3_style')}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {([
                ['solid', t('bd3_style_solid')],
                ['glass', t('bd3_style_glass')],
                ['wire', t('bd3_style_wire')],
              ] as [MatStyle, string][]).map(([stKey, stLabel]) => (
                <button
                  key={stKey}
                  onClick={() => {
                    setStyle(stKey)
                    if (sel != null) threeRef.current?.restyleSelected(stKey)
                  }}
                  className={`py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                    style === stKey
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {stLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Палитра цветов */}
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => {
                  setColor(c)
                  if (sel != null) threeRef.current?.recolorSelected(c)
                }}
                className={`w-6 h-6 rounded-full border border-black/15 transition-transform ${color === c ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : 'hover:scale-105'}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => {
                setColor(e.target.value)
                if (sel != null) threeRef.current?.recolorSelected(e.target.value)
              }}
              className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-600 cursor-pointer"
              title={t('bd3_color')}
            />
          </div>

          {/* Размер + (для выделенной фигуры) Высота Y и Поворот */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="w-14 shrink-0">{t('bd3_size')}</span>
              <input
                type="range" min={0.4} max={4.0} step={0.1} value={size}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setSize(v)
                  if (sel != null) threeRef.current?.resizeSelected(v)
                }}
                className="flex-1 accent-indigo-600"
              />
              <span className="w-7 text-right font-mono">{size.toFixed(1)}</span>
            </label>

            {sel != null && (
              <>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="w-14 shrink-0">{t('bd3_height')} Y</span>
                  <input
                    type="range" min={0} max={7} step={0.5} value={elevY}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setElevY(v)
                      threeRef.current?.elevateSelected(v)
                    }}
                    className="flex-1 accent-emerald-600"
                  />
                  <span className="w-7 text-right font-mono">{elevY.toFixed(1)}</span>
                </label>

                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="w-14 shrink-0">{t('bd3_rotate')}</span>
                  <input
                    type="range" min={0} max={360} step={15} value={rotY}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      setRotY(v)
                      threeRef.current?.rotateSelected(v)
                    }}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="w-7 text-right font-mono">{rotY}°</span>
                </label>
              </>
            )}
          </div>

          {/* Живые математические формулы для выделенной фигуры */}
          {metrics && (
            <div className="px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-[11px] space-y-0.5 font-mono text-indigo-900 dark:text-indigo-200">
              <div className="font-sans font-bold text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{t('bd3_formulas')}</div>
              <div>{metrics.formula}</div>
              <div className="font-bold">{metrics.volume}</div>
              <div>{metrics.area}</div>
            </div>
          )}

          {/* Действия над выделенной фигурой */}
          {sel != null && (
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => threeRef.current?.duplicateSelected()}
                title={t('bd3_dup')}
                className="py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100"
              >
                <Copy size={13} /> {t('bd3_dup')}
              </button>
              <button
                onClick={() => {
                  const next = (rotY + 45) % 360
                  setRotY(next)
                  threeRef.current?.rotateSelected(next)
                }}
                title="+45°"
                className="py-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-amber-100"
              >
                <RotateCw size={13} /> 45°
              </button>
              <button
                onClick={() => threeRef.current?.removeSelected()}
                title={t('bd3_del')}
                className="py-2 rounded-xl bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-700 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-rose-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}

          {/* Готовые учебные 3D-сцены */}
          <div className="relative">
            <button
              onClick={() => setPresetsOpen(v => !v)}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles size={14} /> {t('bd3_presets')}
            </button>
            {presetsOpen && (
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {([
                  ['stereometry', '📐', t('bd3_pr_stereo')],
                  ['solar', '🪐', t('bd3_pr_solar')],
                  ['molecule', '⚛️', t('bd3_pr_mol')],
                  ['vectors', '📊', t('bd3_pr_vec')],
                ] as [PresetId, string, string][]).map(([pid, emo, lbl]) => (
                  <button
                    key={pid}
                    onClick={() => threeRef.current?.loadPreset(pid)}
                    className={`p-2 rounded-xl border text-left text-[11px] font-bold flex items-center gap-1.5 transition ${
                      activePreset === pid
                        ? 'bg-indigo-100 dark:bg-indigo-900/60 border-indigo-500 text-indigo-800 dark:text-indigo-200'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{emo}</span>
                    <span className="truncate">{lbl}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Вставить снимок на 2D-доску */}
          <button
            onClick={snap}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm min-h-[40px]"
          >
            <Camera size={14} /> {t('bd3_snap')}
          </button>

          <div className="text-[10px] text-slate-400 text-center leading-tight">
            {t('bd3_shift_hint')}
          </div>
        </div>
      )}

      {/* Нижняя плавающая панель камеры и быстрых утилит */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-2 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-[calc(100vw-24px)] overflow-x-auto tab-scroll">
        {([
          ['iso', '3D'],
          ['top', t('bd3_cam_top')],
          ['front', t('bd3_cam_front')],
          ['side', t('bd3_cam_side')],
        ] as ['iso' | 'top' | 'front' | 'side', string][]).map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => threeRef.current?.setCameraView(v)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {lbl}
          </button>
        ))}

        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

        <button
          onClick={() => setSnapGrid(v => !v)}
          title={t('bd3_snap_grid')}
          className={`p-2 rounded-xl transition shrink-0 ${snapGrid ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <Magnet size={15} />
        </button>
        <button
          onClick={() => setShowGrid(v => !v)}
          title={t('bd3_grid')}
          className={`p-2 rounded-xl transition shrink-0 ${showGrid ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <Grid3X3 size={15} />
        </button>
        <button
          onClick={() => setAutoRot(v => !v)}
          title={t('fb3d_autorotate')}
          className={`p-2 rounded-xl transition shrink-0 ${autoRot ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <RefreshCw size={15} className={autoRot ? 'animate-spin' : ''} />
        </button>

        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

        <button
          onClick={() => threeRef.current?.undo()}
          title="Undo (Ctrl+Z)"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={() => threeRef.current?.setCameraView('iso')}
          title={t('bd3_reset')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
        >
          <RotateCcw size={15} />
        </button>
        <button
          onClick={() => threeRef.current?.clearAll()}
          title={t('bd3_clear_all')}
          className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 shrink-0"
        >
          <Eraser size={15} />
        </button>
      </div>
    </div>
  )
}
