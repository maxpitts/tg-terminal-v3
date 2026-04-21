// components/chart/DraggablePanel.tsx
"use client";
import { useRef, useState, useEffect, ReactNode } from "react";

interface Props {
  title: string;
  color: string;
  defaultX: number;
  defaultY: number;
  children: ReactNode;
  visible: boolean;
  storageKey: string;
}

export default function DraggablePanel({ title, color, defaultX, defaultY, children, visible, storageKey }: Props) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [minimized, setMinimized] = useState(false);
  const dragging = useRef(false);
  const offset   = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`panel-pos-${storageKey}`);
      if (saved) setPos(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newPos = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y };
      setPos(newPos);
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        try { localStorage.setItem(`panel-pos-${storageKey}`, JSON.stringify(pos)); } catch {}
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [pos, storageKey]);

  if (!visible) return null;

  return (
    <div ref={panelRef} style={{
      position: "absolute",
      left: pos.x, top: pos.y,
      zIndex: 30,
      width: "fit-content", minWidth: 200,
      background: "rgba(0,0,0,0.97)",
      border: `1px solid ${color}33`,
      borderRadius: 6,
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      userSelect: "none",
    }}>
      {/* Drag handle */}
      <div onMouseDown={onMouseDown}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"5px 8px", background:"#0a0a0a", cursor:"grab",
          borderBottom:`1px solid ${color}22` }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:9, color:"#333333" }}>⠿</span>
          <span style={{ fontSize:11, color, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>{title}</span>
        </div>
        <button onClick={() => setMinimized(m => !m)}
          style={{ background:"none", border:"none", color:"#555555", fontSize:12, cursor:"pointer", lineHeight:1, padding:"0 2px" }}>
          {minimized ? "▼" : "▲"}
        </button>
      </div>
      {!minimized && <div>{children}</div>}
    </div>
  );
}
