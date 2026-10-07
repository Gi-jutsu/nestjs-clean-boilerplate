import { DomainEvent } from "@packages/domain-driven-design/domain-event.js";
import { describe, expect, it } from "vitest";

const ACCOUNT_ID = "account-opened";

describe("DomainEvent", () => {
  it("provides the routing type and payload needed by an event consumer", () => {
    const systemUnderTest = createSystemUnderTest();

    systemUnderTest.whenAnAccountOpeningIsRecorded();

    systemUnderTest.thenTheEventCanBeRoutedToItsConsumer();
  });

  it("identifies repeated events independently while keeping an event's identity stable", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAnAccountOpeningWasRecorded();

    systemUnderTest.whenTheSamePayloadIsRecordedAgain();

    systemUnderTest.thenTheEventsHaveDistinctStableIdentities();
  });
});

function createSystemUnderTest() {
  let event: AccountOpened;
  let otherEvent: AccountOpened;
  let originalIdentity: string;

  return {
    givenAnAccountOpeningWasRecorded() {
      event = new AccountOpened({ payload: { accountId: ACCOUNT_ID } });
      originalIdentity = event.id;
    },
    whenAnAccountOpeningIsRecorded() {
      event = new AccountOpened({ payload: { accountId: ACCOUNT_ID } });
    },
    whenTheSamePayloadIsRecordedAgain() {
      otherEvent = new AccountOpened({ payload: { accountId: ACCOUNT_ID } });
    },
    thenTheEventCanBeRoutedToItsConsumer() {
      expect(event.type).toBe("AccountOpened");
      expect(event.payload).toEqual({ accountId: ACCOUNT_ID });
    },
    thenTheEventsHaveDistinctStableIdentities() {
      expect(event.id).toBe(originalIdentity);
      expect(event.id).not.toBe(otherEvent.id);
    },
  };
}

class AccountOpened extends DomainEvent<{ accountId: string }> {}
