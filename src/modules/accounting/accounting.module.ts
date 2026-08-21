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
import { ARService } from './services/ar.service';
import { ARController } from './controllers/ar.controller';
import { APService } from './services/ap.service';
import { APController } from './controllers/ap.controller';
import { CashBankService } from './services/cash-bank.service';
import { CashBankController } from './controllers/cash-bank.controller';
import { ExpenseService } from './services/expense.service';
import { ExpenseController } from './controllers/expense.controller';
import { TaxService } from './services/tax.service';
import { TaxController } from './controllers/tax.controller';

@Module({
  imports: [JournalEngineModule, PeriodManagerModule, NumberingModule],
  controllers: [
    AccountingController,
    BankReconciliationController,
    FixedAssetController,
    ARController,
    APController,
    CashBankController,
    ExpenseController,
    TaxController,
  ],
  providers: [
    JournalEngineService,
    AccountingService,
    BankReconciliationService,
    FixedAssetService,
    ARService,
    APService,
    CashBankService,
    ExpenseService,
    TaxService,
  ],
  exports: [
    JournalEngineService,
    AccountingService,
    BankReconciliationService,
    FixedAssetService,
    ARService,
    APService,
    CashBankService,
    ExpenseService,
    TaxService,
  ],
})
export class AccountingModule {}

