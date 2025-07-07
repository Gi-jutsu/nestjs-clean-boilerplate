import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OutboxMessagesQueuedDomainEvent } from '@shared-kernel/domain/outbox-message/events/outbox-messages-queued.domain-event.js';
import { ProcessOutboxMessagesUseCase } from './use-case.js';

@Injectable()
export class ProcessOutboxMessagesDomainEventController {
  constructor(private readonly useCase: ProcessOutboxMessagesUseCase) {}

  @OnEvent(OutboxMessagesQueuedDomainEvent.name)
  async handle() {
    await this.useCase.execute();
  }
}
