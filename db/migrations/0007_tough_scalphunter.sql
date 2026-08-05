ALTER TABLE "media" ADD COLUMN "pending_entry_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_pending_entry_id_entries_id_fk" FOREIGN KEY ("pending_entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_entry_id_unique" ON "media" USING btree ("entry_id") WHERE "media"."entry_id" is not null;