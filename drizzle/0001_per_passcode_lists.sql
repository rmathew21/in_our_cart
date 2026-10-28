CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passcode_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lists_passcode_hash_unique" UNIQUE("passcode_hash")
);
--> statement-breakpoint
DROP INDEX "items_completed_idx";--> statement-breakpoint
-- Items from the old single-passcode version have no list to belong to.
DELETE FROM "items";--> statement-breakpoint
DELETE FROM "login_attempts";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "list_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_list_idx" ON "items" USING btree ("list_id","completed","completed_at");