import { RULEX_AI_MODEL } from "@/lib/openai";

export async function GET() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { ok: false, configured: false, model: RULEX_AI_MODEL, issue: "missing_api_key" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(RULEX_AI_MODEL)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (response.ok) {
      return Response.json(
        { ok: true, configured: true, model: RULEX_AI_MODEL, issue: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    let code = "upstream_error";
    try {
      const payload = await response.json() as { error?: { code?: string; type?: string } };
      code = payload.error?.code || payload.error?.type || code;
    } catch { /* sanitized health response only */ }

    return Response.json(
      { ok: false, configured: true, model: RULEX_AI_MODEL, issue: code, upstreamStatus: response.status },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, configured: true, model: RULEX_AI_MODEL, issue: "openai_unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
