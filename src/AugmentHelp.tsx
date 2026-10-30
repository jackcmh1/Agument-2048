import { useEffect, useId, useRef, useState, type ReactElement, cloneElement } from "react";
import { createPortal } from "react-dom";

export function AugmentHelp({ description, children }: {
  description: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const touching = useRef(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function show() {
    const rect = host.current?.firstElementChild?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 150)),
    });
  }
  useEffect(() => {
    const dismiss = () => setPosition(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      clear();
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, []);
  return (
    <div
      ref={host}
      className="augment-help-host"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={() => { clear(); setPosition(null); }}
      onPointerDown={(e) => {
        touching.current = e.pointerType !== "mouse";
        held.current = false;
        if (!touching.current) return;
        clear();
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => { held.current = true; show(); }, 450);
      }}
      onPointerMove={(e) => {
        if (touching.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) {
          clear();
          setPosition(null);
        }
      }}
      onPointerUp={() => { clear(); if (touching.current) setPosition(null); }}
      onPointerCancel={() => { clear(); setPosition(null); }}
      onClickCapture={(e) => {
        if (held.current) { e.preventDefault(); e.stopPropagation(); held.current = false; }
      }}
      onContextMenu={(e) => { if (touching.current) e.preventDefault(); }}
      onFocus={() => { if (!touching.current) show(); }}
      onBlur={() => setPosition(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && position) { setPosition(null); e.stopPropagation(); }
      }}
    >
      {cloneElement(children, { "aria-describedby": id })}
      {position && createPortal(
        <div id={id} role="tooltip" className="augment-help-tooltip" style={position}>
          {description}
        </div>, document.body,
      )}
    </div>
  );
}
