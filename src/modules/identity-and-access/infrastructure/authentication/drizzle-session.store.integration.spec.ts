import { ApplicationModule } from "@api/application.module.js";
import { userSchema } from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import type {
  MfaStore,
  RefreshTokenStore,
  SessionRecord,
} from "@nestjs/authentication";
import type { INestApplication } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";
import { DisabledAuthenticationFeaturesStore } from "./disabled-authentication-features.store.js";
import { DrizzleSessionStore } from "./drizzle-session.store.js";

const SESSION: SessionRecord = {
  id: "session-with-metadata",
  userId: "session-user",
  createdAt: new Date("2020-01-01T00:00:00Z"),
  expiresAt: new Date("2020-01-08T00:00:00Z"),
  lastActiveAt: new Date("2020-01-01T00:00:00Z"),
  mfa: "pending",
  metadata: {
    device: "O'Reilly ü",
    tags: ["browser", 1],
    nested: { active: true },
  },
};
const BARE_SESSION: SessionRecord = {
  id: "session-without-metadata",
  userId: SESSION.userId,
  createdAt: SESSION.createdAt,
  expiresAt: SESSION.expiresAt,
  lastActiveAt: SESSION.lastActiveAt,
};
const OTHER_SESSION: SessionRecord = {
  ...BARE_SESSION,
  id: "other-session",
  userId: "other-user",
};
const LATEST_ACTIVITY = new Date("2020-01-02T00:00:00Z");

describe("DrizzleSessionStore", () => {
  let application: INestApplication;

  it("restores dates and JSON while omitting absent optional fields", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenSessionsWithAndWithoutMetadata();

    await systemUnderTest.whenTheSessionsAreRead();

    await systemUnderTest.thenTheStoredFieldsAreRestored();
  });

  it("lists and revokes one user's sessions without affecting another user", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenSessionsBelongingToDifferentUsers();

    await systemUnderTest.whenTheUserSessionsAreRevoked();

    await systemUnderTest.thenOnlyTheSelectedUserSessionsAreRevoked();
  });

  it("keeps activity monotonic during concurrent touches and cannot recreate a deleted session", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenASessionAndAnotherUsersSession();

    await systemUnderTest.whenConcurrentRequestsTouchTheSession();

    await systemUnderTest.thenOnlyTheLatestActivityIsChanged();

    await systemUnderTest.whenTheDeletedSessionIsTouched();

    await systemUnderTest.thenTheSessionRemainsDeleted();
  });

  it("reports exactly one successful deletion when requests race", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenASessionAndAnotherUsersSession();

    await systemUnderTest.whenRequestsDeleteTheSessionConcurrently();

    await systemUnderTest.thenOnlyOneDeletionSucceeds();
  });

  it("keeps unused authentication features empty and rejects their writes", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.thenDisabledFeaturesContainNoCredentials();
    await systemUnderTest.thenDisabledFeatureWritesAreRefused();
  });

  beforeEach(async () => {
    application = await createSessionStoreTestApplication();
    onTestFinished(() => application.close());
    await application
      .get<SharedKernelDatabase>(getDrizzleToken())
      .execute(sql`TRUNCATE TABLE "user", "authentication_session" CASCADE`);
  });
});

