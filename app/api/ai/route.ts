import { getSessionProfile, jsonError, sameOrigin } from "@/lib/auth";

type AiMode = "help" | "risk" | "submission";

function safeText(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  if (!await getSessionProfile(request)) return jsonError("Sign in to use RuleX AI.", 401);

  const key = process.env.OPENAI_API_KEY;
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
      "You are RuleX AI, an assistant inside a university milestone-escrow prototype.",
      "Be concise, practical, and easy for clients and freelancers to understand.",
      "Never claim you can approve work, release funds, sign transactions, or make legal determinations.",
      "Never instruct the user to share a seed phrase, private key, password, or secret API key.",
      "If reviewing a submission, distinguish visible evidence from anything that still needs manual verification.",
      "If analyzing risk, focus on scope clarity, deliverables, acceptance criteria, timelines, revisions, payment milestones, and evidence.",
      "Keep answers under 170 words unless the user explicitly asks for detail.",
      "End important risk or submission reviews with a short reminder that the human user decides and MetaMask confirms any blockchain action.",
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        store: false,
        instructions,
        input: `Mode: ${mode as AiMode}\nUser request: ${question}\nRuleX page context: ${contextJson}`,
      }),
    });

    if (!response.ok) return Response.json({ error: "RuleX AI could not respond. Please try again." }, { status: 502 });
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const answer = data.output?.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text || "").join("").trim() || "";
    if (!answer) return Response.json({ error: "RuleX AI returned an empty response." }, { status: 502 });

    const lowered = answer.toLowerCase();
    const tone = lowered.includes("risk") || lowered.includes("missing") || lowered.includes("unclear") || lowered.includes("verify")
      ? "warning"
      : lowered.includes("looks complete") || lowered.includes("satisfied")
        ? "success"
        : "neutral";

    return Response.json({ answer: answer.slice(0, 2400), tone });
  } catch {
    return Response.json({ error: "Unable to contact RuleX AI." }, { status: 500 });
  }
}
