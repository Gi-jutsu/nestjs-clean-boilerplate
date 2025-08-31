import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './infrastructure/better-auth.js';

@Module({
  imports: [AuthModule.forRoot(auth)],
})
export class IdentityAndAccessModule {}
