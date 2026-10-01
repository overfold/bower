ALTER TABLE "invitations" ADD COLUMN "max_uses" integer DEFAULT 1;
ALTER TABLE "invitations" ADD COLUMN "use_count" integer DEFAULT 0 NOT NULL;
UPDATE "invitations" SET "max_uses" = NULL WHERE "reusable" = true;
UPDATE "invitations" SET "use_count" = 1 WHERE "used_at" IS NOT NULL;
ALTER TABLE "invitations" ADD CONSTRAINT "invitation_max_uses_positive" CHECK ("max_uses" IS NULL OR "max_uses" > 0);
