import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { HealthIndicatorService } from "@nestjs/terminus";
import { sql } from "drizzle-orm";

const DATABASE_CHECK_TIMEOUT_IN_MILLISECONDS = 1_000;

export class DrizzleHealthIndicator {
  constructor(
    private readonly database: SharedKernelDatabase,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  check() {
    return this.healthIndicator
      .check("postgresql")
      .attempt(async () => {
        await this.database.execute(sql`SELECT 1`);
      })
      .withTimeout(DATABASE_CHECK_TIMEOUT_IN_MILLISECONDS);
  }
}
