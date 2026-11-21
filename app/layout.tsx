import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { mode } from "@/lib/domain";
import { Toaster } from "sonner";
import { InstallShell } from "@/components/install-shell";
import "./globals.css";

export const metadata: Metadata = { title: "SnapCue — AI Interview Copilot", description: "Hear the question. Find your confidence.", manifest: "/manifest.webmanifest", icons: { icon: "/icon-192.png", apple: "/icon-192.png" }, appleWebApp: { capable: true, title: "SnapCue" } };
export const viewport: Viewport = { themeColor: "#0b1020" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = <>{children}<Toaster richColors position="bottom-right" /><InstallShell /></>;
  return <html lang="en" suppressHydrationWarning><body>{mode === "cloud" ? <ClerkProvider>{content}</ClerkProvider> : content}</body></html>;
}
