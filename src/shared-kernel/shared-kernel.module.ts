import { DrizzleModule } from "@api/drizzle-module/module.js";
import { HttpLoggerInterceptor } from "@api/interceptors/http-logger.interceptor.js";
import { MapErrorToRfc9457HttpException } from "@api/interceptors/map-error-to-rfc9457-http-exception.interceptor.js";
import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { MailerToken } from "@shared-kernel/domain/ports/mailer.port.js";
import { SharedKernelEnvironmentKeys } from "@shared-kernel/environment.js";
import { ConsoleMailer } from "@shared-kernel/infrastructure/console-mailer.adapter.js";

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE = 100;

@Global()
@Module({
  imports: [
    DrizzleModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connectionString: config.getOrThrow(
          SharedKernelEnvironmentKeys.DATABASE_URL,
        ),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: ONE_MINUTE_IN_MILLISECONDS,
        limit: MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MapErrorToRfc9457HttpException,
    },
    {
      provide: MailerToken,
      useClass: ConsoleMailer,
    },
  ],
  exports: [DrizzleModule, MailerToken],
})
export class SharedKernelModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
