import { ProblemDetailsFilter } from "@api/filters/problem-details.filter.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  Res,
  type INestApplication,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@packages/domain-driven-design/index.js";
import type { Response as ExpressResponse } from "express";
import supertest, { type Response } from "supertest";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

const CORRELATION_ID = "problem-details-request";
const PRIVATE_ERROR_DETAIL = "Database credentials: do-not-expose-this-secret";

describe("ProblemDetailsFilter HTTP boundary", () => {
  let application: INestApplication;

  it("maps a missing domain resource to 404", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheAccountDoesNotExist();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheProblemIs({
      status: 404,
      title: "Not Found",
      detail: "The account you are trying to access does not exist.",
      code: "resource-not-found",
    });
  });

  it("maps a conflicting domain resource to 409", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheAccountAlreadyExists();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheProblemIs({
      status: 409,
      title: "Conflict",
      detail: "The account you are trying to create already exists.",
      code: "resource-already-exists",
    });
  });

  it("uses the declared HTTP status and excludes private query parameters", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheRequestIsInvalid();
    await systemUnderTest.whenTheAccountIsRequestedWithPrivateQueryParameters();
    systemUnderTest.thenTheProblemIs({
      status: 400,
      title: "Bad Request",
      detail: "Invalid account request",
    });
    systemUnderTest.thenTheInstanceContainsOnlyThePath();
  });

  it("normalizes a string HTTP exception response", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenPaymentIsRequired();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheProblemIs({
      status: 402,
      title: "Payment Required",
      detail: "Payment is required to open this account",
    });
  });

  it("redacts an unexpected error and ignores its claimed status", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenAnUnexpectedFailureClaimsToBeAClientError();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenAnUnexpectedFailureIsRedacted();
  });

  it("redacts thrown objects that are not exceptions", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenAThrownObjectContainsPrivateDetails();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenAnUnexpectedFailureIsRedacted();
  });

  it("keeps validation issues in the HTTP problem", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenValidationMessages();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheValidationProblemIsReturned();
  });

  it("handles a parser failure before a correlation ID exists", async () => {
    const systemUnderTest = createSystemUnderTest(application);

    await systemUnderTest.whenMalformedJsonHasNoCorrelationId();

    systemUnderTest.thenTheProblemHasNoCorrelationId();
  });

  it("preserves structured validation issues", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenStructuredValidationIssues();

    await systemUnderTest.whenTheAccountIsRequested();

    systemUnderTest.thenStructuredValidationIssuesAreReturned();
  });

  it("preserves deliberate HTTP problem extensions and removes diagnostic fields", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenAStructuredHttpProblem();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheStructuredProblemIsReturned();
  });

  it("ends an already started response when a controller fails", async () => {
    const systemUnderTest = createSystemUnderTest(application);

    await systemUnderTest.whenTheControllerFailsAfterStartingItsResponse();

    systemUnderTest.thenTheStartedResponseIsCompleted();
  });

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [ErrorScenariosModule],
    }).compile();
    application = testingModule.createNestApplication();
    onTestFinished(() => application.close());
    application.useLogger(false);
    configureHttpApplication(application);
    await application.listen(0, "127.0.0.1");
  });
});

