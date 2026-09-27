import { formatUnits } from "ethers";

export const escrowAbi = [
  "function paymentToken() view returns (address)",
  "function projectCount() view returns (uint256)",
  "function projects(uint256) view returns (uint256 id,address client,address freelancer,string title,string projectDescription,uint256 totalAmount,uint256 escrowBalance,uint256 currentMilestone,uint8 status,bool clientCancellationApproved,bool freelancerCancellationApproved)",
  "function getMilestoneCount(uint256) view returns (uint256)",
  "function getMilestone(uint256,uint256) view returns (string description,uint256 amount,bool submitted,string submission,bool approved,bool paid)",
  "function createProject(address,string,string,string[],uint256[]) returns (uint256)",
  "function acceptProject(uint256)", "function fundProject(uint256)",
  "function submitMilestone(uint256,string)", "function approveMilestone(uint256)",
  "function requestCancellation(uint256)",
  "event ProjectCreated(uint256 indexed projectId,address indexed client,address indexed freelancer,uint256 totalAmount)",
];
export const tokenAbi = [
  "function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)",
  "function owner() view returns (address)", "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
];
export type Milestone = { index: number; description: string; amount: bigint; submitted: boolean; submission: string; approved: boolean; paid: boolean };
export type Project = { id: number; client: string; freelancer: string; title: string; description: string; totalAmount: bigint; escrowBalance: bigint; currentMilestone: number; status: number; clientCancellationApproved: boolean; freelancerCancellationApproved: boolean };
export const statusName = ["Created", "Accepted", "Funded", "Completed", "Cancel pending", "Cancelled"];
export const shortAddress = (a: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
export const money = (v: bigint, d = 18) => {
  const [whole, fraction] = formatUnits(v, d).split(".");
  return `${Number(whole).toLocaleString("en-US")}${fraction ? "." + fraction.slice(0, 4).replace(/0+$/, "") : ""}`.replace(/\.$/, "");
};
export function cleanError(error: unknown) {
  if (!(error instanceof Error)) return "Check your wallet and try again.";
  const e = error as Error & { reason?: string; shortMessage?: string; code?: number | string };
  if (e.code === 4001 || e.code === "ACTION_REJECTED") return "Transaction cancelled in MetaMask.";
  return e.reason || e.shortMessage || (e.message.length > 170 ? `${e.message.slice(0, 170)}…` : e.message);
}
export function starterDraft(description: string, budget: number) {
  const first = Math.round(budget * 30) / 100, second = Math.round(budget * 40) / 100;
  return [
    { description: `Plan and agree on requirements: ${description.trim().slice(0, 55)}`, amount: String(first) },
    { description: "Deliver a working version for review", amount: String(second) },
    { description: "Apply feedback and deliver the final work", amount: String(Math.round((budget - first - second) * 100) / 100) },
  ];
}
