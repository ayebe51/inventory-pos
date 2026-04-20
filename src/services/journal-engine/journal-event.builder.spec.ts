import { JournalEventBuilder, JournalEventFactory } from './journal-event.builder';
import { BusinessEvent } from '../../modules/accounting/interfaces/accounting.interfaces';

describe('JournalEventBuilder', () => {
  const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
  const mockPeriodId = '123e4567-e89b-12d3-a456-426614174001';
  const mockAccountId1 = '123e4567-e89b-12d3-a456-426614174002';
  const mockAccountId2 = '123e4567-e89b-12d3-a456-426614174003';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174004';

  describe('build', () => {
    it('should build a valid business event with required fields', () => {
      const event = new JournalEventBuilder()
        .withEventType('GOODS_RECEIPT')
        .withReference('GR', mockUUID, 'GR-202501-00001')
        .withPeriod(mockPeriodId, new Date('2025-01-15'))
        .withCreatedBy(mockUserId)
        .addDebitLine(mockAccountId1, 1000000)
        .addCreditLine(mockAccountId2, 1000000)
        .build();

      expect(event.event_type).toBe('GOODS_RECEIPT');
      expect(event.reference_type).toBe('GR');
      expect(event.reference_id).toBe(mockUUID);
      expect(event.reference_number).toBe('GR-202501-00001');
      expect(event.period_id).toBe(mockPeriodId);
      expect(event.created_by).toBe(mockUserId);
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(1000000);
      expect(event.lines![0].credit).toBe(0);
      expect(event.lines![1].debit).toBe(0);
      expect(event.lines![1].credit).toBe(1000000);
    });

    it('should throw error when event type is missing', () => {
      expect(() => {
        new JournalEventBuilder()
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withPeriod(mockPeriodId, new Date())
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000)
          .addCreditLine(mockAccountId2, 1000)
          .build();
      }).toThrow('Event type is required');
    });

    it('should throw error when reference is missing', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withPeriod(mockPeriodId, new Date())
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000)
          .addCreditLine(mockAccountId2, 1000)
          .build();
      }).toThrow('Reference is required');
    });

    it('should throw error when period is missing', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000)
          .addCreditLine(mockAccountId2, 1000)
          .build();
      }).toThrow('Period and entry date are required');
    });

    it('should throw error when created by is missing', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withPeriod(mockPeriodId, new Date())
          .addDebitLine(mockAccountId1, 1000)
          .addCreditLine(mockAccountId2, 1000)
          .build();
      }).toThrow('Created by is required');
    });

    it('should throw error when lines are less than 2', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withPeriod(mockPeriodId, new Date())
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000)
          .build();
      }).toThrow('At least 2 journal lines are required');
    });
  });

  describe('validateBalance', () => {
    it('should pass when lines are balanced', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withPeriod(mockPeriodId, new Date())
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000000)
          .addCreditLine(mockAccountId2, 1000000)
          .validateBalance()
          .build();
      }).not.toThrow();
    });

    it('should pass when lines are balanced within tolerance (0.01)', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withPeriod(mockPeriodId, new Date())
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000000.005)
          .addCreditLine(mockAccountId2, 1000000)
          .validateBalance()
          .build();
      }).not.toThrow();
    });

    it('should throw error when lines are not balanced', () => {
      expect(() => {
        new JournalEventBuilder()
          .withEventType('GOODS_RECEIPT')
          .withReference('GR', mockUUID, 'GR-202501-00001')
          .withPeriod(mockPeriodId, new Date())
          .withCreatedBy(mockUserId)
          .addDebitLine(mockAccountId1, 1000000)
          .addCreditLine(mockAccountId2, 900000)
          .validateBalance()
          .build();
      }).toThrow('Journal lines are not balanced');
    });
  });

  describe('addLine', () => {
    it('should add line with description and cost center', () => {
      const costCenterId = '123e4567-e89b-12d3-a456-426614174005';
      const event = new JournalEventBuilder()
        .withEventType('GOODS_RECEIPT')
        .withReference('GR', mockUUID, 'GR-202501-00001')
        .withPeriod(mockPeriodId, new Date())
        .withCreatedBy(mockUserId)
        .addLine(mockAccountId1, 1000000, 0, {
          description: 'Test debit',
          costCenterId,
        })
        .addLine(mockAccountId2, 0, 1000000, {
          description: 'Test credit',
        })
        .build();

      expect(event.lines![0].description).toBe('Test debit');
      expect(event.lines![0].cost_center_id).toBe(costCenterId);
      expect(event.lines![1].description).toBe('Test credit');
    });
  });

  describe('withMetadata', () => {
    it('should add metadata to the event', () => {
      const event = new JournalEventBuilder()
        .withEventType('GOODS_RECEIPT')
        .withReference('GR', mockUUID, 'GR-202501-00001')
        .withPeriod(mockPeriodId, new Date())
        .withCreatedBy(mockUserId)
        .addDebitLine(mockAccountId1, 1000000)
        .addCreditLine(mockAccountId2, 1000000)
        .withMetadata('po_id', 'po-123')
        .withMetadata('supplier_id', 'supplier-456')
        .build();

      expect(event.metadata).toEqual({
        po_id: 'po-123',
        supplier_id: 'supplier-456',
      });
    });

    it('should not include metadata if not set', () => {
      const event = new JournalEventBuilder()
        .withEventType('GOODS_RECEIPT')
        .withReference('GR', mockUUID, 'GR-202501-00001')
        .withPeriod(mockPeriodId, new Date())
        .withCreatedBy(mockUserId)
        .addDebitLine(mockAccountId1, 1000000)
        .addCreditLine(mockAccountId2, 1000000)
        .build();

      expect(event.metadata).toBeUndefined();
    });
  });
});

