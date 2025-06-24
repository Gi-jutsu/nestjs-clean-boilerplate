import type { Account } from '@identity-and-access/domain/account/aggregate-root.js';
import {
  accountSchema,
  type IdentityAndAccessDatabaseTransaction,
} from '@identity-and-access/infrastructure/database/drizzle.schema.js';
import { ResourceNotFoundError } from '@shared-kernel/domain/errors/resource-not-found.error.js';
import { eq } from 'drizzle-orm';

export class GetLoggedInAccountQueryHandler {
  constructor(
    private readonly database: IdentityAndAccessDatabaseTransaction,
  ) {}

  async execute(query: GetLoggedInAccountQuery) {
    const [snapshot] = await this.database
      .select()
      .from(accountSchema)
      .where(eq(accountSchema.id, query.account.id))
      .limit(1);

    if (!snapshot) {
      throw new ResourceNotFoundError({
        resource: 'Account',
        searchedByFieldName: 'id',
        searchedByValue: query.account.id,
      });
    }

    return {
      id: snapshot.id,
      email: snapshot.email,
    };
  }
}

type GetLoggedInAccountQuery = {
  account: Pick<Account, 'id'>;
};
