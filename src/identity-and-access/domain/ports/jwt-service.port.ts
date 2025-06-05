import type { BrandedInjectionToken } from '@shared-kernel/utils/create-nest-provider.js';

export interface JwtService {
  sign(payload: Record<string, unknown>): string;
  verify(token: string): Record<string, unknown>;
}

export const JwtServiceToken = Symbol(
  'JwtService',
) as BrandedInjectionToken<JwtService>;
