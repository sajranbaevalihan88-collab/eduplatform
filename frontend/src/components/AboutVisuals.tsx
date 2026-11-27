import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Кинематографические CSS-кейфреймы для лендинга EduPlatform:
 * бегущая строка marquee, плавные клип-шторки, пружинные переходы.
 */
export function FlagshipMotionStyles() {
  return (
    <style>{`
      @keyframes eduMarquee {
        0% { transform: translate3d(0, 0, 0); }
        100% { transform: translate3d(-50%, 0, 0); }
      }
      @keyframes eduClipWipe {
        0% {
          opacity: 0;
          clip-path: inset(10% 0% 0% 0% round 24px);
          transform: scale(1.045);
        }
        100% {
          opacity: 1;
          clip-path: inset(0% 0% 0% 0% round 24px);
          transform: scale(1);
        }
      }
      @keyframes eduFadeRise {
        0% { opacity: 0; transform: translate3d(0, 18px, 0); }
        100% { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      @keyframes eduSoftGlow {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.7; }
        50% { transform: translate3d(2%, -3%, 0) scale(1.08); opacity: 0.95; }
      }
      @keyframes eduCapFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-4.5px); }
      }
      @keyframes eduTasselSway {
        0%, 100% { transform: rotate(-6deg); }
        50% { transform: rotate(7deg); }
      }
      @keyframes eduBracketLeft {
        0%, 100% { transform: translateX(0px); }
        50% { transform: translateX(-3px); }
      }
      @keyframes eduBracketRight {
        0%, 100% { transform: translateX(0px); }
        50% { transform: translateX(3px); }
      }
      @keyframes eduPuzzleOrbitA {
        0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
        50% { transform: translate(-2.5px, -4px) rotate(-7deg); }
      }
      @keyframes eduPuzzleOrbitB {
        0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
        50% { transform: translate(2.5px, 4px) rotate(7deg); }
      }
      @keyframes eduDotTyping {
        0%, 60%, 100% { opacity: 0.35; transform: translateY(0px); }
        30% { opacity: 1; transform: translateY(-1.3px); }
      }
      @keyframes eduRingSpinA {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes eduRingSpinB {
        from { transform: rotate(360deg); }
        to { transform: rotate(0deg); }
      }
      /* ===== MOJANG-STYLE 2D STUDIO LOGO + WORDMARK CHOREOGRAPHY ===== */
      @keyframes eduStudioPulse {
        0% { transform: scale(0.35); opacity: 0; }
        35% { opacity: 0.7; }
        100% { transform: scale(1.65); opacity: 0; }
      }
      @keyframes eduStudioBracketL {
        0% { transform: translateX(22px) scale(0.4); opacity: 0; }
        68% { transform: translateX(-4px) scale(1.06); opacity: 1; }
        100% { transform: translateX(0px) scale(1); opacity: 1; }
      }
      @keyframes eduStudioBracketR {
        0% { transform: translateX(-22px) scale(0.4); opacity: 0; }
        68% { transform: translateX(4px) scale(1.06); opacity: 1; }
        100% { transform: translateX(0px) scale(1); opacity: 1; }
      }
      @keyframes eduStudioCapDrop {
        0% { transform: translateY(-26px) scale(0.45) rotate(-14deg); opacity: 0; }
        65% { transform: translateY(3px) scale(1.08) rotate(3deg); opacity: 1; }
        100% { transform: translateY(0px) scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes eduStudioTasselDrop {
        0% { transform: scaleY(0) rotate(-25deg); opacity: 0; }
        55% { transform: scaleY(1.08) rotate(14deg); opacity: 1; }
        80% { transform: scaleY(1) rotate(-7deg); opacity: 1; }
        100% { transform: scaleY(1) rotate(0deg); opacity: 1; }
      }
      @keyframes eduStudioPop {
        0% { transform: scale(0) rotate(-35deg); opacity: 0; }
        70% { transform: scale(1.18) rotate(8deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes eduStudioBurst {
        0% { stroke-dashoffset: 18; opacity: 0; }
        25% { opacity: 1; }
        100% { stroke-dashoffset: -18; opacity: 0; }
      }
      @keyframes eduStudioWordReveal {
        0% { transform: translateX(-34px); opacity: 0; filter: blur(4px); }
        100% { transform: translateX(0px); opacity: 1; filter: blur(0px); }
      }
      @keyframes eduMojangLogoShift {
        0%, 38% { transform: translateX(88px) scale(1.12); }
        100% { transform: translateX(0px) scale(1); }
      }
      @keyframes eduMojangLetter {
        0% {
          transform: translateY(115%) scaleX(0.76) scaleY(1.32) rotate(-10deg);
          opacity: 0;
        }
        52% {
          transform: translateY(-14%) scaleX(1.1) scaleY(0.88) rotate(3deg);
          opacity: 1;
        }
        76% {
          transform: translateY(5%) scaleX(0.96) scaleY(1.05) rotate(-1deg);
          opacity: 1;
        }
        100% {
          transform: translateY(0%) scaleX(1) scaleY(1) rotate(0deg);
          opacity: 1;
        }
      }
      @keyframes eduMojangBlockWipe {
        0% { transform: translateY(115%) scaleY(1); opacity: 0; }
        12% { opacity: 1; }
        44% { transform: translateY(0%) scaleY(1); opacity: 1; }
        100% { transform: translateY(-115%) scaleY(0.35); opacity: 0; }
      }
      @keyframes eduMojangSpark {
        0% { transform: translate(0, 8px) scale(0) rotate(0deg); opacity: 0; }
        35% { transform: translate(var(--sx, 0px), -14px) scale(1.15) rotate(45deg); opacity: 1; }
        100% { transform: translate(var(--sx2, 0px), -28px) scale(0) rotate(110deg); opacity: 0; }
      }
      @keyframes eduStudioLineDraw {
        0% { transform: scaleX(0); opacity: 0; }
        100% { transform: scaleX(1); opacity: 1; }
      }
      @keyframes eduStudioTagRise {
        0% { transform: translateY(12px); opacity: 0; letter-spacing: 0.42em; }
        100% { transform: translateY(0px); opacity: 1; letter-spacing: 0.24em; }
      }
      @keyframes eduStudioSheen {
        0% { transform: translateX(-140%) skewX(-24deg); opacity: 0; }
        25% { opacity: 0.85; }
        100% { transform: translateX(260%) skewX(-24deg); opacity: 0; }
      }
      .edu-st-pulse { animation: eduStudioPulse 950ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both; }
      .edu-st-br-l { transform-box: fill-box; transform-origin: center; animation: eduStudioBracketL 520ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both; }
      .edu-st-br-r { transform-box: fill-box; transform-origin: center; animation: eduStudioBracketR 520ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both; }
      .edu-st-cap { transform-box: fill-box; transform-origin: center; animation: eduStudioCapDrop 580ms cubic-bezier(0.22, 1, 0.36, 1) 180ms both; }
      .edu-st-tassel { transform-origin: 78px 36px; animation: eduStudioTasselDrop 680ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both; }
      .edu-st-pop-1 { transform-box: fill-box; transform-origin: center; animation: eduStudioPop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) 340ms both; }
      .edu-st-pop-2 { transform-box: fill-box; transform-origin: center; animation: eduStudioPop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) 420ms both; }
      .edu-st-pop-3 { transform-box: fill-box; transform-origin: center; animation: eduStudioPop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) 500ms both; }
      .edu-st-pop-4 { transform-box: fill-box; transform-origin: center; animation: eduStudioPop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) 580ms both; }
      .edu-st-burst { stroke-dasharray: 18; animation: eduStudioBurst 660ms ease-out 360ms both; }
      .edu-st-logo-shift { animation: eduMojangLogoShift 1050ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both; }
      .edu-st-letter {
        display: inline-block;
        transform-origin: center bottom;
        animation: eduMojangLetter 580ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .edu-st-block {
        animation: eduMojangBlockWipe 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .edu-st-spark {
        animation: eduMojangSpark 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .edu-st-line { transform-origin: left center; animation: eduStudioLineDraw 620ms cubic-bezier(0.16, 1, 0.3, 1) 1360ms both; }
      .edu-st-tag { animation: eduStudioTagRise 640ms cubic-bezier(0.16, 1, 0.3, 1) 1480ms both; }
      .edu-st-sheen { animation: eduStudioSheen 1050ms cubic-bezier(0.16, 1, 0.3, 1) 1750ms both; }
      @media (max-width: 639px) {
        .edu-st-logo-shift { animation: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .edu-st-pulse, .edu-st-br-l, .edu-st-br-r, .edu-st-cap, .edu-st-tassel,
        .edu-st-pop-1, .edu-st-pop-2, .edu-st-pop-3, .edu-st-pop-4, .edu-st-burst,
        .edu-st-logo-shift, .edu-st-letter, .edu-st-block, .edu-st-spark,
        .edu-st-line, .edu-st-tag, .edu-st-sheen {
          animation: none !important;
        }
      }
      .edu-marquee-track {
        display: flex;
        width: max-content;
        animation: eduMarquee 34s linear infinite;
      }
      .edu-marquee-track:hover {
        animation-play-state: paused;
      }
      .edu-clip-wipe {
        animation: eduClipWipe 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .edu-fade-rise {
        animation: eduFadeRise 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .edu-soft-glow {
        animation: eduSoftGlow 12s ease-in-out infinite;
      }
      .edu-cap-float { animation: eduCapFloat 3.8s ease-in-out infinite; }
      .edu-tassel-sway { transform-origin: 78px 36px; animation: eduTasselSway 3.2s ease-in-out infinite; }
      .edu-bracket-l { animation: eduBracketLeft 4.2s ease-in-out infinite; }
      .edu-bracket-r { animation: eduBracketRight 4.2s ease-in-out infinite; }
      .edu-puzzle-a { transform-box: fill-box; transform-origin: center; animation: eduPuzzleOrbitA 5.2s ease-in-out infinite; }
      .edu-puzzle-b { transform-box: fill-box; transform-origin: center; animation: eduPuzzleOrbitB 5.8s ease-in-out infinite; }
      .edu-dot-1 { animation: eduDotTyping 1.6s ease-in-out infinite; }
      .edu-dot-2 { animation: eduDotTyping 1.6s ease-in-out 0.22s infinite; }
      .edu-dot-3 { animation: eduDotTyping 1.6s ease-in-out 0.44s infinite; }
      .edu-ring-a { animation: eduRingSpinA 26s linear infinite; }
      .edu-ring-b { animation: eduRingSpinB 34s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .edu-marquee-track, .edu-clip-wipe, .edu-fade-rise, .edu-soft-glow,
        .edu-cap-float, .edu-tassel-sway, .edu-bracket-l, .edu-bracket-r,
        .edu-puzzle-a, .edu-puzzle-b, .edu-dot-1, .edu-dot-2, .edu-dot-3,
        .edu-ring-a, .edu-ring-b {
          animation: none !important;
        }
      }
    `}</style>
  )
}

