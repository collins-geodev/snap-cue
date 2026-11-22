"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Mic, Pause, Play, ShieldCheck, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "./page-heading";
import { Button } from "./ui/button";
import { Wave } from "./wave";
import { SourceSelect } from "./practice";
import type { captureSpokenTurns } from "@/lib/live-audio";
import { matchJobLocally } from "@/lib/job-matching";
import type { Selection, Workspace } from "./workspace-data";

type Status = "idle" | "connecting" | "active" | "paused" | "finishing" | "stopped";
type Capture = {
  abort: AbortController;
  stream?: MediaStream;
  audio?: AudioContext;
  turns?: ReturnType<typeof captureSpokenTurns>;
  expires?: ReturnType<typeof setTimeout>;
  pending: Promise<void>;
  queued: number;
};

function close(capture?: Capture) {
  if (!capture) return;
  capture.abort.abort();
  if (capture.expires) clearTimeout(capture.expires);
  void capture.turns?.finish().catch(() => undefined);
  capture.stream?.getTracks().forEach(track => track.stop());
  void capture.audio?.close().catch(() => undefined);
}

function talkingPoints(prompt: string) {
  if (/\b(how would|what would|approach|design|validate)\b/i.test(prompt)) {
    return "• Clarify the goal and constraints.\n• Explain your approach and the main trade-off.\n• Describe how you would validate the result.";
  }
  return "• Answer the question directly.\n• Give a relevant example and explain your contribution.\n• Close with the result or what you learned.";
}

