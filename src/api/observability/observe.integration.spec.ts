import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import { ProblemDetailsFilter } from "@api/filters/problem-details.filter.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { createHttpApplicationOptions } from "@api/http-application-options.js";
import { ApplicationEnvironmentSchema } from "@api/environment.js";
import { IdentityAndAccessModule } from "@modules/identity-and-access/identity-and-access.module.js";
import type { AuthenticationUser } from "@modules/identity-and-access/infrastructure/authentication/authentication-user.js";
import { userSchema } from "@modules/identity-and-access/infrastructure/database/drizzle.schema.js";
import type { SharedKernelDatabase } from "@modules/shared-kernel/infrastructure/database/drizzle.schema.js";
import { getDrizzleToken } from "@nestjs/drizzle";
import { CurrentUser, Public } from "@nestjs/authentication";
import {
  createObserveImports,
  ObserveInstrument,
} from "@api/observability/observe.module.js";
import {
  Controller,
  All,
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
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { TracerService } from "@nestjs/observe";
import { eq } from "drizzle-orm";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { gunzipSync } from "node:zlib";
import supertest, { type Response } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestingApplication } from "../../../specs/testing-application.js";

const CORRELATION_ID = "observe-request-from-client";
const APPLICATION_KEY = "observe-test-key";
const APPLICATION_SECRET = "observe-test-secret";
const SERVICE_ID = "observe-test-api";
const PRIVATE_PASSWORD = "observe-private-password";
const PRIVATE_AUTHORIZATION = "Bearer observe-private-bearer-token";
const PRIVATE_COOKIE = "session=observe-private-session-token";
const OBSERVED_USER_EMAIL = "observe-native-auth@example.com";

const SnapshotSchema = z.object({
  ti: z.string(),
  op: z.string().optional(),
  d: z.number().optional(),
  a: z.object({ sc: z.number(), ou: z.string().optional() }),
  e: z.object({ message: z.string() }).optional(),
  t: z.array(z.unknown()).optional(),
});
const TelemetrySchema = z.object({
  serviceId: z.string(),
  snapshots: z.array(SnapshotSchema).optional(),
  logs: z.array(z.unknown()).optional(),
});

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

describe("Optional Observe HTTP instrumentation", { timeout: 10_000 }, () => {
  let collector: Awaited<ReturnType<typeof createCollector>>;
  let disabledApplication: INestApplication;
  let enabledApplication: INestApplication;

  it("serves correlated requests without installing telemetry when disabled", async () => {
    const system = createSystemUnderTest(disabledApplication, collector);
    system.givenACorrelatedRequest();

    await system.whenTheRequestIsHandled();

    system.thenTheClientCorrelationIdIsReturned();
    system.thenNoTraceWasCreated();
    system.thenTheTelemetryProviderIsAbsent();
  });

  it("uses the client correlation ID for the request trace and response", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);
    system.givenACorrelatedRequest();

    await system.whenTheRequestIsHandled();

    system.thenTheClientCorrelationIdIsReturned();
    system.thenTheRequestTraceMatchesItsCorrelationId();
    await system.thenTheCollectorReceivesTheSuccessfulRequest();
  });

  it("generates one ID shared by the request trace and response", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);

    await system.whenTheRequestIsHandled();

    system.thenTheRequestTraceMatchesItsCorrelationId();
    await system.thenTheCollectorReceivesTheSuccessfulRequest();
  });

  it("reports failed requests with their correlation ID", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);
    system.givenACorrelatedRequest();

    await system.whenTheRequestFails();

    system.thenTheClientCorrelationIdIsReturned();
    await system.thenTheCollectorReceivesTheFailure();
  });

  it("omits passwords, authorization and cookies from exported requests", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);
    system.givenASensitiveRequest();

    await system.whenTheSensitiveRequestFails();

    await system.thenTheCollectorReceivesTheFailure();
    system.thenTheCollectorReceivedNoPrivateRequestData();
  });

  it("traces a native authenticated request without exporting its credentials", async () => {
    const system = createSystemUnderTest(enabledApplication, collector);
    system.givenACorrelatedRequest();
    await system.givenANewNativeUser();

    await system.whenTheNativeUserSignsUpAndRequestsAProtectedRoute();

    system.thenTheAuthenticatedUserIsReturned();
    system.thenTheRequestTraceMatchesItsCorrelationId();
    await system.thenTheCollectorReceivesTheSuccessfulRequest();
    system.thenTheCollectorReceivedNoPrivateRequestData();
  });

  beforeAll(async () => {
    collector = await createCollector();
    disabledApplication = await createObservedApplication(
      false,
      collector.endpoint,
    );
    enabledApplication = await createObservedApplication(
      true,
      collector.endpoint,
    );
  });

  beforeEach(() => collector.reset());

  afterAll(async () => {
    await enabledApplication.close();
    await disabledApplication.close();
    await collector.stop();
  });
});

