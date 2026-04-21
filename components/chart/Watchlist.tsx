"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WatchItem { ticker: string; price?: number; chg?: number; }

export default function Watchlist({ currentTicker }: { currentTicker: string }) {
  const [items, setItems]     = useState<WatchItem[]>([]);
  const [input, setInput]     = useState("");
  const [open, setOpen]       = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/watchlist");
      const d = await r.json();
      setItems(d.items.map((i: any) => ({ ticker: i.ticker })));
      // Fetch prices for all tickers
      if (d.items.length > 0) {
        const tickers = d.items.map((i:any)=>i.ticker).join(",");
        const snap = await fetch(`/api/polygon/snapshot?tickers=${tickers}`);
        const sd   = await snap.json();
        if (sd.tickers) {
          setItems(d.items.map((i: any) => {
            const t = sd.tickers.find((t:any)=>t.ticker===i.ticker);
            return { ticker: i.ticker, price: t?.price, chg: t?.changePct };
          }));
        }
      }
    } catch {}
  }, []);

  useEffect(() => { const t0 = setTimeout(load, 200); const t = setInterval(load, 30000); return () => { clearTimeout(t0); clearInterval(t); }; }, [load]);

  const add = async () => {
    const t = input.trim().toUpperCase();
    if (!t || items.find(i=>i.ticker===t)) return;
    setInput("");
    await fetch("/api/watchlist", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ticker:t}) });
    load();
  };

  const remove = async (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/watchlist", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ticker}) });
    setItems(prev => prev.filter(i=>i.ticker!==ticker));
  };

  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"6px 10px",cursor:"pointer",background:"#0d0d0d"}}>
        <span style={{fontSize:9,color:"#555555",letterSpacing:1}}>WATCHLIST</span>
        <span style={{fontSize:10,color:"#333333"}}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <>
          {/* Add input */}
          <div style={{display:"flex",gap:4,padding:"6px 10px",borderBottom:"1px solid #1a1a1a"}}>
            <input value={input} onChange={e=>setInput(e.target.value.toUpperCase())}
              onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add ticker..." maxLength={6}
              style={{flex:1,background:"#131313",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:4,color:"#fff",fontSize:11,padding:"3px 6px",outline:"none",fontFamily:"inherit"}}/>
            <button onClick={add}
              style={{background:"rgba(255,149,0,0.12)",border:"1px solid rgba(167,139,250,0.3)",
                color:"#FF9500",borderRadius:4,fontSize:10,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>+</button>
          </div>

          {/* Items */}
          {items.length === 0 ? (
            <div style={{padding:"10px",fontSize:10,color:"#333333",textAlign:"center"}}>No tickers added</div>
          ) : (
            items.map(item => (
              <div key={item.ticker} onClick={()=>router.push(`/chart/${item.ticker}`)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"8px 12px",cursor:"pointer",
                  background:item.ticker===currentTicker?"rgba(255,149,0,0.06)":"transparent",
                  borderLeft:item.ticker===currentTicker?"2px solid #a78bfa":"2px solid transparent"}}
                onMouseEnter={e=>(e.currentTarget.style.background="#111111")}
                onMouseLeave={e=>(e.currentTarget.style.background=item.ticker===currentTicker?"rgba(255,149,0,0.06)":"transparent")}>
                <span style={{fontSize:11,fontWeight:700,color:"#F0F0F0"}}>{item.ticker}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {item.price&&<span style={{fontSize:11,color:"#888888"}}>${item.price.toFixed(2)}</span>}
                  {item.chg!==undefined&&<span style={{fontSize:10,color:item.chg>=0?"#00CC44":"#FF3333"}}>
                    {item.chg>=0?"+":""}{item.chg.toFixed(2)}%
                  </span>}
                  <button onClick={e=>remove(item.ticker,e)}
                    style={{background:"none",border:"none",color:"#333333",fontSize:12,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>×</button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
