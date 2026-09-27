"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, Contract, Interface, getAddress, isAddress, parseUnits, type Eip1193Provider } from "ethers";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, CircleHelp, Copy, ExternalLink, FileCheck2, FilePlus2, Layers3, LoaderCircle, LockKeyhole, LogOut, Menu, Plus, RefreshCw, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import JourneyAnimation from "@/components/journey-animation";
import RulexAiAssistant from "@/components/rulex-ai-assistant";
import { cleanError, escrowAbi, money, shortAddress, starterDraft, statusName, tokenAbi, type Milestone, type Project } from "@/lib/rulex";
import { selectWallet, walletSelectionError } from "@/lib/wallet-selection";
import type { Profile } from "@/lib/auth";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { on?: (event: string, handler: (...args: unknown[]) => void) => void; removeListener?: (event: string, handler: (...args: unknown[]) => void) => void };
  }
}

const CHAIN_ID = 11155111n;
const DEFAULT_ESCROW = "0xFad4B34f9341643Ea3804Ba991d1961165Cac335";
const EXPLORER = "https://sepolia.etherscan.io";
type DraftMilestone = { description: string; amount: string };
type TxState = { label: string; hash: string; pending: boolean } | null;
const STARTER: DraftMilestone[] = [{ description: "Design", amount: "30" }, { description: "Development", amount: "40" }, { description: "Final delivery", amount: "30" }];

