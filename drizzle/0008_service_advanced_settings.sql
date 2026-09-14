CREATE TABLE IF NOT EXISTS "service_advanced_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_config_id" uuid NOT NULL REFERENCES "service_configs"("id") ON DELETE CASCADE,
  "runtime" text DEFAULT 'runc' NOT NULL,
  "api_access_scope" text,
  "api_access_level" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_advanced_settings_runtime_check" CHECK ("runtime" IN ('runc', 'runsc')),
  CONSTRAINT "service_advanced_settings_api_scope_check" CHECK ("api_access_scope" IS NULL OR "api_access_scope" IN ('namespace', 'cluster')),
  CONSTRAINT "service_advanced_settings_api_level_check" CHECK ("api_access_level" IS NULL OR "api_access_level" IN ('read', 'write')),
  CONSTRAINT "service_advanced_settings_api_pair_check" CHECK (("api_access_scope" IS NULL) = ("api_access_level" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_advanced_settings_config_idx" ON "service_advanced_settings" USING btree ("service_config_id");
