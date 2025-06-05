import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  vitest,
} from 'vitest';
import { InMemoryOutboxMessageRepository } from '@shared-kernel/infrastructure/repositories/in-memory-outbox-message.repository.js';
import { ProcessOutboxMessagesUseCase } from './use-case.js';
import { ProcessOutboxMessagesScheduler } from './scheduler.js';
import { ConfigService } from '@nestjs/config';

const OUTBOX_PROCESSING_INTERVAL = 1000;

describe('ProcessOutboxMessagesScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should process outbox messages every interval', () => {
    // Given
    const { scheduler, useCase } = createSystemUnderTest();

    // When
    scheduler.onApplicationBootstrap();

    vi.advanceTimersByTime(OUTBOX_PROCESSING_INTERVAL);
    vi.advanceTimersByTime(OUTBOX_PROCESSING_INTERVAL);

    scheduler.onApplicationShutdown();

    // Then
    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('should stop processing outbox messages when the application shuts down', () => {
    // Given
    const { scheduler, useCase } = createSystemUnderTest();

    // When
    scheduler.onApplicationBootstrap();
    scheduler.onApplicationShutdown();
    vi.advanceTimersByTime(OUTBOX_PROCESSING_INTERVAL);

    // Then
    expect(useCase.execute).not.toHaveBeenCalled();
  });
});

function createSystemUnderTest() {
  const allOutboxMessages = new InMemoryOutboxMessageRepository();
  const dummyEventEmitter = { emitAsync: vitest.fn() };
  const stubConfigService = {
    getOrThrow: vitest.fn(() => OUTBOX_PROCESSING_INTERVAL),
  } as unknown as ConfigService;

  class SpyProcessOutboxMessagesUseCase extends ProcessOutboxMessagesUseCase {
    constructor() {
      super(allOutboxMessages, dummyEventEmitter);
    }

    execute = vitest.fn();
  }

  const useCase = new SpyProcessOutboxMessagesUseCase();
  const scheduler = new ProcessOutboxMessagesScheduler(
    stubConfigService,
    useCase,
  );

  return { scheduler, useCase };
}
