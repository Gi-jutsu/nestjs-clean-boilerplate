import type { INestApplication } from "@nestjs/common";
import { createTestingApplication } from "../../specs/testing-application.js";
import supertest, { type Response } from "supertest";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

const REQUEST_LIMIT = 100;
const CORRELATION_ID = "request-from-client";

describe("ApplicationModule HTTP configuration", () => {
  let application: INestApplication;

  it("returns a correlation ID for a public request", async () => {
    const system = createSystemUnderTest(application);

    await system.whenHealthIsRequested();

    system.thenACorrelationIdIsReturned();
  });

  it("preserves a client's correlation ID", async () => {
    const system = createSystemUnderTest(application);
    system.givenACorrelatedRequest();

    await system.whenHealthIsRequested();

    system.thenTheClientCorrelationIdIsReturned();
  });

  it("applies security headers through the shared HTTP configuration", async () => {
    const system = createSystemUnderTest(application);

    await system.whenHealthIsRequested();

    system.thenSecurityHeadersAreReturned();
  });

  it("rejects only requests exceeding the per-minute limit", async () => {
    const system = createSystemUnderTest(application);

    await system.whenTheRequestLimitIsExceeded();

    system.thenOnlyTheExcessRequestIsRejected();
  });

  beforeEach(async () => {
    application = await createTestingApplication();
    onTestFinished(() => application.close());
  });
});

function createSystemUnderTest(application: INestApplication) {
  const client = supertest(application.getHttpServer());
  let correlationId: string;
  let response: Response;
  let responses: Response[];

  return {
    givenACorrelatedRequest() {
      correlationId = CORRELATION_ID;
    },
    async whenHealthIsRequested() {
      const request = client.get("/health-check");
      if (correlationId) request.set("x-correlation-id", correlationId);
      response = await request;
    },
    async whenTheRequestLimitIsExceeded() {
      responses = [];
      for (let request = 0; request <= REQUEST_LIMIT; request++) {
        responses.push(await client.get("/health-check"));
      }
    },
    thenACorrelationIdIsReturned() {
      expect(response.status).toBe(200);
      expect(response.headers["x-correlation-id"]).toEqual(expect.any(String));
    },
    thenTheClientCorrelationIdIsReturned() {
      expect(response.headers["x-correlation-id"]).toBe(CORRELATION_ID);
    },
    thenSecurityHeadersAreReturned() {
      expect(response.headers["content-security-policy"]).toBeDefined();
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    },
    thenOnlyTheExcessRequestIsRejected() {
      expect(responses.filter(({ status }) => status === 200)).toHaveLength(
        REQUEST_LIMIT,
      );
      expect(responses.filter(({ status }) => status === 429)).toHaveLength(1);
    },
  };
}
