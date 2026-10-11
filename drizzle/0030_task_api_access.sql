-- Access level now records both the grant and whether it is enabled. Preserve
-- scope-only overrides (including explicit disabling) before removing scope.
UPDATE "service_configs"
SET "overrides" = NULLIF(
  (CASE WHEN "overrides" ? 'apiAccessScope' AND NOT ("overrides" ? 'apiAccessLevel')
    THEN "overrides" || jsonb_build_object('apiAccessLevel', "api_access_level")
    ELSE "overrides" END) - 'apiAccessScope', '{}'::jsonb)
WHERE "overrides" ? 'apiAccessScope';--> statement-breakpoint
ALTER TABLE "base_service_configs" DROP CONSTRAINT "base_service_configs_api_scope_check";--> statement-breakpoint
ALTER TABLE "base_service_configs" DROP CONSTRAINT "base_service_configs_api_pair_check";--> statement-breakpoint
ALTER TABLE "service_configs" DROP CONSTRAINT "service_configs_api_scope_check";--> statement-breakpoint
ALTER TABLE "service_configs" DROP CONSTRAINT "service_configs_api_pair_check";--> statement-breakpoint
ALTER TABLE "base_service_configs" DROP COLUMN "api_access_scope";--> statement-breakpoint
ALTER TABLE "service_configs" DROP COLUMN "api_access_scope";--> statement-breakpoint
-- Stored releases are replayed for rollback. Convert their representation too,
-- preserving group/task order, images and pins without widening namespace grants.
CREATE FUNCTION pg_temp.bower_task_spec(spec jsonb) RETURNS jsonb
LANGUAGE sql STRICT AS $$
  SELECT jsonb_set(spec, '{task_groups}', COALESCE((
    SELECT jsonb_agg(
      (g.value - 'runtime' - 'api_access') || jsonb_build_object('tasks', COALESCE((
        SELECT jsonb_agg(
          (t.value - 'api_access') || jsonb_build_object('runtime',
            COALESCE(NULLIF(t.value ->> 'runtime', ''), NULLIF(g.value ->> 'runtime', ''), 'runc')) ||
          CASE WHEN COALESCE(t.value -> 'api_access', g.value -> 'api_access') ->> 'access' IN ('read', 'write')
            AND COALESCE(COALESCE(t.value -> 'api_access', g.value -> 'api_access') ->> 'scope', 'cluster') = 'cluster'
          THEN jsonb_build_object('api_access', COALESCE(t.value -> 'api_access', g.value -> 'api_access') - 'scope')
          ELSE '{}'::jsonb END
          ORDER BY t.ordinality)
        FROM jsonb_array_elements(g.value -> 'tasks') WITH ORDINALITY AS t(value, ordinality)
      ), '[]'::jsonb)) ORDER BY g.ordinality)
    FROM jsonb_array_elements(spec -> 'task_groups') WITH ORDINALITY AS g(value, ordinality)
  ), '[]'::jsonb))
$$;--> statement-breakpoint
UPDATE "deployments"
SET "job_spec" = pg_temp.bower_task_spec("job_spec"),
    "previous_job_spec" = pg_temp.bower_task_spec("previous_job_spec")
WHERE "job_spec" IS NOT NULL OR "previous_job_spec" IS NOT NULL;--> statement-breakpoint
DROP FUNCTION pg_temp.bower_task_spec(jsonb);
