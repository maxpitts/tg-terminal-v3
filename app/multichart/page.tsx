import dynamic from "next/dynamic";
import AuthProvider from "@/components/AuthProvider";
const MultiChartClient = dynamic(() => import("./MultiChartClient"), { ssr: false });
export default function MultiChartPage() {
  return <AuthProvider><MultiChartClient /></AuthProvider>;
}
