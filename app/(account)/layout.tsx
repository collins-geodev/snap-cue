import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const proxyUrl = process.env.VERCEL_ENV === "production" ? "/__clerk" : undefined;
  const content = <>{children}<Toaster richColors position="bottom-right" /></>;
  return process.env.NEXT_PUBLIC_SNAPCUE_MODE === "cloud" ? <ClerkProvider proxyUrl={proxyUrl}>{content}</ClerkProvider> : content;
}
