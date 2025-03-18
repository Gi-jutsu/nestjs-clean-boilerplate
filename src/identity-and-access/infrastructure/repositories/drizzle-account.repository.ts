import { Account } from '@identity-and-access/domain/account/aggregate-root.js';
import type { AccountRepository } from '@identity-and-access/domain/account/repository.js';
import {
  accountSchema,
  type IdentityAndAccessDatabase,
} from '@identity-and-access/infrastructure/database/drizzle.schema.js';
import type { DomainEventPublisher } from '@shared-kernel/domain/ports/domain-event-publisher.port.js';
import { count, eq } from 'drizzle-orm';

export class DrizzleAccountRepository implements AccountRepository {
  constructor(
    private readonly database: IdentityAndAccessDatabase,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async findByEmail(email: string) {
    const [snapshot] = await this.database
      .select()
      .from(accountSchema)
      .where(eq(accountSchema.email, email))
      .limit(1);

    if (!snapshot) return null;

    return Account.fromSnapshot(snapshot);
  }

  async isEmailTaken(email: string) {
    const [snapshot] = await this.database
      .select({
        count: count(),
      })
      .from(accountSchema)
      .where(eq(accountSchema.email, email))
      .limit(1);

    return snapshot.count > 0;
  }

  async save(account: Account) {
    const snapshot = account.snapshot();

    await this.database
      .insert(accountSchema)
      .values(snapshot)
      .onConflictDoUpdate({
        target: [accountSchema.id],
        set: snapshot,
      });

    await this.domainEventPublisher.publish(account);
  }
}
