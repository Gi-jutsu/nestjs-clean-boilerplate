import { Injectable } from "@nestjs/common";
import { PasswordHasher } from "@nestjs/authentication";
import {
  DrizzleUsersRepository,
  emailAlreadyRegistered,
} from "./drizzle-users.repository.js";
import {
  isLegacyPasswordHash,
  verifyLegacyPassword,
} from "./legacy-password.js";

@Injectable()
export class CredentialsService {
  constructor(
    private readonly users: DrizzleUsersRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async register(name: string, email: string, password: string) {
    if (await this.users.findByEmail(email)) throw emailAlreadyRegistered();
    return this.users.create(name, email, await this.passwords.hash(password));
  }

  async verify(email: string, password: string) {
    const credentials = await this.users.findCredentials(email);
    const hash = credentials?.passwordHash;
    const legacy = typeof hash === "string" && isLegacyPasswordHash(hash);
    const valid = legacy
      ? await verifyLegacyPassword(password, hash)
      : await this.passwords.verify(password, hash);

    if (!valid || !hash || !credentials) return null;
    if (legacy || this.passwords.needsRehash(hash)) {
      await this.users.updatePasswordHash(
        credentials.user.id,
        hash,
        await this.passwords.hash(password),
      );
    }
    return credentials.user;
  }
}
