import { AggregateRoot } from "@packages/domain-driven-design/index.js";
import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";
import type { DatabaseTransaction } from "@packages/outbox/infrastructure/database/drizzle.schema.js";

export interface DomainEventPublisher {
  publish(
    entity: AggregateRoot<any>,
    transaction?: DatabaseTransaction,
  ): Promise<void>;
}

export const DomainEventPublisherToken = Symbol(
  "DomainEventPublisher",
) as BrandedInjectionToken<DomainEventPublisher>;
