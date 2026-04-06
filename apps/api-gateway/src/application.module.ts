import { IdentityAndAccessModule } from "@workspace/identity-and-access";
import { SharedKernelModule } from "@workspace/shared-kernel";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { MapErrorToRfc9457HttpException } from "./interceptors/map-error-to-rfc9457-http-exception.interceptor.js";
import { CorrelationIdMiddleware } from "./middlewares/correlation-id.middleware.js";

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE = 100;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: ONE_MINUTE_IN_MILLISECONDS,
        limit: MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE,
      },
    ]),

    IdentityAndAccessModule,
    SharedKernelModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MapErrorToRfc9457HttpException,
    },
  ],
})
export class ApplicationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
