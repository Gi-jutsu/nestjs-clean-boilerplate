import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { Outbox, OutboxStorage } from "@nestjs/outbox";
import { fromDrizzle, PostgresOutboxStore } from "@nestjs/outbox/postgres";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { DomainEventPublisherToken } from "@packages/outbox/index.js";
import { OutboxDomainEventPublisher } from "@packages/outbox/infrastructure/outbox-domain-event-publisher.adapter.js";

export const outboxProviders = [
  {
    provide: PostgresOutboxStore,
    inject: [SharedKernelDatabaseToken, OutboxStorage],
    useFactory: (database: SharedKernelDatabase, storage: OutboxStorage) =>
      new PostgresOutboxStore(
        { executor: fromDrizzle(database), migrate: false },
        storage,
      ),
  },
  createNestProvider(
    OutboxDomainEventPublisher,
    [Outbox],
    DomainEventPublisherToken,
  ),
];
