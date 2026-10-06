import { configureHttpApplication } from "@api/configure-http-application.js";
import { ApplicationEnvironmentSchema } from "@api/environment.js";
import { ProblemDetailsFilter } from "@api/filters/problem-details.filter.js";
import { createHttpApplicationOptions } from "@api/http-application-options.js";
import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import { createObserveImports } from "@api/observability/observe.module.js";
import { IdentityAndAccessModule } from "@modules/identity-and-access/identity-and-access.module.js";
import type { AuthenticationUser } from "@modules/identity-and-access/infrastructure/authentication/authentication-user.js";
import { userSchema } from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { CurrentUser, Public } from "@nestjs/authentication";
import {
  All,
  Controller,
  Get,
  InternalServerErrorException,
  MiddlewareConsumer,
  Module,
  Optional,
  type INestApplication,
  type NestModule,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, HttpAdapterHost, NestFactory } from "@nestjs/core";
import { getDrizzleToken } from "@nestjs/drizzle";
import { TracerService } from "@nestjs/observe";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { eq } from "drizzle-orm";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { gunzipSync } from "node:zlib";
import supertest, { type Response } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestingApplication } from "../../../specs/testing-application.js";

const CORRELATION_ID = "observe-request-from-client";
const APPLICATION_KEY = "observe-test-key";
const APPLICATION_SECRET = "observe-test-secret";
const SERVICE_ID = "observe-test-api";
const PRIVATE_PASSWORD = "observe-private-password";
const PRIVATE_AUTHORIZATION = "Bearer observe-private-bearer-token";
const PRIVATE_COOKIE = "session=observe-private-session-token";
const OBSERVED_USER_EMAIL = "observe-native-auth@example.com";

@Controller("observe-test")
@Public()
class ObserveTestController {
  constructor(@Optional() private readonly tracer?: TracerService) {}

  @Get("request")
  handle() {
    return { traceId: this.tracer?.currentTraceId() ?? null };
  }

  @All("failure")
  fail() {
    throw new InternalServerErrorException("Observe test failure");
  }
}

@Controller("observe-authentication")
class ObservedAuthenticationController {
  constructor(@Optional() private readonly tracer?: TracerService) {}

  @Get()
  handle(@CurrentUser() user: AuthenticationUser) {
    return { userId: user.id, traceId: this.tracer?.currentTraceId() ?? null };
  }
}

@Module({})
class ObserveTestingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}

describe("Optional Observe HTTP wiring", { timeout: 10_000 }, () => {
  let collector: Awaited<ReturnType<typeof createCollector>>;
  let disabledApplication: INestApplication;
  let enabledApplication: INestApplication;
  const cleanup: (() => Promise<void>)[] = [];

  it("serves correlated requests without credentials or telemetry when disabled", async () => {
    const system = createSystemUnderTest(disabledApplication, collector);
    system.givenACorrelatedRequest();

    await system.whenTheRequestIsHandled();

    system.thenTheClientCorrelationIdIsReturned();
    system.thenNoTraceWasCreated();
    system.thenTheTelemetryProviderIsAbsent();
  });

  it("generates one ID shared by the request trace and response", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);

    await system.whenTheRequestIsHandled();

    system.thenTheRequestTraceMatchesItsCorrelationId();
  });

  it("keeps sensitive failed requests correlated without exporting their private data", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);
    system.givenASensitiveRequest();

    await system.whenTheSensitiveRequestFails();

    system.thenTheClientCorrelationIdIsReturned();
    system.thenTheProblemResponseIsReturned();
    await system.thenTheConfiguredCollectorReceivesTheRequest();
    system.thenTheCollectorReceivedNoPrivateRequestData();
  });

  it("keeps native authentication working with correlated traces and private credentials", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);
    system.givenACorrelatedRequest();
    await system.givenANewNativeUser();

    await system.whenTheNativeUserSignsUpAndRequestsAProtectedRoute();

    system.thenTheAuthenticatedUserIsReturned();
    system.thenTheClientCorrelationIdIsReturned();
    system.thenTheRequestTraceMatchesItsCorrelationId();
    await system.thenTheConfiguredCollectorReceivesTheRequest();
    system.thenTheCollectorReceivedNoPrivateRequestData();
  });

  beforeAll(async () => {
    collector = await createCollector();
    cleanup.push(() => collector.stop());
    disabledApplication = await createObservedApplication(
      false,
      collector.endpoint,
    );
    cleanup.push(() => disabledApplication.close());
    enabledApplication = await createObservedApplication(
      true,
      collector.endpoint,
    );
    cleanup.push(() => enabledApplication.close());
  });

  beforeEach(() => collector.reset());

  afterAll(async () => {
    const failures: unknown[] = [];
    for (const close of cleanup.toReversed()) {
      try {
        await close();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Observe fixture cleanup failed");
    }
  });
});

