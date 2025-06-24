import { OutboxMessage } from '@shared-kernel/domain/outbox-message/aggregate-root.js';
import type { OutboxMessageRepository } from '@shared-kernel/domain/outbox-message/repository.js';
import {
  outboxMessageSchema,
  SharedKernelDatabaseTransaction,
} from '@shared-kernel/infrastructure/database/drizzle.schema.js';
import { inArray, sql } from 'drizzle-orm';

export class DrizzleOutboxMessageRepository implements OutboxMessageRepository {
  constructor(private readonly database: SharedKernelDatabaseTransaction) {}

  async findUnprocessedMessages() {
    return await this.database.transaction(async (trx) => {
      // @see https://www.ibm.com/docs/en/informix-servers/14.10?topic=level-repeatable-read-isolation
      await trx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;`);

      // Pull unprocessed messages that are due for processing
      const snapshots = await trx.execute(sql`
        SELECT * FROM "outbox_messages"
        WHERE occurred_at <= NOW() AND processed_at IS NULL
        FOR UPDATE SKIP LOCKED;
      `);

      // Mark the pulled messages as processed to prevent concurrent processing
      await trx
        .update(outboxMessageSchema)
        .set({ processedAt: sql`NOW()` })
        .where(
          inArray(
            outboxMessageSchema.id,
            snapshots.rows.map((s) => String(s.id)),
          ),
        );

      return snapshots.rows.map((s) =>
        OutboxMessage.fromSnapshot({
          errorMessage: s.error_message as string | null,
          eventType: s.event_type as string,
          id: s.id as string,
          payload: s.payload as Record<string, unknown>,
          processedAt: s.processed_at as Date | null,
        }),
      );
    });
  }

  async save(messages: OutboxMessage[]) {
    const snapshots = messages.map((message) => message.snapshot());

    await this.database
      .insert(outboxMessageSchema)
      .values(snapshots)
      .onConflictDoUpdate({
        target: outboxMessageSchema.id,
        set: {
          processedAt: sql`NOW()`,
        },
      });
  }
}
