import { ApplicationModule } from "@api/application.module.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { SharedKernelDatabaseSchema } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import supertest, { type Response } from "supertest";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

describe("HealthCheckHttpController", () => {
  let healthCheckApplication: Awaited<
    ReturnType<typeof createTestingHealthCheckApplication>
  >;

  it("reports a healthy PostgreSQL database without authentication", async () => {
    const systemUnderTest = createSystemUnderTest(healthCheckApplication);

    await systemUnderTest.whenTheHealthCheckIsRequested();

    systemUnderTest.thenTheRequestHasStatus(200);
    systemUnderTest.thenPostgreSQLIsHealthy();
  });

  it("answers within the health deadline when the database pool is busy", async () => {
    const systemUnderTest = createSystemUnderTest(healthCheckApplication);
    await systemUnderTest.givenAllDatabaseConnectionsAreBusy();

    await systemUnderTest.whenTheHealthCheckIsRequested();

    systemUnderTest.thenTheRequestHasStatus(503);
    systemUnderTest.thenPostgreSQLIsUnavailable();
    systemUnderTest.thenTheHealthDeadlineIsRespected();
  });

  beforeEach(async () => {
    healthCheckApplication = await createTestingHealthCheckApplication();
    onTestFinished(() => healthCheckApplication.close());
  });
});

function createSystemUnderTest(
  healthCheckApplication: Awaited<
    ReturnType<typeof createTestingHealthCheckApplication>
  >,
) {
  let response: Response;
  let responseTime: number;

  return {
    givenAllDatabaseConnectionsAreBusy() {
      return healthCheckApplication.reserveDatabaseConnection();
    },

    async whenTheHealthCheckIsRequested() {
      const startedAt = performance.now();
      response = await supertest(
        healthCheckApplication.application.getHttpServer(),
      ).get("/health-check");
      responseTime = performance.now() - startedAt;
    },

    thenTheRequestHasStatus(status: number) {
      expect(response.status).toBe(status);
    },

    thenTheHealthDeadlineIsRespected() {
      expect(responseTime).toBeLessThan(2_000);
    },

    thenPostgreSQLIsHealthy() {
      expect(response.body.details.postgresql.status).toBe("up");
    },

    thenPostgreSQLIsUnavailable() {
      expect(response.body.details.postgresql.status).toBe("down");
    },
  };
}

async function createTestingHealthCheckApplication() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  const database = drizzle(pool, { schema: SharedKernelDatabaseSchema });
  const testingModule = await Test.createTestingModule({
    imports: [ApplicationModule],
  })
    .overrideProvider(SharedKernelDatabaseToken)
    .useValue(database)
    .compile()
    .catch(async (error: unknown) => {
      await pool.end();
      throw error;
    });

  const application = testingModule.createNestApplication({
    bodyParser: false,
    logger: false,
  });
  try {
    configureHttpApplication(application);
    await application.init();
  } catch (error) {
    try {
      await application.close();
    } finally {
      if (!pool.ended) await pool.end();
    }
    throw error;
  }

  let databaseClosed = false;
  let releaseDatabaseConnection = () => {};

  async function closeDatabase() {
    if (!databaseClosed && !pool.ended) {
      databaseClosed = true;
      await pool.end();
    }
  }

  return {
    application,
    closeDatabase,
    async reserveDatabaseConnection() {
      const connection = await pool.connect();
      releaseDatabaseConnection = () => connection.release();
    },
    async close() {
      releaseDatabaseConnection();
      try {
        await application.close();
      } finally {
        await closeDatabase();
      }
    },
  };
}
