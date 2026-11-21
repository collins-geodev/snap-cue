"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { Authenticated, AuthLoading, ConvexReactClient, useAction, useMutation, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { GenericId } from "convex/values";
import { api } from "@/convex/_generated/api";
import { defaultProfile, defaultSettings, demoAssessment, demoQuestion, type Assessment, type Entry, type Profile, type Session, type Settings, type Setup, type Turn } from "@/lib/domain";

export type Selection = { resume?: string; job?: string };
export type Data = { profile: Profile; settings: Settings; entries: Entry[]; sessions: Session[]; transcripts: { id: string; created: number; text: string }[] };
export type Workspace = Data & {
  demo: boolean; name: string;
  saveProfile(value: Profile): Promise<void>; saveSettings(value: Settings): Promise<void>;
  saveDocument(form: FormData): Promise<void>; removeDocument(id: string): Promise<void>;
  question(config: Setup, previous: string[], selection: Selection): Promise<string>;
  assess(question: string, answer: string, config: Setup, selection: Selection): Promise<Assessment>;
  saveSession(config: Setup, turns: Turn[], id?: string): Promise<string>;
  removeSession(id: string): Promise<void>; removeTranscript(id: string): Promise<void>; retainLive(text: string): Promise<void>; erase(): Promise<void>;
};
const key = "snapcue-demo-workspace-v1";
const now = Date.UTC(2026, 0, 21);
function timestamp() { return Date.now(); }
const sample = (id: string, category: Setup["category"], score: number, days: number): Session => {
  const answer = "I clarified the outcome with the team, proposed two approaches, and checked that we could measure the result before proceeding.";
  const assessment = demoAssessment(answer);
  return { id, category, role: "Product Analyst", organization: "Example Studio", difficulty: "Intermediate", count: 5, minutes: 20, created: now - days * 86400000, turns: [{ question: demoQuestion(category, "Product Analyst", 0), answer, assessment: { ...assessment, score } }] };
};
const initial: Data = {
  profile: defaultProfile, settings: defaultSettings, entries: [], transcripts: [],
  sessions: [sample("sample-3", "Behavioral", 84, 0), sample("sample-2", "Technical", 77, 3), sample("sample-1", "Scenario", 69, 7)],
};
const empty = { ...initial, sessions: [] };
export function DemoWorkspace({ children }: { children: (data: Workspace) => ReactNode }) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) queueMicrotask(() => setState({ ...initial, ...JSON.parse(stored) }));
    } catch { /* A blocked or invalid store starts with the sample workspace. */ }
  }, []);
  function update(changes: Partial<Data>) {
    const next = { ...state, ...changes };
    localStorage.setItem(key, JSON.stringify(next));
    setState(next);
  }
  return children({
    ...state, demo: true, name: "there",
    async saveProfile(profile) { update({ profile }); },
    async saveSettings(settings) { update({ settings }); },
    async saveDocument(form) {
      const kind = form.get("kind") === "resume" ? "resume" : "job";
      const file = form.get("file");
      const title = String(form.get("title") ?? "").trim();
      const suppliedText = String(form.get("text") ?? "").trim();
      if (file instanceof File && file.size && (!file.name.toLowerCase().endsWith(".txt") || file.size > 4 * 1024 * 1024)) throw new Error("Try pasted text or a TXT file in demo mode. Cloud mode also supports PDF and DOCX.");
      const text = (file instanceof File && file.size ? await file.text() : suppliedText).trim();
      if (!text || !title || text.length > 55000) throw new Error("Enter a title and up to 55,000 characters.");
      const id = String(form.get("replace") || crypto.randomUUID());
      const analysis = kind === "job" ? {
        skills: [...new Set(text.match(/\b(SQL|Python|GIS|communication|leadership|analysis|React|TypeScript|management)\b/gi) ?? [])],
        strengths: ["Review your own experience and identify which requirements it supports."],
        gaps: ["Cloud analysis compares this job with selected CV evidence."],
        questions: [demoQuestion("Role-specific", title, 0), demoQuestion("Technical", title, 0)],
      } : undefined;
      update({ entries: [{ id, kind, title, organization: String(form.get("organization") ?? ""), text, created: timestamp(), analysis }, ...state.entries.filter(item => item.id !== id)] });
    },
    async removeDocument(id) { update({ entries: state.entries.filter(item => item.id !== id) }); },
    async question(config, previous) { return demoQuestion(config.category, config.role, previous.length); },
    async assess(_question, answer) { return demoAssessment(answer); },
    async saveSession(config, turns, id = crypto.randomUUID()) {
      const existing = state.sessions.find(row => row.id === id);
      update({ sessions: [{ ...config, id, created: existing?.created ?? timestamp(), turns }, ...state.sessions.filter(item => item.id !== id)] });
      return id;
    },
    async removeSession(id) { update({ sessions: state.sessions.filter(row => row.id !== id) }); },
    async retainLive(text) { update({ transcripts: [{ id: crypto.randomUUID(), created: timestamp(), text }, ...state.transcripts] }); },
    async removeTranscript(id) { update({ transcripts: state.transcripts.filter(row => row.id !== id) }); },
    async erase() { update(empty); },
  });
}
const id = <T extends string>(value: string) => value as GenericId<T>;
const selected = ({ resume, job }: Selection) => ({ resume: resume ? id<"documents">(resume) : undefined, job: job ? id<"documents">(job) : undefined });
function Connected({ children }: { children: (data: Workspace) => ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const data = useQuery(api.store.workspace);
  const transcripts = useQuery(api.store.transcripts);
  const saveProfile = useMutation(api.store.saveProfile);
  const saveSettings = useMutation(api.store.saveSettings);
  const saveSession = useMutation(api.store.saveSession);
  const removeSession = useMutation(api.store.removeSession);
  const removeDocument = useMutation(api.store.removeDocument);
  const removeTranscript = useMutation(api.store.removeTranscript);
  const retainLive = useMutation(api.store.retainLive);
  const question = useAction(api.intelligence.question);
  const evaluate = useAction(api.intelligence.evaluate);
  if (!data || !transcripts) return <p className="loading" role="status">Loading your workspace…</p>;
  return children({
    demo: false, name: user?.firstName ?? "there",
    profile: data.profile ?? defaultProfile, settings: data.settings ?? defaultSettings,
    entries: data.entries, sessions: data.sessions.map(row => ({ ...row.setup, id: row.id, created: row.created, turns: row.turns })), transcripts,
    async saveProfile(value) { await saveProfile({ value }); }, async saveSettings(value) { await saveSettings({ value }); },
    async saveDocument(form) {
      const response = await fetch("/api/documents", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json()).error);
    },
    async removeDocument(value) { await removeDocument({ id: id<"documents">(value) }); },
    async question(setup, previous, selection) { return question({ setup, previous, ...selected(selection) }); },
    async assess(prompt, answer, config, selection) { return evaluate({ question: prompt, answer, category: config.category, difficulty: config.difficulty, ...selected(selection) }); },
    async saveSession(setup, turns, value) { return saveSession({ setup, turns, id: value ? id<"interviewSessions">(value) : undefined }); },
    async removeSession(value) { await removeSession({ id: id<"interviewSessions">(value) }); },
    async removeTranscript(value) { await removeTranscript({ id: id<"liveTranscripts">(value) }); },
    async retainLive(text) { await retainLive({ text }); },
    async erase() {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete your account.");
      router.replace("/");
      router.refresh();
    },
  });
}
export function CloudWorkspace({ children }: { children: (data: Workspace) => ReactNode }) {
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return url ? new ConvexReactClient(url) : null;
  });
  if (!client) return <p className="loading">Cloud workspace configuration is incomplete.</p>;
  return <ConvexProviderWithClerk client={client} useAuth={useAuth}><AuthLoading><p className="loading">Connecting securely…</p></AuthLoading><Authenticated><Connected>{children}</Connected></Authenticated></ConvexProviderWithClerk>;
}
