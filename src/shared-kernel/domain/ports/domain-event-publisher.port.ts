import type { BrandedInjectionToken } from "@packages/nest-provider-factory";
import { AggregateRoot } from "@packages/domain-driven-design";
import type { DatabaseTransaction } from "@shared-kernel/infrastructure/database/drizzle.schema.js";

export interface DomainEventPublisher {
  publish(
    entity: AggregateRoot<any>,
    transaction?: DatabaseTransaction,
  ): Promise<void>;
}

export const DomainEventPublisherToken = Symbol(
  "DomainEventPublisher",
) as BrandedInjectionToken<DomainEventPublisher>;
