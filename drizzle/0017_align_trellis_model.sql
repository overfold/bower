ALTER TABLE "base_service_configs" ADD COLUMN "health_check_port" integer;
ALTER TABLE "service_configs" ADD COLUMN "health_check_port" integer;

UPDATE "base_service_configs" SET "health_check_port" = "port";
UPDATE "service_configs" SET "health_check_port" = "port";
UPDATE "base_service_configs" SET "replicas" = 1 WHERE "replicas" < 1;
UPDATE "service_configs" SET "replicas" = 1 WHERE "replicas" < 1;
UPDATE "environments" SET "default_replicas" = 1 WHERE "default_replicas" < 1;

CREATE TABLE "project_volumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"host_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "project_volumes" ADD CONSTRAINT "project_volumes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project_volumes" ADD CONSTRAINT "project_volumes_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "project_volumes_environment_name_idx" ON "project_volumes" USING btree ("environment_id", "name");
CREATE INDEX "project_volumes_project_environment_idx" ON "project_volumes" USING btree ("project_id", "environment_id");

INSERT INTO "project_volumes" ("project_id", "environment_id", "name", "host_path")
SELECT DISTINCT ON (s."project_id", c."environment_id", volume->>'name')
	s."project_id",
	c."environment_id",
	volume->>'name',
	COALESCE(
		NULLIF(volume->>'host_path', ''),
		CASE
			WHEN NULLIF(volume->>'host_volume', '') IS NULL THEN '@/' || (volume->>'name')
			WHEN volume->>'host_volume' LIKE '/%' OR volume->>'host_volume' LIKE '@/%' THEN volume->>'host_volume'
			ELSE '@/' || (volume->>'host_volume')
		END
	)
FROM "service_configs" c
JOIN "services" s ON s."id" = c."service_id"
CROSS JOIN LATERAL jsonb_array_elements(c."volumes") AS volume
WHERE NULLIF(volume->>'name', '') IS NOT NULL
ORDER BY s."project_id", c."environment_id", volume->>'name', c."created_at";

UPDATE "base_service_configs" c SET "volumes" = COALESCE((
	SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
		'name', volume->>'name',
		'container_path', COALESCE(volume->>'container_path', volume->>'path'),
		'read_only', CASE WHEN (volume->>'read_only')::boolean THEN true ELSE NULL END
	)))
	FROM jsonb_array_elements(c."volumes") AS volume
	WHERE NULLIF(volume->>'name', '') IS NOT NULL
		AND NULLIF(COALESCE(volume->>'container_path', volume->>'path'), '') IS NOT NULL
), '[]'::jsonb);

UPDATE "service_configs" c SET "volumes" = COALESCE((
	SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
		'name', volume->>'name',
		'container_path', COALESCE(volume->>'container_path', volume->>'path'),
		'read_only', CASE WHEN (volume->>'read_only')::boolean THEN true ELSE NULL END
	)))
	FROM jsonb_array_elements(c."volumes") AS volume
	WHERE NULLIF(volume->>'name', '') IS NOT NULL
		AND NULLIF(COALESCE(volume->>'container_path', volume->>'path'), '') IS NOT NULL
), '[]'::jsonb);

DROP TABLE "sidecars";
ALTER TABLE "base_service_configs" DROP COLUMN "port";
ALTER TABLE "base_service_configs" DROP COLUMN "command";
ALTER TABLE "base_service_configs" DROP COLUMN "cron_schedule";
ALTER TABLE "base_service_configs" DROP COLUMN "raw_config";
ALTER TABLE "service_configs" DROP COLUMN "port";
ALTER TABLE "service_configs" DROP COLUMN "command";
ALTER TABLE "service_configs" DROP COLUMN "cron_schedule";
ALTER TABLE "service_configs" DROP COLUMN "raw_config";
ALTER TABLE "service_configs" DROP COLUMN "paused_replicas";
