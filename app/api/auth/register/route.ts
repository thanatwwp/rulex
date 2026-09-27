import { authError, jsonError, registerProfile, sameOrigin, startSession, verifiedWallet } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  try {
    const input = await request.json() as { challengeId?: unknown; signature?: unknown; displayName?: unknown; role?: unknown };
    const wallet = await verifiedWallet(input);
    return await startSession(request, await registerProfile(wallet, input.displayName, input.role), 201);
  } catch (error) { return authError(error); }
}
