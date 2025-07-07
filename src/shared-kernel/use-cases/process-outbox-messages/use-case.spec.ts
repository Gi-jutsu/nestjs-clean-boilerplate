import type { EventEmitter } from '@shared-kernel/domain/ports/event-emitter.port.js';
import { InMemoryOutboxMessageRepository } from '@shared-kernel/infrastructure/repositories/in-memory-outbox-message.repository.js';
import { DateTime, Settings } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProcessOutboxMessagesUseCase } from './use-case.js';

class MockEventEmitter implements EventEmitter {
  emittedEvents: { event: string; values: any[] }[] = [];
  shouldThrowError = false;
  errorMessage: string = 'An error occurred';

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
      throw new Error(this.errorMessage);
    }

    this.emittedEvents.push({ event, values });
  }
}

describe('ProcessOutboxMessagesUseCase', () => {
  beforeAll(() => {
    Settings.now = () => new Date(0).getMilliseconds();
  });

  afterAll(() => {
    Settings.now = () => Date.now();
  });

  // @TODO: consider batching messages when reaching high number of messages per tick
  it('should process all unprocessed messages', async () => {
    // Given
    const { allOutboxMessages, useCase } = createSystemUnderTest();

    const unprocessedMessageA = {
      id: '1',
      errorMessage: null,
      eventType: 'event-a',
      payload: {},
      processedAt: null,
    };

    const unprocessedMessageB = {
      id: '2',
      errorMessage: null,
      eventType: 'event-b',
      payload: {},
      processedAt: null,
    };

    allOutboxMessages.snapshots.set(
      unprocessedMessageA.id,
      unprocessedMessageA,
    );
    allOutboxMessages.snapshots.set(
      unprocessedMessageB.id,
      unprocessedMessageB,
    );

    // When
    await useCase.execute();

    // Then
    expect([...allOutboxMessages.snapshots.values()]).toEqual([
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

  it('should emit an event when a message is processed', async () => {
    // Given
    const { allOutboxMessages, mockedEventEmitter, useCase } =
      createSystemUnderTest();

    const unprocessedMessageC = {
      id: '1',
      errorMessage: null,
      eventType: 'event-c',
      payload: {},
      processedAt: null,
    };

    allOutboxMessages.snapshots.set(
      unprocessedMessageC.id,
      unprocessedMessageC,
    );

    // When
    await useCase.execute();

    // Then
    expect(mockedEventEmitter.emittedEvents).toEqual([
      {
        event: 'event-c',
        values: [unprocessedMessageC.payload],
      },
    ]);
  });

  // @TODO: consider retrying messages when an error occurs
  it('should set an error message when an error occurs while emitting an event', async () => {
    // Given
    const { allOutboxMessages, mockedEventEmitter, useCase } =
      createSystemUnderTest();

    const unprocessedMessageD = {
      id: '1',
      errorMessage: null,
      eventType: 'event-d',
      payload: {},
      processedAt: null,
    };

    allOutboxMessages.snapshots.set(
      unprocessedMessageD.id,
      unprocessedMessageD,
    );

    mockedEventEmitter.shouldThrowError = true;

    // When
    await useCase.execute();

    // Then
    expect([...allOutboxMessages.snapshots.values()]).toEqual([
      {
        id: unprocessedMessageD.id,
        errorMessage: 'An error occurred',
        eventType: unprocessedMessageD.eventType,
        payload: unprocessedMessageD.payload,
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

  return { allOutboxMessages, mockedEventEmitter, useCase };
}
