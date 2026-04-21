import AuthProvider from "@/components/AuthProvider";

export default function ChartLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
