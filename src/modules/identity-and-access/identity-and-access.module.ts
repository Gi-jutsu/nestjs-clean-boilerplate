import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { createBetterAuthModule } from "@modules/identity-and-access/infrastructure/better-auth-module.factory.js";
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
