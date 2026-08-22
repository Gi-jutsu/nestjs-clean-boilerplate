import {
  accountSchema,
  sessionSchema,
  userSchema,
  verificationSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import { outboxMessageSchema } from "@packages/outbox/infrastructure/database/drizzle.schema.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export const SharedKernelDatabaseSchema = {
  account: accountSchema,
  outboxMessages: outboxMessageSchema,
  session: sessionSchema,
  user: userSchema,
  verification: verificationSchema,
};

export type SharedKernelDatabaseSchema = typeof SharedKernelDatabaseSchema;

export type SharedKernelDatabase = NodePgDatabase<SharedKernelDatabaseSchema>;
