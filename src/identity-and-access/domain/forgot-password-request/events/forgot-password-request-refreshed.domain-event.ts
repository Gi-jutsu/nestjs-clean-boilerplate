import type { ForgotPasswordRequest } from '@identity-and-access/domain/forgot-password-request/aggregate-root.js';
import { DomainEvent } from '@shared-kernel/domain/primitives/domain-event.js';

export class ForgotPasswordRequestRefreshedDomainEvent extends DomainEvent<
  Pick<ForgotPasswordRequest['properties'], 'accountId' | 'expiresAt' | 'token'>
> {}
