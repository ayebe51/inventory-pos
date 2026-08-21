import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { appConfig, databaseConfig, validateAppConfig } from './config';
import { redisConfig } from './config/redis.config';
import { AppController } from './app.controller';
import { PrismaService } from './config/prisma.service';
import { PrismaModule } from './config/prisma.module';
import { PrismaReadService } from './config/prisma-read.service';
import { CacheModule } from './services/cache/cache.module';
import { RbacModule } from './services/rbac/rbac.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PosModule } from './modules/pos/pos.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { AuthModule } from './services/auth/auth.module';
import { ExportModule } from './services/export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig],
      validate: validateAppConfig,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    RbacModule,
    CacheModule,
    MasterDataModule,
    PurchaseModule,
    InventoryModule,
    PosModule,
    InvoicingModule,
    AccountingModule,
    ReportingModule,
    GovernanceModule,
    AuthModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    PrismaService, 
    PrismaReadService
  ],
  exports: [PrismaService, PrismaReadService],
})
export class AppModule {}
