import { Entity } from "@packages/domain-driven-design/entity.js";
import { describe, expect, it } from "vitest";

const ACCOUNT_ID = "existing-account";
const ORIGINAL_NAME = "Original account";
const UPDATED_NAME = "Updated account";

describe("Entity", () => {
  it("keeps a supplied identity when reconstructing an entity", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAStoredAccount();

    systemUnderTest.whenTheAccountIsHydrated();

    systemUnderTest.thenTheStoredAccountIsReconstructed();
  });

  it("gives newly created entities independent identities", () => {
    const systemUnderTest = createSystemUnderTest();

    systemUnderTest.whenTwoAccountsAreCreated();

    systemUnderTest.thenTheirIdentitiesAreDistinct();
  });

  it("prevents callers from changing an entity through its public properties", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAnAccount();

    systemUnderTest.whenThePublicPropertiesAreChanged();

    systemUnderTest.thenThePublicChangeIsRefused();
    systemUnderTest.thenTheAccountStillHasItsOriginalName();
  });

  it("keeps an earlier properties view stable when the entity changes", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAnAccountAndItsPropertiesView();

    systemUnderTest.whenTheAccountIsRenamed();

    systemUnderTest.thenTheEarlierViewKeepsTheOriginalName();
    systemUnderTest.thenTheAccountHasTheUpdatedName();
  });

  it("lets persistence callers edit a snapshot without changing the entity", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAnAccount();

    systemUnderTest.whenThePersistenceSnapshotIsEdited();

    systemUnderTest.thenTheSnapshotContainsTheEditedName();
    systemUnderTest.thenTheAccountStillHasItsOriginalName();
  });

  it("keeps an earlier snapshot stable when the entity changes", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAnAccountAndItsSnapshot();

    systemUnderTest.whenTheAccountIsRenamed();

    systemUnderTest.thenTheEarlierSnapshotKeepsTheOriginalName();
    systemUnderTest.thenTheAccountHasTheUpdatedName();
  });

  it("allows a hydrated entity to change without rewriting its input snapshot", () => {
    const systemUnderTest = createSystemUnderTest();
    systemUnderTest.givenAStoredAccount();
    systemUnderTest.givenTheAccountIsHydrated();

    systemUnderTest.whenTheAccountIsRenamed();

    systemUnderTest.thenTheStoredSnapshotKeepsTheOriginalName();
    systemUnderTest.thenTheAccountHasTheUpdatedName();
  });
});

function createSystemUnderTest() {
  let account: Account;
  let otherAccount: Account;
  let storedSnapshot: { id: string; name: string };
  let persistenceSnapshot: { id: string; name: string };
  let propertiesView: Readonly<{ id: string; name: string }>;
  let publicChangeFailure: unknown;

  return {
    givenAStoredAccount() {
      storedSnapshot = { id: ACCOUNT_ID, name: ORIGINAL_NAME };
    },
    givenAnAccount() {
      account = new Account({
        id: ACCOUNT_ID,
        properties: { name: ORIGINAL_NAME },
      });
    },
    givenAnAccountAndItsPropertiesView() {
      account = new Account({
        id: ACCOUNT_ID,
        properties: { name: ORIGINAL_NAME },
      });
      propertiesView = account.properties;
    },
    givenAnAccountAndItsSnapshot() {
      account = new Account({
        id: ACCOUNT_ID,
        properties: { name: ORIGINAL_NAME },
      });
      persistenceSnapshot = account.snapshot();
    },
    givenTheAccountIsHydrated() {
      account = Account.fromSnapshot(storedSnapshot);
    },
    whenTheAccountIsHydrated() {
      account = Account.fromSnapshot(storedSnapshot);
    },
    whenTwoAccountsAreCreated() {
      account = new Account({ properties: { name: ORIGINAL_NAME } });
      otherAccount = new Account({ properties: { name: ORIGINAL_NAME } });
    },
    whenThePublicPropertiesAreChanged() {
      try {
        Object.assign(account.properties, { name: UPDATED_NAME });
      } catch (error) {
        publicChangeFailure = error;
      }
    },
    whenTheAccountIsRenamed() {
      account.rename(UPDATED_NAME);
    },
    whenThePersistenceSnapshotIsEdited() {
      persistenceSnapshot = account.snapshot();
      persistenceSnapshot.name = UPDATED_NAME;
    },
    thenTheStoredAccountIsReconstructed() {
      expect(account).toBeInstanceOf(Account);
      expect(account.id).toBe(ACCOUNT_ID);
      expect(account.snapshot()).toEqual(storedSnapshot);
    },
    thenTheirIdentitiesAreDistinct() {
      expect(account.id).toMatch(UUID_PATTERN);
      expect(otherAccount.id).toMatch(UUID_PATTERN);
      expect(account.id).not.toBe(otherAccount.id);
    },
    thenThePublicChangeIsRefused() {
      expect(publicChangeFailure).toBeInstanceOf(TypeError);
    },
    thenTheAccountStillHasItsOriginalName() {
      expect(account.snapshot()).toEqual({
        id: ACCOUNT_ID,
        name: ORIGINAL_NAME,
      });
    },
    thenTheEarlierViewKeepsTheOriginalName() {
      expect(propertiesView).toEqual({ id: ACCOUNT_ID, name: ORIGINAL_NAME });
    },
    thenTheAccountHasTheUpdatedName() {
      expect(account.snapshot()).toEqual({
        id: ACCOUNT_ID,
        name: UPDATED_NAME,
      });
    },
    thenTheSnapshotContainsTheEditedName() {
      expect(persistenceSnapshot).toEqual({
        id: ACCOUNT_ID,
        name: UPDATED_NAME,
      });
    },
    thenTheEarlierSnapshotKeepsTheOriginalName() {
      expect(persistenceSnapshot).toEqual({
        id: ACCOUNT_ID,
        name: ORIGINAL_NAME,
      });
    },
    thenTheStoredSnapshotKeepsTheOriginalName() {
      expect(storedSnapshot).toEqual({ id: ACCOUNT_ID, name: ORIGINAL_NAME });
    },
  };
}

class Account extends Entity<{ name: string }> {
  rename(name: string) {
    this._properties.name = name;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
