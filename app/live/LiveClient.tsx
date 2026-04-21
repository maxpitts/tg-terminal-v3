"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const TWITCH_CHANNEL = "Freewifiradi0"; // ← your channel name here

export default function LiveClient() {
  const embedRef   = useRef<HTMLDivElement>(null);
  const playerRef  = useRef<any>(null);
  const [isLive, setIsLive]     = useState<boolean|null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const { data: session }       = useSession();

  useEffect(() => {
    if (!embedRef.current || playerRef.current) return;

    // Load Twitch embed script
    const script = document.createElement("script");
    script.src = "https://embed.twitch.tv/embed/v1.js";
    script.async = true;
    script.onload = () => {
      if (!(window as any).Twitch?.Embed) return;
      playerRef.current = new (window as any).Twitch.Embed(embedRef.current, {
        width:  "100%",
        height: "100%",
        channel: TWITCH_CHANNEL,
        layout: "video",        // video only — chat handled separately
        autoplay: true,
        muted: false,
        theme: "dark",
        parent: [window.location.hostname, "tradesandgains.app", "www.tradesandgains.app"],
      });

      playerRef.current.addEventListener((window as any).Twitch.Embed.VIDEO_READY, () => {
        const player = playerRef.current.getPlayer();
        // Check if live
        player.addEventListener((window as any).Twitch.Player.ONLINE, () => setIsLive(true));
        player.addEventListener((window as any).Twitch.Player.OFFLINE, () => setIsLive(false));
      });
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh",
      background:"#07070f", fontFamily:"'JetBrains Mono',monospace" }}>

      {/* Nav */}
      <nav style={{ height:48, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 16px", background:"rgba(7,7,15,0.98)",
        borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <a href="/chart/SPY" style={{ color:"#64748b", textDecoration:"none", fontSize:11 }}>← Charts</a>
          <span style={{ color:"#1e293b" }}>|</span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#f1f5f9",
              fontFamily:"'Outfit',sans-serif" }}>
              T&G <span style={{color:"#a78bfa"}}>Live</span>
            </span>
            {isLive === true && (
              <span style={{ fontSize:9, fontWeight:700, color:"#ef4444",
                background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)",
                padding:"2px 7px", borderRadius:3, letterSpacing:1, animation:"pulse 2s infinite" }}>
                ● LIVE
              </span>
            )}
            {isLive === false && (
              <span style={{ fontSize:9, color:"#475569",
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                padding:"2px 7px", borderRadius:3 }}>
                OFFLINE
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => setChatOpen(o => !o)}
            style={{ fontSize:10, padding:"4px 12px", borderRadius:5, cursor:"pointer",
              fontFamily:"inherit", border:"1px solid",
              borderColor: chatOpen ? "#a78bfa" : "rgba(255,255,255,0.1)",
              background: chatOpen ? "rgba(167,139,250,0.15)" : "transparent",
              color: chatOpen ? "#a78bfa" : "#64748b" }}>
            💬 Chat
          </button>
          <a href={`https://twitch.tv/${TWITCH_CHANNEL}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:10, padding:"4px 12px", borderRadius:5, textDecoration:"none",
              border:"1px solid rgba(100,65,165,0.4)", background:"rgba(100,65,165,0.15)",
              color:"#bf94ff" }}>
            ↗ Twitch
          </a>
        </div>
      </nav>

      {/* Main area */}
      <div style={{ flex:1, display:"grid", overflow:"hidden",
        gridTemplateColumns: chatOpen ? "1fr 340px" : "1fr" }}>

        {/* Video */}
        <div ref={embedRef} style={{ width:"100%", height:"100%", background:"#000" }} />

        {/* Chat iframe */}
        {chatOpen && (
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.07)",
            display:"flex", flexDirection:"column", background:"#0e0e10" }}>
            <div style={{ padding:"6px 10px", borderBottom:"1px solid rgba(255,255,255,0.07)",
              fontSize:9, color:"#475569", letterSpacing:1 }}>
              LIVE CHAT
            </div>
            <iframe
              src={`https://www.twitch.tv/embed/${TWITCH_CHANNEL}/chat?darkpopout&parent=${typeof window !== "undefined" ? window.location.hostname : "tradesandgains.app"}`}
              style={{ flex:1, border:"none", width:"100%", height:"100%" }}
              title="Twitch Chat"
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
