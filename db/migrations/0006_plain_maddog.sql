CREATE TYPE "public"."speaker_tone" AS ENUM('rose', 'blue', 'ink');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "speakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rel" text,
	"birthday" date,
	"tone" "speaker_tone" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "sid" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "tone" "speaker_tone";--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "said_at" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "speakers" ADD CONSTRAINT "speakers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "speakers_owner_idx" ON "speakers" USING btree ("owner_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entries" ADD CONSTRAINT "entries_sid_speakers_id_fk" FOREIGN KEY ("sid") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Backfill (VKB-97). said_at: the ADD COLUMN default stamped existing rows
-- with the migration day; the memory's anchor is the row's creation day.
UPDATE "entries" SET "said_at" = "created_at"::date;--> statement-breakpoint
-- Legacy free-text speakers become real speaker rows, one per distinct
-- (owner, name), toned by the spec's rose → blue → ink creation cycle in
-- order of first appearance.
INSERT INTO "speakers" ("owner_id", "name", "tone")
SELECT
	legacy."owner_id",
	legacy."name",
	(ARRAY['rose','blue','ink'])[
		((row_number() OVER (
			PARTITION BY legacy."owner_id" ORDER BY legacy."first_used"
		) - 1) % 3) + 1
	]::"speaker_tone"
FROM (
	SELECT "owner_id", "speaker" AS "name", min("created_at") AS "first_used"
	FROM "entries"
	WHERE "speaker" IS NOT NULL
	GROUP BY "owner_id", "speaker"
) AS legacy;--> statement-breakpoint
UPDATE "entries" e
SET "sid" = s."id", "tone" = s."tone"
FROM "speakers" s
WHERE e."speaker" IS NOT NULL
	AND s."owner_id" = e."owner_id"
	AND s."name" = e."speaker";
