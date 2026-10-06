import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { SharedKernelDatabaseSchema } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { pushSchema } from "drizzle-kit/api";
import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export async function bootstrapPostgresSqlContainer() {
  const container = await new PostgreSqlContainer("postgres:latest").start();
  process.env.DATABASE_URL = container.getConnectionUri();
  try {
    await preparePostgresSqlDatabase(container.getConnectionUri());
  } catch (error) {
    await container.stop();
    throw error;
  }
  return container;
}

export async function preparePostgresSqlDatabase(connectionString: string) {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const preparation = await pushSchema(
      SharedKernelDatabaseSchema,
      drizzle(client),
      ["public"],
      Object.values(SharedKernelDatabaseSchema).map(getTableName),
    );
    if (preparation.hasDataLoss || preparation.warnings.length > 0) {
      throw new Error(
        "Refusing test database schema changes that may lose data or require review.",
      );
    }
    await preparation.apply();
  } finally {
    await client.end();
  }
}
