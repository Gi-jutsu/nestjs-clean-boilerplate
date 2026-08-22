import { Public } from "@modules/shared-kernel/infrastructure/decorators/public.decorator.js";
import { HealthCheckUseCase } from "@modules/shared-kernel/use-cases/health-check/health-check.use-case.js";
import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthCheckHttpController {
  constructor(private readonly useCase: HealthCheckUseCase) {}

  @Public()
  @Get("/health-check")
  async handle() {
    return await this.useCase.execute();
  }
}
