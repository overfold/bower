CREATE TABLE "auth_abuse_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_abuse_buckets_expiry_idx" ON "auth_abuse_buckets" USING btree ("expires_at");
