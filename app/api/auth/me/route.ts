import { authError, getSessionProfile } from "@/lib/auth";
export async function GET(request: Request) {
  try { return Response.json({ profile: await getSessionProfile(request) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return authError(error); }
}
