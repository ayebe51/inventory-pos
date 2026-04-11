import { Module } from '@nestjs/common';
import { JournalEngineService } from './journal-engine.service';
import { NumberingModule } from '../numbering/numbering.module';
import { PrismaService } from '../../config/prisma.service';

@Module({
  imports: [NumberingModule],
  providers: [JournalEngineService, PrismaService],
  exports: [JournalEngineService],
})
export class JournalEngineModule {}
