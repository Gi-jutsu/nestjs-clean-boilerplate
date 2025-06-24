import type { BrandedInjectionToken } from '@core/types/index.js';

export const DrizzlePostgresPoolToken = Symbol(
  'DrizzlePostgresPool',
) as BrandedInjectionToken<any>;
