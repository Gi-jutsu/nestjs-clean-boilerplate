import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: (error?: Error) => void) {
    const correlationId = getOrCreateCorrelationId(request.headers);
    response.setHeader("x-correlation-id", correlationId);

    next();
  }
}

export function getOrCreateCorrelationId(headers: IncomingHttpHeaders) {
  const incoming = headers["x-correlation-id"];
  const correlationId =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();
  headers["x-correlation-id"] = correlationId;
  return correlationId;
}
