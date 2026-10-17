import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Camera, Trash2, RotateCcw, Box, Circle, Cylinder, Triangle, Square } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { compressDataUrl } from '../board/legacy'

type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'plane'
type SItem = { id: number; type: ShapeType; mesh: THREE.Mesh; size: number; colorHex: string }

const COLORS = ['#ef4444', '#3B82F6', '#22c55e', '#f59e0b', '#a855f7', '#0f172a', '#14b8a6']

export default function Board3D({ onSnapshot }: { onSnapshot: (dataUrl: string) => void }) {
  const { t } = useLang()
  const hostRef = useRef<HTMLDivElement>(null)
  const threeRef = useRef<any>(null)
  const itemsRef = useRef<SItem[]>([])
  const idRef = useRef(1)
  const [sel, setSel] = useState<number | null>(null)
  const [type, setType] = useState<ShapeType>('cube')
  const [color, setColor] = useState('#3B82F6')
  const [size, setSize] = useState(1)
  const [count, setCount] = useState(0)
  const [webglFail, setWebglFail] = useState(false)
  const selRef = useRef<number | null>(null)
  const uiRef = useRef({ type, color, size })
  uiRef.current = { type, color, size }
  const stRef = useRef(null as any)
  stRef.current = { setSel, setCount, sel, color, size }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    } catch {
      setWebglFail(true)
      return
    }
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xeef2f7)
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500)
    camera.position.set(6, 5, 8)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(host.clientWidth || 600, host.clientHeight || 400)
    renderer.domElement.style.touchAction = 'none'
    host.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 1.9
    controls.target.set(0, 1, 0)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.15))
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(6, 10, 6)
    scene.add(dir)

    const grid = new THREE.GridHelper(24, 24, 0x94a3b8, 0xcbd5e1)
    scene.add(grid)
    const axisMat = (c: number) => new THREE.LineBasicMaterial({ color: c })
    const mkAxis = (dirV: THREE.Vector3, c: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, 0), dirV])
      scene.add(new THREE.Line(g, axisMat(c)))
    }
    mkAxis(new THREE.Vector3(12, 0, 0), 0xef4444)
    mkAxis(new THREE.Vector3(0, 8, 0), 0x22c55e)
    mkAxis(new THREE.Vector3(0, 0, 12), 0x3b82f6)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const planePoint = new THREE.Vector3()
    let draggingId: number | null = null
    let downAt = 0
    let downXY = { x: 0, y: 0 }
    const activePointers = new Set<number>()

    const setPointer = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
    }
    const floorPoint = (): THREE.Vector3 | null => {
      const hit = raycaster.ray.intersectPlane(groundPlane, planePoint)
      if (hit) {
        planePoint.x = Math.max(-11, Math.min(11, planePoint.x))
        planePoint.z = Math.max(-11, Math.min(11, planePoint.z))
        return planePoint
      }
      if (Math.abs(raycaster.ray.direction.y) > 0.08) {
        raycaster.ray.at(9, planePoint)
        planePoint.y = 0
        planePoint.x = Math.max(-11, Math.min(11, planePoint.x))
        planePoint.z = Math.max(-11, Math.min(11, planePoint.z))
        return planePoint
      }
      return null
    }
    const pickMesh = () => raycaster.intersectObjects(itemsRef.current.map(i => i.mesh), false)[0]

    // ghost-предпросмотр фигуры под курсором
    const ghostGeo: Record<ShapeType, THREE.BufferGeometry> = {
      cube: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(0.5, 24, 16),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
      cone: new THREE.ConeGeometry(0.5, 1, 24),
      plane: new THREE.BoxGeometry(2, 0.06, 2),
    }
    const ghostMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, roughness: 0.5, depthWrite: false })
    const ghost = new THREE.Mesh(ghostGeo.cube, ghostMat)
    ghost.visible = false
    ghost.userData.ty = 'cube'
    scene.add(ghost)

    const onDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId)
      downAt = Date.now()
      downXY = { x: e.clientX, y: e.clientY }
      if (activePointers.size > 1) return
      if (e.button !== 0 && e.pointerType === 'mouse') return
      setPointer(e)
      const hit = pickMesh()
      if (hit) {
        const it = itemsRef.current.find(i => i.mesh === hit.object)
        if (it) {
          setSel(it.id)
          selRef.current = it.id
          draggingId = it.id
          controls.enabled = false
          try { renderer.domElement.setPointerCapture(e.pointerId) } catch {}
        }
      }
    }
    const onMove = (e: PointerEvent) => {
      setPointer(e)
      const hitM = pickMesh()
      if (draggingId != null) {
        const it = itemsRef.current.find(i => i.id === draggingId)
        const pt = floorPoint()
        if (it && pt) {
          it.mesh.position.x = pt.x
          it.mesh.position.z = pt.z
        }
        ghost.visible = false
        return
      }
      if (hitM || activePointers.size > 1) { ghost.visible = false; return }
      const ui = uiRef.current
      const pt = floorPoint()
      if (pt) {
        if (ghost.userData.ty !== ui.type) { ghost.geometry = ghostGeo[ui.type]; ghost.userData.ty = ui.type }
        ghost.scale.setScalar(ui.size)
        ghost.position.set(pt.x, ui.type === 'plane' ? 0.04 : ui.size / 2, pt.z)
        ghostMat.color = new THREE.Color(ui.color)
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
      if (Date.now() - downAt > 900) return
      if (Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y) > 12) return
      setPointer(e)
      if (pickMesh()) return
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
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    const markSel = () => {
      const cur = selRef.current
      itemsRef.current.forEach(i => {
        const m = i.mesh.material as THREE.MeshStandardMaterial
        m.emissive = new THREE.Color(i.id === cur ? i.colorHex : 0x000000)
        m.emissiveIntensity = i.id === cur ? 0.55 : 0
      })
    }

    const setSelRaw = (id: number | null) => { selRef.current = id; stRef.current.setSel(id); markSel() }

    const addItem = (x: number, z: number) => {
      const ui = uiRef.current
      const s = ui.size
      let geo: THREE.BufferGeometry
      const ty = ui.type
      if (ty === 'cube') geo = new THREE.BoxGeometry(s, s, s)
      else if (ty === 'sphere') geo = new THREE.SphereGeometry(s / 2, 32, 20)
      else if (ty === 'cylinder') geo = new THREE.CylinderGeometry(s / 2, s / 2, s, 28)
      else if (ty === 'cone') geo = new THREE.ConeGeometry(s / 2, s, 28)
      else geo = new THREE.BoxGeometry(s * 2, 0.06, s * 2)
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(ui.color), roughness: 0.45, metalness: 0.06 }))
      mesh.position.set(x, ty === 'plane' ? 0.04 : s / 2, z)
      const it: SItem = { id: idRef.current++, type: ty, mesh, size: s, colorHex: ui.color }
      itemsRef.current.push(it)
      scene.add(mesh)
      stRef.current.setCount(itemsRef.current.length)
      setSelRaw(it.id)
    }

    const api = (threeRef.current = {
      scene,
      camera,
      renderer,
      removeSelected(): number | null {
        const cur = selRef.current
        if (cur == null) return null
        const it = itemsRef.current.find(i => i.id === cur)
        if (!it) return null
        scene.remove(it.mesh)
        it.mesh.geometry.dispose()
        ;(it.mesh.material as THREE.Material).dispose()
        itemsRef.current = itemsRef.current.filter(i => i.id !== cur)
        stRef.current.setCount(itemsRef.current.length)
        setSelRaw(null)
        return cur
      },
      resizeSelected(scale: number) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        it.mesh.scale.setScalar(scale)
        if (it.type !== 'plane') it.mesh.position.y = (it.size * scale) / 2
      },
      recolorSelected(hex: string) {
        const it = itemsRef.current.find(i => i.id === selRef.current)
        if (!it) return
        ;(it.mesh.material as THREE.MeshStandardMaterial).color = new THREE.Color(hex)
        it.colorHex = hex
        markSel()
      },
      snapshot(): string {
        return renderer.domElement.toDataURL('image/png', 0.95)
      },
      zoomReset() {
        camera.position.set(6, 5, 8)
        controls.target.set(0, 1, 0)
      },
    })
    ;(window as any).__bd3 = { count: () => itemsRef.current.length, sel: () => selRef.current }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointercancel', onUp)
      controls.dispose()
      itemsRef.current.forEach(i => { i.mesh.geometry.dispose(); (i.mesh.material as THREE.Material).dispose() })
      Object.values(ghostGeo).forEach(g => g.dispose())
      ghostMat.dispose()
      renderer.dispose()
      try { host.removeChild(renderer.domElement) } catch {}
      try { delete (window as any).__bd3 } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const a = threeRef.current
    if (!a) return
    try { a.recolorSelected(color) } catch {}
  }, [color, sel])

  useEffect(() => {
    const a = threeRef.current
    if (!a) return
    if (sel != null) a.resizeSelected(size)
  }, [size])

  const del = () => { threeRef.current?.removeSelected() }
  const reset = () => { try { (threeRef.current as any).zoomReset() } catch {} }
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

  const shapeBtns: [ShapeType, string, any][] = [
    ['cube', t('bd3_add_cube'), Box],
    ['sphere', t('bd3_add_sphere'), Circle],
    ['cylinder', t('bd3_add_cyl'), Cylinder],
    ['cone', t('bd3_add_cone'), Triangle],
    ['plane', t('bd3_add_plane'), Square],
  ]

  return (
    <div className="relative w-full h-full select-none">
      <div ref={hostRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-2xl border p-2 shadow-lg max-w-[210px]">
        <div className="text-[11px] font-bold text-slate-500 px-1">{t('bd3_panel_title')}</div>
        <div className="grid grid-cols-5 gap-1">
          {shapeBtns.map(([ty, label, Icon]) => (
            <button key={ty} onClick={() => setType(ty)} title={label} className={`h-10 rounded-xl border flex items-center justify-center ${type === ty ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'}`}><Icon size={17} /></button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border ${color === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`} style={{ background: c }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-7 h-7 rounded-lg border" title={t('bd3_color')} />
        </div>
        <label className="flex items-center gap-2 px-1 text-xs text-slate-500">
          {t('bd3_size')} <input type="range" min={0.4} max={2.6} step={0.1} value={size} onChange={e => setSize(parseFloat(e.target.value))} className="flex-1 w-20" />
        </label>
        <div className="flex gap-1">
          <button onClick={del} disabled={sel == null} className="flex-1 px-2 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"><Trash2 size={14} /> {t('bd3_del')}</button>
          <button onClick={reset} className="px-2 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs flex items-center justify-center" title={t('bd3_reset')}><RotateCcw size={14} /></button>
        </div>
        <button onClick={snap} className="px-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1"><Camera size={14} /> {t('bd3_snap')}</button>
        <div className="text-[10px] text-slate-400 px-1 text-center">{count ? `${count}` : ''} {sel != null ? `• ${t('bd3_sel')}` : t('bd3_none')}</div>
      </div>
    </div>
  )
} 
