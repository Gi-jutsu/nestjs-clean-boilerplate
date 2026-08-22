import { createSharedKernelDrizzleModuleOptions } from "@modules/shared-kernel/infrastructure/database/drizzle-module.factory.js";
import { Module } from "@nestjs/common";
import { DrizzleModule } from "@packages/nest-drizzle/index.js";

@Module({
  imports: [
    DrizzleModule.registerAsync(createSharedKernelDrizzleModuleOptions()),
  ],
  exports: [DrizzleModule],
})
export class SharedKernelDatabaseModule {}
