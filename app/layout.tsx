import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantaBase — Financial Data Infrastructure",
  description: "Purpose-built financial database for stock traders.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#000000" />
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
      </head>
      <body style={{ margin:0, padding:0, background:"#000000" }}>
        {children}
      </body>
    </html>
  );
}