import {
  accountSchema,
  sessionSchema,
  userSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import type { INestApplication } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { eq, sql } from "drizzle-orm";
import supertest, { type Response } from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestingApplication } from "../../specs/testing-application.js";

const REGISTERED_USER = {
  email: "drizzle-user@example.com",
  name: "Drizzle User",
  password: "a-secure-test-password",
};

describe("ApplicationModule database and authentication", () => {
  let application: INestApplication;

  it("persists credentials and sessions through the registered database", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();

    await systemUnderTest.whenTheUserSignsIn();

    await systemUnderTest.thenTheCredentialsAndSessionAreStored();
    await systemUnderTest.thenTheSessionIdentifiesTheUser();
    systemUnderTest.thenTheOfficialAndTypedTokensResolveTheSameDatabase();
  });

  it("rolls back writes made through the injected database", async () => {
    const systemUnderTest = createSystemUnderTest(application);

    await systemUnderTest.whenAUserRegistrationTransactionFails();

    await systemUnderTest.thenNoUserIsStored();
  });

  it("closes the shared connection pool when the application stops", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();

    await systemUnderTest.whenTheApplicationStops();

    await systemUnderTest.thenTheDatabaseConnectionIsClosed();
    await systemUnderTest.thenAuthenticationCannotOpenAnotherConnection();
  });

  it("gives separate applications independent connection pools", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();

    await systemUnderTest.whenAnotherApplicationSurvivesTheFirstStopping();

    systemUnderTest.thenTheOtherApplicationCanAuthenticate();
  });

  beforeEach(async () => {
    application = await createTestingApplication();
    const database = application.get<SharedKernelDatabase>(getDrizzleToken());
    await database.execute(
      sql`TRUNCATE TABLE "user", "session", "account", "verification" CASCADE`,
    );
  });

  afterEach(async () => {
    await application.close();
  });
});

function createSystemUnderTest(application: INestApplication) {
  const database = application.get<SharedKernelDatabase>(getDrizzleToken());
  const authentication = application.get(AuthService);
  const client = supertest(application.getHttpServer());
  let signInResponse: Response;
  let otherApplicationSignInResponse: Response;
  let otherDatabase: SharedKernelDatabase;
  let transactionFailure: unknown;
  const registrationFailure = new Error("Registration transaction failed");

  return {
    async givenARegisteredUser() {
      const response = await client
        .post("/api/auth/sign-up/email")
        .send(REGISTERED_USER);
      expect(response.status).toBe(200);
    },

    async whenTheUserSignsIn() {
      signInResponse = await client.post("/api/auth/sign-in/email").send({
        email: REGISTERED_USER.email,
        password: REGISTERED_USER.password,
      });
    },

    async whenAUserRegistrationTransactionFails() {
      try {
        await database.transaction(async (transaction) => {
          await transaction.insert(userSchema).values({
            ...REGISTERED_USER,
            id: "rolled-back-user",
          });
          throw registrationFailure;
        });
      } catch (error) {
        transactionFailure = error;
      }
    },

    async whenTheApplicationStops() {
      await application.close();
    },

    async whenAnotherApplicationSurvivesTheFirstStopping() {
      const otherApplication = await createTestingApplication();
      try {
        otherDatabase =
          otherApplication.get<SharedKernelDatabase>(getDrizzleToken());
        await application.close();
        otherApplicationSignInResponse = await supertest(
          otherApplication.getHttpServer(),
        )
          .post("/api/auth/sign-in/email")
          .send({
            email: REGISTERED_USER.email,
            password: REGISTERED_USER.password,
          });
      } finally {
        await otherApplication.close();
      }
    },

    async thenTheCredentialsAndSessionAreStored() {
      expect(signInResponse.status).toBe(200);
      const [storedUser] = await database.select().from(userSchema);
      const [storedAccount] = await database.select().from(accountSchema);
      const storedSessions = await database.select().from(sessionSchema);
      expect(storedUser).toMatchObject({
        email: REGISTERED_USER.email,
        name: REGISTERED_USER.name,
      });
      expect(storedAccount).toMatchObject({
        providerId: "credential",
        userId: storedUser.id,
      });
      expect(storedAccount.password).toEqual(expect.any(String));
      expect(storedAccount.password).not.toBe(REGISTERED_USER.password);
      expect(storedSessions).toHaveLength(2);
      expect(
        storedSessions.every((session) => session.userId === storedUser.id),
      ).toBe(true);
      const relationalUser = await database.query.user.findFirst({
        where: eq(userSchema.email, REGISTERED_USER.email),
      });
      expect(relationalUser).toEqual(storedUser);
    },

    async thenTheSessionIdentifiesTheUser() {
      const sessionResponse = await client
        .get("/api/auth/get-session")
        .set("Cookie", signInResponse.headers["set-cookie"]);
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.user).toMatchObject({
        email: REGISTERED_USER.email,
      });
    },

    thenTheOfficialAndTypedTokensResolveTheSameDatabase() {
      expect(application.get(SharedKernelDatabaseToken)).toBe(database);
    },

    async thenNoUserIsStored() {
      expect(transactionFailure).toBe(registrationFailure);
      expect(await database.select().from(userSchema)).toEqual([]);
    },

    async thenTheDatabaseConnectionIsClosed() {
      expect(database.$client.ended).toBe(true);
      expect(database.$client.totalCount).toBe(0);
      await expect(database.execute(sql`SELECT 1`)).rejects.toThrow();
    },

    async thenAuthenticationCannotOpenAnotherConnection() {
      await expect(
        authentication.api.signInEmail({
          body: {
            email: REGISTERED_USER.email,
            password: REGISTERED_USER.password,
          },
        }),
      ).rejects.toThrow();
    },

    thenTheOtherApplicationCanAuthenticate() {
      expect(otherDatabase.$client).not.toBe(database.$client);
      expect(otherApplicationSignInResponse.status).toBe(200);
      expect(otherApplicationSignInResponse.body.user.email).toBe(
        REGISTERED_USER.email,
      );
    },
  };
}
