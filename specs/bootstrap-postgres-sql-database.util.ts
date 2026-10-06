import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export async function bootstrapPostgresSqlContainer() {
  const postgreSqlContainer = await new PostgreSqlContainer(
    "postgres:latest",
  ).start();
  process.env.DATABASE_URL = postgreSqlContainer.getConnectionUri();
  try {
    await migratePostgresSqlDatabase(postgreSqlContainer.getConnectionUri());
  } catch (error) {
    await postgreSqlContainer.stop();
    throw error;
  }

  return postgreSqlContainer;
}

export async function migratePostgresSqlDatabase(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await applySqlMigrations(client);
  } finally {
    await client.end();
  }
}

async function applySqlMigrations(pg: pg.Client) {
  const client = drizzle(pg);
  await migrate(client, { migrationsFolder: "./drizzle" });
}
