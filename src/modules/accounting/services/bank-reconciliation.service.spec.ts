import { BadRequestException } from '@nestjs/common';
import { BankReconciliationService } from './bank-reconciliation.service';
import {
  BankReconciliationController,
  UploadedStatementFile,
} from '../controllers/bank-reconciliation.controller';
import { PrismaService } from '../../../config/prisma.service';

describe('BankReconciliation - File Upload & CSV Security Validation', () => {
  let service: BankReconciliationService;
  let controller: BankReconciliationController;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      bankStatement: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      chartOfAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' }),
      },
      payment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as PrismaService;

    service = new BankReconciliationService(prisma);
    controller = new BankReconciliationController(service, prisma);
  });

  describe('CSV Parsing & Security Invariants', () => {
    it('should parse valid CSV bank statement successfully', () => {
      const validCsv = `Date,Description,Amount,Reference
2026-09-01,Customer Transfer Payment,1500000,REF-001
2026-09-02,Vendor Bill Payment,-750000,REF-002`;

      const rows = service.parseStatement(validCsv);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        date: '2026-09-01',
        description: 'Customer Transfer Payment',
        amount: 1500000,
        reference: 'REF-001',
      });
      expect(rows[1].amount).toBe(-750000);
    });

    it('should reject empty or whitespace-only CSV', () => {
      expect(() => service.parseStatement('')).toThrow(BadRequestException);
      expect(() => service.parseStatement('   \n\n  ')).toThrow(BadRequestException);
    });

    it('should reject CSV with header only and no data rows', () => {
      const headerOnly = 'Date,Description,Amount,Reference';
      expect(() => service.parseStatement(headerOnly)).toThrow(BadRequestException);
    });

    it('should reject CSV with missing required headers', () => {
      const wrongHeaders = `ID,Title,Value,Notes
1,Transfer,1000,Ref1`;
      expect(() => service.parseStatement(wrongHeaders)).toThrow(BadRequestException);
    });

    it('should reject CSV row count exceeding limit (max 5000 rows)', () => {
      const header = 'Date,Description,Amount,Reference\n';
      const row = '2026-09-01,Transfer,1000,REF\n';
      const oversizedCsv = header + row.repeat(5001);

      expect(() => service.parseStatement(oversizedCsv)).toThrow(/CSV row limit exceeded/);
    });

    it('should reject invalid date format in row', () => {
      const invalidDateCsv = `Date,Description,Amount,Reference
not-a-real-date,Payment,100000,REF-001`;

      expect(() => service.parseStatement(invalidDateCsv)).toThrow(/invalid date format/);
    });

    it('should reject invalid non-numeric amount', () => {
      const invalidAmountCsv = `Date,Description,Amount,Reference
2026-09-01,Payment,one-hundred,REF-001`;

      expect(() => service.parseStatement(invalidAmountCsv)).toThrow(/invalid amount/);
    });

    it('should neutralize formula injection / CSV injection payloads', () => {
      const maliciousCsv = `Date,Description,Amount,Reference
2026-09-01,=cmd|'/C calc'!A0,500000,+628123456
2026-09-02,@SUM(1+1)*cmd|' /C notepad'!A0,200000,-danger
2026-09-03,\tmalicious tab,100000,\rsubshell`;

      const rows = service.parseStatement(maliciousCsv);
      expect(rows).toHaveLength(3);

      // Formulas must be escaped with leading single quote to prevent spreadsheet execution
      expect(rows[0].description).toBe(`'=cmd|'/C calc'!A0`);
      expect(rows[0].reference).toBe(`'+628123456`);
      expect(rows[1].description).toBe(`'@SUM(1+1)*cmd|' /C notepad'!A0`);
      expect(rows[1].reference).toBe(`'-danger`);
      expect(rows[2].description).toBe(`'\tmalicious tab`);
      expect(rows[2].reference).toBe(`'\rsubshell`);
    });
  });

  describe('Controller File Upload Guard & Validation', () => {
    it('should reject upload if file is missing', async () => {
      await expect(
        controller.uploadStatement(null as any, 'acc-id', '', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file with non-CSV extension (e.g. .exe, .sh, .pdf)', async () => {
      const maliciousFile: UploadedStatementFile = {
        originalname: 'exploit.exe',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('binary data'),
      };

      await expect(
        controller.uploadStatement(maliciousFile, 'acc-id', '', ''),
      ).rejects.toThrow(/Invalid file extension/);
    });

    it('should reject file with invalid MIME type', async () => {
      const badMimeFile: UploadedStatementFile = {
        originalname: 'statement.csv',
        mimetype: 'application/x-msdownload',
        buffer: Buffer.from('Date,Description,Amount,Reference\n2026-09-01,Test,100,REF1'),
      };

      await expect(
        controller.uploadStatement(badMimeFile, 'acc-id', '', ''),
      ).rejects.toThrow(/Invalid file MIME type/);
    });

    it('should reject empty file buffer', async () => {
      const emptyFile: UploadedStatementFile = {
        originalname: 'empty.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(''),
      };

      await expect(
        controller.uploadStatement(emptyFile, 'acc-id', '', ''),
      ).rejects.toThrow(/empty/);
    });

    it('should reject binary payload containing null bytes disguised as CSV', async () => {
      // Binary payload starting with ELF or null bytes
      const binaryBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x01, 0x00]);
      const binaryFile: UploadedStatementFile = {
        originalname: 'fake.csv',
        mimetype: 'text/csv',
        buffer: binaryBuffer,
      };

      await expect(
        controller.uploadStatement(binaryFile, 'acc-id', '', ''),
      ).rejects.toThrow(/binary payload detected/);
    });

    it('should accept valid CSV file and process through service', async () => {
      jest.spyOn(service, 'uploadStatement').mockResolvedValue([] as any);
      jest.spyOn(service, 'autoMatch').mockResolvedValue([] as any);

      const validFile: UploadedStatementFile = {
        originalname: 'bank_statement_september.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(
          'Date,Description,Amount,Reference\n2026-09-01,Bank Fee,-5000,ADM-01',
        ),
      };

      const result = await controller.uploadStatement(
        validFile,
        '00000000-0000-0000-0000-000000000001',
        '2026-09-01',
        '2026-09-30',
      );

      expect(result.success).toBe(true);
      expect(service.uploadStatement).toHaveBeenCalled();
      expect(service.autoMatch).toHaveBeenCalled();
    });
  });
});
