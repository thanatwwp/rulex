export const RULEX_AI_MODEL = process.env.RULEX_AI_MODEL?.trim() || "gpt-5.6-luna";

type OpenAIErrorPayload = {
  error?: {
    code?: string | null;
    type?: string | null;
    message?: string | null;
  };
};

export class RulexAiUpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "RulexAiUpstreamError";
    this.status = status;
  }
}

function friendlyError(status: number, code?: string | null, type?: string | null) {
  const marker = `${code || ""} ${type || ""}`.toLowerCase();

  if (status === 401 || status === 403 || marker.includes("invalid_api_key")) {
    return new RulexAiUpstreamError(
      "RuleX AI cannot authenticate with OpenAI. Check the private OPENAI_API_KEY in Vercel.",
      503,
    );
  }
  if (status === 429 && (marker.includes("insufficient_quota") || marker.includes("billing"))) {
    return new RulexAiUpstreamError(
      "The OpenAI API account for RuleX has no available API quota. Add API billing or credits, then try again.",
      503,
    );
  }
  if (status === 429) {
    return new RulexAiUpstreamError(
      "RuleX AI is temporarily rate-limited. Wait a moment and try again.",
      429,
    );
  }
  if (status === 404 || marker.includes("model_not_found")) {
    return new RulexAiUpstreamError(
      "The configured RuleX AI model is not available for this API project.",
      503,
    );
  }
  if (status >= 500) {
    return new RulexAiUpstreamError(
      "OpenAI is temporarily unavailable. Please try RuleX AI again shortly.",
      502,
    );
  }
  return new RulexAiUpstreamError(
    "OpenAI rejected the RuleX AI request. Please try again.",
    502,
  );
}

export async function callOpenAI(body: Record<string, unknown>, key: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model: RULEX_AI_MODEL, store: false }),
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: OpenAIErrorPayload = {};
    try { payload = await response.json() as OpenAIErrorPayload; } catch { /* no JSON body */ }
    const code = payload.error?.code;
    const type = payload.error?.type;
    console.error("RuleX OpenAI upstream error", {
      status: response.status,
      code: code || "unknown",
      type: type || "unknown",
      model: RULEX_AI_MODEL,
    });
    throw friendlyError(response.status, code, type);
  }

  return await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
}

export function outputText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  return data.output
    ?.flatMap(item => item.content || [])
    .filter(item => item.type === "output_text")
    .map(item => item.text || "")
    .join("")
    .trim() || "";
}
