import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Пропсы напрямую из FarmerBala: игровое состояние + погода (правила оставлены на родителе)
export type F3DState = {
  x: number; y: number
  grid: (null | 'carrot' | 'pumpkin')[][]
}
export type F3DWeather = 'sun' | 'rain' | 'rainbow'

const W = 6, H = 5

export default function FarmerField3D({ st, wx, stopped, celebrate }: { st: F3DState; wx: F3DWeather; stopped: boolean; celebrate: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stRef = useRef(st)
  const wxRef = useRef(wx)
  const stopRef = useRef(stopped)
  useEffect(() => { stRef.current = st }, [st])
  useEffect(() => { wxRef.current = wx }, [wx])
  useEffect(() => { stopRef.current = stopped }, [stopped])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(host.clientWidth || 480, host.clientHeight || 300)
    host.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const sky: Record<F3DWeather, number> = { sun: 0x67b7e8, rain: 0x51606e, rainbow: 0x6aa9e0 }
    const applySky = (w: F3DWeather) => { scene.background = new THREE.Color(sky[w]); scene.fog = new THREE.Fog(sky[w], 18, 42) }
    applySky(wxRef.current)

    const camera = new THREE.PerspectiveCamera(46, (host.clientWidth || 480) / (host.clientHeight || 300), 0.1, 100)
    camera.position.set(5.2, 7.6, 9.4)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(2.5, 0.2, 2)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 4
    controls.maxDistance = 22
    controls.maxPolarAngle = Math.PI / 2.15
    controls.autoRotate = !stopRef.current
    controls.autoRotateSpeed = 1.1
    controls.addEventListener('start', () => { controls.autoRotate = false })

    // свет
    const hemi = new THREE.HemisphereLight(0xffffff, 0x2f6b3c, 1.05)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffffff, 1.35)
    sun.position.set(6, 10, 4)
    scene.add(sun)

    // земля-подложка (чуть больше поля)
    const groundGeo = new THREE.BoxGeometry(W + 3.4, 0.5, H + 3.4)
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 1 }))
    ground.position.set((W - 1) / 2, -0.33, (H - 1) / 2)
    scene.add(ground)

    // клетки поля
    const tileGeo = new THREE.BoxGeometry(0.92, 0.16, 0.92)
    const tileA = new THREE.MeshStandardMaterial({ color: 0x4f9e63, roughness: 0.95 })
    const tileB = new THREE.MeshStandardMaterial({ color: 0x44935a, roughness: 0.95 })
    const tiles: THREE.Mesh[] = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const m = new THREE.Mesh(tileGeo, (x + y) % 2 ? tileB : tileA)
      m.position.set(x, 0, y)
      scene.add(m); tiles.push(m)
    }

    // фермер: роба + голова + шляпа
    const farmer = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.34, 6, 12), new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.7 }))
    body.position.y = 0.42
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf5c396, roughness: 0.6 }))
    head.position.y = 0.86
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 14), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }))
    hat.position.set(0, 1.06, 0)
    hat.rotation.y = Math.PI / 6
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 16), new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.8 }))
    brim.position.set(0, 0.94, 0)
    farmer.add(body, head, hat, brim)
    farmer.position.set(stRef.current.x, 0.08, stRef.current.y)
    scene.add(farmer)

    // морковка: конус + листик; тыква: приплюснутая сфера + плодоножка
    const carrotGeo = new THREE.ConeGeometry(0.14, 0.42, 10)
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 })
    const leafGeo = new THREE.SphereGeometry(0.09, 8, 6)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 })
    const pumpGeo = new THREE.SphereGeometry(0.27, 16, 12)
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.6 })
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.1, 8)
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 })

    type Item = { mesh: THREE.Group }
    const items = new Map<string, Item>()
    const makeCarrot = () => {
      const g = new THREE.Group()
      const c = new THREE.Mesh(carrotGeo, carrotMat); c.rotation.x = Math.PI; c.position.y = 0.32
      const l = new THREE.Mesh(leafGeo, leafMat); l.position.set(0, 0.58, 0); l.scale.set(1, 1.25, 1)
      g.add(c, l); return g
    }
    const makePumpkin = () => {
      const g = new THREE.Group()
      const p = new THREE.Mesh(pumpGeo, pumpMat); p.scale.set(1, 0.8, 1); p.position.y = 0.24
      const s = new THREE.Mesh(stemGeo, stemMat); s.position.y = 0.46
      g.add(p, s); return g
    }
    const syncItems = () => {
      const grid = stRef.current.grid
      const seen = new Set<string>()
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = grid[y]?.[x]
        const key = `${x},${y}`
        if (!c) continue
        seen.add(key)
        if (!items.has(key)) {
          const g = c === 'carrot' ? makeCarrot() : makePumpkin()
          const wxPos = x, wz = y
          g.position.set(wxPos + (x % 2 ? 0.16 : -0.16), 0.08, wz + (y % 2 ? 0.14 : -0.14))
          g.rotation.y += (Math.sin(Date.now() / 1000 + x * 7 + y) * 0.5)
          g.scale.setScalar(0.01)
          scene.add(g)
          items.set(key, { mesh: g })
        }
      }
      for (const [key, it] of Array.from(items.entries())) {
        if (!seen.has(key)) {
          scene.remove(it.mesh)
          it.mesh.traverse(o => {
            const mm = o as THREE.Mesh
            if (mm.geometry) mm.geometry.dispose()
          })
          items.delete(key)
        }
      }
    }
    syncItems()

    // конфетти (спавн по celebrate)
    type Conf = { mesh: THREE.Mesh; vel: THREE.Vector3; ttl: number; spin: number }
    const confettiRef = { cur: [] as Conf[] }
    const spawnConfetti = () => {
      const colors = [0xf43f5e, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xeab308, 0xffffff]
      for (let i = 0; i < 130; i++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, 0.02),
          new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true })
        )
        m.position.set((W - 1) / 2 + (Math.random() * 4 - 2), 3 + Math.random() * 2.5, (H - 1) / 2 + (Math.random() * 3 - 1.5))
        m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        scene.add(m)
        confettiRef.cur.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.6 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4),
          ttl: 2.2 + Math.random() * 0.8,
          spin: 4 + Math.random() * 6,
        })
      }
    }
    let celebrateOn = false
    const ivCel = setInterval(() => {
      if (celebrate && !celebrateOn) { celebrateOn = true; spawnConfetti() }
      if (!celebrate) celebrateOn = false
    }, 300)

    // погода: дождь (капли) + радуга (цветные дуги)
    let rain: THREE.Points | null = null
    let rainbow: THREE.Group | null = null
    const makeRain = () => {
      const n = 900
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = Math.random() * 22 - 8
        pos[i * 3 + 1] = Math.random() * 12
        pos[i * 3 + 2] = Math.random() * 20 - 8
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9db8cc, size: 0.09, transparent: true, opacity: 0.65 }))
      return pts
    }
    const makeRainbow = () => {
      const g = new THREE.Group()
      const colors = [0xff0000, 0xff8c00, 0xffd700, 0x32cd32, 0x1e90ff, 0x8a2be2]
      colors.forEach((col, i) => {
        const r = 6.6 - i * 0.35
        const curve = new THREE.EllipseCurve(0, 0, r, r, Math.PI * 0.08, Math.PI * 0.92)
        const pts2 = curve.getPoints(64)
        const shape = new THREE.BufferGeometry().setFromPoints(pts2.map(p => new THREE.Vector3(p.x, p.y, 0)))
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, k) => {
          const p = pts2[Math.min(k * 2, pts2.length - 1)]
          return new THREE.Vector3(p.x, p.y, 0)
        })), 32, 0.12, 6, false)
        const mesh3 = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.62 }))
        mesh3.position.set((W - 1) / 2, -0.5, -6.5)
        mesh3.rotation.y = 0
        shape.dispose()
        g.add(mesh3)
      })
      return g
    }
    const setWeather = (w: F3DWeather) => {
      applySky(w)
      if (rain) { scene.remove(rain); rain.geometry.dispose(); (rain.material as THREE.Material).dispose(); rain = null }
      if (rainbow) { scene.remove(rainbow); rainbow.children.forEach(c => { const m = c as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose() }); rainbow = null }
      if (w === 'rain') rain = makeRain()
      if (w === 'rainbow') { rain = makeRain(); rainbow = makeRainbow() }
      if (rain) scene.add(rain)
      if (rainbow) scene.add(rainbow)
    }
    setWeather(wxRef.current)

    // анимация
    let raf = 0
    const clock = new THREE.Clock()
    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.1)
      const d = stRef.current
      const tx = d.x, tz = d.y
      const hop: { t: number } = (farmer as any).__hop || { t: 0 }
      const dx = tx - farmer.position.x, dz = tz - farmer.position.z
      if (Math.abs(dx) + Math.abs(dz) > 0.02) {
        farmer.position.x += dx * 0.16
        farmer.position.z += dz * 0.16
        hop.t += dt * 16
        farmer.position.y = 0.08 + Math.abs(Math.sin(hop.t)) * 0.18
        const yaw = Math.atan2(dx, dz)
        farmer.rotation.y += (yaw - farmer.rotation.y) * 0.25
      } else {
        farmer.position.x = tx; farmer.position.z = tz
        farmer.position.y = 0.08
      }
      ;(farmer as any).__hop = hop
      farmer.rotation.y += ((Math.sin(clock.elapsedTime * 0.7) * 0.06) - farmer.rotation.y) * 0.03
      // рост новых культур
      items.forEach(it => {
        const s = it.mesh.scale.x + (1 - it.mesh.scale.x) * 0.14
        it.mesh.scale.setScalar(s)
      })
      if (rain) {
        const arr = (rain.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] -= dt * 9.5
          if (arr[i] < 0) { arr[i] = 12; arr[i - 1] = Math.random() * 22 - 8; arr[i + 1] = Math.random() * 20 - 8 }
        }
        ;(rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      }
      if (rainbow) rainbow.children.forEach((c, i) => { (c as THREE.Mesh).position.z = -6.5 + Math.sin(clock.elapsedTime * 0.8 + i) * 0.05 })
      // конфетти со временем падают и исчезают
      if (confettiRef.cur.length) {
        const keep: Conf[] = []
        for (const c of confettiRef.cur) {
          c.ttl -= dt
          c.vel.y -= dt * 4.4
          c.mesh.position.addScaledVector(c.vel, dt)
          c.mesh.rotation.x += c.spin * dt
          c.mesh.rotation.y += c.spin * dt * 0.7
          const mat = c.mesh.material as THREE.MeshBasicMaterial
          mat.opacity = Math.max(0, Math.min(1, c.ttl / 0.8))
          if (c.ttl > 0) keep.push(c)
          else {
            scene.remove(c.mesh)
            c.mesh.geometry.dispose()
            mat.dispose()
          }
        }
        confettiRef.cur = keep
      }
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    const ro = new ResizeObserver(() => {
      const w2 = host.clientWidth || 480, h2 = host.clientHeight || 300
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    })
    ro.observe(host)

    // смена погоды по пропсу
    let lastWx = wxRef.current
    const iv = setInterval(() => {
      if (wxRef.current !== lastWx) { lastWx = wxRef.current; setWeather(lastWx) }
      syncItems()
      controls.autoRotate = !stopRef.current
    }, 400)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(iv)
      clearInterval(ivCel)
      controls.dispose()
      renderer.dispose()
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose())
        else if (mat) mat.dispose()
      })
      ro.disconnect()
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-emerald-600 bg-emerald-800" data-testid="fb3d-host" style={{ minHeight: 300 }}>
      <div ref={hostRef} className="w-full h-[44vh] max-h-[420px] min-h-[240px] sm:h-[56vh] sm:min-h-[300px]" />
      <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/45 text-white text-[11px] font-bold pointer-events-none" data-testid="fb3d-hint">🧊 3D · пальцем/мышкой — вращение, щипок — зум</div>
    </div>
  )
}
