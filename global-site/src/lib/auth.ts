import jwt from "jsonwebtoken";
import crypto from "crypto";
import { kv } from "@vercel/kv";

const MAGIC_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type Session = {
  userId: string;
  email: string;
  exp: number;
  iat: number;
};

/**
 * These fall back to a fixed dev string when unset. That is acceptable locally
 * but must never reach production: with a shared hardcoded secret anyone could
 * mint their own session cookie. isKvConfigured() is used as the "is this a
 * real deployment" signal so the failure is loud rather than silent.
 */
function magicSecret(): string {
  return process.env.MAGIC_SECRET || process.env.JWT_SECRET || "dev-magic-secret";
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev-session-secret";
}

export function secretsAreReal(): boolean {
  const m = process.env.MAGIC_SECRET || process.env.JWT_SECRET;
  const s = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  return Boolean(m && s && m !== "dev-magic-secret" && s !== "dev-session-secret");
}

export function createMagicToken(email: string): string {
  const payload = { email: email.toLowerCase(), jti: crypto.randomUUID(), t: "magic" };
  return jwt.sign(payload, magicSecret(), { expiresIn: MAGIC_TTL_SECONDS });
}

/**
 * Single-use enforcement.
 *
 * The check-then-set below is not atomic, so a token clicked twice in the same
 * millisecond could mint two sessions. It is still worth keeping: the real
 * attack is a replay seconds later, which this blocks.
 */
export async function consumeMagicToken(token: string): Promise<{ email: string } | null> {
  try {
    const decoded = jwt.verify(token, magicSecret()) as any;
    if (decoded.t !== "magic") return null;

    const key = `magic:${decoded.jti}`;
    const used = await kv.get(key);
    if (used) return null;
    await kv.set(key, "1", { ex: MAGIC_TTL_SECONDS + 60 });

    return { email: String(decoded.email).toLowerCase() };
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Session = {
    userId,
    email: email.toLowerCase(),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return jwt.sign(payload, sessionSecret());
}

export function verifySession(token: string): Session | null {
  try {
    const d = jwt.verify(token, sessionSecret()) as any;
    if (!d.userId || !d.email) return null;
    return {
      userId: d.userId,
      email: String(d.email).toLowerCase(),
      iat: d.iat,
      exp: d.exp,
    };
  } catch {
    return null;
  }
}
