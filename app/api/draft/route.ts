import { getSessionProfile, jsonError, sameOrigin } from "@/lib/auth";
import { callOpenAI, outputText, RulexAiUpstreamError } from "@/lib/openai";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  if (!await getSessionProfile(request)) return jsonError("Sign in to request milestone suggestions.", 401);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return Response.json({ error: "AI service is not configured." }, { status: 503 });

  try {
    const { description, budget } = await request.json() as { description?: unknown; budget?: unknown };
    if (typeof description !== "string" || !description.trim() || description.length > 1600 || typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0 || budget > 1_000_000) {
      return Response.json({ error: "Enter a short project brief and a valid budget." }, { status: 400 });
    }

    const data = await callOpenAI({
      instructions: "You draft clear freelance milestones for RuleX, a Sepolia testnet escrow prototype. Return a concise title and exactly three ordered milestones. Each milestone must contain a concrete deliverable and acceptance condition. Use positive decimal test-RUSD amounts that sum to the requested budget. Do not claim AI approves work or controls funds. The client will review and edit the draft before signing.",
      input: `Project brief: ${description.trim()}\nBudget: ${budget} test RUSD`,
      max_output_tokens: 1000,
      text: { format: { type: "json_schema", name: "rulex_milestones", strict: true, schema: {
        type: "object", additionalProperties: false,
        properties: {
          title: { type: "string" },
          milestones: {
            type: "array", minItems: 3, maxItems: 3,
            items: {
              type: "object", additionalProperties: false,
              properties: { description: { type: "string" }, amount: { type: "string" } },
              required: ["description", "amount"],
            },
          },
        },
        required: ["title", "milestones"],
      } } },
    }, key);

    const text = outputText(data);
    const parsed = JSON.parse(text) as { title?: unknown; milestones?: unknown };
    if (typeof parsed.title !== "string" || !Array.isArray(parsed.milestones) || parsed.milestones.length !== 3 ||
      parsed.milestones.some(m => !m || typeof m.description !== "string" || !m.description.trim() || typeof m.amount !== "string" || !/^\d+(\.\d{1,4})?$/.test(m.amount) || Number(m.amount) <= 0)) {
      return Response.json({ error: "AI returned an invalid draft. Please try again." }, { status: 502 });
    }

    return Response.json({
      title: parsed.title.slice(0, 100),
      milestones: parsed.milestones.map(m => ({ description: m.description.slice(0, 240), amount: m.amount })),
    });
  } catch (error) {
    if (error instanceof RulexAiUpstreamError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("RuleX draft route error", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Unable to generate an AI draft. Please try again." }, { status: 500 });
  }
}
