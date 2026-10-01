ALTER TABLE "organizations" ADD COLUMN "use_trellis_workload_identity" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "organizations" AS organization
SET "use_trellis_workload_identity" = true,
    "trellis_api_url" = '',
    "trellis_api_token" = ''
WHERE organization."slug" = 'default'
  AND organization."trellis_api_url" ~ '^trellis:[0-9]+/?$'
  AND EXISTS (
    SELECT 1 FROM "invitations" AS invitation
    WHERE invitation."org_id" = organization."id"
      AND invitation."note" = 'Bootstrap instance admin token'
  );
