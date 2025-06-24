import { ForgotPasswordRequest } from '@identity-and-access/domain/forgot-password-request/aggregate-root.js';
import type { ForgotPasswordRequestRepository } from '@identity-and-access/domain/forgot-password-request/repository.js';
import {
  ForgotPasswordRequestSchema,
  type IdentityAndAccessDatabaseTransaction,
} from '@identity-and-access/infrastructure/database/drizzle.schema.js';
import type { DomainEventPublisher } from '@shared-kernel/domain/ports/domain-event-publisher.port.js';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

export class DrizzleForgotPasswordRequestRepository
  implements ForgotPasswordRequestRepository
{
  constructor(
    private readonly database: IdentityAndAccessDatabaseTransaction,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async findByAccountId(accountId: string) {
    const [record] = await this.database
      .select()
      .from(ForgotPasswordRequestSchema)
      .where(eq(ForgotPasswordRequestSchema.accountId, accountId))
      .limit(1)
      .execute();

    if (!record) {
      return null;
    }

    return ForgotPasswordRequest.fromSnapshot({
      accountId: record.accountId,
      expiresAt: DateTime.fromJSDate(record.expiresAt),
      id: record.id,
      token: record.token,
    });
  }

  async save(request: ForgotPasswordRequest) {
    // @todo(dev-ux): consider getting rid of DateTime when possible to ease the integration with the ORM
    const snapshotWithJsDate = {
      ...request.snapshot(),
      expiresAt: request.properties.expiresAt.toJSDate(),
    };

    await this.database
      .insert(ForgotPasswordRequestSchema)
      .values(snapshotWithJsDate)
      .onConflictDoUpdate({
        target: [ForgotPasswordRequestSchema.id],
        set: snapshotWithJsDate,
      });

    await this.domainEventPublisher.publish(request);
  }
}
