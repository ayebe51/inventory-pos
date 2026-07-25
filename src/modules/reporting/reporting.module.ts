import { Module } from '@nestjs/common';

import { ReportingService } from './services/reporting.service';
import { PrismaService } from '../../config/prisma.service';
import { ReportingController } from './controllers/reporting.controller';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, PrismaService],
  exports: [ReportingService],
})
export class ReportingModule {}
