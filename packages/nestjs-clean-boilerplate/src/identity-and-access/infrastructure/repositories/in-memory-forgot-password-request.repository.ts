import { ForgotPasswordRequest } from '@identity-and-access/domain/forgot-password-request/aggregate-root.js';
import type { ForgotPasswordRequestRepository } from '@identity-and-access/domain/forgot-password-request/repository.js';
import type { DomainEventPublisher } from '@shared-kernel/domain/ports/domain-event-publisher.port.js';

export class InMemoryForgotPasswordRequestRepository
  implements ForgotPasswordRequestRepository
{
  snapshots = new Map();

  constructor(private readonly domainEventPublisher: DomainEventPublisher) {}

  async findByAccountId(accountId: string) {
    for (const [id, properties] of this.snapshots.entries()) {
      if (properties.accountId !== accountId) continue;

      return ForgotPasswordRequest.fromSnapshot({
        id,
        accountId: properties.accountId,
        expiresAt: properties.expiresAt,
        token: properties,
      });
    }

    return null;
  }

  async save(entity: ForgotPasswordRequest) {
    this.snapshots.set(entity.id, entity.properties);
    await this.domainEventPublisher.publish(entity);
  }
}
