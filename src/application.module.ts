import { IdentityAndAccessModule } from "@identity-and-access/identity-and-access.module.js";
import { Module } from "@nestjs/common";
import { SharedKernelModule } from "@shared-kernel/shared-kernel.module.js";

@Module({
  imports: [IdentityAndAccessModule, SharedKernelModule],
})
export class ApplicationModule {}
