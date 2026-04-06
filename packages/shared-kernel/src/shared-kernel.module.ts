import type { BrandedInjectionToken } from "./types/branded-injection-token.js";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { OutboxMessageRepositoryToken } from "./domain/outbox-message/repository.js";
import { DomainEventPublisherToken } from "./domain/ports/domain-event-publisher.port.js";
import { MailerToken } from "./domain/ports/mailer.port.js";
import { ConsoleMailer } from "./infrastructure/console-mailer.adapter.js";
import { OutboxDomainEventPublisher } from "./infrastructure/outbox-domain-event-publisher.adapter.js";
import { DrizzleOutboxMessageRepository } from "./infrastructure/repositories/drizzle-outbox-message.repository.js";
import { HealthCheckHttpController } from "./use-cases/health-check/http.controller.js";
import { HealthCheckUseCase } from "./use-cases/health-check/use-case.js";
import { ProcessOutboxMessagesDomainEventController } from "./use-cases/process-outbox-messages/domain-event.controller.js";
import { ProcessOutboxMessagesUseCase } from "./use-cases/process-outbox-messages/use-case.js";
import { DrizzleModule } from "./infrastructure/drizzle-module/module.js";
import { DrizzlePostgresPoolToken } from "./infrastructure/drizzle-module/constants.js";
import { EnvironmentKeys, EnvironmentSchema } from "./environment.js";
import { createNestProvider } from "./create-nest-provider.js";

const NodeJsProcessToken = Symbol(
  "Process",
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
  ],
  controllers: [HealthCheckHttpController],
  providers: [
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
export class SharedKernelModule {}
