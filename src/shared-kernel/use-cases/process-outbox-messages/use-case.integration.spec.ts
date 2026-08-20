import type { EventEmitter } from "@shared-kernel/domain/ports/event-emitter.port.js";
import {
  outboxMessageSchema,
  type SharedKernelDatabase,
} from "@shared-kernel/infrastructure/database/drizzle.schema.js";
import { DrizzleOutboxMessageRepository } from "@shared-kernel/infrastructure/repositories/drizzle-outbox-message.repository.js";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProcessOutboxMessagesUseCase } from "./use-case.js";

type OutboxMessageSnapshot = {
  errorMessage: string | null;
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
  processedAt: Date | null;
};

type PendingMessage = Pick<
  OutboxMessageSnapshot,
  "eventType" | "id" | "payload"
>;
type SystemState = {
  database: SharedKernelDatabase;
  eventEmitter: RecordingEventEmitter;
  pendingMessage?: PendingMessage;
  useCase: ProcessOutboxMessagesUseCase;
};

const ACCOUNT_OPENED_EVENT = "AccountOpenedDomainEvent";
const ACCOUNT_OPENED_MESSAGE_ID = "00000000-0000-0000-0000-000000000001";
const FAILED_ACCOUNT_OPENED_MESSAGE_ID = "00000000-0000-0000-0000-000000000002";

class RecordingEventEmitter implements EventEmitter {
  emittedEvents: { event: string; values: any[] }[] = [];
  shouldThrowError = false;

  emit(event: string, ...values: any[]) {
    this.emitOrThrow(event, ...values);
  }

  async emitAsync(event: string, ...values: any[]) {
    this.emitOrThrow(event, ...values);
    return [];
  }

  private emitOrThrow(event: string, ...values: any[]) {
    if (this.shouldThrowError) {
      throw new Error("Message processing failed");
    }

    this.emittedEvents.push({ event, values });
  }
}

describe("ProcessOutboxMessagesUseCase integration", () => {
  let database: SharedKernelDatabase;
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });

    database = drizzle(pool) as SharedKernelDatabase;
  });

  beforeEach(async () => {
    await database.delete(outboxMessageSchema);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("should process due outbox messages with PostgreSQL", async () => {
    const system = createSystemUnderTest(database);

    await system.given.accountOpenedEventIsPending("account-id");
    await system.when.outboxMessagesAreProcessed();
    system.then.accountOpenedEventShouldBeEmitted("account-id");
    await system.then.pendingMessageShouldBeProcessed();
  });

  it("should keep the failure reason when PostgreSQL processing fails", async () => {
    const system = createSystemUnderTest(database);

    await system.given.accountOpenedEventIsPending("account-id", {
      messageId: FAILED_ACCOUNT_OPENED_MESSAGE_ID,
    });
    system.given.messageProcessingFails();

    await system.when.outboxMessagesAreProcessed();

    await system.then.pendingMessageShouldBeProcessedWithError(
      "Message processing failed",
    );
  });
});

function createSystemUnderTest(database: SharedKernelDatabase) {
  const eventEmitter = new RecordingEventEmitter();
  const useCase = new ProcessOutboxMessagesUseCase(
    new DrizzleOutboxMessageRepository(database),
    eventEmitter,
  );

  const state = { database, eventEmitter, useCase };

  return {
    given: createGivenSteps(state),
    when: createWhenSteps(state),
    then: createThenSteps(state),
  };
}

function createGivenSteps(state: SystemState) {
  return {
    async accountOpenedEventIsPending(
      accountId: string,
      options: { messageId?: string } = {},
    ) {
      state.pendingMessage = {
        id: options.messageId ?? ACCOUNT_OPENED_MESSAGE_ID,
        eventType: ACCOUNT_OPENED_EVENT,
        payload: { accountId },
      };

      await insertPendingMessage(state);
    },
    messageProcessingFails() {
      state.eventEmitter.shouldThrowError = true;
    },
  };
}

function createWhenSteps(state: SystemState) {
  return {
    async outboxMessagesAreProcessed() {
      await state.useCase.execute();
    },
  };
}

function createThenSteps(state: SystemState) {
  return {
    accountOpenedEventShouldBeEmitted(accountId: string) {
      expect(state.eventEmitter.emittedEvents).toEqual([
        {
          event: ACCOUNT_OPENED_EVENT,
          values: [{ accountId }],
        },
      ]);
    },
    pendingMessageShouldBeProcessed() {
      return expectPendingMessageToBeProcessed(state, null);
    },
    pendingMessageShouldBeProcessedWithError(errorMessage: string) {
      return expectPendingMessageToBeProcessed(state, errorMessage);
    },
  };
}

async function insertPendingMessage(state: SystemState) {
  const message = getPendingMessage(state);

  await state.database.insert(outboxMessageSchema).values({
    errorMessage: null,
    eventType: message.eventType,
    id: message.id,
    payload: message.payload,
    processedAt: null,
  });
}

async function expectPendingMessageToBeProcessed(
  state: SystemState,
  errorMessage: string | null,
) {
  const expectedMessage = getPendingMessage(state);
  const [processedMessage] = await selectOutboxMessages(state.database);

  expect(processedMessage).toMatchObject({
    ...expectedMessage,
    errorMessage,
  });
  expect(processedMessage?.processedAt).toBeInstanceOf(Date);
}

function getPendingMessage(state: SystemState) {
  if (!state.pendingMessage) {
    throw new Error("Expected a pending outbox message.");
  }

  return state.pendingMessage;
}

async function selectOutboxMessages(database: SharedKernelDatabase) {
  return await database
    .select({
      errorMessage: outboxMessageSchema.errorMessage,
      eventType: outboxMessageSchema.eventType,
      id: outboxMessageSchema.id,
      payload: outboxMessageSchema.payload,
      processedAt: outboxMessageSchema.processedAt,
    })
    .from(outboxMessageSchema)
    .orderBy(asc(outboxMessageSchema.id));
}
