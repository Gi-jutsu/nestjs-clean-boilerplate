import { DrizzlePostgresPoolToken } from "@api/drizzle-module/constants.js";
import { DrizzleModule } from "@api/drizzle-module/module.js";
import { HttpLoggerInterceptor } from "@api/interceptors/http-logger.interceptor.js";
import { MapErrorToRfc9457HttpException } from "@api/interceptors/map-error-to-rfc9457-http-exception.interceptor.js";
import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { OutboxMessageRepositoryToken } from "@shared-kernel/domain/outbox-message/repository.js";
import { DomainEventPublisherToken } from "@shared-kernel/domain/ports/domain-event-publisher.port.js";
import { MailerToken } from "@shared-kernel/domain/ports/mailer.port.js";
import { SharedKernelEnvironmentKeys } from "@shared-kernel/environment.js";
import { ConsoleMailer } from "@shared-kernel/infrastructure/console-mailer.adapter.js";
import { OutboxDomainEventPublisher } from "@shared-kernel/infrastructure/outbox-domain-event-publisher.adapter.js";
import { DrizzleOutboxMessageRepository } from "@shared-kernel/infrastructure/repositories/drizzle-outbox-message.repository.js";
import { ProcessOutboxMessagesDomainEventController } from "@shared-kernel/use-cases/process-outbox-messages/domain-event.controller.js";
import { ProcessOutboxMessagesUseCase } from "@shared-kernel/use-cases/process-outbox-messages/use-case.js";

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE = 100;

@Global()
@Module({
  imports: [
    DrizzleModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connectionString: config.getOrThrow(
          SharedKernelEnvironmentKeys.DATABASE_URL,
        ),
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
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
