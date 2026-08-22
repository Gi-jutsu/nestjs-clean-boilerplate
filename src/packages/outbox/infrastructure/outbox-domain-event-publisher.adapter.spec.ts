import {
  AggregateRoot,
  DomainEvent,
} from "@packages/domain-driven-design/index.js";
import type { EventEmitter } from "@packages/outbox/domain/ports/event-emitter.port.js";
import { OutboxMessagesQueuedDomainEvent } from "@packages/outbox/domain/outbox-messages-queued.domain-event.js";
import { OutboxDomainEventPublisher } from "@packages/outbox/infrastructure/outbox-domain-event-publisher.adapter.js";
import { InMemoryOutboxMessageRepository } from "@packages/outbox/infrastructure/repositories/in-memory-outbox-message.repository.js";
import { describe, expect, it } from "vitest";

class AccountOpenedDomainEvent extends DomainEvent<{ accountId: string }> {}

class Account extends AggregateRoot<{ accountId: string }> {
  open() {
    this.commit(
      new AccountOpenedDomainEvent({
        payload: { accountId: this.properties.accountId },
      }),
    );
  }
}

class MockEventEmitter implements EventEmitter {
  emittedEvents: { event: string; values: any[] }[] = [];

  emit(event: string, ...values: any[]) {
    this.emittedEvents.push({ event, values });
  }

  async emitAsync(event: string, ...values: any[]) {
    this.emit(event, ...values);
    return [];
  }
}

describe("OutboxDomainEventPublisher", () => {
  it("should queue recorded domain events and trigger outbox processing", async () => {
    const system = createSystemUnderTest();

    system.given.anAccountHasBeenOpened("account-1");

    await system.when.domainEventsArePublished();

    system.then.accountOpenedEventShouldBeQueued("account-1");
    system.then.outboxProcessingShouldBeTriggered();
  });
});

function createSystemUnderTest() {
  const allOutboxMessages = new InMemoryOutboxMessageRepository();
  const eventEmitter = new MockEventEmitter();

  const publisher = new OutboxDomainEventPublisher(
    allOutboxMessages,
    eventEmitter,
  );

  let account: Account;

  const givenAccountExists = (accountId: string) => {
    account = new Account({
      properties: {
        accountId,
      },
    });
  };

  return {
    given: {
      anAccountHasBeenOpened(accountId: string) {
        givenAccountExists(accountId);
        account.open();
      },
    },
    when: {
      async domainEventsArePublished() {
        await publisher.publish(account);
      },
    },
    then: {
      accountOpenedEventShouldBeQueued(accountId: string) {
        expect([...allOutboxMessages.snapshots.values()]).toMatchObject([
          {
            eventType: "AccountOpenedDomainEvent",
            payload: {
              accountId,
            },
            processedAt: null,
            errorMessage: null,
          },
        ]);
      },
      outboxProcessingShouldBeTriggered() {
        expect(eventEmitter.emittedEvents).toHaveLength(1);
        expect(eventEmitter.emittedEvents[0]).toMatchObject({
          event: OutboxMessagesQueuedDomainEvent.name,
        });
        expect(eventEmitter.emittedEvents[0].values[0]).toBeInstanceOf(
          OutboxMessagesQueuedDomainEvent,
        );
      },
    },
  };
}
