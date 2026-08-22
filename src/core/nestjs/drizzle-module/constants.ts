import type { BrandedInjectionToken } from "@packages/nest-provider-factory";

export const DrizzlePostgresPoolToken = Symbol(
  "DrizzlePostgresPool",
) as BrandedInjectionToken<any>;
