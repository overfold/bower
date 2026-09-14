CREATE TABLE IF NOT EXISTS "project_user_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "team_project_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "project_user_access_project_user_idx" ON "project_user_access" USING btree ("project_id", "user_id");
