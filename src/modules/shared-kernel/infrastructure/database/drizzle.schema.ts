import {
  accountSchema,
  authenticationSessionSchema,
  sessionSchema,
  userSchema,
  verificationSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import { outboxMessageSchema } from "@packages/outbox/infrastructure/database/drizzle.schema.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

export const SharedKernelDatabaseSchema = {
  account: accountSchema,
  authenticationSessions: authenticationSessionSchema,
  outboxMessages: outboxMessageSchema,
  session: sessionSchema,
  user: userSchema,
  verification: verificationSchema,
};

export type SharedKernelDatabaseSchema = typeof SharedKernelDatabaseSchema;

export type SharedKernelDatabase =
  NodePgDatabase<SharedKernelDatabaseSchema> & {
    $client: Pool;
  };
