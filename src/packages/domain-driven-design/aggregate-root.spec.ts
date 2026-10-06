import { AggregateRoot } from "@packages/domain-driven-design/aggregate-root.js";
import { DomainEvent } from "@packages/domain-driven-design/domain-event.js";
import { describe, expect, it } from "vitest";

const ACCOUNT_ID = "account-with-events";

describe("AggregateRoot", () => {
  it("has no events before a domain change", () => {
    const systemUnderTest = createSystemUnderTest();

    systemUnderTest.whenDomainEventsAreCollected();

    systemUnderTest.thenNoDomainEventsAreReturned();
  });

  it("returns recorded changes in their original order", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenTwoDeposits();

    systemUnderTest.whenDomainEventsAreCollected();

    systemUnderTest.thenTheDepositsAreReportedInOrder();
  });

  it("delivers each recorded change only once", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenTwoDeposits();
    systemUnderTest.givenTheEventsWereAlreadyCollected();

    systemUnderTest.whenDomainEventsAreCollected();

    systemUnderTest.thenNoDomainEventsAreReturned();
  });

  it("records later changes independently of an earlier collection", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenTwoDeposits();
    systemUnderTest.givenTheEventsWereAlreadyCollected();

    systemUnderTest.whenAnotherDepositIsRecordedAndCollected();

    systemUnderTest.thenOnlyTheNewDepositIsReturned();
    systemUnderTest.thenTheEarlierCollectionKeepsTheOriginalEvents();
  });

  it("hydrates stored state without publishing a new domain change", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAHydratedAccount();

    systemUnderTest.whenDomainEventsAreCollected();

    systemUnderTest.thenNoDomainEventsAreReturned();
    systemUnderTest.thenTheStoredBalanceIsRestored();
  });
});

function createSystemUnderTest() {
  let account = new Account({ id: ACCOUNT_ID, properties: { balance: 0 } });
  let events: DomainEvent[];
  let earlierEvents: DomainEvent[];

  return {
    givenTwoDeposits() {
      account.deposit(10);
      account.deposit(20);
    },
    givenTheEventsWereAlreadyCollected() {
      earlierEvents = account.pullDomainEvents();
    },
    givenAHydratedAccount() {
      account = Account.fromSnapshot({ id: ACCOUNT_ID, balance: 50 });
    },
    whenDomainEventsAreCollected() {
      events = account.pullDomainEvents();
    },
    whenAnotherDepositIsRecordedAndCollected() {
      account.deposit(5);
      events = account.pullDomainEvents();
    },
    thenNoDomainEventsAreReturned() {
      expect(events).toEqual([]);
    },
    thenTheDepositsAreReportedInOrder() {
      expect(
        events.map((event) => ({ type: event.type, payload: event.payload })),
      ).toEqual([
        {
          type: "MoneyDeposited",
          payload: { accountId: ACCOUNT_ID, amount: 10, balance: 10 },
        },
        {
          type: "MoneyDeposited",
          payload: { accountId: ACCOUNT_ID, amount: 20, balance: 30 },
        },
      ]);
      expect(account.snapshot()).toEqual({ id: ACCOUNT_ID, balance: 30 });
      expect(events[0].id).not.toBe(events[1].id);
    },
    thenOnlyTheNewDepositIsReturned() {
      expect(events.map((event) => event.payload)).toEqual([
        { accountId: ACCOUNT_ID, amount: 5, balance: 35 },
      ]);
    },
    thenTheEarlierCollectionKeepsTheOriginalEvents() {
      expect(earlierEvents.map((event) => event.payload)).toEqual([
        { accountId: ACCOUNT_ID, amount: 10, balance: 10 },
        { accountId: ACCOUNT_ID, amount: 20, balance: 30 },
      ]);
    },
    thenTheStoredBalanceIsRestored() {
      expect(account.snapshot()).toEqual({ id: ACCOUNT_ID, balance: 50 });
    },
  };
}

class MoneyDeposited extends DomainEvent<{
  accountId: string;
  amount: number;
  balance: number;
}> {}

class Account extends AggregateRoot<{ balance: number }> {
  deposit(amount: number) {
    this._properties.balance += amount;
    this.commit(
      new MoneyDeposited({
        payload: {
          accountId: this.id,
          amount,
          balance: this._properties.balance,
        },
      }),
    );
  }
}
