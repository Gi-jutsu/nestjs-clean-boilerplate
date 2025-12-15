import { SharedKernelDatabase } from "@shared-kernel/infrastructure/database/drizzle.schema.js";
import { describe, expect, it, vitest } from "vitest";
import { HealthCheckUseCase } from "./use-case.js";

// Based on https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check#name-releaseid
describe("HealthCheckUseCase", () => {
  it.skip.each`
    isPostgresqlAvailable | status
    ${true}               | ${"pass"}
    ${false}              | ${"fail"}
  `(
    "should return $status when PostgreSQL availability is $isPostgresqlAvailable",
    async ({ isPostgresqlAvailable, status }) => {
      // Given
      const { setPostgresAvailable, setPostgresUnavailable, useCase } =
        createSystemUnderTest();

      isPostgresqlAvailable ? setPostgresAvailable() : setPostgresUnavailable();

      // When
      const result = await useCase.execute();

      // Then
      expect(result).toMatchObject({
        status: "pass",
        checks: {
          postgresql: {
            status,
          },
        },
      });
    },
  );

  it("should return the current uptime", async () => {
    // Given
    const { getMockedUptime, useCase } = createSystemUnderTest();

    // When
    const output = await useCase.execute();

    // Then
    expect(output).toMatchObject({
      status: "pass",
      checks: {
        uptime: [
          {
            componentType: "system",
            observedValue: getMockedUptime(),
            observedUnit: "s",
            status: "pass",
          },
        ],
      },
    });
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

  const getMockedUptime = () => {
    return mockedProcess.uptime();
  };

  const setPostgresAvailable = () => {
    mockedDatabase.execute.mockResolvedValue([]);
  };

  const setPostgresUnavailable = () => {
    mockedDatabase.execute.mockRejectedValue(
      new Error("PostgreSQL connection failed"),
    );
  };

  return {
    useCase,
    getMockedUptime,
    setPostgresAvailable,
    setPostgresUnavailable,
  };
}
