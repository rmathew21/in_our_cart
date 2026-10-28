/**
 * List names, PINs and session tokens, using Web Crypto only.
 *
 * A list is identified by its name and protected by a 4-digit PIN. PIN
 * guessing is stopped by per-list lockouts (see account-actions.ts), since
 * 10,000 combinations can't be protected by hashing alone.
 *
 * Session token format: v2.<listId>.<expiresAtMs>.<base64url HMAC-SHA256>
 */

export const SESSION_COOKIE = "list_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // ~90 days

const encoder = new TextEncoder();
const NAME_MIN = 3;
const NAME_MAX = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters long");
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let keyPromise: Promise<CryptoKey> | undefined;
function getKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return keyPromise;
}

async function hmac(message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- List names and PINs --------------------------------------------------

/** Trim and collapse whitespace; throws a user-facing message if invalid. */
export function cleanListName(input: unknown): string {
  if (typeof input !== "string") throw new Error("Enter a list name.");
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN) throw new Error(`List names need at least ${NAME_MIN} characters.`);
  if (name.length > NAME_MAX) throw new Error(`List names can be up to ${NAME_MAX} characters.`);
  if (!/^[\p{L}\p{N} '&.-]+$/u.test(name)) {
    throw new Error("List names can use letters, numbers, spaces, and - ' & .");
  }
  return name;
}

/** Lookup key: "Maple  Street" and "maple street" are the same list. */
export function listNameKey(cleanName: string): string {
  return cleanName.toLowerCase();
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export function randomPin(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String(n! % 10_000).padStart(4, "0");
}

export function randomSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${pin}`));
  return toHex(new Uint8Array(digest));
}

export async function pinMatches(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  return safeEqual(await hashPin(pin, salt), expectedHash);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Sessions ---------------------------------------------------------------

export async function createSessionToken(listId: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `v2.${listId}.${expiresAt}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the list id the token grants access to, or null. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, listId, expiresRaw, sig] = parts as [string, string, string, string];
  if (version !== "v2" || !UUID_RE.test(listId)) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  try {
    const expected = await hmac(`${version}.${listId}.${expiresRaw}`);
    return safeEqual(sig, expected) ? listId : null;
  } catch {
    return null;
  }
}
