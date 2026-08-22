import { SharedKernelEnvironmentKeys } from "@modules/shared-kernel/environment.js";
import { SharedKernelDatabaseSchema } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { ConfigService } from "@nestjs/config";
import type {
  DrizzleModuleAsyncOptions,
  DrizzleModuleOptions,
} from "@packages/nest-drizzle/index.js";

export function createSharedKernelDrizzleModuleOptions(): DrizzleModuleAsyncOptions {
  return {
    inject: [ConfigService],
    useFactory: createSharedKernelDatabaseOptions,
  };
}

function createSharedKernelDatabaseOptions(
  config: ConfigService,
): DrizzleModuleOptions {
  const connectionString = config.getOrThrow(
    SharedKernelEnvironmentKeys.DATABASE_URL,
  );

  return {
    connectionString,
    schema: SharedKernelDatabaseSchema,
  };
}
