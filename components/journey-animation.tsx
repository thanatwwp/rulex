"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, CheckCircle2, ClipboardCheck, FilePlus2, LockKeyhole, Pause, Play, Send, Wallet } from "lucide-react";

const DURATION = 5200;

const steps = [
  {
    label: "Connect wallet",
    actor: "Both sides",
    icon: Wallet,
    title: "Connect with MetaMask",
    detail: "Client and freelancer each connect MetaMask and sign a free message to access RuleX. Switch to Sepolia for project actions.",
    outcome: "Both wallets are ready. Signing in does not move test tokens.",
    state: "METAMASK CONNECTED",
    value: "Client ✓ · Freelancer ✓",
    vaultStatus: "Sign in with your wallet",
  },
  {
    label: "Set the job",
    actor: "Client",
    icon: FilePlus2,
    title: "Agree on the work",
    detail: "The client creates a project with the freelancer's wallet, clear deliverables, and up to three milestone payments.",
    outcome: "Everyone can see what each step is worth.",
    state: "PROJECT AGREEMENT",
    value: "Design · Build · Deliver",
    vaultStatus: "Waiting for funding",
  },
  {
    label: "Accept",
    actor: "Freelancer",
    icon: ClipboardCheck,
    title: "The freelancer accepts",
    detail: "The freelancer reviews the project and accepts the agreement with their own wallet.",
    outcome: "Both sides know the terms before funding.",
    state: "AGREEMENT ACCEPTED",
    value: "Both sides know the terms",
    vaultStatus: "Waiting for funding",
  },
  {
    label: "Lock payment",
    actor: "Client",
    icon: LockKeyhole,
    title: "The client secures the budget",
    detail: "The client locks the full project budget in RuleX escrow. The freelancer can see that the test tokens are secured.",
    outcome: "The project is funded before work begins.",
    state: "PAYMENT SECURED",
    value: "100 test RUSD locked",
    vaultStatus: "100 test RUSD locked",
  },
  {
    label: "Submit work",
    actor: "Freelancer",
    icon: Send,
    title: "The freelancer delivers",
    detail: "After finishing the current milestone, the freelancer submits a link or description of the completed work.",
    outcome: "The client can review the submitted result.",
    state: "WORK SUBMITTED",
    value: "Design files ready",
    vaultStatus: "100 test RUSD locked",
  },
  {
    label: "Approve & pay",
    actor: "Client",
    icon: CheckCircle2,
    title: "Approval releases payment",
    detail: "The client reviews and approves the milestone. The smart contract then sends that milestone's payment to the freelancer.",
    outcome: "Only the approved milestone amount is paid.",
    state: "MILESTONE 01 PAID",
    value: "30 test RUSD released",
    vaultStatus: "70 test RUSD remain",
  },
  {
    label: "Repeat",
    actor: "Both sides",
    icon: ArrowRight,
    title: "Finish one step at a time",
    detail: "The same submit, review, and payment cycle continues until all agreed milestones are complete.",
    outcome: "The remaining balance stays in escrow until released.",
    state: "UP NEXT",
    value: "Development · Final delivery",
    vaultStatus: "Milestones paid in order",
  },
] as const;

export default function JourneyAnimation() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) setPlaying(false);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    if (container.current) observer.observe(container.current);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);

  useEffect(() => {
    if (!playing || !visible || !pageVisible) return;
    const timer = window.setTimeout(() => setActive(current => (current + 1) % steps.length), DURATION);
    return () => window.clearTimeout(timer);
  }, [active, playing, visible, pageVisible]);

  const goTo = (index: number) => { setActive((index + steps.length) % steps.length); setPlaying(false); };
  const step = steps[active];
  const Icon = step.icon;
  const animating = playing && visible && pageVisible;

  return <section className="journey" id="how-rulex-works" ref={container} aria-labelledby="journey-title">
    <div className="journey-heading">
      <div><span className="journey-kicker">HOW RULEX WORKS</span><h2 id="journey-title">From agreement to payment, step by step.</h2><p>One secured budget. Payments released as milestones are approved.</p></div>
      <div className="journey-controls" aria-label="Animation controls">
        <button type="button" onClick={() => goTo(active - 1)} aria-label="Previous step"><ArrowLeft size={18} /></button>
        <button type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause animation" : "Play animation"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" onClick={() => goTo(active + 1)} aria-label="Next step"><ArrowRight size={18} /></button>
      </div>
    </div>

    <div className="journey-stage">
      <div className="journey-copy" key={"copy-" + active}>
        <span className="journey-step-number">STEP {String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
        <span className={"journey-actor " + (step.actor === "Freelancer" ? "is-freelancer" : step.actor === "Both sides" ? "is-both" : "is-client")}><Icon size={17} /> {step.actor}</span>
        <h3>{step.title}</h3>
        <p>{step.detail}</p>
        <div className="journey-outcome"><Check size={18} /><span>{step.outcome}</span></div>
      </div>

      <div className={"journey-diagram is-step-" + active + (active === 0 ? " is-wallet" : "")} role="img" aria-label={`Illustration of step ${active + 1}: ${step.title}`}>
        <div className="journey-party party-client"><BriefcaseBusiness size={24} /><strong>Client</strong>{active === 0 && <small>Wallet connected</small>}</div>
        <div className="journey-party party-freelancer"><Wallet size={24} /><strong>Freelancer</strong>{active === 0 && <small>Wallet connected</small>}</div>
        <div className="journey-route route-left" /><div className="journey-route route-right" />
        <div className="journey-vault">{active === 0 ? <img className="journey-metamask-icon" src="/metamask-fox.svg" alt="" aria-hidden="true" /> : <LockKeyhole size={26} />}<strong>{active === 0 ? "MetaMask" : "RuleX escrow"}</strong><span>{step.vaultStatus}</span></div>
        <div className="journey-orbit orbit-left" /><div className="journey-orbit orbit-right" />
        <div className="journey-deliverable"><span>{step.state}</span><strong>{step.value}</strong></div>
      </div>
    </div>

    <div className="journey-steps" aria-label="Choose a step">
      {steps.map((item, index) => <button key={item.label} type="button" className={"journey-step " + (index === active ? "is-active" : "")} onClick={() => goTo(index)} aria-current={index === active ? "step" : undefined}>
        <span className="journey-step-index">{String(index + 1).padStart(2, "0")}</span><span>{item.label}</span>
        {index === active && <span className="journey-step-progress" key={active + (animating ? "-play" : "-pause")} style={{ animationPlayState: animating ? "running" : "paused" }} />}
      </button>)}
    </div>
    <p className="journey-footnote">Illustration uses Sepolia test RUSD, which has no real monetary value. Wallet actions require confirmation.</p>
  </section>;
}
