ALTER TABLE "api_keys" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "scopes" jsonb DEFAULT '["deploy"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;
