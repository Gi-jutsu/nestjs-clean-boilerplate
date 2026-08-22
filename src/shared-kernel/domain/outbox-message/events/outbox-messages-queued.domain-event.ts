import { DomainEvent } from "@packages/domain-driven-design";

export class OutboxMessagesQueuedDomainEvent extends DomainEvent<{}> {}
