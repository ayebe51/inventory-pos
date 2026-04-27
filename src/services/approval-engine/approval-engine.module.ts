import { Module } from '@nestjs/common';
import { ApprovalEngineService } from './approval-engine.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  providers: [ApprovalEngineService, PrismaService],
  exports: [ApprovalEngineService],
})
export class ApprovalEngineModule {}
