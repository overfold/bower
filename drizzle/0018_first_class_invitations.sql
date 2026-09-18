CREATE TABLE "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "organization_role" "org_member_role",
  "grant_instance_admin" boolean DEFAULT false NOT NULL,
  "reusable" boolean DEFAULT false NOT NULL,
  "note" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "used_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "invitation_teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invitation_id" uuid NOT NULL REFERENCES "invitations"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  CONSTRAINT "invitation_teams_invitation_team_idx" UNIQUE("invitation_id", "team_id")
);
INSERT INTO "invitations" ("org_id", "token_hash", "organization_role", "note", "created_by_user_id", "used_by_user_id", "used_at", "expires_at", "created_at")
SELECT "org_id", "token_hash", "role", "note", "created_by_user_id", "used_by_user_id", "used_at", "expires_at", "created_at" FROM "organization_tokens";
INSERT INTO "invitations" ("token_hash", "grant_instance_admin", "note", "created_by_user_id", "used_by_user_id", "used_at", "expires_at", "created_at")
SELECT "token_hash", true, "note", "created_by_user_id", "used_by_user_id", "used_at", "expires_at", "created_at" FROM "instance_tokens";
DROP TABLE "organization_tokens";
DROP TABLE "instance_tokens";
