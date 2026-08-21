import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class FixedAssetService {
  private readonly logger = new Logger(FixedAssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  async findAll() {
    return this.prisma.fixedAsset.findMany({
      include: {
        asset_account: true,
        depreciation_expense_account: true,
        accum_depreciation_account: true,
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async create(data: any, branchId: UUID) {
    return this.prisma.fixedAsset.create({
      data: {
        code: data.code,
        name: data.name,
        purchase_date: new Date(data.purchase_date),
        purchase_price: data.purchase_price,
        salvage_value: data.salvage_value || 0,
        useful_life_months: data.useful_life_months,
        accumulated_depreciation: 0,
        status: 'ACTIVE',
        branch_id: branchId,
        asset_account_id: data.asset_account_id,
        depreciation_expense_account_id: data.depreciation_expense_account_id,
        accum_depreciation_account_id: data.accum_depreciation_account_id,
      }
    });
  }

  /**
   * Run depreciation for all active fixed assets.
   * Typically called monthly via a cron job or manual trigger.
   */
  async runDepreciation(branchId?: UUID, userId?: UUID) {
    const assets = await this.prisma.fixedAsset.findMany({
      where: { status: 'ACTIVE' }
    });

    let count = 0;

    for (const asset of assets) {
      const pPrice = Number(asset.purchase_price);
      const sValue = Number(asset.salvage_value);
      const usefulLife = asset.useful_life_months;
      const accumDep = Number(asset.accumulated_depreciation);

      const netBookValue = pPrice - accumDep;
      if (netBookValue <= sValue) {
        continue; // Fully depreciated
      }

      // Straight line depreciation
      let monthlyDepreciation = (pPrice - sValue) / usefulLife;
      
      // Prevent over-depreciation
      if (netBookValue - monthlyDepreciation < sValue) {
        monthlyDepreciation = netBookValue - sValue;
      }

      // Round to 2 decimals
      monthlyDepreciation = Math.round(monthlyDepreciation * 100) / 100;

      if (monthlyDepreciation <= 0) continue;

      await this.prisma.$transaction(async (tx) => {
        // 1. Update Asset
        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulated_depreciation: {
              increment: monthlyDepreciation
            }
          }
        });

        // 2. Journal Entry
        await this.journalEngine.createManualEntry(
          'DEPRECIATION',
          asset.id as UUID,
          `Depreciation for ${asset.name}`,
          new Date(),
          [
            { account_id: asset.depreciation_expense_account_id as UUID, debit: monthlyDepreciation, credit: 0 },
            { account_id: asset.accum_depreciation_account_id as UUID, debit: 0, credit: monthlyDepreciation }
          ],
          userId || 'SYSTEM'
        );
      });
      
      count++;
    }

    return { processed: count, message: `Successfully ran depreciation for ${count} assets.` };
  }
}
