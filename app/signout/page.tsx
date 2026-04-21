"use client";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import AuthProvider from "@/components/AuthProvider";

function SignOutInner() {
  useEffect(() => { signOut({ callbackUrl: "/" }); }, []);
  return (
    <div style={{ width:"100vw", height:"100vh", background:"#07070f",
      display:"flex", alignItems:"center", justifyContent:"center", color:"#475569", fontSize:13 }}>
      Signing out...
    </div>
  );
}

export default function SignOutPage() {
  return <AuthProvider><SignOutInner /></AuthProvider>;
}
