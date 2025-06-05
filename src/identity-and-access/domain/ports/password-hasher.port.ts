import type { BrandedInjectionToken } from '@shared-kernel/utils/create-nest-provider.js';

export interface PasswordHasher {
  compare(plain: string, hashed: string): Promise<boolean>;
  hash(password: string, saltOrRounds: string | number): Promise<string>;
}

export const PasswordHasherToken = Symbol(
  'PasswordHasher',
) as BrandedInjectionToken<PasswordHasher>;
