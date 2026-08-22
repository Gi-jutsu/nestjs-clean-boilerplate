import { DomainEvent } from "@packages/domain-driven-design/index.js";

export class OutboxMessagesQueuedDomainEvent extends DomainEvent<{}> {}
