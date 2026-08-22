import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { OutboxMessagesQueuedDomainEvent } from "@packages/outbox/domain/outbox-messages-queued.domain-event.js";
import { ProcessOutboxMessagesUseCase } from "@packages/outbox/use-cases/process-outbox-messages/use-case.js";

@Injectable()
export class ProcessOutboxMessagesDomainEventController {
  constructor(private readonly useCase: ProcessOutboxMessagesUseCase) {}

  @OnEvent(OutboxMessagesQueuedDomainEvent.name)
  async handle() {
    await this.useCase.execute();
  }
}
