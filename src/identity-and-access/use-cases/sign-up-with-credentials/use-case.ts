import { Account } from '@identity-and-access/domain/account/aggregate-root.js';
import type { AccountRepository } from '@identity-and-access/domain/account/repository.js';
import type { PasswordHasher } from '@identity-and-access/domain/ports/password-hasher.port.js';
import { ResourceAlreadyExistsError } from '@shared-kernel/domain/errors/resource-already-exists.error.js';

export class SignUpWithCredentialsUseCase {
  constructor(
    private readonly allAccounts: AccountRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: SignInWithCredentialsCommand) {
    const isEmailTaken = await this.allAccounts.isEmailTaken(command.email);
    if (isEmailTaken) {
      throw new ResourceAlreadyExistsError({
        conflictingFieldName: 'email',
        conflictingFieldValue: command.email,
        resource: 'Account',
      });
    }

    const account = Account.create({
      email: command.email,
      password: await this.passwordHasher.hash(command.password, 10),
    });

    await this.allAccounts.save(account);

    return {
      account: { id: account.id },
    };
  }
}

type SignInWithCredentialsCommand = {
  email: string;
  password: string;
};
