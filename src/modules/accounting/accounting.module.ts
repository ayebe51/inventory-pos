import { Module } from '@nestjs/common';
import { JournalEngineModule } from '../../services/journal-engine/journal-engine.module';
import { JournalEngineService } from '../../services/journal-engine/journal-engine.service';
import { PeriodManagerModule } from '../../services/period-manager/period-manager.module';
import { NumberingModule } from '../../services/numbering/numbering.module';
import { AccountingService } from './services/accounting.service';
import { AccountingController } from './controllers/accounting.controller';
import { BankReconciliationController } from './controllers/bank-reconciliation.controller';
import { BankReconciliationService } from './services/bank-reconciliation.service';
import { FixedAssetController } from './controllers/fixed-asset.controller';
import { FixedAssetService } from './services/fixed-asset.service';

@Module({
  imports: [JournalEngineModule, PeriodManagerModule, NumberingModule],
  controllers: [AccountingController, BankReconciliationController, FixedAssetController],
  providers: [JournalEngineService, AccountingService, BankReconciliationService, FixedAssetService],
  exports: [JournalEngineService, AccountingService, BankReconciliationService, FixedAssetService],
})
export class AccountingModule {}
