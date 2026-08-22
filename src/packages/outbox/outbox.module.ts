import {
  Module,
  type DynamicModule,
  type ModuleMetadata,
} from "@nestjs/common";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import {
  createNestProvider,
  type BrandedInjectionToken,
} from "@packages/nest-provider-factory/index.js";
import { OutboxMessageRepositoryToken } from "@packages/outbox/domain/outbox-message.repository.js";
import { DomainEventPublisherToken } from "@packages/outbox/domain/ports/domain-event-publisher.port.js";
import { EventEmitterToken } from "@packages/outbox/domain/ports/event-emitter.port.js";
import type { OutboxDatabase } from "@packages/outbox/infrastructure/database/drizzle.schema.js";
import { OutboxDomainEventPublisher } from "@packages/outbox/infrastructure/outbox-domain-event-publisher.adapter.js";
import { DrizzleOutboxMessageRepository } from "@packages/outbox/infrastructure/repositories/drizzle-outbox-message.repository.js";
import { ProcessOutboxMessagesDomainEventController } from "@packages/outbox/use-cases/process-outbox-messages/domain-event.controller.js";
import { ProcessOutboxMessagesUseCase } from "@packages/outbox/use-cases/process-outbox-messages/use-case.js";

export interface OutboxModuleOptions {
  databaseToken: BrandedInjectionToken<OutboxDatabase>;
  imports?: ModuleMetadata["imports"];
}

@Module({})
export class OutboxModule {
  static register(options: OutboxModuleOptions): DynamicModule {
    return {
      module: OutboxModule,
      imports: [
        EventEmitterModule.forRoot({ global: true }),
        ...(options.imports ?? []),
      ],
      providers: [
        ProcessOutboxMessagesDomainEventController,
        {
          provide: EventEmitterToken,
          useExisting: EventEmitter2,
        },
        createNestProvider(
          OutboxDomainEventPublisher,
          [OutboxMessageRepositoryToken, EventEmitterToken],
          DomainEventPublisherToken,
        ),
        createNestProvider(
          DrizzleOutboxMessageRepository,
          [options.databaseToken],
          OutboxMessageRepositoryToken,
        ),
        createNestProvider(ProcessOutboxMessagesUseCase, [
          OutboxMessageRepositoryToken,
          EventEmitterToken,
        ]),
      ],
      exports: [DomainEventPublisherToken, OutboxMessageRepositoryToken],
    };
  }
}
