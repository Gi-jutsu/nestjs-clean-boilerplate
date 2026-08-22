import type { Provider } from "@nestjs/common";
import { DrizzlePostgresDatabaseFactory } from "@packages/nest-drizzle/providers/drizzle-postgres-database.factory.js";
import { DrizzlePostgresPoolToken } from "@packages/nest-drizzle/tokens/drizzle-postgres-pool.token.js";

export const DrizzlePostgresPoolProvider: Provider = {
  provide: DrizzlePostgresPoolToken,
  useFactory: createDrizzlePostgresDatabase,
  inject: [DrizzlePostgresDatabaseFactory],
};

function createDrizzlePostgresDatabase(
  databaseFactory: DrizzlePostgresDatabaseFactory,
) {
  return databaseFactory.createDatabase();
}
