import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";
import type { DrizzlePostgresDatabase } from "@api/drizzle-module/schema.js";

export const DrizzlePostgresPoolToken = Symbol(
  "DrizzlePostgresPool",
) as BrandedInjectionToken<DrizzlePostgresDatabase>;
