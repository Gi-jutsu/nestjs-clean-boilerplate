import { createSharedKernelDrizzleModuleOptions } from "@modules/shared-kernel/infrastructure/database/drizzle-module.factory.js";
import { Module } from "@nestjs/common";
import { DrizzleModule } from "@nestjs/drizzle";

@Module({
  imports: [
    DrizzleModule.forRootAsync(createSharedKernelDrizzleModuleOptions()),
  ],
  exports: [DrizzleModule],
})
export class SharedKernelDatabaseModule {}
