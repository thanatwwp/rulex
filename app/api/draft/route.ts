import { getSessionProfile, jsonError, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  if (!await getSessionProfile(request)) return jsonError("Sign in to request milestone suggestions.", 401);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "AI service is not configured." }, { status: 503 });
  try {
    const { description, budget } = await request.json() as { description?: unknown; budget?: unknown };
    if (typeof description !== "string" || !description.trim() || description.length > 1600 || typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0 || budget > 1_000_000) {
      return Response.json({ error: "Enter a short project brief and a valid budget." }, { status: 400 });
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        store: false,
        instructions: "You draft clear freelance milestones. Return a concise title and exactly three ordered milestones. Each description must include a concrete deliverable and clear acceptance condition. Use positive decimal amounts in test RUSD summing to the requested budget. Do not claim that AI approves work or controls funds. The client will edit your draft before signing.",
        input: `Project brief: ${description.trim()}\nBudget: ${budget} test RUSD`,
        text: { format: { type: "json_schema", name: "rulex_milestones", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: { title: { type: "string" }, milestones: { type: "array", items: { type: "object", additionalProperties: false,
            properties: { description: { type: "string" }, amount: { type: "string" } }, required: ["description", "amount"] } } },
          required: ["title", "milestones"],
        } } },
      }),
    });
    if (!response.ok) return Response.json({ error: "AI draft failed. Please try again." }, { status: 502 });
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = data.output?.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text || "").join("") || "";
    const draft = JSON.parse(text) as { title?: unknown; milestones?: unknown };
    if (typeof draft.title !== "string" || !Array.isArray(draft.milestones) || draft.milestones.length < 1 || draft.milestones.length > 3 ||
      draft.milestones.some(m => !m || typeof m.description !== "string" || !m.description.trim() || typeof m.amount !== "string" || !/^\d+(\.\d{1,4})?$/.test(m.amount) || Number(m.amount) <= 0)) {
      return Response.json({ error: "AI returned an invalid draft." }, { status: 502 });
    }
    return Response.json({ title: draft.title.slice(0, 100), milestones: draft.milestones.map(m => ({ description: m.description.slice(0, 240), amount: m.amount })) });
  } catch { return Response.json({ error: "Unable to generate a draft." }, { status: 500 }); }
}
