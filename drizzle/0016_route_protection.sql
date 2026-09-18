CREATE TYPE "public"."route_protection_mode" AS ENUM('none', 'password', 'bower_auth');--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "protection_mode" "route_protection_mode" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "password_hash" text;
