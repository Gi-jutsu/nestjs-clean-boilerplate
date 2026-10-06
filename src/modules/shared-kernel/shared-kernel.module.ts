import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { SharedKernelDatabaseToken } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.token.js";
import { DrizzleHealthIndicator } from "@modules/shared-kernel/infrastructure/health/drizzle-health.indicator.js";
import { outboxProviders } from "@modules/shared-kernel/infrastructure/outbox.providers.js";
import { Module } from "@nestjs/common";
import { OutboxModule } from "@nestjs/outbox";
import { HealthIndicatorService, TerminusModule } from "@nestjs/terminus";
import { createNestProvider } from "@packages/nest-provider-factory/index.js";
import { DomainEventPublisherToken } from "@packages/outbox/index.js";

@Module({
  imports: [SharedKernelDatabaseModule, OutboxModule.forRoot(), TerminusModule],
  providers: [
    ...outboxProviders,
    createNestProvider(DrizzleHealthIndicator, [
      SharedKernelDatabaseToken,
      HealthIndicatorService,
    ]),
  ],
  exports: [
    DrizzleHealthIndicator,
    TerminusModule,
    DomainEventPublisherToken,
    OutboxModule,
    SharedKernelDatabaseModule,
  ],
})
export class SharedKernelModule {}
