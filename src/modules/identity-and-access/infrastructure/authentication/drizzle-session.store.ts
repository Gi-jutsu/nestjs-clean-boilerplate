import { Injectable } from "@nestjs/common";
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from "@nestjs/authentication";
import { InjectDrizzle } from "@nestjs/drizzle";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { authenticationSessionSchema } from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import { and, eq, lt } from "drizzle-orm";

@Injectable()
export class DrizzleSessionStore implements SessionStore {
  constructor(
    @InjectDrizzle() private readonly database: SharedKernelDatabase,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string) {
    const [session] = await this.database
      .select()
      .from(authenticationSessionSchema)
      .where(eq(authenticationSessionSchema.id, id));
    return session ? toSessionRecord(session) : undefined;
  }

  async createSession(record: SessionRecord) {
    await this.database.insert(authenticationSessionSchema).values(record);
  }

  async touchSession(id: string, lastActiveAt: Date) {
    await this.database
      .update(authenticationSessionSchema)
      .set({ lastActiveAt })
      .where(
        and(
          eq(authenticationSessionSchema.id, id),
          lt(authenticationSessionSchema.lastActiveAt, lastActiveAt),
        ),
      );
  }

  async deleteSession(id: string) {
    const deleted = await this.database
      .delete(authenticationSessionSchema)
      .where(eq(authenticationSessionSchema.id, id))
      .returning({ id: authenticationSessionSchema.id });
    return deleted.length > 0;
  }

  async listUserSessions(userId: string) {
    const sessions = await this.database
      .select()
      .from(authenticationSessionSchema)
      .where(eq(authenticationSessionSchema.userId, userId));
    return sessions.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string) {
    await this.database
      .delete(authenticationSessionSchema)
      .where(eq(authenticationSessionSchema.userId, userId));
  }
}

function toSessionRecord(
  row: typeof authenticationSessionSchema.$inferSelect,
): SessionRecord {
  const { metadata, mfa, ...session } = row;
  return {
    ...session,
    ...(metadata === null ? {} : { metadata }),
    ...(mfa === null ? {} : { mfa }),
  };
}
