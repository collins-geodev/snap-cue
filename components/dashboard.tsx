"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { download } from "@/lib/download";
import { Activity, ArrowRight, AudioLines, BriefcaseBusiness, ChartNoAxesCombined, ChevronRight, Clock3, Mic, Target } from "lucide-react";

import { useState } from "react";
import type { Session } from "@/lib/domain";
import type { Workspace } from "./workspace-data";
import { PageHeading } from "./page-heading";
import { Button } from "./ui/button";
import { toast } from "sonner";

const PerformanceChart = dynamic(() => import("./performance-chart").then(module => module.PerformanceChart), { ssr: false });
const dates = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const date = (stamp: number) => dates.format(stamp);
const score = (row: Session) => Math.round(row.turns.reduce((sum, turn) => sum + turn.assessment.score, 0) / Math.max(row.turns.length, 1));

export function Dashboard({ data }: { data: Workspace }) {
  const { sessions } = data;
  const average = sessions.length ? Math.round(sessions.reduce((sum, row) => sum + score(row), 0) / sessions.length) : null;
  const job = data.entries.find(row => row.kind === "job");
  const assessed = sessions.flatMap(row => row.turns);
  const change = sessions.length > 1 ? score(sessions[0]) - score(sessions[sessions.length - 1]) : null;
  const competencies = Object.entries(sessions.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.category]: (counts[row.category] ?? 0) + row.turns.length }), {})).sort((a, b) => b[1] - a[1]);
  const trend = [...sessions].reverse().slice(-12).map(row => ({ name: date(row.created), Score: score(row), Communication: Math.round(row.turns.reduce((sum, turn) => sum + turn.assessment.dimensions.communication, 0) / row.turns.length) }));
  return <>
    <PageHeading kicker="WORKSPACE OVERVIEW" title={`Welcome back, ${data.name}.`} description="Build confidence one answer at a time." action={<Button asChild><Link href="/studio/practice"><Mic size={17}/> Quick start interview</Link></Button>}/>
    {data.demo && <p className="demo-note"><span>Demo workspace</span> · Sample results and simulated coaching. Your changes stay in this browser.</p>}
    <div className="stats">
      {[{ icon: Mic, label: "Practice interviews", value: sessions.length, sub: "Saved sessions", color: "violet" }, { icon: Target, label: "Average score", value: average === null ? "—" : `${average}%`, sub: "Across saved sessions", color: "teal" }, { icon: Activity, label: "Answers reviewed", value: assessed.length, sub: "Responses with feedback", color: "blue" }, { icon: ChartNoAxesCombined, label: "Score change", value: change === null ? "—" : `${change > 0 ? "+" : ""}${change}`, sub: "First to latest, in points", color: "pink" }].map(({ icon: Icon, label, value, sub, color }) => <article className="card stat" key={label}><span className={`stat-icon ${color}`}><Icon size={20}/></span><span className="stat-label">{label}</span><strong>{value}</strong><small>{sub}</small></article>)}
    </div>
    <div className="dashboard-grid">
      <section className="card chart-card"><div className="card-title"><div><h2>Practice performance</h2><p>Scores and communication across sessions</p></div><Activity size={19}/></div>
        {trend.length ? <div className="chart" role="img" aria-label={trend.map(row => `${row.name}: score ${row.Score}, communication ${row.Communication}`).join("; ")}><PerformanceChart trend={trend}/></div> : <p className="empty">Complete a practice answer to see your progress here.</p>}
      </section>
      <section className="card prep-card"><div className="card-title"><div><h2>Upcoming preparation</h2><p>Focus on the role you’re pursuing</p></div><BriefcaseBusiness size={18}/></div><div className="prep-callout"><span className="stat-icon violet"><BriefcaseBusiness size={21}/></span><h3>{job?.title ?? "Add a target role"}</h3><p>{job?.organization || "Save a job description for tailored practice."}</p><Button asChild variant="secondary"><Link href="/studio/jobs">{job ? "Open job intelligence" : "Add job description"} <ArrowRight size={15}/></Link></Button></div></section>
      <section className="card recent"><div className="card-title"><div><h2>Recent interviews</h2><p>Return to your practice and feedback</p></div><Link href="/studio/history">View history <ChevronRight size={15}/></Link></div>{sessions.slice(0, 4).map(row => <Link className="session-row" key={row.id} href="/studio/history"><span className="stat-icon violet"><AudioLines size={18}/></span><span><strong>{row.role}</strong><small>{row.category} · {date(row.created)}</small></span><span className="score-pill">{score(row)}%</span></Link>)}{!sessions.length && <p className="empty">Your saved practice interviews will appear here.</p>}</section>
      <section className="card"><div className="card-title"><div><h2>Frequently tested areas</h2><p>Questions answered by interview category</p></div><Target size={18}/></div>{competencies.length ? competencies.map(([label, count]) => <div className="coverage" key={label}><span>{label}</span><strong>{count}</strong><progress value={count} max={assessed.length}/></div>) : <p className="empty">Practice across categories to see your coverage.</p>}</section>
    </div>
  </>;
}
export function HistoryView({ data }: { data: Workspace }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const rows = data.sessions.filter(row => (!role || row.role === role) && (!org || row.organization === org) && [row.role, row.organization, row.category, ...row.turns.flatMap(turn => [turn.question, turn.answer])].some(value => value.toLowerCase().includes(search.toLowerCase())));
  return <><PageHeading kicker="REVIEW" title="Interview history" description="Revisit your answers, feedback and interview scores." action={<Button variant="secondary" onClick={() => download("snapcue-interviews.json", rows)}>Export results</Button>}/>
    <section className="card stack"><div className="form-grid"><label>Search interviews<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questions, answers or roles"/></label><label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="">All roles</option>{[...new Set(data.sessions.map(row => row.role))].map(value => <option key={value}>{value}</option>)}</select></label><label>Organization<select value={org} onChange={event => setOrg(event.target.value)}><option value="">All organizations</option>{[...new Set(data.sessions.map(row => row.organization).filter(Boolean))].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {rows.map(row => <details key={row.id} className="record"><summary><strong>{row.role}</strong><span><Clock3 size={15}/> {date(row.created)} · {row.category} · {score(row)}%</span></summary><div className="record-content"><p>{row.organization || "General preparation"} · {row.difficulty}</p>{row.turns.map((turn, index) => <article className="answer-review" key={index}><h3>{turn.question}</h3><p>{turn.answer}</p><strong>Feedback · {turn.assessment.score}%</strong><p>{turn.assessment.feedback}</p><p>{turn.assessment.improvement}</p></article>)}<div className="actions"><Button variant="secondary" onClick={() => download("snapcue-interview.json", row)}>Export interview</Button><Button variant="danger" onClick={async () => { if (window.confirm("Delete this interview and all its answers?")) try { await data.removeSession(row.id); toast.success("Interview deleted"); } catch { toast.error("Could not delete interview"); } }}>Delete interview</Button></div></div></details>)}
    {!rows.length && <p className="empty">No interviews match your search.</p>}</section>
    {!!data.transcripts.length && <section className="card stack"><h2>Saved live transcripts</h2>{data.transcripts.map(row => <details className="record" key={row.id}><summary>Live session · {date(row.created)}</summary><div className="record-content"><p className="prewrap">{row.text}</p><Button variant="danger" onClick={async () => { if (window.confirm("Delete this saved transcript?")) try { await data.removeTranscript(row.id); } catch { toast.error("Could not delete transcript"); } }}>Delete transcript</Button></div></details>)}</section>}
  </>;
}
