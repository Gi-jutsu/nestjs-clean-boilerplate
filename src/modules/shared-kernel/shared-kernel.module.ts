import { DrizzlePostgresPoolToken } from "@modules/shared-kernel/infrastructure/database/drizzle-postgres-pool.token.js";
import { SharedKernelDatabaseModule } from "@modules/shared-kernel/infrastructure/database/shared-kernel-database.module.js";
import { Module } from "@nestjs/common";
import { OutboxModule } from "@packages/outbox/index.js";

@Module({
  imports: [
    SharedKernelDatabaseModule,
    OutboxModule.register({
      databaseToken: DrizzlePostgresPoolToken,
      imports: [SharedKernelDatabaseModule],
    }),
  ],
  exports: [OutboxModule, SharedKernelDatabaseModule],
})
export class SharedKernelModule {}
