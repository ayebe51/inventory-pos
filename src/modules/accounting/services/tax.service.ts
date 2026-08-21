import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadService } from '../../../config/prisma-read.service';
import { PrismaService } from '../../../config/prisma.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prisma: PrismaService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Get PPN (VAT) Summary: PPN Keluaran vs PPN Masukan
   */
  async getTaxSummary(periodId?: UUID) {
    const activePeriod = periodId
      ? await this.prismaRead.fiscalPeriod.findUnique({ where: { id: periodId } })
      : await this.prismaRead.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });

    if (!activePeriod) {
      return { output_tax: 0, input_tax: 0, net_tax_payable: 0 };
    }

    // PPN Keluaran (2.102.001) Credit balance
    // PPN Masukan (1.105.001) Debit balance
    const result = await this.prismaRead.$queryRawUnsafe<any[]>(`
      SELECT 
        c.account_code,
        c.account_name,
        COALESCE(SUM(l.credit - l.debit), 0) as net_credit,
        COALESCE(SUM(l.debit - l.credit), 0) as net_debit
      FROM chart_of_accounts c
      JOIN journal_entry_lines l ON c.id = l.account_id
      JOIN journal_entries j ON l.je_id = j.id
      WHERE j.period_id = $1::uuid AND j.status = 'POSTED'
        AND c.account_code IN ('2.102.001', '1.105.001')
      GROUP BY c.account_code, c.account_name
    `, activePeriod.id);

    let outputTax = 0;
    let inputTax = 0;

    for (const row of result) {
      if (row.account_code === '2.102.001') {
        outputTax = Number(row.net_credit);
      } else if (row.account_code === '1.105.001') {
        inputTax = Number(row.net_debit);
      }
    }

    const netTaxPayable = outputTax - inputTax;

    return {
      period_id: activePeriod.id,
      period_name: activePeriod.period_name,
      output_tax: outputTax,
      input_tax: inputTax,
      net_tax_payable: netTaxPayable,
    };
  }

  /**
   * Record Tax Payment to government
   */
  async recordTaxPayment(amount: number, bankAccountId: UUID, userId: UUID) {
    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      const ppnKeluaranAcct = await tx.chartOfAccount.findFirst({ where: { account_code: '2.102.001' } });
      if (!ppnKeluaranAcct) throw new BusinessRuleException('PPN Keluaran account not found', ErrorCode.NOT_FOUND);

      // Debit PPN Keluaran (2.102.001), Credit Bank Account
      const je = await this.journalEngine.createManualEntry(
        'TAX_PAYMENT',
        ppnKeluaranAcct.id,
        'Setor PPN Keluaran ke Kas Negara',
        new Date(),
        [
          { account_id: ppnKeluaranAcct.id, debit: amount, credit: 0 },
          { account_id: bankAccountId, debit: 0, credit: amount },
        ],
        userId,
        tx,
      );

      return je;
    });
  }
}
