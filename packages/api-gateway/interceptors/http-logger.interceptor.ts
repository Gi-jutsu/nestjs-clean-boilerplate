import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { tap } from "rxjs/operators";

@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const start = Date.now();

    const correlationId = request.headers["x-correlation-id"];
    // ANSI escape code for gray color
    const grayCorrelationId = `\x1b[90m(correlation_id: ${correlationId})\x1b[0m`;

    this.logger.debug(
      `[Request] ${grayCorrelationId} ${request.method} ${request.url}`,
    );

    return next.handle().pipe(
      tap(() => {
        const executionTime = Date.now() - start;

        this.logger.debug(
          `[Response] (correlation_id: ${grayCorrelationId}) ${request.method} ${request.url} ${response.statusCode} - ${executionTime}ms`,
        );
      }),
    );
  }
}
