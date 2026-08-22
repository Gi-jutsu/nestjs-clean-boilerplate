import { IdentityAndAccessModule } from "@identity-and-access/identity-and-access.module.js";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EnvironmentSchema } from "@shared-kernel/environment.js";
import { SharedKernelModule } from "@shared-kernel/shared-kernel.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: EnvironmentSchema.parse,
    }),
    IdentityAndAccessModule,
    SharedKernelModule,
  ],
})
export class ApplicationModule {}
