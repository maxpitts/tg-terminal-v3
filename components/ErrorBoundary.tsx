"use client";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; label?: string; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(e: Error): State { return { error: e }; }
  componentDidCatch(e: Error) { console.error("[ErrorBoundary]", this.props.label, e); }
  render() {
    if (this.state.error) {
      return this.props.fallback || (
        <div style={{ padding:12, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)",
          borderRadius:6, fontSize:10, color:"#FF3333", fontFamily:"monospace" }}>
          ⚠ {this.props.label||"Component"} error — {this.state.error.message.slice(0,80)}
          <button onClick={()=>this.setState({error:null})}
            style={{ marginLeft:8, background:"none", border:"1px solid #ef4444", color:"#FF3333",
              borderRadius:4, fontSize:9, padding:"1px 6px", cursor:"pointer" }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
