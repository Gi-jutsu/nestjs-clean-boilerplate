import type { AggregateRoot } from "@inovys/domain-driven-design";
import type { DatabaseTransaction } from "@shared-kernel/infrastructure/database/drizzle.schema.js";
import type { BrandedInjectionToken } from "@shared-kernel/types/branded-injection-token.js";

export interface DomainEventPublisher {
  publish(
    entity: AggregateRoot<any>,
    transaction?: DatabaseTransaction,
  ): Promise<void>;
}

export const DomainEventPublisherToken = Symbol(
  "DomainEventPublisher",
) as BrandedInjectionToken<DomainEventPublisher>;
