import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { outboxProviders } from "@modules/shared-kernel/infrastructure/outbox.providers.js";
import {
  Inject,
  Injectable,
  Module,
  type INestApplicationContext,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  OnOutboxMessage,
  OutboxInbox,
  OutboxModule,
  OutboxRelay,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { PostgresOutboxStore } from "@nestjs/outbox/postgres";
import {
  AggregateRoot,
  DomainEvent,
} from "@packages/domain-driven-design/index.js";
import {
  DomainEventPublisherToken,
  type DomainEventPublisher,
} from "@packages/outbox/index.js";
import type { DatabaseTransaction } from "@packages/outbox/infrastructure/database/drizzle.schema.js";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ORDER_ID = "order-1";
const RECEIPT_CONSUMER = "outbox-test-receipt";
const INVENTORY_CONSUMER = "outbox-test-inventory";
const ABANDONED_OWNER = "outbox-test-crashed-relay";
const ROLLBACK_REASON = new Error("Order was refused");

const ordersSchema = pgTable("outbox_test_orders", { id: text().primaryKey() });
const deliveriesSchema = pgTable("outbox_test_deliveries", {
  consumer: text().notNull(),
  messageId: text("message_id").notNull(),
  payload: jsonb().notNull(),
});
const inventorySchema = pgTable("outbox_test_inventory", {
  orderId: text("order_id").primaryKey(),
  reserved: integer().notNull(),
});

class OrderPlaced extends DomainEvent<{ orderId: string }> {}

class Order extends AggregateRoot<{ placed: boolean }> {
  place() {
    const event = new OrderPlaced({ payload: { orderId: this.id } });
    this.commit(event);
    return event;
  }
}

@Injectable()
class ReceiptConsumer {
  constructor(
    @Inject(SharedKernelDatabaseToken)
    private readonly database: SharedKernelDatabase,
  ) {}

  @OnOutboxMessage(OrderPlaced.name, { consumer: RECEIPT_CONSUMER })
  async handle(
    payload: OrderPlaced["payload"],
    context: OutboxHandlerContext<DatabaseTransaction>,
  ) {
    await this.database.transaction(async (transaction) => {
      await context.processInTransaction(transaction, () =>
        transaction.insert(deliveriesSchema).values({
          consumer: context.consumer,
          messageId: context.message.id,
          payload,
        }),
      );
    });
  }
}

@Injectable()
class InventoryConsumer {
  unavailable = false;

  constructor(
    @Inject(SharedKernelDatabaseToken)
    private readonly database: SharedKernelDatabase,
  ) {}

  @OnOutboxMessage(OrderPlaced.name, { consumer: INVENTORY_CONSUMER })
  async handle(
    payload: OrderPlaced["payload"],
    context: OutboxHandlerContext<DatabaseTransaction>,
  ) {
    if (this.unavailable) {
      throw new Error("Inventory is temporarily unavailable");
    }
    await this.database.transaction(async (transaction) => {
      await context.processInTransaction(transaction, async () => {
        await transaction.insert(deliveriesSchema).values({
          consumer: context.consumer,
          messageId: context.message.id,
          payload,
        });
        await transaction
          .insert(inventorySchema)
          .values({ orderId: payload.orderId, reserved: 1 });
      });
    });
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    SharedKernelDatabaseModule,
    OutboxModule.forRoot({ relay: { enabled: false } }),
  ],
  providers: [...outboxProviders, ReceiptConsumer, InventoryConsumer],
})
class OutboxTestingModule {}

