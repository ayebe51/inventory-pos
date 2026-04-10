import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, databaseConfig, validateAppConfig } from './config';
import { redisConfig } from './config/redis.config';
import { PrismaService } from './config/prisma.service';
import { PrismaReadService } from './config/prisma-read.service';
import { CacheModule } from './services/cache/cache.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PosModule } from './modules/pos/pos.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { GovernanceModule } from './modules/governance/governance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig],
      validate: validateAppConfig,
      envFilePath: ['.env'],
    }),
    CacheModule,
    MasterDataModule,
    PurchaseModule,
    InventoryModule,
    PosModule,
    InvoicingModule,
    AccountingModule,
    ReportingModule,
    GovernanceModule,
  ],
  providers: [PrismaService, PrismaReadService],
  exports: [PrismaService, PrismaReadService],
})
export class AppModule {}
