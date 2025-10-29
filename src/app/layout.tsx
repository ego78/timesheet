// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import InstallPWA from "@/components/InstallPWA"; // ⬅️ banner PWA (client component)

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Foglio Presenze",
  description: "Foglio presenze giornaliero",
  manifest: "/manifest.webmanifest",
  themeColor: "#0ea5e9",
  applicationName: "Ore App",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Foglio Presenze",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        {/* PWA base */}
        <meta name="theme-color" content="#0ea5e9" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* iOS: abilita web app full-screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Foglio Presenze" />

        {/* Android Chrome: suggerimenti (non obbligatori) */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Ore App" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Banner / prompt installazione PWA (Android + istruzioni iOS) */}
        <InstallPWA />

        {children}
      </body>
    </html>
  );
}
