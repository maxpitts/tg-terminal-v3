"use client";
import { useEffect, useRef } from "react";
const TWITCH_CHANNEL = "Freewifiradi0";
export default function PopoutPage() {
  const embedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!embedRef.current) return;
    const script = document.createElement("script");
    script.src = "https://embed.twitch.tv/embed/v1.js";
    script.async = true;
    script.onload = () => {
      if (!(window as any).Twitch?.Embed) return;
      new (window as any).Twitch.Embed(embedRef.current, {
        width:"100%", height:"100%", channel:TWITCH_CHANNEL,
        layout:"video", autoplay:true, theme:"dark",
        parent:[window.location.hostname,"tradesandgains.app"],
      });
    };
    document.head.appendChild(script);
  }, []);
  return (
    <html><body style={{margin:0,padding:0,background:"#000",overflow:"hidden"}}>
      <div ref={embedRef} style={{width:"100vw",height:"100vh"}}/>
    </body></html>
  );
}
