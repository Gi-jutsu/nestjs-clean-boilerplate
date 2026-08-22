import { DrizzlePostgresPoolToken } from "@modules/shared-kernel/infrastructure/database/drizzle-postgres-pool.token.js";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { ApplicationRuntimeToken } from "@modules/shared-kernel/ports/application-runtime.port.js";
import { HealthCheckUseCase } from "@modules/shared-kernel/use-cases/health-check/health-check.use-case.js";
import { Module } from "@nestjs/common";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { OutboxModule } from "@packages/outbox/index.js";

@Module({
  imports: [
    SharedKernelDatabaseModule,
    OutboxModule.register({
      databaseToken: DrizzlePostgresPoolToken,
      imports: [SharedKernelDatabaseModule],
    }),
  ],
  providers: [
    {
      provide: ApplicationRuntimeToken,
      useValue: process,
    },
    createNestProvider(HealthCheckUseCase, [
      DrizzlePostgresPoolToken,
      ApplicationRuntimeToken,
    ]),
  ],
  exports: [HealthCheckUseCase, OutboxModule, SharedKernelDatabaseModule],
})
export class SharedKernelModule {}
