import type { BrandedInjectionToken } from '@core/types/branded-injection-token.js';
import type { Account } from './aggregate-root.js';

export interface AccountRepository {
  isEmailTaken(email: string): Promise<boolean>;
  findByEmail(email: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
}

export const AccountRepositoryToken = Symbol(
  'AccountRepository',
) as BrandedInjectionToken<AccountRepository>;
