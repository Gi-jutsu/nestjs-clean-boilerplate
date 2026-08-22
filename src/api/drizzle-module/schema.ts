import {
  account,
  session,
  user,
  verification,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import { outboxMessageSchema } from "@packages/outbox/infrastructure/database/drizzle.schema.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export const DrizzlePostgresSchema = {
  account,
  outboxMessages: outboxMessageSchema,
  session,
  user,
  verification,
};

export type DrizzlePostgresSchema = typeof DrizzlePostgresSchema;

export type DrizzlePostgresDatabase = NodePgDatabase<DrizzlePostgresSchema>;
