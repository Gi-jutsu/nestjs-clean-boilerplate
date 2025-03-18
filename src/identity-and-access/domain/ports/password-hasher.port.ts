export interface PasswordHasher {
  compare(plain: string, hashed: string): Promise<boolean>;
  hash(password: string, saltOrRounds: string | number): Promise<string>;
}

export const PasswordHasherToken = Symbol('PasswordHasher');
