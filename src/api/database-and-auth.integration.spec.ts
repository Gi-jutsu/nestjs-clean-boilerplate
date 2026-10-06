import { ApplicationModule } from "@api/application.module.js";
import {
  accountSchema,
  sessionSchema,
  userSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { getDrizzleToken } from "@nestjs/drizzle";
import { sql } from "drizzle-orm";
import supertest, { type Response } from "supertest";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

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

  beforeEach(async () => {
    application = await createApplication();
    onTestFinished(() => application.close());
    const database = application.get<SharedKernelDatabase>(getDrizzleToken());
    await database.execute(
      sql`TRUNCATE TABLE "user", "session", "account", "verification" CASCADE`,
    );
  });
});

function createSystemUnderTest(application: INestApplication) {
  const database = application.get<SharedKernelDatabase>(getDrizzleToken());
  const client = supertest(application.getHttpServer());
  let signInResponse: Response;

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
    async thenTheCredentialsAndSessionAreStored() {
      expect(signInResponse.status).toBe(200);
      const [storedUser] = await database.select().from(userSchema);
      const [storedAccount] = await database.select().from(accountSchema);
      expect(storedUser).toMatchObject({
        email: REGISTERED_USER.email,
        name: REGISTERED_USER.name,
      });
      expect(storedAccount).toMatchObject({
        providerId: "credential",
        userId: storedUser.id,
      });
      expect(await database.select().from(sessionSchema)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: storedUser.id }),
        ]),
      );
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
  };
}

async function createApplication() {
  const application = await NestFactory.create(ApplicationModule, {
    bodyParser: false,
    logger: false,
  });
  try {
    await application.init();
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}
