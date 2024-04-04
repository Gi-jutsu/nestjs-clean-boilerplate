import type { User } from "../../../domain/user/aggregate-root";
import type { UserRepository } from "../../../domain/user/repository";

export class StubUserRepository implements UserRepository {
  public readonly users: User[] = [];

  public async existsByCredentials(
    credentials: User["credentials"]
  ): Promise<boolean> {
    return this.users.some(
      (user) =>
        user.credentials.email === credentials.email &&
        user.credentials.password === credentials.password
    );
  }

  async save(user: User): Promise<void> {
    this.users.push(user);
  }
}
