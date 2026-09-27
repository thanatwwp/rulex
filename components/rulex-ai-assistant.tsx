"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUp, CheckCircle2, FileSearch, MessageCircle, ShieldCheck, Sparkles, WandSparkles, X } from "lucide-react";

type AiState = "idle" | "thinking" | "success" | "warning";
type AiMode = "help" | "risk" | "submission";
type Tone = "neutral" | "success" | "warning";

type ProjectContext = {
  id: number;
  title: string;
  description: string;
  status: string;
  currentMilestone?: {
    description: string;
    submission: string;
    amount: string;
  };
};

type DraftContext = {
  title: string;
  description: string;
  milestones: Array<{ description: string; amount: string }>;
};

type Props = {
  activeTab: string;
  project?: ProjectContext;
  draft: DraftContext;
  onOpenCreate: () => void;
};

type Message = {
  role: "user" | "assistant";
  text: string;
  tone?: Tone;
};

function RulexMascot({ state = "idle", compact = false }: { state?: AiState; compact?: boolean }) {
  return (
    <div className={`rulex-mascot rulex-mascot-${state} ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <span className="rulex-mascot-aura" />
      <svg viewBox="0 0 180 180" role="presentation">
        <defs>
          <linearGradient id="rx-shell" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f8feff" />
            <stop offset=".52" stopColor="#cde8f4" />
            <stop offset="1" stopColor="#75a9c8" />
          </linearGradient>
          <linearGradient id="rx-crystal" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#74f2ff" />
            <stop offset=".46" stopColor="#3d8cff" />
            <stop offset="1" stopColor="#9a58ff" />
          </linearGradient>
          <radialGradient id="rx-visor" cx=".42" cy=".28" r=".88">
            <stop offset="0" stopColor="#17355d" />
            <stop offset=".55" stopColor="#07162d" />
            <stop offset="1" stopColor="#020813" />
          </radialGradient>
          <filter id="rx-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g className="rx-ear rx-ear-left">
          <path d="M42 62 16 25 60 38Z" fill="url(#rx-shell)" />
          <path d="M38 54 24 33 53 42Z" fill="url(#rx-crystal)" />
        </g>
        <g className="rx-ear rx-ear-right">
          <path d="m138 62 26-37-44 13Z" fill="url(#rx-shell)" />
          <path d="m142 54 14-21-29 9Z" fill="url(#rx-crystal)" />
        </g>

        <path d="M53 44c18-12 56-12 74 0 13 8 20 24 18 43-2 22-15 39-33 45-13 5-31 5-44 0-18-6-31-23-33-45-2-19 5-35 18-43Z" fill="url(#rx-shell)" />
        <path d="M50 59c17-14 63-14 80 0 9 8 12 22 9 37-4 20-18 29-49 29s-45-9-49-29c-3-15 0-29 9-37Z" fill="url(#rx-visor)" stroke="#70dff5" strokeOpacity=".44" strokeWidth="2" />
        <path d="M52 57c19-13 58-12 75 1" fill="none" stroke="#d9fbff" strokeOpacity=".32" strokeWidth="3" strokeLinecap="round" />

        <g className="rx-face" filter="url(#rx-glow)">
          <path className="rx-eye rx-eye-left" d="M61 84c4-8 12-8 16 0" fill="none" stroke="#69f8ff" strokeWidth="5.5" strokeLinecap="round" />
          <path className="rx-eye rx-eye-right" d="M103 84c4-8 12-8 16 0" fill="none" stroke="#69f8ff" strokeWidth="5.5" strokeLinecap="round" />
          <path className="rx-mouth" d="M79 101c7 7 15 7 22 0" fill="none" stroke="#7affdc" strokeWidth="4.5" strokeLinecap="round" />
          <circle className="rx-thinking-dot" cx="116" cy="101" r="3.5" fill="#9a74ff" />
          <path className="rx-warning-mark" d="M90 76v17m0 9v1" fill="none" stroke="#ff9f67" strokeWidth="5" strokeLinecap="round" />
        </g>

        <path d="M73 130c5 5 29 5 34 0l13 12c5 5 5 14 0 20-8 9-52 9-60 0-5-6-5-15 0-20Z" fill="url(#rx-shell)" />
        <path d="m90 136 10 8-10 11-10-11Z" fill="url(#rx-crystal)" />
        <path d="M55 140 38 151c-6 4-7 12-2 16 6 5 16 0 29-11" fill="none" stroke="url(#rx-shell)" strokeWidth="12" strokeLinecap="round" />
        <path d="m125 140 17 11c6 4 7 12 2 16-6 5-16 0-29-11" fill="none" stroke="url(#rx-shell)" strokeWidth="12" strokeLinecap="round" />
      </svg>
      <span className="rulex-mascot-scan" />
    </div>
  );
}

export default function RulexAiAssistant({ activeTab, project, draft, onOpenCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AiState>("idle");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I’m RuleX AI. I can help structure milestones, flag agreement risks, review submitted work, or explain what happens next." },
  ]);

  const context = useMemo(() => ({ activeTab, project: project || null, draft }), [activeTab, project, draft]);

  const pushAssistant = (text: string, tone: Tone = "neutral") => {
    setMessages(items => [...items, { role: "assistant", text, tone }]);
    setState(tone === "warning" ? "warning" : tone === "success" ? "success" : "idle");
  };

  const ask = async (mode: AiMode, prompt: string) => {
    const question = prompt.trim();
    if (!question) return;
    setOpen(true);
    setMessages(items => [...items, { role: "user", text: question }]);
    setInput("");
    setState("thinking");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, question, context }),
      });
      const data = await response.json() as { answer?: string; tone?: Tone; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "RuleX AI could not answer right now.");
      pushAssistant(data.answer, data.tone || "neutral");
    } catch (error) {
      pushAssistant(error instanceof Error ? error.message : "RuleX AI could not answer right now.", "warning");
    }
  };

  const buildMilestones = () => {
    onOpenCreate();
    setOpen(true);
    setState("success");
    pushAssistant(
      draft.description.trim()
        ? "I opened Create agreement. Your project brief is ready — use “Generate draft” to turn it into up to three editable milestones before signing."
        : "I opened Create agreement. Describe the work and budget first, then use “Generate draft” and I’ll help turn it into clear, editable milestones.",
      "success",
    );
  };

  const analyzeRisk = () => {
    const hasDraft = Boolean(draft.description.trim() || draft.title.trim());
    if (!project && !hasDraft) {
      setOpen(true);
      pushAssistant("Add a project brief or select an existing agreement first. Then I can check scope, acceptance criteria, payment clarity, and missing details.", "warning");
      return;
    }
    void ask("risk", "Analyze this RuleX agreement for practical risks, unclear scope, missing acceptance criteria, and anything the client or freelancer should clarify before taking the next action.");
  };

  const reviewSubmission = () => {
    if (!project?.currentMilestone?.submission) {
      setOpen(true);
      pushAssistant("Select an active project with submitted milestone work first. I only review evidence that is already visible in RuleX.", "warning");
      return;
    }
    void ask("submission", "Compare the current milestone submission with the agreed milestone. Summarize what appears satisfied, what is uncertain, and what the client should manually verify before releasing payment.");
  };

  return (
    <>
      {!open && <div className="rulex-ai-peek" aria-hidden="true">Need help? Ask RuleX AI</div>}
      <button className={`rulex-ai-launcher state-${state}`} type="button" aria-label="Open RuleX AI" onClick={() => setOpen(value => !value)}>
        <RulexMascot state={state} compact />
        <span className="rulex-ai-launcher-copy"><strong>RuleX AI</strong><small>{state === "thinking" ? "Analyzing…" : state === "warning" ? "Check needed" : state === "success" ? "Ready" : "Online"}</small></span>
      </button>

      {open && <section className="rulex-ai-panel" aria-label="RuleX AI assistant">
        <header className="rulex-ai-panel-header">
          <div className="rulex-ai-title">
            <RulexMascot state={state} compact />
            <div><strong>RuleX AI</strong><span>Escrow intelligence</span></div>
          </div>
          <button type="button" className="rulex-ai-close" aria-label="Close RuleX AI" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>

        <div className="rulex-ai-character-stage">
          <RulexMascot state={state} />
          <div className="rulex-ai-status">
            <span className={`rulex-ai-status-dot state-${state}`} />
            {state === "thinking" ? "Analyzing your RuleX context…" : state === "warning" ? "I found something to review." : state === "success" ? "Ready for the next step." : "Ask me about this agreement."}
          </div>
        </div>

        <div className="rulex-ai-actions">
          <button type="button" onClick={buildMilestones}><WandSparkles size={17} /><span><strong>Build milestones</strong><small>Turn a brief into clearer steps</small></span></button>
          <button type="button" onClick={analyzeRisk}><ShieldCheck size={17} /><span><strong>Analyze agreement</strong><small>Check scope and missing details</small></span></button>
          <button type="button" onClick={reviewSubmission}><FileSearch size={17} /><span><strong>Review submission</strong><small>Compare work with the milestone</small></span></button>
        </div>

        <div className="rulex-ai-chat" aria-live="polite">
          {messages.slice(-6).map((message, index) => <div key={index} className={`rulex-ai-message is-${message.role} ${message.tone ? "tone-" + message.tone : ""}`}>
            {message.role === "assistant" && <span className="rulex-ai-message-icon">{message.tone === "warning" ? <AlertTriangle size={14} /> : message.tone === "success" ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}</span>}
            <p>{message.text}</p>
          </div>)}
          {state === "thinking" && <div className="rulex-ai-thinking"><span /><span /><span /></div>}
        </div>

        <form className="rulex-ai-input" onSubmit={event => { event.preventDefault(); void ask("help", input); }}>
          <MessageCircle size={16} />
          <input value={input} onChange={event => setInput(event.target.value)} maxLength={600} placeholder="Ask RuleX AI anything…" aria-label="Ask RuleX AI" />
          <button type="submit" aria-label="Send to RuleX AI" disabled={!input.trim() || state === "thinking"}><ArrowUp size={16} /></button>
        </form>

        <p className="rulex-ai-disclaimer">AI suggests. You decide. Wallet signatures and smart contracts execute.</p>
      </section>}
    </>
  );
}
