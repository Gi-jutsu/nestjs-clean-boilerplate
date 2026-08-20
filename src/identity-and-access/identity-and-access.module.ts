import { EnvironmentKeys } from "@core/environment.js";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard, AuthModule } from "@thallesp/nestjs-better-auth";
import { createBetterAuth } from "./infrastructure/better-auth.js";

@Module({
  imports: [
    AuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        auth: createBetterAuth(config.getOrThrow(EnvironmentKeys.DATABASE_URL)),
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class IdentityAndAccessModule {}
