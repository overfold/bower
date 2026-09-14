CREATE TABLE "service_deployments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_id" uuid NOT NULL,
  "environment_id" uuid NOT NULL,
  "replicas" integer DEFAULT 1 NOT NULL,
  "paused_replicas" integer,
  "active_job_name" text,
  "env_vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "secret_bindings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_deployments" ADD CONSTRAINT "service_deployments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_deployments" ADD CONSTRAINT "service_deployments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "service_deployments_service_env_idx" ON "service_deployments" USING btree ("service_id","environment_id");
--> statement-breakpoint
ALTER TABLE "service_deployments" ADD CONSTRAINT "service_deployments_replicas_check" CHECK ("replicas" >= 0);
--> statement-breakpoint
INSERT INTO "service_deployments" (
  "service_id", "environment_id", "replicas", "paused_replicas", "active_job_name",
  "env_vars", "secret_bindings", "created_at", "updated_at"
)
SELECT
  "service_id", "environment_id", "replicas", "paused_replicas", "active_job_name",
  "env_vars", "secret_bindings", "created_at", "updated_at"
FROM "service_configs"
ON CONFLICT ("service_id", "environment_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "service_deployments" ("service_id", "environment_id", "replicas")
SELECT s."id", e."id", 1
FROM "services" s
JOIN "environments" e ON e."project_id" = s."project_id"
ON CONFLICT ("service_id", "environment_id") DO NOTHING;
--> statement-breakpoint
CREATE TEMP TABLE "_bower_service_config_keep" ON COMMIT DROP AS
SELECT DISTINCT ON ("service_id") "id"
FROM "service_configs"
ORDER BY "service_id", "updated_at" DESC, "created_at" DESC, "id";
--> statement-breakpoint
DELETE FROM "service_configs"
WHERE "id" NOT IN (SELECT "id" FROM "_bower_service_config_keep");
--> statement-breakpoint
DROP INDEX IF EXISTS "service_configs_service_env_idx";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP CONSTRAINT IF EXISTS "service_configs_environment_id_environments_id_fk";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "environment_id";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "replicas";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "env_vars";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "secret_bindings";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "paused_replicas";
--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "active_job_name";
--> statement-breakpoint
CREATE UNIQUE INDEX "service_configs_service_idx" ON "service_configs" USING btree ("service_id");
--> statement-breakpoint
ALTER TABLE "environments" DROP COLUMN "default_replicas";
--> statement-breakpoint
ALTER TABLE "environments" DROP COLUMN "resource_tier";