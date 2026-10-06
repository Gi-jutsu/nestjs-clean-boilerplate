import { ProblemDetailsFilter } from "@api/filters/problem-details.filter.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

const CORRELATION_ID = "problem-details-request";
const PRIVATE_ERROR_DETAIL = "Database credentials: do-not-expose-this-secret";
const HEALTH_DETAILS = {
  info: { uptime: { status: "up" } },
  error: { postgresql: { status: "down" } },
  details: { uptime: { status: "up" }, postgresql: { status: "down" } },
};

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

  it("uses the declared HTTP exception status", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheRequestIsInvalid();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheProblemIs({
      status: 400,
      title: "Bad Request",
      detail: "Invalid account request",
    });
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

  it("formats failures raised by a guard before a controller runs", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenAProtectedAccountIsRequested();
    systemUnderTest.thenTheProblemIs({
      status: 403,
      title: "Forbidden",
      detail: "Account access is forbidden",
    });
  });

  it("keeps validation issues in the HTTP problem", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenAnInvalidEmailIsSubmitted();
    systemUnderTest.thenTheValidationProblemIsReturned();
  });

  it("formats a failure raised by Nest middleware", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheRequestIsInvalid();
    await systemUnderTest.whenTheMiddlewareRejectsTheRequest();
    systemUnderTest.thenTheProblemIs({
      status: 400,
      title: "Bad Request",
      detail: "Invalid account request",
    });
  });

  it("formats malformed JSON before routing", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenMalformedJsonIsSubmitted();
    systemUnderTest.thenTheProblemIs({ status: 400, title: "Bad Request" });
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

  it("formats the router's missing endpoint response", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    await systemUnderTest.whenAnUnknownEndpointIsRequested();
    systemUnderTest.thenTheProblemIs({ status: 404, title: "Not Found" });
  });

  it("preserves structured health details with a numeric HTTP status", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheDatabaseIsUnhealthy();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheHealthProblemIsReturned();
  });

  it("preserves deliberate HTTP problem extensions and removes diagnostic fields", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenAStructuredHttpProblem();
    await systemUnderTest.whenTheAccountIsRequested();
    systemUnderTest.thenTheStructuredProblemIsReturned();
  });

  it("omits query parameters from the problem instance", async () => {
    const systemUnderTest = createSystemUnderTest(application);
    systemUnderTest.givenTheRequestIsInvalid();
    await systemUnderTest.whenTheAccountIsRequestedWithPrivateQueryParameters();
    systemUnderTest.thenTheInstanceContainsOnlyThePath();
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
    application.useLogger(false);
    configureHttpApplication(application);
    await application.listen(0, "127.0.0.1");
  });

  afterEach(async () => {
    await application.close();
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
    givenTheDatabaseIsUnhealthy() {
      scenario.failure = new ServiceUnavailableException({
        status: "error",
        ...HEALTH_DETAILS,
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
    async whenAProtectedAccountIsRequested() {
      response = await client
        .get("/errors/protected")
        .set("x-correlation-id", CORRELATION_ID);
    },
    async whenAnInvalidEmailIsSubmitted() {
      response = await client
        .post("/errors/validated")
        .set("x-correlation-id", CORRELATION_ID)
        .send({ email: "invalid" });
    },
    async whenTheMiddlewareRejectsTheRequest() {
      response = await client
        .get("/errors/middleware")
        .set("x-correlation-id", CORRELATION_ID);
    },
    async whenMalformedJsonIsSubmitted() {
      response = await client
        .post("/errors/validated")
        .set("x-correlation-id", CORRELATION_ID)
        .set("Content-Type", "application/json")
        .send('{"email":');
    },
    async whenMalformedJsonHasNoCorrelationId() {
      response = await client
        .post("/errors/validated")
        .set("Content-Type", "application/json")
        .send('{"email":');
    },
    async whenAnUnknownEndpointIsRequested() {
      response = await client
        .get("/errors/unknown")
        .set("x-correlation-id", CORRELATION_ID);
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
        detail: "email: Invalid email address",
        errors: ["email: Invalid email address"],
      });
    },
    thenTheHealthProblemIsReturned() {
      assertProblem({
        status: 503,
        title: "Service Unavailable",
        detail: "Service Unavailable",
        ...HEALTH_DETAILS,
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
        instance: "/errors/validated",
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

const ValidatedAccountSchema = z.object({ email: z.email() });
type ValidatedAccountBody = z.infer<typeof ValidatedAccountSchema>;

@Injectable()
class DenyAccountAccessGuard implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException("Account access is forbidden");
  }
}

@Injectable()
class RejectRequestMiddleware implements NestMiddleware {
  constructor(private readonly scenario: ErrorScenario) {}
  use() {
    throw this.scenario.failure;
  }
}

@Controller("errors")
class ErrorScenariosController {
  constructor(private readonly scenario: ErrorScenario) {}
  @Get("account")
  fail() {
    throw this.scenario.failure;
  }
  @Get("protected")
  @UseGuards(DenyAccountAccessGuard)
  protectedAccount() {
    return { account: "protected" };
  }
  @Post("validated")
  validatedAccount(
    @Body({ schema: ValidatedAccountSchema }) body: ValidatedAccountBody,
  ) {
    return body;
  }
  @Get("middleware")
  middlewareAccount() {
    return { account: "middleware" };
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
    DenyAccountAccessGuard,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
class ErrorScenariosModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
    consumer.apply(RejectRequestMiddleware).forRoutes("errors/middleware");
  }
}
