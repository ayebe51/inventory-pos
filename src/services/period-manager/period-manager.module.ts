import { Module } from '@nestjs/common';
import { PeriodManagerService } from './period-manager.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  providers: [PeriodManagerService, PrismaService],
  exports: [PeriodManagerService],
})
export class PeriodManagerModule {}
