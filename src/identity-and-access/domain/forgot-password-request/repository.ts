import type { ForgotPasswordRequest } from './aggregate-root.js';

export interface ForgotPasswordRequestRepository {
  findByAccountId: (accountId: string) => Promise<ForgotPasswordRequest | null>;
  save: (request: ForgotPasswordRequest) => Promise<void>;
}

export const ForgotPasswordRequestRepositoryToken = Symbol('ForgotPasswordRequestRepository');
