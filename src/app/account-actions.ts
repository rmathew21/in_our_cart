"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { items, lists } from "@/db/schema";
import { cleanListName, hashPin, isValidPin, listNameKey, pinMatches, randomSalt } from "@/lib/auth";
import { clearAttempts, clientIp, lockedForMinutes, recordAttempt, type Limit } from "@/lib/rate-limit";
import { endSession, startSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { parseImportedItems, type ImportedItem } from "@/lib/validate";

/** Wrong PINs for one list: this is what makes a 4-digit PIN safe. */
const LIST_LIMIT: Limit = { max: 5, windowMinutes: 15 };
/** Wrong attempts from one network across all lists (stops trying many names). */
const NETWORK_LIMIT: Limit = { max: 20, windowMinutes: 15 };
const SIGNUP_LIMIT: Limit = { max: 10, windowMinutes: 60 };
const FAILURE_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rowsFor(listId: string, imported: ImportedItem[]) {
  return imported.map((i) => ({
    id: i.id,
    listId,
    name: i.name,
    quantity: i.quantity,
    notes: i.notes,
    completed: i.completed,
    completedAt: i.completedAt,
    createdAt: i.createdAt,
    updatedAt: new Date(),
  }));
}

function userMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.length < 120 ? err.message : fallback;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Create a list, move this device's items into it, and sign the device in. */
export async function createList(input: {
  name: unknown;
  pin: unknown;
  deviceItems: unknown;
}): Promise<ActionResult<{ name: string }>> {
  let name: string;
  try {
    name = cleanListName(input.name);
  } catch (err) {
    return { ok: false, error: userMessage(err, "Enter a list name.") };
  }
  if (!isValidPin(input.pin)) return { ok: false, error: "Your PIN needs to be exactly 4 digits." };

  try {
    const key = `signup:${await clientIp()}`;
    const locked = await lockedForMinutes(key, SIGNUP_LIMIT);
    if (locked > 0) return { ok: false, error: `Too many new lists from this network. Try again in ${locked} min.` };

    const db = getDb();
    const nameKey = listNameKey(name);
    const [taken] = await db.select({ id: lists.id }).from(lists).where(eq(lists.nameKey, nameKey)).limit(1);
    if (taken) return { ok: false, error: `"${name}" is already taken. Try another name.` };

    await recordAttempt(key, SIGNUP_LIMIT);
    const imported = parseImportedItems(input.deviceItems);
    const listId = crypto.randomUUID();
    const pinSalt = randomSalt();
    const insertList = db.insert(lists).values({
      id: listId,
      name,
      nameKey,
      pinSalt,
      pinHash: await hashPin(input.pin, pinSalt),
    });

    if (imported.length > 0) {
      // batch() runs both statements in one transaction.
      await db.batch([insertList, db.insert(items).values(rowsFor(listId, imported)).onConflictDoNothing()]);
    } else {
      await insertList;
    }

    await startSession(listId);
    return { ok: true, data: { name } };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: `"${name}" is already taken. Try another name.` };
    console.error("[createList]", err);
    return { ok: false, error: "Couldn't create your list. Check your connection and try again." };
  }
}

/** Open an existing list by name + PIN, adding any items kept on this device. */
export async function logIn(input: {
  name: unknown;
  pin: unknown;
  deviceItems: unknown;
}): Promise<ActionResult<{ added: number }>> {
  let name: string;
  try {
    name = cleanListName(input.name);
  } catch {
    return { ok: false, error: "Enter your list name." };
  }
  if (!isValidPin(input.pin)) return { ok: false, error: "Enter your 4-digit PIN." };

  try {
    const networkKey = `login:${await clientIp()}`;
    const networkLocked = await lockedForMinutes(networkKey, NETWORK_LIMIT);
    if (networkLocked > 0) {
      return { ok: false, error: `Too many wrong attempts from this network. Try again in ${networkLocked} min.` };
    }

    const [list] = await getDb().select().from(lists).where(eq(lists.nameKey, listNameKey(name))).limit(1);
    if (!list) {
      await recordAttempt(networkKey, NETWORK_LIMIT);
      await sleep(FAILURE_DELAY_MS);
      return { ok: false, error: `There's no list called "${name}". Check the spelling.` };
    }

    const listKey = `pin:${list.id}`;
    const listLocked = await lockedForMinutes(listKey, LIST_LIMIT);
    if (listLocked > 0) {
      return { ok: false, error: `This list is locked after too many wrong PINs. Try again in ${listLocked} min.` };
    }

    if (!(await pinMatches(input.pin, list.pinSalt, list.pinHash))) {
      await Promise.all([recordAttempt(listKey, LIST_LIMIT), recordAttempt(networkKey, NETWORK_LIMIT)]);
      await sleep(FAILURE_DELAY_MS);
      return { ok: false, error: "That PIN isn't right." };
    }

    await clearAttempts(listKey);
    const imported = parseImportedItems(input.deviceItems);
    if (imported.length > 0) {
      await getDb().insert(items).values(rowsFor(list.id, imported)).onConflictDoNothing();
    }

    await startSession(list.id);
    return { ok: true, data: { added: imported.length } };
  } catch (err) {
    console.error("[logIn]", err);
    return { ok: false, error: "Couldn't log in. Check your connection and try again." };
  }
}

export async function logOut(): Promise<void> {
  await endSession();
  redirect("/");
}
