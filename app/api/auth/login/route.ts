import { authError, findProfile, jsonError, sameOrigin, startSession, verifiedWallet } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  try {
    const input = await request.json();
    const wallet = await verifiedWallet(input);
    const profile = await findProfile(wallet);
    if (!profile) throw new Error("No account found for this wallet. Register first.");
    return await startSession(request, profile);
  } catch (error) { return authError(error); }
}
