import { AggregateRoot } from "@core/primitives/aggregate-root.js";
import { OutboxMessage } from "@shared-kernel/domain/outbox-message/aggregate-root.js";
import { OutboxMessagesQueuedDomainEvent } from "@shared-kernel/domain/outbox-message/events/outbox-messages-queued.domain-event.js";
import type { OutboxMessageRepository } from "@shared-kernel/domain/outbox-message/repository.js";
import type { DomainEventPublisher } from "@shared-kernel/domain/ports/domain-event-publisher.port.js";
import type { EventEmitter } from "@shared-kernel/domain/ports/event-emitter.port.js";
import type { DatabaseTransaction } from "./database/drizzle.schema.js";

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
