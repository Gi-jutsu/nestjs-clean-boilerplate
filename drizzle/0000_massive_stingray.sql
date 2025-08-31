CREATE TABLE IF NOT EXISTS "outbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"error_message" varchar
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_messages_unprocessed"
ON "outbox_messages" USING btree ("occurred_at", "processed_at")
--> @FIXME PostgreSQL 'INCLUDE' is not supported by drizzle-orm
--> see https://github.com/drizzle-team/drizzle-orm/issues/2972
INCLUDE ("id", "event_type", "payload") --> Added manually
WHERE "outbox_messages"."processed_at" IS NULL;