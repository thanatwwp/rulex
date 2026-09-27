import { getAddress, isAddress, verifyMessage } from "ethers";

const COOKIE = "rulex_sid";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const CHALLENGE_SECONDS = 5 * 60;
export type Profile = { wallet: string; displayName: string; role: "client" | "freelancer" };

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 32) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}
function base64urlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
function base64urlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
function authSecret() {
  const secret = process.env.RULEX_AUTH_SECRET || process.env.OPENAI_API_KEY;
  if (!secret) throw new Error("RuleX server authentication is not configured.");
  return secret;
}
async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
async function secureToken(payload: object) {
  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${await sign(encoded)}`;
}
async function readSecureToken(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = await sign(encoded);
  if (signature !== expected) return null;
  try { return JSON.parse(base64urlDecode(encoded)) as Record<string, unknown>; }
  catch { return null; }
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
  if (error instanceof Error && /challenge|signature|wallet|name|role|configured/i.test(error.message)) return jsonError(error.message, 400);
  return jsonError("Account service is temporarily unavailable. Please try again.", 503);
}
export async function createChallenge(request: Request, address: unknown) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  if (typeof address !== "string" || !isAddress(address)) return jsonError("Enter a valid wallet address.", 400);
  const wallet = getAddress(address).toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const nonce = randomHex(16);
  const expiresAt = now + CHALLENGE_SECONDS;
  const message = [
    "RuleX account access",
    `Site: ${new URL(request.url).origin}`,
    `Wallet: ${getAddress(wallet)}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt * 1000).toISOString()}`,
    "Signing confirms wallet ownership. It does not move tokens or send a transaction.",
  ].join("\n");
  const challengeId = await secureToken({ wallet, message, expiresAt, nonce });
  return Response.json({ challengeId, message }, { headers: { "Cache-Control": "no-store" } });
}
export async function verifiedWallet(input: unknown) {
  const payload = input as { challengeId?: unknown; signature?: unknown } | null;
  if (typeof payload?.challengeId !== "string" || typeof payload.signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(payload.signature)) {
    throw new Error("A valid wallet signature is required.");
  }
  const challenge = await readSecureToken(payload.challengeId);
  if (!challenge || typeof challenge.wallet !== "string" || typeof challenge.message !== "string" || typeof challenge.expiresAt !== "number") {
    throw new Error("This signing challenge is invalid. Please try again.");
  }
  if (challenge.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("This signing challenge expired. Please try again.");
  let signer: string;
  try { signer = verifyMessage(challenge.message, payload.signature).toLowerCase(); }
  catch { throw new Error("The wallet signature could not be verified."); }
  if (signer !== challenge.wallet) throw new Error("The signature came from another wallet.");
  return challenge.wallet;
}
export async function registerProfile(wallet: string, displayName: unknown, role: unknown): Promise<Profile> {
  if (typeof displayName !== "string" || displayName.trim().length < 2 || displayName.trim().length > 60) throw new Error("Enter a display name of 2 to 60 characters.");
  if (role !== "client" && role !== "freelancer") throw new Error("Choose Client or Freelancer as your role.");
  return { wallet: getAddress(wallet), displayName: displayName.trim(), role };
}
export async function startSession(request: Request, profile: Profile, status = 200) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = await secureToken({ ...profile, expiresAt });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ profile }, { status, headers: {
    "Set-Cookie": `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`,
    "Cache-Control": "no-store",
  } });
}
export async function getSessionProfile(request: Request): Promise<Profile | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const session = await readSecureToken(token);
  if (!session || typeof session.wallet !== "string" || typeof session.displayName !== "string" ||
      (session.role !== "client" && session.role !== "freelancer") || typeof session.expiresAt !== "number" ||
      session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return { wallet: getAddress(session.wallet), displayName: session.displayName, role: session.role };
}
export async function endSession(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ signedOut: true }, { headers: {
    "Set-Cookie": `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
    "Cache-Control": "no-store",
  } });
}
