import type { OutboxMessageRepository } from '@shared-kernel/domain/outbox-message/repository.js';
import type { EventEmitter } from '@shared-kernel/domain/ports/event-emitter.port.js';

export class ProcessOutboxMessagesUseCase {
  constructor(
    private readonly allOutboxMessages: OutboxMessageRepository,
    private readonly eventEmitter: EventEmitter,
  ) {}

  async execute() {
    const messages = await this.allOutboxMessages.findUnprocessedMessages();

    for (const message of messages) {
      const { eventType, payload } = message.properties;

      try {
        await this.eventEmitter.emitAsync(eventType, payload);
        message.process();
      } catch (error) {
        message.fail(error.message);
      }

      await this.allOutboxMessages.save([message]);
    }
  }
}
