import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./database/drizzle.schema.js";

export function createBetterAuth(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const client = drizzle(pool);

  return betterAuth({
    emailAndPassword: {
      enabled: true,
    },
    database: drizzleAdapter(client, {
      provider: "pg",
      schema,
    }),
  });
}
