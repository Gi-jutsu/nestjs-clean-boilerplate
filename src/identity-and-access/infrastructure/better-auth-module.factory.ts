import { EnvironmentKeys } from "@core/environment.js";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./database/drizzle.schema.js";

export function createBetterAuthModule() {
  return AuthModule.forRootAsync({
    inject: [ConfigService],
    useFactory: useBetterAuthFactory,
  });
}

function useBetterAuthFactory(config: ConfigService) {
  return { auth: createBetterAuth(config) };
}

function createBetterAuth(config: ConfigService) {
  const databaseUrl = config.getOrThrow(EnvironmentKeys.DATABASE_URL);
  const baseURL = config.getOrThrow(EnvironmentKeys.BETTER_AUTH_URL);

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const client = drizzle(pool);

  return betterAuth({
    baseURL,
    emailAndPassword: {
      enabled: true,
    },
    database: drizzleAdapter(client, {
      provider: "pg",
      schema,
    }),
  });
}