describe('JournalEventFactory', () => {
  const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
  const mockPeriodId = '123e4567-e89b-12d3-a456-426614174001';
  const mockInventoryAccountId = '123e4567-e89b-12d3-a456-426614174002';
  const mockGRClearingAccountId = '123e4567-e89b-12d3-a456-426614174003';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174004';
  const mockRevenueAccountId = '123e4567-e89b-12d3-a456-426614174005';
  const mockPPNOutputAccountId = '123e4567-e89b-12d3-a456-426614174006';
  const mockCOGSAccountId = '123e4567-e89b-12d3-a456-426614174007';
  const mockARAccountId = '123e4567-e89b-12d3-a456-426614174008';
  const mockAPAccountId = '123e4567-e89b-12d3-a456-426614174009';
  const mockCashAccountId = '123e4567-e89b-12d3-a456-426614174010';

  describe('createGoodsReceiptEvent', () => {
    it('should create a balanced GR journal event', () => {
      const event = JournalEventFactory.createGoodsReceiptEvent({
        grId: mockUUID,
        grNumber: 'GR-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        inventoryAccountId: mockInventoryAccountId,
        grClearingAccountId: mockGRClearingAccountId,
        totalValue: 5000000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('GOODS_RECEIPT');
      expect(event.reference_type).toBe('GR');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(5000000);
      expect(event.lines![1].credit).toBe(5000000);
    });
  });

  describe('createSupplierInvoiceEvent', () => {
    it('should create a balanced supplier invoice journal event', () => {
      const event = JournalEventFactory.createSupplierInvoiceEvent({
        invoiceId: mockUUID,
        invoiceNumber: 'PINV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        grClearingAccountId: mockGRClearingAccountId,
        accountsPayableAccountId: mockAPAccountId,
        totalAmount: 5500000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('SUPPLIER_INVOICE');
      expect(event.reference_type).toBe('PINV');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(5500000);
      expect(event.lines![1].credit).toBe(5500000);
    });
  });

  describe('createPurchasePaymentEvent', () => {
    it('should create a balanced purchase payment journal event', () => {
      const event = JournalEventFactory.createPurchasePaymentEvent({
        paymentId: mockUUID,
        paymentNumber: 'PV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        accountsPayableAccountId: mockAPAccountId,
        cashAccountId: mockCashAccountId,
        amount: 5500000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('PURCHASE_PAYMENT');
      expect(event.reference_type).toBe('PV');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(5500000);
      expect(event.lines![1].credit).toBe(5500000);
    });
  });

  describe('createSalesInvoiceEvent', () => {
    it('should create a balanced sales invoice journal event with tax', () => {
      const event = JournalEventFactory.createSalesInvoiceEvent({
        invoiceId: mockUUID,
        invoiceNumber: 'INV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        accountsReceivableAccountId: mockARAccountId,
        revenueAccountId: mockRevenueAccountId,
        ppnOutputAccountId: mockPPNOutputAccountId,
        subtotal: 10000000,
        taxAmount: 1100000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('SALES_INVOICE');
      expect(event.reference_type).toBe('INV');
      expect(event.lines).toHaveLength(3);
      expect(event.lines![0].debit).toBe(11100000); // AR = subtotal + tax
      expect(event.lines![1].credit).toBe(10000000); // Revenue
      expect(event.lines![2].credit).toBe(1100000); // PPN Output
    });

    it('should create a balanced sales invoice journal event without tax', () => {
      const event = JournalEventFactory.createSalesInvoiceEvent({
        invoiceId: mockUUID,
        invoiceNumber: 'INV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        accountsReceivableAccountId: mockARAccountId,
        revenueAccountId: mockRevenueAccountId,
        ppnOutputAccountId: mockPPNOutputAccountId,
        subtotal: 10000000,
        taxAmount: 0,
        createdBy: mockUserId,
      });

      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(10000000);
      expect(event.lines![1].credit).toBe(10000000);
    });
  });

  describe('createSalesInvoiceCOGSEvent', () => {
    it('should create a balanced COGS journal event', () => {
      const event = JournalEventFactory.createSalesInvoiceCOGSEvent({
        invoiceId: mockUUID,
        invoiceNumber: 'INV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        cogsAccountId: mockCOGSAccountId,
        inventoryAccountId: mockInventoryAccountId,
        cogsValue: 6000000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('SALES_INVOICE_COGS');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(6000000);
      expect(event.lines![1].credit).toBe(6000000);
    });
  });

  describe('createPOSSaleEvent', () => {
    it('should create a balanced POS sale journal event with multiple payments', () => {
      const event = JournalEventFactory.createPOSSaleEvent({
        transactionId: mockUUID,
        transactionNumber: 'POS-20250115-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        payments: [
          { accountId: mockCashAccountId, amount: 500000, description: 'Cash' },
          { accountId: '123e4567-e89b-12d3-a456-426614174011', amount: 610000, description: 'EDC' },
        ],
        revenueAccountId: mockRevenueAccountId,
        ppnOutputAccountId: mockPPNOutputAccountId,
        subtotal: 1000000,
        taxAmount: 110000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('POS_SALE');
      expect(event.reference_type).toBe('POS');
      expect(event.lines).toHaveLength(4); // 2 payments + revenue + tax
      expect(event.lines![0].credit).toBe(1000000); // Revenue
      expect(event.lines![1].credit).toBe(110000); // PPN Output
      expect(event.lines![2].debit).toBe(500000); // Cash
      expect(event.lines![3].debit).toBe(610000); // EDC
    });
  });

  describe('createPOSSaleCOGSEvent', () => {
    it('should create a balanced POS COGS journal event', () => {
      const event = JournalEventFactory.createPOSSaleCOGSEvent({
        transactionId: mockUUID,
        transactionNumber: 'POS-20250115-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        cogsAccountId: mockCOGSAccountId,
        inventoryAccountId: mockInventoryAccountId,
        cogsValue: 600000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('POS_SALE_COGS');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(600000);
      expect(event.lines![1].credit).toBe(600000);
    });
  });

  describe('createSalesReturnEvent', () => {
    it('should create a balanced sales return journal event with tax', () => {
      const event = JournalEventFactory.createSalesReturnEvent({
        returnId: mockUUID,
        returnNumber: 'SR-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        salesReturnAccountId: '123e4567-e89b-12d3-a456-426614174012',
        ppnOutputAccountId: mockPPNOutputAccountId,
        accountsReceivableAccountId: mockARAccountId,
        subtotal: 1000000,
        taxAmount: 110000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('SALES_RETURN');
      expect(event.reference_type).toBe('SR');
      expect(event.lines).toHaveLength(3);
      expect(event.lines![0].debit).toBe(1000000); // Sales Return
      expect(event.lines![1].credit).toBe(1110000); // AR
      expect(event.lines![2].debit).toBe(110000); // PPN Output
    });
  });

  describe('createSalesReturnStockEvent', () => {
    it('should create a balanced sales return stock journal event', () => {
      const event = JournalEventFactory.createSalesReturnStockEvent({
        returnId: mockUUID,
        returnNumber: 'SR-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        inventoryAccountId: mockInventoryAccountId,
        cogsAccountId: mockCOGSAccountId,
        stockValue: 600000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('SALES_RETURN_STOCK');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(600000);
      expect(event.lines![1].credit).toBe(600000);
    });
  });

  describe('createPaymentReceiptEvent', () => {
    it('should create a balanced payment receipt journal event', () => {
      const event = JournalEventFactory.createPaymentReceiptEvent({
        paymentId: mockUUID,
        paymentNumber: 'RCV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        cashAccountId: mockCashAccountId,
        accountsReceivableAccountId: mockARAccountId,
        amount: 11100000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('PAYMENT_RECEIPT');
      expect(event.reference_type).toBe('RCV');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(11100000);
      expect(event.lines![1].credit).toBe(11100000);
    });
  });

  // ============================================================
  // Task 6.5: Additional Journal Event Factory Tests
  // ============================================================

  const mockVarianceAccountId = '123e4567-e89b-12d3-a456-426614174020';
  const mockOpnameGainAccountId = '123e4567-e89b-12d3-a456-426614174021';
  const mockOpnameLossAccountId = '123e4567-e89b-12d3-a456-426614174022';
  const mockIncomeSummaryAccountId = '123e4567-e89b-12d3-a456-426614174023';
  const mockRetainedEarningsAccountId = '123e4567-e89b-12d3-a456-426614174024';
  const mockDepreciationExpenseAccountId = '123e4567-e89b-12d3-a456-426614174025';
  const mockAccumulatedDepreciationAccountId = '123e4567-e89b-12d3-a456-426614174026';
  const mockBankVarianceAccountId = '123e4567-e89b-12d3-a456-426614174027';
  const mockBadDebtExpenseAccountId = '123e4567-e89b-12d3-a456-426614174028';

  describe('createStockAdjustmentPositiveEvent', () => {
    it('should create a balanced stock adjustment positive journal event', () => {
      const event = JournalEventFactory.createStockAdjustmentPositiveEvent({
        adjustmentId: mockUUID,
        adjustmentNumber: 'SA-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        inventoryAccountId: mockInventoryAccountId,
        varianceAccountId: mockVarianceAccountId,
        adjustmentValue: 500000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('STOCK_ADJUSTMENT_POSITIVE');
      expect(event.reference_type).toBe('SA');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(500000);
      expect(event.lines![1].credit).toBe(500000);
    });
  });

  describe('createStockAdjustmentNegativeEvent', () => {
    it('should create a balanced stock adjustment negative journal event', () => {
      const event = JournalEventFactory.createStockAdjustmentNegativeEvent({
        adjustmentId: mockUUID,
        adjustmentNumber: 'SA-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        inventoryAccountId: mockInventoryAccountId,
        varianceAccountId: mockVarianceAccountId,
        adjustmentValue: 300000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('STOCK_ADJUSTMENT_NEGATIVE');
      expect(event.reference_type).toBe('SA');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(300000);
      expect(event.lines![1].credit).toBe(300000);
    });
  });

  describe('createStockOpnameSurplusEvent', () => {
    it('should create a balanced stock opname surplus journal event', () => {
      const event = JournalEventFactory.createStockOpnameSurplusEvent({
        opnameId: mockUUID,
        opnameNumber: 'SO-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        inventoryAccountId: mockInventoryAccountId,
        opnameGainAccountId: mockOpnameGainAccountId,
        surplusValue: 750000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('STOCK_OPNAME_SURPLUS');
      expect(event.reference_type).toBe('SO');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(750000);
      expect(event.lines![1].credit).toBe(750000);
    });
  });

  describe('createStockOpnameDeficitEvent', () => {
    it('should create a balanced stock opname deficit journal event', () => {
      const event = JournalEventFactory.createStockOpnameDeficitEvent({
        opnameId: mockUUID,
        opnameNumber: 'SO-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-15'),
        inventoryAccountId: mockInventoryAccountId,
        opnameLossAccountId: mockOpnameLossAccountId,
        deficitValue: 250000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('STOCK_OPNAME_DEFICIT');
      expect(event.reference_type).toBe('SO');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(250000);
      expect(event.lines![1].credit).toBe(250000);
    });
  });

  describe('createPeriodClosingRevenueEvent', () => {
    it('should create a balanced period closing revenue journal event', () => {
      const event = JournalEventFactory.createPeriodClosingRevenueEvent({
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        revenueAccountId: mockRevenueAccountId,
        incomeSummaryAccountId: mockIncomeSummaryAccountId,
        totalRevenue: 50000000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('PERIOD_CLOSING_REVENUE');
      expect(event.reference_type).toBe('PERIOD');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(50000000);
      expect(event.lines![1].credit).toBe(50000000);
    });
  });

  describe('createPeriodClosingExpenseEvent', () => {
    it('should create a balanced period closing expense journal event', () => {
      const event = JournalEventFactory.createPeriodClosingExpenseEvent({
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        incomeSummaryAccountId: mockIncomeSummaryAccountId,
        expenseAccountId: mockBadDebtExpenseAccountId,
        totalExpenses: 30000000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('PERIOD_CLOSING_EXPENSE');
      expect(event.reference_type).toBe('PERIOD');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(30000000);
      expect(event.lines![1].credit).toBe(30000000);
    });
  });

  describe('createPeriodClosingNetEvent', () => {
    it('should create a balanced period closing net income journal event', () => {
      const event = JournalEventFactory.createPeriodClosingNetEvent({
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        incomeSummaryAccountId: mockIncomeSummaryAccountId,
        retainedEarningsAccountId: mockRetainedEarningsAccountId,
        netIncome: 20000000, // Positive = net income
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('PERIOD_CLOSING_NET');
      expect(event.reference_type).toBe('PERIOD');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(20000000); // Debit Income Summary
      expect(event.lines![1].credit).toBe(20000000); // Credit Retained Earnings
    });

    it('should create a balanced period closing net loss journal event', () => {
      const event = JournalEventFactory.createPeriodClosingNetEvent({
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        incomeSummaryAccountId: mockIncomeSummaryAccountId,
        retainedEarningsAccountId: mockRetainedEarningsAccountId,
        netIncome: -5000000, // Negative = net loss
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('PERIOD_CLOSING_NET');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(5000000); // Debit Retained Earnings
      expect(event.lines![1].credit).toBe(5000000); // Credit Income Summary
    });
  });

  describe('createDepreciationEvent', () => {
    it('should create a balanced depreciation journal event', () => {
      const event = JournalEventFactory.createDepreciationEvent({
        assetId: mockUUID,
        assetCode: 'AST-001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        depreciationExpenseAccountId: mockDepreciationExpenseAccountId,
        accumulatedDepreciationAccountId: mockAccumulatedDepreciationAccountId,
        depreciationAmount: 2500000,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('DEPRECIATION');
      expect(event.reference_type).toBe('ASSET');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(2500000);
      expect(event.lines![1].credit).toBe(2500000);
    });
  });

  describe('createBankReconciliationAdjEvent', () => {
    it('should create a balanced bank reconciliation adjustment event when bank balance is higher', () => {
      const event = JournalEventFactory.createBankReconciliationAdjEvent({
        reconciliationId: mockUUID,
        reconciliationNumber: 'BREC-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        bankVarianceAccountId: mockBankVarianceAccountId,
        bankAccountId: mockCashAccountId,
        adjustmentAmount: 150000,
        isBankHigher: true,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('BANK_RECONCILIATION_ADJ');
      expect(event.reference_type).toBe('BREC');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(150000); // Debit Bank
      expect(event.lines![1].credit).toBe(150000); // Credit Variance
    });

    it('should create a balanced bank reconciliation adjustment event when book balance is higher', () => {
      const event = JournalEventFactory.createBankReconciliationAdjEvent({
        reconciliationId: mockUUID,
        reconciliationNumber: 'BREC-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        bankVarianceAccountId: mockBankVarianceAccountId,
        bankAccountId: mockCashAccountId,
        adjustmentAmount: 100000,
        isBankHigher: false,
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('BANK_RECONCILIATION_ADJ');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(100000); // Debit Variance
      expect(event.lines![1].credit).toBe(100000); // Credit Bank
    });
  });

  describe('createWriteOffAREvent', () => {
    it('should create a balanced write-off AR journal event', () => {
      const event = JournalEventFactory.createWriteOffAREvent({
        invoiceId: mockUUID,
        invoiceNumber: 'INV-202501-00001',
        periodId: mockPeriodId,
        entryDate: new Date('2025-01-31'),
        badDebtExpenseAccountId: mockBadDebtExpenseAccountId,
        accountsReceivableAccountId: mockARAccountId,
        writeOffAmount: 5000000,
        reason: 'Piutang tidak tertagih',
        createdBy: mockUserId,
      });

      expect(event.event_type).toBe('WRITE_OFF_AR');
      expect(event.reference_type).toBe('INV');
      expect(event.lines).toHaveLength(2);
      expect(event.lines![0].debit).toBe(5000000);
      expect(event.lines![1].credit).toBe(5000000);
    });
  });
});
