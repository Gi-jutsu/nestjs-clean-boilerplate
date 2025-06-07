import type { BrandedInjectionToken } from '@core/types/index.js';
import type { OutboxMessage } from './aggregate-root.js';

export interface OutboxMessageRepository {
  findUnprocessedMessages(): Promise<OutboxMessage[]>;
  save(message: OutboxMessage[]): Promise<void>;
}

export const OutboxMessageRepositoryToken = Symbol(
  'OutboxMessageRepository',
) as BrandedInjectionToken<OutboxMessageRepository>;
