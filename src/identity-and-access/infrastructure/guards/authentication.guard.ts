import { PUBLIC_METADATA } from '@shared-kernel/infrastructure/decorators/public.decorator.js';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type JwtService,
  JwtServiceToken,
} from '@identity-and-access/domain/ports/jwt-service.port.js';
import { z } from 'zod';
import type { CurrentAccount } from '@identity-and-access/infrastructure/decorators/get-current-account.decorator.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(JwtServiceToken)
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  private hasPublicDecorator(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride(PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  canActivate(context: ExecutionContext) {
    if (this.hasPublicDecorator(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const token = request.cookies['token'];
    if (!token) {
      return false;
    }

    const claims = this.getTokenClaims(token);
    if (!claims) {
      return false;
    }

    request.account = { id: claims.sub } satisfies CurrentAccount;

    return true;
  }

  private getTokenClaims(token: string) {
    const payload = this.jwt.verify(token);
    const schema = z.object({
      sub: z.string(),
    });

    const result = schema.safeParse(payload);
    const claims = result.success ? result.data : null;

    return claims;
  }
}
