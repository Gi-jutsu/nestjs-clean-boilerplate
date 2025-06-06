import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '@shared-kernel/infrastructure/decorators/public.decorator.js';
import { SignUpWithCredentialsHttpRequestBody } from './http.request.js';
import { SignUpWithCredentialsUseCase } from './use-case.js';

@Controller()
export class SignUpWithCredentialsHttpController {
  constructor(private readonly useCase: SignUpWithCredentialsUseCase) {}

  @HttpCode(HttpStatus.CREATED)
  @Public()
  @Post('/auth/sign-up')
  async handle(@Body() body: SignUpWithCredentialsHttpRequestBody) {
    return await this.useCase.execute({
      email: body.email,
      password: body.password,
    });
  }
}
