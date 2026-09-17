import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const orgMemberRoleEnum = pgEnum("org_member_role", [
  "owner",
  "admin",
  "member",
]);

export const healthCheckTypeEnum = pgEnum("health_check_type", [
  "http",
  "tcp",
  "script",
]);

export const deploymentStrategyEnum = pgEnum("deployment_strategy", [
  "rolling",
  "recreate",
  "blue_green",
  "canary",
]);

export const resourceTierEnum = pgEnum("resource_tier", [
  "small",
  "medium",
  "large",
  "xl",
  "custom",
]);

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "pending",
  "planning",
  "deploying",
  "healthy",
  "failed",
  "rolled_back",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "manual",
  "webhook",
  "promotion",
  "rollback",
  "auto_rollback",
]);

export const tlsModeEnum = pgEnum("tls_mode", ["auto", "custom", "none"]);

export const proxyStatusEnum = pgEnum("proxy_status", [
  "pending",
  "running",
  "error",
]);

export const notificationChannelTypeEnum = pgEnum(
  "notification_channel_type",
  ["slack", "discord", "http"]
);

export const teamProjectRoleEnum = pgEnum("team_project_role", [
  "admin",
  "deployer",
  "viewer",
]);

export const webhookProviderEnum = pgEnum("webhook_provider", [
  "generic",
  "docker_hub",
  "ghcr",
]);

export const webhookDeployModeEnum = pgEnum("webhook_deploy_mode", [
  "any_push",
  "tag",
  "digest",
]);

// ---------------------------------------------------------------------------
// Auth / Org layer
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  isInstanceAdmin: boolean("is_instance_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_token_idx").on(table.token)]
);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  trellisApiUrl: text("trellis_api_url").notNull(),
  trellisApiToken: text("trellis_api_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgMemberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_idx").on(
      table.orgId,
      table.userId
    ),
  ]
);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organizationTokens = pgTable("organization_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  role: orgMemberRoleEnum("role").notNull(),
  note: text("note"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  usedByUserId: uuid("used_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const instanceTokens = pgTable("instance_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  note: text("note"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  usedByUserId: uuid("used_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Workload model
// ---------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    owningTeamId: uuid("owning_team_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_org_slug_idx").on(table.orgId, table.slug),
  ]
);

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    trellisNamespace: text("trellis_namespace").notNull(),
    promotionOrder: integer("promotion_order").notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    defaultReplicas: integer("default_replicas").notNull().default(1),
    resourceTier: resourceTierEnum("resource_tier").notNull().default("small"),
    envVars: jsonb("env_vars").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("environments_project_slug_idx").on(
      table.projectId,
      table.slug
    ),
  ]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("services_project_slug_idx").on(table.projectId, table.slug),
  ]
);

