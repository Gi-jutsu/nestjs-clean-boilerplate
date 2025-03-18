import { Controller, Get } from '@nestjs/common';
import { GetLoggedInAccountQueryHandler } from './query-handler.js';
import {
  type CurrentAccount,
  GetCurrentAccount,
} from '@identity-and-access/infrastructure/decorators/get-current-account.decorator.js';

@Controller()
export class GetLoggedInAccountHttpController {
  constructor(private readonly queryHandler: GetLoggedInAccountQueryHandler) {}

  @Get('/auth/me')
  async handle(@GetCurrentAccount() account: CurrentAccount) {
    return await this.queryHandler.execute({ account });
  }
}
