import { createBetterAuthModule } from "@identity-and-access/infrastructure/better-auth-module.factory.js";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "@thallesp/nestjs-better-auth";

@Module({
  imports: [createBetterAuthModule()],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class IdentityAndAccessModule {}
