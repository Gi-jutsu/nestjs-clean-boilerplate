import type { BrandedInjectionToken } from '@core/types/index.js';
import type { ForgotPasswordRequest } from './aggregate-root.js';

export interface ForgotPasswordRequestRepository {
  findByAccountId: (accountId: string) => Promise<ForgotPasswordRequest | null>;
  save: (request: ForgotPasswordRequest) => Promise<void>;
}

export const ForgotPasswordRequestRepositoryToken = Symbol(
  'ForgotPasswordRequestRepository',
) as BrandedInjectionToken<ForgotPasswordRequestRepository>;
