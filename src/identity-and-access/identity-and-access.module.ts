import { createFactoryFromConstructor } from '@shared-kernel/utils/create-factory-from-constructor.js';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxMessageRepositoryToken } from '@shared-kernel/domain/outbox-message/repository.js';
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
    {
      provide: AccountRepositoryToken,
      useFactory: createFactoryFromConstructor(DrizzleAccountRepository),
      inject: [DrizzlePostgresPoolToken, DomainEventPublisherToken],
    },
    {
      provide: ForgotPasswordRequestRepositoryToken,
      useFactory: createFactoryFromConstructor(DrizzleForgotPasswordRequestRepository),
      inject: [DrizzlePostgresPoolToken, DomainEventPublisherToken],
    },

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
    {
      provide: GetLoggedInAccountQueryHandler,
      useFactory: createFactoryFromConstructor(GetLoggedInAccountQueryHandler),
      inject: [DrizzlePostgresPoolToken],
    },

    /** Use cases */
    {
      provide: ForgotPasswordUseCase,
      useFactory: createFactoryFromConstructor(ForgotPasswordUseCase),
      inject: [
        AccountRepositoryToken,
        ForgotPasswordRequestRepositoryToken,
        OutboxMessageRepositoryToken,
      ],
    },
    {
      provide: SendForgotPasswordEmailUseCase,
      useFactory: createFactoryFromConstructor(SendForgotPasswordEmailUseCase),
      inject: [ConfigService, MailerToken],
    },
    {
      provide: SignInWithCredentialsUseCase,
      useFactory: createFactoryFromConstructor(SignInWithCredentialsUseCase),
      inject: [AccountRepositoryToken, JwtServiceToken, PasswordHasherToken],
    },
    {
      provide: SignUpWithCredentialsUseCase,
      useFactory: createFactoryFromConstructor(SignUpWithCredentialsUseCase),
      inject: [AccountRepositoryToken, PasswordHasherToken],
    },
  ],
})
export class IdentityAndAccessModule {}
