import type { Metadata, Viewport } from "next";

import { InstallShell } from "@/components/install-shell";
import "./globals.css";

export const metadata: Metadata = { title: "SnapCue — AI Interview Copilot", description: "Hear the question. Find your confidence.", manifest: "/manifest.webmanifest", icons: { icon: "/icon-192.png", apple: "/icon-192.png" }, appleWebApp: { capable: true, title: "SnapCue" } };
export const viewport: Viewport = { themeColor: "#f2f4fb" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}<InstallShell /></body></html>;
}