function createSystemUnderTest(application: INestApplication) {
  const database = application.get<SharedKernelDatabase>(getDrizzleToken());
  const store = application.get(DrizzleSessionStore);
  let restoredSessions: (SessionRecord | undefined)[];
  let listedSessions: SessionRecord[];
  let deletionResults: boolean[];

  async function createSessions(...records: SessionRecord[]) {
    for (const record of records) {
      await database
        .insert(userSchema)
        .values({
          id: record.userId,
          name: "Session User",
          email: `${record.userId}@example.com`,
        })
        .onConflictDoNothing();
      await store.createSession(record);
    }
  }

  return {
    ...createDisabledFeaturesSystemUnderTest(application),
    givenASessionAndAnotherUsersSession: () =>
      createSessions(SESSION, OTHER_SESSION),
    givenSessionsWithAndWithoutMetadata: () =>
      createSessions(SESSION, BARE_SESSION),
    givenSessionsBelongingToDifferentUsers: () =>
      createSessions(SESSION, BARE_SESSION, OTHER_SESSION),
    async whenTheSessionsAreRead() {
      restoredSessions = await Promise.all([
        store.getSession(SESSION.id),
        store.getSession(BARE_SESSION.id),
        store.getSession("missing-session"),
      ]);
    },
    async thenTheStoredFieldsAreRestored() {
      expect(restoredSessions).toEqual([SESSION, BARE_SESSION, undefined]);
      const persisted = await database.$client.query(`
        SELECT id, user_id, created_at, expires_at, last_active_at, mfa, metadata
        FROM "authentication_session"
        ORDER BY id
      `);
      expect(persisted.rows).toEqual([
        {
          id: SESSION.id,
          user_id: SESSION.userId,
          created_at: SESSION.createdAt,
          expires_at: SESSION.expiresAt,
          last_active_at: SESSION.lastActiveAt,
          mfa: SESSION.mfa,
          metadata: SESSION.metadata,
        },
        {
          id: BARE_SESSION.id,
          user_id: BARE_SESSION.userId,
          created_at: BARE_SESSION.createdAt,
          expires_at: BARE_SESSION.expiresAt,
          last_active_at: BARE_SESSION.lastActiveAt,
          mfa: null,
          metadata: null,
        },
      ]);
    },
    async whenTheUserSessionsAreRevoked() {
      listedSessions = await store.listUserSessions(SESSION.userId);
      await store.deleteUserSessions(SESSION.userId);
    },
    async thenOnlyTheSelectedUserSessionsAreRevoked() {
      expect(listedSessions).toHaveLength(2);
      expect(listedSessions).toEqual(
        expect.arrayContaining([SESSION, BARE_SESSION]),
      );
      expect(await store.listUserSessions(SESSION.userId)).toEqual([]);
      expect(await store.listUserSessions("missing-user")).toEqual([]);
      expect(await store.getSession(OTHER_SESSION.id)).toEqual(OTHER_SESSION);
    },
    async whenConcurrentRequestsTouchTheSession() {
      await Promise.all([
        store.touchSession(SESSION.id, LATEST_ACTIVITY),
        store.touchSession(SESSION.id, new Date("2020-01-01T00:01:00Z")),
        store.touchSession(SESSION.id, new Date("2020-01-01T00:02:00Z")),
      ]);
      await store.touchSession(SESSION.id, SESSION.lastActiveAt);
    },
    async thenOnlyTheLatestActivityIsChanged() {
      expect(await store.getSession(SESSION.id)).toEqual({
        ...SESSION,
        lastActiveAt: LATEST_ACTIVITY,
      });
      expect(await store.getSession(OTHER_SESSION.id)).toEqual(OTHER_SESSION);
    },
    async whenTheDeletedSessionIsTouched() {
      await store.deleteSession(SESSION.id);
      await store.touchSession(SESSION.id, new Date("2020-01-03T00:00:00Z"));
      await store.touchSession("missing-session", LATEST_ACTIVITY);
    },
    async thenTheSessionRemainsDeleted() {
      expect(await store.getSession(SESSION.id)).toBeUndefined();
      expect(await store.listUserSessions(SESSION.userId)).toEqual([]);
      expect(await store.getSession(OTHER_SESSION.id)).toEqual(OTHER_SESSION);
    },
    async whenRequestsDeleteTheSessionConcurrently() {
      deletionResults = await Promise.all([
        store.deleteSession(SESSION.id),
        store.deleteSession(SESSION.id),
        store.deleteSession(SESSION.id),
      ]);
    },
    async thenOnlyOneDeletionSucceeds() {
      expect(deletionResults.sort()).toEqual([false, false, true]);
      expect(await store.deleteSession(SESSION.id)).toBe(false);
      expect(await store.deleteSession("missing-session")).toBe(false);
      expect(await store.getSession(SESSION.id)).toBeUndefined();
      expect(await store.getSession(OTHER_SESSION.id)).toEqual(OTHER_SESSION);
    },
  };
}

async function createSessionStoreTestApplication() {
  const testingModule = await Test.createTestingModule({
    imports: [ApplicationModule],
  }).compile();
  const application = testingModule.createNestApplication();
  application.useLogger(false);
  try {
    await application.init();
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}

function createDisabledFeaturesSystemUnderTest(application: INestApplication) {
  const store = application.get(DisabledAuthenticationFeaturesStore);
  const mfa: MfaStore = store;
  const refreshTokens: RefreshTokenStore = store;

  return {
    async thenDisabledFeaturesContainNoCredentials() {
      expect(await mfa.getTotp("user")).toBeUndefined();
      expect(await mfa.countRecoveryCodes("user")).toBe(0);
      expect(await mfa.countMfaFailures("user", 1_000, Date.now())).toBe(0);
      expect(await refreshTokens.getRefreshToken("token")).toBeUndefined();
      expect(await refreshTokens.isRefreshTokenFamilyRevoked("family")).toBe(
        true,
      );
      await mfa.clearMfaFailures("user");
      await refreshTokens.revokeRefreshTokenFamily("family");
      await refreshTokens.revokeUserRefreshTokens("user");
    },
    async thenDisabledFeatureWritesAreRefused() {
      await expect(
        mfa.saveTotp("user", { secret: "secret", confirmed: false }),
      ).rejects.toThrow("disabled");
      await expect(mfa.claimTotpStep("user", 1)).rejects.toThrow("disabled");
      await expect(mfa.saveRecoveryCodes("user", ["hash"])).rejects.toThrow(
        "disabled",
      );
      await expect(mfa.consumeRecoveryCode("user", "hash")).rejects.toThrow(
        "disabled",
      );
      await expect(
        mfa.recordMfaFailure("user", 1_000, Date.now()),
      ).rejects.toThrow("disabled");
      await expect(
        refreshTokens.saveRefreshToken({
          id: "id",
          familyId: "family",
          userId: "user",
          createdAt: new Date(),
          expiresAt: new Date(),
          familyExpiresAt: new Date(),
        }),
      ).rejects.toThrow("disabled");
      await expect(
        refreshTokens.markRefreshTokenUsed("id", new Date()),
      ).rejects.toThrow("disabled");
    },
  };
}
