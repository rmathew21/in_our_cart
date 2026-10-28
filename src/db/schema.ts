import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** A list is opened with its name + a 4-digit PIN. Only a salted hash of the PIN is stored. */
export const lists = pgTable("lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Name as the person typed it, for display. */
  name: text("name").notNull(),
  /** Normalized name used for lookup: lowercase, single spaces. */
  nameKey: text("name_key").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  pinSalt: text("pin_salt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity"),
    notes: text("notes"),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("items_list_idx").on(t.listId, t.completed, t.completedAt)],
);

/** Attempt counters keyed by action + client IP. Used for rate limiting. */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export type ItemRow = typeof items.$inferSelect;
