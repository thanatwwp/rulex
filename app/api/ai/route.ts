import { getSessionProfile, jsonError, sameOrigin } from "@/lib/auth";
import { callOpenAI, outputText, RulexAiUpstreamError } from "@/lib/openai";

type AiMode = "help" | "risk" | "submission";

function safeText(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  if (!await getSessionProfile(request)) return jsonError("Sign in to use RuleX AI.", 401);

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return Response.json({ error: "RuleX AI is not configured yet." }, { status: 503 });

  try {
    const body = await request.json() as { mode?: unknown; question?: unknown; context?: unknown };
    const mode = body.mode;
    const question = safeText(body.question, 600);
    if (!["help", "risk", "submission"].includes(String(mode)) || !question) {
      return Response.json({ error: "Ask a short RuleX question." }, { status: 400 });
    }

    const contextJson = JSON.stringify(body.context ?? null).slice(0, 9000);
    const instructions = [
      "You are RuleX AI, a helpful assistant inside a university milestone-escrow prototype on Ethereum Sepolia.",
      "Answer in clear, practical language for clients and freelancers.",
      "Use the supplied RuleX page context when it is relevant.",
      "Never claim you can approve work, release funds, sign transactions, or make legal determinations.",
      "Never ask for a seed phrase, private key, wallet password, or secret API key.",
      "For submission review, separate visible evidence from items that still require manual verification.",
      "For risk analysis, focus on scope clarity, deliverables, acceptance criteria, timeline, revisions, milestone amounts, and evidence.",
      "Keep normal answers under 170 words.",
      "For important risk or submission reviews, remind the user that the human decides and MetaMask confirms blockchain actions.",
    ].join(" ");

    const data = await callOpenAI({
      instructions,
      input: `Mode: ${mode as AiMode}\nUser request: ${question}\nRuleX page context: ${contextJson}`,
      max_output_tokens: 900,
    }, key);

    const answer = outputText(data);
    if (!answer) return Response.json({ error: "RuleX AI returned an empty response. Please try again." }, { status: 502 });

    const lowered = answer.toLowerCase();
    const tone = lowered.includes("risk") || lowered.includes("missing") || lowered.includes("unclear") || lowered.includes("verify")
      ? "warning"
      : lowered.includes("looks complete") || lowered.includes("satisfied")
        ? "success"
        : "neutral";

    return Response.json({ answer: answer.slice(0, 2400), tone });
  } catch (error) {
    if (error instanceof RulexAiUpstreamError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("RuleX AI route error", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Unable to contact RuleX AI. Please try again." }, { status: 500 });
  }
}
