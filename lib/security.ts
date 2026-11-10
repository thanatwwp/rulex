/**
 * Lightweight per-function defenses. Vercel serverless instances do not share
 * memory: these limits are supplementary, NOT a replacement for edge WAF or
 * distributed rate limiting.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
  return /^[\w.:\-]{1,80}$/.test(ip) ? ip : "unknown";
}

export function limited(request: Request, category: string, max: number, seconds: number): Response | null {
  const now = Date.now();
  const key = category + ":" + clientKey(request);
  const active = buckets.get(key);
  if (buckets.size > 3000) {
    for (const [k, value] of buckets) if (value.resetAt <= now) buckets.delete(k);
    if (buckets.size > 3000) buckets.clear();
  }
  const next = !active || active.resetAt <= now
    ? { count: 1, resetAt: now + seconds * 1000 }
    : { count: active.count + 1, resetAt: active.resetAt };
  buckets.set(key, next);
  if (next.count <= max) return null;
  return Response.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((next.resetAt - now) / 1000))), "Cache-Control": "no-store" } },
  );
}

export async function readJsonLimited(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("Content-Type must be application/json.");
  }
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new Error("Request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel();
        throw new Error("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("Invalid JSON request.");
  }
}
