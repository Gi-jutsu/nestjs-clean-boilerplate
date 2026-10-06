import { ApplicationModule } from "@api/application.module.js";
import { userSchema } from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import type {
  MfaStore,
  RefreshTokenStore,
  SessionStore,
} from "@nestjs/authentication";
import {
  authenticationStoreContract,
  type AuthenticationStoreContractCase,
} from "@nestjs/authentication/testing";
import type { INestApplication } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DisabledAuthenticationFeaturesStore } from "./disabled-authentication-features.store.js";
import { DrizzleSessionStore } from "./drizzle-session.store.js";

describe("DrizzleSessionStore", () => {
  let application: INestApplication;
  let database: SharedKernelDatabase;

  const contractCases = authenticationStoreContract(
    async () => {
      const store = application.get(DrizzleSessionStore);
      // The package generates arbitrary user ids; seed the real foreign-key target.
      const sessions: SessionStore = {
        getSession: store.getSession.bind(store),
        touchSession: store.touchSession.bind(store),
        deleteSession: store.deleteSession.bind(store),
        listUserSessions: store.listUserSessions.bind(store),
        deleteUserSessions: store.deleteUserSessions.bind(store),
        async createSession(record) {
          await database
            .insert(userSchema)
            .values({
              id: record.userId,
              name: "Contract User",
              email: `${record.userId}@example.com`,
            })
            .onConflictDoNothing();
          await store.createSession(record);
        },
      };
      return { sessions };
    },
    { contracts: ["sessions"], concurrent: true },
  );

  for (const contractCase of contractCases) {
    it(contractCase.name, async () => {
      const systemUnderTest = createSystemUnderTest(contractCase);
      await systemUnderTest.thenTheStoreSatisfiesItsContract();
    });
  }

  it("keeps unused authentication features empty and rejects their writes", async () => {
    const systemUnderTest = createDisabledFeaturesSystemUnderTest(application);
    await systemUnderTest.thenDisabledFeaturesContainNoCredentials();
    await systemUnderTest.thenDisabledFeatureWritesAreRefused();
  });

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [ApplicationModule],
    }).compile();
    application = testingModule.createNestApplication();
    application.useLogger(false);
    await application.init();
    database = application.get(getDrizzleToken());
  });
  beforeEach(() =>
    database.execute(
      sql`TRUNCATE TABLE "user", "authentication_session" CASCADE`,
    ),
  );
  afterAll(() => application.close());
});

function createSystemUnderTest(contractCase: AuthenticationStoreContractCase) {
  return {
    async thenTheStoreSatisfiesItsContract() {
      await contractCase.run();
    },
  };
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
