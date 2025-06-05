import type { AggregateRoot } from '@shared-kernel/domain/primitives/aggregate-root.js';
import type { BrandedInjectionToken } from '@shared-kernel/utils/create-nest-provider.js';

export interface DomainEventPublisher {
  publish(entity: AggregateRoot<any>): Promise<void>;
}

export const DomainEventPublisherToken = Symbol(
  'DomainEventPublisher',
) as BrandedInjectionToken<DomainEventPublisher>;
