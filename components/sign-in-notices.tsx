"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useRef, type ReactNode } from "react";

export function SignInNotices({ children }: { children: ReactNode }) {
  const notice = useRef<HTMLDetailsElement>(null);
  return (
    <div className="auth-sign-in" onSubmitCapture={() => {
      if (notice.current) notice.current.open = true;
    }}>
      <details ref={notice} className="sign-in-notices">
        <summary className="icon-button" aria-label="Sign-in notifications" title="Sign-in notifications"><Bell size={20} aria-hidden="true"/></summary>
        <section className="card sign-in-notice-panel" aria-labelledby="sign-in-notice-heading">
          <h2 id="sign-in-notice-heading">Sign-in notifications</h2>
          <p>Existing members can sign in. New members need approval from a SnapCue administrator before they can create an account.</p>
          <p>If you’re waiting for approval, check your email for an invitation. If you already received one, use the link in that email to finish setting up your account.</p>
          <Link className="button secondary" href="/waitlist">Request access</Link>
        </section>
      </details>
      {children}
    </div>
  );
}
