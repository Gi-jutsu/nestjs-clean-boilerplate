import { Public } from "@modules/shared-kernel/infrastructure/decorators/public.decorator.js";
import { DrizzleHealthIndicator } from "@modules/shared-kernel/infrastructure/health/drizzle-health.indicator.js";
import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

@Controller()
export class HealthCheckHttpController {
  constructor(
    private readonly healthCheck: HealthCheckService,
    private readonly database: DrizzleHealthIndicator,
  ) {}

  @Public()
  @Get("/health-check")
  @HealthCheck()
  handle() {
    return this.healthCheck.check([() => this.database.check()]);
  }
}
