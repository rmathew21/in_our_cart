ALTER TABLE "lists" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "name_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "pin_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "pin_salt" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_name_key_unique" UNIQUE("name_key");