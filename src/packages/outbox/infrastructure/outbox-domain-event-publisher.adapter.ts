import { AggregateRoot } from "@packages/domain-driven-design/index.js";
import { OutboxMessage } from "@packages/outbox/domain/outbox-message.js";
import { OutboxMessagesQueuedDomainEvent } from "@packages/outbox/domain/outbox-messages-queued.domain-event.js";
import type { OutboxMessageRepository } from "@packages/outbox/domain/outbox-message.repository.js";
import type { DomainEventPublisher } from "@packages/outbox/domain/ports/domain-event-publisher.port.js";
import type { EventEmitter } from "@packages/outbox/domain/ports/event-emitter.port.js";
import type { DatabaseTransaction } from "@packages/outbox/infrastructure/database/drizzle.schema.js";

export class OutboxDomainEventPublisher implements DomainEventPublisher {
  constructor(
    private readonly allOutboxMessages: OutboxMessageRepository,
    private readonly eventEmitter: EventEmitter,
  ) {}

  async publish(
    entity: AggregateRoot<any>,
    transaction?: DatabaseTransaction,
  ): Promise<void> {
    const events = entity.pullDomainEvents();
    const messages = events.map(OutboxMessage.fromDomainEvent);

    if (messages.length === 0) {
      return;
    }

    await this.allOutboxMessages.save(messages, transaction);

    this.emitOutboxMessagesQueuedEvent();
  }

  private emitOutboxMessagesQueuedEvent() {
    const event = new OutboxMessagesQueuedDomainEvent({
      payload: {},
    });

    this.eventEmitter.emit(OutboxMessagesQueuedDomainEvent.name, event);
  }
}
