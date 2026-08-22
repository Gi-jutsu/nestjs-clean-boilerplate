import type { BrandedInjectionToken } from "@packages/nest-provider-factory/index.js";
import type { OutboxMessage } from "@packages/outbox/domain/outbox-message.js";
import type { DatabaseTransaction } from "@packages/outbox/infrastructure/database/drizzle.schema.js";

export interface OutboxMessageRepository {
  findUnprocessedMessages(): Promise<OutboxMessage[]>;
  save(
    message: OutboxMessage[],
    transaction?: DatabaseTransaction,
  ): Promise<void>;
}

export const OutboxMessageRepositoryToken = Symbol(
  "OutboxMessageRepository",
) as BrandedInjectionToken<OutboxMessageRepository>;
