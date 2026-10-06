import { getDrizzleToken } from "@nestjs/drizzle";
import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";

export const SharedKernelDatabaseToken: BrandedInjectionToken<SharedKernelDatabase> =
  getDrizzleToken() as BrandedInjectionToken<SharedKernelDatabase>;