describe("OutboxDomainEventPublisher with PostgreSQL", () => {
  let application: INestApplicationContext;
  let database: SharedKernelDatabase;

  it("rolls back the order and its event together", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);

    await systemUnderTest.whenTheOrderTransactionRollsBack();

    await systemUnderTest.thenNoOrderOrEventWasStored();
    await systemUnderTest.thenNoConsumerReceivedTheOrder();
  });

  it("delivers the committed event with its original identity and payload", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);
    await systemUnderTest.givenACommittedOrder();

    await systemUnderTest.whenPendingEventsAreDelivered();

    await systemUnderTest.thenBothConsumersReceivedTheOrderOnce();
    await systemUnderTest.thenTheOrderIsStoredAndItsEventIsAcknowledged();
  });

  it("stores an aggregate without creating an event when no change was recorded", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);

    await systemUnderTest.whenAnOrderWithoutNewEventsIsSaved();

    await systemUnderTest.thenTheOrderIsStoredAndItsEventIsAcknowledged();
    await systemUnderTest.thenNoConsumerReceivedTheOrder();
  });

  it("keeps an uncommitted order event invisible to the relay", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);

    await systemUnderTest.whenTheRelayPollsBeforeTheOrderCommits();

    await systemUnderTest.thenNoConsumerSawAnUncommittedOrder();
    await systemUnderTest.thenTheCommittedEventIsStillPending();
  });

  it("retries a failed consumer without repeating a successful consumer", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);
    systemUnderTest.givenInventoryIsUnavailable();
    await systemUnderTest.givenACommittedOrder();

    await systemUnderTest.whenPendingEventsAreDelivered();

    await systemUnderTest.thenOnlyTheReceiptWasDeliveredAndTheEventRemainsPending();
    await systemUnderTest.givenInventoryHasRecoveredAndTheRetryIsDue();
    await systemUnderTest.whenPendingEventsAreDelivered();
    await systemUnderTest.thenBothConsumersReceivedTheOrderOnce();
    await systemUnderTest.thenTheOrderIsStoredAndItsEventIsAcknowledged();
  });

  it("recovers a committed event after a relay abandons its lease", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);
    await systemUnderTest.givenACommittedOrder();
    await systemUnderTest.givenTheRelayCrashedAfterClaimingTheEvent();

    await systemUnderTest.whenPendingEventsAreDelivered();

    systemUnderTest.thenTheAbandonedEventWasRecovered();
    await systemUnderTest.thenBothConsumersReceivedTheOrderOnce();
    await systemUnderTest.thenTheOrderIsStoredAndItsEventIsAcknowledged();
  });

  it("rolls back a consumer inbox record with its failed database effects", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);
    await systemUnderTest.givenACommittedOrder();

    await systemUnderTest.whenTheConsumerTransactionRollsBack();

    await systemUnderTest.thenNoConsumerReceivedTheOrder();
    await systemUnderTest.thenTheConsumerInboxIsEmpty();
    await systemUnderTest.whenPendingEventsAreDelivered();
    await systemUnderTest.thenBothConsumersReceivedTheOrderOnce();
  });

  it("records the same message independently for each consumer", async () => {
    const systemUnderTest = createSystemUnderTest(application, database);
    await systemUnderTest.givenACommittedOrder();

    await systemUnderTest.whenPendingEventsAreDelivered();

    await systemUnderTest.thenBothConsumersHaveAnInboxRecord();
  });

  beforeAll(async () => {
    application = await NestFactory.createApplicationContext(
      OutboxTestingModule,
      { logger: false },
    );
    database = application.get(SharedKernelDatabaseToken);
    await database.execute(
      sql`CREATE TABLE outbox_test_orders (id text PRIMARY KEY)`,
    );
    await database.execute(
      sql`CREATE TABLE outbox_test_deliveries (consumer text NOT NULL, message_id text NOT NULL, payload jsonb NOT NULL)`,
    );
    await database.execute(
      sql`CREATE TABLE outbox_test_inventory (order_id text PRIMARY KEY, reserved integer NOT NULL)`,
    );
  });

  beforeEach(async () => {
    await database.execute(
      sql`TRUNCATE outbox_test_orders, outbox_test_deliveries, outbox_test_inventory, nest_outbox.messages, nest_outbox.inbox, nest_outbox.dead_letters RESTART IDENTITY`,
    );
    application.get(InventoryConsumer).unavailable = false;
  });

  afterAll(async () => {
    await database.execute(
      sql`TRUNCATE nest_outbox.messages, nest_outbox.inbox, nest_outbox.dead_letters RESTART IDENTITY`,
    );
    await database.execute(
      sql`DROP TABLE outbox_test_orders, outbox_test_deliveries, outbox_test_inventory`,
    );
    await application.close();
  });
});

