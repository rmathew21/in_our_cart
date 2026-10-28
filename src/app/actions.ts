"use server";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { items } from "@/db/schema";
import { toItem } from "@/lib/items";
import { getListId } from "@/lib/session";
import type { ActionResult, Item } from "@/lib/types";
import { isUuid, parseImportedItems, parseItemInput } from "@/lib/validate";

const UNAUTHORIZED = { ok: false, error: "You've been logged out. Log in with your passcode again.", unauthorized: true } as const;
const NOT_FOUND = { ok: false, error: "That item was removed on another device." } as const;

/** Every item action runs against the signed-in list only. */
async function run<T>(fn: (listId: string) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const listId = await getListId();
  if (!listId) return UNAUTHORIZED;
  try {
    return await fn(listId);
  } catch (err) {
    const message = err instanceof Error && err.message.length < 120 ? err.message : "Something went wrong";
    console.error("[action]", err);
    return { ok: false, error: message };
  }
}

/** The client generates the id so optimistic rows never need re-keying. */
export async function addItem(input: {
  id: string;
  name: string;
  quantity?: string | null;
  notes?: string | null;
}): Promise<ActionResult<Item>> {
  return run(async (listId) => {
    if (!isUuid(input.id)) return { ok: false, error: "Invalid item id" };
    const data = parseItemInput(input);
    const [row] = await getDb()
      .insert(items)
      .values({ id: input.id, listId, ...data })
      .onConflictDoNothing({ target: items.id })
      .returning();
    if (row) return { ok: true, data: toItem(row) };
    // Retry of an insert that already succeeded: return the existing row.
    const [existing] = await getDb()
      .select()
      .from(items)
      .where(and(eq(items.id, input.id), eq(items.listId, listId)))
      .limit(1);
    return existing ? { ok: true, data: toItem(existing) } : { ok: false, error: "Couldn't add item" };
  });
}

export async function setCompleted(id: string, completed: boolean): Promise<ActionResult<Item>> {
  return run(async (listId) => {
    if (!isUuid(id)) return { ok: false, error: "Invalid item id" };
    const [row] = await getDb()
      .update(items)
      .set({ completed, completedAt: completed ? sql`now()` : null, updatedAt: sql`now()` })
      .where(and(eq(items.id, id), eq(items.listId, listId)))
      .returning();
    return row ? { ok: true, data: toItem(row) } : NOT_FOUND;
  });
}

export async function updateItem(input: {
  id: string;
  name: string;
  quantity?: string | null;
  notes?: string | null;
}): Promise<ActionResult<Item>> {
  return run(async (listId) => {
    if (!isUuid(input.id)) return { ok: false, error: "Invalid item id" };
    const data = parseItemInput(input);
    const [row] = await getDb()
      .update(items)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(eq(items.id, input.id), eq(items.listId, listId)))
      .returning();
    return row ? { ok: true, data: toItem(row) } : NOT_FOUND;
  });
}

export async function deleteItem(id: string): Promise<ActionResult<{ id: string }>> {
  return run(async (listId) => {
    if (!isUuid(id)) return { ok: false, error: "Invalid item id" };
    // Deleting something already gone counts as success.
    await getDb()
      .delete(items)
      .where(and(eq(items.id, id), eq(items.listId, listId)));
    return { ok: true, data: { id } };
  });
}

/** Put back an item that was just deleted (the Undo button). Keeps its id, state and timestamps. */
export async function restoreItem(item: unknown): Promise<ActionResult<Item>> {
  return run(async (listId) => {
    const [parsed] = parseImportedItems([item]);
    if (!parsed) return { ok: false, error: "Couldn't restore that item" };
    const [row] = await getDb()
      .insert(items)
      .values({ ...parsed, listId, updatedAt: new Date() })
      .onConflictDoNothing({ target: items.id })
      .returning();
    if (row) return { ok: true, data: toItem(row) };
    const [existing] = await getDb()
      .select()
      .from(items)
      .where(and(eq(items.id, parsed.id), eq(items.listId, listId)))
      .limit(1);
    return existing ? { ok: true, data: toItem(existing) } : { ok: false, error: "Couldn't restore that item" };
  });
}
