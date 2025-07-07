import { AggregateRoot } from '@core/primitives/aggregate-root.js';
import type { BrandedInjectionToken } from '@core/types/index.js';
import type { DatabaseTransaction } from '@shared-kernel/infrastructure/database/drizzle.schema.js';

export interface DomainEventPublisher {
  publish(
    entity: AggregateRoot<any>,
    transaction?: DatabaseTransaction,
  ): Promise<void>;
}

export const DomainEventPublisherToken = Symbol(
  'DomainEventPublisher',
) as BrandedInjectionToken<DomainEventPublisher>;
