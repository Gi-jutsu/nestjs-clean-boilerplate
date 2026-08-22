import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import type { ApplicationRuntimePort } from "@modules/shared-kernel/ports/application-runtime.port.js";

export class HealthCheckUseCase {
  constructor(
    private readonly database: SharedKernelDatabase,
    private readonly runtime: ApplicationRuntimePort,
  ) {}

  async execute() {
    const isPostgresqlAvailable = await this.isPostgresqlAvailable();

    return {
      status: "pass",
      checks: {
        postgresql: {
          status: isPostgresqlAvailable ? "pass" : "fail",
        },
        uptime: [
          {
            componentType: "system",
            observedValue: this.runtime.uptime(),
            observedUnit: "s",
            status: "pass",
          },
        ],
      },
    };
  }

  private async isPostgresqlAvailable() {
    try {
      await this.database.execute("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
