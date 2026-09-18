ALTER TABLE "base_service_configs" ADD COLUMN IF NOT EXISTS "runtime" text DEFAULT 'runc' NOT NULL;--> statement-breakpoint
ALTER TABLE "base_service_configs" ADD COLUMN IF NOT EXISTS "api_access_scope" text;--> statement-breakpoint
ALTER TABLE "base_service_configs" ADD COLUMN IF NOT EXISTS "api_access_level" text;--> statement-breakpoint
ALTER TABLE "service_configs" ADD COLUMN IF NOT EXISTS "runtime" text DEFAULT 'runc' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_configs" ADD COLUMN IF NOT EXISTS "api_access_scope" text;--> statement-breakpoint
ALTER TABLE "service_configs" ADD COLUMN IF NOT EXISTS "api_access_level" text;--> statement-breakpoint

ALTER TABLE "base_service_configs" ADD CONSTRAINT "base_service_configs_runtime_check" CHECK ("runtime" IN ('runc', 'runsc'));--> statement-breakpoint
ALTER TABLE "base_service_configs" ADD CONSTRAINT "base_service_configs_api_scope_check" CHECK ("api_access_scope" IS NULL OR "api_access_scope" IN ('namespace', 'cluster'));--> statement-breakpoint
ALTER TABLE "base_service_configs" ADD CONSTRAINT "base_service_configs_api_level_check" CHECK ("api_access_level" IS NULL OR "api_access_level" IN ('read', 'write'));--> statement-breakpoint
ALTER TABLE "base_service_configs" ADD CONSTRAINT "base_service_configs_api_pair_check" CHECK (("api_access_scope" IS NULL) = ("api_access_level" IS NULL));--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_runtime_check" CHECK ("runtime" IN ('runc', 'runsc'));--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_api_scope_check" CHECK ("api_access_scope" IS NULL OR "api_access_scope" IN ('namespace', 'cluster'));--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_api_level_check" CHECK ("api_access_level" IS NULL OR "api_access_level" IN ('read', 'write'));--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_api_pair_check" CHECK (("api_access_scope" IS NULL) = ("api_access_level" IS NULL));--> statement-breakpoint

UPDATE "service_configs" AS sc
SET
  "runtime" = sas."runtime",
  "api_access_scope" = sas."api_access_scope",
  "api_access_level" = sas."api_access_level",
  "overrides" = COALESCE(sc."overrides", '{}'::jsonb) || jsonb_build_object(
    'runtime', sas."runtime",
    'apiAccessScope', sas."api_access_scope",
    'apiAccessLevel', sas."api_access_level"
  )
FROM "service_advanced_settings" AS sas
WHERE sas."service_config_id" = sc."id";--> statement-breakpoint

DROP TABLE "service_advanced_settings";
