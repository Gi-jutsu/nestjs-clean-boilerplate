import { DomainEvent } from '@shared-kernel/domain/primitives/domain-event.js';

export class NewAccountRegisteredDomainEvent extends DomainEvent<{
  email: string;
}> {}
