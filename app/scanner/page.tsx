import dynamic from "next/dynamic";
import AuthProvider from "@/components/AuthProvider";
const ScannerClient = dynamic(() => import("./ScannerClient"), { ssr: false });
export default function ScannerPage() {
  return <AuthProvider><ScannerClient /></AuthProvider>;
}
