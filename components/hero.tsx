import Link from "next/link";
import { Activity, ArrowDown, ArrowRight, AudioLines, Check, ChevronRight, FileText, Mic, Sparkles, Target } from "lucide-react";
import { Brand } from "./brand";
import { Wave } from "./wave";

const features = [
  { icon: FileText, title: "Know your strengths", text: "Match your real experience to the job and see which skills are worth practicing." },
  { icon: Mic, title: "Practice out loud", text: "Work through realistic questions by voice or text, with feedback after every answer." },
  { icon: Target, title: "Find the right words", text: "Get concise talking points grounded in your CV and the role you’re applying for." },
  { icon: Activity, title: "See your progress", text: "Review past answers and track how your practice scores change over time." },
];

export function Hero() {
  const mode = process.env.NEXT_PUBLIC_SNAPCUE_MODE;
  const studio = mode === "cloud" ? "/sign-up" : "/studio";
  return <div className="landing">
    <header className="landing-nav"><Brand /><nav aria-label="Main"><a href="#features">Features</a><a href="#how-it-works">How it works</a></nav><div className="nav-actions"><Link className="button ghost" href={mode === "cloud" ? "/sign-in" : "/studio"}>{mode === "cloud" ? "Sign in" : "Demo"}</Link><Link className="button primary" href={studio}>Get started <ArrowRight size={15}/></Link></div></header>
    <main>
      <section className="hero"><div className="hero-decoration" />
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> AI INTERVIEW COPILOT</div>
          <h1>Hear the question.<br /><em>Find your confidence.</em></h1>
          <p>Practice with realistic interview questions, get feedback on your answers, and turn your experience into talking points you can use.</p>
          <div className="actions"><Link className="button primary" href={studio}>Start practicing <ArrowRight size={17}/></Link><a className="button secondary" href="#how-it-works">See how it works <ArrowDown size={15}/></a></div>
          <div className="hero-benefits"><span><Check size={14} /> Voice and text practice</span><span><Check size={14} /> Answers grounded in your CV</span></div>
        </div>
        <div className="preview">
          <div className="preview-top"><span><span className="preview-icon"><AudioLines size={18}/></span> Interview studio</span><span className="preview-label">Practice demo</span></div>
          <div className="preview-body"><div className="preview-section"><span>BEHAVIORAL INTERVIEW</span><span>Question 2 of 5</span></div><div className="progress"><span /></div>
          <h2>Tell me about a time you solved a complex problem.</h2>
          <div className="preview-wave"><div><span className="record-dot" /> Example recording</div><Wave animated /><small>00:18</small></div>
          <div className="preview-answer"><div><Sparkles size={17}/> Suggested talking points</div><ul><li>Explain the problem and what was at stake.</li><li>Describe the specific steps you took.</li><li>Close with the outcome and how you measured it.</li></ul></div></div>
        </div>
      </section>
      <section id="features" className="landing-section"><div className="section-heading"><h2>Interview prep built around you</h2><p>Work from your own CV and the job you want.</p></div><div className="features">{features.map(({ icon: Icon, title, text }) => <article className="card feature" key={title}><span className="feature-icon"><Icon size={21}/></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section id="how-it-works" className="landing-section how"><div className="section-heading"><h2>From CV to practice session</h2></div><div className="features three">{[["Add your experience","Upload your CV and add the job description for context."],["Choose a practice format","Set the interview category, difficulty and session length."],["Review your answers","Use the feedback to strengthen your next response."]].map(([title, text]) => <article className="card feature" key={title}><h3>{title}</h3><p>{text}</p></article>)}</div><Link className="button primary" href={studio}>Open the studio <ChevronRight size={18}/></Link></section>
    </main><footer className="landing-footer"><Brand/><span>Hear the question. Find your confidence.</span></footer>
  </div>;
}
