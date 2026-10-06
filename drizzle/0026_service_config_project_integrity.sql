ALTER TABLE "services" ADD CONSTRAINT "services_id_project_id_key" UNIQUE("id","project_id");--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_id_project_id_key" UNIQUE("id","project_id");--> statement-breakpoint
ALTER TABLE "service_configs" ADD COLUMN "project_id" uuid;--> statement-breakpoint
UPDATE "service_configs" c SET "project_id" = s."project_id" FROM "services" s WHERE s."id" = c."service_id";--> statement-breakpoint
ALTER TABLE "service_configs" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_configs" DROP CONSTRAINT "service_configs_service_id_services_id_fk";--> statement-breakpoint
ALTER TABLE "service_configs" DROP CONSTRAINT "service_configs_environment_id_environments_id_fk";--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_service_project_fkey" FOREIGN KEY ("service_id","project_id") REFERENCES "public"."services"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_configs" ADD CONSTRAINT "service_configs_environment_project_fkey" FOREIGN KEY ("environment_id","project_id") REFERENCES "public"."environments"("id","project_id") ON DELETE cascade ON UPDATE no action;