function createSystemUnderTest(
  application: INestApplication,
  collector: Awaited<ReturnType<typeof createCollector>>,
) {
  let correlationId: string;
  let response: Response;
  let nativeCookie: string;

  async function request(path: string) {
    const pendingRequest = supertest(application.getHttpServer()).get(path);
    if (correlationId) pendingRequest.set("x-correlation-id", correlationId);
    response = await pendingRequest;
  }

  function findSnapshot() {
    return collector.batches
      .flatMap((batch) => batch.body.snapshots ?? [])
      .find((snapshot) => snapshot.ti === response.headers["x-correlation-id"]);
  }

  return {
    givenACorrelatedRequest() {
      correlationId = CORRELATION_ID;
    },
    givenASensitiveRequest() {
      correlationId = CORRELATION_ID;
    },
    async givenANewNativeUser() {
      await application
        .get<SharedKernelDatabase>(getDrizzleToken())
        .delete(userSchema)
        .where(eq(userSchema.email, OBSERVED_USER_EMAIL));
    },
    async whenTheRequestIsHandled() {
      await request("/observe-test/request");
    },
    async whenTheRequestFails() {
      await request("/observe-test/failure");
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
      expect(response.headers["x-correlation-id"]).toBe(CORRELATION_ID);
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
      expect(response.body.traceId).toBe(response.headers["x-correlation-id"]);
    },
    async thenTheCollectorReceivesTheSuccessfulRequest() {
      await expect.poll(findSnapshot, { timeout: 8_000 }).toMatchObject({
        a: { sc: 200 },
        ti: response.headers["x-correlation-id"],
      });
      const snapshot = findSnapshot();
      expect(snapshot?.d).toEqual(expect.any(Number));
      expect(snapshot?.t?.length).toBeGreaterThan(0);
      expect(collector.batches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "/applications/telemetry",
            headers: expect.objectContaining({
              "x-api-key": APPLICATION_KEY,
              "x-api-secret": APPLICATION_SECRET,
            }),
            body: expect.objectContaining({ serviceId: SERVICE_ID }),
          }),
        ]),
      );
      expect(
        collector.batches.flatMap((batch) => batch.body.logs ?? []),
      ).toEqual([]);
    },
    async thenTheCollectorReceivesTheFailure() {
      expect(response.status).toBe(500);
      expect(response.headers["content-type"]).toMatch(
        /^application\/problem\+json/,
      );
      await expect.poll(findSnapshot, { timeout: 8_000 }).toMatchObject({
        a: { sc: 500 },
        ti: CORRELATION_ID,
      });
      expect(findSnapshot()?.t?.some(isFailedControllerSpan)).toBe(true);
    },
    thenTheCollectorReceivedNoPrivateRequestData() {
      const exported = collector.batches
        .map((batch) => batch.rawBody)
        .join("\n");
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
  const metadata = {
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validationSchema: ApplicationEnvironmentSchema,
        load: [
          () =>
            enabled
              ? {
                  OBSERVE_APP_KEY: APPLICATION_KEY,
                  OBSERVE_APP_SECRET: APPLICATION_SECRET,
                  OBSERVE_SERVICE_ID: SERVICE_ID,
                  OBSERVE_ENDPOINT: endpoint,
                }
              : {},
        ],
      }),
      ObserveTestingModule,
      IdentityAndAccessModule,
      ...createObserveImports(enabled),
    ],
    controllers: [ObserveTestController, ObservedAuthenticationController],
    providers: [
      createNestProvider(ProblemDetailsFilter, [HttpAdapterHost], APP_FILTER),
    ],
  };
  if (!enabled) return createTestingApplication(metadata, { bodyParser: true });

  // Nest's testing builder creates controllers before it accepts an instrument.
  // Boot through NestFactory here so the provider instrumentation matches production.
  @Module(metadata)
  class InstrumentedTestingModule {}

  const application = await NestFactory.create(InstrumentedTestingModule, {
    ...createHttpApplicationOptions(),
    instrument: ObserveInstrument,
    logger: false,
    abortOnError: false,
  });
  configureHttpApplication(application);
  try {
    await application.listen(0, "127.0.0.1");
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}

function isFailedControllerSpan(span: unknown): boolean {
  if (typeof span !== "object" || span === null) return false;
  if (
    "c" in span &&
    span.c === ObserveTestController.name &&
    "m" in span &&
    span.m === "fail" &&
    "e" in span &&
    span.e
  )
    return true;
  return (
    "ch" in span &&
    Array.isArray(span.ch) &&
    span.ch.some(isFailedControllerSpan)
  );
}

async function createCollector() {
  const batches: {
    path: string;
    headers: IncomingHttpHeaders;
    body: z.infer<typeof TelemetrySchema>;
    rawBody: string;
  }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const compressed = Buffer.concat(chunks);
    const payload =
      request.headers["content-encoding"] === "gzip"
        ? gunzipSync(compressed)
        : compressed;
    const rawBody = payload.toString();
    const body = TelemetrySchema.parse(JSON.parse(rawBody));
    batches.push({
      path: request.url ?? "",
      headers: request.headers,
      body,
      rawBody,
    });
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
