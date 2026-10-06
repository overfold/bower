CREATE TABLE "service_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"cause" text NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "service_incidents" ADD CONSTRAINT "service_incidents_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_incidents" ADD CONSTRAINT "service_incidents_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_incidents_open_idx" ON "service_incidents" USING btree ("service_id","environment_id") WHERE "service_incidents"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "service_incidents_started_idx" ON "service_incidents" USING btree ("started_at");