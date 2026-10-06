import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { outboxProviders } from "@modules/shared-kernel/infrastructure/outbox.providers.js";
import { Module, type INestApplicationContext } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { OutboxModule } from "@nestjs/outbox";
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
import { pgTable, text } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ORDER_ID = "order-1";
const ROLLBACK_REASON = new Error("Order was refused");
const ordersSchema = pgTable("outbox_test_orders", { id: text().primaryKey() });

class OrderPlaced extends DomainEvent<{ orderId: string }> {}

class Order extends AggregateRoot<{ placed: boolean }> {
  place() {
    const event = new OrderPlaced({ payload: { orderId: this.id } });
    this.commit(event);
    return event;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    SharedKernelDatabaseModule,
    OutboxModule.forRoot({ relay: { enabled: false } }),
  ],
  providers: outboxProviders,
})
class OutboxTestingModule {}

describe("OutboxDomainEventPublisher with PostgreSQL", () => {
  let application: INestApplicationContext;
  let database: SharedKernelDatabase;

  it("maps a committed domain event to its original identity, topic, payload and aggregate key", async () => {
    const system = createSystemUnderTest(application, database);

    await system.whenTheOrderTransactionCommits();

    await system.thenTheOrderIsStored();
    await system.thenTheOriginalDomainEventIsQueued();
  });

  it("rolls back the order and its event together", async () => {
    const system = createSystemUnderTest(application, database);

    await system.whenTheOrderTransactionRollsBack();

    await system.thenTheTransactionWasRejected();
    await system.thenNoOrderOrEventWasStored();
  });

  it("stores an aggregate without creating an event when no change was recorded", async () => {
    const system = createSystemUnderTest(application, database);

    await system.whenAnOrderWithoutNewEventsIsSaved();

    await system.thenTheOrderIsStored();
    await system.thenNoEventWasQueued();
  });

  beforeAll(async () => {
    application = await NestFactory.createApplicationContext(
      OutboxTestingModule,
      {
        logger: false,
      },
    );
    database = application.get(SharedKernelDatabaseToken);
    await database.execute(
      sql`CREATE TABLE outbox_test_orders (id text PRIMARY KEY)`,
    );
  });

  beforeEach(async () => {
    await database.execute(
      sql`TRUNCATE outbox_test_orders, nest_outbox.messages RESTART IDENTITY`,
    );
  });

  afterAll(async () => {
    await database.execute(sql`TRUNCATE nest_outbox.messages RESTART IDENTITY`);
    await database.execute(sql`DROP TABLE outbox_test_orders`);
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
  let event: OrderPlaced;
  let transactionFailure: unknown;

  async function saveOrder(transaction: DatabaseTransaction) {
    const order = new Order({ id: ORDER_ID, properties: { placed: true } });
    event = order.place();
    await transaction.insert(ordersSchema).values({ id: order.id });
    await publisher.publish(order, transaction);
  }

  async function queuedEvents() {
    const { rows } = await database.execute(
      sql`SELECT id, topic, payload, key FROM nest_outbox.messages`,
    );
    return rows;
  }

  return {
    async whenTheOrderTransactionCommits() {
      await database.transaction(saveOrder);
    },
    async whenTheOrderTransactionRollsBack() {
      try {
        await database.transaction(async (transaction) => {
          await saveOrder(transaction);
          throw ROLLBACK_REASON;
        });
      } catch (error) {
        transactionFailure = error;
      }
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
    async thenTheOrderIsStored() {
      expect(await database.select().from(ordersSchema)).toEqual([
        { id: ORDER_ID },
      ]);
    },
    async thenTheOriginalDomainEventIsQueued() {
      expect(await queuedEvents()).toEqual([
        {
          id: event.id,
          topic: event.type,
          payload: event.payload,
          key: ORDER_ID,
        },
      ]);
    },
    async thenTheTransactionWasRejected() {
      expect(transactionFailure).toBe(ROLLBACK_REASON);
    },
    async thenNoOrderOrEventWasStored() {
      expect(await database.select().from(ordersSchema)).toEqual([]);
      expect(await queuedEvents()).toEqual([]);
    },
    async thenNoEventWasQueued() {
      expect(await queuedEvents()).toEqual([]);
    },
  };
}
