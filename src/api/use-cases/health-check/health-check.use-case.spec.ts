import { HealthCheckUseCase } from "@api/use-cases/health-check/health-check.use-case.js";
import { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { describe, expect, it, vitest } from "vitest";

// Based on https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check#name-releaseid
describe("HealthCheckUseCase", () => {
  it("should report PostgreSQL as available", async () => {
    const system = createSystemUnderTest();

    system.given.postgresqlIsAvailable();
    await system.when.healthCheckIsPerformed();
    system.then.healthCheckShouldReportPostgresqlStatus("pass");
  });

  it("should report PostgreSQL as unavailable", async () => {
    const system = createSystemUnderTest();

    system.given.postgresqlIsUnavailable();
    await system.when.healthCheckIsPerformed();
    system.then.healthCheckShouldReportPostgresqlStatus("fail");
  });

  it("should return the current uptime", async () => {
    const system = createSystemUnderTest();

    await system.when.healthCheckIsPerformed();

    system.then.healthCheckShouldReportCurrentUptime();
  });
});

function createSystemUnderTest() {
  const mockedDatabase = {
    execute: vitest.fn(),
  };

  const mockedProcess = {
    uptime: vitest.fn(() => 0),
  };

  const useCase = new HealthCheckUseCase(
    mockedDatabase as unknown as SharedKernelDatabase,
    mockedProcess as unknown as NodeJS.Process,
  );

  let output: Awaited<ReturnType<HealthCheckUseCase["execute"]>>;

  return {
    given: {
      postgresqlIsAvailable() {
        mockedDatabase.execute.mockResolvedValue([]);
      },
      postgresqlIsUnavailable() {
        mockedDatabase.execute.mockRejectedValue(
          new Error("PostgreSQL connection failed"),
        );
      },
    },
    when: {
      async healthCheckIsPerformed() {
        output = await useCase.execute();
      },
    },
    then: {
      healthCheckShouldReportPostgresqlStatus(status: "pass" | "fail") {
        expect(output).toMatchObject({
          status: "pass",
          checks: {
            postgresql: {
              status,
            },
          },
        });
      },
      healthCheckShouldReportCurrentUptime() {
        expect(output).toMatchObject({
          status: "pass",
          checks: {
            uptime: [
              {
                componentType: "system",
                observedValue: mockedProcess.uptime(),
                observedUnit: "s",
                status: "pass",
              },
            ],
          },
        });
      },
    },
  };
}
