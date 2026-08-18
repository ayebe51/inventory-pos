import { Module } from '@nestjs/common';
import { POSService } from './services/pos.service';
import { SalesOrderService } from './services/sales-order.service';
import { PrismaService } from '../../config/prisma.service';
import { NumberingModule } from '../../services/numbering/numbering.module';
import { JournalEngineModule } from '../../services/journal-engine/journal-engine.module';
import { PeriodManagerModule } from '../../services/period-manager/period-manager.module';
import { POSController } from './controllers/pos.controller';
import { SalesOrderController } from './controllers/sales-order.controller';

@Module({
  imports: [NumberingModule, JournalEngineModule, PeriodManagerModule],
  controllers: [POSController, SalesOrderController],
  providers: [POSService, SalesOrderService, PrismaService],
  exports: [POSService, SalesOrderService],
})
export class PosModule {}
