import { Public } from '@core/nestjs/decorators/public.decorator.js';
import { Controller, Get } from '@nestjs/common';
import { HealthCheckUseCase } from './use-case.js';

@Controller()
export class HealthCheckHttpController {
  constructor(private readonly useCase: HealthCheckUseCase) {}

  @Public()
  @Get('/health-check')
  async handle() {
    return await this.useCase.execute();
  }
}
