import { LIMITS } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ItemInput = { name: string; quantity: string | null; notes: string | null };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function optional(value: unknown, max: number, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return trimmed === "" ? null : trimmed;
}

/** Throws an Error with a user-facing message when input is invalid. */
export function parseItemInput(raw: { name: unknown; quantity?: unknown; notes?: unknown }): ItemInput {
  if (typeof raw.name !== "string" || raw.name.trim() === "") throw new Error("Item name is required");
  const name = raw.name.trim();
  if (name.length > LIMITS.name) throw new Error(`Item name must be ${LIMITS.name} characters or fewer`);
  return {
    name,
    quantity: optional(raw.quantity, LIMITS.quantity, "Quantity"),
    notes: optional(raw.notes, LIMITS.notes, "Notes"),
  };
}

export const MAX_IMPORTED_ITEMS = 500;

export type ImportedItem = ItemInput & {
  id: string;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
};

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== "string") return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.getTime() > Date.now() ? new Date() : d; // no future timestamps
}

/** Validate items that were kept on a device before signing up or logging in. */
export function parseImportedItems(raw: unknown): ImportedItem[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_IMPORTED_ITEMS) throw new Error(`Lists can bring over up to ${MAX_IMPORTED_ITEMS} items`);
  const now = new Date();
  const out: ImportedItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (!isUuid(e.id)) continue;
    let input: ItemInput;
    try {
      input = parseItemInput({ name: e.name, quantity: e.quantity, notes: e.notes });
    } catch {
      continue; // skip anything malformed rather than failing the whole save
    }
    const completed = e.completed === true;
    out.push({
      ...input,
      id: e.id,
      completed,
      completedAt: completed ? parseDate(e.completedAt, now) : null,
      createdAt: parseDate(e.createdAt, now),
    });
  }
  return out;
}
