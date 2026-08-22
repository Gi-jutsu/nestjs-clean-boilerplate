import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  NotFoundException,
} from "@nestjs/common";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@packages/domain-driven-design/index.js";
import { DateTime } from "luxon";
import { throwError } from "rxjs";
import { catchError } from "rxjs/operators";

type ErrorMapping = {
  ErrorClass: abstract new (...args: any[]) => Error;
  toHttpException: (error: Error) => HttpException;
};

const errorMappings: ErrorMapping[] = [
  {
    ErrorClass: ResourceNotFoundError,
    toHttpException: (error) => new NotFoundException(error, { cause: error }),
  },
  {
    ErrorClass: ResourceAlreadyExistsError,
    toHttpException: (error) => new ConflictException(error, { cause: error }),
  },
];

@Injectable()
export class MapErrorToRfc9457HttpException implements NestInterceptor {
  private readonly logger = new Logger(MapErrorToRfc9457HttpException.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.headers["x-correlation-id"] || "N/A";

    return next
      .handle()
      .pipe(
        catchError((error) => this.throwAsHttpException(error, correlationId)),
      );
  }

  private throwAsHttpException(error: Error, correlationId: string) {
    const colorizedCorrelationId = `\x1b[90m(correlation_id: ${correlationId})\x1b[0m`;
    const colorizedError = `\x1b[31m${error}\x1b[0m`;

    this.logger.error(`${colorizedCorrelationId} ${colorizedError}`);
    this.logger.verbose(`${colorizedCorrelationId} ${error.stack}`);

    if (error instanceof HttpException) {
      return throwError(() => error);
    }

    const httpException = mapErrorToHttpException(error);

    if (httpException) {
      return throwError(() => httpException);
    }

    return throwError(
      () =>
        new HttpException(
          {
            code: (error as any).code ?? "internal-server-error",
            detail: (error as any).detail ?? "An unexpected error occurred.",
            status: (error as any).status ?? HttpStatus.INTERNAL_SERVER_ERROR,
            timestamp: (error as any).timestamp ?? DateTime.now().toISO(),
            title: (error as any).title ?? "Internal Server Error",
          },
          (error as any).status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        ),
    );
  }
}

function mapErrorToHttpException(error: Error) {
  const mapping = errorMappings.find(
    ({ ErrorClass }) => error instanceof ErrorClass,
  );

  return mapping?.toHttpException(error);
}
