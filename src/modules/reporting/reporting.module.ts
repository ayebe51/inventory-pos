import { Module } from '@nestjs/common';

import { ReportingService } from './services/reporting.service';
import { ReportingController } from './controllers/reporting.controller';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
