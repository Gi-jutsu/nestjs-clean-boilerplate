import { Controller, Get, Inject } from '@nestjs/common';
import { SharedKernelDatabase } from '@shared-kernel/infrastructure/database/drizzle.schema.js';
import { Public } from '@shared-kernel/infrastructure/decorators/public.decorator.js';
import { DrizzlePostgresPoolToken } from '@shared-kernel/infrastructure/drizzle/constants.js';
import { sql } from 'drizzle-orm';
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
