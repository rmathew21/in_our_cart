import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { items, lists, type ItemRow } from "@/db/schema";
import type { Item } from "./types";

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    notes: row.notes,
    completed: row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getListName(listId: string): Promise<string | null> {
  const [row] = await getDb().select({ name: lists.name }).from(lists).where(eq(lists.id, listId)).limit(1);
  return row?.name ?? null;
}

export async function listItems(listId: string): Promise<Item[]> {
  const rows = await getDb()
    .select()
    .from(items)
    .where(eq(items.listId, listId))
    .orderBy(asc(items.completed), desc(items.completedAt), desc(items.createdAt));
  return rows.map(toItem);
}
