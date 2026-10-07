import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@packages/domain-driven-design/index.js";
import { STATUS_CODES } from "node:http";

const RESERVED_RESPONSE_MEMBERS = new Set([
  "cause",
  "correlationId",
  "detail",
  "instance",
  "message",
  "stack",
  "status",
  "statusCode",
  "timestamp",
  "title",
  "type",
]);

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest();
    const response = context.getResponse();
    const adapter = this.adapterHost.httpAdapter;
    const correlationId = request.headers["x-correlation-id"];
    const problem = createProblemDetails(error);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(error, undefined, correlationId);
    }

    if (adapter.isHeadersSent(response)) {
      adapter.end(response);
      return;
    }

    adapter.setHeader(response, "Content-Type", "application/problem+json");
    adapter.reply(
      response,
      {
        ...problem,
        instance: adapter.getRequestUrl(request).split("?")[0],
        timestamp: new Date().toISOString(),
        ...(typeof correlationId === "string" ? { correlationId } : {}),
      },
      problem.status,
    );
  }
}

function createProblemDetails(error: unknown) {
  if (error instanceof ResourceNotFoundError) {
    return {
      ...createProblem(HttpStatus.NOT_FOUND, error.message),
      code: "resource-not-found",
    };
  }

  if (error instanceof ResourceAlreadyExistsError) {
    return {
      ...createProblem(HttpStatus.CONFLICT, error.message),
      code: "resource-already-exists",
    };
  }

  if (error instanceof HttpException) {
    return createHttpExceptionProblem(error);
  }

  return {
    ...createProblem(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "An unexpected error occurred.",
    ),
    code: "internal-server-error",
  };
}

function createHttpExceptionProblem(error: HttpException) {
  const status = error.getStatus();
  const response = error.getResponse();
  if (typeof response === "string") {
    return createProblem(status, response);
  }

  const body = response as Record<string, unknown>;
  const extensions = Object.fromEntries(
    Object.entries(body).filter(([key]) => !RESERVED_RESPONSE_MEMBERS.has(key)),
  );
  const detail =
    typeof body.detail === "string"
      ? body.detail
      : describeHttpException(body.message, status);

  return {
    ...extensions,
    ...createProblem(status, detail),
    ...(typeof body.type === "string" ? { type: body.type } : {}),
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(Array.isArray(body.message) ? { errors: body.message } : {}),
  };
}

function describeHttpException(message: unknown, status: number) {
  if (typeof message === "string") return message;
  if (
    Array.isArray(message) &&
    message.every((value) => typeof value === "string")
  ) {
    return message.join("; ");
  }
  return STATUS_CODES[status] ?? "Request failed";
}

function createProblem(status: number, detail: string) {
  return {
    type: "about:blank",
    title: STATUS_CODES[status] ?? "Request failed",
    status,
    detail,
  };
}
