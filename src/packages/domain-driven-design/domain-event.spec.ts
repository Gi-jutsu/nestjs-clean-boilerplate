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
      expect(event.id).toMatch(UUID_PATTERN);
    },
    thenTheEventsHaveDistinctStableIdentities() {
      expect(event.id).toBe(originalIdentity);
      expect(otherEvent.id).toMatch(UUID_PATTERN);
      expect(event.id).not.toBe(otherEvent.id);
    },
  };
}

class AccountOpened extends DomainEvent<{ accountId: string }> {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