function projectFromRaw(raw: any, id: number): Project {
  return { id, client: raw.client, freelancer: raw.freelancer, title: raw.title, description: raw.projectDescription,
    totalAmount: raw.totalAmount, escrowBalance: raw.escrowBalance, currentMilestone: Number(raw.currentMilestone),
    status: Number(raw.status), clientCancellationApproved: raw.clientCancellationApproved,
    freelancerCancellationApproved: raw.freelancerCancellationApproved };
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [escrowAddress, setEscrowAddress] = useState(DEFAULT_ESCROW);
  const [addressInput, setAddressInput] = useState(DEFAULT_ESCROW);
  const [tokenAddress, setTokenAddress] = useState("");
  const [symbol, setSymbol] = useState("RUSD");
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState(0n);
  const [owner, setOwner] = useState("");
  const [allowance, setAllowance] = useState(0n);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [selectedMilestones, setSelectedMilestones] = useState<Milestone[]>([]);
  const [projectIdInput, setProjectIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [txState, setTxState] = useState<TxState>(null);
  const [tab, setTab] = useState("projects");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [changingWallet, setChangingWallet] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freelancer, setFreelancer] = useState("");
  const [draft, setDraft] = useState<DraftMilestone[]>(STARTER);
  const [draftNote, setDraftNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submission, setSubmission] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("150");
  const providerRef = useRef<BrowserProvider | null>(null);
  const onSepolia = chainId === CHAIN_ID;
  const walletMatches = Boolean(profile && account && profile.wallet.toLowerCase() === account.toLowerCase());
  const ready = Boolean(walletMatches && onSepolia && tokenAddress);
  const client = Boolean(selected && account && selected.client.toLowerCase() === account.toLowerCase());
  const worker = Boolean(selected && account && selected.freelancer.toLowerCase() === account.toLowerCase());
  const tokenOwner = Boolean(owner && account && owner.toLowerCase() === account.toLowerCase());
  const current = selectedMilestones[selected?.currentMilestone ?? -1];
  const total = useMemo(() => draft.reduce((n, m) => n + (Number(m.amount) || 0), 0), [draft]);

  const provider = useCallback(() => {
    if (!window.ethereum) throw new Error("MetaMask is not available in this browser.");
    if (!providerRef.current) providerRef.current = new BrowserProvider(window.ethereum);
    return providerRef.current;
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json() as Promise<{ profile: Profile | null }>).then(data => {
      setProfile(data.profile || null);
    }).catch(() => toast.error("Could not load your RuleX account.")).finally(() => setSessionChecked(true));
  }, []);

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Try again.");
      window.location.assign("/login");
    } catch (error) { toast.error(cleanError(error)); }
  };

  const loadProject = useCallback(async (id: number, wallet: string, contractAddress: string, token: string) => {
    const p = provider();
    const escrow = new Contract(contractAddress, escrowAbi, p);
    const raw = await escrow.projects(id);
    if (Number(raw.id) !== id) throw new Error("Project #" + id + " does not exist on this escrow contract.");
    const project = projectFromRaw(raw, id);
    const length = Number(await escrow.getMilestoneCount(id));
    const values = await Promise.all(Array.from({ length }, (_, i) => escrow.getMilestone(id, i)));
    const details: Milestone[] = values.map((v, i) => ({ index: i, description: v.description, amount: v.amount, submitted: v.submitted, submission: v.submission, approved: v.approved, paid: v.paid }));
    setSelected(project); setSelectedMilestones(details); setProjectIdInput(String(id));
    if (token && wallet.toLowerCase() === project.client.toLowerCase()) {
      setAllowance(await new Contract(token, tokenAbi, p).allowance(wallet, contractAddress));
    } else setAllowance(0n);
  }, [provider]);

  const refresh = useCallback(async (wallet = account, contractAddress = escrowAddress, focusId?: number) => {
    if (!wallet || !isAddress(contractAddress)) return;
    setLoading(true);
    try {
      const p = provider();
      const network = await p.getNetwork();
      setChainId(network.chainId);
      if (network.chainId !== CHAIN_ID) return;
      if (await p.getCode(contractAddress) === "0x") throw new Error("No escrow contract was found at this address on Sepolia.");
      const escrow = new Contract(contractAddress, escrowAbi, p);
      const token: string = await escrow.paymentToken();
      const t = new Contract(token, tokenAbi, p);
      const [countRaw, tokenSymbol, d, tokenBalance, tokenOwnerAddress] = await Promise.all([escrow.projectCount(), t.symbol(), t.decimals(), t.balanceOf(wallet), t.owner()]);
      setTokenAddress(token); setSymbol(tokenSymbol); setDecimals(Number(d)); setBalance(tokenBalance); setOwner(tokenOwnerAddress);
      const count = Number(countRaw);
      const ids = Array.from({ length: Math.min(count, 50) }, (_, i) => count - i);
      const values = await Promise.all(ids.map(id => escrow.projects(id)));
      const mine = values.map((v, i) => projectFromRaw(v, ids[i])).filter(pr => pr.client.toLowerCase() === wallet.toLowerCase() || pr.freelancer.toLowerCase() === wallet.toLowerCase());
      setProjects(mine);
      const id = focusId || (selected?.id && selected.id <= count ? selected.id : mine[0]?.id);
      if (id) await loadProject(id, wallet, contractAddress, token);
      else { setSelected(null); setSelectedMilestones([]); }
    } catch (error) { toast.error(cleanError(error)); }
    finally { setLoading(false); }
  }, [account, escrowAddress, loadProject, provider, selected?.id]);

  const connect = async () => {
    try {
      const p = provider();
      const accounts = await p.send("eth_requestAccounts", []);
      if (!accounts.length) return;
      const wallet = getAddress(accounts[0]);
      setAccount(wallet);
      const n = await p.getNetwork();
      setChainId(n.chainId);
      if (profile && wallet.toLowerCase() !== profile.wallet.toLowerCase()) toast.info("Switch MetaMask to your registered wallet before using RuleX.");
      else if (n.chainId === CHAIN_ID) await refresh(wallet);
      else toast.info("Switch MetaMask to Sepolia to use RuleX.");
    } catch (error) { toast.error(cleanError(error)); }
  };

  const changeWallet = async () => {
    if (busy || txState?.pending) { toast.info("Wait for your transaction to finish before changing wallets."); return; }
    if (!window.ethereum) { toast.error("Open RuleX in a browser with MetaMask installed."); return; }
    setChangingWallet(true);
    try {
      const wallet = await selectWallet(window.ethereum);
      if (profile && wallet.toLowerCase() !== profile.wallet.toLowerCase()) {
        toast.info(`Selected ${shortAddress(wallet)}. Sign in or register with that wallet.`);
        await logout();
      } else {
        setAccount(wallet);
        toast.success(`Using ${shortAddress(wallet)}.`);
      }
    } catch (error) { toast.error(walletSelectionError(error)); }
    finally { setChangingWallet(false); }
  };

  useEffect(() => {
    const saved = localStorage.getItem("rulex-escrow");
    if (saved && isAddress(saved)) { setEscrowAddress(saved); setAddressInput(saved); }
    if (!window.ethereum) return;
    const p = provider();
    void p.send("eth_accounts", []).then(async (accounts: string[]) => {
      if (accounts.length) { setAccount(getAddress(accounts[0])); setChainId((await p.getNetwork()).chainId); }
    }).catch(() => {});
    const accountsChanged = (...args: unknown[]) => {
      providerRef.current = null;
      const accounts = args[0];
      const wallet = Array.isArray(accounts) && typeof accounts[0] === "string" && isAddress(accounts[0]) ? getAddress(accounts[0]) : "";
      setAccount(wallet); setChainId(null); setTokenAddress(""); setOwner(""); setBalance(0n); setAllowance(0n);
      setProjects([]); setSelected(null); setSelectedMilestones([]); setTxState(null);
      if (wallet && window.ethereum) void new BrowserProvider(window.ethereum).getNetwork().then(network => setChainId(network.chainId)).catch(() => setChainId(null));
    };
    const chainChanged = () => { providerRef.current = null; window.location.reload(); };
    window.ethereum.on?.("accountsChanged", accountsChanged);
    window.ethereum.on?.("chainChanged", chainChanged);
    return () => { window.ethereum?.removeListener?.("accountsChanged", accountsChanged); window.ethereum?.removeListener?.("chainChanged", chainChanged); };
  }, [provider]);

  useEffect(() => { if (walletMatches && onSepolia) void refresh(); }, [walletMatches, account, onSepolia, escrowAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    type Context = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "stage_rulex_agreement_draft", title: "Stage a RuleX agreement draft",
      description: "Fill the editable agreement form with a project brief, freelancer address, and one to three milestone descriptions and RUSD amounts. This does not sign or create an on-chain project.",
      inputSchema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, freelancer: { type: "string" }, milestones: { type: "array", minItems: 1, maxItems: 3, items: { type: "object", properties: { description: { type: "string" }, amount: { type: "string" } }, required: ["description", "amount"], additionalProperties: false } } }, required: ["title", "description", "freelancer", "milestones"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const value = input as { title?: unknown; description?: unknown; freelancer?: unknown; milestones?: unknown };
        if (!value || typeof value.title !== "string" || typeof value.description !== "string" || typeof value.freelancer !== "string" || !Array.isArray(value.milestones) || value.milestones.length < 1 || value.milestones.length > 3 || value.milestones.some(m => !m || typeof m.description !== "string" || typeof m.amount !== "string" || !/^\d+(\.\d{1,18})?$/.test(m.amount) || Number(m.amount) <= 0)) throw new Error("Provide a title, brief, freelancer wallet, and one to three positive RUSD milestones.");
        if (!isAddress(value.freelancer)) throw new Error("Enter a valid freelancer address.");
        setTitle(value.title.slice(0, 100)); setDescription(value.description.slice(0, 1600)); setFreelancer(value.freelancer);
        setDraft(value.milestones.map(m => ({ description: m.description.slice(0, 240), amount: m.amount })));
        setDraftNote("Editable draft — review before signing."); setTab("create");
        return { staged: true, milestoneCount: value.milestones.length, onChain: false };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, []);

  const switchNetwork = async () => {
    try { await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] }); }
    catch (error) { toast.error(cleanError(error)); }
  };

  const transact = async (label: string, action: (escrow: Contract, token: Contract) => Promise<any>, focusId?: number) => {
    if (!ready) { toast.error("Connect MetaMask on Sepolia first."); return false; }
    setBusy(label);
    try {
      const signer = await provider().getSigner();
      const escrow = new Contract(escrowAddress, escrowAbi, signer);
      const token = new Contract(tokenAddress, tokenAbi, signer);
      const tx = await action(escrow, token);
      setTxState({ label, hash: tx.hash, pending: true });
      toast.info("Transaction submitted. Waiting for confirmation…");
      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Transaction failed on Sepolia.");
      let id = focusId;
      if (label === "Creating agreement") {
        const parser = new Interface(escrowAbi);
        for (const log of receipt.logs) {
          try { const event = parser.parseLog(log); if (event?.name === "ProjectCreated") id = Number(event.args.projectId); }
          catch { /* token log */ }
        }
        setTab("projects"); setTitle(""); setDescription(""); setFreelancer(""); setDraft(STARTER); setDraftNote("");
      }
      setTxState({ label, hash: tx.hash, pending: false });
      toast.success(label + " confirmed.");
      await refresh(account, escrowAddress, id);
      return true;
    } catch (error) { toast.error(cleanError(error)); setTxState(null); return false; }
    finally { setBusy(""); }
  };

  const create = async () => {
    try {
      if (!isAddress(freelancer)) throw new Error("Enter a valid freelancer wallet address.");
      if (getAddress(freelancer) === account) throw new Error("The client and freelancer need different wallets.");
      if (!title.trim() || !description.trim()) throw new Error("Add a title and project description.");
      if (draft.length < 1 || draft.length > 3 || draft.some(m => !m.description.trim())) throw new Error("Add descriptions for one to three milestones.");
      const amounts = draft.map(m => parseUnits(m.amount.trim(), decimals));
      if (amounts.some(a => a <= 0n)) throw new Error("Each milestone amount must be greater than zero.");
      await transact("Creating agreement", e => e.createProject(getAddress(freelancer), title.trim(), description.trim(), draft.map(m => m.description.trim()), amounts));
    } catch (error) { toast.error(cleanError(error)); }
  };

  const generate = async () => {
    if (!description.trim()) { toast.error("Describe the work first."); return; }
    setGenerating(true);
    try {
      const response = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, budget: total || 100 }) });
      if (response.ok) {
        const result = await response.json() as { title?: string; milestones?: DraftMilestone[] };
        if (result.milestones?.length && result.milestones.length <= 3) {
          setDraft(result.milestones); if (!title && result.title) setTitle(result.title);
          setDraftNote("AI draft — review every detail before signing."); toast.success("AI draft created."); setGenerating(false); return;
        }
      }
    } catch { /* optional API fallback */ }
    setDraft(starterDraft(description, total || 100));
    setDraftNote("Local starter draft — AI is not connected yet.");
    toast.info("An editable starter draft was created. AI is not connected yet.");
    setGenerating(false);
  };
  const updateDraft = (i: number, key: keyof DraftMilestone, value: string) => setDraft(items => items.map((m, index) => index === i ? { ...m, [key]: value } : m));
  const openId = async () => {
    const id = Number(projectIdInput);
    if (!Number.isSafeInteger(id) || id <= 0 || !ready) { toast.error("Connect on Sepolia and enter a valid project ID."); return; }
    try { await loadProject(id, account, escrowAddress, tokenAddress); setTab("projects"); }
    catch (error) { toast.error(cleanError(error)); }
  };
  const useContract = () => {
    if (!isAddress(addressInput)) { toast.error("Enter a valid RuleXEscrow address."); return; }
    const next = getAddress(addressInput);
    localStorage.setItem("rulex-escrow", next);
    setEscrowAddress(next); setSelected(null); setProjects([]); setSettingsOpen(false);
    toast.info("Checking this escrow contract on Sepolia…");
  };
  const actionBusy = Boolean(busy);
  const currentStatus = selected ? statusName[selected.status] : "";

  if (!sessionChecked) return <div className="auth-gate"><div className="auth-gate-panel"><span className="brand-mark">R<span>x</span></span><p>Loading your RuleX account…</p></div></div>;
  if (!profile) return <div className="public-home">
    <header className="public-topbar"><a className="brand" href="/" aria-label="RuleX home"><span className="brand-mark">R<span>x</span></span><strong>RuleX</strong></a><span className="auth-network"><span className="network-indicator" /> SEPOLIA TESTNET</span></header>
    <main className="public-content">
      <div className="public-intro"><span className="auth-kicker">RULEX · MILESTONE ESCROW PROTOTYPE</span><h1>Clear agreements.<br /><em>Safer test payments.</em></h1><p>RuleX is a university prototype for clients and freelancers to test milestone escrow on Ethereum Sepolia. It uses test tokens only and never asks for a seed phrase or private key.</p><div className="public-actions"><a className="button button-primary" href="/register">Create a test account <ArrowRight size={18} /></a><a className="button button-outline" href="/login">Sign in</a><a className="button button-quiet" href="/trust"><ShieldCheck size={17} /> Trust & safety</a></div></div>
      <section className="trust-strip" aria-label="RuleX safety summary">
        <div><ShieldCheck size={20} /><span><strong>Sepolia testnet only</strong><small>No real-value RuleX tokens are used.</small></span></div>
        <div><LockKeyhole size={20} /><span><strong>Your wallet stays in your control</strong><small>Every signature and transaction is confirmed in MetaMask.</small></span></div>
        <div><FileCheck2 size={20} /><span><strong>Public project information</strong><small>Review the source code and deployed contract before testing.</small></span></div>
        <div className="trust-links"><a href="https://github.com/thanatwwp/rulex" target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a><a href={EXPLORER + "/address/" + DEFAULT_ESCROW} target="_blank" rel="noreferrer">Sepolia contract <ExternalLink size={13} /></a></div>
      </section>
      <JourneyAnimation />
    </main>
    <footer className="auth-footer"><span>RuleX · University prototype · Not audited</span><span><a href="/trust">Trust & safety</a> · Ethereum Sepolia · Test tokens only</span></footer>
  </div>;

  return <div className="site-shell">
    <Toaster richColors position="bottom-right" />
    <header className="topbar"><div className="header-inner">
      <a className="brand" href="/" aria-label="RuleX home"><span className="brand-mark">R<span>x</span></span><strong>RuleX</strong></a>
      <span className="network-tag"><span className="network-indicator" /> ETHEREUM SEPOLIA <span className="testnet-label">TESTNET</span></span>
      <div className="header-spacer" />
      <button className="icon-button mobile-menu" type="button" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21} /></button>
      <div className={"header-actions " + (mobileMenu ? "is-open" : "")}>
        <span className="profile-badge"><strong>{profile.displayName}</strong><small>{profile.role}</small></span>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild><button className="header-link" type="button">Contract <ChevronRight size={15} /></button></DialogTrigger>
          <DialogContent className="contract-dialog">
            <DialogHeader><DialogTitle>Published Sepolia contract</DialogTitle><DialogDescription>RuleX uses one published escrow address for this prototype. Users cannot silently switch the production site to another contract.</DialogDescription></DialogHeader>
            <label className="form-label" htmlFor="contract-address">RuleXEscrow address</label>
            <input className="field monospace" id="contract-address" value={escrowAddress} readOnly spellCheck={false} />
            {tokenAddress && <div className="contract-info"><span>Payment token</span><code>{tokenAddress}</code></div>}
            <a className="button button-outline full-width" href={EXPLORER + "/address/" + escrowAddress} target="_blank" rel="noreferrer">View contract on Etherscan <ExternalLink size={15} /></a>
            <a className="button button-quiet full-width" href="/trust"><ShieldCheck size={15} /> Read RuleX trust & safety</a>
          </DialogContent>
        </Dialog>
        {account ? <button className="wallet-connected" type="button" onClick={!walletMatches ? () => void changeWallet() : onSepolia ? () => void refresh() : switchNetwork}><span className="wallet-status" />{onSepolia ? shortAddress(account) : "Switch to Sepolia"}{onSepolia && walletMatches ? <RefreshCw size={15} /> : <ArrowRight size={15} />}</button>
          : <button className="button button-primary" onClick={() => void connect()}><Wallet size={17} /> Connect MetaMask (Sepolia)</button>}
        {account && <button className="header-link change-wallet-button" type="button" onClick={() => void changeWallet()} disabled={changingWallet || Boolean(busy) || Boolean(txState?.pending)}><Wallet size={16} /> {changingWallet ? "Opening MetaMask…" : "Change wallet"}</button>}
        <button className="header-link logout-button" type="button" onClick={() => void logout()}><LogOut size={16} /> Log out</button>
      </div>
    </div></header>

    <main className="app-container">
      <div className="page-heading"><div><div className="eyebrow">RULEX · MILESTONE ESCROW <span /></div><h1>Your agreements.</h1><p>Track work, secure test funds, and release payment one milestone at a time. <a className="how-it-works-link" href="#how-rulex-works">See how it works ↓</a></p></div><div className="heading-actions"><button className="button button-outline" type="button" onClick={() => ready ? void refresh() : void connect()} disabled={loading}><RefreshCw size={16} className={loading ? "spinning" : ""} /> Refresh</button><button className="button button-primary" type="button" onClick={() => setTab("create")}><Plus size={17} /> New agreement</button></div></div>
      {account && !walletMatches && <div className="notice warning"><CircleHelp size={20} /><div><strong>This wallet has a different RuleX account</strong><span>You selected {shortAddress(account)}. Sign in or register with it before using the dashboard, or change back to {shortAddress(profile.wallet)}.</span></div><button type="button" onClick={() => void logout()}>Continue with this wallet <ArrowRight size={16} /></button></div>}
      {!account && <div className="notice"><Wallet size={19} /><div><strong>Connect MetaMask on Sepolia</strong><span>RuleX never asks for your seed phrase or private key. MetaMask shows every signature and transaction before you approve it.</span></div><button onClick={() => void connect()}>Connect <ArrowRight size={16} /></button></div>}
      {account && !onSepolia && <div className="notice warning"><CircleHelp size={20} /><div><strong>Switch to Ethereum Sepolia</strong><span>RuleX uses test RUSD and Sepolia ETH for gas.</span></div><button onClick={switchNetwork}>Switch network <ArrowRight size={16} /></button></div>}
      {txState && <div className="transaction-banner"><span className={"transaction-icon " + (txState.pending ? "is-pending" : "")}>{txState.pending ? <LoaderCircle size={17} className="spinning" /> : <Check size={17} />}</span><div><strong>{txState.label}</strong><span>{txState.pending ? "Waiting for confirmation" : "Confirmed on Sepolia"}</span></div><a href={EXPLORER + "/tx/" + txState.hash} target="_blank" rel="noreferrer">View transaction <ExternalLink size={14} /></a><button type="button" aria-label="Dismiss transaction" onClick={() => setTxState(null)}><X size={16} /></button></div>}

      <div className="workspace-grid"><section className="primary-column">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="workspace-header"><TabsList className="workspace-tabs"><TabsTrigger value="projects">Projects</TabsTrigger><TabsTrigger value="create">Create agreement</TabsTrigger><TabsTrigger value="token">Demo token</TabsTrigger></TabsList><span className="workspace-context">{ready ? projects.length + " of your projects" : "Connect a wallet to view projects"}</span></div>
          <TabsContent value="projects" className="tab-body">
            <div className="section-header"><div><h2>Your agreements</h2><p>Projects you created or joined as the freelancer.</p></div></div>
            {ready && projects.length ? <div className="project-list">{projects.map(pr => <button key={pr.id} className={"project-row " + (selected?.id === pr.id ? "is-selected" : "")} onClick={() => void loadProject(pr.id, account, escrowAddress, tokenAddress)}><span className="project-icon"><Layers3 size={19} /></span><span className="project-main"><strong>{pr.title || "Project #" + pr.id}</strong><small>#{pr.id} · {pr.client.toLowerCase() === account.toLowerCase() ? "You are the client" : "You are the freelancer"}</small></span><span className={"status-pill status-" + pr.status}>{statusName[pr.status]}</span><span className="project-amount">{money(pr.totalAmount, decimals)} {symbol}</span><ChevronRight size={17} className="project-chevron" /></button>)}</div>
              : <div className="empty-state"><div className="empty-icon"><FilePlus2 size={23} /></div><h3>{ready ? "No agreements in this wallet yet" : "Your projects will appear here"}</h3><p>{ready ? "Create an agreement, or open a project by ID if someone invited you." : "Connect MetaMask on Sepolia to see agreements you created or joined."}</p><button className="button button-outline" onClick={() => setTab("create")}>Create your first agreement <ArrowRight size={16} /></button></div>}
            <div className="lookup-panel"><div><strong>Open a project by ID</strong><span>Use the project number from a confirmed creation transaction.</span></div><div className="lookup-controls"><input className="field" type="number" min="1" placeholder="Project ID" aria-label="Project ID" value={projectIdInput} onChange={e => setProjectIdInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void openId(); }} /><button className="button button-outline" disabled={!ready} onClick={() => void openId()}>Open</button></div></div>
          </TabsContent>
          <TabsContent value="create" className="tab-body">
            <div className="section-header"><div><h2>Create an agreement</h2><p>Set the work and payment before either person signs.</p></div><span className="step-marker">01 / 03</span></div>
            <div className="form-grid"><label className="form-group"><span className="form-label">Project title</span><input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Build a portfolio website" /></label><label className="form-group"><span className="form-label">Freelancer wallet address</span><input className="field monospace" value={freelancer} onChange={e => setFreelancer(e.target.value)} placeholder="0x…" spellCheck={false} /></label></div>
            <label className="form-group"><span className="form-label">What needs to be done?</span><textarea className="field text-area" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the deliverables and what success looks like…" /></label>
            <div className="milestone-header"><div><h3>Milestones</h3><p>Up to three payments, released in order.</p></div><button className="draft-button" onClick={() => void generate()} disabled={generating}><Sparkles size={16} /> {generating ? "Drafting…" : "Generate draft"}</button></div>
            {draftNote && <p className="draft-origin"><Sparkles size={14} /> {draftNote}</p>}
            <div className="milestone-editor">{draft.map((m, i) => <div className="milestone-edit-row" key={i}><span className="milestone-number">{String(i + 1).padStart(2, "0")}</span><label><span className="visually-hidden">Milestone {i + 1} description</span><input className="field" value={m.description} onChange={e => updateDraft(i, "description", e.target.value)} placeholder="Deliverable and acceptance criteria" /></label><label className="amount-field"><span className="visually-hidden">Milestone {i + 1} amount</span><input className="field" inputMode="decimal" value={m.amount} onChange={e => updateDraft(i, "amount", e.target.value)} placeholder="0" /><em>{symbol}</em></label><button className="remove-row" title="Remove milestone" aria-label={"Remove milestone " + (i + 1)} disabled={draft.length === 1} onClick={() => setDraft(items => items.filter((_, j) => j !== i))}><X size={17} /></button></div>)}</div>
            {draft.length < 3 && <button className="add-milestone" onClick={() => setDraft(items => [...items, { description: "", amount: "" }])}><Plus size={16} /> Add milestone</button>}
            <div className="form-total"><span>Total project budget</span><strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(total)} <small>{symbol}</small></strong></div>
            <div className="form-footer"><p><ShieldCheck size={17} /> The freelancer accepts after creation. The client funds after acceptance.</p><button className="button button-primary" disabled={!ready || actionBusy} onClick={() => void create()}>{busy === "Creating agreement" ? <LoaderCircle size={17} className="spinning" /> : <FileCheck2 size={17} />} Create agreement</button></div>
          </TabsContent>
          <TabsContent value="token" className="tab-body">
            <div className="section-header"><div><h2>Test RUSD</h2><p>Educational Sepolia tokens with no monetary value.</p></div></div>
            <div className="token-summary"><div className="token-emblem">R</div><div><span>Your balance</span><strong>{money(balance, decimals)} <small>{symbol}</small></strong></div>{tokenAddress && <a href={EXPLORER + "/token/" + tokenAddress} target="_blank" rel="noreferrer">View token <ExternalLink size={15} /></a>}</div>
            <div className="token-detail"><span>Token contract</span><code>{tokenAddress || "Connect MetaMask to load the token address"}</code><button className="icon-button" disabled={!tokenAddress} aria-label="Copy token address" onClick={() => { void navigator.clipboard.writeText(tokenAddress); toast.success("Token address copied."); }}><Copy size={17} /></button></div>
            {tokenOwner && <div className="mint-panel"><h3>Give someone test tokens</h3><p>Only the token deployer can mint. Enter a whole number of RUSD.</p><div className="mint-controls"><input className="field monospace" value={mintTo} onChange={e => setMintTo(e.target.value)} placeholder="Recipient wallet 0x…" aria-label="Recipient wallet" /><input className="field" type="number" min="1" step="1" value={mintAmount} onChange={e => setMintAmount(e.target.value)} aria-label="Whole token amount" /><button className="button button-primary" disabled={!ready || actionBusy} onClick={() => { if (!isAddress(mintTo) || !Number.isSafeInteger(Number(mintAmount)) || Number(mintAmount) <= 0) { toast.error("Enter a valid wallet and whole-token amount."); return; } void transact("Minting test RUSD", (_e, t) => t.mint(mintTo, BigInt(mintAmount))); }}>Mint</button></div></div>}
          </TabsContent>
        </Tabs>
      </section>

      <aside className="detail-column" aria-label="Project details">{selected ? <>
        <div className="detail-card"><div className="detail-top"><span className="detail-kicker">PROJECT #{selected.id}</span><span className={"status-pill status-" + selected.status}>{currentStatus}</span></div><h2>{selected.title || "Project #" + selected.id}</h2><p className="detail-description">{selected.description || "No description provided."}</p>
          <div className="escrow-meter"><div className="meter-caption"><span>Still in escrow</span><strong>{money(selected.escrowBalance, decimals)} <small>{symbol}</small></strong></div><div className="meter-track"><div style={{ width: (selected.totalAmount > 0n ? Number(selected.escrowBalance * 100n / selected.totalAmount) : 0) + "%" }} /></div><div className="meter-foot"><span>Total {money(selected.totalAmount, decimals)} {symbol}</span><span>{selected.currentMilestone} of {selectedMilestones.length} paid</span></div></div>
          <div className="party-list"><div><span>Client</span><code>{shortAddress(selected.client)}</code>{client && <em>You</em>}</div><div><span>Freelancer</span><code>{shortAddress(selected.freelancer)}</code>{worker && <em>You</em>}</div></div>
          <a className="contract-link" href={EXPLORER + "/address/" + escrowAddress} target="_blank" rel="noreferrer">View escrow contract <ArrowUpRight size={16} /></a>
        </div>
        <div className="detail-card milestones-card"><div className="card-header"><h3>Milestones</h3><span>{selectedMilestones.length} steps</span></div><div className="timeline">{selectedMilestones.map(m => <div className={"timeline-row " + (m.paid ? "is-paid " : "") + (selected.currentMilestone === m.index && selected.status === 2 ? "is-current" : "")} key={m.index}><span className="timeline-node">{m.paid ? <Check size={14} /> : m.index + 1}</span><div><strong>{m.description}</strong><small>{m.paid ? "Paid" : m.submitted ? "Work submitted" : selected.currentMilestone === m.index ? "Current milestone" : "Upcoming"}</small>{m.submission && <p className="submission-note">{m.submission}</p>}</div><span className="timeline-amount">{money(m.amount, decimals)} {symbol}</span></div>)}</div></div>
        <div className="detail-card action-card"><div className="card-header"><h3>Next action</h3><span>{client ? "Client" : worker ? "Freelancer" : "View only"}</span></div>
          {selected.status === 0 && (worker ? <><p>Review the agreement before accepting these terms.</p><button className="button button-primary full-width" disabled={actionBusy} onClick={() => void transact("Accepting agreement", e => e.acceptProject(selected.id), selected.id)}>Accept agreement <ArrowRight size={17} /></button></> : <p>Waiting for the freelancer to accept.</p>)}
          {selected.status === 1 && (client ? <><p>Lock the full budget after giving this escrow permission to move test RUSD.</p><div className="approval-detail"><span>Approved allowance</span><strong>{money(allowance, decimals)} {symbol}</strong></div>{allowance < selected.totalAmount ? <button className="button button-primary full-width" disabled={actionBusy} onClick={() => void transact("Approving RUSD", (_e, t) => t.approve(escrowAddress, selected.totalAmount), selected.id)}>Approve {money(selected.totalAmount, decimals)} {symbol} <ArrowRight size={17} /></button> : <button className="button button-primary full-width" disabled={actionBusy} onClick={() => void transact("Funding escrow", e => e.fundProject(selected.id), selected.id)}>Fund project <LockKeyhole size={17} /></button>}</> : <p>Waiting for the client to fund the accepted agreement.</p>)}
          {selected.status === 2 && (current ? worker ? current.submitted ? <p>Work submitted. Waiting for the client to review it.</p> : <><p>Submit the deliverable for <strong>{current.description}</strong>.</p><textarea className="field text-area" rows={3} aria-label="Milestone submission" value={submission} onChange={e => setSubmission(e.target.value)} placeholder="Paste a deliverable link or describe completed work…" /><button className="button button-primary full-width" disabled={actionBusy || !submission.trim()} onClick={() => void transact("Submitting milestone", e => e.submitMilestone(selected.id, submission.trim()), selected.id).then(ok => { if (ok) setSubmission(""); })}>Submit work <ArrowRight size={17} /></button></> : client ? current.submitted ? <><p>Review the submission before releasing <strong>{money(current.amount, decimals)} {symbol}</strong>.</p><div className="submitted-work">{current.submission}</div><button className="button button-primary full-width" disabled={actionBusy} onClick={() => void transact("Releasing payment", e => e.approveMilestone(selected.id), selected.id)}>Approve and release {money(current.amount, decimals)} {symbol} <ArrowRight size={17} /></button></> : <p>Waiting for the freelancer to submit <strong>{current.description}</strong>.</p> : <p>The client and freelancer can act on this milestone.</p> : <p>All milestones have been processed.</p>)}
          {selected.status === 3 && <div className="success-note"><CheckCircle2 size={21} /> All milestones are complete and paid.</div>}
          {selected.status === 4 && <p>Cancellation requested. {selected.clientCancellationApproved ? "Waiting for the freelancer." : "Waiting for the client."}</p>}
          {selected.status === 5 && <div className="success-note"><CheckCircle2 size={21} /> Cancelled. Remaining escrow returned to the client.</div>}
          {[1, 2, 4].includes(selected.status) && (client || worker) && !(client && selected.clientCancellationApproved) && !(worker && selected.freelancerCancellationApproved) && <button className="cancel-action" disabled={actionBusy} onClick={() => void transact("Requesting cancellation", e => e.requestCancellation(selected.id), selected.id)}>Request mutual cancellation <ArrowRight size={16} /></button>}
          {selected.status === 4 && <small className="cancel-note">Milestone actions pause while cancellation is pending. This contract does not let you withdraw a cancellation request.</small>}
        </div>
      </> : <div className="detail-card no-selection"><div className="detail-placeholder-icon"><LockKeyhole size={24} /></div><h2>A clear path from work to payment</h2><p>Choose a project to see its agreement, escrow balance, milestones, and your next step.</p><div className="three-steps"><span><b>1</b> Agree</span><span><b>2</b> Fund</span><span><b>3</b> Release</span></div><div className="divider" /><div className="test-note"><ShieldCheck size={18} /> Sepolia test tokens only. RUSD has no real monetary value.</div></div>}</aside>
      </div>
      <div className="dashboard-journey"><JourneyAnimation /></div>
      <footer className="footer"><span>RuleX · Educational Sepolia prototype</span><span>AI drafts need human review. Payments require wallet confirmation.</span></footer>
    </main>
    <RulexAiAssistant
      activeTab={tab}
      project={selected ? {
        id: selected.id,
        title: selected.title || `Project #${selected.id}`,
        description: selected.description || "",
        status: currentStatus,
        currentMilestone: current ? {
          description: current.description,
          submission: current.submission || "",
          amount: `${money(current.amount, decimals)} ${symbol}`,
        } : undefined,
      } : undefined}
      draft={{ title, description, milestones: draft }}
      onOpenCreate={() => setTab("create")}
    />
  </div>;
}
