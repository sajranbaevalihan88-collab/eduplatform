import {
  Circle2d,
  Polyline2d,
  SVGContainer,
  ShapeUtil,
  T,
  TLBaseShape,
  Vec,
  toFixed,
} from 'tldraw'

export type PenPoint = { x: number; y: number }

export type PenStrokeShape = TLBaseShape<
  'pen-stroke',
  {
    color: string
    strokeWidth: number
    isHighlighter: boolean
    points: PenPoint[]
  }
>

/** Строит плавную SVG-кривую (квадратичная Безье через середины сегментов). */
export function buildSmoothPenPath(points: PenPoint[]): string {
  if (!points.length) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${toFixed(p.x)} ${toFixed(p.y)} L ${toFixed(p.x + 0.1)} ${toFixed(p.y + 0.1)}`
  }
  if (points.length === 2) {
    return `M ${toFixed(points[0].x)} ${toFixed(points[0].y)} L ${toFixed(points[1].x)} ${toFixed(points[1].y)}`
  }
  let d = `M ${toFixed(points[0].x)} ${toFixed(points[0].y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const next = points[i + 1]
    const mx = (p.x + next.x) / 2
    const my = (p.y + next.y) / 2
    d += ` Q ${toFixed(p.x)} ${toFixed(p.y)} ${toFixed(mx)} ${toFixed(my)}`
  }
  const last = points[points.length - 1]
  d += ` L ${toFixed(last.x)} ${toFixed(last.y)}`
  return d
}

function dedupePoints(points: PenPoint[]): Vec[] {
  const out: Vec[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.35) {
      out.push(new Vec(p.x, p.y))
    }
  }
  return out
}

/**
 * Нативная векторная фигура tldraw для карандаша и маркера с произвольным
 * HEX-цветом и плавной толщиной от 1 до 40 px.
 * Полностью поддерживает ластик tldraw, выделение, перенос, Undo/Redo,
 * сохранение и экспорт в PNG.
 */
export class PenStrokeShapeUtil extends ShapeUtil<PenStrokeShape> {
  static override type = 'pen-stroke' as const

  static override props = {
    color: T.string,
    strokeWidth: T.number,
    isHighlighter: T.boolean,
    points: T.arrayOf(T.object({ x: T.number, y: T.number })),
  }

  override canEdit = () => false
  override isAspectRatioLocked = () => false

  override getDefaultProps(): PenStrokeShape['props'] {
    return {
      color: '#0f172a',
      strokeWidth: 4,
      isHighlighter: false,
      points: [{ x: 0, y: 0 }],
    }
  }

  override getGeometry(shape: PenStrokeShape) {
    const vecs = dedupePoints(shape.props.points)
    const sw = Math.max(2, shape.props.strokeWidth || 4)
    if (vecs.length < 2) {
      const p = vecs[0] || new Vec(0, 0)
      const r = Math.max(4, sw * 0.6)
      return new Circle2d({ x: p.x - r, y: p.y - r, radius: r, isFilled: true })
    }
    return new Polyline2d({ points: vecs })
  }

  override component(shape: PenStrokeShape) {
    const { color, strokeWidth, isHighlighter, points } = shape.props
    const sw = Math.max(1, strokeWidth || 4)
    const opacity = isHighlighter ? 0.38 : 1

    if (points.length <= 1) {
      const p = points[0] || { x: 0, y: 0 }
      return (
        <SVGContainer id={shape.id}>
          <circle cx={p.x} cy={p.y} r={sw / 2} fill={color} fillOpacity={opacity} />
        </SVGContainer>
      )
    }

    const d = buildSmoothPenPath(points)
    return (
      <SVGContainer id={shape.id}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeOpacity={opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </SVGContainer>
    )
  }

  override indicator(shape: PenStrokeShape) {
    const { points, strokeWidth } = shape.props
    if (points.length <= 1) {
      const p = points[0] || { x: 0, y: 0 }
      return <circle cx={p.x} cy={p.y} r={Math.max(3, (strokeWidth || 4) / 2)} />
    }
    return <path d={buildSmoothPenPath(points)} />
  }

  override toSvg(shape: PenStrokeShape) {
    const { color, strokeWidth, isHighlighter, points } = shape.props
    const sw = Math.max(1, strokeWidth || 4)
    const opacity = isHighlighter ? 0.38 : 1
    if (points.length <= 1) {
      const p = points[0] || { x: 0, y: 0 }
      return <circle cx={p.x} cy={p.y} r={sw / 2} fill={color} fillOpacity={opacity} />
    }
    return (
      <path
        d={buildSmoothPenPath(points)}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeOpacity={opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  override onResize = (shape: PenStrokeShape, info: any) => {
    const { scaleX, scaleY } = info
    return {
      props: {
        points: shape.props.points.map(p => ({
          x: toFixed(p.x * scaleX),
          y: toFixed(p.y * scaleY),
        })),
      },
    }
  }
}
