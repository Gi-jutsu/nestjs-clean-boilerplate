import type { BrandedInjectionToken } from '@shared-kernel/utils/create-nest-provider.js';
import type { Account } from './aggregate-root.js';

export interface AccountRepository {
  isEmailTaken(email: string): Promise<boolean>;
  findByEmail(email: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
}

export const AccountRepositoryToken = Symbol('AccountRepository') as BrandedInjectionToken<AccountRepository>;
