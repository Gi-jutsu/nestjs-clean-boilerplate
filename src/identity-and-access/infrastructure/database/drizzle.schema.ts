import { Transaction } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';

export const accountSchema = pgTable(
  'accounts',
  {
    id: uuid('id')
      .$defaultFn(() => randomUUID())
      .primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    isEmailVerified: boolean('is_email_verified').notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('emailUniqueIndex').on(sql`lower(${table.email})`)],
);

export const ForgotPasswordRequestSchema = pgTable(
  'forgot_password_requests',
  {
    id: uuid('id')
      .$defaultFn(() => randomUUID())
      .primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accountSchema.id),
    token: varchar('token', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_unique_account_forgot_password_request').on(
      table.accountId,
    ),
  ],
);

export type IdentityAndAccessDatabase = NodePgDatabase<{
  accounts: typeof accountSchema;
}>;

export type IdentityAndAccessDatabaseTransaction = Transaction<
  TransactionalAdapterDrizzleOrm<IdentityAndAccessDatabase>
>;
