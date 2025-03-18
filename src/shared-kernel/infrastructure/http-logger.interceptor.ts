import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const start = Date.now();

    this.logger.debug(`[Req] ${request.method} ${request.url}`);

    return next.handle().pipe(
      tap(() => {
        const executionTime = Date.now() - start;

        this.logger.debug(
          `[Res] ${request.method} ${request.url} ${response.statusCode} - ${executionTime}ms`,
        );
      }),
    );
  }
}
