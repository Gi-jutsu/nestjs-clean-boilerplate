import type { AggregateRoot } from '@shared-kernel/domain/primitives/aggregate-root.js';

export interface DomainEventPublisher {
  publish(entity: AggregateRoot<any>): Promise<void>;
}

export const DomainEventPublisherToken = Symbol('DomainEventPublisher');
