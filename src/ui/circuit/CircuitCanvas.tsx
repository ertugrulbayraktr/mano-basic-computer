import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * An SVG drawing area with pan (drag) and zoom (wheel, buttons). `width` × `height` is the
 * drawing's own coordinate system; "Fit" shows all of it.
 */
export function CircuitCanvas({ width, height, children, label }: { width: number; height: number; children: ReactNode; label: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const full: View = { x: -10, y: -10, w: width + 20, h: height + 20 };
  const [view, setView] = useState<View>(full);
  const drag = useRef<{ px: number; py: number; view: View } | null>(null);

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
      <div className="canvas-tools" role="group" aria-label="Zoom">
        <button className="btn small" onClick={() => zoom(1 / 1.25)} aria-label="Zoom in">
          +
        </button>
        <button className="btn small" onClick={() => zoom(1.25)} aria-label="Zoom out">
          −
        </button>
        <button className="btn small" onClick={() => setView(full)}>
          Fit
        </button>
      </div>
    </div>
  );
}
