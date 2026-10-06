import { preparePostgresSqlDatabase } from "../../../../../specs/bootstrap-postgres-sql-database.util.js";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";
import { z } from "zod";

const executeFile = promisify(execFile);
const require = createRequire(import.meta.url);
const DRIZZLE_CLI = join(dirname(require.resolve("drizzle-kit")), "bin.cjs");
const JournalSchema = z.object({
  entries: z.array(
    z.object({
      tag: z.string(),
      idx: z.number(),
      when: z.number(),
      version: z.string(),
      breakpoints: z.boolean(),
    }),
  ),
});

describe(
  "Disposable PostgreSQL schema preparation",
  { timeout: 30_000 },
  () => {
    let database: Awaited<ReturnType<typeof createDisposableDatabase>>;

    it("preserves existing application data and unrelated tables when repeated", async () => {
      const systemUnderTest = createSystemUnderTest(database);
      await systemUnderTest.givenApplicationAndConsumerData();

      await systemUnderTest.whenTheSchemaIsPrepared();
      await systemUnderTest.whenTheSchemaIsPrepared();

      systemUnderTest.thenPreparationSucceeds();
      await systemUnderTest.thenApplicationAndConsumerDataArePreserved();
    });

    it("refuses data loss before changing application-owned columns", async () => {
      const systemUnderTest = createSystemUnderTest(database);
      await systemUnderTest.givenApplicationDataInAnAdditionalColumn();

      await systemUnderTest.whenTheSchemaIsPrepared();

      systemUnderTest.thenPreparationIsRefused();
      await systemUnderTest.thenTheApplicationDataIsPreserved();
    });

    it("generates later starter changes after consumer migrations without replacing their history", async () => {
      const systemUnderTest = createSystemUnderTest(database);
      await systemUnderTest.givenAnApplicationOwnedInitialMigration();
      await systemUnderTest.givenAConsumerOwnedCustomMigration();

      await systemUnderTest.whenTheStarterSchemaAddsAnIssuer();

      await systemUnderTest.thenExistingHistoryIsUnchanged();
      await systemUnderTest.thenTheSchemaAndConsumerDataArePreserved();
      await systemUnderTest.thenGeneratingAgainAddsNoMigration();
    });

    beforeEach(async () => {
      database = await createDisposableDatabase();
      onTestFinished(() => database.close());
    });
  },
);

function createSystemUnderTest(
  database: Awaited<ReturnType<typeof createDisposableDatabase>>,
) {
  let preparationError: unknown;

  return {
    ...createMigrationWorkflow(database),
    async givenApplicationAndConsumerData() {
      await preparePostgresSqlDatabase(database.url);
      await insertUser(database.client);
      await database.client.query(
        "CREATE TABLE consumer_orders (id text PRIMARY KEY); INSERT INTO consumer_orders VALUES ('order-1')",
      );
      await database.client.query(
        "CREATE SCHEMA consumer_private; CREATE TABLE consumer_private.orders (id text PRIMARY KEY); INSERT INTO consumer_private.orders VALUES ('private-order-1')",
      );
    },
    async givenApplicationDataInAnAdditionalColumn() {
      await preparePostgresSqlDatabase(database.url);
      await insertUser(database.client);
      await database.client.query(
        'ALTER TABLE "user" ADD COLUMN application_owned text',
      );
      await database.client.query('UPDATE "user" SET application_owned = $1', [
        "Owned value",
      ]);
    },
    async whenTheSchemaIsPrepared() {
      try {
        await preparePostgresSqlDatabase(database.url);
      } catch (error) {
        preparationError = error;
      }
    },
    thenPreparationIsRefused() {
      expect(preparationError).toMatchObject({
        message:
          "Refusing test database schema changes that may lose data or require review.",
      });
    },
    thenPreparationSucceeds() {
      expect(preparationError).toBeUndefined();
    },
    async thenApplicationAndConsumerDataArePreserved() {
      expect(
        (await database.client.query('SELECT id FROM "user"')).rows,
      ).toEqual([{ id: "schema-user" }]);
      expect(
        (await database.client.query("SELECT id FROM consumer_orders")).rows,
      ).toEqual([{ id: "order-1" }]);
      expect(
        (await database.client.query("SELECT id FROM consumer_private.orders"))
          .rows,
      ).toEqual([{ id: "private-order-1" }]);
    },
    async thenTheApplicationDataIsPreserved() {
      const { rows } = await database.client.query(
        'SELECT application_owned FROM "user" WHERE id = $1',
        ["schema-user"],
      );
      expect(rows).toEqual([{ application_owned: "Owned value" }]);
    },
  };
}

