CREATE TABLE "allocation_metric_samples" (
	"service_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"allocation_id" text NOT NULL,
	"node_id" text NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"cpu_millicores" real,
	"memory_bytes" bigint NOT NULL,
	"task_count" smallint NOT NULL,
	CONSTRAINT "allocation_metric_samples_allocation_id_collected_at_pk" PRIMARY KEY("allocation_id","collected_at")
);
--> statement-breakpoint
ALTER TABLE "allocation_metric_samples" ADD CONSTRAINT "allocation_metric_samples_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_metric_samples" ADD CONSTRAINT "allocation_metric_samples_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocation_metric_samples_service_idx" ON "allocation_metric_samples" USING btree ("service_id","environment_id","collected_at");--> statement-breakpoint
CREATE INDEX "allocation_metric_samples_collected_idx" ON "allocation_metric_samples" USING btree ("collected_at");