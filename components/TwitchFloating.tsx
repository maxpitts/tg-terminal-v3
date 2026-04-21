"use client";
import { useState, useRef, useEffect } from "react";

const TWITCH_CHANNEL = "Freewifiradi0";

interface Props { onClose: () => void; }

export default function TwitchFloating({ onClose }: Props) {
  const [pos, setPos]       = useState({ x: 20, y: 80 });
  const [size, setSize]     = useState({ w: 320, h: 180 });
  const [minimized, setMin] = useState(false);
  const [muted, setMuted]   = useState(true);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset   = useRef({ x: 0, y: 0 });
  const startRes = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
      }
      if (resizing.current) {
        const dx = e.clientX - startRes.current.mx;
        const dy = e.clientY - startRes.current.my;
        setSize({
          w: Math.max(240, startRes.current.w + dx),
          h: Math.max(135, startRes.current.h + dy),
        });
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const openPopout = () => {
    window.open("/live/popout", "tg-live",
      `width=${size.w},height=${size.h + 32},left=${pos.x},top=${pos.y},resizable=yes,scrollbars=no`
    );
  };

  const hostname = typeof window !== "undefined" ? window.location.hostname : "tradesandgains.app";
  const src = `https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${hostname}&parent=tradesandgains.app&autoplay=true&muted=${muted}&controls=true`;

  return (
    <div ref={panelRef} style={{
      position: "fixed", left: pos.x, top: pos.y, zIndex: 1000,
      width: size.w, background: "#0e0e10",
      border: "1px solid rgba(167,139,250,0.3)",
      borderRadius: 8, overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      userSelect: "none",
    }}>
      {/* Drag handle */}
      <div onMouseDown={e => { dragging.current = true; offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; e.preventDefault(); }}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"5px 8px", background:"#1a1a2e", cursor:"grab",
          borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:8, color:"#334155" }}>⠿</span>
          <span style={{ fontSize:10, color:"#a78bfa", fontWeight:700, fontFamily:"monospace" }}>
            T&G Live
          </span>
          <span style={{ fontSize:8, color:"#ef4444", animation:"pulse 2s infinite",
            background:"rgba(239,68,68,0.15)", padding:"1px 5px", borderRadius:3 }}>● LIVE</span>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          <button onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute"}
            style={btnStyle}>{muted ? "🔇" : "🔊"}</button>
          <button onClick={openPopout} title="Pop out to new window"
            style={btnStyle}>⧉</button>
          <button onClick={() => setMin(m => !m)} title={minimized ? "Expand" : "Minimize"}
            style={btnStyle}>{minimized ? "▼" : "▲"}</button>
          <button onClick={onClose} title="Close"
            style={{...btnStyle, color:"#ef4444"}}>×</button>
        </div>
      </div>

      {/* Video */}
      {!minimized && (
        <div style={{ position:"relative" }}>
          <iframe
            src={src}
            width={size.w} height={size.h}
            style={{ display:"block", border:"none" }}
            allowFullScreen
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals"
            title="T&G Live"
          />
          {/* Resize handle */}
          <div onMouseDown={e => {
            resizing.current = true;
            startRes.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
            e.preventDefault(); e.stopPropagation();
          }}
            style={{ position:"absolute", bottom:0, right:0, width:16, height:16,
              cursor:"nwse-resize", background:"rgba(167,139,250,0.2)",
              borderTopLeftRadius:4, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:8, color:"#475569", lineHeight:1 }}>⤡</span>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background:"none", border:"none", color:"#64748b", fontSize:13,
  cursor:"pointer", padding:"0 3px", lineHeight:1,
};
