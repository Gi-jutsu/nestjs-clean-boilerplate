import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIGURATION_SERVICE_TOKEN } from '@nestjs/config/dist/config.constants.js';
import { MailerToken } from '@shared-kernel/domain/ports/mailer.port.js';
import { AccountRepositoryToken } from './domain/account/repository.js';
import { ForgotPasswordRequestRepositoryToken } from './domain/forgot-password-request/repository.js';
import { JwtServiceToken } from './domain/ports/jwt-service.port.js';
import { PasswordHasherToken } from './domain/ports/password-hasher.port.js';
import { DrizzleAccountRepository } from './infrastructure/repositories/drizzle-account.repository.js';
import { DrizzleForgotPasswordRequestRepository } from './infrastructure/repositories/drizzle-forgot-password-request.repository.js';
import { ForgotPasswordHttpController } from './use-cases/forgot-password/http.controller.js';
import { ForgotPasswordUseCase } from './use-cases/forgot-password/use-case.js';
import { SendForgotPasswordEmailDomainEventController } from './use-cases/send-forgot-password-email/domain-event.controller.js';
import { SendForgotPasswordEmailUseCase } from './use-cases/send-forgot-password-email/use-case.js';
import { SignInWithCredentialsHttpController } from './use-cases/sign-in-with-credentials/http.controller.js';
import { SignInWithCredentialsUseCase } from './use-cases/sign-in-with-credentials/use-case.js';
import { SignUpWithCredentialsHttpController } from './use-cases/sign-up-with-credentials/http.controller.js';
import { SignUpWithCredentialsUseCase } from './use-cases/sign-up-with-credentials/use-case.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './infrastructure/guards/authentication.guard.js';
import { GetLoggedInAccountHttpController } from './queries/get-logged-in-account/http.controller.js';
import { GetLoggedInAccountQueryHandler } from './queries/get-logged-in-account/query-handler.js';
import { DrizzlePostgresPoolToken } from '@shared-kernel/infrastructure/drizzle/constants.js';
import { DomainEventPublisherToken } from '@shared-kernel/domain/ports/domain-event-publisher.port.js';
import {
  BrandedInjectionToken,
  createNestProvider,
} from '@shared-kernel/utils/create-nest-provider.js';

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
    createNestProvider(
      DrizzleAccountRepository,
      [DrizzlePostgresPoolToken, DomainEventPublisherToken],
      AccountRepositoryToken,
    ),

    createNestProvider(
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
    createNestProvider(GetLoggedInAccountQueryHandler, [
      DrizzlePostgresPoolToken,
    ]),

    /** Use cases */
    createNestProvider(ForgotPasswordUseCase, [
      AccountRepositoryToken,
      ForgotPasswordRequestRepositoryToken,
    ]),

    createNestProvider(SendForgotPasswordEmailUseCase, [
      ConfigService as unknown as BrandedInjectionToken<ConfigService>,
      MailerToken,
    ]),

    createNestProvider(SignInWithCredentialsUseCase, [
      AccountRepositoryToken,
      JwtServiceToken,
      PasswordHasherToken,
    ]),

    createNestProvider(SignUpWithCredentialsUseCase, [
      AccountRepositoryToken,
      PasswordHasherToken,
    ]),
  ],
})
export class IdentityAndAccessModule {}
