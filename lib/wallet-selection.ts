import { getAddress, type Eip1193Provider } from "ethers";

export async function selectWallet(ethereum: Eip1193Provider) {
  await ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    throw new Error("Select an account in MetaMask, then try again.");
  }
  return getAddress(accounts[0]);
}

export function walletSelectionError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
  if (code === -32601 || code === 4200) {
    return "Your wallet does not support the account picker. Select another account inside MetaMask; RuleX will detect the change.";
  }
  if (code === 4001) return "Account selection cancelled in MetaMask.";
  return error instanceof Error ? error.message : "Could not change wallets. Try selecting another account in MetaMask.";
}
