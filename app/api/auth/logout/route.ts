import { authError, endSession } from "@/lib/auth";
export async function POST(request: Request) {
  try { return await endSession(request); }
  catch (error) { return authError(error); }
}
