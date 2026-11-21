import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { mode } from "@/lib/domain";
import { Brand } from "@/components/brand";
export default function Page() {
  if (mode === "demo") redirect("/studio");
  return <main className="auth-page"><Brand/><SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/studio" /></main>;
}
