import { OutboxMessage } from "@shared-kernel/domain/outbox-message/aggregate-root.js";
import type { OutboxMessageRepository } from "@shared-kernel/domain/outbox-message/repository.js";
import type { DomainEventPublisher } from "@shared-kernel/domain/ports/domain-event-publisher.port.js";
import type { AggregateRoot } from "@shared-kernel/domain/primitives/aggregate-root.js";

export class OutboxDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly allOutboxMessages: OutboxMessageRepository) {}

  async publish(entity: AggregateRoot<any>): Promise<void> {
    const events = entity.pullDomainEvents();
    const messages = events.map(OutboxMessage.fromDomainEvent);
    
    await this.allOutboxMessages.save(messages);
  }
}
