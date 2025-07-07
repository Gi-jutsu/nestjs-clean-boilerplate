import { EnvironmentKeys, EnvironmentSchema } from '@core/environment.js';
import { DrizzlePostgresPoolToken } from '@core/nestjs/drizzle-module/constants.js';
import { DrizzleModule } from '@core/nestjs/drizzle-module/module.js';
import { CorrelationIdMiddleware } from '@core/nestjs/middlewares/correlation-id.middleware.js';
import { createNestProvider } from '@core/nestjs/utils/create-nest-provider.js';
import { BrandedInjectionToken } from '@core/types/index.js';
import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpLoggerInterceptor } from '../core/nestjs/interceptors/http-logger.interceptor.js';
import { MapErrorToRfc9457HttpException } from '../core/nestjs/interceptors/map-error-to-rfc9457-http-exception.interceptor.js';
import { OutboxMessageRepositoryToken } from './domain/outbox-message/repository.js';
import { DomainEventPublisherToken } from './domain/ports/domain-event-publisher.port.js';
import { MailerToken } from './domain/ports/mailer.port.js';
import { ConsoleMailer } from './infrastructure/console-mailer.adapter.js';
import { OutboxDomainEventPublisher } from './infrastructure/outbox-domain-event-publisher.adapter.js';
import { DrizzleOutboxMessageRepository } from './infrastructure/repositories/drizzle-outbox-message.repository.js';
import { HealthCheckHttpController } from './use-cases/health-check/http.controller.js';
import { HealthCheckUseCase } from './use-cases/health-check/use-case.js';
import { ProcessOutboxMessagesDomainEventController } from './use-cases/process-outbox-messages/domain-event.controller.js';
import { ProcessOutboxMessagesUseCase } from './use-cases/process-outbox-messages/use-case.js';

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE = 100;

const NodeJsProcessToken = Symbol(
  'Process',
) as BrandedInjectionToken<NodeJS.Process>;

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: EnvironmentSchema.parse,
    }),
    DrizzleModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connectionString: config.getOrThrow(EnvironmentKeys.DATABASE_URL),
      }),
    }),
    EventEmitterModule.forRoot({ global: true }),
    ThrottlerModule.forRoot([
      {
        ttl: ONE_MINUTE_IN_MILLISECONDS,
        limit: MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE,
      },
    ]),
  ],
  controllers: [HealthCheckHttpController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MapErrorToRfc9457HttpException,
    },

    /** DomainEvent Controllers */
    ProcessOutboxMessagesDomainEventController,

    /** Infrastructure */

    {
      provide: NodeJsProcessToken,
      useValue: process,
    },
    {
      provide: MailerToken,
      useClass: ConsoleMailer,
    },

    /** Use Cases */

    createNestProvider(
      OutboxDomainEventPublisher,
      [OutboxMessageRepositoryToken, EventEmitter2],
      DomainEventPublisherToken,
    ),

    createNestProvider(
      DrizzleOutboxMessageRepository,
      [DrizzlePostgresPoolToken],
      OutboxMessageRepositoryToken,
    ),

    createNestProvider(HealthCheckUseCase, [
      DrizzlePostgresPoolToken,
      NodeJsProcessToken,
    ]),

    createNestProvider(ProcessOutboxMessagesUseCase, [
      OutboxMessageRepositoryToken,
      EventEmitter2,
    ]),
  ],
  exports: [
    DomainEventPublisherToken,
    DrizzleModule,
    MailerToken,
    OutboxMessageRepositoryToken,
  ],
})
export class SharedKernelModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
