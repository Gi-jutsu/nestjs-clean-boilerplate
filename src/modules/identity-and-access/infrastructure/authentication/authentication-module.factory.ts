import { IdentityAndAccessEnvironmentKeys } from "@modules/identity-and-access/environment.js";
import {
  AuthenticationModule,
  type AuthenticationModuleOptions,
} from "@nestjs/authentication";
import { ConfigService } from "@nestjs/config";

export function createAuthenticationModule() {
  return AuthenticationModule.forRootAsync({
    inject: [ConfigService],
    useFactory: createAuthenticationOptions,
  });
}

function createAuthenticationOptions(
  config: ConfigService,
): AuthenticationModuleOptions {
  return {
    session: {
      absoluteTtl: "7d",
      idleTtl: "1d",
      cookie: {
        secure: config.getOrThrow(
          IdentityAndAccessEnvironmentKeys.AUTH_COOKIE_SECURE,
        ),
      },
      trustedOrigins: [
        new URL(config.getOrThrow<string>("API_BASE_URL")).origin,
        ...config.getOrThrow<string[]>(
          IdentityAndAccessEnvironmentKeys.AUTH_TRUSTED_ORIGINS,
        ),
      ],
      metadata: (request) => ({
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      }),
    },
  };
}
