import { OutboxMessage } from "@shared-kernel/domain/outbox-message/aggregate-root.js";
import type { OutboxMessageRepository } from "@shared-kernel/domain/outbox-message/repository.js";

export class InMemoryOutboxMessageRepository
  implements OutboxMessageRepository
{
  readonly snapshots = new Map<
    OutboxMessage["id"],
    OutboxMessage["properties"]
  >();

  async findUnprocessedMessages() {
    return Array.from(this.snapshots.values())
      .filter((s) => s.processedAt === null)
      .map((s) => OutboxMessage.fromSnapshot(s));
  }

  async save(messages: OutboxMessage[]) {
    for (const message of messages) {
      this.snapshots.set(message.id, message.properties);
    }
  }
}
