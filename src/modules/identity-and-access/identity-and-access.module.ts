import { Module } from "@nestjs/common";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { createAuthenticationModule } from "@modules/identity-and-access/infrastructure/authentication/authentication-module.factory.js";
import { CredentialsService } from "@modules/identity-and-access/infrastructure/authentication/credentials.service.js";
import { DrizzleSessionStore } from "@modules/identity-and-access/infrastructure/authentication/drizzle-session.store.js";
import { DrizzleUsersRepository } from "@modules/identity-and-access/infrastructure/authentication/drizzle-users.repository.js";
import { SessionAuthenticationProvider } from "@modules/identity-and-access/infrastructure/authentication/session-authentication.provider.js";
import { AuthenticationHttpController } from "@modules/identity-and-access/use-cases/authentication/authentication.controller.js";
import { DisabledAuthenticationFeaturesStore } from "@modules/identity-and-access/infrastructure/authentication/disabled-authentication-features.store.js";

@Module({
  imports: [SharedKernelDatabaseModule, createAuthenticationModule()],
  controllers: [AuthenticationHttpController],
  providers: [
    DrizzleUsersRepository,
    CredentialsService,
    DrizzleSessionStore,
    DisabledAuthenticationFeaturesStore,
    SessionAuthenticationProvider,
  ],
})
export class IdentityAndAccessModule {}
