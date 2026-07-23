CREATE TABLE IF NOT EXISTS "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"word" text NOT NULL,
	"gloss" text,
	"speaker" text,
	"story" text,
	"collection" text,
	"created_at" timestamp with time zone DEFAULT date_trunc('milliseconds', now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" uuid,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"original_key" text NOT NULL,
	"derivative_key" text,
	"poster_key" text,
	"duration_sec" real,
	"width" integer,
	"height" integer,
	"peaks" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "grants" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entries" ADD CONSTRAINT "entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_owner_created_idx" ON "entries" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_entry_id_idx" ON "media" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_owner_id_idx" ON "media" USING btree ("owner_id");