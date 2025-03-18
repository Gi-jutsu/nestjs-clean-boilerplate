import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ForgotPasswordHttpRequestBody } from './http.request.js';
import { ForgotPasswordUseCase } from './use-case.js';
import { Public } from '@shared-kernel/infrastructure/decorators/public.decorator.js';

@Controller()
export class ForgotPasswordHttpController {
  constructor(private readonly useCase: ForgotPasswordUseCase) {}

  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  @Post('/auth/forgot-password')
  async handle(@Body() body: ForgotPasswordHttpRequestBody) {
    return await this.useCase.execute(body);
  }
}
