import { ApplicationEnvironmentSchema } from "@api/environment.js";
import { HttpLoggerInterceptor } from "@api/interceptors/http-logger.interceptor.js";
import { ProblemDetailsFilter } from "@api/filters/problem-details.filter.js";
import { CorrelationIdMiddleware } from "@api/middlewares/correlation-id.middleware.js";
import { IdentityAndAccessModule } from "@modules/identity-and-access/identity-and-access.module.js";
import { SharedKernelModule } from "@modules/shared-kernel/shared-kernel.module.js";
import { HealthCheckHttpController } from "@modules/shared-kernel/use-cases/health-check/health-check.controller.js";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  HttpAdapterHost,
} from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE = 100;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: ApplicationEnvironmentSchema.parse,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: ONE_MINUTE_IN_MILLISECONDS,
        limit: MAXIMUM_NUMBER_OF_REQUESTS_PER_MINUTE,
      },
    ]),
    SharedKernelModule,
    IdentityAndAccessModule,
  ],
  controllers: [HealthCheckHttpController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggerInterceptor,
    },
    createNestProvider(ProblemDetailsFilter, [HttpAdapterHost], APP_FILTER),
  ],
})
export class ApplicationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
