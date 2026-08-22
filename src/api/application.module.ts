import { DrizzlePostgresPoolToken } from "@api/drizzle-module/constants.js";
import { ApplicationEnvironmentSchema } from "@api/environment.js";
import { HealthCheckHttpController } from "@api/use-cases/health-check/health-check.controller.js";
import { HealthCheckUseCase } from "@api/use-cases/health-check/health-check.use-case.js";
import { IdentityAndAccessModule } from "@identity-and-access/identity-and-access.module.js";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  createNestProvider,
  type BrandedInjectionToken,
} from "@packages/nest-provider-factory/index.js";
import { SharedKernelModule } from "@shared-kernel/shared-kernel.module.js";

const NodeJsProcessToken = Symbol(
  "Process",
) as BrandedInjectionToken<NodeJS.Process>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: ApplicationEnvironmentSchema.parse,
    }),
    IdentityAndAccessModule,
    SharedKernelModule,
  ],
  controllers: [HealthCheckHttpController],
  providers: [
    {
      provide: NodeJsProcessToken,
      useValue: process,
    },
    createNestProvider(HealthCheckUseCase, [
      DrizzlePostgresPoolToken,
      NodeJsProcessToken,
    ]),
  ],
})
export class ApplicationModule {}
