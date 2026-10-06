import { ConfigService } from "@nestjs/config";
import { IdentityAndAccessEnvironmentKeys } from "@modules/identity-and-access/environment.js";
import {
  accountSchema,
  sessionSchema,
  userSchema,
  verificationSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { getDrizzleToken } from "@nestjs/drizzle";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const BetterAuthDatabaseSchema = {
  account: accountSchema,
  session: sessionSchema,
  user: userSchema,
  verification: verificationSchema,
};

export function createBetterAuthModule() {
  return AuthModule.forRootAsync({
    imports: [SharedKernelDatabaseModule],
    inject: [ConfigService, getDrizzleToken()],
    useFactory: useBetterAuthFactory,
  });
}

function useBetterAuthFactory(
  config: ConfigService,
  database: SharedKernelDatabase,
) {
  return { auth: createBetterAuth(config, database) };
}

function createBetterAuth(
  config: ConfigService,
  database: SharedKernelDatabase,
) {
  const baseURL = config.getOrThrow(
    IdentityAndAccessEnvironmentKeys.BETTER_AUTH_URL,
  );

  return betterAuth({
    baseURL,
    emailAndPassword: {
      enabled: true,
    },
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: BetterAuthDatabaseSchema,
    }),
  });
}
