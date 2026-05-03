import { Module } from '@nestjs/common';
import { InventoryService } from './services/inventory.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  providers: [InventoryService, PrismaService],
  exports: [InventoryService],
})
export class InventoryModule {}
