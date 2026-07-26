-- Hand-finished (VKB-91). drizzle-kit generates the bare SET DATA TYPE, which
-- Postgres rejects on a populated table: neither the column data nor its text
-- DEFAULT can be cast to an enum implicitly. Each column therefore drops its
-- default, converts with an explicit USING, and takes the default back.
--
-- The casts are deliberately strict: a plan or grant value outside the enum
-- fails the migration instead of being repaired to 'free' behind our backs.
CREATE TYPE "public"."grant_role" AS ENUM('vip', 'admin');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('free', 'essentials', 'premium');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" SET DATA TYPE plan_tier USING "plan"::plan_tier;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "grants" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "grants" SET DATA TYPE grant_role[] USING "grants"::grant_role[];--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "grants" SET DEFAULT '{}'::grant_role[];
