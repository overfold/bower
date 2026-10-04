import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setTimeout as delay } from "node:timers/promises";

const transientConnectionCodes = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
  "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "08001", "08006", "57P03",
]);

function isTransientConnectionError(error) {
  if (!(error instanceof Error)) return false;
  // Drizzle wraps connection errors in a query error with the original cause.
  return ("code" in error && transientConnectionCodes.has(String(error.code))) ||
    isTransientConnectionError(error.cause);
}

export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("Running migrations...");

  let retryDelay = 2000;
  for (let attempt = 1; ; attempt++) {
    const migrationClient = postgres(connectionString, { max: 1, connect_timeout: 5 });
    try {
      await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" });
      console.log("Migrations complete.");
      return;
    } catch (error) {
      if (!isTransientConnectionError(error)) throw error;
      // Don't log the query or connection string: they may contain secrets.
      console.warn(`Database unavailable during migrations (attempt ${attempt}); retrying in ${retryDelay / 1000} seconds.`);
    } finally {
      await migrationClient.end({ timeout: 5 });
    }
    await delay(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }
}

const isDirectExecution = import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  runMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
