import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { ApplicationRuntimeToken } from "@modules/shared-kernel/ports/application-runtime.port.js";
import { HealthCheckUseCase } from "@modules/shared-kernel/use-cases/health-check/health-check.use-case.js";
import { Module } from "@nestjs/common";
import { OutboxModule } from "@nestjs/outbox";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { DomainEventPublisherToken } from "@packages/outbox/index.js";
import { outboxProviders } from "@modules/shared-kernel/infrastructure/outbox.providers.js";

@Module({
  imports: [SharedKernelDatabaseModule, OutboxModule.forRoot()],
  providers: [
    ...outboxProviders,
    {
      provide: ApplicationRuntimeToken,
      useValue: process,
    },
    createNestProvider(HealthCheckUseCase, [
      SharedKernelDatabaseToken,
      ApplicationRuntimeToken,
    ]),
  ],
  exports: [
    HealthCheckUseCase,
    DomainEventPublisherToken,
    OutboxModule,
    SharedKernelDatabaseModule,
  ],
})
export class SharedKernelModule {}