function createSystemUnderTest(application: INestApplication) {
  const scenario = application.get(ErrorScenario);
  const client = supertest(application.getHttpServer());
  let response: Response;

  function assertProblem(expected: Record<string, unknown>) {
    expect(response.status).toBe(expected.status);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      type: "about:blank",
      status: response.status,
      title: expect.any(String),
      detail: expect.any(String),
      instance: expect.any(String),
      timestamp: expect.any(String),
      correlationId: CORRELATION_ID,
      ...expected,
    });
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  }

  return {
    givenTheAccountDoesNotExist() {
      scenario.failure = new ResourceNotFoundError({
        resource: "account",
        searchedByFieldName: "id",
        searchedByValue: "missing-account",
      });
    },
    givenTheAccountAlreadyExists() {
      scenario.failure = new ResourceAlreadyExistsError({
        resource: "account",
        conflictingFieldName: "email",
        conflictingFieldValue: "registered@example.com",
      });
    },
    givenTheRequestIsInvalid() {
      scenario.failure = new BadRequestException({
        message: "Invalid account request",
        status: 409,
      });
    },
    givenPaymentIsRequired() {
      scenario.failure = new HttpException(
        "Payment is required to open this account",
        402,
      );
    },
    givenAnUnexpectedFailureClaimsToBeAClientError() {
      scenario.failure = Object.assign(new Error(PRIVATE_ERROR_DETAIL), {
        status: 401,
        detail: PRIVATE_ERROR_DETAIL,
        title: PRIVATE_ERROR_DETAIL,
        code: "pretend-client-error",
      });
    },
    givenAThrownObjectContainsPrivateDetails() {
      scenario.failure = { status: 422, detail: PRIVATE_ERROR_DETAIL };
    },
    givenValidationMessages() {
      scenario.failure = new BadRequestException({
        message: ["Invalid email", "Name is required"],
      });
    },
    givenAStructuredHttpProblem() {
      scenario.failure = new HttpException(
        {
          type: "/problems/account-invalid",
          title: "Account invalid",
          detail: "The account cannot be opened",
          code: "account-invalid",
          invalidFields: ["email"],
          cause: PRIVATE_ERROR_DETAIL,
          stack: PRIVATE_ERROR_DETAIL,
        },
        422,
      );
    },
    givenStructuredValidationIssues() {
      scenario.failure = new BadRequestException({
        message: [{ path: ["email"], message: "Invalid email" }],
      });
    },
    async whenTheAccountIsRequested() {
      response = await client
        .get("/errors/account")
        .set("x-correlation-id", CORRELATION_ID);
    },
    async whenMalformedJsonHasNoCorrelationId() {
      response = await client
        .post("/errors/account")
        .set("Content-Type", "application/json")
        .send('{"email":');
    },
    async whenTheAccountIsRequestedWithPrivateQueryParameters() {
      response = await client
        .get("/errors/account?token=private-query-token")
        .set("x-correlation-id", CORRELATION_ID);
    },
    async whenTheControllerFailsAfterStartingItsResponse() {
      response = await client
        .get("/errors/started")
        .set("x-correlation-id", CORRELATION_ID)
        .timeout({ deadline: 1_000 });
    },
    thenTheProblemIs(expected: Record<string, unknown>) {
      assertProblem(expected);
    },
    thenAnUnexpectedFailureIsRedacted() {
      assertProblem({
        status: 500,
        title: "Internal Server Error",
        detail: "An unexpected error occurred.",
        code: "internal-server-error",
      });
      expect(response.text).not.toContain(PRIVATE_ERROR_DETAIL);
      expect(response.text).not.toContain("pretend-client-error");
      expect(response.body.stack).toBeUndefined();
    },
    thenTheValidationProblemIsReturned() {
      assertProblem({
        status: 400,
        title: "Bad Request",
        detail: "Invalid email; Name is required",
        errors: ["Invalid email", "Name is required"],
      });
    },
    thenTheStructuredProblemIsReturned() {
      assertProblem({
        type: "/problems/account-invalid",
        status: 422,
        title: "Account invalid",
        detail: "The account cannot be opened",
        code: "account-invalid",
        invalidFields: ["email"],
      });
      expect(response.text).not.toContain(PRIVATE_ERROR_DETAIL);
    },
    thenTheInstanceContainsOnlyThePath() {
      assertProblem({ status: 400, instance: "/errors/account" });
      expect(response.text).not.toContain("private-query-token");
    },
    thenTheProblemHasNoCorrelationId() {
      expect(response.status).toBe(400);
      expect(response.headers["content-type"]).toMatch(
        /^application\/problem\+json/,
      );
      expect(response.body).toMatchObject({
        type: "about:blank",
        status: 400,
        title: "Bad Request",
        instance: "/errors/account",
      });
      expect(response.body).not.toHaveProperty("correlationId");
    },
    thenStructuredValidationIssuesAreReturned() {
      assertProblem({
        status: 400,
        title: "Bad Request",
        detail: "Bad Request",
        errors: [{ path: ["email"], message: "Invalid email" }],
      });
    },
    thenTheStartedResponseIsCompleted() {
      expect(response.status).toBe(200);
      expect(response.text).toBe("partial response");
      expect(response.text).not.toContain(PRIVATE_ERROR_DETAIL);
    },
  };
}

@Injectable()
class ErrorScenario {
  failure: unknown;
}

@Controller("errors")
class ErrorScenariosController {
  constructor(private readonly scenario: ErrorScenario) {}
  @Get("account")
  fail() {
    throw this.scenario.failure;
  }
  @Get("started")
  startedResponse(@Res() response: ExpressResponse) {
    response.type("text/plain");
    response.write("partial response");
    throw new Error(PRIVATE_ERROR_DETAIL);
  }
}

@Module({
  controllers: [ErrorScenariosController],
  providers: [
    ErrorScenario,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
class ErrorScenariosModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
