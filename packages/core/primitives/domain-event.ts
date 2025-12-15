import { randomUUID } from "node:crypto";

interface CreateDomainEventProps<Payload = Record<string, unknown>> {
  payload: Payload;
}

export abstract class DomainEvent<Payload = Record<string, unknown>> {
  readonly id: string;
  readonly payload: Payload;
  readonly type: string;

  constructor(properties: CreateDomainEventProps<Payload>) {
    this.id = randomUUID();
    this.payload = properties.payload;
    this.type = this.constructor.name;
  }
}
