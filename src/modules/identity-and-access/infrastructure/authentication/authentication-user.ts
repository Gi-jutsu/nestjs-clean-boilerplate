import type { userSchema } from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";

export type AuthenticationUser = typeof userSchema.$inferSelect;

declare module "@nestjs/authentication" {
  interface AuthenticationTypes {
    user: AuthenticationUser;
  }
}
