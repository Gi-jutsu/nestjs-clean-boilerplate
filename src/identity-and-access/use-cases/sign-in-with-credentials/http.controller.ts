import { Public } from '@core/nestjs/decorators/public.decorator.js';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SignInWithCredentialsHttpRequestBody } from './http.request.js';
import { SignInWithCredentialsUseCase } from './use-case.js';

@Controller()
export class SignInWithCredentialsHttpController {
  constructor(private readonly useCase: SignInWithCredentialsUseCase) {}

  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  @Post('/auth/sign-in')
  async handle(
    @Body() body: SignInWithCredentialsHttpRequestBody,
    @Res() response: Response,
  ) {
    const { accessToken } = await this.useCase.execute({
      email: body.email,
      password: body.password,
    });

    response.cookie('token', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
    });

    response.end();
  }
}
