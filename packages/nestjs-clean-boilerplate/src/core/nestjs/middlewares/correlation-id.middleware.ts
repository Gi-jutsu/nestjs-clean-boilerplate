import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    request: Request,
    response: Response,
    next: (error?: Error | any) => void,
  ) {
    const correlationId =
      this.extractCorrelationId(request) || this.generateCorrelationId();

    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    next();
  }

  private extractCorrelationId(request: Request): string | undefined {
    return request.headers['x-correlation-id']?.toString();
  }

  private generateCorrelationId(): string {
    return Math.random().toString(36).substring(2);
  }
}