function createMigrationWorkflow(
  database: Awaited<ReturnType<typeof createDisposableDatabase>>,
) {
  const schemaFile = join(database.workspace, "application.schema.ts");
  const migrationsFolder = join(database.workspace, "migrations");
  let existingFiles: Map<string, string>;
  let existingJournal: z.infer<typeof JournalSchema>;

  async function journal() {
    return JournalSchema.parse(
      JSON.parse(
        await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
      ),
    );
  }

  async function generate(name: string, custom = false, changes = true) {
    await executeFile(
      process.execPath,
      [
        DRIZZLE_CLI,
        "generate",
        "--dialect=postgresql",
        `--schema=${schemaFile}`,
        // Drizzle Kit 0.31 prefixes snapshot paths with './' on subsequent runs.
        `--out=${relative(process.cwd(), migrationsFolder)}`,
        `--name=${name}`,
        ...(custom ? ["--custom"] : []),
      ],
      { timeout: 10_000 },
    );
    const latest = (await journal()).entries.at(-1);
    if (!latest || (changes && !latest.tag.endsWith(`_${name}`))) {
      throw new Error(
        `Drizzle did not generate the requested migration: ${name}`,
      );
    }
    return join(migrationsFolder, `${latest.tag}.sql`);
  }

  async function writeSchema(issuer: boolean) {
    await writeFile(
      schemaFile,
      `import { pgTable, text } from ${JSON.stringify(require.resolve("drizzle-orm/pg-core"))};
export const accounts = pgTable("application_accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ${issuer ? 'issuer: text("issuer"),' : ""}
});
`,
    );
  }

  async function applyMigrations() {
    await migrate(drizzle(database.client), { migrationsFolder });
  }

  return {
    async givenAnApplicationOwnedInitialMigration() {
      await writeSchema(false);
      await generate("initial");
      await applyMigrations();
      await database.client.query(
        "INSERT INTO application_accounts (id, email) VALUES ($1, $2)",
        ["legacy-account", "legacy@example.com"],
      );
    },
    async givenAConsumerOwnedCustomMigration() {
      const customFile = await generate("consumer_orders", true);
      await writeFile(
        customFile,
        "CREATE TABLE consumer_orders (id text PRIMARY KEY);\n--> statement-breakpoint\nINSERT INTO consumer_orders VALUES ('consumer-order-1');\n",
      );
      await applyMigrations();
      existingJournal = await journal();
      existingFiles = new Map();
      for (const file of await readdir(migrationsFolder, { recursive: true })) {
        if (file.endsWith(".sql") || file.endsWith("_snapshot.json")) {
          existingFiles.set(
            file,
            await readFile(join(migrationsFolder, file), "utf8"),
          );
        }
      }
    },
    async whenTheStarterSchemaAddsAnIssuer() {
      await writeSchema(true);
      await generate("starter_issuer");
      await applyMigrations();
    },
    async thenExistingHistoryIsUnchanged() {
      for (const [file, contents] of existingFiles) {
        expect(await readFile(join(migrationsFolder, file), "utf8")).toBe(
          contents,
        );
      }
      expect((await journal()).entries.slice(0, 2)).toEqual(
        existingJournal.entries,
      );
      expect((await journal()).entries).toHaveLength(3);
    },
    async thenTheSchemaAndConsumerDataArePreserved() {
      expect(
        (
          await database.client.query(
            "SELECT id, email, issuer FROM application_accounts",
          )
        ).rows,
      ).toEqual([
        { id: "legacy-account", email: "legacy@example.com", issuer: null },
      ]);
      expect(
        (await database.client.query("SELECT id FROM consumer_orders")).rows,
      ).toEqual([{ id: "consumer-order-1" }]);
    },
    async thenGeneratingAgainAddsNoMigration() {
      const before = await journal();
      await generate("unchanged", false, false);
      expect(await journal()).toEqual(before);
    },
  };
}

async function insertUser(client: pg.Client) {
  await client.query(
    'INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, false, now(), now())',
    ["schema-user", "Schema User", "schema@example.com"],
  );
}

async function createDisposableDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("The test database URL is missing");
  const admin = new pg.Client({ connectionString });
  const name = `schema_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  const workspace = await mkdtemp(join(tmpdir(), "application-migrations-"));
  let created = false;

  async function close() {
    try {
      await client.end();
    } finally {
      try {
        if (created) {
          await admin.query(`DROP DATABASE "${name}"`);
          created = false;
        }
      } finally {
        try {
          await admin.end();
        } finally {
          await rm(workspace, { recursive: true, force: true });
        }
      }
    }
  }

  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await client.connect();
  } catch (error) {
    await close();
    throw error;
  }
  return {
    client,
    workspace,
    url: url.toString(),
    close,
  };
}
