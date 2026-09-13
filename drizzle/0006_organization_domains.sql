CREATE TABLE "organization_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "domain" text NOT NULL,
  "verification_token" text NOT NULL,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_domains_domain_normalized" CHECK ("domain" = lower("domain") AND "domain" NOT LIKE '*.%')
);
--> statement-breakpoint
ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_domains_org_domain_idx" ON "organization_domains" USING btree ("org_id", "domain");
--> statement-breakpoint
CREATE INDEX "organization_domains_org_idx" ON "organization_domains" USING btree ("org_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "bower_route_hostnames_overlap"(left_host text, right_host text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  left_value text := lower(trim(trailing '.' from left_host));
  right_value text := lower(trim(trailing '.' from right_host));
  left_wildcard boolean;
  right_wildcard boolean;
  left_base text;
  right_base text;
BEGIN
  IF left_value = right_value THEN RETURN true; END IF;
  left_wildcard := left(left_value, 2) = '*.';
  right_wildcard := left(right_value, 2) = '*.';
  left_base := CASE WHEN left_wildcard THEN substr(left_value, 3) ELSE left_value END;
  right_base := CASE WHEN right_wildcard THEN substr(right_value, 3) ELSE right_value END;
  IF left_wildcard AND right_wildcard THEN
    RETURN left_base = right_base OR left_base LIKE '%.' || right_base OR right_base LIKE '%.' || left_base;
  ELSIF left_wildcard THEN RETURN right_value LIKE '%.' || left_base;
  ELSIF right_wildcard THEN RETURN left_value LIKE '%.' || right_base;
  END IF;
  RETURN false;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "bower_validate_route_domain"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  route_org_id uuid;
  normalized_hostname text;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW."project_id" IS NOT DISTINCT FROM OLD."project_id"
    AND NEW."environment_id" IS NOT DISTINCT FROM OLD."environment_id"
    AND NEW."domain" IS NOT DISTINCT FROM OLD."domain" THEN
    RETURN NEW;
  END IF;

  SELECT "org_id" INTO route_org_id FROM "projects" WHERE "id" = NEW."project_id";
  IF route_org_id IS NULL THEN RAISE EXCEPTION 'Route project was not found.' USING ERRCODE = '23503'; END IF;

  normalized_hostname := lower(trim(trailing '.' from NEW."domain"));
  IF left(normalized_hostname, 2) = '*.' THEN normalized_hostname := substr(normalized_hostname, 3); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "organization_domains" d
    WHERE d."org_id" = route_org_id AND d."verified_at" IS NOT NULL
      AND (normalized_hostname = d."domain" OR normalized_hostname LIKE '%.' || d."domain")
  ) THEN
    RAISE EXCEPTION 'Route hostname % is not covered by a verified organization domain.', NEW."domain" USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "routes" r INNER JOIN "projects" p ON p."id" = r."project_id"
    WHERE p."org_id" = route_org_id AND r."id" IS DISTINCT FROM NEW."id"
      AND (r."project_id" <> NEW."project_id" OR r."environment_id" <> NEW."environment_id")
      AND "bower_route_hostnames_overlap"(r."domain", NEW."domain")
  ) THEN
    RAISE EXCEPTION 'Route hostname % is already claimed by another project or environment.', NEW."domain" USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "routes_verified_domain_guard"
BEFORE INSERT OR UPDATE OF "project_id", "environment_id", "domain" ON "routes"
FOR EACH ROW EXECUTE FUNCTION "bower_validate_route_domain"();
