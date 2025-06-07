import { AggregateRoot } from '@core/primitives/aggregate-root.js';
import type { BrandedInjectionToken } from '@core/types/index.js';

export interface DomainEventPublisher {
  publish(entity: AggregateRoot<any>): Promise<void>;
}

export const DomainEventPublisherToken = Symbol(
  'DomainEventPublisher',
) as BrandedInjectionToken<DomainEventPublisher>;
