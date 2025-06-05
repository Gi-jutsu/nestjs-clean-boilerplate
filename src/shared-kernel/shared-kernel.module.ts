import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { createFactoryFromConstructor } from "@shared-kernel/utils/create-factory-from-constructor.js";
import { EnvironmentKeys, EnvironmentSchema } from "./environment.js";
import { DomainEventPublisherToken } from "./domain/ports/domain-event-publisher.port.js";
import { EventEmitterToken } from "./domain/ports/event-emitter.port.js";
import { MailerToken } from "./domain/ports/mailer.port.js";
import { OutboxMessageRepositoryToken } from "./domain/outbox-message/repository.js";
import { ConsoleMailer } from "./infrastructure/console-mailer.adapter.js";
import { CorrelationIdMiddleware } from "./infrastructure/correlation-id.middleware.js";
import { DrizzlePostgresPoolToken } from "./infrastructure/drizzle/constants.js";
import { DrizzleModule } from "./infrastructure/drizzle/module.js";
import { DrizzleOutboxMessageRepository } from "./infrastructure/repositories/drizzle-outbox-message.repository.js";
import { HttpLoggerInterceptor } from "./infrastructure/http-logger.interceptor.js";
import { MapErrorToRfc9457HttpException } from "./infrastructure/map-error-to-rfc9457-http-exception.interceptor.js";
import { OutboxDomainEventPublisher } from "./infrastructure/outbox-domain-event-publisher.adapter.js";
import { HealthCheckHttpController } from "./use-cases/health-check/http.controller.js";
import { ProcessOutboxMessagesScheduler } from "./use-cases/process-outbox-messages/scheduler.js";
import { ProcessOutboxMessagesUseCase } from "./use-cases/process-outbox-messages/use-case.js";

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE = 100;

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
    {
      provide: DomainEventPublisherToken,
      useFactory: createFactoryFromConstructor(OutboxDomainEventPublisher),
      inject: [OutboxMessageRepositoryToken],
    },
    {
      provide: OutboxMessageRepositoryToken,
      useFactory: createFactoryFromConstructor(DrizzleOutboxMessageRepository),
      inject: [DrizzlePostgresPoolToken],
    },
    {
      provide: EventEmitterToken,
      useValue: (await import('@nestjs/event-emitter')).EventEmitter2,
    },
    {
      provide: MailerToken,
      useClass: ConsoleMailer,
    },
    {
      provide: ProcessOutboxMessagesScheduler,
      useFactory: createFactoryFromConstructor(ProcessOutboxMessagesScheduler),
      inject: [ConfigService, ProcessOutboxMessagesUseCase],
    },
    {
      provide: ProcessOutboxMessagesUseCase,
      useFactory: createFactoryFromConstructor(ProcessOutboxMessagesUseCase),
      inject: [OutboxMessageRepositoryToken, EventEmitter2],
    },
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
