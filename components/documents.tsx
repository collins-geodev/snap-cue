"use client";
import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, FileText, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "./page-heading";
import { Button } from "./ui/button";
import { download } from "./dashboard";
import type { Workspace } from "./workspace-data";
import type { Entry, Profile } from "@/lib/domain";

export function Documents({ data, kind }: { data: Workspace; kind: Entry["kind"] }) {
  const cloudJob = kind === "job";
  const [edit, setEdit] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const label = cloudJob ? "job description" : "CV";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const node = event.currentTarget;
    const form = new FormData(node);
    form.set("kind", kind);
    if (edit) form.set("replace", edit.id);
    setBusy(true);
    try { await data.saveDocument(form); node.reset(); setEdit(null); toast.success(`${label} saved`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the document."); }
    finally { setBusy(false); }
  }
  const rows = data.entries.filter(row => row.kind === kind);
  return <><PageHeading kicker={cloudJob ? "TARGET ROLES" : "YOUR BACKGROUND"} title={cloudJob ? "Job intelligence" : "Professional profile"} description={cloudJob ? "Compare job requirements with your experience and find likely interview questions." : "Give SnapCue the evidence it needs to personalize your practice."}/>
    <div className="content-grid"><section className="card stack">
      <div className="card-title"><div><h2>{edit ? "Edit" : "Add"} {label}</h2><p>{data.demo ? "Paste text or upload a TXT file in demo mode." : "Paste text or upload a PDF, DOCX or TXT file up to 4 MB."}</p></div><UploadCloud size={22}/></div>
      <form className="stack" onSubmit={submit} key={edit?.id ?? "new"}>
        <label>{cloudJob ? "Position" : "Version name"}<input name="title" maxLength={160} defaultValue={edit?.title ?? ""} required placeholder={cloudJob ? "Geospatial Engineer" : "CV — data and analytics"}/></label>
        {cloudJob && <><label>Organization<input name="organization" maxLength={120} defaultValue={edit?.organization ?? ""} placeholder="Company name"/></label><label>CV for comparison<select name="resume"><option value="">Use any relevant saved CV</option>{data.entries.filter(row => row.kind === "resume").map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label></>}
        <label>Document file<input type="file" name="file" accept={data.demo ? ".txt" : ".pdf,.docx,.txt"}/></label>
        <label>{label} text<textarea name="text" rows={6} maxLength={55000} defaultValue={edit?.text ?? ""} placeholder={cloudJob ? "Paste the responsibilities and qualifications…" : "Paste your experience and qualifications…"}/></label>
        <div className="actions"><Button type="submit" disabled={busy}>{busy ? "Processing…" : cloudJob ? "Analyze and save" : "Save CV"}</Button>{edit && <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel edit</Button>}</div>
      </form>
    </section><section className="card stack"><div className="card-title"><div><h2>{cloudJob ? "Saved applications" : "Saved CV versions"}</h2><p>{rows.length} saved</p></div>{cloudJob ? <BriefcaseBusiness size={20}/> : <FileText size={20}/>}</div>
      {rows.map(row => <details className="record" key={row.id}><summary>{row.title}</summary><div className="record-content">{row.organization && <p>{row.organization}</p>}
        {row.analysis ? Object.entries(row.analysis).map(([title, items]) => <div key={title}><h3 className="capitalize">{title}</h3><ul className="bullet-list">{items.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul></div>) : <p className="prewrap excerpt">{row.text}</p>}
        <div className="actions"><Button type="button" variant="secondary" onClick={() => setEdit(row)}>Edit</Button><Button type="button" variant="danger" onClick={async () => { if (window.confirm(`Delete this ${label}?`)) try { await data.removeDocument(row.id); if (edit?.id === row.id) setEdit(null); } catch { toast.error("Could not delete the document."); } }}>Delete</Button></div>
      </div></details>)}
      {!rows.length && <p className="empty">Your saved {cloudJob ? "job descriptions" : "CVs"} will appear here.</p>}
    </section></div>
    {!cloudJob && <ProfileEditor data={data}/>}
  </>;
}
function ProfileEditor({ data }: { data: Workspace }) {
  const [saving, setSaving] = useState(false);
  const fields: Record<keyof Profile, string> = { summary: "Professional summary", skills: "Skills", certifications: "Certifications", experience: "Employment experience", projects: "Major projects", achievements: "Verified achievements" };
  return <section className="card stack spaced"><div className="card-title"><div><h2>Professional details</h2><p>Add experience and achievements you can verify.</p></div></div><form className="stack" onSubmit={async event => {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.currentTarget)) as Profile;
    setSaving(true);
    try { await data.saveProfile(value); toast.success("Profile saved"); } catch { toast.error("Could not save your profile"); } finally { setSaving(false); }
  }}><div className="form-grid two">{(Object.keys(fields) as (keyof Profile)[]).map(key => <label key={key}>{fields[key]}<textarea name={key} rows={3} maxLength={4000} defaultValue={data.profile[key]}/></label>)}</div><div><Button disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button></div></form></section>;
}
export function Preferences({ data }: { data: Workspace }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  return <><PageHeading kicker="PREFERENCES" title="Settings" description="Manage coaching, speech, appearance and the data in your workspace."/>
    <div className="content-grid"><section className="card stack"><h2>Studio preferences</h2><form className="stack" onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try { await data.saveSettings({ language: String(form.get("language")), theme: form.get("theme") === "light" ? "light" : "dark", length: form.get("length") === "standard" ? "standard" : "brief", model: String(form.get("model")), retainTranscript: form.has("retain"), notifications: form.has("notifications"), microphone: String(form.get("mic") ?? "") }); toast.success("Preferences saved"); } catch { toast.error("Could not save preferences"); }
    }}>
      <div className="form-grid two"><label>Appearance<select name="theme" defaultValue={data.settings.theme}><option value="dark">Dark</option><option value="light">Light</option></select></label>
        <label>Suggested answer length<select name="length" defaultValue={data.settings.length}><option value="brief">Brief</option><option value="standard">Standard</option></select></label>
        <label>Speech language<select name="language" defaultValue={data.settings.language}>{Object.entries({ en: "English", fr: "French", es: "Spanish", de: "German", pt: "Portuguese", ar: "Arabic", hi: "Hindi", zh: "Chinese", ja: "Japanese" }).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label>Answer model<select name="model" defaultValue={data.settings.model}><option value="gpt-5-mini">GPT-5 mini</option><option value="gpt-5.4-mini">GPT-5.4 mini</option></select></label>
      </div>
      <label>Microphone<select name="mic" defaultValue={data.settings.microphone}><option value="">System default</option>{data.settings.microphone && !devices.some(device => device.deviceId === data.settings.microphone) && <option value={data.settings.microphone}>Saved microphone</option>}{devices.filter(device => device.deviceId && device.deviceId !== "default").map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>
      <div><Button variant="secondary" type="button" onClick={async () => { try { const inputs = await navigator.mediaDevices.enumerateDevices(); setDevices(inputs.filter(device => device.kind === "audioinput")); } catch { toast.error("Microphone devices are unavailable."); } }}>Refresh microphones</Button></div>
      <label className="check"><input name="notifications" type="checkbox" defaultChecked={data.settings.notifications}/> Show practice timer notifications</label>
      <label className="check"><input name="retain" type="checkbox" defaultChecked={data.settings.retainTranscript}/> Offer to save live transcripts after each session</label>
      <div><Button>Save preferences</Button></div>
    </form></section><section className="card stack"><h2>Privacy and account</h2><p className="muted">Audio is sent to the transcription service during voice features. SnapCue does not retain raw audio. Live transcripts can be saved only if you enable retention and choose to save them.</p>
      <div><Button variant="secondary" onClick={() => download("snapcue-data.json", { profile: data.profile, settings: data.settings, documents: data.entries, interviews: data.sessions, transcripts: data.transcripts })}>Export workspace data</Button></div>
      <hr/><label>Type DELETE to {data.demo ? "clear local demo data" : "delete your account and workspace"}<input value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="off"/></label>
      <div><Button variant="danger" disabled={confirm !== "DELETE" || busy} onClick={async () => { setBusy(true); try { await data.erase(); setConfirm(""); toast.success("Workspace data deleted"); } catch { toast.error("Could not delete your data"); } finally { setBusy(false); } }}>{data.demo ? "Clear demo data" : "Delete account"}</Button></div>
    </section></div>
  </>;
}
