import { limited, readJsonLimited } from "@/lib/security";
import { authError, jsonError, registerProfile, sameOrigin, startSession, verifiedWallet } from "@/lib/auth";
export async function POST(request: Request) {
  const throttle = limited(request, "auth-register", 20, 60);
  if (throttle) return throttle;
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  try {
    const input = await readJsonLimited(request, 4096) as { challengeId?: unknown; signature?: unknown; displayName?: unknown; role?: unknown };
    const wallet = await verifiedWallet(input);
    return await startSession(request, await registerProfile(wallet, input.displayName, input.role), 201);
  } catch (error) { return authError(error); }
}
