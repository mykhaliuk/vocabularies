ALTER TABLE "signin_claims" ADD COLUMN "confirm_code_hash" "bytea";--> statement-breakpoint
ALTER TABLE "signin_claims" ADD COLUMN "confirm_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "signin_claims" ADD COLUMN "confirm_expires_at" timestamp with time zone;