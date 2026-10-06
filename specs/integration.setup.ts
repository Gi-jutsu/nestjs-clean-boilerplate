import {
  bootstrapPostgresSqlContainer,
  migratePostgresSqlDatabase,
} from "./bootstrap-postgres-sql-database.util.js";

export async function setup() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
    await migratePostgresSqlDatabase(databaseUrl);
    return;
  }

  const container = await bootstrapPostgresSqlContainer();
  return async () => {
    await container.stop();
  };
}
