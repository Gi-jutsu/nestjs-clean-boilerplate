import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export async function bootstrapPostgresSqlContainer() {
  const postgreSqlContainer = await new PostgreSqlContainer(
    'postgres:latest',
  ).start();
  const postgreSqlClient = new pg.Client({
    connectionString: postgreSqlContainer.getConnectionUri(),
  });

  await postgreSqlClient.connect();
  process.env.DATABASE_URL = postgreSqlContainer.getConnectionUri();

  await applySqlMigrations(postgreSqlClient);

  await postgreSqlClient.end();

  return postgreSqlContainer;
}

async function applySqlMigrations(pg: pg.Client) {
  const client = drizzle(pg);
  await migrate(client, { migrationsFolder: './drizzle' });
}
