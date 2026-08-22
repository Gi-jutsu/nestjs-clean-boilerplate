import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@packages/domain-driven-design/index.js";
import { DateTime, Settings } from "luxon";
import { firstValueFrom, throwError } from "rxjs";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vitest,
} from "vitest";
import { MapErrorToRfc9457HttpException } from "@api/interceptors/map-error-to-rfc9457-http-exception.interceptor.js";

type HttpExceptionClass = abstract new (...args: any[]) => HttpException;
type ProblemDetail = Record<string, unknown>;
type SystemState = {
  context: ExecutionContext;
  handledError: Error;
  interceptor: MapErrorToRfc9457HttpException;
  next: CallHandler;
  thrownError?: unknown;
};

describe("MapErrorToRfc9457HttpException", () => {
  beforeAll(() => {
    Settings.now = () => 0;
  });

  afterEach(() => {
    vitest.restoreAllMocks();
  });

  afterAll(() => {
    Settings.now = () => Date.now();
  });

  it("should preserve already mapped HTTP errors", async () => {
    const system = createSystemUnderTest();

    system.given.requestAlreadyFailedWithHttpError();
    await system.when.requestIsHandled();
    system.then.originalHttpErrorShouldBePreserved();
  });

  it("should return not found when the requested resource does not exist", async () => {
    const system = createSystemUnderTest();

    system.given.requestedAccountDoesNotExist();
    await system.when.requestIsHandled();
    system.then.httpErrorShouldBe(NotFoundException, HttpStatus.NOT_FOUND);
  });

  it("should return conflict when the requested resource already exists", async () => {
    const system = createSystemUnderTest();

    system.given.requestedAccountAlreadyExists();
    await system.when.requestIsHandled();
    system.then.httpErrorShouldBe(ConflictException, HttpStatus.CONFLICT);
  });

  it("should return an internal server error for unexpected errors", async () => {
    const system = createSystemUnderTest();

    system.given.anUnexpectedFailureOccurs();
    await system.when.requestIsHandled();
    system.then.problemDetailShouldBe({
      code: "internal-server-error",
      detail: "An unexpected error occurred.",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: DateTime.now().toISO(),
      title: "Internal Server Error",
    });
  });
});

function createSystemUnderTest() {
  const state = createSystemState();

  return {
    given: createGivenSteps(state),
    when: createWhenSteps(state),
    then: createThenSteps(state),
  };
}

function createSystemState(): SystemState {
  vitest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  vitest.spyOn(Logger.prototype, "verbose").mockImplementation(() => {});

  let handledError = new Error("An unexpected error occurred.");

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          "x-correlation-id": "correlation-id",
        },
      }),
    }),
  } as unknown as ExecutionContext;

  return {
    context,
    get handledError() {
      return handledError;
    },
    set handledError(error: Error) {
      handledError = error;
    },
    interceptor: new MapErrorToRfc9457HttpException(),
    next: {
      handle: () => throwError(() => handledError),
    },
  };
}

function createGivenSteps(state: SystemState) {
  const failWith = (error: Error) => {
    state.handledError = error;
  };

  return {
    requestAlreadyFailedWithHttpError: () =>
      failWith(new BadRequestException("Invalid request")),
    requestedAccountDoesNotExist: () => failWith(accountNotFound()),
    requestedAccountAlreadyExists: () => failWith(accountAlreadyExists()),
    anUnexpectedFailureOccurs: () =>
      failWith(new Error("Database connection lost.")),
  };
}

function createWhenSteps(state: SystemState) {
  return {
    async requestIsHandled() {
      state.thrownError = await catchThrownError(() =>
        firstValueFrom(state.interceptor.intercept(state.context, state.next)),
      );
    },
  };
}

function createThenSteps(state: SystemState) {
  return {
    originalHttpErrorShouldBePreserved() {
      expect(state.thrownError).toBe(state.handledError);
    },
    httpErrorShouldBe(HttpError: HttpExceptionClass, status: HttpStatus) {
      const error = expectThrownHttpException(state);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.getStatus()).toBe(status);
    },
    problemDetailShouldBe(problemDetail: ProblemDetail) {
      expect(expectThrownHttpException(state).getResponse()).toEqual(
        problemDetail,
      );
    },
  };
}

async function catchThrownError(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected request handling to fail.");
}

function expectThrownHttpException(state: SystemState) {
  expect(state.thrownError).toBeInstanceOf(HttpException);
  return state.thrownError as HttpException;
}

function accountNotFound() {
  return new ResourceNotFoundError({
    resource: "account",
    searchedByFieldName: "id",
    searchedByValue: "account-id",
  });
}

function accountAlreadyExists() {
  return new ResourceAlreadyExistsError({
    resource: "account",
    conflictingFieldName: "email",
    conflictingFieldValue: "john.doe@example.com",
  });
}
