import { DomainEvent } from '@core/primitives/domain-event.js';

export class NewAccountRegisteredDomainEvent extends DomainEvent<{
  email: string;
}> {}
