import type { EventEmitter } from "@shared-kernel/domain/ports/event-emitter.port.js";
import { InMemoryOutboxMessageRepository } from "@shared-kernel/infrastructure/repositories/in-memory-outbox-message.repository.js";
import { DateTime, Settings } from "luxon";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProcessOutboxMessagesUseCase } from "./use-case.js";

type OutboxMessageSnapshot = {
  errorMessage: string | null;
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
  processedAt: Date | null;
};

class MockEventEmitter implements EventEmitter {
  emittedEvents: { event: string; values: any[] }[] = [];
  shouldThrowError = false;
  error: unknown = new Error("An error occurred");

  emit(event: string, ...values: any[]) {
    this.addEmittedEventOrThrow(event, ...values);
  }

  async emitAsync(event: string, ...values: any[]) {
    this.addEmittedEventOrThrow(event, ...values);
    return [];
  }

  clear() {
    this.emittedEvents = [];
  }

  private addEmittedEventOrThrow(event: string, ...values: any[]) {
    if (this.shouldThrowError) {
      throw this.error;
    }

    this.emittedEvents.push({ event, values });
  }
}

describe("ProcessOutboxMessagesUseCase", () => {
  beforeAll(() => {
    Settings.now = () => new Date(0).getMilliseconds();
  });

  afterAll(() => {
    Settings.now = () => Date.now();
  });

  // @TODO: consider batching messages when reaching high number of messages per tick
  it("should process all unprocessed messages", async () => {
    const system = createSystemUnderTest();
    const unprocessedMessageA = {
      id: "1",
      errorMessage: null,
      eventType: "event-a",
      payload: {},
      processedAt: null,
    };

    const unprocessedMessageB = {
      id: "2",
      errorMessage: null,
      eventType: "event-b",
      payload: {},
      processedAt: null,
    };

    system.given.unprocessedMessagesExist([
      unprocessedMessageA,
      unprocessedMessageB,
    ]);

    await system.when.outboxMessagesAreProcessed();

    system.then.outboxMessagesShouldBeProcessed([
      {
        id: unprocessedMessageA.id,
        errorMessage: null,
        eventType: unprocessedMessageA.eventType,
        payload: unprocessedMessageA.payload,
        processedAt: DateTime.now().toJSDate(),
      },
      {
        id: unprocessedMessageB.id,
        errorMessage: null,
        eventType: unprocessedMessageB.eventType,
        payload: unprocessedMessageB.payload,
        processedAt: DateTime.now().toJSDate(),
      },
    ]);
  });

  it("should emit an event when a message is processed", async () => {
    const system = createSystemUnderTest();
    const unprocessedMessageC = {
      id: "1",
      errorMessage: null,
      eventType: "event-c",
      payload: {},
      processedAt: null,
    };

    system.given.unprocessedMessagesExist([unprocessedMessageC]);

    await system.when.outboxMessagesAreProcessed();

    system.then.eventsShouldBeEmitted([
      {
        event: "event-c",
        values: [unprocessedMessageC.payload],
      },
    ]);
  });

  // @TODO: consider retrying messages when an error occurs
  it("should set an error message when an error occurs while emitting an event", async () => {
    const system = createSystemUnderTest();
    const unprocessedMessageD = {
      id: "1",
      errorMessage: null,
      eventType: "event-d",
      payload: {},
      processedAt: null,
    };

    system.given.unprocessedMessagesExist([unprocessedMessageD]);
    system.given.messageProcessingFails();

    await system.when.outboxMessagesAreProcessed();

    system.then.outboxMessagesShouldBeProcessed([
      {
        id: unprocessedMessageD.id,
        errorMessage: "An error occurred",
        eventType: unprocessedMessageD.eventType,
        payload: unprocessedMessageD.payload,
        processedAt: DateTime.now().toJSDate(),
      },
    ]);
  });

  it("should keep the failure reason when processing fails without an error object", async () => {
    const system = createSystemUnderTest();
    const unprocessedMessage = {
      id: "1",
      errorMessage: null,
      eventType: "event-e",
      payload: {},
      processedAt: null,
    };

    system.given.unprocessedMessagesExist([unprocessedMessage]);
    system.given.messageProcessingFailsWith("Message processing failed");

    await system.when.outboxMessagesAreProcessed();

    system.then.outboxMessagesShouldBeProcessed([
      {
        id: unprocessedMessage.id,
        errorMessage: "Message processing failed",
        eventType: unprocessedMessage.eventType,
        payload: unprocessedMessage.payload,
        processedAt: DateTime.now().toJSDate(),
      },
    ]);
  });
});

function createSystemUnderTest() {
  const allOutboxMessages = new InMemoryOutboxMessageRepository();
  const mockedEventEmitter = new MockEventEmitter();

  const useCase = new ProcessOutboxMessagesUseCase(
    allOutboxMessages,
    mockedEventEmitter,
  );

  return {
    given: {
      unprocessedMessagesExist(messages: OutboxMessageSnapshot[]) {
        for (const message of messages) {
          allOutboxMessages.snapshots.set(message.id, message);
        }
      },
      messageProcessingFails() {
        mockedEventEmitter.shouldThrowError = true;
      },
      messageProcessingFailsWith(error: unknown) {
        mockedEventEmitter.shouldThrowError = true;
        mockedEventEmitter.error = error;
      },
    },
    when: {
      async outboxMessagesAreProcessed() {
        await useCase.execute();
      },
    },
    then: {
      outboxMessagesShouldBeProcessed(messages: OutboxMessageSnapshot[]) {
        expect([...allOutboxMessages.snapshots.values()]).toEqual(messages);
      },
      eventsShouldBeEmitted(
        events: { event: string; values: Record<string, unknown>[] }[],
      ) {
        expect(mockedEventEmitter.emittedEvents).toEqual(events);
      },
    },
  };
}