function createSystemUnderTest(
  application: INestApplication,
  collector: Awaited<ReturnType<typeof createCollector>>,
) {
  let correlationId: string;
  let response: Response;
  let nativeCookie: string;

  function exportedRequests() {
    return collector.batches.map((batch) => batch.body).join("\n");
  }

  return {
    givenACorrelatedRequest() {
      correlationId = CORRELATION_ID;
    },
    givenASensitiveRequest() {
      correlationId = `${CORRELATION_ID}-sensitive`;
    },
    async givenANewNativeUser() {
      await application
        .get<SharedKernelDatabase>(getDrizzleToken())
        .delete(userSchema)
        .where(eq(userSchema.email, OBSERVED_USER_EMAIL));
    },
    async whenTheRequestIsHandled() {
      const request = supertest(application.getHttpServer()).get(
        "/observe-test/request",
      );
      if (correlationId) request.set("x-correlation-id", correlationId);
      response = await request;
    },
    async whenTheSensitiveRequestFails() {
      response = await supertest(application.getHttpServer())
        .post("/observe-test/failure")
        .set("x-correlation-id", correlationId)
        .set("authorization", PRIVATE_AUTHORIZATION)
        .set("cookie", PRIVATE_COOKIE)
        .send({ password: PRIVATE_PASSWORD });
    },
    async whenTheNativeUserSignsUpAndRequestsAProtectedRoute() {
      const registration = await supertest(application.getHttpServer())
        .post("/api/auth/sign-up/email")
        .set("x-correlation-id", "observe-native-registration")
        .send({
          name: "Observed User",
          email: OBSERVED_USER_EMAIL,
          password: PRIVATE_PASSWORD,
        });
      expect(registration.status).toBe(200);
      nativeCookie = registration.headers["set-cookie"][0].split(";")[0];
      response = await supertest(application.getHttpServer())
        .get("/observe-authentication")
        .set("Cookie", nativeCookie)
        .set("x-correlation-id", correlationId);
    },
    thenTheAuthenticatedUserIsReturned() {
      expect(response.status).toBe(200);
      expect(response.body.userId).toEqual(expect.any(String));
    },
    thenTheClientCorrelationIdIsReturned() {
      expect(response.headers["x-correlation-id"]).toBe(correlationId);
    },
    thenNoTraceWasCreated() {
      expect(response.status).toBe(200);
      expect(response.body.traceId).toBeNull();
    },
    thenTheTelemetryProviderIsAbsent() {
      expect(() => application.get(TracerService)).toThrow();
    },
    thenTheRequestTraceMatchesItsCorrelationId() {
      expect(response.status).toBe(200);
      expect(response.headers["x-correlation-id"]).toEqual(expect.any(String));
      expect(response.headers["x-correlation-id"]).not.toBe("");
      expect(response.body.traceId).toBe(response.headers["x-correlation-id"]);
    },
    thenTheProblemResponseIsReturned() {
      expect(response.status).toBe(500);
      expect(response.headers["content-type"]).toMatch(
        /^application\/problem\+json/,
      );
    },
    async thenTheConfiguredCollectorReceivesTheRequest() {
      await expect
        .poll(exportedRequests, { timeout: 8_000 })
        .toContain(response.headers["x-correlation-id"]);
      const batch = collector.batches.find((recorded) =>
        recorded.body.includes(response.headers["x-correlation-id"]),
      );
      expect(batch).toBeDefined();
      expect(batch!.headers).toMatchObject({
        "x-api-key": APPLICATION_KEY,
        "x-api-secret": APPLICATION_SECRET,
      });
      expect(batch!.body).toContain(SERVICE_ID);
    },
    thenTheCollectorReceivedNoPrivateRequestData() {
      const exported = exportedRequests();
      expect(exported).not.toContain(PRIVATE_PASSWORD);
      expect(exported).not.toContain(PRIVATE_AUTHORIZATION);
      expect(exported).not.toContain(PRIVATE_COOKIE);
      if (nativeCookie) {
        expect(exported).not.toContain(nativeCookie);
        expect(exported).not.toContain(nativeCookie.split("=")[1]);
      }
    },
  };
}

async function createObservedApplication(enabled: boolean, endpoint: string) {
  const environment: Record<string, string | undefined> = {
    OBSERVE_ENABLED: enabled ? "true" : undefined,
    OBSERVE_APP_KEY: enabled ? APPLICATION_KEY : undefined,
    OBSERVE_APP_SECRET: enabled ? APPLICATION_SECRET : undefined,
    OBSERVE_SERVICE_ID: enabled ? SERVICE_ID : undefined,
    OBSERVE_ENDPOINT: enabled ? endpoint : undefined,
  };
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    const configuration = await ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validationSchema: ApplicationEnvironmentSchema,
    });
    const metadata = {
      imports: [
        configuration,
        ObserveTestingModule,
        IdentityAndAccessModule,
        ...createObserveImports(),
      ],
      controllers: [ObserveTestController, ObservedAuthenticationController],
      providers: [
        createNestProvider(ProblemDetailsFilter, [HttpAdapterHost], APP_FILTER),
      ],
    };
    if (!enabled) return await createTestingApplication(metadata);

    // Nest's testing builder creates controllers before it accepts an instrument.
    // NestFactory lets this fixture exercise the production instrumentation lifecycle.
    @Module(metadata)
    class InstrumentedTestingModule {}

    const application = await NestFactory.create(InstrumentedTestingModule, {
      ...createHttpApplicationOptions(),
      logger: false,
      abortOnError: false,
    });
    try {
      configureHttpApplication(application);
      await application.listen(0, "127.0.0.1");
      return application;
    } catch (error) {
      await application.close();
      throw error;
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function createCollector() {
  const batches: { headers: IncomingHttpHeaders; body: string }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const compressed = Buffer.concat(chunks);
    const payload =
      request.headers["content-encoding"] === "gzip"
        ? gunzipSync(compressed)
        : compressed;
    batches.push({ headers: request.headers, body: payload.toString() });
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Collector did not open a TCP port");

  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    batches,
    reset() {
      batches.length = 0;
    },
    async stop() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
