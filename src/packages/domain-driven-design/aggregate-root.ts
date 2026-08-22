import { DomainEvent } from "./domain-event.js";
import { Entity } from "./entity.js";

export abstract class AggregateRoot<
  Properties extends Record<keyof Properties, unknown>,
> extends Entity<Properties> {
  private readonly _events: DomainEvent[] = [];

  protected commit(event: DomainEvent) {
    this._events.push(event);
  }

  pullDomainEvents() {
    const events = [...this._events];
    this._events.length = 0;

    return events;
  }
}
