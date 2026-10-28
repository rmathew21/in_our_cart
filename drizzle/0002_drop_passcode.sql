-- Lists from the passcode-only version have no name or PIN, so they can't be opened anymore.
-- Deleting them also deletes their items (ON DELETE CASCADE).
DELETE FROM "lists";--> statement-breakpoint
DELETE FROM "login_attempts";--> statement-breakpoint
ALTER TABLE "lists" DROP CONSTRAINT "lists_passcode_hash_unique";--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN "passcode_hash";