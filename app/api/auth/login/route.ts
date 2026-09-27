import { authError, jsonError, registerProfile, sameOrigin, startSession, verifiedWallet } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  try {
    const input = await request.json() as { challengeId?: unknown; signature?: unknown; displayName?: unknown; role?: unknown };
    const wallet = await verifiedWallet(input);
    const profile = await registerProfile(
      wallet,
      typeof input.displayName === "string" && input.displayName.trim() ? input.displayName : `User ${wallet.slice(0, 6)}`,
      input.role === "freelancer" ? "freelancer" : "client",
    );
    return await startSession(request, profile);
  } catch (error) { return authError(error); }
}
