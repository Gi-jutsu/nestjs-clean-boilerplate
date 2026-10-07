import type { AuthenticationUser } from "./authentication-user.js";
import {
  accountSchema,
  userSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

@Injectable()
export class DrizzleUsersRepository {
  constructor(
    @InjectDrizzle() private readonly database: SharedKernelDatabase,
  ) {}

  async findById(id: string): Promise<AuthenticationUser | null> {
    const [user] = await this.database
      .select()
      .from(userSchema)
      .where(eq(userSchema.id, id));
    return user ?? null;
  }

  async findByEmail(email: string): Promise<AuthenticationUser | null> {
    const [user] = await this.database
      .select()
      .from(userSchema)
      .where(sql`lower(${userSchema.email}) = ${normalizeEmail(email)}`);
    return user ?? null;
  }

  async findCredentials(email: string) {
    const [credentials] = await this.database
      .select({ user: userSchema, passwordHash: accountSchema.password })
      .from(userSchema)
      .innerJoin(
        accountSchema,
        and(
          eq(accountSchema.userId, userSchema.id),
          eq(accountSchema.providerId, "credential"),
        ),
      )
      .where(sql`lower(${userSchema.email}) = ${normalizeEmail(email)}`);
    return credentials ?? null;
  }

  async create(
    name: string,
    email: string,
    passwordHash: string,
  ): Promise<AuthenticationUser> {
    const id = randomUUID();
    const now = new Date();

    try {
      return await this.database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(userSchema)
          .values({
            id,
            name,
            email: normalizeEmail(email),
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await transaction.insert(accountSchema).values({
          id: randomUUID(),
          accountId: id,
          userId: id,
          providerId: "credential",
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        });
        return user;
      });
    } catch (error) {
      if (postgresErrorCode(error) === "23505") throw emailAlreadyRegistered();
      throw error;
    }
  }

  async updatePasswordHash(
    userId: string,
    previousHash: string,
    passwordHash: string,
  ) {
    await this.database
      .update(accountSchema)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(
        and(
          eq(accountSchema.userId, userId),
          eq(accountSchema.providerId, "credential"),
          eq(accountSchema.password, previousHash),
        ),
      );
  }
}

export function emailAlreadyRegistered() {
  return new UnprocessableEntityException({
    code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    message: "User already exists. Use another email.",
  });
}

function normalizeEmail(email: string) {
  return email.trim().normalize("NFC").toLowerCase();
}

function postgresErrorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error) return error.code;
  return "cause" in error ? postgresErrorCode(error.cause) : undefined;
}
