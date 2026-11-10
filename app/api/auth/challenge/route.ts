import { limited, readJsonLimited } from "@/lib/security";
import { authError, createChallenge } from "@/lib/auth";
export async function POST(request: Request) {
  const throttle = limited(request, "auth-challenge", 25, 60);
  if (throttle) return throttle;
  try { const input = await readJsonLimited(request, 2048) as { wallet?: unknown }; return await createChallenge(request, input.wallet); }
  catch (error) { return authError(error); }
}
