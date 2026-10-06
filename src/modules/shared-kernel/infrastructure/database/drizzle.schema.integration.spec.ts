import { preparePostgresSqlDatabase } from "../../../../../specs/bootstrap-postgres-sql-database.util.js";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

describe("Disposable PostgreSQL schema preparation", () => {
  let database: Awaited<ReturnType<typeof createDatabaseFixture>>;

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

  beforeEach(async () => {
    database = await createDatabaseFixture();
    onTestFinished(() => database.close());
  });
});

function createSystemUnderTest(
  database: Awaited<ReturnType<typeof createDatabaseFixture>>,
) {
  let preparationError: unknown;

  async function insertUser() {
    await database.client.query(
      'INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, false, now(), now())',
      [database.userId, "Schema User", `${database.userId}@example.com`],
    );
  }

  return {
    async givenApplicationAndConsumerData() {
      await insertUser();
      await database.client.query(
        `CREATE TABLE "${database.publicTable}" (id text PRIMARY KEY); INSERT INTO "${database.publicTable}" VALUES ('order-1')`,
      );
      await database.client.query(
        `CREATE SCHEMA "${database.privateSchema}"; CREATE TABLE "${database.privateSchema}".orders (id text PRIMARY KEY); INSERT INTO "${database.privateSchema}".orders VALUES ('private-order-1')`,
      );
    },
    async givenApplicationDataInAnAdditionalColumn() {
      await insertUser();
      await database.client.query(
        `ALTER TABLE "user" ADD COLUMN "${database.userColumn}" text`,
      );
      await database.client.query(
        `UPDATE "user" SET "${database.userColumn}" = $1 WHERE id = $2`,
        ["Owned value", database.userId],
      );
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
        (
          await database.client.query('SELECT id FROM "user" WHERE id = $1', [
            database.userId,
          ])
        ).rows,
      ).toEqual([{ id: database.userId }]);
      expect(
        (
          await database.client.query(
            `SELECT id FROM "${database.publicTable}"`,
          )
        ).rows,
      ).toEqual([{ id: "order-1" }]);
      expect(
        (
          await database.client.query(
            `SELECT id FROM "${database.privateSchema}".orders`,
          )
        ).rows,
      ).toEqual([{ id: "private-order-1" }]);
    },
    async thenTheApplicationDataIsPreserved() {
      const { rows } = await database.client.query(
        `SELECT "${database.userColumn}" AS value FROM "user" WHERE id = $1`,
        [database.userId],
      );
      expect(rows).toEqual([{ value: "Owned value" }]);
    },
  };
}

async function createDatabaseFixture() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("The test database URL is missing");
  const client = new pg.Client({ connectionString: url });
  const suffix = randomUUID().replaceAll("-", "");
  const userId = `schema-user-${suffix}`;
  const publicTable = `schema_fixture_orders_${suffix}`;
  const privateSchema = `schema_fixture_private_${suffix}`;
  const userColumn = `schema_fixture_column_${suffix}`;

  try {
    await client.connect();
  } catch (error) {
    await client.end();
    throw error;
  }

  return {
    client,
    url,
    userId,
    publicTable,
    privateSchema,
    userColumn,
    async close() {
      try {
        await client.query(`
          ALTER TABLE "user" DROP COLUMN IF EXISTS "${userColumn}";
          DROP TABLE IF EXISTS "${publicTable}";
          DROP SCHEMA IF EXISTS "${privateSchema}" CASCADE;
        `);
        await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
      } finally {
        await client.end();
      }
    },
  };
}
