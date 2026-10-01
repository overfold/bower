-- Do not silently broaden existing namespace grants to cluster-wide access.
UPDATE "base_service_configs" SET "api_access_scope" = NULL, "api_access_level" = NULL
WHERE "api_access_scope" = 'namespace';--> statement-breakpoint
UPDATE "service_configs" SET "api_access_scope" = NULL, "api_access_level" = NULL
WHERE "api_access_scope" = 'namespace';--> statement-breakpoint
-- Keep an explicit disabled override so a cluster grant on the base cannot leak
-- into an environment that previously requested namespace-only access.
UPDATE "service_configs"
SET "overrides" = "overrides" || '{"apiAccessScope":null,"apiAccessLevel":null}'::jsonb
WHERE "overrides" ->> 'apiAccessScope' = 'namespace';--> statement-breakpoint
ALTER TABLE "base_service_configs" DROP CONSTRAINT "base_service_configs_api_scope_check";--> statement-breakpoint
ALTER TABLE "base_service_configs" ADD CONSTRAINT "base_service_configs_api_scope_check"
CHECK ("api_access_scope" IS NULL OR "api_access_scope" = 'cluster');--> statement-breakpoint
ALTER TABLE "service_configs" DROP CONSTRAINT "service_configs_api_scope_check";--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_api_scope_check"
CHECK ("api_access_scope" IS NULL OR "api_access_scope" = 'cluster');
