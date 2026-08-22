import type { BrandedInjectionToken } from "@core/types/branded-injection-token.js";

export const DrizzlePostgresPoolToken = Symbol(
  "DrizzlePostgresPool",
) as BrandedInjectionToken<any>;