/**
 * Настоящая интерактивная 3D WebGL-скульптура EduPlatform на Three.js:
 * преломляющий оптический хрусталь (MeshPhysicalMaterial + RoomEnvironment),
 * сапфировое и янтарное орбитальные кольца, парящие стеклянные сферы,
 * живая реакция на курсор и прокрутку. Авто-пауза вне экрана и безопасный fallback.
 */
export function ThreeHeroSculpture({ dark }: { dark: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer | null = null
    let raf = 0
    let visible = true
    const disposables: { dispose: () => void }[] = []

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      setFallback(true)
      return
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = dark ? 1.2 : 1.1
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
    camera.position.set(0, 0.08, 7.1)

    // Студийная среда отражений для физического стекла
    const pmrem = new THREE.PMREMGenerator(renderer)
    const roomEnv = new RoomEnvironment()
    const envRT = pmrem.fromScene(roomEnv, 0.04)
    scene.environment = envRT.texture
    roomEnv.dispose()
    disposables.push(pmrem, envRT)

    // Тёплый и сапфировый студийный свет (фирменные цвета EduPlatform: #2563EB и #FB923C)
    const keyLight = new THREE.DirectionalLight(0xffffff, dark ? 2.2 : 2.6)
    keyLight.position.set(4, 5, 6)
    scene.add(keyLight)

    const blueRim = new THREE.PointLight(0x3b82f6, dark ? 16 : 10, 18)
    blueRim.position.set(-3.5, 2.2, 2.5)
    scene.add(blueRim)

    const amberRim = new THREE.PointLight(0xfb923c, dark ? 10 : 7, 16)
    amberRim.position.set(3.8, -2.4, 2.0)
    scene.add(amberRim)

    const root = new THREE.Group()
    scene.add(root)

    // 1. Центральный преломляющий хрустальный узел (однопроходный 60fps шейдер для любых ноутбуков)
    const knotGeo = new THREE.TorusKnotGeometry(1.06, 0.33, 144, 28, 2, 3)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: dark ? 0x60a5fa : 0x2563eb,
      emissive: dark ? 0x1e3a8a : 0x1d4ed8,
      emissiveIntensity: dark ? 0.35 : 0.14,
      metalness: 0.25,
      roughness: 0.06,
      transparent: true,
      opacity: dark ? 0.88 : 0.9,
      ior: 1.5,
      iridescence: 1.0,
      iridescenceIOR: 1.42,
      iridescenceThicknessRange: [140, 520],
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
    })
    const knotMesh = new THREE.Mesh(knotGeo, glassMat)
    root.add(knotMesh)
    disposables.push(knotGeo, glassMat)

    // 2. Внутренний граненый сапфирово-золотой кристалл (светится сквозь стекло)
    const coreGeo = new THREE.OctahedronGeometry(0.46, 0)
    const coreMat = new THREE.MeshStandardMaterial({
      color: dark ? 0x38bdf8 : 0x1d4ed8,
      emissive: dark ? 0x1e40af : 0x1e3a8a,
      emissiveIntensity: dark ? 0.9 : 0.45,
      metalness: 0.85,
      roughness: 0.14,
    })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    root.add(coreMesh)
    disposables.push(coreGeo, coreMat)

    // 3. Два тонких архитектурных орбитальных кольца (синий и тёплый янтарный)
    const ringGeo1 = new THREE.TorusGeometry(1.92, 0.017, 16, 128)
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: dark ? 0x93c5fd : 0x2563eb,
      metalness: 0.88,
      roughness: 0.18,
    })
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1)
    ring1.rotation.set(Math.PI * 0.34, Math.PI * 0.18, 0)
    root.add(ring1)
    disposables.push(ringGeo1, ringMat1)

    const ringGeo2 = new THREE.TorusGeometry(2.26, 0.012, 16, 128)
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      metalness: 0.85,
      roughness: 0.22,
    })
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2)
    ring2.rotation.set(-Math.PI * 0.28, Math.PI * 0.42, 0.25)
    root.add(ring2)
    disposables.push(ringGeo2, ringMat2)

    // 4. Парящие стеклянные микро-сферы на орбите
    const orbGeo = new THREE.SphereGeometry(0.085, 24, 24)
    const orbMatBlue = new THREE.MeshPhysicalMaterial({
      color: dark ? 0xbae6fd : 0x3b82f6,
      metalness: 0.35,
      roughness: 0.08,
      clearcoat: 1,
    })
    const orbMatGold = new THREE.MeshPhysicalMaterial({
      color: 0xfdba74,
      metalness: 0.72,
      roughness: 0.16,
      clearcoat: 1,
    })
    disposables.push(orbGeo, orbMatBlue, orbMatGold)

    const orbs: { mesh: THREE.Mesh; radius: number; speed: number; phase: number; tilt: number }[] = []
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(orbGeo, i % 3 === 0 ? orbMatGold : orbMatBlue)
      const scale = 0.55 + (i % 4) * 0.26
      m.scale.setScalar(scale)
      root.add(m)
      orbs.push({
        mesh: m,
        radius: 1.75 + (i % 3) * 0.34,
        speed: (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 5) * 0.07),
        phase: (i / 10) * Math.PI * 2,
        tilt: (i % 2 === 0 ? 1 : -1) * (0.45 + (i % 3) * 0.25),
      })
    }

    const resize = () => {
      if (!renderer || !host) return
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let scrollP = 0

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const nx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
      const ny = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
      targetX = nx
      targetY = ny
    }
    const onScroll = () => {
      scrollP = Math.max(0, Math.min(1.5, window.scrollY / Math.max(1, window.innerHeight)))
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    const io = new IntersectionObserver(
      entries => {
        visible = Boolean(entries[0]?.isIntersecting)
      },
      { threshold: 0.01 }
    )
    io.observe(host)

    const t0 = performance.now()
    const animate = () => {
      if (visible && renderer) {
        const sec = reduced ? 1.4 : (performance.now() - t0) * 0.001
        curX += (targetX - curX) * 0.06
        curY += (targetY - curY) * 0.06

        knotMesh.rotation.x = sec * 0.24 + curY * 0.45 + scrollP * 0.9
        knotMesh.rotation.y = sec * 0.34 + curX * 0.55 + scrollP * 1.15
        coreMesh.rotation.x = -sec * 0.55
        coreMesh.rotation.y = -sec * 0.72
        ring1.rotation.z = sec * 0.22
        ring2.rotation.z = -sec * 0.18

        root.position.y = Math.sin(sec * 1.05) * 0.11 - scrollP * 0.35
        root.rotation.y = curX * 0.32
        root.rotation.x = curY * 0.22

        for (const o of orbs) {
          const a = o.phase + sec * o.speed
          o.mesh.position.set(
            Math.cos(a) * o.radius,
            Math.sin(a * 1.15) * Math.sin(o.tilt) * o.radius * 0.68,
            Math.sin(a) * o.radius * 0.75
          )
        }

        camera.position.z = 7.1 - scrollP * 0.85
        renderer.render(scene, camera)
      }
      if (!reduced) raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      disposables.forEach(d => d.dispose())
      if (renderer) {
        renderer.dispose()
        renderer.domElement.remove()
      }
    }
  }, [dark])

  if (fallback) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-72 h-72 rounded-full bg-gradient-to-tr from-blue-600/35 via-sky-400/25 to-orange-400/25 blur-2xl edu-soft-glow" />
      </div>
    )
  }

  return <div ref={hostRef} data-testid="about-webgl-hero" className="w-full h-full" />
}