export function Live({ data }: { data: Workspace }) {
  const [allowed, setAllowed] = useState(false);
  const [recordingAllowed, setRecordingAllowed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [partial, setPartial] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [notes, setNotes] = useState("");
  const [selection, choose] = useState<Selection>({});
  const [latency, setLatency] = useState<number>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const capture = useRef<Capture | undefined>(undefined);

  function stop(message?: string) {
    const current = capture.current;
    capture.current = undefined;
    close(current);
    setPartial("");
    setStatus("stopped");
    if (message) toast.info(message);
  }
  useEffect(() => {
    const interrupt = () => {
      if (capture.current) stop("Microphone disconnected. Start again when you’re ready.");
    };
    const hidden = () => { if (document.visibilityState === "hidden" && capture.current) stop("Microphone stopped when SnapCue moved to the background."); };

    window.addEventListener("pagehide", interrupt);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", interrupt);
      document.removeEventListener("visibilitychange", hidden);
      const active = capture.current;
      capture.current = undefined;
      close(active);
    };
  }, []);
  function propose(prompt: string) {
    if (!prompt.trim()) return;
    const resume = data.entries.find(entry => entry.id === selection.resume && entry.kind === "resume");
    const job = data.entries.find(entry => entry.id === selection.job && entry.kind === "job");
    const skills = job?.analysis?.skills ?? (job ? matchJobLocally(job.text, []).skills : []);
    const relevant = skills.find(skill => skill && prompt.toLowerCase().includes(skill.toLowerCase()));
    const supported = resume && relevant && matchJobLocally(resume.text, []).skills.includes(relevant);
    setAnswer(talkingPoints(prompt) + (supported ? `\n• Consider a concrete example from your selected CV that uses ${relevant}.` : ""));
  }
  function accept(text: string, turnTime?: number) {
    if (!text.trim()) return;
    setTranscript(previous => [previous, text].filter(Boolean).join("\n").slice(-25000));
    if (turnTime !== undefined) setLatency(Math.round(performance.now() - turnTime));
    if (/\?|\b(tell me|describe|explain|walk me through|how (did|would|do)|what (was|is|would)|can you)\b/i.test(text)) {
      setQuestion(text.slice(0, 2000));
      propose(text);
    }
  }
  async function finish() {
    const active = capture.current;
    if (!active?.turns || status === "finishing") { stop(); return; }
    setStatus("finishing");
    if (active.expires) clearTimeout(active.expires);
    try {
      await active.turns.finish();
      active.stream?.getTracks().forEach(track => track.stop());
      await active.pending;
    } catch {
      toast.error("Could not finish the current spoken turn.");
    } finally {
      if (capture.current === active) stop();
    }
  }
  async function start() {
    if (!allowed || !recordingAllowed || capture.current) return;
    setTranscript(""); setPartial(""); setQuestion(""); setAnswer(""); setSaved(false); setLatency(undefined);
    if (data.demo) { setStatus("active"); return; }
    const active: Capture = { abort: new AbortController(), pending: Promise.resolve(), queued: 0 };
    capture.current = active;
    setStatus("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.MediaRecorder || !window.OfflineAudioContext || !window.Worker) {
        throw new Error("Live transcription requires a supported browser and secure connection.");
      }
      const audio = new AudioContext();
      active.audio = audio;
      await audio.resume();
      const mic = data.settings.microphone;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: mic ? { deviceId: { exact: mic } } : true });
      if (active.abort.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      active.stream = stream;
      stream.getAudioTracks().forEach(track => track.addEventListener("ended", () => {
        if (capture.current === active) stop("Microphone disconnected.");
      }));
      const response = await fetch("/api/speech?live=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed, recordingAllowed, onDevice: true }), signal: active.abort.signal,
      });
      if (!response.ok) throw new Error("Could not start the session. Check your connection or try again later.");
      const [{ captureSpokenTurns }, { transcribeRecording }] = await Promise.all([
        import("@/lib/live-audio"), import("@/lib/browser-transcription"),
      ]);
      active.abort.signal.throwIfAborted();
      active.turns = captureSpokenTurns(stream, audio, (clip, turnTime) => {
        if (active.abort.signal.aborted) return;
        if (active.queued >= 5) {
          stop("Speech recognition fell behind. Start another session and leave a short pause between turns.");
          return;
        }
        active.queued++;
        active.pending = active.pending.then(async () => {
          if (active.abort.signal.aborted) return;
          setPartial("Preparing speech recognition…");
          try {
            const text = await transcribeRecording(clip, data.settings.language, active.abort.signal, () => setPartial("Transcribing on this device…"));
            if (!active.abort.signal.aborted) accept(text, turnTime);
          } catch (error) {
            if (!active.abort.signal.aborted) {
              stop();
              toast.error(error instanceof Error ? error.message : "Could not transcribe the spoken turn.");
            }
          } finally {
            active.queued--;
            if (!active.abort.signal.aborted) setPartial("");
          }
        });
      }, () => { if (capture.current === active) stop("Microphone recording was interrupted."); });
      active.expires = setTimeout(() => { toast.info("The 30-minute capture window ended."); void finish(); }, 30 * 60_000);
      setStatus("active");
    } catch (error) {
      if (active.abort.signal.aborted) return;
      stop();
      toast.error(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied." : error instanceof Error ? error.message : "Could not start live transcription.");
    }
  }
  function togglePause() {
    const shouldPause = status === "active";
    const active = capture.current;
    active?.stream?.getAudioTracks().forEach(track => { track.enabled = !shouldPause; });
    void (shouldPause ? active?.turns?.pause() : active?.turns?.resume())?.catch(() => stop("Microphone recording was interrupted."));
    setStatus(shouldPause ? "paused" : "active");
  }
  const running = status === "connecting" || status === "active" || status === "paused" || status === "finishing";
  return <><PageHeading kicker="LIVE COACHING" title="Live interview assistant" description="Use live transcription and short suggestions in interviews that explicitly permit AI assistance."/>
    <div className="content-grid"><section className="card stack"><div className="card-title"><div><h2>Microphone controls</h2><p role="status">{data.demo ? "Simulated session · microphone off" : { idle: "Microphone off", connecting: "Connecting microphone…", active: "Microphone on", paused: "Microphone paused", finishing: "Finishing transcription…", stopped: "Microphone off" }[status]}</p></div><span className={`stat-icon ${status === "active" ? "teal" : "violet"}`}><Mic size={20}/></span></div>
      <div className="consent"><ShieldCheck size={20}/><div><h3>Participant permission</h3><p>Confirm permission before using this feature. Audio is transcribed on this device. The first spoken turn may take longer while the speech model downloads.</p></div></div>
      <label className="check"><input type="checkbox" checked={allowed} disabled={running} onChange={event => setAllowed(event.target.checked)}/> Interview rules and all participants allow AI assistance.</label>
      <label className="check"><input type="checkbox" checked={recordingAllowed} disabled={running} onChange={event => setRecordingAllowed(event.target.checked)}/> Everyone permits microphone capture and transcription.</label>
      {!running && <SourceSelect data={data} selection={selection} choose={choose}/>}
      <Wave animated={status === "active"}/>
      <div className="actions">{!running ? <Button disabled={!allowed || !recordingAllowed || saving} onClick={() => void start()}><Play size={16}/> {status === "stopped" ? "Start again" : "Start session"}</Button> : <>
        {(status === "active" || status === "paused") && <Button variant="secondary" onClick={togglePause}>{status === "active" ? <Pause size={16}/> : <Play size={16}/>} {status === "active" ? "Pause" : "Resume"}</Button>}
        <Button variant="danger" onClick={() => void finish()}><Square size={16}/> {status === "finishing" ? "Cancel transcription" : "Stop"}</Button>
        {status === "active" && <Button variant="secondary" onClick={() => data.demo ? accept("How did you measure the impact of your work?") : void capture.current?.turns?.finishTurn().catch(() => stop("Microphone recording was interrupted."))}>{data.demo ? "Simulate question" : "Finish spoken turn"}</Button>}</>}</div>
      <label>Quick reference notes<textarea rows={4} maxLength={3000} placeholder="Notes for this session…" value={notes} onChange={event => setNotes(event.target.value)}/></label>
    </section><div className="stack"><section className="card stack"><div className="card-title"><div><h2>Live transcript</h2><p>{data.settings.retainTranscript ? "Choose whether to save this transcript when finished." : "Transcript stays in this view for the session."}</p></div><AudioLines size={20}/></div>
      <div className="transcript"><p className="prewrap">{transcript || (!partial ? "Transcript will appear here." : "")}</p>{partial && <p className="muted prewrap">{partial}</p>}</div>
      {latency !== undefined && <small className="muted">Turn completion to transcript · {latency} ms</small>}
      {status === "stopped" && transcript && data.settings.retainTranscript && <div><Button variant="secondary" disabled={saved || saving} onClick={async () => { setSaving(true); try { await data.retainLive(transcript); setSaved(true); toast.success("Transcript saved"); } catch { toast.error("Could not save transcript"); } finally { setSaving(false); } }}>{saved ? "Saved" : "Save transcript"}</Button></div>}
    </section><section className="card stack"><div className="card-title"><div><h2>Suggested talking points</h2><p>Detected questions can show a short outline you can adapt.</p></div><Sparkles size={20}/></div>
      <label>Detected question<input value={question} maxLength={2000} placeholder="You can also enter a question here." onChange={event => setQuestion(event.target.value)}/></label>
      <div><Button variant="secondary" disabled={!question.trim() || !running || status === "connecting"} onClick={() => void propose(question)}>Suggest talking points</Button></div>
      {answer && <p className="prewrap">{answer}</p>}
    </section></div></div>
  </>;
}
