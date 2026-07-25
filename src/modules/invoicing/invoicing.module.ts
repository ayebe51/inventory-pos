import { Module } from '@nestjs/common';
import { InvoiceService } from './services/invoice.service';
import { PaymentService } from './services/payment.service';
import { BankReconciliationService } from './services/bank-reconciliation.service';
import { AuditModule } from '../../services/audit/audit.module';
import { NumberingModule } from '../../services/numbering/numbering.module';
import { JournalEngineModule } from '../../services/journal-engine/journal-engine.module';
import { InvoiceController } from './controllers/invoice.controller';
import { PaymentController } from './controllers/payment.controller';

@Module({
  imports: [AuditModule, NumberingModule, JournalEngineModule],
  controllers: [InvoiceController, PaymentController],
  providers: [
    InvoiceService,
    PaymentService,
    BankReconciliationService,
  ],
  exports: [InvoiceService, PaymentService, BankReconciliationService],
})
export class InvoicingModule {}
