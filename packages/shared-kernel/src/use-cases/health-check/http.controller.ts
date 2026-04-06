import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { Controller, Get } from "@nestjs/common";
import { HealthCheckUseCase } from "./use-case.js";

@Controller()
export class HealthCheckHttpController {
  constructor(private readonly useCase: HealthCheckUseCase) {}

  @AllowAnonymous()
  @Get("/health-check")
  async handle() {
    return await this.useCase.execute();
  }
}
