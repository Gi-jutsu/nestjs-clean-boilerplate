import { DrizzlePostgresPoolToken as NestDrizzlePostgresPoolToken } from "@packages/nest-drizzle/index.js";
import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";

export const DrizzlePostgresPoolToken =
  NestDrizzlePostgresPoolToken as BrandedInjectionToken<SharedKernelDatabase>;
