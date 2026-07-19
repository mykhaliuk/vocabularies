CREATE TABLE IF NOT EXISTS "signin_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_key_hash" "bytea" NOT NULL,
	"user_id" uuid,
	"claimed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD COLUMN "poll_key_hash" "bytea";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signin_claims" ADD CONSTRAINT "signin_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "signin_claims_poll_key_hash_unique" ON "signin_claims" USING btree ("poll_key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signin_claims_expires_at_idx" ON "signin_claims" USING btree ("expires_at");