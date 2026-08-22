import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";

export const DrizzlePostgresPoolToken = Symbol(
  "DrizzlePostgresPool",
) as BrandedInjectionToken<any>;
