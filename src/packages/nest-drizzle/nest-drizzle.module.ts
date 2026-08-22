import { Global, Module } from "@nestjs/common";
import { DrizzlePostgresDatabaseFactory } from "@packages/nest-drizzle/providers/drizzle-postgres-database.factory.js";
import { DrizzlePostgresPoolProvider } from "@packages/nest-drizzle/providers/drizzle-postgres-pool.provider.js";
import { DrizzlePostgresPoolToken } from "@packages/nest-drizzle/tokens/drizzle-postgres-pool.token.js";
import { ConfigurableModuleClass } from "./nest-drizzle-module.definition.js";

@Global()
@Module({
  providers: [DrizzlePostgresDatabaseFactory, DrizzlePostgresPoolProvider],
  exports: [DrizzlePostgresPoolToken],
})
export class DrizzleModule extends ConfigurableModuleClass {}
