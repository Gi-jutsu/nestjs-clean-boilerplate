import { Transaction } from '@nestjs-cls/transactional';
import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';

export const outboxMessageSchema = pgTable(
  'outbox_messages',
  {
    id: uuid('id')
      .$defaultFn(() => randomUUID())
      .primaryKey(),
    eventType: varchar('event_type').notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    errorMessage: varchar('error_message'),
  },
  (table) => [
    index('idx_outbox_messages_unprocessed')
      .on(table.occurredAt, table.processedAt)
      // @FIXME PostgreSQL 'INCLUDE' is not supported by drizzle-orm
      // @see https://github.com/drizzle-team/drizzle-orm/issues/2972
      .where(isNull(table.processedAt)),
  ],
);

export type SharedKernelDatabase = NodePgDatabase<{
  outboxMessages: typeof outboxMessageSchema;
}>;

export type SharedKernelDatabaseTransaction = Transaction<
  TransactionalAdapterDrizzleOrm<SharedKernelDatabase>
>;
