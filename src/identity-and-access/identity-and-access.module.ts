import { DrizzlePostgresPoolToken } from '@core/nestjs/drizzle-module/constants.js';
import { createProvider } from '@core/nestjs/utils/create-provider.js';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DomainEventPublisherToken } from '@shared-kernel/domain/ports/domain-event-publisher.port.js';
import { MailerToken } from '@shared-kernel/domain/ports/mailer.port.js';
import { AccountRepositoryToken } from './domain/account/repository.js';
import { ForgotPasswordRequestRepositoryToken } from './domain/forgot-password-request/repository.js';
import { JwtServiceToken } from './domain/ports/jwt-service.port.js';
import { PasswordHasherToken } from './domain/ports/password-hasher.port.js';
import { AuthenticationGuard } from './infrastructure/guards/authentication.guard.js';
import { DrizzleAccountRepository } from './infrastructure/repositories/drizzle-account.repository.js';
import { DrizzleForgotPasswordRequestRepository } from './infrastructure/repositories/drizzle-forgot-password-request.repository.js';
import { GetLoggedInAccountHttpController } from './queries/get-logged-in-account/http.controller.js';
import { GetLoggedInAccountQueryHandler } from './queries/get-logged-in-account/query-handler.js';
import { ForgotPasswordHttpController } from './use-cases/forgot-password/http.controller.js';
import { ForgotPasswordUseCase } from './use-cases/forgot-password/use-case.js';
import { SendForgotPasswordEmailDomainEventController } from './use-cases/send-forgot-password-email/domain-event.controller.js';
import { SendForgotPasswordEmailUseCase } from './use-cases/send-forgot-password-email/use-case.js';
import { SignInWithCredentialsHttpController } from './use-cases/sign-in-with-credentials/http.controller.js';
import { SignInWithCredentialsUseCase } from './use-cases/sign-in-with-credentials/use-case.js';
import { SignUpWithCredentialsHttpController } from './use-cases/sign-up-with-credentials/http.controller.js';
import { SignUpWithCredentialsUseCase } from './use-cases/sign-up-with-credentials/use-case.js';

@Module({
  controllers: [
    /** Queries */
    GetLoggedInAccountHttpController,

    /** Use cases */
    ForgotPasswordHttpController,
    SignInWithCredentialsHttpController,
    SignUpWithCredentialsHttpController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },

    /** Domain events controllers */
    SendForgotPasswordEmailDomainEventController,

    /** Repositories */
    createProvider(
      DrizzleAccountRepository,
      [DrizzlePostgresPoolToken, DomainEventPublisherToken],
      AccountRepositoryToken,
    ),

    createProvider(
      DrizzleForgotPasswordRequestRepository,
      [DrizzlePostgresPoolToken, DomainEventPublisherToken],
      ForgotPasswordRequestRepositoryToken,
    ),

    /** Ports */
    {
      provide: JwtServiceToken,
      useFactory: async (config: ConfigService) => {
        const { sign, verify } = (await import('jsonwebtoken')).default;

        const secret = config.getOrThrow('JWT_SECRET');

        return {
          sign: (payload: Record<string, unknown>) => sign(payload, secret),
          verify: (token: string) => verify(token, secret),
        };
      },
      inject: [ConfigService],
    },
    {
      provide: PasswordHasherToken,
      useValue: (await import('bcrypt')).default,
    },

    /** Query handlers */
    createProvider(GetLoggedInAccountQueryHandler, [DrizzlePostgresPoolToken]),

    /** Use cases */
    createProvider(ForgotPasswordUseCase, [
      AccountRepositoryToken,
      ForgotPasswordRequestRepositoryToken,
    ]),

    createProvider(SendForgotPasswordEmailUseCase, [
      ConfigService,
      MailerToken,
    ]),

    createProvider(SignInWithCredentialsUseCase, [
      AccountRepositoryToken,
      JwtServiceToken,
      PasswordHasherToken,
    ]),

    createProvider(SignUpWithCredentialsUseCase, [
      AccountRepositoryToken,
      PasswordHasherToken,
    ]),
  ],
})
export class IdentityAndAccessModule {}
