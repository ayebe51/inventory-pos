import { Module } from '@nestjs/common';
import { JournalEngineModule } from '../../services/journal-engine/journal-engine.module';
import { JournalEngineService } from '../../services/journal-engine/journal-engine.service';

@Module({
  imports: [JournalEngineModule],
  exports: [JournalEngineService],
})
export class AccountingModule {}
