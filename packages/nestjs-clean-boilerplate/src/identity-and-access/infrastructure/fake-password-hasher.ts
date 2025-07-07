import type { PasswordHasher } from '@identity-and-access/domain/ports/password-hasher.port.js';

// @TODO: only for testing purposes, find a better place for this file
export class FakePasswordHasher implements PasswordHasher {
  async compare(plain: string, hashed: string) {
    return `hashed-${plain}` === hashed;
  }

  async hash(password: string, _saltOrRounds: string | number) {
    return `hashed-${password}`;
  }
}
