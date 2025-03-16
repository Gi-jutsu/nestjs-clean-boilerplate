import { Account } from "@identity-and-access/domain/account/aggregate-root.js";
import type { AccountRepository } from "@identity-and-access/domain/account/repository.js";
import type { DomainEventPublisher } from "@shared-kernel/domain/ports/domain-event-publisher.port.js";

export class InMemoryAccountRepository implements AccountRepository {
  snapshots = new Map();

  constructor(private readonly domainEventPublisher: DomainEventPublisher) {}

  async findByEmail(email: string) {
    for (const [id, properties] of this.snapshots.entries()) {
      if (properties.email !== email) continue;

      return Account.fromSnapshot({
        id,
        ...properties,
      });
    }

    return null;
  }

  async isEmailTaken(email: string) {
    return Array.from(this.snapshots.values()).some(
      (properties) => properties.email === email
    );
  }

  async save(account: Account) {
    this.snapshots.set(account.id, account.properties);
    await this.domainEventPublisher.publish(account);
  }
}
