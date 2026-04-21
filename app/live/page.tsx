import dynamic from "next/dynamic";
import AuthProvider from "@/components/AuthProvider";
const LiveClient = dynamic(() => import("./LiveClient"), { ssr: false });
export default function LivePage() {
  return <AuthProvider><LiveClient /></AuthProvider>;
}
