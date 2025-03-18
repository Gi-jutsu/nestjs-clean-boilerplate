import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/identity-and-access/infrastructure/database/drizzle.schema.ts',
    './src/shared-kernel/infrastructure/database/drizzle.schema.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
