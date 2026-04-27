import { Module } from '@nestjs/common';
import { JournalEngineService } from './journal-engine.service';
import { NumberingModule } from '../numbering/numbering.module';
import { PrismaService } from '../../config/prisma.service';
import { PeriodManagerModule } from '../period-manager/period-manager.module';

@Module({
  imports: [NumberingModule, PeriodManagerModule],
  providers: [JournalEngineService, PrismaService],
  exports: [JournalEngineService],
})
export class JournalEngineModule {}
