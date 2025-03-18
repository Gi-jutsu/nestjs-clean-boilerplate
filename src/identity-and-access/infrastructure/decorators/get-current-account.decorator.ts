import type { Account } from '@identity-and-access/domain/account/aggregate-root.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const GetCurrentAccount = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.account;
});

export type CurrentAccount = Pick<Account, 'id'>;
