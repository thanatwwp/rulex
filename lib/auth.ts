import { and, eq, gt, isNull } from "drizzle-orm";
import { getAddress, isAddress, verifyMessage } from "ethers";
import { getDb } from "@/db";
import { challenges, sessions, users } from "@/db/schema";

const COOKIE = "rulex_sid";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const CHALLENGE_SECONDS = 5 * 60;
export type Profile = { wallet: string; displayName: string; role: "client" | "freelancer" };

function randomHex(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
function cookieValue(request: Request) {
  return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export function authError(error: unknown) {
  if (error instanceof Error && error.message === "This wallet is already registered. Sign in instead.") return jsonError(error.message, 409);
  if (error instanceof Error && error.message === "No account found for this wallet. Register first.") return jsonError(error.message, 404);
  if (error instanceof Error && /challenge|signature|wallet|name|role/i.test(error.message)) return jsonError(error.message, 400);
  return jsonError("Account service is temporarily unavailable. Please try again.", 503);
}
export async function createChallenge(request: Request, address: unknown) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  if (typeof address !== "string" || !isAddress(address)) return jsonError("Enter a valid wallet address.", 400);
  const wallet = getAddress(address).toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const id = randomHex(16);
  const nonce = randomHex(16);
  const message = [
    "RuleX account access",
    `Site: ${new URL(request.url).origin}`,
    `Wallet: ${getAddress(wallet)}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date((now + CHALLENGE_SECONDS) * 1000).toISOString()}`,
    "Signing confirms wallet ownership. It does not move tokens or send a transaction.",
  ].join("\n");
  const db = getDb();
  await db.insert(challenges).values({ id, wallet, message, expiresAt: now + CHALLENGE_SECONDS });
  return Response.json({ challengeId: id, message }, { headers: { "Cache-Control": "no-store" } });
}
export async function verifiedWallet(input: unknown) {
  const payload = input as { challengeId?: unknown; signature?: unknown } | null;
  if (typeof payload?.challengeId !== "string" || !/^[a-f0-9]{32}$/.test(payload.challengeId) || typeof payload.signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(payload.signature)) throw new Error("A valid wallet signature is required.");
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const [challenge] = await db.select().from(challenges).where(and(eq(challenges.id, payload.challengeId), isNull(challenges.usedAt), gt(challenges.expiresAt, now))).limit(1);
  if (!challenge) throw new Error("This signing challenge expired. Please try again.");
  let signer: string;
  try { signer = verifyMessage(challenge.message, payload.signature).toLowerCase(); }
  catch { throw new Error("The wallet signature could not be verified."); }
  if (signer !== challenge.wallet) throw new Error("The signature came from another wallet.");
  const [claimed] = await db.update(challenges).set({ usedAt: now }).where(and(eq(challenges.id, challenge.id), isNull(challenges.usedAt), gt(challenges.expiresAt, now))).returning({ id: challenges.id });
  if (!claimed) throw new Error("This signing challenge was already used. Please try again.");
  return challenge.wallet;
}
export async function findProfile(wallet: string): Promise<Profile | null> {
  const db = getDb();
  const [record] = await db.select().from(users).where(eq(users.wallet, wallet)).limit(1);
  return record ? { wallet: getAddress(record.wallet), displayName: record.displayName, role: record.role } : null;
}
export async function registerProfile(wallet: string, displayName: unknown, role: unknown) {
  if (typeof displayName !== "string" || displayName.trim().length < 2 || displayName.trim().length > 60) throw new Error("Enter a display name of 2 to 60 characters.");
  if (role !== "client" && role !== "freelancer") throw new Error("Choose Client or Freelancer as your role.");
  if (await findProfile(wallet)) throw new Error("This wallet is already registered. Sign in instead.");
  try { await getDb().insert(users).values({ wallet, displayName: displayName.trim(), role, createdAt: Math.floor(Date.now() / 1000) }); }
  catch { throw new Error("This wallet is already registered. Sign in instead."); }
  return (await findProfile(wallet))!;
}
export async function startSession(request: Request, profile: Profile, status = 200) {
  const token = randomHex();
  await getDb().insert(sessions).values({ tokenHash: await digest(token), wallet: profile.wallet.toLowerCase(), expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ profile }, { status, headers: { "Set-Cookie": `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`, "Cache-Control": "no-store" } });
}
export async function getSessionProfile(request: Request): Promise<Profile | null> {
  const token = cookieValue(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [session] = await getDb().select().from(sessions).where(and(eq(sessions.tokenHash, await digest(token)), gt(sessions.expiresAt, Math.floor(Date.now() / 1000)))).limit(1);
  return session ? findProfile(session.wallet) : null;
}
export async function endSession(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const token = cookieValue(request);
  if (/^[a-f0-9]{64}$/.test(token)) await getDb().delete(sessions).where(eq(sessions.tokenHash, await digest(token)));
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`, "Cache-Control": "no-store" } });
}
