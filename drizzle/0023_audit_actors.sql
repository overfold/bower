CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system', 'api_key', 'webhook');--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_type" "audit_actor_type";--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;
