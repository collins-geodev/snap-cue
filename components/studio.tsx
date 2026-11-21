"use client";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { motion, MotionConfig } from "motion/react";
import { AudioLines, BriefcaseBusiness, ChevronDown, CircleHelp, FileText, History, LayoutDashboard, Menu, Mic, Moon, Settings as SettingsIcon, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mode } from "@/lib/domain";
import { Brand } from "./brand";
import { CloudWorkspace, DemoWorkspace, type Workspace } from "./workspace-data";
import { Dashboard, HistoryView } from "./dashboard";
import { Documents, Preferences } from "./documents";
import { Practice, AnswerAssistant } from "./practice";
import { Live } from "./live";

const navigation = [
  { id: "dashboard", text: "Overview", icon: LayoutDashboard },
  { id: "profile", text: "Professional profile", icon: FileText },
  { id: "jobs", text: "Job intelligence", icon: BriefcaseBusiness },
  { id: "practice", text: "Mock interview", icon: Mic },
  { id: "assistant", text: "Answer assistant", icon: Sparkles },
  { id: "live", text: "Live assistant", icon: AudioLines },
  { id: "history", text: "Interview history", icon: History },
  { id: "settings", text: "Settings", icon: SettingsIcon },
] as const;
export type View = typeof navigation[number]["id"];
const views = {
  dashboard: Dashboard,
  profile: ({ data }: { data: Workspace }) => <Documents data={data} kind="resume" />,
  jobs: ({ data }: { data: Workspace }) => <Documents data={data} kind="job" />,
  practice: Practice, assistant: AnswerAssistant, live: Live, history: HistoryView, settings: Preferences,
};
function Content({ data, view }: { data: Workspace; view: View }) {
  const [menu, setMenu] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const nextTheme = data.settings.theme === "dark" ? "light" : "dark";

  async function toggleTheme() {
    setSavingTheme(true);
    try {
      await data.setTheme(nextTheme);
    } catch {
      toast.error("Could not change the theme. Try again.");
    } finally {
      setSavingTheme(false);
    }
  }
  const Screen = views[view];
  const selected = navigation.find(item => item.id === view)!;
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [data.settings.theme]);
  const link = ({ id, text, icon: Icon }: typeof navigation[number]) => <Link key={id} href={id === "dashboard" ? "/studio" : "/studio/" + id} aria-current={id === view ? "page" : undefined} onClick={() => setMenu(false)}><Icon size={18}/><span>{text}</span></Link>;
  return <MotionConfig reducedMotion="user"><div className="studio-shell">
    {menu && <button className="mobile-mask" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}><div className="sidebar-brand"><Brand /><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMenu(false)}><X size={20}/></button></div>
      <nav aria-label="Workspace"><span className="nav-label">WORKSPACE</span>{navigation.slice(0, 3).map(link)}<span className="nav-label">INTERVIEWS</span>{navigation.slice(3, 7).map(link)}<span className="nav-label">PREFERENCES</span>{link(navigation[7])}</nav>
      <div className="sidebar-footer"><Link href="/#how-it-works"><CircleHelp size={18}/> How SnapCue works</Link></div>
    </aside>
    <div className="studio-body"><header className="studio-header"><div><button className="icon-button mobile-only" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={22}/></button><span>Workspace</span><ChevronDown size={13} className="breadcrumb-icon"/><strong>{selected.text}</strong></div><div><button type="button" className="icon-button" aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`} disabled={savingTheme} onClick={toggleTheme}>{nextTheme === "light" ? <Sun size={20} aria-hidden="true"/> : <Moon size={20} aria-hidden="true"/>}</button>{data.demo ? <><span className="demo-badge"><i /> Demo mode</span><span className="avatar" aria-label="Demo profile">D</span></> : <UserButton />}</div></header>
      <main className="studio-main" id="main"><motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}><Screen data={data}/></motion.div></main>
    </div>
  </div></MotionConfig>;
}
export function Studio({ view }: { view: View }) {
  const Provider = mode === "cloud" ? CloudWorkspace : DemoWorkspace;
  return <Provider>{data => <Content data={data} view={view}/>}</Provider>;
}