export const baseServiceConfigs = pgTable("base_service_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .unique()
    .references(() => services.id, { onDelete: "cascade" }),
  image: text("image").notNull(),
  port: integer("port"),
  replicas: integer("replicas").notNull().default(1),
  cpu: integer("cpu").notNull(),
  memory: integer("memory").notNull(),
  healthCheckPath: text("health_check_path"),
  healthCheckType: healthCheckTypeEnum("health_check_type"),
  healthCheckCommand: jsonb("health_check_command").notNull().default([]),
  healthCheckInterval: integer("health_check_interval").notNull().default(10),
  healthCheckTimeout: integer("health_check_timeout").notNull().default(2),
  healthCheckThreshold: integer("health_check_threshold").notNull().default(3),
  deploymentStrategy: deploymentStrategyEnum("deployment_strategy")
    .notNull()
    .default("rolling"),
  resourceTier: resourceTierEnum("resource_tier").notNull().default("small"),
  envVars: jsonb("env_vars").notNull().default({}),
  labels: jsonb("labels").notNull().default({}),
  command: text("command"),
  volumes: jsonb("volumes").notNull().default([]),
  secretBindings: jsonb("secret_bindings").notNull().default([]),
  rawConfig: jsonb("raw_config"),
  cronSchedule: text("cron_schedule"),
  autoRollbackSeconds: integer("auto_rollback_seconds").notNull().default(300),
  canarySteps: jsonb("canary_steps").notNull().default([10, 25, 50, 100]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const serviceConfigs = pgTable(
  "service_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    image: text("image").notNull(),
    port: integer("port"),
    replicas: integer("replicas").notNull().default(1),
    cpu: integer("cpu").notNull(),
    memory: integer("memory").notNull(),
    healthCheckPath: text("health_check_path"),
    healthCheckType: healthCheckTypeEnum("health_check_type"),
    healthCheckCommand: jsonb("health_check_command").notNull().default([]),
    healthCheckInterval: integer("health_check_interval").notNull().default(10),
    healthCheckTimeout: integer("health_check_timeout").notNull().default(2),
    healthCheckThreshold: integer("health_check_threshold").notNull().default(3),
    deploymentStrategy: deploymentStrategyEnum("deployment_strategy")
      .notNull()
      .default("rolling"),
    resourceTier: resourceTierEnum("resource_tier").notNull(),
    envVars: jsonb("env_vars").notNull().default({}),
    labels: jsonb("labels").notNull().default({}),
    command: text("command"),
    volumes: jsonb("volumes").notNull().default([]),
    secretBindings: jsonb("secret_bindings").notNull().default([]),
    rawConfig: jsonb("raw_config"),
    cronSchedule: text("cron_schedule"),
    pausedReplicas: integer("paused_replicas"),
    activeJobName: text("active_job_name"),
    autoRollbackSeconds: integer("auto_rollback_seconds").notNull().default(300),
    canarySteps: jsonb("canary_steps").notNull().default([10, 25, 50, 100]),
    overrides: jsonb("overrides"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("service_configs_service_env_idx").on(
      table.serviceId,
      table.environmentId
    ),
  ]
);

export const sidecars = pgTable("sidecars", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceConfigId: uuid("service_config_id")
    .notNull()
    .references(() => serviceConfigs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  image: text("image").notNull(),
  cpu: integer("cpu").notNull(),
  memory: integer("memory").notNull(),
  port: integer("port"),
  envVars: jsonb("env_vars").notNull().default({}),
  command: text("command"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Deployment history
// ---------------------------------------------------------------------------

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  imageBefore: text("image_before"),
  imageAfter: text("image_after").notNull(),
  strategy: deploymentStrategyEnum("strategy").notNull(),
  status: deploymentStatusEnum("status").notNull(),
  triggeredByUserId: uuid("triggered_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  triggerType: triggerTypeEnum("trigger_type").notNull(),
  trellisRevision: integer("trellis_revision"),
  planDiff: jsonb("plan_diff"),
  jobSpec: jsonb("job_spec"),
  previousJobSpec: jsonb("previous_job_spec"),
  trellisJobName: text("trellis_job_name"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deploymentEvents = pgTable("deployment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentId: uuid("deployment_id").notNull().references(() => deployments.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("deployment_events_deployment_created_idx").on(table.deploymentId, table.createdAt)]);

// ---------------------------------------------------------------------------
// Routing layer
// ---------------------------------------------------------------------------

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  pathPrefix: text("path_prefix").notNull().default("/"),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  port: integer("port").notNull(),
  tlsMode: tlsModeEnum("tls_mode").notNull().default("auto"),
  headers: jsonb("headers").notNull().default({}),
  responseHeaders: jsonb("response_headers").notNull().default({}),
  rateLimit: integer("rate_limit"),
  redirects: jsonb("redirects").notNull().default([]),
  tlsCertSecret: text("tls_cert_secret"),
  tlsKeySecret: text("tls_key_secret"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [uniqueIndex("routes_environment_domain_path_idx").on(table.environmentId, table.domain, table.pathPrefix)]);

export const managedProxies = pgTable("managed_proxies", {
  id: uuid("id").primaryKey().defaultRandom(),
  environmentId: uuid("environment_id")
    .notNull()
    .unique()
    .references(() => environments.id, { onDelete: "cascade" }),
  trellisJobName: text("trellis_job_name").notNull(),
  status: proxyStatusEnum("status").notNull(),
  port: integer("port").notNull().default(80),
  configHash: text("config_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Secret linkage (values stay in Trellis)
// ---------------------------------------------------------------------------

export const secretsMetadata = pgTable(
  "secrets_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trellisSecretName: text("trellis_secret_name").notNull(),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("secrets_metadata_env_name_idx").on(
      table.environmentId,
      table.name
    ),
  ]
);

export const sharedSecretGroups = pgTable("shared_secret_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sharedSecretMembers = pgTable("shared_secret_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => sharedSecretGroups.id, { onDelete: "cascade" }),
  secretMetadataId: uuid("secret_metadata_id")
    .notNull()
    .references(() => secretsMetadata.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [uniqueIndex("shared_secret_members_group_secret_idx").on(table.groupId, table.secretMetadataId)]);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    details: jsonb("details").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_org_created_idx").on(table.orgId, table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  signatureSecretHash: text("signature_secret_hash").notNull(),
  provider: webhookProviderEnum("provider").notNull().default("generic"),
  deployMode: webhookDeployModeEnum("deploy_mode").notNull().default("any_push"),
  tagFilter: text("tag_filter"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationChannels = pgTable("notification_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: notificationChannelTypeEnum("type").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("team_memberships_team_user_idx").on(
      table.teamId,
      table.userId
    ),
  ]
);

export const teamProjectAccess = pgTable(
  "team_project_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: teamProjectRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("team_project_access_team_project_idx").on(
      table.teamId,
      table.projectId
    ),
  ]
);

export const projectUserAccess = pgTable(
  "project_user_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamProjectRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_user_access_project_user_idx").on(
      table.projectId,
      table.userId
    ),
  ]
);
