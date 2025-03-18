import { Controller, Get } from '@nestjs/common';
import { Public } from '@shared-kernel/infrastructure/decorators/public.decorator.js';

@Controller()
export class HealthCheckHttpController {
  @Public()
  @Get('/health-check')
  async handle() {}
}
