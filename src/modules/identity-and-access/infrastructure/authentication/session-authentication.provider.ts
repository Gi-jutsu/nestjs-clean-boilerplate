import { Injectable } from "@nestjs/common";
import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from "@nestjs/authentication";
import type { AuthenticationUser } from "./authentication-user.js";
import { DrizzleUsersRepository } from "./drizzle-users.repository.js";

@Injectable()
export class SessionAuthenticationProvider extends SessionCookieProvider<AuthenticationUser> {
  constructor(
    private readonly users: DrizzleUsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  validate(session: SessionRecord) {
    return this.users.findById(session.userId);
  }
}
