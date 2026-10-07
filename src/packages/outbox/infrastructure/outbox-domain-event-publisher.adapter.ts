import { AggregateRoot } from "@packages/domain-driven-design/index.js";
import { Outbox } from "@nestjs/outbox";
import type { DomainEventPublisher } from "@packages/outbox/domain/ports/domain-event-publisher.port.js";
import type { DatabaseTransaction } from "@packages/outbox/infrastructure/database/drizzle.schema.js";

export class OutboxDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly outbox: Outbox<DatabaseTransaction>) {}

  async publish<Properties extends Record<keyof Properties, unknown>>(
    entity: AggregateRoot<Properties>,
    transaction: DatabaseTransaction,
  ): Promise<void> {
    const events = entity.pullDomainEvents();
    if (events.length === 0) {
      return;
    }

    await this.outbox.add(
      transaction,
      events.map((event) => ({
        id: event.id,
        topic: event.type,
        payload: event.payload,
        key: entity.id,
      })),
    );
  }
}
