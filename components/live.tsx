"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Mic, Pause, Play, ShieldCheck, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "./page-heading";
import { Button } from "./ui/button";
import { Wave } from "./hero";
import { sampleAnswer, SourceSelect, streamAnswer } from "./practice";
import type { Selection, Workspace } from "./workspace-data";

type Status = "idle" | "connecting" | "active" | "paused" | "stopped";
type Capture = { abort: AbortController; stream?: MediaStream; peer?: RTCPeerConnection; channel?: RTCDataChannel; audio?: AudioContext; interval?: ReturnType<typeof setInterval>; expires?: ReturnType<typeof setTimeout> };

function close(capture?: Capture) {
  if (!capture) return;
  capture.abort.abort();
  if (capture.interval) clearInterval(capture.interval);
  if (capture.expires) clearTimeout(capture.expires);
  capture.stream?.getTracks().forEach(track => track.stop());
  capture.channel?.close();
  capture.peer?.close();
  void capture.audio?.close().catch(() => undefined);
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
  const [suggestionLatency, setSuggestionLatency] = useState<number>();
  const [endToEnd, setEndToEnd] = useState<number>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const capture = useRef<Capture | undefined>(undefined);
  const suggestion = useRef<AbortController | undefined>(undefined);
  const committed = useRef(0);
  const paused = useRef(false);
  function stop(message?: string) {
    const current = capture.current;
    capture.current = undefined;
    close(current);
    suggestion.current?.abort();
    setPartial("");
    setStatus("stopped");
    if (message) toast.info(message);
  }
  useEffect(() => {
    const interrupt = () => {
      if (capture.current) stop("Microphone disconnected. Start again when you’re ready.");
    };
    const hidden = () => { if (document.visibilityState === "hidden" && capture.current) stop("Microphone stopped when SnapCue moved to the background."); };
    window.addEventListener("offline", interrupt);
    window.addEventListener("pagehide", interrupt);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("offline", interrupt);
      window.removeEventListener("pagehide", interrupt);
      document.removeEventListener("visibilitychange", hidden);
      const active = capture.current;
      capture.current = undefined;
      close(active);
      suggestion.current?.abort();
    };
  }, []);
  async function propose(prompt: string, turnTime?: number) {
    if (!prompt.trim()) return;
    suggestion.current?.abort();
    const task = new AbortController();
    suggestion.current = task;
    const begin = performance.now();
    setAnswer(""); setSuggestionLatency(undefined); setEndToEnd(undefined);
    try {
      if (data.demo) setAnswer(sampleAnswer("Concise"));
      else {
        await streamAnswer(prompt.slice(0, 2000), "Concise", false, selection, task.signal, setAnswer);
        setSuggestionLatency(Math.round(performance.now() - begin));
        if (turnTime) setEndToEnd(Math.round(performance.now() - turnTime));
      }
    } catch { if (!task.signal.aborted) toast.error("Could not load live talking points."); }
  }
  function accept(text: string) {
    if (!text.trim()) return;
    setTranscript(previous => [previous, text].filter(Boolean).join("\n").slice(-25000));
    const turnTime = committed.current;
    if (turnTime) setLatency(Math.round(performance.now() - turnTime));
    if (/\?|\b(tell me|describe|explain|walk me through|how (did|would|do)|what (was|is|would)|can you)\b/i.test(text)) {
      setQuestion(text.slice(0, 2000)); void propose(text, turnTime);
    }
  }
  function commit() {
    const channel = capture.current?.channel;
    if (channel?.readyState !== "open" || paused.current) return;
    committed.current = performance.now();
    channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  }
  async function start() {
    if (!allowed || !recordingAllowed || capture.current) return;
    setTranscript(""); setPartial(""); setQuestion(""); setAnswer(""); setSaved(false); setLatency(undefined); setSuggestionLatency(undefined); setEndToEnd(undefined);
    committed.current = 0; paused.current = false;
    if (data.demo) { setStatus("active"); return; }
    const active: Capture = { abort: new AbortController() };
    capture.current = active;
    setStatus("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("Live audio requires a supported browser and secure connection.");
      const audio = new AudioContext();
      active.audio = audio;
      await audio.resume();
      const mic = data.settings.microphone;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: mic ? { deviceId: { exact: mic } } : true });
      if (active.abort.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      active.stream = stream;
      const [track] = stream.getAudioTracks();
      track.addEventListener("ended", () => { if (capture.current === active) stop("Microphone disconnected."); });
      const analyser = audio.createAnalyser();
      analyser.fftSize = 1024;
      audio.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      const credential = await fetch("/api/speech?live=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowed, recordingAllowed }), signal: active.abort.signal });
      const { token, error } = await credential.json();
      if (!credential.ok || !token) throw new Error(error ?? "Live transcription could not connect.");
      const peer = new RTCPeerConnection();
      active.peer = peer;
      peer.addTrack(track, stream);
      peer.onconnectionstatechange = () => {
        if (capture.current === active && ["failed", "disconnected"].includes(peer.connectionState)) stop("Connection interrupted. Start again to reconnect.");
      };
      const channel = peer.createDataChannel("oai-events");
      active.channel = channel;
      let voicedAt = 0;
      let started = 0;
      const pending = new Map<string, string>();
      channel.onopen = () => {
        if (capture.current !== active) return;
        setStatus("active");
        active.interval = setInterval(() => {
          if (paused.current) { voicedAt = 0; started = 0; return; }
          analyser.getFloatTimeDomainData(buffer);
          const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length);
          const now = performance.now();
          if (rms > 0.018) { if (!started) started = now; voicedAt = now; }
          if (started && (now - voicedAt > 850 || now - started > 20_000)) {
            if (voicedAt - started > 150) commit();
            voicedAt = 0; started = 0;
          }
        }, 100);
        active.expires = setTimeout(() => stop("The 30-minute capture window ended. Start again to continue."), 30 * 60_000);
      };
      channel.onmessage = message => {
        if (capture.current !== active) return;
        try {
          const event = JSON.parse(message.data);
          if (event.type === "conversation.item.input_audio_transcription.delta") {
            pending.set(event.item_id, ((pending.get(event.item_id) ?? "") + event.delta).slice(-4000));
            if (!paused.current) setPartial(pending.get(event.item_id) ?? "");
          } else if (event.type === "conversation.item.input_audio_transcription.completed") {
            pending.delete(event.item_id);
            setPartial([...pending.values()].join(" "));
            if (!paused.current && typeof event.transcript === "string") accept(event.transcript);
          }
        } catch { /* Ignore malformed signaling messages. */ }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const negotiation = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/sdp" }, body: offer.sdp, signal: AbortSignal.any([active.abort.signal, AbortSignal.timeout(15_000)]) });
      if (!negotiation.ok) throw new Error("Realtime audio could not connect.");
      await peer.setRemoteDescription({ type: "answer", sdp: await negotiation.text() });
      if (capture.current === active) {
        const timeout = setTimeout(() => { if (capture.current === active && channel.readyState !== "open") stop("Live transcription timed out. Start again to retry."); }, 15_000);
        active.abort.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
      }
    } catch (error) {
      if (active.abort.signal.aborted) return;
      stop();
      toast.error(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied." : error instanceof Error ? error.message : "Could not start live transcription.");
    }
  }
  function togglePause() {
    if (status === "active" && partial) commit();
    paused.current = status === "active";
    capture.current?.stream?.getAudioTracks().forEach(track => { track.enabled = !paused.current; });
    setStatus(paused.current ? "paused" : "active");
  }
  const running = status === "connecting" || status === "active" || status === "paused";
  return <><PageHeading kicker="LIVE COACHING" title="Live interview assistant" description="Use live transcription and short suggestions in interviews that explicitly permit AI assistance."/>
    <div className="content-grid"><section className="card stack"><div className="card-title"><div><h2>Microphone controls</h2><p role="status">{data.demo ? "Simulated session · microphone off" : { idle: "Microphone off", connecting: "Connecting microphone…", active: "Microphone on", paused: "Microphone paused", stopped: "Microphone off" }[status]}</p></div><span className={`stat-icon ${status === "active" ? "teal" : "violet"}`}><Mic size={20}/></span></div>
      <div className="consent"><ShieldCheck size={20}/><div><h3>Participant permission</h3><p>Confirm permission before using this feature. Audio is processed by the transcription service. SnapCue does not retain raw audio.</p></div></div>
      <label className="check"><input type="checkbox" checked={allowed} disabled={running} onChange={event => setAllowed(event.target.checked)}/> Interview rules and all participants allow AI assistance.</label>
      <label className="check"><input type="checkbox" checked={recordingAllowed} disabled={running} onChange={event => setRecordingAllowed(event.target.checked)}/> Everyone permits microphone capture and transcription.</label>
      {!running && <SourceSelect data={data} selection={selection} choose={choose}/>}
      <Wave animated={status === "active"}/>
      <div className="actions">{!running ? <Button disabled={!allowed || !recordingAllowed || saving} onClick={() => void start()}><Play size={16}/> {status === "stopped" ? "Start again" : "Start session"}</Button> : <>
        {status !== "connecting" && <Button variant="secondary" onClick={togglePause}>{status === "active" ? <Pause size={16}/> : <Play size={16}/>} {status === "active" ? "Pause" : "Resume"}</Button>}
        <Button variant="danger" onClick={() => stop()}><Square size={16}/> Stop</Button>
        {status === "active" && <Button variant="secondary" onClick={() => data.demo ? accept("How did you measure the impact of your work?") : commit()}>{data.demo ? "Simulate question" : "Finish spoken turn"}</Button>}</>}</div>
      <label>Quick reference notes<textarea rows={4} maxLength={3000} placeholder="Notes for this session…" value={notes} onChange={event => setNotes(event.target.value)}/></label>
    </section><div className="stack"><section className="card stack"><div className="card-title"><div><h2>Live transcript</h2><p>{data.settings.retainTranscript ? "Choose whether to save this transcript when finished." : "Transcript stays in this view for the session."}</p></div><AudioLines size={20}/></div>
      <div className="transcript"><p className="prewrap">{transcript || (!partial ? "Transcript will appear here." : "")}</p>{partial && <p className="muted prewrap">{partial}</p>}</div>
      {latency !== undefined && <small className="muted">Turn completion to transcript · {latency} ms</small>}
      {status === "stopped" && transcript && data.settings.retainTranscript && <div><Button variant="secondary" disabled={saved || saving} onClick={async () => { setSaving(true); try { await data.retainLive(transcript); setSaved(true); toast.success("Transcript saved"); } catch { toast.error("Could not save transcript"); } finally { setSaving(false); } }}>{saved ? "Saved" : "Save transcript"}</Button></div>}
    </section><section className="card stack"><div className="card-title"><div><h2>Suggested talking points</h2><p>Detected questions can generate talking points automatically.</p></div><Sparkles size={20}/></div>
      <label>Detected question<input value={question} maxLength={2000} placeholder="You can also enter a question here." onChange={event => setQuestion(event.target.value)}/></label>
      <div><Button variant="secondary" disabled={!question.trim() || !running || status === "connecting"} onClick={() => void propose(question)}>Suggest talking points</Button></div>
      {answer && <p className="prewrap">{answer}</p>}{suggestionLatency !== undefined && <small className="muted">Suggestion · {suggestionLatency} ms{endToEnd !== undefined ? ` · Turn to suggestion · ${endToEnd} ms` : ""}</small>}
    </section></div></div>
  </>;
}
