import { authError, createChallenge } from "@/lib/auth";
export async function POST(request: Request) {
  try { const input = await request.json() as { wallet?: unknown }; return await createChallenge(request, input.wallet); }
  catch (error) { return authError(error); }
}