function createSystemUnderTest(
  application: INestApplicationContext,
  database: SharedKernelDatabase,
) {
  const publisher = application.get<DomainEventPublisher>(
    DomainEventPublisherToken,
  );
  const relay = application.get(OutboxRelay);
  const store = application.get(PostgresOutboxStore);
  const inbox = application.get(OutboxInbox);
  const inventory = application.get(InventoryConsumer);
  let event: OrderPlaced;
  let transactionFailure: unknown;
  let uncommittedDeliveries: (typeof deliveriesSchema.$inferSelect)[];
  let abandonedEventIds: string[];

  async function saveOrder(transaction: DatabaseTransaction) {
    const order = new Order({ id: ORDER_ID, properties: { placed: true } });
    event = order.place();
    await transaction.insert(ordersSchema).values({ id: order.id });
    await publisher.publish(order, transaction);
  }

  async function rollBack(
    work: (transaction: DatabaseTransaction) => Promise<void>,
  ) {
    try {
      await database.transaction(async (transaction) => {
        await work(transaction);
        throw ROLLBACK_REASON;
      });
    } catch (error) {
      transactionFailure = error;
    }
  }

  return {
    async givenACommittedOrder() {
      await database.transaction(saveOrder);
    },
    givenInventoryIsUnavailable() {
      inventory.unavailable = true;
    },
    async givenInventoryHasRecoveredAndTheRetryIsDue() {
      inventory.unavailable = false;
      const {
        rows: [message],
      } = await database.execute<{ available_at: string }>(
        sql`SELECT available_at FROM nest_outbox.messages WHERE id = ${event.id}`,
      );
      await waitFor(Math.max(0, Number(message.available_at) - Date.now()) + 5);
    },
    async givenTheRelayCrashedAfterClaimingTheEvent() {
      const messages = await store.claim({
        owner: ABANDONED_OWNER,
        now: Date.now(),
        leaseMs: 1,
        limit: 1,
      });
      abandonedEventIds = messages.map((message) => message.id);
      await waitFor(5);
    },
    async whenTheOrderTransactionRollsBack() {
      await rollBack(saveOrder);
    },
    async whenAnOrderWithoutNewEventsIsSaved() {
      await database.transaction(async (transaction) => {
        const order = new Order({
          id: ORDER_ID,
          properties: { placed: false },
        });
        await transaction.insert(ordersSchema).values({ id: order.id });
        await publisher.publish(order, transaction);
      });
    },
    async whenTheRelayPollsBeforeTheOrderCommits() {
      await database.transaction(async (transaction) => {
        await saveOrder(transaction);
        await relay.runOnce();
        uncommittedDeliveries = await database.select().from(deliveriesSchema);
      });
    },
    async whenPendingEventsAreDelivered() {
      await relay.runOnce();
    },
    async whenTheConsumerTransactionRollsBack() {
      await rollBack(async (transaction) => {
        await inbox.processInTransaction(
          transaction,
          RECEIPT_CONSUMER,
          event.id,
          () =>
            transaction.insert(deliveriesSchema).values({
              consumer: RECEIPT_CONSUMER,
              messageId: event.id,
              payload: event.payload,
            }),
        );
      });
    },
    async thenNoOrderOrEventWasStored() {
      expect(transactionFailure).toBe(ROLLBACK_REASON);
      expect(await database.select().from(ordersSchema)).toEqual([]);
      expect(
        (await database.execute(sql`SELECT id FROM nest_outbox.messages`)).rows,
      ).toEqual([]);
    },
    async thenNoConsumerReceivedTheOrder() {
      expect(await database.select().from(deliveriesSchema)).toEqual([]);
    },
    async thenTheConsumerInboxIsEmpty() {
      expect(transactionFailure).toBe(ROLLBACK_REASON);
      expect(
        (
          await database.execute(
            sql`SELECT consumer, message_id FROM nest_outbox.inbox`,
          )
        ).rows,
      ).toEqual([]);
    },
    async thenBothConsumersReceivedTheOrderOnce() {
      expect(
        await database
          .select()
          .from(deliveriesSchema)
          .orderBy(deliveriesSchema.consumer),
      ).toEqual([
        {
          consumer: INVENTORY_CONSUMER,
          messageId: event.id,
          payload: event.payload,
        },
        {
          consumer: RECEIPT_CONSUMER,
          messageId: event.id,
          payload: event.payload,
        },
      ]);
      expect(await database.select().from(inventorySchema)).toEqual([
        { orderId: ORDER_ID, reserved: 1 },
      ]);
    },
    async thenTheOrderIsStoredAndItsEventIsAcknowledged() {
      expect(await database.select().from(ordersSchema)).toEqual([
        { id: ORDER_ID },
      ]);
      expect(
        (await database.execute(sql`SELECT id FROM nest_outbox.messages`)).rows,
      ).toEqual([]);
    },
    async thenOnlyTheReceiptWasDeliveredAndTheEventRemainsPending() {
      expect(await database.select().from(deliveriesSchema)).toEqual([
        {
          consumer: RECEIPT_CONSUMER,
          messageId: event.id,
          payload: event.payload,
        },
      ]);
      expect(
        (
          await database.execute(
            sql`SELECT id, attempts FROM nest_outbox.messages`,
          )
        ).rows,
      ).toEqual([{ id: event.id, attempts: 1 }]);
    },
    async thenBothConsumersHaveAnInboxRecord() {
      expect(
        (
          await database.execute(
            sql`SELECT consumer, message_id FROM nest_outbox.inbox ORDER BY consumer`,
          )
        ).rows,
      ).toEqual([
        { consumer: INVENTORY_CONSUMER, message_id: event.id },
        { consumer: RECEIPT_CONSUMER, message_id: event.id },
      ]);
    },
    thenNoConsumerSawAnUncommittedOrder() {
      expect(uncommittedDeliveries).toEqual([]);
    },
    thenTheAbandonedEventWasRecovered() {
      expect(abandonedEventIds).toEqual([event.id]);
    },
    async thenTheCommittedEventIsStillPending() {
      expect(
        (
          await database.execute(
            sql`SELECT id, topic, payload, key FROM nest_outbox.messages`,
          )
        ).rows,
      ).toEqual([
        {
          id: event.id,
          topic: event.type,
          payload: event.payload,
          key: ORDER_ID,
        },
      ]);
    },
  };
}

function waitFor(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
