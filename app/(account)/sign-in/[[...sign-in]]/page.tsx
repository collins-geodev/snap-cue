import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { mode } from "@/lib/domain";
import { Brand } from "@/components/brand";
import { SignInNotices } from "@/components/sign-in-notices";
export default function Page() {
  if (mode === "demo") redirect("/studio");
  return <main className="auth-page"><Brand/><SignInNotices><SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/studio" /></SignInNotices><Link className="button secondary" href="/waitlist">Request access</Link></main>;
}
