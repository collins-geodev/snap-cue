import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { authenticatedClient } from "@/lib/server-auth";
import { reviewAccessRequest } from "./access-actions";

export const dynamic = "force-dynamic";

async function modelStatus(model: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "Configuration missing";
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${model}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    return response.ok ? "Model reachable" : `Model check failed (HTTP ${response.status})`;
  } catch {
    return "Model check timed out or could not connect";
  }
}

const accessMessages: Record<string, string> = {
  approved: "Request approved. Clerk sent a setup invitation.",
  declined: "Request declined.",
  reviewed: "This request has already been reviewed or is temporarily locked.",
  invalid: "This access request or decision is invalid.",
  error: "Clerk could not save the decision. Check the queue before trying again.",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  if (process.env.NEXT_PUBLIC_SNAPCUE_MODE !== "cloud") notFound();
  const session = await authenticatedClient();
  if (!session) redirect("/sign-in");
  const overview = await session.client.query(api.admin.overview, {});
  if (!overview) notFound();

  const [accounts, coaching, transcription, realtime, queue, feedback] = await Promise.all([
    clerkClient().then(client => client.users.getCount()).catch(() => null),
    modelStatus("gpt-5-mini"), modelStatus("gpt-transcribe"), modelStatus("gpt-live-transcribe"),
    clerkClient().then(client => client.waitlistEntries.list({ status: "pending", orderBy: "+created_at", limit: 25 })).catch(() => null),
    searchParams,
  ]);
  const stats = [
    ["Registered accounts", accounts ?? "Unavailable"],
    ["Active users today (UTC)", overview.activeToday],
    ["Active user-days", overview.activeUserDays],
    ["Interviews saved", overview.interviews],
    ["Coaching requests admitted", overview.aiRequests],
    ["Recorded transcription requests admitted", overview.transcriptionRequests],
    ["Live transcription sessions admitted", overview.liveSessions],
  ];
  const checks = [
    ["Clerk", accounts === null ? "Owner session verified; account count unavailable" : "Owner session and account count verified"],
    ["Convex", "Connected with owner authorization"],
    ["AI coaching", coaching], ["Recorded transcription", transcription], ["Live transcription", realtime],
  ];
  return (
    <main className="studio-main">
      <Link className="button secondary" href="/studio">Back to studio</Link>
      <div className="page-heading spaced"><div><h1>SnapCue administration</h1><p>Owner access · production health and aggregate usage</p></div></div>
      <section className="card stack" aria-labelledby="access-heading">
        <h2 id="access-heading">Account access requests</h2>
        {feedback.access && Object.hasOwn(accessMessages, feedback.access) && <p role="status">{accessMessages[feedback.access]}</p>}
        {!queue ? <p className="muted">The access queue is unavailable.</p> : queue.data.length === 0 ? <p className="muted">No pending requests.</p> : (
          <>
            <p className="muted">{queue.totalCount} pending. Showing the oldest {queue.data.length} requests.</p>
            <ul className="stack">
              {queue.data.map(entry => (
                <li key={entry.id} className="access-request">
                  <div><strong>{entry.emailAddress}</strong><p className="muted">{new Date(entry.createdAt).toLocaleDateString("en", { timeZone: "UTC" })}</p></div>
                  <form action={reviewAccessRequest} className="actions">
                    <input type="hidden" name="entry" value={entry.id}/>
                    <button className="button primary" name="decision" value="approve" disabled={entry.isLocked}>Approve</button>
                    <button className="button secondary" name="decision" value="decline" disabled={entry.isLocked}>Decline</button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="card stack spaced" aria-labelledby="health-heading">
        <h2 id="health-heading">Service health</h2>
        <dl className="stack">{checks.map(([label, status]) => <div key={label}><dt><strong>{label}</strong></dt><dd className="muted">{status}</dd></div>)}</dl>
        <p className="muted">Model checks confirm that OpenAI returns model metadata. They do not send audio or generate coaching responses.</p>
      </section>
      <section className="card stack spaced" aria-labelledby="usage-heading">
        <h2 id="usage-heading">Usage over the last seven UTC days</h2>
        <div className="stats">{stats.map(([label, value]) => <div className="card stat" key={label}><span className="stat-label">{label}</span><strong>{value}</strong></div>)}</div>
        <p className="muted">The account count is current. Usage counts start when tracking is deployed. Admitted requests can include downstream failures and do not represent billing totals.</p>
      </section>
    </main>
  );
}
