import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Maximize2, Minimize2, RotateCcw, Eye, Compass, RefreshCw } from 'lucide-react'
import { useLang } from '../context/LangContext'

export type CropKind = 'carrot' | 'pumpkin' | 'sunflower' | 'strawberry' | 'watermelon'
export type CellKind = null | CropKind | 'rock' | 'weed'
export type SoilKind = 'normal' | 'dry' | 'wet'
export type FarmerHat = 'straw' | 'crown' | 'cowboy' | 'wizard'

export type F3DState = {
  x: number
  y: number
  grid: CellKind[][]
  soil?: SoilKind[][]
  waterPulse?: number
}
export type F3DWeather = 'sun' | 'sunset' | 'rain' | 'rainbow' | 'night'
type CamPreset = 'iso' | 'follow' | 'top'

const W = 6, H = 5

function makeCoordSprite(label: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 96; c.height = 96
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
  ctx.beginPath()
  ctx.roundRect(14, 14, 68, 68, 18)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 48, 50)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sp = new THREE.Sprite(mat)
  sp.scale.set(0.42, 0.42, 1)
  return sp
}

export default function FarmerField3D({
  st,
  wx,
  stopped,
  celebrate,
  hat = 'straw',
}: {
  st: F3DState
  wx: F3DWeather
  stopped: boolean
  celebrate: boolean
  hat?: FarmerHat
}) {
  const { t } = useLang()
  const hostRef = useRef<HTMLDivElement>(null)
  const stRef = useRef(st)
  const wxRef = useRef(wx)
  const stopRef = useRef(stopped)
  const celRef = useRef(celebrate)
  const hatRef = useRef<FarmerHat>(hat)
  const [camPreset, setCamPreset] = useState<CamPreset>('iso')
  const [autoRot, setAutoRot] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const camPresetRef = useRef<CamPreset>('iso')
  const autoRotRef = useRef(false)
  const resetCamRef = useRef<(() => void) | null>(null)

  useEffect(() => { stRef.current = st }, [st])
  useEffect(() => { wxRef.current = wx }, [wx])
  useEffect(() => { stopRef.current = stopped }, [stopped])
  useEffect(() => { celRef.current = celebrate }, [celebrate])
  useEffect(() => { hatRef.current = hat }, [hat])
  useEffect(() => { camPresetRef.current = camPreset }, [camPreset])
  useEffect(() => { autoRotRef.current = autoRot }, [autoRot])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const lowEnd = ((navigator as any).hardwareConcurrency || 4) <= 4 || ((navigator as any).deviceMemory || 8) <= 4
    const renderer = new THREE.WebGLRenderer({
      antialias: !lowEnd,
      alpha: false,
      powerPreference: lowEnd ? 'low-power' : 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75))
    renderer.setSize(host.clientWidth || 520, host.clientHeight || 340)
    renderer.shadowMap.enabled = !lowEnd
    if (!lowEnd) renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    host.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const skyColors: Record<F3DWeather, { bg: number; fog: number; sunInt: number; sunCol: number; hemiInt: number; sunY: number }> = {
      sun: { bg: 0x7dd3fc, fog: 0xbae6fd, sunInt: 1.65, sunCol: 0xfffbeb, hemiInt: 0.95, sunY: 9.8 },
      sunset: { bg: 0xfb923c, fog: 0xfdba74, sunInt: 1.45, sunCol: 0xffedd5, hemiInt: 0.8, sunY: 4.5 },
      rain: { bg: 0x475569, fog: 0x64748b, sunInt: 0.65, sunCol: 0xe2e8f0, hemiInt: 0.72, sunY: 9.5 },
      rainbow: { bg: 0x60a5fa, fog: 0x93c5fd, sunInt: 1.45, sunCol: 0xfffbeb, hemiInt: 1.05, sunY: 9.2 },
      night: { bg: 0x0f172a, fog: 0x1e293b, sunInt: 0.42, sunCol: 0x93c5fd, hemiInt: 0.48, sunY: 10.2 },
    }

    const cx = (W - 1) / 2
    const cz = (H - 1) / 2

    const camera = new THREE.PerspectiveCamera(44, (host.clientWidth || 520) / (host.clientHeight || 340), 0.1, 120)
    camera.position.set(cx + 4.8, 7.2, cz + 7.4)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(cx, 0.35, cz)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 3.6
    controls.maxDistance = 24
    controls.maxPolarAngle = Math.PI / 2.12
    controls.autoRotate = false
    controls.autoRotateSpeed = 0.85
    controls.addEventListener('start', () => {
      if (autoRotRef.current) {
        autoRotRef.current = false
        setAutoRot(false)
      }
    })

    // Освещение
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x2f6b3c, 0.95)
    scene.add(hemi)

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.65)
    sunLight.position.set(cx + 8, 13, cz + 6)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(1024, 1024)
    sunLight.shadow.camera.left = -12
    sunLight.shadow.camera.right = 12
    sunLight.shadow.camera.top = 12
    sunLight.shadow.camera.bottom = -12
    sunLight.shadow.camera.near = 2
    sunLight.shadow.camera.far = 36
    sunLight.shadow.bias = -0.0008
    scene.add(sunLight)

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.35)
    rimLight.position.set(cx - 8, 6, cz - 8)
    scene.add(rimLight)

    // Солнце / Луна
    const sunOrbGroup = new THREE.Group()
    const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a })
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 16), sunCoreMat)
    const sunGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.28 })
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(1.38, 20, 16), sunGlowMat)
    sunOrbGroup.add(sunCore, sunGlow)
    sunOrbGroup.position.set(cx + 9.5, 9.8, cz - 10.5)
    scene.add(sunOrbGroup)

    // Звёзды и светлячки для ночного режима
    const starPos = new Float32Array(240 * 3)
    for (let i = 0; i < 240; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 44
      starPos[i * 3 + 1] = 8 + Math.random() * 14
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 44
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starsPts = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfef9c3, size: 0.16, transparent: true, opacity: 0.9 }))
    starsPts.visible = false
    scene.add(starsPts)

    // Светлячки у пруда и грядок ночью
    const fireflies: { mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }[] = []
    const ffGroup = new THREE.Group()
    const ffMat = new THREE.MeshBasicMaterial({ color: 0xfde047 })
    const ffGeo = new THREE.SphereGeometry(0.06, 6, 6)
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(ffGeo, ffMat)
      const bx = -1 + Math.random() * (W + 3)
      const by = 0.7 + Math.random() * 1.4
      const bz = -1 + Math.random() * (H + 2)
      m.position.set(bx, by, bz)
      ffGroup.add(m)
      fireflies.push({ mesh: m, baseX: bx, baseY: by, baseZ: bz, phase: Math.random() * Math.PI * 2 })
    }
    ffGroup.visible = false
    scene.add(ffGroup)

    // Облака
    const cloudsGroup = new THREE.Group()
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 })
    const clouds: { grp: THREE.Group; speed: number }[] = []
    const cloudSeeds = [
      [-6, 7.6, -7, 1.15],
      [2, 8.4, -8.5, 1.35],
      [9, 7.2, -5.5, 0.95],
      [-4, 8.1, 7.5, 1.0],
      [7, 8.6, 6.2, 1.1],
    ]
    cloudSeeds.forEach(([x, y, z, sc], idx) => {
      const g = new THREE.Group()
      const puffs: [number, number, number, number][] = [
        [0, 0, 0, 0.72], [-0.62, -0.08, 0.05, 0.55], [0.65, -0.06, -0.04, 0.58], [0.15, 0.28, 0.1, 0.52], [-0.28, 0.2, -0.08, 0.45]
      ]
      puffs.forEach(([px, py, pz, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), cloudMat)
        m.position.set(px, py, pz)
        g.add(m)
      })
      g.position.set(x, y, z)
      g.scale.setScalar(sc)
      cloudsGroup.add(g)
      clouds.push({ grp: g, speed: 0.18 + (idx % 3) * 0.08 })
    })
    scene.add(cloudsGroup)

    // --- ОСТРОВ ФЕРМЫ ---
    const islandGroup = new THREE.Group()
    const dirtBase = new THREE.Mesh(
      new THREE.BoxGeometry(W + 9.5, 1.2, H + 8.5),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 })
    )
    dirtBase.position.set(cx, -0.82, cz - 0.3)
    dirtBase.receiveShadow = true
    islandGroup.add(dirtBase)

    const meadow = new THREE.Mesh(
      new THREE.BoxGeometry(W + 9.8, 0.36, H + 8.8),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.95 })
    )
    meadow.position.set(cx, -0.18, cz - 0.3)
    meadow.receiveShadow = true
    islandGroup.add(meadow)

    const borderMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 })
    const frameH = 0.22, frameThick = 0.16
    const bNorth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.32, frameH, frameThick), borderMat)
    bNorth.position.set(cx, 0.06, -0.58)
    const bSouth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.32, frameH, frameThick), borderMat)
    bSouth.position.set(cx, 0.06, H - 0.42)
    const bWest = new THREE.Mesh(new THREE.BoxGeometry(frameThick, frameH, H + 0.16), borderMat)
    bWest.position.set(-0.58, 0.06, cz)
    const bEast = new THREE.Mesh(new THREE.BoxGeometry(frameThick, frameH, H + 0.16), borderMat)
    bEast.position.set(W - 0.42, 0.06, cz)
    ;[bNorth, bSouth, bWest, bEast].forEach(b => { b.castShadow = true; b.receiveShadow = true; islandGroup.add(b) })

    // 6x5 грядок (отдельные материалы для обычной / сухой / политой почвы)
    const soilGeo = new THREE.BoxGeometry(0.92, 0.14, 0.92)
    const furrowGeo = new THREE.BoxGeometry(0.84, 0.045, 0.14)
    const soilMatNormA = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.98 })
    const soilMatNormB = new THREE.MeshStandardMaterial({ color: 0x7c4616, roughness: 0.98 })
    const soilMatDry = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 1.0 })
    const soilMatWet = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.35, metalness: 0.12 })
    const furrowNorm = new THREE.MeshStandardMaterial({ color: 0x5c320d, roughness: 1 })
    const furrowDry = new THREE.MeshStandardMaterial({ color: 0xb0804e, roughness: 1 })
    const furrowWet = new THREE.MeshStandardMaterial({ color: 0x26150a, roughness: 0.3, metalness: 0.15 })

    const tileMeshes: THREE.Mesh[][] = Array.from({ length: H }, () => [])
    const furrowMeshes: THREE.Mesh[][][] = Array.from({ length: H }, () => Array.from({ length: W }, () => []))

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = new THREE.Mesh(soilGeo, (x + y) % 2 === 0 ? soilMatNormA : soilMatNormB)
        tile.position.set(x, 0.03, y)
        tile.receiveShadow = true
        islandGroup.add(tile)
        tileMeshes[y][x] = tile
        for (const fz of [-0.26, 0, 0.26]) {
          const fur = new THREE.Mesh(furrowGeo, furrowNorm)
          fur.position.set(x, 0.11, y + fz)
          fur.receiveShadow = true
          islandGroup.add(fur)
          furrowMeshes[y][x].push(fur)
        }
      }
    }

    for (let x = 0; x < W; x++) {
      const sp = makeCoordSprite(String(x))
      sp.position.set(x, 0.28, H - 0.12)
      islandGroup.add(sp)
    }
    for (let y = 0; y < H; y++) {
      const sp = makeCoordSprite(String(y))
      sp.position.set(-0.92, 0.28, y)
      islandGroup.add(sp)
    }

    const activeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.46, 28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    )
    activeRing.rotation.x = -Math.PI / 2
    activeRing.position.set(stRef.current.x, 0.145, stRef.current.y)
    islandGroup.add(activeRing)

    // Забор
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 })
    const postGeo = new THREE.BoxGeometry(0.14, 0.65, 0.14)
    const addFenceSpan = (x1: number, z1: number, x2: number, z2: number) => {
      const dist = Math.hypot(x2 - x1, z2 - z1)
      const steps = Math.max(1, Math.round(dist / 1.45))
      for (let i = 0; i <= steps; i++) {
        const k = i / steps
        const p = new THREE.Mesh(postGeo, fenceMat)
        p.position.set(x1 + (x2 - x1) * k, 0.3, z1 + (z2 - z1) * k)
        p.castShadow = true; p.receiveShadow = true
        islandGroup.add(p)
      }
      const ang = Math.atan2(x2 - x1, z2 - z1)
      for (const ry of [0.22, 0.45]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, dist), fenceMat)
        rail.position.set((x1 + x2) / 2, ry, (z1 + z2) / 2)
        rail.rotation.y = ang
        rail.castShadow = true
        islandGroup.add(rail)
      }
    }
    addFenceSpan(-1.7, -1.5, W + 0.7, -1.5)
    addFenceSpan(-1.7, -1.5, -1.7, H + 0.6)
    addFenceSpan(W + 0.7, -1.5, W + 0.7, H + 0.6)
    addFenceSpan(-1.7, H + 0.6, 1.3, H + 0.6)
    addFenceSpan(3.7, H + 0.6, W + 0.7, H + 0.6)

    // Красный амбар + фонарь на ночь
    const barn = new THREE.Group()
    const barnWall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.85, 2.0), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.75 }))
    barnWall.position.y = 0.92; barnWall.castShadow = true; barnWall.receiveShadow = true
    barn.add(barnWall)
    const roofShape = new THREE.Shape()
    roofShape.moveTo(-1.55, 0); roofShape.lineTo(0, 1.15); roofShape.lineTo(1.55, 0); roofShape.closePath()
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 2.25, bevelEnabled: false })
    roofGeo.center()
    const barnRoof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.85 }))
    barnRoof.position.set(0, 2.38, 0); barnRoof.castShadow = true
    barn.add(barnRoof)
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 })
    const doorBg = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 0.08), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }))
    doorBg.position.set(0, 0.58, 1.01)
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.09, 0.1), trimMat); bar1.position.set(0, 1.14, 1.02)
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.1), trimMat); bar2.position.set(-0.52, 0.58, 1.02)
    const bar3 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.1), trimMat); bar3.position.set(0.52, 0.58, 1.02)
    const winMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.6 })
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.1), winMat); win.position.set(0, 2.15, 1.09)
    const barnLight = new THREE.PointLight(0xfde047, 0, 10)
    barnLight.position.set(0, 2.1, 1.6)
    barn.add(doorBg, bar1, bar2, bar3, win, barnLight)
    barn.position.set(0.6, 0, -3.15)
    barn.rotation.y = 0.16
    islandGroup.add(barn)

    // Ветряная мельница
    const mill = new THREE.Group()
    const millTower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 2.7, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 }))
    millTower.position.y = 1.35; millTower.castShadow = true; millTower.receiveShadow = true
    const millCap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 }))
    millCap.position.y = 3.05; millCap.castShadow = true
    mill.add(millTower, millCap)
    const blades = new THREE.Group()
    blades.position.set(0, 2.45, 0.55)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.25, 12), borderMat)
    hub.rotation.x = Math.PI / 2; blades.add(hub)
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.75, side: THREE.DoubleSide })
    for (let k = 0; k < 4; k++) {
      const armGrp = new THREE.Group()
      armGrp.rotation.z = (k * Math.PI) / 2
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.55, 0.06), borderMat); spar.position.y = 0.82
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.15, 0.03), sailMat); sail.position.set(0.2, 0.96, 0.02); sail.castShadow = true
      armGrp.add(spar, sail); blades.add(armGrp)
    }
    mill.add(blades); mill.position.set(5.4, 0, -3.05); mill.rotation.y = -0.3
    islandGroup.add(mill)

    // Пруд с кувшинками
    const pond = new THREE.Group()
    const pondWater = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.25 }))
    pondWater.position.y = 0.02; pondWater.receiveShadow = true
    const pondRim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 10, 24), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }))
    pondRim.rotation.x = Math.PI / 2; pondRim.position.y = 0.04
    pond.add(pondWater, pondRim)
    for (const [lx, lz, lr] of [[-0.4, 0.2, 0.24], [0.35, -0.3, 0.2], [0.1, 0.45, 0.17]]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 }))
      pad.position.set(lx, 0.065, lz); pond.add(pad)
    }
    pond.position.set(W + 2.35, 0, 2.3)
    islandGroup.add(pond)

    // Стоги сена
    const hayMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.95 })
    for (const [hx, hz, rot] of [[3.2, -2.8, 0.4], [3.85, -2.55, 1.1], [3.5, -2.7, 0.2]]) {
      const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.56, 12), hayMat)
      bale.rotation.z = Math.PI / 2; bale.rotation.y = rot
      bale.position.set(hx, hx === 3.5 ? 0.85 : 0.34, hz); bale.castShadow = true; bale.receiveShadow = true
      islandGroup.add(bale)
    }

    // Деревья и цветы
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 })
    const pineMat1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 })
    const pineMat2 = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 })
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
    const addPine = (x: number, z: number, sc = 1) => {
      const g = new THREE.Group()
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.85, 8), trunkMat); tr.position.y = 0.42; tr.castShadow = true
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.05, 8), pineMat1); c1.position.y = 1.2; c1.castShadow = true
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.9, 8), pineMat2); c2.position.y = 1.8; c2.castShadow = true
      const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.72, 8), pineMat1); c3.position.y = 2.3; c3.castShadow = true
      g.add(tr, c1, c2, c3); g.position.set(x, 0, z); g.scale.setScalar(sc); islandGroup.add(g)
    }
    const addAppleTree = (x: number, z: number, sc = 1) => {
      const g = new THREE.Group()
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.95, 8), trunkMat); tr.position.y = 0.48; tr.castShadow = true
      const cr1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.76, 1), pineMat2); cr1.position.y = 1.45; cr1.castShadow = true
      const cr2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 1), pineMat1); cr2.position.set(0.35, 1.35, 0.25); cr2.castShadow = true
      g.add(tr, cr1, cr2)
      for (const [ax, ay, az] of [[0.5, 1.4, 0.5], [-0.45, 1.55, 0.4], [0.1, 1.75, -0.5]]) {
        const ap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), appleMat); ap.position.set(ax, ay, az); g.add(ap)
      }
      g.position.set(x, 0, z); g.scale.setScalar(sc); islandGroup.add(g)
    }
    addPine(-2.8, -3.0, 1.1); addPine(-3.3, -1.2, 0.85); addAppleTree(-3.0, 1.8, 1.0); addPine(-2.7, 4.4, 0.95)
    addAppleTree(W + 2.5, -2.5, 1.05); addPine(W + 2.7, 0.1, 0.85); addPine(W + 2.2, 4.7, 0.92)
    const flowerCols = [0xf43f5e, 0xfacc15, 0xc084fc, 0xffffff]
    const flowerGeo = new THREE.SphereGeometry(0.08, 6, 6)
    for (let i = 0; i < 24; i++) {
      const fx = i < 12 ? -2.4 - (i % 3) * 0.45 : W + 1.2 + (i % 3) * 0.45
      const fz = -1.2 + ((i * 1.37) % 6.2)
      const fl = new THREE.Mesh(flowerGeo, new THREE.MeshStandardMaterial({ color: flowerCols[i % flowerCols.length], roughness: 0.6 }))
      fl.position.set(fx, 0.08, fz); islandGroup.add(fl)
    }
    scene.add(islandGroup)

    // --- ФЕРМЕР "БАЛА" + СМЕННЫЕ ШЛЯПЫ ---
    const farmer = new THREE.Group()
    const overallMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.72 })
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 })
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd5b5, roughness: 0.55 })
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 })
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a })

    const leftLeg = new THREE.Group(); leftLeg.position.set(-0.11, 0.24, 0)
    const lLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 4, 8), overallMat); lLegMesh.position.y = -0.1; lLegMesh.castShadow = true
    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.2), bootMat); lBoot.position.set(0, -0.2, 0.03); lBoot.castShadow = true
    leftLeg.add(lLegMesh, lBoot)

    const rightLeg = new THREE.Group(); rightLeg.position.set(0.11, 0.24, 0)
    const rLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 4, 8), overallMat); rLegMesh.position.y = -0.1; rLegMesh.castShadow = true
    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.2), bootMat); rBoot.position.set(0, -0.2, 0.03); rBoot.castShadow = true
    rightLeg.add(rLegMesh, rBoot)

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.26, 6, 12), shirtMat); torso.position.y = 0.5; torso.castShadow = true
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.34), overallMat); bib.position.y = 0.42; bib.castShadow = true

    const leftArm = new THREE.Group(); leftArm.position.set(-0.26, 0.58, 0)
    const lArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 4, 8), shirtMat); lArmMesh.position.y = -0.12; lArmMesh.castShadow = true
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat); lHand.position.y = -0.26
    leftArm.add(lArmMesh, lHand)

    const rightArm = new THREE.Group(); rightArm.position.set(0.26, 0.58, 0)
    const rArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 4, 8), shirtMat); rArmMesh.position.y = -0.12; rArmMesh.castShadow = true
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat); rHand.position.y = -0.26
    rightArm.add(rArmMesh, rHand)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skinMat); head.position.y = 0.88; head.castShadow = true
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat); eyeL.position.set(-0.075, 0.91, 0.19)
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat); eyeR.position.set(0.075, 0.91, 0.19)
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.55 })
    const chL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), cheekMat); chL.position.set(-0.13, 0.85, 0.16)
    const chR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), cheekMat); chR.position.set(0.13, 0.85, 0.16)

    // 4 шляпы фермера
    const hatStraw = new THREE.Group()
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.82 })
    const brimS = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.42, 0.05, 20), strawMat); brimS.position.y = 1.04; brimS.castShadow = true
    const crownS = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 16), strawMat); crownS.position.y = 1.15; crownS.castShadow = true
    const ribbonS = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.248, 0.055, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })); ribbonS.position.y = 1.07
    hatStraw.add(brimS, crownS, ribbonS)

    const hatCrown = new THREE.Group()
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.85 })
    const cBand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.21, 0.14, 16), goldMat); cBand.position.y = 1.08; cBand.castShadow = true
    hatCrown.add(cBand)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      const spk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), goldMat)
      spk.position.set(Math.cos(a) * 0.18, 1.2, Math.sin(a) * 0.18)
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xef4444 : 0x3b82f6, emissive: 0x222222 }))
      gem.position.set(Math.cos(a) * 0.21, 1.09, Math.sin(a) * 0.21)
      hatCrown.add(spk, gem)
    }

    const hatCowboy = new THREE.Group()
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 })
    const cBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 18), leatherMat); cBrim.position.y = 1.04; cBrim.scale.set(1.1, 1, 0.85); cBrim.castShadow = true
    const cTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.36), leatherMat); cTop.position.y = 1.16; cTop.castShadow = true
    const cStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), goldMat); cStar.position.set(0, 1.15, 0.19)
    hatCowboy.add(cBrim, cTop, cStar)

    const hatWizard = new THREE.Group()
    const wizMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.55 })
    const wBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.04, 20), wizMat); wBrim.position.y = 1.04; wBrim.castShadow = true
    const wCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.56, 16), wizMat); wCone.position.set(0, 1.32, -0.04); wCone.rotation.x = -0.18; wCone.castShadow = true
    const wBand = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.245, 0.06, 16), goldMat); wBand.position.y = 1.08
    hatWizard.add(wBrim, wCone, wBand)

    const hatsMap: Record<FarmerHat, THREE.Group> = {
      straw: hatStraw,
      crown: hatCrown,
      cowboy: hatCowboy,
      wizard: hatWizard,
    }
    Object.entries(hatsMap).forEach(([k, grp]) => { grp.visible = k === hatRef.current; farmer.add(grp) })

    farmer.add(leftLeg, rightLeg, torso, bib, leftArm, rightArm, head, eyeL, eyeR, chL, chR)
    farmer.position.set(stRef.current.x, 0.12, stRef.current.y)
    scene.add(farmer)

    // --- КУЛЬТУРЫ И ПРЕПЯТСТВИЯ ---
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.58 })
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 })
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 })
    const moundMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 1 })
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.52 })
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })
    const seedCenterMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 })
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 })
    const melonMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 })
    const melonStripeMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 })
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, flatShading: true })
    const weedMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85 })
    const weedThornMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.7 })

    const makeCarrot = () => {
      const g = new THREE.Group()
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), moundMat); mound.scale.set(1, 0.35, 1); mound.position.y = 0.03
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 12), carrotMat); root.rotation.x = Math.PI; root.position.y = 0.24; root.castShadow = true
      g.add(mound, root)
      for (let i = 0; i < 5; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 6), i % 2 ? leafMat1 : leafMat2)
        const a = (i / 5) * Math.PI * 2
        frond.position.set(Math.cos(a) * 0.06, 0.52, Math.sin(a) * 0.06)
        frond.rotation.z = Math.cos(a) * 0.38; frond.rotation.x = Math.sin(a) * 0.38; frond.castShadow = true
        g.add(frond)
      }
      return g
    }

    const makePumpkin = () => {
      const g = new THREE.Group()
      const lobeGeo = new THREE.SphereGeometry(0.22, 14, 10)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const lobe = new THREE.Mesh(lobeGeo, pumpMat)
        lobe.scale.set(0.75, 0.85, 0.95); lobe.position.set(Math.cos(a) * 0.11, 0.22, Math.sin(a) * 0.11)
        lobe.castShadow = true; lobe.receiveShadow = true; g.add(lobe)
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.16, 8), stemMat); stem.position.set(0.02, 0.44, 0); stem.rotation.z = -0.22; stem.castShadow = true
      const vineLeaf = new THREE.Mesh(new THREE.CircleGeometry(0.14, 8), leafMat2); vineLeaf.rotation.x = -Math.PI / 2 + 0.2; vineLeaf.position.set(-0.22, 0.08, 0.2)
      g.add(stem, vineLeaf)
      return g
    }

    const makeSunflower = () => {
      const g = new THREE.Group()
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.68, 8), stemMat)
      stalk.position.y = 0.34; stalk.castShadow = true
      const leafL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), leafMat2); leafL.scale.set(1.2, 0.25, 0.7); leafL.position.set(-0.14, 0.28, 0); leafL.rotation.z = 0.35
      const leafR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), leafMat1); leafR.scale.set(1.2, 0.25, 0.7); leafR.position.set(0.14, 0.4, 0); leafR.rotation.z = -0.35
      const headGrp = new THREE.Group(); headGrp.position.set(0, 0.72, 0.04); headGrp.rotation.x = 0.22
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), seedCenterMat); center.rotation.x = Math.PI / 2; center.castShadow = true
      headGrp.add(center)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        const pet = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), petalMat)
        pet.scale.set(0.7, 1.35, 0.3)
        pet.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0)
        pet.rotation.z = a - Math.PI / 2
        headGrp.add(pet)
      }
      g.add(stalk, leafL, leafR, headGrp)
      return g
    }

    const makeStrawberry = () => {
      const g = new THREE.Group()
      const bush1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), leafMat2); bush1.position.set(0, 0.2, 0); bush1.scale.set(1.15, 0.75, 1.15); bush1.castShadow = true
      const bush2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), leafMat1); bush2.position.set(0.12, 0.24, 0.08); bush2.castShadow = true
      g.add(bush1, bush2)
      const coords: [number, number, number][] = [[0.2, 0.22, 0.18], [-0.2, 0.2, 0.14], [0.05, 0.34, -0.14], [-0.12, 0.26, -0.18], [0.18, 0.16, -0.12]]
      for (const [bx, by, bz] of coords) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 8), berryMat)
        b.rotation.x = Math.PI; b.position.set(bx, by, bz); b.castShadow = true
        g.add(b)
      }
      return g
    }

    const makeWatermelon = () => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), melonMat)
      body.scale.set(1.18, 0.9, 0.95); body.position.y = 0.25; body.castShadow = true; body.receiveShadow = true
      g.add(body)
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.028, 6, 18), melonStripeMat)
        ring.rotation.y = (i / 4) * Math.PI
        ring.scale.set(1.16, 0.9, 0.95); ring.position.y = 0.25
        g.add(ring)
      }
      const curl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.14, 6), stemMat); curl.position.set(0.28, 0.38, 0); curl.rotation.z = -0.7
      g.add(curl)
      return g
    }

    const makeRock = () => {
      const g = new THREE.Group()
      const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), rockMat); r1.scale.set(1.1, 0.78, 0.95); r1.position.y = 0.22; r1.castShadow = true; r1.receiveShadow = true
      const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), rockMat); r2.position.set(0.2, 0.14, 0.14); r2.castShadow = true
      g.add(r1, r2)
      return g
    }

    const makeWeed = () => {
      const g = new THREE.Group()
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42 + (i % 2) * 0.12, 5), i % 3 === 0 ? weedThornMat : weedMat)
        blade.position.set(Math.cos(a) * 0.14, 0.22, Math.sin(a) * 0.14)
        blade.rotation.z = -Math.cos(a) * 0.45
        blade.rotation.x = Math.sin(a) * 0.45
        blade.castShadow = true
        g.add(blade)
      }
      return g
    }

    const makeCellObj = (kind: Exclude<CellKind, null>): THREE.Group => {
      switch (kind) {
        case 'carrot': return makeCarrot()
        case 'pumpkin': return makePumpkin()
        case 'sunflower': return makeSunflower()
        case 'strawberry': return makeStrawberry()
        case 'watermelon': return makeWatermelon()
        case 'rock': return makeRock()
        case 'weed': return makeWeed()
      }
    }

    // --- ЧАСТИЦЫ ---
    type Particle = { mesh: THREE.Mesh; vel: THREE.Vector3; ttl: number; maxTtl: number; spin: number; gravity: number }
    const particles: Particle[] = []
    const burstGeo = new THREE.DodecahedronGeometry(0.07, 0)
    const spawnBurst = (x: number, z: number, colors: number[], count = 16) => {
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }))
        m.position.set(x, 0.35, z)
        scene.add(m)
        const ang = Math.random() * Math.PI * 2
        const spd = 0.8 + Math.random() * 1.9
        particles.push({
          mesh: m,
          vel: new THREE.Vector3(Math.cos(ang) * spd, 2.2 + Math.random() * 2.1, Math.sin(ang) * spd),
          ttl: 0.75 + Math.random() * 0.35,
          maxTtl: 1.0,
          spin: 5 + Math.random() * 7,
          gravity: 6.5,
        })
      }
    }

    const spawnConfetti = () => {
      const colors = [0xf43f5e, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xeab308, 0xffffff]
      const cGeo = new THREE.BoxGeometry(0.13, 0.13, 0.02)
      for (let i = 0; i < 140; i++) {
        const m = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }))
        m.position.set(cx + (Math.random() * 5 - 2.5), 3.4 + Math.random() * 2.4, cz + (Math.random() * 4 - 2))
        m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        scene.add(m)
        particles.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 2.8, 1.4 + Math.random() * 2.3, (Math.random() - 0.5) * 2.8),
          ttl: 2.4 + Math.random() * 0.9,
          maxTtl: 3.3,
          spin: 4 + Math.random() * 6,
          gravity: 4.0,
        })
      }
    }

    type Item = { mesh: THREE.Group; kind: Exclude<CellKind, null>; x: number; y: number }
    const items = new Map<string, Item>()

    const syncSoil = () => {
      const soil = stRef.current.soil
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const s: SoilKind = soil?.[y]?.[x] || 'normal'
          tileMeshes[y][x].material = s === 'dry' ? soilMatDry : s === 'wet' ? soilMatWet : ((x + y) % 2 === 0 ? soilMatNormA : soilMatNormB)
          const fMat = s === 'dry' ? furrowDry : s === 'wet' ? furrowWet : furrowNorm
          for (const fur of furrowMeshes[y][x]) fur.material = fMat
        }
      }
    }

    const syncItems = (initial = false) => {
      const grid = stRef.current.grid
      const seen = new Set<string>()
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = grid[y]?.[x]
          const key = `${x},${y}`
          if (!c) continue
          seen.add(key)
          const existing = items.get(key)
          if (!existing || existing.kind !== c) {
            if (existing) { scene.remove(existing.mesh); items.delete(key) }
            const g = makeCellObj(c)
            g.position.set(x, 0.1, y)
            g.rotation.y = (x * 1.3 + y * 2.1) % (Math.PI * 2)
            g.scale.setScalar(initial ? 1 : 0.01)
            scene.add(g)
            items.set(key, { mesh: g, kind: c, x, y })
            if (!initial) spawnBurst(x, y, [0x78350f, 0x22c55e, 0x4ade80], 12)
          }
        }
      }
      for (const [key, it] of Array.from(items.entries())) {
        if (!seen.has(key)) {
          const cols =
            it.kind === 'weed' ? [0x4d7c0f, 0xa855f7, 0x84cc16] :
            it.kind === 'sunflower' ? [0xfacc15, 0xfef08a, 0x22c55e] :
            it.kind === 'strawberry' ? [0xf43f5e, 0xfb7185, 0xfde047] :
            it.kind === 'watermelon' ? [0x22c55e, 0xf43f5e, 0xfef08a] :
            it.kind === 'pumpkin' ? [0xfb923c, 0xfef08a, 0xc084fc] :
            [0xf97316, 0xfde047, 0x22c55e]
          spawnBurst(it.x, it.y, cols, 18)
          scene.remove(it.mesh)
          items.delete(key)
        }
      }
    }
    syncSoil()
    syncItems(true)

    // Погода: дождь + радуга
    let rain: THREE.Points | null = null
    let rainbow: THREE.Group | null = null

    const makeRain = () => {
      const n = 1000
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = Math.random() * 24 - 9
        pos[i * 3 + 1] = Math.random() * 13
        pos[i * 3 + 2] = Math.random() * 22 - 9
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.1, transparent: true, opacity: 0.72 }))
    }

    const makeRainbow = () => {
      const g = new THREE.Group()
      const colors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6]
      colors.forEach((col, i) => {
        const r = 7.4 - i * 0.34
        const curve = new THREE.EllipseCurve(0, 0, r, r, Math.PI * 0.06, Math.PI * 0.94)
        const pts2 = curve.getPoints(48)
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2.map(p => new THREE.Vector3(p.x, p.y, 0))), 40, 0.14, 8, false)
        const m = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.68 }))
        m.position.set(cx, -0.4, -7.2)
        g.add(m)
      })
      return g
    }

    const applyWeather = (w: F3DWeather) => {
      const cfg = skyColors[w]
      scene.background = new THREE.Color(cfg.bg)
      scene.fog = new THREE.Fog(cfg.fog, 19, 46)
      sunLight.intensity = cfg.sunInt
      sunLight.color.setHex(cfg.sunCol)
      hemi.intensity = cfg.hemiInt
      sunOrbGroup.visible = w !== 'rain'
      sunOrbGroup.position.y = cfg.sunY
      sunCoreMat.color.setHex(w === 'night' ? 0xe2e8f0 : w === 'sunset' ? 0xf97316 : 0xfef08a)
      sunGlowMat.color.setHex(w === 'night' ? 0x93c5fd : w === 'sunset' ? 0xfb923c : 0xfde047)
      cloudMat.color.setHex(w === 'rain' ? 0x94a3b8 : w === 'night' ? 0x334155 : w === 'sunset' ? 0xfed7aa : 0xffffff)
      starsPts.visible = w === 'night'
      ffGroup.visible = w === 'night'
      barnLight.intensity = w === 'night' ? 2.4 : w === 'sunset' ? 0.8 : 0
      winMat.emissiveIntensity = w === 'night' ? 1.8 : 0.5

      if (rain) { scene.remove(rain); rain.geometry.dispose(); (rain.material as THREE.Material).dispose(); rain = null }
      if (rainbow) {
        scene.remove(rainbow)
        rainbow.children.forEach(c => { const mm = c as THREE.Mesh; mm.geometry.dispose(); (mm.material as THREE.Material).dispose() })
        rainbow = null
      }
      if (w === 'rain') rain = makeRain()
      if (w === 'rainbow') { rain = makeRain(); rainbow = makeRainbow() }
      if (rain) scene.add(rain)
      if (rainbow) scene.add(rainbow)
    }
    applyWeather(wxRef.current)

    const applyCameraPreset = (preset: CamPreset) => {
      if (preset === 'iso') {
        camera.position.set(cx + 4.8, 7.2, cz + 7.4)
        controls.target.set(cx, 0.35, cz)
      } else if (preset === 'top') {
        camera.position.set(cx, 11.2, cz + 1.2)
        controls.target.set(cx, 0, cz)
      } else if (preset === 'follow') {
        camera.position.set(farmer.position.x + 2.4, 3.8, farmer.position.z + 4.0)
        controls.target.set(farmer.position.x, 0.65, farmer.position.z)
      }
      controls.update()
    }
    resetCamRef.current = () => applyCameraPreset(camPresetRef.current)

    let raf = 0
    let lastWx = wxRef.current
    let lastHat = hatRef.current
    let lastPreset = camPresetRef.current
    let lastWaterPulse = stRef.current.waterPulse || 0
    let celebrateFired = false
    let walkPhase = 0
    const clock = new THREE.Clock()

    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.08)
      const elapsed = clock.elapsedTime

      if (wxRef.current !== lastWx) { lastWx = wxRef.current; applyWeather(lastWx) }
      if (hatRef.current !== lastHat) {
        lastHat = hatRef.current
        Object.entries(hatsMap).forEach(([k, grp]) => { grp.visible = k === lastHat })
      }
      if (camPresetRef.current !== lastPreset) {
        lastPreset = camPresetRef.current
        applyCameraPreset(lastPreset)
      }
      controls.autoRotate = autoRotRef.current && !stopRef.current && camPresetRef.current !== 'follow'

      syncSoil()
      syncItems(false)

      // Брызги воды при вызове water()
      const wp = stRef.current.waterPulse || 0
      if (wp !== lastWaterPulse) {
        lastWaterPulse = wp
        spawnBurst(stRef.current.x, stRef.current.y, [0x38bdf8, 0x7dd3fc, 0x0ea5e9, 0xe0f2fe], 22)
      }

      if (celRef.current && !celebrateFired) { celebrateFired = true; spawnConfetti() }
      if (!celRef.current) celebrateFired = false

      const d = stRef.current
      const tx = d.x, tz = d.y
      const dx = tx - farmer.position.x
      const dz = tz - farmer.position.z
      const dist = Math.hypot(dx, dz)

      if (dist > 0.025) {
        farmer.position.x += dx * Math.min(1, dt * 11)
        farmer.position.z += dz * Math.min(1, dt * 11)
        walkPhase += dt * 18
        // Если прыгает на 2 клетки — дуга выше!
        const jumpHeight = dist > 1.1 ? 0.65 : 0.22
        farmer.position.y = 0.12 + Math.abs(Math.sin(walkPhase)) * jumpHeight
        const swing = Math.sin(walkPhase) * 0.65
        leftLeg.rotation.x = swing
        rightLeg.rotation.x = -swing
        leftArm.rotation.x = -swing * 0.9
        rightArm.rotation.x = swing * 0.9
        const targetYaw = Math.atan2(dx, dz)
        let diff = targetYaw - farmer.rotation.y
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        farmer.rotation.y += diff * Math.min(1, dt * 14)
      } else {
        farmer.position.x = tx
        farmer.position.z = tz
        if (celRef.current) {
          farmer.position.y = 0.12 + Math.abs(Math.sin(elapsed * 7)) * 0.36
          leftArm.rotation.x = -2.3 + Math.sin(elapsed * 9) * 0.25
          rightArm.rotation.x = -2.3 - Math.sin(elapsed * 9) * 0.25
          farmer.rotation.y += dt * 2.2
        } else {
          farmer.position.y = 0.12 + Math.sin(elapsed * 2.5) * 0.015
          leftLeg.rotation.x *= 0.82
          rightLeg.rotation.x *= 0.82
          leftArm.rotation.x *= 0.82
          rightArm.rotation.x *= 0.82
        }
      }

      activeRing.position.set(farmer.position.x, 0.145, farmer.position.z)
      activeRing.scale.setScalar(1 + Math.sin(elapsed * 4.5) * 0.06)

      if (camPresetRef.current === 'follow') {
        const wantTarget = new THREE.Vector3(farmer.position.x, 0.65, farmer.position.z)
        controls.target.lerp(wantTarget, Math.min(1, dt * 6))
        const wantPos = new THREE.Vector3(farmer.position.x + 2.4, 3.8, farmer.position.z + 4.1)
        camera.position.lerp(wantPos, Math.min(1, dt * 4))
      }

      blades.rotation.z -= dt * (lastWx === 'rain' ? 1.8 : 0.85)
      sunGlow.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.07)

      for (const cl of clouds) {
        cl.grp.position.x += cl.speed * dt
        if (cl.grp.position.x > 13) cl.grp.position.x = -10
      }

      if (ffGroup.visible) {
        for (const f of fireflies) {
          f.mesh.position.x = f.baseX + Math.sin(elapsed * 1.4 + f.phase) * 0.35
          f.mesh.position.y = f.baseY + Math.sin(elapsed * 2.3 + f.phase) * 0.22
          f.mesh.position.z = f.baseZ + Math.cos(elapsed * 1.2 + f.phase) * 0.35
        }
      }

      items.forEach(it => {
        const s = it.mesh.scale.x + (1 - it.mesh.scale.x) * Math.min(1, dt * 10)
        it.mesh.scale.setScalar(s)
        if (it.kind !== 'rock') {
          it.mesh.rotation.z = Math.sin(elapsed * 2.2 + it.x * 1.5 + it.y) * 0.045
        }
      })

      if (rain) {
        const arr = (rain.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] -= dt * 12
          arr[i - 1] -= dt * 1.5
          if (arr[i] < 0) {
            arr[i] = 12 + Math.random() * 2
            arr[i - 1] = Math.random() * 24 - 9
            arr[i + 1] = Math.random() * 22 - 9
          }
        }
        ;(rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      }

      if (rainbow) {
        rainbow.children.forEach((c, i) => {
          (c as THREE.Mesh).position.z = -7.2 + Math.sin(elapsed * 0.9 + i * 0.5) * 0.06
        })
      }

      if (particles.length) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.ttl -= dt
          p.vel.y -= dt * p.gravity
          p.mesh.position.addScaledVector(p.vel, dt)
          p.mesh.rotation.x += p.spin * dt
          p.mesh.rotation.y += p.spin * dt * 0.7
          const mat = p.mesh.material as THREE.MeshBasicMaterial
          mat.opacity = Math.max(0, Math.min(1, p.ttl / (p.maxTtl * 0.45)))
          if (p.ttl <= 0) {
            scene.remove(p.mesh)
            mat.dispose()
            particles.splice(i, 1)
          }
        }
      }

      controls.update()
      renderer.render(scene, camera)
      if (!document.hidden) raf = requestAnimationFrame(animate)
      else raf = 0
    }
    const onVis = () => {
      if (!document.hidden && !raf) {
        clock.getDelta()
        raf = requestAnimationFrame(animate)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(animate)

    const ro = new ResizeObserver(() => {
      const w2 = host.clientWidth || 520
      const h2 = host.clientHeight || 340
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    })
    ro.observe(host)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      burstGeo.dispose()
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose())
        else if (mat) mat.dispose()
      })
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      className="relative rounded-2xl overflow-hidden border-2 border-emerald-400/50 bg-sky-900 shadow-2xl"
      data-testid="fb3d-host"
      style={{ minHeight: expanded ? 460 : 320 }}
    >
      <div
        ref={hostRef}
        className={expanded ? 'w-full h-[64vh] min-h-[440px]' : 'w-full h-[46vh] max-h-[450px] min-h-[300px] sm:h-[52vh]'}
      />

      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
        <span className="px-2.5 py-1 rounded-xl bg-slate-900/70 backdrop-blur-md text-amber-300 text-xs font-mono font-bold border border-white/15 shadow">
          🧑‍🌾 x={st.x}, y={st.y}
        </span>
        <span
          className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/60 backdrop-blur-md text-white/90 text-[11px] font-medium border border-white/10"
          data-testid="fb3d-hint"
        >
          {t('fb3d_hint')}
        </span>
      </div>

      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1 bg-slate-900/75 backdrop-blur-md p-1 rounded-xl border border-white/15 pointer-events-auto shadow-lg">
          {([
            ['iso', t('fb3d_cam_iso'), Compass],
            ['follow', t('fb3d_cam_follow'), Eye],
            ['top', t('fb3d_cam_top'), Maximize2],
          ] as [CamPreset, string, any][]).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCamPreset(key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                camPreset === key
                  ? 'bg-amber-400 text-emerald-950 shadow'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-slate-900/75 backdrop-blur-md p-1 rounded-xl border border-white/15 pointer-events-auto shadow-lg">
          <button
            type="button"
            onClick={() => setAutoRot(v => !v)}
            title={t('fb3d_autorotate')}
            className={`p-1.5 rounded-lg text-xs transition ${
              autoRot ? 'bg-emerald-500 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <RefreshCw size={14} className={autoRot ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => resetCamRef.current?.()}
            title={t('bd3_reset')}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            title={expanded ? t('vsc_min') : t('vsc_maximize')}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
