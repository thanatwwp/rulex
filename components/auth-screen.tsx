"use client";

import { useEffect, useState } from "react";
import { BrowserProvider, getAddress, isAddress, type Eip1193Provider } from "ethers";
import { ArrowRight, BriefcaseBusiness, Check, Fingerprint, LockKeyhole, LogIn, Orbit, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { cleanError, shortAddress } from "@/lib/rulex";
import { selectWallet, walletSelectionError } from "@/lib/wallet-selection";
import ThemeToggle from "@/components/theme-toggle";
import type { Profile } from "@/lib/auth";

export default function AuthScreen({ mode }: { mode: "register" | "login" }) {
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"client" | "freelancer">("client");
  const [busy, setBusy] = useState(false);
  const [selectingWallet, setSelectingWallet] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "register";

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json() as Promise<{ profile: Profile | null }>).then(data => {
      if (data.profile) window.location.replace("/");
    }).catch(() => {});
    if (!window.ethereum) return;
    void new BrowserProvider(window.ethereum).send("eth_accounts", []).then(accounts => {
      if (accounts[0]) setWallet(getAddress(accounts[0]));
    }).catch(() => {});
    const changed = (...args: unknown[]) => {
      const accounts = args[0];
      setWallet(Array.isArray(accounts) && typeof accounts[0] === "string" && isAddress(accounts[0]) ? getAddress(accounts[0]) : "");
    };
    window.ethereum.on?.("accountsChanged", changed);
    return () => window.ethereum?.removeListener?.("accountsChanged", changed);
  }, []);

  async function connect() {
    if (!window.ethereum) throw new Error("Open RuleX in a browser with MetaMask installed.");
    const provider = new BrowserProvider(window.ethereum as Eip1193Provider);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts[0]) throw new Error("Select a wallet in MetaMask.");
    const address = getAddress(accounts[0]);
    setWallet(address);
    return { provider, address };
  }
  async function postJson(path: string, body: object) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const data = await response.json() as { error?: string; challengeId?: string; message?: string };
    if (!response.ok) throw new Error(data.error || "Please try again.");
    return data;
  }
  async function submit() {
    setError("");
    if (signup && name.trim().length < 2) { setError("Enter a display name with at least 2 characters."); return; }
    setBusy(true);
    try {
      const { provider, address } = await connect();
      const { challengeId, message } = await postJson("/api/auth/challenge", { wallet: address });
      if (!challengeId || !message) throw new Error("Could not create a wallet challenge.");
      const signer = await provider.getSigner(address);
      const signature = await signer.signMessage(message);
      const storageKey = `rulex-profile-${address.toLowerCase()}`;
      const saved = !signup ? (() => {
        try { return JSON.parse(localStorage.getItem(storageKey) || "null") as { displayName?: string; role?: "client" | "freelancer" } | null; }
        catch { return null; }
      })() : null;
      const profileData = signup
        ? { displayName: name.trim(), role }
        : { displayName: saved?.displayName || `User ${address.slice(0, 6)}`, role: saved?.role || "client" as const };
      await postJson(signup ? "/api/auth/register" : "/api/auth/login", { challengeId, signature, ...profileData });
      localStorage.setItem(storageKey, JSON.stringify(profileData));
      window.location.assign("/");
    } catch (cause) { setError(cleanError(cause)); setBusy(false); }
  }
  async function connectOnly() {
    setError("");
    try { await connect(); }
    catch (cause) { setError(cleanError(cause)); }
  }
  async function changeWallet() {
    setError(""); setSelectingWallet(true);
    try {
      if (!window.ethereum) throw new Error("Open RuleX in a browser with MetaMask installed.");
      const selected = await selectWallet(window.ethereum);
      if (selected.toLowerCase() === wallet.toLowerCase()) setError("MetaMask kept the same account. Choose another one in MetaMask and try again.");
      setWallet(selected);
    } catch (cause) { setError(walletSelectionError(cause)); }
    finally { setSelectingWallet(false); }
  }

  return <div className="auth-shell">
    <header className="auth-topbar"><a href="/" className="brand"><span className="brand-mark">R<span>x</span></span><strong>RuleX</strong></a><div className="topbar-utilities"><ThemeToggle /><span className="auth-network"><span className="network-indicator" /> SEPOLIA TESTNET</span></div></header>
    <main className="auth-layout">
      <section className="auth-intro"><span className="auth-kicker">SECURE WALLET SIGN-IN</span><h1>{signup ? "Secure milestone work with clear approvals." : "Sign in to your RuleX test account."}</h1><p>Agree on work. Secure test funds in escrow. Release each milestone when it is approved.</p>
        <div className="auth-sequence"><div><span>01</span><strong>Connect</strong><small>Your MetaMask wallet is your account.</small></div><div><span>02</span><strong>Sign</strong><small>A message proves you control the wallet. No gas fee.</small></div><div><span>03</span><strong>Collaborate</strong><small>Create or accept agreements on Sepolia.</small></div></div>
        <div className="auth-safety"><ShieldCheck size={18} /> University prototype · Sepolia only · Never share a recovery phrase, private key, or wallet password</div>
      </section>
      <section className="auth-panel"><div className="auth-panel-head"><span className="auth-chip"><Fingerprint size={15} /> WALLET OWNERSHIP</span><span className="auth-panel-index">{signup ? "01 / REGISTER" : "02 / SIGN IN"}</span></div>
        <h2>{signup ? "Create your account" : "Sign in with your wallet"}</h2><p className="auth-panel-subtitle">{signup ? "Create a profile for the wallet you will use on Ethereum Sepolia. RuleX never asks for your seed phrase or private key." : "Connect your registered wallet and approve a free ownership message. No funds move during sign-in."}</p>
        {signup && <><label className="form-group"><span className="form-label">Display name</span><input className="field" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="nickname" placeholder="How should people call you?" /></label>
          <fieldset className="role-fieldset"><legend className="form-label">I’m joining as a</legend><div className="role-options"><label className={"role-card " + (role === "client" ? "is-selected" : "")}><input type="radio" name="role" value="client" checked={role === "client"} onChange={() => setRole("client")} /><BriefcaseBusiness size={22} /><strong>Client</strong><span>Create projects and approve work.</span><Check size={16} className="role-check" /></label><label className={"role-card " + (role === "freelancer" ? "is-selected" : "")}><input type="radio" name="role" value="freelancer" checked={role === "freelancer"} onChange={() => setRole("freelancer")} /><Orbit size={22} /><strong>Freelancer</strong><span>Accept projects and submit work.</span><Check size={16} className="role-check" /></label></div></fieldset></>}
        <div className="auth-wallet"><div><Wallet size={19} /><span>{wallet ? shortAddress(wallet) : "No wallet connected"}</span></div><button type="button" disabled={busy || selectingWallet} onClick={() => void (wallet ? changeWallet() : connectOnly())}>{selectingWallet ? "Opening MetaMask…" : wallet ? "Change wallet" : "Connect wallet"}</button></div>
        {error && <div role="alert" className="auth-error">{error}</div>}
        <button className="button button-primary auth-submit" type="button" onClick={() => void submit()} disabled={busy}>{busy ? "Waiting for MetaMask…" : signup ? "Create account & sign" : "Sign in & sign"} {signup ? <ArrowRight size={18} /> : <LogIn size={18} />}</button>
        <p className="auth-explain"><LockKeyhole size={16} /> Signing this login message is free and does not transfer tokens or grant token approval. Contract actions require a separate MetaMask confirmation.</p><a className="auth-trust-link" href="/trust"><ShieldCheck size={15} /> Read how RuleX protects wallet users</a>
        <div className="auth-switch">{signup ? "Already registered?" : "New to RuleX?"} <a href={signup ? "/login" : "/register"}>{signup ? "Sign in" : "Create an account"} <ArrowRight size={15} /></a></div>
      </section>
    </main><footer className="auth-footer"><span><Sparkles size={14} /> RuleX prototype</span><span>Powered by Ethereum Sepolia</span></footer>
  </div>;
}
