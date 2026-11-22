"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, Clipboard, Clock3, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { categories, difficulties, setupSchema, type Setup, type Turn } from "@/lib/domain";
import { PageHeading } from "./page-heading";
import { Button } from "./ui/button";
import { Recording } from "./recording";
import { localAnswer, type AnswerStyle } from "@/lib/local-answer";
import type { Selection, Workspace } from "./workspace-data";

export function SourceSelect({ data, selection, choose }: { data: Workspace; selection: Selection; choose: (selection: Selection) => void }) {
  return <div className="form-grid two">{(["resume", "job"] as const).map(kind => <label key={kind}>{kind === "resume" ? "CV version" : "Job description"}<select value={selection[kind] ?? ""} onChange={event => choose({ ...selection, [kind]: event.target.value || undefined })}><option value="">{kind === "resume" ? "Any relevant CV" : "No job selected"}</option>{data.entries.filter(row => row.kind === kind).map(row => <option value={row.id} key={row.id}>{row.title}</option>)}</select></label>)}</div>;
}
function practiceDeadline(minutes: number) {
  return Date.now() + minutes * 60_000;
}
export function Practice({ data }: { data: Workspace }) {
  const [config, setConfig] = useState<Setup>();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState<Turn>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [seconds, setSeconds] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [selection, choose] = useState<Selection>({});
  const defaultJob = data.entries.find(item => item.kind === "job");
  const { register, handleSubmit, formState: { errors }, setError } = useForm<Setup>({ defaultValues: { category: "Behavioral", difficulty: "Intermediate", count: 5, minutes: 20, role: defaultJob?.title ?? "", organization: defaultJob?.organization ?? "" } });
  useEffect(() => {
    if (!deadline || done) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        clearInterval(timer);
        if (data.settings.notifications) toast.info("Practice time is up. You can submit the current answer.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, done, data.settings.notifications]);
  async function next(active: Setup, history: Turn[]) {
    setBusy(true);
    try {
      setQuestion(await data.question(active, history.map(turn => turn.question), selection));
      setReview(undefined); setAnswer(""); setConfig(active);
      if (!deadline) { setDeadline(practiceDeadline(active.minutes)); setSeconds(active.minutes * 60); }
    } catch { toast.error("Could not load a question. Try again."); }
    finally { setBusy(false); }
  }
  async function assess(event: FormEvent) {
    event.preventDefault();
    if (!config || !answer.trim() || busy) return;
    setBusy(true);
    try {
      const evaluated = await data.assess(question, answer.trim(), config, selection);
      const turn = { question, answer: answer.trim(), assessment: evaluated };
      setReview(turn);
    } catch { toast.error("Could not evaluate this answer. Try again."); }
    finally { setBusy(false); }
  }
  async function continueSession(end: boolean) {
    if (!config || !review || busy) return;
    const updated = [...turns, review];
    setBusy(true);
    try {
      const id = await data.saveSession(config, updated, sessionId);
      setSessionId(id);
      if (end || updated.length >= config.count || seconds === 0) { setTurns(updated); setDone(true); }
      else {
        const nextQuestion = await data.question(config, updated.map(turn => turn.question), selection);
        setTurns(updated); setQuestion(nextQuestion); setReview(undefined); setAnswer("");
      }
    } catch { toast.error("Could not save or continue the interview. Try again."); }
    finally { setBusy(false); }
  }
  return <><PageHeading kicker="PRACTICE STUDIO" title="Mock interview" description="Answer one question at a time and get feedback on what to improve."/>
    {!config ? <section className="card stack readable"><h2>Set up your interview</h2><form className="stack" onSubmit={handleSubmit(value => { const result = setupSchema.safeParse(value); if (result.success) return next(result.data, []); for (const issue of result.error.issues) setError(issue.path[0] as keyof Setup, { message: issue.message }); })}>
      <div className="form-grid two"><label>Target role<input required maxLength={120} {...register("role")} placeholder="e.g. Geospatial Engineer"/>{errors.role && <small role="alert">{errors.role.message}</small>}</label><label>Organization<input maxLength={120} {...register("organization")} placeholder="Optional"/></label><label>Category<select {...register("category")}>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label>Difficulty<select {...register("difficulty")}>{difficulties.map(value => <option key={value}>{value}</option>)}</select></label><label>Question count<input type="number" min={1} max={10} required {...register("count", { valueAsNumber: true })}/></label><label>Duration (minutes)<input type="number" min={2} max={60} required {...register("minutes", { valueAsNumber: true })}/></label></div>
      <SourceSelect data={data} selection={selection} choose={choose}/><div><Button disabled={busy}>{busy ? "Preparing question…" : "Start interview"} <ArrowRight size={17}/></Button></div>
    </form></section> : <section className="card stack readable">
      <div className="card-title"><div><h2>{done ? "Interview complete" : `Question ${turns.length + 1} of ${config.count}`}</h2><p>{config.role} · {config.category} · {config.difficulty}</p></div>{!done && <span className="timer"><Clock3 size={16}/>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}</div>
      <progress max={config.count} value={turns.length + (done ? 0 : 1)}/>
      {done ? <><p>You saved {turns.length} {turns.length === 1 ? "answer" : "answers"} to Interview history.</p><Button onClick={() => { setConfig(undefined); setReview(undefined); setTurns([]); setSessionId(undefined); setDeadline(0); setDone(false); }}>Start another interview</Button></> :
      <><h3 className="question">{question}</h3>{review ? <div className="stack" aria-live="polite">
        <div className="assessment"><motion.strong initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>{review.assessment.score}%</motion.strong><div><h3>{review.assessment.method === "checklist" ? "Practice checklist" : "Feedback"}</h3><p>{review.assessment.feedback}</p></div></div>
        <p>{review.assessment.improvement}</p>{review.assessment.method !== "checklist" && <div className="dimensions">{Object.entries(review.assessment.dimensions).map(([name, value]) => <div className="coverage" key={name}><span className="capitalize">{name}</span><strong>{value}</strong><progress value={value} max={100}/></div>)}</div>}
        <div className="actions"><Button disabled={busy} onClick={() => void continueSession(turns.length + 1 >= config.count || seconds === 0)}>{busy ? "Saving…" : turns.length + 1 >= config.count || seconds === 0 ? "Finish and save" : "Save and continue"}</Button>{turns.length + 1 < config.count && seconds !== 0 && <Button variant="secondary" disabled={busy} onClick={() => void continueSession(true)}>Finish here</Button>}</div>
      </div> : <form className="stack" onSubmit={assess}><label>Your answer<textarea required maxLength={6000} rows={6} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Type your response or use the microphone."/></label><Recording key={question} demo={data.demo} microphone={data.settings.microphone} language={data.settings.language} disabled={busy} onText={text => setAnswer(previous => [previous, text].filter(Boolean).join(" ").slice(0, 6000))}/><div><Button disabled={busy || !answer.trim()}>{busy ? "Evaluating…" : "Evaluate answer"} <Sparkles size={17}/></Button></div></form>}</>}
    </section>}
  </>;
}
type Style = AnswerStyle;
export async function streamAnswer(question: string, style: Style, expanded: boolean, selection: Selection, signal: AbortSignal, update: (text: string) => void) {
  const response = await fetch("/api/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, style, expanded, ...selection }), signal });
  if (!response.ok || !response.body) throw new Error("Could not generate a suggestion.");
  const stream = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  let completed = false;
  try {
    for (;;) {
      const { value, done } = await stream.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ") || line.trim() === "data: [DONE]") continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === "response.output_text.delta") { text += event.delta; update(text); }
        if (event.type === "response.completed") completed = true;
        if (["response.incomplete", "response.failed", "error"].includes(event.type)) throw new Error("The suggestion was interrupted.");
      }
    }
    if (!text || !completed) throw new Error("The suggestion was interrupted.");
  } finally { await stream.cancel().catch(() => undefined); stream.releaseLock(); }
}
export function sampleAnswer(style: Style, expanded = false) {
  return (style === "Technical" ? "Define the requirements and constraints first. Explain your approach, the trade-offs, and how you would validate it." :
    style === "STAR" ? "Situation: Set the context. Task: State your responsibility. Action: Explain what you personally did. Result: Give an outcome you can verify." :
    "Start with your most relevant example and state the outcome up front. Then explain how you got there.") +
    "\n\n• Pick one relevant example.\n• Name the action you took.\n• Use evidence you can verify." +
    (expanded ? "\n• Explain the trade-off you considered.\n• Close with how you would apply the lesson to this role." : "") +
    "\n\nSource quality: General guidance · simulated demo";
}
export function AnswerAssistant({ data }: { data: Workspace }) {
  const [question, setQuestion] = useState("");
  const [style, setStyle] = useState<Style>("Concise");
  const [expanded, setExpanded] = useState(false);
  const [selection, choose] = useState<Selection>({});
  const [suggestion, setSuggestion] = useState("");
  const [elapsed, setElapsed] = useState<number>();
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    active.current?.abort();
    const task = new AbortController();
    active.current = task;
    const start = performance.now();
    setBusy(true); setSuggestion(""); setElapsed(undefined);
    try {
      if (data.demo) setSuggestion(sampleAnswer(style, expanded));
      else await streamAnswer(question, style, expanded, selection, AbortSignal.any([task.signal, AbortSignal.timeout(12_000)]), setSuggestion);
      setElapsed(Math.round(performance.now() - start));
    } catch {
      if (!task.signal.aborted) {
        const resume = data.entries.find(entry => entry.id === selection.resume && entry.kind === "resume");
        const job = data.entries.find(entry => entry.id === selection.job && entry.kind === "job");
        setSuggestion(localAnswer(question, style, expanded, resume, job));
        setElapsed(Math.round(performance.now() - start));
      }
    }
    finally { if (active.current === task) setBusy(false); }
  }
  return <><PageHeading kicker="COACHING" title="Answer assistant" description="Turn an interview question into talking points grounded in your experience."/><div className="content-grid">
    <section className="card stack"><h2>Interview question</h2><form className="stack" onSubmit={generate}><label>Question transcript<textarea required maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} rows={5} placeholder="Paste or record a question…"/></label>
      <Recording demo={data.demo} microphone={data.settings.microphone} language={data.settings.language} disabled={busy} onText={text => setQuestion(data.demo ? "Tell me about a time you solved a complex problem." : text.slice(0, 2000))}/>
      <SourceSelect data={data} selection={selection} choose={choose}/>
      <label>Answer format<select value={style} onChange={event => setStyle(event.target.value as Style)}>{["Concise", "STAR", "Technical"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={expanded} onChange={event => setExpanded(event.target.checked)}/> Expand the answer</label>
      <div className="actions"><Button disabled={!question.trim() || busy}><Sparkles size={16}/> {busy ? "Generating…" : "Generate suggestion"}</Button>{busy && <Button type="button" variant="secondary" onClick={() => { active.current?.abort(); setBusy(false); }}>Cancel</Button>}</div>
    </form></section><section className="card stack"><div className="card-title"><div><h2>Suggested talking points</h2><p>Use details you can verify.</p></div><Sparkles size={20}/></div>
    {suggestion ? <p className="prewrap">{suggestion}</p> : <p className="empty" role="status">{busy ? "Preparing your suggestion…" : "Add a question to get a suggested answer."}</p>}
    {suggestion && <div className="actions"><Button variant="secondary" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(suggestion); toast.success("Copied"); } catch { toast.error("Clipboard unavailable"); } }}><Clipboard size={16}/> Copy response</Button>{elapsed !== undefined && !data.demo && <small className="muted">Generated in {elapsed} ms</small>}</div>}</section>
  </div></>;
}
