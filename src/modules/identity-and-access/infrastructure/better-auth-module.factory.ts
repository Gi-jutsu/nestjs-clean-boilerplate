import { ConfigService } from "@nestjs/config";
import { IdentityAndAccessEnvironmentKeys } from "@modules/identity-and-access/environment.js";
import * as schema from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import { SharedKernelEnvironmentKeys } from "@shared-kernel/environment.js";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

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
  const databaseUrl = config.getOrThrow(
    SharedKernelEnvironmentKeys.DATABASE_URL,
  );
  const baseURL = config.getOrThrow(
    IdentityAndAccessEnvironmentKeys.BETTER_AUTH_URL,
  );

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
