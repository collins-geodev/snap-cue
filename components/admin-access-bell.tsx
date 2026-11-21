"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Snapshot = { count: number; version: string };
const intervalMs = 15_000;

export function AdminAccessBell({ initial }: { initial: Snapshot | null }) {
  const router = useRouter();
  const lastNotifiedVersion = useRef(initial?.version);

  useEffect(() => {
    let request: AbortController | undefined;
    async function refresh() {
      if (document.visibilityState !== "visible" || request) return;
      const pending = new AbortController();
      request = pending;
      try {
        const response = await fetch("/api/admin/access-requests", { cache: "no-store", signal: pending.signal });
        if (!response.ok || pending.signal.aborted || response.redirected) return;
        const next: Snapshot = await response.json();
        if (pending.signal.aborted || next.version === initial?.version) return;
        if (next.count > (initial?.count ?? 0) && next.version !== lastNotifiedVersion.current) {
          toast.info("New account access request.");
          lastNotifiedVersion.current = next.version;
        }
        router.refresh();
      } catch {
        // Keep showing the most recent successful queue result.
      } finally {
        if (request === pending) request = undefined;
      }
    }
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      request?.abort();
    };
  }, [initial, router]);

  const count = initial?.count;
  const label = count === undefined ? "Access request notifications" : `Access request notifications, ${count} pending`;
  return (
    <details className="sign-in-notices admin-access-notices">
      <summary className="icon-button" aria-label={label} title="Access request notifications">
        <Bell size={20} aria-hidden="true"/>
        {!!count && <span className="access-notice-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
      </summary>

      <section className="card sign-in-notice-panel" aria-labelledby="admin-access-notice-heading">
        <h2 id="admin-access-notice-heading">Access request notifications</h2>
        <p>{count === undefined ? "Request count unavailable." : count === 0 ? "No account requests are waiting." : `${count} account ${count === 1 ? "request is" : "requests are"} waiting for review.`}</p>
        <a className="button secondary" href="#access-heading">Review requests</a>
      </section>
    </details>
  );
}
