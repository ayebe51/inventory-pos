import { Module } from '@nestjs/common';
import { InventoryService } from './services/inventory.service';
import { StockOpnameService } from './services/stock-opname.service';
import { NumberingModule } from '../../services/numbering/numbering.module';
import { PrismaService } from '../../config/prisma.service';
import { InventoryController } from './controllers/inventory.controller';
import { StockOpnameController } from './controllers/stock-opname.controller';
import { StockTransferController } from './controllers/stock-transfer.controller';

@Module({
  imports: [NumberingModule],
  controllers: [InventoryController, StockOpnameController, StockTransferController],
  providers: [InventoryService, StockOpnameService, PrismaService],
  exports: [InventoryService, StockOpnameService],
})
export class InventoryModule {}
