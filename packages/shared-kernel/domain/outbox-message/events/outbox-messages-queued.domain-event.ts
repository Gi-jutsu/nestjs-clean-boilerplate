import { DomainEvent } from "@core/primitives/domain-event.js";

export class OutboxMessagesQueuedDomainEvent extends DomainEvent<{}> {}
