import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { ResourceAlreadyExistsError } from '@shared-kernel/domain/errors/resource-already-exists.error.js';
import { ResourceNotFoundError } from '@shared-kernel/domain/errors/resource-not-found.error.js';
import { DateTime } from 'luxon';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class MapErrorToRfc9457HttpException implements NestInterceptor {
  private readonly logger = new Logger(MapErrorToRfc9457HttpException.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.headers['x-correlation-id'] || 'N/A';

    return next
      .handle()
      .pipe(
        catchError((error) => this.throwAsHttpException(error, correlationId)),
      );
  }

  private throwAsHttpException(error: unknown, correlationId: string) {
    const colorizedCorrelationId = `\x1b[90m(correlation_id: ${correlationId})\x1b[0m`;
    const colorizedError = `\x1b[31m${error}\x1b[0m`;

    this.logger.error(`${colorizedCorrelationId} ${colorizedError}`);

    // @TODO: Map ValidationErrors to RFC9457
    // for now, we are just returning the error as is
    if (error instanceof BadRequestException) {
      return throwError(() => error);
    }

    if (error instanceof ResourceNotFoundError) {
      return throwError(() => new NotFoundException(error, { cause: error }));
    }

    if (error instanceof ResourceAlreadyExistsError) {
      return throwError(() => new ConflictException(error, { cause: error }));
    }

    return throwError(
      () =>
        new HttpException(
          {
            code: (error as any).code ?? 'internal-server-error',
            detail: (error as any).detail ?? 'An unexpected error occurred.',
            status: (error as any).status ?? HttpStatus.INTERNAL_SERVER_ERROR,
            timestamp: (error as any).timestamp ?? DateTime.now().toISO(),
            title: (error as any).title ?? 'Internal Server Error',
          },
          (error as any).status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        ),
    );
  }
}
