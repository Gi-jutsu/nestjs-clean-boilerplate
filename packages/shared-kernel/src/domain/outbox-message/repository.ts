import type { DatabaseTransaction } from "@shared-kernel/infrastructure/database/drizzle.schema.js";
import type { OutboxMessage } from "./aggregate-root.js";
import type { BrandedInjectionToken } from "@shared-kernel/types/branded-injection-token.js";

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
