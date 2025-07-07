import type { AccountRepository } from '@identity-and-access/domain/account/repository.js';
import type { JwtService } from '@identity-and-access/domain/ports/jwt-service.port.js';
import type { PasswordHasher } from '@identity-and-access/domain/ports/password-hasher.port.js';
import { ResourceNotFoundError } from '@shared-kernel/domain/errors/resource-not-found.error.js';
import { WrongPasswordError } from './errors/wrong-password.error.js';

export class SignInWithCredentialsUseCase {
  constructor(
    private readonly allAccounts: AccountRepository,
    private readonly jwt: JwtService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: SignInWithCredentialsCommand) {
    const account = await this.allAccounts.findByEmail(command.email);

    if (!account) {
      throw new ResourceNotFoundError({
        resource: 'Account',
        searchedByFieldName: 'email',
        searchedByValue: command.email,
      });
    }

    const isPasswordCorrect = await this.passwordHasher.compare(
      command.password,
      account.properties.password,
    );

    if (!isPasswordCorrect) {
      throw new WrongPasswordError();
    }

    return {
      accessToken: this.jwt.sign({ sub: account.id }),
    };
  }
}

type SignInWithCredentialsCommand = {
  email: string;
  password: string;
};