/**
 * Плавное появление элементов при скролле.
 */
export function RevealEditorial({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-7'
      } ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

/**
 * Счётчик цифр при появлении в кадре.
 */
export function AnimatedMetric({
  target,
  suffix = '',
}: {
  target: number
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [val, setVal] = useState(target)
  const ran = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      return
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !ran.current) {
          ran.current = true
          const t0 = performance.now()
          const step = (now: number) => {
            const p = Math.min(1, (now - t0) / 950)
            const eased = 1 - Math.pow(1 - p, 3)
            setVal(Math.round(target * eased))
            if (p < 1) requestAnimationFrame(step)
            else setVal(target)
          }
          requestAnimationFrame(step)
          io.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [target])

  return (
    <span ref={ref} className="tabular-nums">
      {val}
      {suffix}
    </span>
  )
}

/**
 * Панорамный фото-кадр, плавно раскрывающийся при прокрутке (Apple / Editorial zoom-expand).
 */
export function ScrollExpandPhoto({
  src,
  alt,
  caption,
  quote,
}: {
  src: string
  alt: string
  caption: string
  quote: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [p, setP] = useState(0.5)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setP(1)
      return
    }
    const update = () => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 900
      const raw = (vh - r.top) / (vh * 0.85)
      setP(Math.max(0, Math.min(1, raw)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  const scale = 0.91 + p * 0.09
  const imgScale = 1.12 - p * 0.1
  const radius = Math.round(42 - p * 18)

  return (
    <div ref={ref} className="w-full flex justify-center">
      <div
        className="relative w-full h-[420px] sm:h-[520px] lg:h-[580px] overflow-hidden shadow-2xl will-change-transform bg-slate-950"
        style={{
          transform: `scale(${scale.toFixed(4)})`,
          borderRadius: `${radius}px`,
        }}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover object-[50%_32%] will-change-transform"
          style={{ transform: `scale(${imgScale.toFixed(4)})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#07090F]/92 via-[#07090F]/25 to-transparent"
        />
        <div className="absolute top-6 left-6 sm:left-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-xs font-medium text-white/90">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {caption}
          </span>
        </div>
        <div className="absolute inset-x-6 sm:inset-x-10 bottom-7 sm:bottom-10 max-w-3xl">
          <blockquote className="font-editorial italic text-2xl sm:text-4xl lg:text-[2.65rem] leading-[1.14] text-white drop-shadow-md">
            «{quote}»
          </blockquote>
        </div>
      </div>
    </div>
  )
}

export type CinemaChapter = {
  id: string
  num: string
  to: string
  routeText: string
  photo: string
  tag: string
  title: string
  desc: string
  chips: string[]
}

/**
 * ACT III: Прилипающая (Sticky) скролл-сцена кинематографической презентации модулей.
 * При прокрутке 260vh трека кадры плавно сменяются сами; также любой шаг можно нажать вручную!
 */
export function StickyCinemaStage({
  eyebrow,
  heading,
  chapters,
  openLabel,
}: {
  eyebrow: string
  heading: string
  chapters: CinemaChapter[]
  openLabel: string
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [scrollFrac, setScrollFrac] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onScroll = () => {
      if (window.innerWidth < 1024) return
      const r = track.getBoundingClientRect()
      const scrollable = Math.max(1, track.offsetHeight - window.innerHeight)
      const scrolled = Math.max(0, Math.min(scrollable, -r.top))
      const frac = scrolled / scrollable
      setScrollFrac(frac)
      const nextIdx = Math.min(chapters.length - 1, Math.floor(frac * chapters.length))
      setActiveIdx(nextIdx)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [chapters.length])

  const selectChapter = (idx: number) => {
    setActiveIdx(idx)
    const track = trackRef.current
    if (track && window.innerWidth >= 1024) {
      const scrollable = Math.max(1, track.offsetHeight - window.innerHeight)
      const topDoc = track.getBoundingClientRect().top + window.scrollY
      const targetY = topDoc + ((idx + 0.15) / chapters.length) * scrollable
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }

  const cur = chapters[activeIdx] || chapters[0]

  return (
    <section
      id="sec-stage"
      ref={trackRef}
      data-testid="about-showcase"
      className="relative bg-[#07090F] text-white lg:h-[260vh]"
    >
      <div className="lg:sticky lg:top-0 lg:min-h-screen flex items-center py-16 lg:py-20 px-5 sm:px-10 overflow-hidden">
        {/* Мягкий объёмный студийный свет за экранами киносцены */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-[-8%] -translate-y-1/2 w-[620px] h-[620px] rounded-full blur-3xl opacity-40 edu-soft-glow"
          style={{
            background:
              'radial-gradient(circle, rgba(37,99,235,0.55) 0%, rgba(14,165,233,0.22) 45%, transparent 72%)',
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Заголовок сцены + индикатор прогресса */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-sky-400">{eyebrow}</div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl tracking-[-0.03em] text-white mt-1.5">
                {heading}
              </h2>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-white/55">
              <span className="text-white font-bold">{cur.num}</span>
              <div className="w-28 h-[2px] bg-white/15 overflow-hidden rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-transform duration-150 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0.2, scrollFrac || (activeIdx + 1) / chapters.length).toFixed(3)})`,
                  }}
                />
              </div>
              <span>0{chapters.length}</span>
            </div>
          </div>

          {/* 12-колоночная сцена: слева главы (4), справа гигантский студийный экран (8) */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-4 space-y-2.5">
              {chapters.map((ch, i) => {
                const isCur = i === activeIdx
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => selectChapter(i)}
                    data-testid={`about-stage-${ch.id}`}
                    className={`w-full text-left rounded-2xl p-4 border transition-all duration-300 ${
                      isCur
                        ? 'bg-white/[0.08] border-sky-400/50 shadow-lg shadow-blue-950/40'
                        : 'bg-transparent border-white/10 hover:bg-white/[0.04] hover:border-white/20 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono text-xs ${isCur ? 'text-sky-300 font-bold' : 'text-white/45'}`}>
                        {ch.num} · {ch.tag}
                      </span>
                      {isCur && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                    </div>
                    <div className={`font-display font-bold mt-1 ${isCur ? 'text-lg text-white' : 'text-base text-white/85'}`}>
                      {ch.title}
                    </div>
                    {isCur && (
                      <div className="edu-fade-rise mt-2 space-y-3">
                        <p className="text-xs sm:text-[13px] text-white/75 leading-relaxed">{ch.desc}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap gap-1.5">
                            {ch.chips.map(c => (
                              <span key={c} className="px-2 py-0.5 rounded-md bg-white/10 font-mono text-[10px] text-sky-200">
                                {c}
                              </span>
                            ))}
                          </div>
                          <Link
                            to={ch.to}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-white transition-colors"
                          >
                            {openLabel} <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Студийный экран справа с плавной сменой clip-path */}
            <div className="lg:col-span-8">
              <div className="rounded-3xl border border-white/15 bg-[#0D111A] shadow-[0_32px_100px_rgba(37,99,235,0.22)] overflow-hidden">
                <div className="px-4 py-3 bg-[#111623] border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-[11px] text-white/75">
                    <img src="/logo.svg" alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain" />
                    <span>{cur.routeText}</span>
                  </div>
                  <Link
                    to={cur.to}
                    className="px-3 py-1 rounded-full bg-white text-slate-950 hover:bg-sky-300 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                  >
                    {openLabel} <ArrowUpRight size={12} />
                  </Link>
                </div>

                <div className="relative aspect-[16/10] w-full bg-[#090D16] overflow-hidden">
                  <img
                    key={cur.id}
                    src={cur.photo}
                    alt={cur.title}
                    className="w-full h-full object-cover object-top edu-clip-wipe"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Тактильная карточка с 3D-наклоном и мягким световым бликом за курсором.
 */
export function SpotlightTiltCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [st, setSt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, on: false })

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    setSt({
      rx: Number(((0.5 - py) * 7).toFixed(2)),
      ry: Number(((px - 0.5) * 8).toFixed(2)),
      gx: Math.round(px * 100),
      gy: Math.round(py * 100),
      on: true,
    })
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setSt(s => ({ ...s, rx: 0, ry: 0, on: false }))}
      style={{ perspective: '1100px' }}
      className="h-full"
    >
      <div
        className={`relative h-full transition-transform duration-300 ease-out will-change-transform ${className}`}
        style={{ transform: `rotateX(${st.rx}deg) rotateY(${st.ry}deg)` }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-10"
          style={{
            opacity: st.on ? 1 : 0,
            background: `radial-gradient(380px circle at ${st.gx}% ${st.gy}%, rgba(59, 130, 246, 0.14), transparent 65%)`,
          }}
        />
        {children}
      </div>
    </div>
  )
}

/**
 * Тонкая светящаяся полоса прогресса чтения в самом верху окна.
 */
export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const update = () => {
      const el = barRef.current
      if (!el) return
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const p = Math.max(0, Math.min(1, window.scrollY / max))
      el.style.transform = `scaleX(${p.toFixed(4)})`
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div aria-hidden="true" className="fixed top-0 inset-x-0 h-[2.5px] z-[60] pointer-events-none bg-transparent">
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-blue-600 via-sky-400 to-amber-400"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}

/**
 * Фирменная 2D-анимация логотипа + названия сайта (в стиле студийной заставки Mojang Studios):
 * 1) Скобки кода < > вылетают и фиксируются с пружиной
 * 2) Шапочка выпускника раскрывается сверху, кисточка падает и качается
 * 3) Вспыхивают мини-лучи, выпрыгивают чат-баблы (с живыми точками • • •) и 4 цветных пазла
 * 4) Справа из-за маски плавно выезжает название «EduPlatform», подчёркивается линией и появляется слоган
 * 5) По всему логотипу проходит световой блик; запускается при доскролле и по клику (можно переиграть!)
 */
export function AnimatedEduLogoStage({
  tagline = 'УЧИ · СОЗДАВАЙ · ДЕЛИСЬ',
  replayLabel = 'Повторить',
  videoSrc,
}: {
  tagline?: string
  replayLabel?: string
  videoSrc?: string
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [entered, setEntered] = useState(false)

  // Автозапуск студийной 2D-заставки ровно в момент, когда пользователь доскроллил до финала
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setEntered(true)
          setPlayKey(k => k + 1)
          io.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      data-testid="about-closing-logo"
      className="relative w-full py-10 sm:py-14 px-6 sm:px-10 rounded-[28px] bg-[#060913] border border-white/[0.1] overflow-hidden flex flex-col items-center justify-center gap-4 select-none"
    >
      {/* Мягкий студийный свет за 2D-эмблемой */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 64% 72% at 50% 50%, rgba(37, 99, 235, 0.24) 0%, rgba(14, 165, 233, 0.1) 42%, transparent 74%)',
        }}
      />

      {videoSrc ? (
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="relative z-10 max-h-[200px] w-auto object-contain mix-blend-screen"
        />
      ) : (
        <div
          key={entered ? playKey : 'idle'}
          onClick={() => setPlayKey(k => k + 1)}
          title={replayLabel}
          className="relative z-10 cursor-pointer group flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-7 py-2"
        >
          {/* Диагональный студийный блик по всей готовой композиции */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-x-10 -inset-y-4 overflow-hidden">
            <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent edu-st-sheen" />
          </div>

          {/* 2D Анимированный логотип EduPlatform (собирается по центру и плавно съезжает влево, освобождая место буквам!) */}
          <div className="edu-st-logo-shift relative w-[108px] h-[108px] sm:w-[128px] sm:h-[128px] flex items-center justify-center shrink-0">
            {/* Кольцевой импульс при появлении */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-3 rounded-full border-2 border-sky-400/70 edu-st-pulse"
            />

            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 96 96"
              role="img"
              aria-label="EduPlatform 2D Animated Logo"
              className="w-full h-full overflow-visible drop-shadow-[0_10px_28px_rgba(37,99,235,0.45)]"
            >
              <defs>
                <linearGradient id="mCap" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="mCapTop" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7dd3fc" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="mBr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7dd3fc" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>

              {/* Короткие 2D-вспышки-лучи motion-graphics (как в студийных заставках) */}
              <g strokeLinecap="round" strokeWidth="2.4" fill="none">
                <line className="edu-st-burst" x1="48" y1="4" x2="48" y2="14" stroke="#38bdf8" />
                <line className="edu-st-burst" x1="87" y1="20" x2="80" y2="27" stroke="#fb923c" />
                <line className="edu-st-burst" x1="9" y1="20" x2="16" y2="27" stroke="#a78bfa" />
                <line className="edu-st-burst" x1="88" y1="76" x2="81" y2="69" stroke="#4ade80" />
                <line className="edu-st-burst" x1="8" y1="76" x2="15" y2="69" stroke="#f472b6" />
              </g>

              {/* 4 цветных пазла с пружинным вылетом */}
              <g>
                <path
                  className="edu-st-pop-1"
                  d="M14 30 q4 -8 10 -4 q2 -4 6 -2 q4 2 2 6 q4 4 0 8 q-4 4 -8 2 q-2 4 -6 2 q-4 -2 -2 -6 q-4 -2 -2 -6z"
                  fill="#fb923c"
                />
                <path
                  className="edu-st-pop-2"
                  d="M72 26 q4 -6 9 -3 q2 -3 5 -1 q3 2 1 5 q3 3 0 6 q-3 3 -6 1 q-2 3 -5 1 q-3 -2 -1 -5 q-3 -2 -3 -4z"
                  fill="#4ade80"
                />
                <path
                  className="edu-st-pop-3"
                  d="M74 62 q3 -5 7 -2 q1 -3 4 -1 q3 2 1 4 q3 3 0 5 q-3 2 -5 1 q-2 2 -4 1 q-2 -2 -1 -4 q-2 -2 -2 -4z"
                  fill="#c084fc"
                />
                <path
                  className="edu-st-pop-4"
                  d="M12 62 q3 -4 7 -2 q4 2 2 6 q3 3 -1 5 q-3 2 -5 0 q-4 0 -4 -4 q-2 -2 1 -5z"
                  fill="#f472b6"
                />
              </g>

              {/* Чат-баблы с живыми точками набора */}
              <g className="edu-st-pop-2">
                <rect x="8" y="14" width="16" height="11" rx="5.5" fill="#a78bfa" />
                <circle className="edu-dot-1" cx="13" cy="19.5" r="1.35" fill="#fff" />
                <circle className="edu-dot-2" cx="16.5" cy="19.5" r="1.35" fill="#fff" />
                <circle className="edu-dot-3" cx="20" cy="19.5" r="1.35" fill="#fff" />
              </g>
              <g className="edu-st-pop-3">
                <rect x="72" y="46" width="16" height="11" rx="5.5" fill="#22d3ee" />
                <circle className="edu-dot-1" cx="77" cy="51.5" r="1.35" fill="#fff" />
                <circle className="edu-dot-2" cx="80.5" cy="51.5" r="1.35" fill="#fff" />
                <circle className="edu-dot-3" cx="84" cy="51.5" r="1.35" fill="#fff" />
              </g>

              {/* Скобки кода < > вылетают первыми */}
              <g fill="none" stroke="url(#mBr)" strokeWidth="6.8" strokeLinecap="round" strokeLinejoin="round">
                <path className="edu-st-br-l" d="M28 44 L16 56 L28 68" />
                <path className="edu-st-br-r" d="M68 44 L80 56 L68 68" />
              </g>

              {/* Академическая шапочка раскрывается в центре + падающая кисточка */}
              <g className="edu-cap-float">
                <g className="edu-st-cap">
                  <polygon points="48,22 78,36 48,50 18,36" fill="url(#mCapTop)" />
                  <path d="M34 42 v14 c0 6 28 6 28 0 v-14 l-14 6z" fill="url(#mCap)" />
                </g>
                <g className="edu-st-tassel">
                  <g className="edu-tassel-sway">
                    <line x1="78" y1="36" x2="78" y2="62" stroke="#60a5fa" strokeWidth="3.5" strokeLinecap="round" />
                    <circle cx="78" cy="65" r="4.5" fill="#38bdf8" />
                    <circle cx="78" cy="65" r="1.8" fill="#ffffff" />
                  </g>
                </g>
              </g>
            </svg>
          </div>

          {/* Побуквенная 2D motion-graphics анимация названия «EduPlatform» (как в Mojang Studios!) */}
          <div className="text-center sm:text-left px-1">
            <div
              aria-label="EduPlatform"
              className="relative inline-flex items-baseline font-display font-extrabold text-[32px] sm:text-6xl tracking-[-0.03em] leading-none"
            >
              {'EduPlatform'.split('').map((ch, i) => {
                const isBrand = i >= 3
                const delayMs = 660 + i * 58
                const blockColors = ['#38bdf8', '#fb923c', '#4ade80', '#60a5fa', '#c084fc', '#f472b6', '#22d3ee']
                const blockColor = blockColors[i % blockColors.length]
                const showSpark = i === 0 || i === 3 || i === 7 || i === 10
                return (
                  <span
                    key={`${ch}-${i}`}
                    className="relative inline-block px-[0.5px] transition-transform duration-200 hover:-translate-y-1.5"
                  >
                    <span className="relative inline-block overflow-hidden pt-2 pb-1">
                      {/* Цветной 2D motion-блок, пролетающий перед появлением каждой буквы */}
                      <span
                        aria-hidden="true"
                        className="edu-st-block pointer-events-none absolute inset-x-[1px] top-2 bottom-1 rounded-md z-20"
                        style={{
                          backgroundColor: blockColor,
                          animationDelay: `${Math.max(0, delayMs - 70)}ms`,
                        }}
                      />
                      {/* Сама буква с пружинным squash-and-stretch вылетом */}
                      <span
                        className={`edu-st-letter relative z-10 ${
                          isBrand
                            ? 'bg-gradient-to-b from-sky-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent'
                            : 'text-white'
                        }`}
                        style={{ animationDelay: `${delayMs}ms` }}
                      >
                        {ch}
                      </span>
                    </span>
                    {/* 2D геометрические искорки, вылетающие НАД буквами при «приземлении» */}
                    {showSpark && (
                      <span
                        aria-hidden="true"
                        className="edu-st-spark pointer-events-none absolute left-1/2 top-1 w-2 h-2 rounded-[2px] z-30"
                        style={{
                          backgroundColor: blockColor,
                          animationDelay: `${delayMs + 140}ms`,
                          ['--sx' as any]: `${i % 2 === 0 ? -8 : 8}px`,
                          ['--sx2' as any]: `${i % 2 === 0 ? -16 : 16}px`,
                        }}
                      />
                    )}
                  </span>
                )
              })}
            </div>

            <div className="edu-st-line my-3 h-[2.5px] w-full bg-gradient-to-r from-sky-400 via-blue-500 to-amber-400 rounded-full" />

            <div className="edu-st-tag font-mono text-[11px] sm:text-xs font-semibold uppercase text-sky-200/85">
              {tagline}
            </div>
          </div>
        </div>
      )}

      {/* Ненавязчивая кнопка «Повторить анимацию» в углу */}
      {!videoSrc && (
        <button
          type="button"
          onClick={() => setPlayKey(k => k + 1)}
          className="relative z-10 mt-1 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-[10.5px] font-mono text-white/60 hover:text-white transition-colors"
        >
          ↻ {replayLabel}
        </button>
      )}
    </div>
  )
}
