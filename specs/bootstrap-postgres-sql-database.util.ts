import { accountSchema } from "@identity-and-access/infrastructure/database/drizzle.schema.js";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { accounts } from "./fixtures/account.fixture.js";

export async function bootstrapPostgresSqlContainer() {
  const postgreSqlContainer = await new PostgreSqlContainer('postgres:latest').start();
  const postgreSqlClient = new pg.Client({
    connectionString: postgreSqlContainer.getConnectionUri(),
  });

  await postgreSqlClient.connect();
  process.env.DATABASE_URL = postgreSqlContainer.getConnectionUri();

  // Apply migrations & fixtures
  const client = drizzle(postgreSqlClient);

  await migrate(client, { migrationsFolder: "./drizzle" });

  await client.insert(accountSchema).values(accounts).execute();

  await postgreSqlClient.end();

  return postgreSqlContainer;
}
