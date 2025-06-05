import { BrandedInjectionToken } from '@shared-kernel/utils/create-nest-provider.js';

export const DrizzlePostgresPoolToken = Symbol(
  'DrizzlePostgresPool',
) as BrandedInjectionToken<any>;
