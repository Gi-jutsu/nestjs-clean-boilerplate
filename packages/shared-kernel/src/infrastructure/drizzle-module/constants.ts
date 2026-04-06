import type { BrandedInjectionToken } from "@shared-kernel/types/branded-injection-token.js";

export const DrizzlePostgresPoolToken = Symbol(
  "DrizzlePostgresPool",
) as BrandedInjectionToken<any>;
