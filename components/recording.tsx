"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

export function Recording({ demo, microphone, onText, disabled }: { demo: boolean; microphone: string; onText: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [latency, setLatency] = useState<number>();
  const recorder = useRef<MediaRecorder | null>(null);
  const tracks = useRef<MediaStream | null>(null);
  const task = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { task.current?.abort(); tracks.current?.getTracks().forEach(track => track.stop()); if (timer.current) clearTimeout(timer.current); }, []);
  async function start() {
    if (demo) {
      onText("I clarified the goal, reviewed the available options, and shared the outcome with my team.");
      toast.info("Sample transcript inserted");
      return;
    }
    setState("starting");
    const abort = new AbortController();
    task.current = abort;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Microphone recording requires a supported browser and secure connection.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: microphone ? { deviceId: { exact: microphone } } : true });
      if (abort.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      tracks.current = stream;
      const clip = new MediaRecorder(stream);
      recorder.current = clip;
      const parts: Blob[] = [];
      clip.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      clip.onerror = () => { abort.abort(); stream.getTracks().forEach(track => track.stop()); setState("idle"); toast.error("Microphone recording was interrupted."); };
      clip.onstop = async () => {
        if (timer.current) clearTimeout(timer.current);
        stream.getTracks().forEach(track => track.stop());
        if (abort.signal.aborted) return;
        setState("sending");
        try {
          const audio = new Blob(parts, { type: clip.mimeType });
          const form = new FormData();
          const ext = clip.mimeType.includes("mp4") ? "mp4" : clip.mimeType.includes("ogg") ? "ogg" : "webm";
          form.set("file", audio, "recording." + ext);
          const response = await fetch("/api/speech", { method: "POST", body: form, signal: abort.signal });
          const result = await response.json();
          if (!response.ok || !result.text?.trim()) throw new Error(result.error || "No speech was detected.");
          setLatency(result.latency);
          onText(result.text);
        } catch (error) {
          if (!abort.signal.aborted) toast.error(error instanceof Error ? error.message : "Could not transcribe the clip.");
        } finally { if (!abort.signal.aborted) setState("idle"); }
      };
      clip.start();
      setState("recording");
      timer.current = setTimeout(() => { if (clip.state === "recording") clip.stop(); }, 60_000);
    } catch (error) {
      tracks.current?.getTracks().forEach(track => track.stop());
      if (!abort.signal.aborted) {
        setState("idle");
        toast.error(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied. You can still type your answer." : error instanceof Error ? error.message : "Microphone is unavailable.");
      }
    }
  }
  return <div className="actions"><Button type="button" variant={state === "recording" ? "danger" : "secondary"} disabled={disabled || state === "starting" || state === "sending"} onClick={() => state === "recording" ? recorder.current?.stop() : void start()}>{state === "recording" ? <Square size={16}/> : <Mic size={16}/>} {demo ? "Insert sample transcript" : { idle: "Record audio", starting: "Requesting microphone…", recording: "Stop recording", sending: "Transcribing…" }[state]}</Button>{latency !== undefined && <small className="muted">Transcribed in {latency} ms</small>}</div>;
}
