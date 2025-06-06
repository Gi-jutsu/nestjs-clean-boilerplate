import { Controller, Get } from '@nestjs/common';
import { Public } from '@shared-kernel/infrastructure/decorators/public.decorator.js';
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
