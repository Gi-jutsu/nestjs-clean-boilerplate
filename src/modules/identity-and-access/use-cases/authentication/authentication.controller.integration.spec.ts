import { ApplicationModule } from "@api/application.module.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { IdentityAndAccessEnvironmentKeys } from "@modules/identity-and-access/environment.js";
import type { AuthenticationUser } from "@modules/identity-and-access/infrastructure/authentication/authentication-user.js";
import {
  accountSchema,
  authenticationSessionSchema,
  userSchema,
} from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { CurrentUser, PasswordHasher } from "@nestjs/authentication";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getDrizzleToken } from "@nestjs/drizzle";
import { Test } from "@nestjs/testing";
import { eq, sql } from "drizzle-orm";
import supertest, { type Response } from "supertest";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

const USER = {
  name: "Example User",
  email: "user@example.com",
  password: "a-secure-password",
};
const LEGACY_PASSWORD = "café-Password-123";
const OVERSIZED_NORMALIZED_PASSWORD = "\uFDFA".repeat(128);
const LEGACY_PASSWORD_HASH =
  "2d8361dcc1b5ce89a168f04fc4c3ea59:8796e28950e3bf5f130c07d59fe0180030621ee8df901175083a8efe2ced807e51427b657156a8febef39e84f01dc622cf7f34738e5d75c2674f04b77fc4e636";

@Controller("authentication-test")
class ProtectedController {
  @Get()
  handle(@CurrentUser() user: AuthenticationUser) {
    return { id: user.id };
  }
}

describe("AuthenticationHttpController", () => {
  let application: INestApplication;

  it("persists a user and credential and authenticates their registration cookie", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenTheUserSignsUp();
    systemUnderTest.thenTheResponseHasStatus(200);
    await systemUnderTest.thenTheUserAndCredentialAreStored();
    systemUnderTest.thenTheCookieMatchesItsSecurityConfiguration();
    await systemUnderTest.whenAProtectedRouteIsRequested();
    systemUnderTest.thenTheResponseHasStatus(200);
    await systemUnderTest.thenTheProtectedResponseIdentifiesTheUser();
  });

  it("authenticates email addresses without case sensitivity", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();
    await systemUnderTest.whenTheUserSignsIn("USER@EXAMPLE.COM");
    systemUnderTest.thenTheResponseHasStatus(200);
    await systemUnderTest.thenTheSessionIdentifiesTheUser();
    await systemUnderTest.whenAProtectedRouteIsRequested();
    systemUnderTest.thenTheResponseHasStatus(200);
    await systemUnderTest.thenTheProtectedResponseIdentifiesTheUser();
  });

  it("refuses an incorrect password without issuing another session", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();
    await systemUnderTest.whenTheUserSignsIn(USER.email, "incorrect-password");
    systemUnderTest.thenTheInvalidCredentialsAreRefused();
    await systemUnderTest.thenThereIsOneSession();
  });

  it("gives an unknown email the same invalid-credentials response", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenTheUserSignsIn("unknown@example.com");
    systemUnderTest.thenTheInvalidCredentialsAreRefused();
    await systemUnderTest.thenNoUserIsStored();
  });

  it.each([{ email: "invalid" }, { password: "short" }, { name: "" }])(
    "refuses invalid sign-up input before persistence: %j",
    async (invalidFields) => {
      const systemUnderTest = createSystemUnderTest(application);
      await systemUnderTest.whenTheUserSignsUp(invalidFields);
      systemUnderTest.thenTheResponseHasStatus(400);
      await systemUnderTest.thenNoUserIsStored();
    },
  );

  it("refuses a sign-up password that exceeds the normalized byte limit", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenTheUserSignsUp({
      password: OVERSIZED_NORMALIZED_PASSWORD,
    });
    systemUnderTest.thenTheResponseHasStatus(400);
    await systemUnderTest.thenNoUserIsStored();
    await systemUnderTest.thenNoSessionIsStored();
  });

  it("refuses a sign-in password that exceeds the normalized byte limit", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();
    await systemUnderTest.whenTheUserSignsIn(
      USER.email,
      OVERSIZED_NORMALIZED_PASSWORD,
    );
    systemUnderTest.thenTheResponseHasStatus(400);
    await systemUnderTest.thenThereIsOneSession();
  });

  it("refuses duplicate email addresses", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();
    await systemUnderTest.whenTheUserSignsUp();
    systemUnderTest.thenTheResponseHasStatus(422);
    await systemUnderTest.thenThereIsOneUserAndCredential();
  });

  it("keeps one user and credential when duplicate registrations race", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenTwoRegistrationsRace();
    systemUnderTest.thenOnlyOneRegistrationSucceeds();
    await systemUnderTest.thenThereIsOneUserAndCredential();
  });

  it("keeps session lookup and sign-out available to anonymous visitors", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenTheCurrentSessionIsRequested();
    systemUnderTest.thenTheCurrentSessionIsEmpty();
    await systemUnderTest.whenTheUserSignsOut();
    systemUnderTest.thenTheSignOutSucceeds();
  });

  it("protects routes by default", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenAProtectedRouteIsRequested();
    systemUnderTest.thenTheResponseHasStatus(401);
  });

  it("revokes the stored session and clears its cookie on sign-out", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenARegisteredUser();
    await systemUnderTest.whenTheUserSignsOut();
    systemUnderTest.thenTheSignOutSucceeds();
    systemUnderTest.thenTheCookieIsCleared();
    await systemUnderTest.thenNoSessionIsStored();
  });

  it("refuses a cross-origin registration before creating a user", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenAnotherWebsiteAttemptsToRegister();
    systemUnderTest.thenTheResponseHasStatus(403);
    await systemUnderTest.thenNoUserIsStored();
  });

  it("accepts a registration from the configured API origin", async () => {
    const systemUnderTest = createSystemUnderTest(application);

    await systemUnderTest.whenTheConfiguredWebsiteRegisters();

    systemUnderTest.thenTheResponseHasStatus(200);
    await systemUnderTest.thenThereIsOneUserAndCredential();
  });

  it("preserves a legacy user and upgrades their password after sign-in", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenALegacyUser();
    await systemUnderTest.whenTheUserSignsIn(USER.email, LEGACY_PASSWORD);
    systemUnderTest.thenTheResponseHasStatus(200);
    await systemUnderTest.thenTheLegacyUserAndUpgradedPasswordAreStored();
    await systemUnderTest.thenTheSessionIdentifiesTheUser();
    await systemUnderTest.whenTheUserSignsIn(USER.email, LEGACY_PASSWORD);
    systemUnderTest.thenTheResponseHasStatus(200);
  });

  it("leaves a legacy password untouched after a failed sign-in", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.givenALegacyUser();
    await systemUnderTest.whenTheUserSignsIn(USER.email, "incorrect-password");
    systemUnderTest.thenTheInvalidCredentialsAreRefused();
    await systemUnderTest.thenTheLegacyPasswordIsUnchanged();
  });

  it("starts with persistent session storage in production", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenAnApplicationStartsInProduction();
    systemUnderTest.thenProductionInitializationSucceeds();
  });

  beforeEach(async () => {
    application = await createAuthenticationTestApplication();
    onTestFinished(() => application.close());
    await application
      .get<SharedKernelDatabase>(getDrizzleToken())
      .execute(
        sql`TRUNCATE TABLE "user", "account", "session", "authentication_session" CASCADE`,
      );
  });
});

