import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/identity-and-access/infrastructure/drizzle/schema.ts",
    "./src/shared-kernel/infrastructure/drizzle/schema.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
