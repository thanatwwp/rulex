# RuleX

RuleX is a Sepolia testnet prototype for milestone-based freelance escrow. A client creates an agreement with one to three milestones, a freelancer accepts it, the client deposits test RUSD, and approval of submitted work releases that milestone's payment automatically. Both participants can request mutual cancellation.

Prototype: https://rulex-escrow.thanat-pp14.chatgpt.site

## Public GitHub copy

This ZIP omits the original `.openai/hosting.json` (which contains a Site project ID) and the generated TypeScript build cache. It does not include local environment files, dependencies, wallet files, or the local D1 database. Before running or building locally, copy `.openai/hosting.example.json` to `.openai/hosting.json`. On Windows PowerShell use `Copy-Item .openai/hosting.example.json .openai/hosting.json`; on macOS/Linux use `cp .openai/hosting.example.json .openai/hosting.json`. The example binds a local D1 database as `DB`. If you host your own Site, configure its project ID privately in the ignored copy. Never commit an API key, wallet private key, seed phrase, or `.env` file.

## What is included

- `contracts/RuleX.sol`: `MockRUSD` test token and `RuleXEscrow` contract.
- `app/page.tsx`: responsive React wallet dashboard and transaction flows.
- `lib/rulex.ts`: contract interface and display helpers.
- `app/api/draft/route.ts`: optional server-side AI milestone draft endpoint.
- `app/register` and `app/login`: wallet registration and sign-in for clients and freelancers.
- `db/schema.ts` and `drizzle/`: persistent profiles, one-use signing challenges, and server-side sessions in D1.

The site reads the token address from `RuleXEscrow.paymentToken()`; no separate token address needs to be entered. It starts with an editable escrow address observed in the original test transaction. Verify this address against your own deployment before signing transactions.

## Run locally

Use Node.js 22.13 or newer and pnpm 11.25. Install dependencies with `pnpm install --frozen-lockfile`, generate the D1 tables with `pnpm db:generate` if the migration is absent, and run `pnpm dev`. Apply the checked-in SQL migration to the local D1 binding before testing registration. Connect MetaMask to Ethereum Sepolia. Sepolia ETH is needed for gas, and RUSD has no monetary value.

You can set `OPENAI_API_KEY` on the server to enable AI drafts. Without the key, **Generate draft** produces an editable local starter draft and labels it accordingly. Never put an API key in the browser code or a public GitHub repository.

## Deploy the contracts

1. Open `contracts/RuleX.sol` in Remix and compile using Solidity 0.8.27 or compatible 0.8.x.
2. With a Sepolia-connected deployer wallet, deploy `MockRUSD` using an initial supply such as `1000` (whole tokens). Record its address.
3. Deploy `RuleXEscrow` with the `MockRUSD` address as its constructor argument. Record the escrow address.
4. In the site, open **Contract** and set your deployed escrow address. The browser remembers the selected address on that device.

Do not paste an empty string into a numeric constructor field. Initial supply is a whole-token integer, not a token address or a value already multiplied by 10^18.

## Test with two wallets

Use separate client and freelancer addresses on Sepolia. Each person opens **Create account**, chooses their role, connects MetaMask, and signs a free ownership message. Returning users choose **Sign in** with the same wallet. The **Log out** button ends the RuleX website session; it does not remove the wallet connection in MetaMask. A profile's role labels its preferred workflow, while the deployed contract determines who can act on each project from its stored addresses.

Use **Change wallet** in the dashboard or on the sign-in page to ask MetaMask to select another account. If a new address is selected, the current RuleX session ends and the site asks that wallet to sign in or register. An existing project still belongs to its original client and freelancer addresses; changing wallets does not transfer the agreement. If MetaMask does not open an account picker, select the other account inside MetaMask and return to RuleX.

1. Client connects, enters the freelancer's address and one to three milestones, then selects **Create agreement**. Save the project ID.
2. Freelancer connects with the wallet entered in step 1, opens that project, and accepts. The client wallet cannot accept its own agreement.
3. Client receives test RUSD. The token deployer can mint to the client through the **Test token** tab, or use Remix's `mint(to, amount)` on `MockRUSD`.
4. Client approves the escrow to spend the budget, then funds the agreement. These are separate wallet transactions.
5. Freelancer submits work for the current milestone. Client approves it; the contract sends that milestone's RUSD to the freelancer. Repeat for any remaining milestones.
6. For a separate test project, either participant can request cancellation. The other must also request it; remaining escrow returns to the client.

The interface shows statuses, milestone progress, balances, the token address, and transaction links. A **Project ID** lookup helps when an invited project is outside the recent-project list.

## Scope and limitations

- This is an educational testnet prototype. The custom token and escrow contract have not been audited.
- The dashboard lists a wallet's agreements among the latest 50 projects. Older agreements remain accessible by ID.
- AI proposals are editable suggestions; only wallet-confirmed transactions change the contract.
- A pending cancellation pauses milestone actions. The supplied contract has no cancellation withdrawal function.
- On-chain transactions require a real MetaMask wallet and Sepolia ETH; the browser preview does not simulate them.
- Accounts are wallet based; there are no passwords or email addresses. Registration signatures have a one-use five-minute challenge and site sessions expire after seven days.

`contracts/RuleX.sol` contains an MIT SPDX identifier. Choose and add a repository-level `LICENSE` file when you decide how to license the full frontend and documentation.