function createSystemUnderTest(application: INestApplication) {
  const database = application.get<SharedKernelDatabase>(getDrizzleToken());
  const client = supertest(application.getHttpServer());
  let response: Response;
  let cookie: string;
  let registrationStatuses: number[];
  let productionInitialized = false;

  async function signUp(overrides: Partial<typeof USER> = {}, origin?: string) {
    const request = client
      .post("/api/auth/sign-up/email")
      .send({ ...USER, ...overrides });
    if (origin) request.set("Origin", origin);
    response = await request;
    if (response.headers["set-cookie"])
      cookie = response.headers["set-cookie"][0].split(";")[0];
  }

  return {
    givenARegisteredUser: () => signUp(),
    whenTheUserSignsUp: signUp,
    async givenALegacyUser() {
      const createdAt = new Date("2020-01-01T00:00:00Z");
      await database.insert(userSchema).values({
        id: "legacy-user",
        name: USER.name,
        email: USER.email,
        emailVerified: true,
        image: "https://example.com/avatar.png",
        createdAt,
        updatedAt: createdAt,
      });
      await database.insert(accountSchema).values({
        id: "legacy-account",
        accountId: "legacy-user",
        providerId: "credential",
        userId: "legacy-user",
        password: LEGACY_PASSWORD_HASH,
        createdAt,
        updatedAt: createdAt,
      });
    },
    async whenTheUserSignsIn(email = USER.email, password = USER.password) {
      const request = client
        .post("/api/auth/sign-in/email")
        .send({ email, password });
      if (cookie) request.set("Cookie", cookie);
      response = await request;
      if (response.headers["set-cookie"])
        cookie = response.headers["set-cookie"][0].split(";")[0];
    },
    async whenTwoRegistrationsRace() {
      const responses = await Promise.all([
        client.post("/api/auth/sign-up/email").send(USER),
        client.post("/api/auth/sign-up/email").send(USER),
      ]);
      registrationStatuses = responses
        .map((registration) => registration.status)
        .sort();
    },
    whenAnotherWebsiteAttemptsToRegister: () =>
      signUp({}, "https://untrusted.example.com"),
    whenTheConfiguredWebsiteRegisters() {
      const origin = new URL(
        application.get(ConfigService).getOrThrow<string>("API_BASE_URL"),
      ).origin;
      return signUp({}, origin);
    },
    async whenTheCurrentSessionIsRequested() {
      const request = client.get("/api/auth/get-session");
      if (cookie) request.set("Cookie", cookie);
      response = await request;
    },
    async whenAProtectedRouteIsRequested() {
      const request = client.get("/authentication-test");
      if (cookie) request.set("Cookie", cookie);
      response = await request;
    },
    async whenTheUserSignsOut() {
      const request = client.post("/api/auth/sign-out");
      if (cookie) request.set("Cookie", cookie);
      response = await request;
    },
    async whenAnApplicationStartsInProduction() {
      const previousEnvironment = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const productionApplication =
          await createAuthenticationTestApplication();
        await productionApplication.close();
        productionInitialized = true;
      } finally {
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
      }
    },
    thenProductionInitializationSucceeds() {
      expect(productionInitialized).toBe(true);
    },
    thenTheResponseHasStatus(status: number) {
      expect(response.status).toBe(status);
    },
    thenTheInvalidCredentialsAreRefused() {
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
        detail: "Invalid email or password",
      });
    },
    thenOnlyOneRegistrationSucceeds() {
      expect(registrationStatuses).toEqual([200, 422]);
    },
    thenTheCurrentSessionIsEmpty() {
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    },
    thenTheSignOutSucceeds() {
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    },
    async thenTheProtectedResponseIdentifiesTheUser() {
      const [user] = await database.select().from(userSchema);
      expect(response.body).toEqual({ id: user.id });
    },
    thenTheCookieMatchesItsSecurityConfiguration() {
      expect(response.headers["set-cookie"][0]).toMatch(/HttpOnly/i);
      const secure = application
        .get(ConfigService)
        .getOrThrow<boolean>(
          IdentityAndAccessEnvironmentKeys.AUTH_COOKIE_SECURE,
        );
      expect(
        /(?:^|;\s*)Secure(?:;|$)/i.test(response.headers["set-cookie"][0]),
      ).toBe(secure);
      expect(response.headers["set-cookie"][0]).toMatch(/SameSite=Lax/i);
      expect(response.body.token).toBeNull();
    },
    thenTheCookieIsCleared() {
      expect(response.headers["set-cookie"][0]).toMatch(/Max-Age=0/i);
    },
    async thenTheUserAndCredentialAreStored() {
      expect(application.get(SharedKernelDatabaseToken)).toBe(database);
      const [user] = await database.select().from(userSchema);
      const [account] = await database.select().from(accountSchema);
      expect(user).toMatchObject({
        name: USER.name,
        email: USER.email,
        emailVerified: false,
      });
      expect(account.userId).toBe(user.id);
      expect(account.password).toEqual(expect.any(String));
      expect(account.password).not.toBe(USER.password);
      expect(account.providerId).toBe("credential");
    },
    async thenThereIsOneSession() {
      expect(
        await database.select().from(authenticationSessionSchema),
      ).toHaveLength(1);
    },
    async thenThereIsOneUserAndCredential() {
      expect(await database.select().from(userSchema)).toHaveLength(1);
      expect(await database.select().from(accountSchema)).toHaveLength(1);
    },
    async thenNoUserIsStored() {
      expect(await database.select().from(userSchema)).toEqual([]);
      expect(await database.select().from(accountSchema)).toEqual([]);
    },
    async thenNoSessionIsStored() {
      expect(await database.select().from(authenticationSessionSchema)).toEqual(
        [],
      );
    },
    async thenTheSessionIdentifiesTheUser() {
      const session = await client
        .get("/api/auth/get-session")
        .set("Cookie", cookie);
      expect(session.status).toBe(200);
      expect(session.body.user.email).toBe(USER.email);
      expect(session.body.session).not.toHaveProperty("token");
    },
    async thenTheLegacyUserAndUpgradedPasswordAreStored() {
      const [user] = await database
        .select()
        .from(userSchema)
        .where(eq(userSchema.id, "legacy-user"));
      const [account] = await database
        .select()
        .from(accountSchema)
        .where(eq(accountSchema.id, "legacy-account"));
      expect(user).toMatchObject({
        id: "legacy-user",
        emailVerified: true,
        image: "https://example.com/avatar.png",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2020-01-01T00:00:00Z"),
      });
      expect(account.password).toEqual(expect.any(String));
      expect(account.password).not.toBe(LEGACY_PASSWORD_HASH);
      expect(account.password).not.toBe(LEGACY_PASSWORD);
    },
    async thenTheLegacyPasswordIsUnchanged() {
      const [account] = await database
        .select()
        .from(accountSchema)
        .where(eq(accountSchema.id, "legacy-account"));
      expect(account.password).toBe(LEGACY_PASSWORD_HASH);
    },
  };
}

async function createAuthenticationTestApplication() {
  const testingModule = await Test.createTestingModule({
    imports: [ApplicationModule],
    controllers: [ProtectedController],
  })
    .overrideProvider(PasswordHasher)
    .useValue(new PasswordHasher({ logN: 10 }))
    .compile();
  const application = testingModule.createNestApplication();
  application.useLogger(false);
  configureHttpApplication(application);
  try {
    await application.listen(0, "127.0.0.1");
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}
