"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Snapshot = { count: number; version: string };
const intervalMs = 15_000;

export function AdminAccessBell({ initial }: { initial?: Snapshot | null }) {
  const router = useRouter();
  const inAdmin = initial !== undefined;
  const [live, setLive] = useState<Snapshot | null>(null);
  const lastSeen = useRef(initial ?? null);

  useEffect(() => {
    if (initial) lastSeen.current = initial;
    let request: AbortController | undefined;
    async function refresh() {
      if (document.visibilityState !== "visible" || request) return;
      const pending = new AbortController();
      request = pending;
      try {
        const response = await fetch("/api/admin/access-requests", { cache: "no-store", signal: pending.signal });
        if (!response.ok || pending.signal.aborted || response.redirected) return;
        const next: Snapshot = await response.json();
        if (pending.signal.aborted) return;
        const previous = lastSeen.current;
        if (previous && next.version !== previous.version && next.count > previous.count) {
          toast.info("New account access request.");
        }
        lastSeen.current = next;
        if (inAdmin) {
          if (next.version !== initial?.version) router.refresh();
        } else if (next.version !== previous?.version) {
          setLive(next);
        }
      } catch {
        // Keep showing the most recent successful queue result.
      } finally {
        if (request === pending) request = undefined;
      }
    }
    if (!initial) void refresh();
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      request?.abort();
    };
  }, [inAdmin, initial, router]);

  const count = (inAdmin ? initial : live)?.count;
  const label = count === undefined ? "Access request notifications" : `Access request notifications, ${count} pending`;
  return (
    <details className={`sign-in-notices admin-access-notices${inAdmin ? "" : " studio-access-notices"}`}>
      <summary className="button secondary access-notice-trigger" aria-label={label} title="Access request notifications">
        <Bell size={20} aria-hidden="true"/><span className="access-notice-label">Notifications</span>
        {count !== undefined && <span className="access-notice-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
      </summary>

      <section className="card sign-in-notice-panel" aria-labelledby="admin-access-notice-heading">
        <h2 id="admin-access-notice-heading">Access request notifications</h2>
        <p>{count === undefined ? "Request count unavailable." : count === 0 ? "No account requests are waiting." : `${count} account ${count === 1 ? "request is" : "requests are"} waiting for review.`}</p>
        <Link className="button secondary" href={inAdmin ? "#access-heading" : "/admin#access-heading"}
          onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>Review requests</Link>
      </section>
    </details>
  );
}
