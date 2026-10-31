import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLang } from '../settings';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type View = Rect;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * An SVG drawing area with pan (drag) and zoom (wheel, buttons). `width` × `height` is the
 * drawing's own coordinate system; "Fit" shows all of it. When `focus` is given, the view glides
 * to frame that rectangle (the follow camera); without it, the view stays where the user put it.
 */
export function CircuitCanvas({
  width,
  height,
  children,
  label,
  focus,
}: {
  width: number;
  height: number;
  children: ReactNode;
  label: string;
  focus?: Rect | null;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const full: View = { x: -10, y: -10, w: width + 20, h: height + 20 };
  const [view, setView] = useState<View>(full);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ px: number; py: number; view: View } | null>(null);
  const anim = useRef(0);
  const { L } = useLang();

  // Follow camera: frame the focus rectangle at the container's aspect ratio, with a margin.
  const fx = focus?.x, fy = focus?.y, fw = focus?.w, fh = focus?.h;
  useEffect(() => {
    const el = svg.current;
    if (fx === undefined || fy === undefined || fw === undefined || fh === undefined || !el) return;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    let w = Math.max(fw * 1.25, 460);
    let h = Math.max(fh * 1.25, 300);
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    const target = { x: fx + fw / 2 - w / 2, y: fy + fh / 2 - h / 2, w, h };
    cancelAnimationFrame(anim.current);
    if (reducedMotion()) return setView(target);
    const from = viewRef.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / 650));
      setView({ x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, w: from.w + (target.w - from.w) * k, h: from.h + (target.h - from.h) * k });
      if (k < 1) anim.current = requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(anim.current);
  }, [fx, fy, fw, fh]);

  const zoom = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const w = Math.min(width * 2, Math.max(width / 8, v.w * factor));
      const h = (w / v.w) * v.h;
      const fx = cx ?? v.x + v.w / 2;
      const fy = cy ?? v.y + v.h / 2;
      return { x: fx - ((fx - v.x) * w) / v.w, y: fy - ((fy - v.y) * h) / v.h, w, h };
    });
  }, [width]);

  // Wheel zoom around the cursor. A native listener so preventDefault works (React's is passive).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const pt = el.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
      zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom]);

  return (
    <div className="canvas-wrap">
      <svg
        ref={svg}
        className="canvas"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-interactive]')) return;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          cancelAnimationFrame(anim.current);
          drag.current = { px: e.clientX, py: e.clientY, view };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = svg.current;
          if (!d || !el) return;
          const scale = d.view.w / el.clientWidth;
          setView({ ...d.view, x: d.view.x - (e.clientX - d.px) * scale, y: d.view.y - (e.clientY - d.py) * scale });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--grid)" />
          </pattern>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" fill="context-stroke" />
          </marker>
        </defs>
        <rect x={-4000} y={-4000} width={10000} height={10000} fill="url(#dots)" />
        {children}
      </svg>
      <div className="canvas-tools" role="group" aria-label={L('Zoom', 'Yakınlaştırma')}>
        <button className="btn small" onClick={() => zoom(1 / 1.25)} aria-label={L('Zoom in', 'Yakınlaştır')}>
          +
        </button>
        <button className="btn small" onClick={() => zoom(1.25)} aria-label={L('Zoom out', 'Uzaklaştır')}>
          −
        </button>
        <button className="btn small" onClick={() => {
            cancelAnimationFrame(anim.current);
            setView(full);
          }}>
          {L('Fit', 'Sığdır')}
        </button>
      </div>
    </div>
  );
}
