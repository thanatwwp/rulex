# RuleX security notes

RuleX is an **educational Ethereum Sepolia** prototype. No real-value assets. This is not a security audit or production certification.

## Runtime and dependencies

- Keep Next.js, React, Node.js and their transitive dependencies patched. The current Next.js version is pinned in `package.json` and locked in `pnpm-lock.yaml`; do not merge mismatched manifests/lockfiles.
- Deploy using a **patched Node.js 24.x runtime**. The October 2026 Node.js security release patched issues including CVE-2026-111497 (Brotli). Confirm the **actual Vercel project runtime**, not merely `package.json`.
- `pnpm install --frozen-lockfile` and `pnpm build` should pass on every PR before deployment.
- Run `pnpm audit --prod` during release checks. Turn on GitHub Dependabot security alerts and secret scanning.

## Secrets and sessions

- Configure `OPENAI_API_KEY` privately in Vercel, never in source, logs, browser JavaScript, or public environment variables.
- Configure a **separate** random `RULEX_AUTH_SECRET` privately in Vercel. The current prototype may fall back to the AI key; that is a compatibility fallback, not a recommended long-term configuration. Change this only after confirming the new secret is deployed. Rotating it invalidates existing sessions.
- Sign-in challenges expire, but the stateless prototype cannot guarantee *single-use nonces across all serverless instances*. For production, add durable nonce consumption and persistent wallet-to-profile binding before accepting real-value transactions.
- Authenticated HTTP-only session cookies expire after seven days. Log out ends the browser session; it does not disconnect MetaMask.
- `/api/ai/health` requires a valid session. It never returns a secret.
- AI endpoints are signed-in only, capped by body size and given **best-effort** per-instance throttles. For protection against distributed abuse or spending, enable Vercel Firewall/WAF rate limiting or durable rate limiting at the edge.

## Operational checklist

- Review all GitHub commits and deployment logs for secrets; `.gitignore` does not remove files already committed. Revoke and rotate any exposed key immediately.
- Limit production environment variables to the scopes that need them. Protect pull-request preview deployments and restrict untrusted fork builds.
- Review Vercel access permissions, audit logs, function error logs, rate-limit/firewall events, and Dependabot alerts regularly.
- Ensure Web3 users are on Sepolia; never ask for seed phrases or private keys. Every ERC-20 approval grants allowance to the particular escrow spender address.
- Have an independent Solidity security audit before real money. V2 dispute resolution relies on a configured arbiter; delivery information written on-chain is public, even if the corresponding payment transfer is atomic.

## Reporting vulnerabilities

If you discover an issue, avoid publishing exploitable details in a GitHub issue. Contact the repository owner privately using GitHub private vulnerability reporting if enabled.
