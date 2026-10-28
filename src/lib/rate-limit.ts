import "server-only";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

export type Limit = { max: number; windowMinutes: number };

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Minutes until the key may try again, or 0 if it isn't locked. */
export async function lockedForMinutes(key: string, limit: Limit): Promise<number> {
  const [row] = await getDb().select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
  if (!row || row.failures < limit.max) return 0;
  const remainingMs = row.windowStart.getTime() + limit.windowMinutes * 60_000 - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 60_000) : 0;
}

/** Count one attempt. The counter resets once its window has expired. */
export async function recordAttempt(key: string, limit: Limit): Promise<void> {
  const expired = sql`${loginAttempts.windowStart} < now() - make_interval(mins => ${limit.windowMinutes})`;
  await getDb()
    .insert(loginAttempts)
    .values({ key, failures: 1 })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        failures: sql`case when ${expired} then 1 else ${loginAttempts.failures} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${loginAttempts.windowStart} end`,
      },
    });
}

export async function clearAttempts(key: string): Promise<void> {
  await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
}
