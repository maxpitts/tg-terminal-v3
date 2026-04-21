import dynamic from "next/dynamic";
import AuthProvider from "@/components/AuthProvider";

const GexTerminal = dynamic(() => import("./GexTerminal"), { ssr: false });

export default function GexPage() {
  return (
    <AuthProvider>
      <GexTerminal />
    </AuthProvider>
  );
}
