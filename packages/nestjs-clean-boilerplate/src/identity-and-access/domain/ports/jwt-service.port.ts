import type { BrandedInjectionToken } from '@core/types/index.js';

export interface JwtService {
  sign(payload: Record<string, unknown>): string;
  verify(token: string): Record<string, unknown>;
}

export const JwtServiceToken = Symbol(
  'JwtService',
) as BrandedInjectionToken<JwtService>;
