import { ExternalLink, Github, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

const ESCROW = "0xFad4B34f9341643Ea3804Ba991d1961165Cac335";
const ETHERSCAN = "https://sepolia.etherscan.io/address/" + ESCROW;

export const metadata = {
  title: "Trust & Safety | RuleX",
  description: "How RuleX handles wallet connections, testnet transactions, smart-contract transparency, and user safety.",
};

export default function TrustPage() {
  return (
    <div className="trust-page">
      <header className="public-topbar">
        <a className="brand" href="/" aria-label="RuleX home"><span className="brand-mark">R<span>x</span></span><strong>RuleX</strong></a>
        <span className="auth-network"><span className="network-indicator" /> SEPOLIA TESTNET</span>
      </header>
      <main className="trust-page-main">
        <section className="trust-hero">
          <span className="auth-kicker">TRUST &amp; SAFETY</span>
          <h1>Verify before you connect.</h1>
          <p>RuleX is a university prototype for milestone escrow on Ethereum Sepolia. It is designed for testing with test tokens only, not real-value assets.</p>
        </section>

        <section className="trust-grid">
          <article><WalletCards size={22}/><h2>Wallet connection</h2><p>RuleX never asks for a seed phrase, private key, or wallet password. MetaMask remains in control of signing and transaction approval.</p></article>
          <article><LockKeyhole size={22}/><h2>Sign-in is not a payment</h2><p>Signing in uses a free ownership message. It does not transfer tokens, approve token spending, or send an on-chain transaction.</p></article>
          <article><ShieldCheck size={22}/><h2>Testnet only</h2><p>The production prototype targets Ethereum Sepolia and a demo token named RUSD. These demo tokens are not intended to have monetary value.</p></article>
        </section>

        <section className="trust-disclosure">
          <h2>Published technical information</h2>
          <div className="trust-fact"><span>Network</span><strong>Ethereum Sepolia (chain ID 11155111)</strong></div>
          <div className="trust-fact"><span>Escrow contract</span><code>{ESCROW}</code></div>
          <div className="trust-fact"><span>Status</span><strong>Educational prototype · Not audited</strong></div>
          <div className="trust-actions">
            <a className="button button-outline" href={ETHERSCAN} target="_blank" rel="noreferrer">View contract on Etherscan <ExternalLink size={15}/></a>
            <a className="button button-outline" href="https://github.com/thanatwwp/rulex" target="_blank" rel="noreferrer"><Github size={15}/> Review source on GitHub</a>
          </div>
        </section>

        <section className="trust-warning">
          <h2>Before approving any wallet action</h2>
          <p>Check that MetaMask shows <strong>Ethereum Sepolia</strong>, confirm the destination contract matches the published address above, and read the transaction details before approving. Do not continue if any website asks for your recovery phrase or private key.</p>
        </section>
      </main>
      <footer className="auth-footer"><span>RuleX · University prototype · Not audited</span><span><a href="/">Return home</a></span></footer>
    </div>
  );
}
