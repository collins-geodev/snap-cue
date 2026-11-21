import Link from "next/link";
import { Waitlist } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { mode } from "@/lib/domain";

export default function WaitlistPage() {
  if (mode === "demo") redirect("/studio");
  return (
    <main className="auth-page">
      <Brand/>
      <Waitlist signInUrl="/sign-in"/>
      <Link href="/sign-in" className="button secondary">Back to sign-in</Link>
    </main>
  );
}
