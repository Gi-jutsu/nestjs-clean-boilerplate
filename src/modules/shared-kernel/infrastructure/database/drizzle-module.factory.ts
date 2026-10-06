import { SharedKernelEnvironmentKeys } from "@modules/shared-kernel/environment.js";
import { SharedKernelDatabaseSchema } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { ConfigService } from "@nestjs/config";
import type {
  DrizzleModuleAsyncOptions,
  DrizzleModuleFactoryOptions,
} from "@nestjs/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";

export function createSharedKernelDrizzleModuleOptions(): DrizzleModuleAsyncOptions<
  unknown,
  typeof drizzle
> {
  return {
    inject: [ConfigService],
    useFactory: createSharedKernelDatabaseOptions,
  };
}

function createSharedKernelDatabaseOptions(
  config: ConfigService,
): DrizzleModuleFactoryOptions<unknown, typeof drizzle> {
  const connectionString = config.getOrThrow(
    SharedKernelEnvironmentKeys.DATABASE_URL,
  );

  return {
    drizzle,
    connection: connectionString,
    schema: SharedKernelDatabaseSchema,
  };
}
