import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceCalculationEngine } from '../services/FinanceCalculationEngine';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../services/dailyFinancialTransactionService';

vi.mock('../services/dailyFinancialTransactionService', () => ({
  dailyFinancialTransactionService: {
    getDailyFinancialTransactions: vi.fn(),
    getOldestTransactionDate: vi.fn().mockResolvedValue('2026-08-01')
  }
}));

vi.mock('../lib/supabaseFinance', () => ({
  supabaseFinance: {
    getPartners: vi.fn().mockResolvedValue([]),
    getAccounts: vi.fn().mockResolvedValue([])
  },
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null })
    })
  }
}));

describe('Final Statement - General Ledger Management Summary Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Requirement 1 & 7: Final Statement has NO partner-specific calculations or partner shares', async () => {
    const mockTxs: DailyFinancialTransaction[] = [
      {
        id: 'tx1',
        transactionDate: '2026-08-10',
        headOfAccount: 'CAPITAL',
        sourceType: 'CAPITAL',
        reportClassification: 'BALANCE_SHEET',
        credit: 100000,
        debit: 0,
        amount: 100000,
        particulars: 'Capital introduced'
      },
      {
        id: 'tx2',
        transactionDate: '2026-08-12',
        headOfAccount: 'CD DISBURSEMENT',
        sourceType: 'CD_LOAN',
        reportClassification: 'BALANCE_SHEET',
        credit: 0,
        debit: 50000,
        amount: 50000,
        particulars: 'Loan disbursed'
      },
      {
        id: 'tx3',
        transactionDate: '2026-08-15',
        headOfAccount: 'CD INTEREST',
        sourceType: 'CD_COLLECTION',
        reportClassification: 'PROFIT_AND_LOSS',
        credit: 5000,
        debit: 0,
        amount: 5000,
        particulars: 'Interest collected'
      }
    ];

    vi.mocked(dailyFinancialTransactionService.getDailyFinancialTransactions).mockImplementation(async (params: any) => {
      if (params.toDate < '2026-08-01') return [];
      return mockTxs;
    });

    const metrics = await FinanceCalculationEngine.getFinalStatementMetrics('2026-08-01', '2026-08-31');

    // Confirm metrics does NOT contain partnerShares
    expect((metrics as any).partnerShares).toBeUndefined();
    expect((metrics as any).partnerCount).toBeUndefined();

    // Confirm business totals
    expect(metrics.totalCapital).toBe(100000);
    expect(metrics.totalLoanPrincipal).toBe(50000);
    expect(metrics.totalIncome).toBe(5000);
    expect(metrics.totalExpenses).toBe(0);
    expect(metrics.netProfit).toBe(5000);
  });

  it('Requirement 3, 4, 5, 6: Accurate P&L heads, Balance Sheet positions, and GL Accounts summary', async () => {
    // Opening balance before 2026-08-01
    const prevTxs: DailyFinancialTransaction[] = [
      {
        id: 'p1',
        transactionDate: '2026-07-15',
        headOfAccount: 'CAPITAL',
        sourceType: 'CAPITAL',
        reportClassification: 'BALANCE_SHEET',
        credit: 200000,
        debit: 0,
        amount: 200000,
        particulars: 'Opening Capital'
      }
    ];

    // Range transactions for 2026-08-01 to 2026-08-31
    const rangeTxs: DailyFinancialTransaction[] = [
      // Loan Disbursed ₹100,000 (Asset Dr)
      {
        id: 't1',
        transactionDate: '2026-08-05',
        headOfAccount: 'CD DISBURSEMENT',
        sourceType: 'CD_LOAN',
        reportClassification: 'BALANCE_SHEET',
        credit: 0,
        debit: 100000,
        amount: 100000,
        particulars: 'Disbursed Principal'
      },
      // Principal Repaid ₹30,000 (Asset Cr)
      {
        id: 't2',
        transactionDate: '2026-08-15',
        headOfAccount: 'CD DISBURSEMENT',
        sourceType: 'CD_COLLECTION',
        reportClassification: 'BALANCE_SHEET',
        credit: 30000,
        debit: 0,
        amount: 30000,
        particulars: 'Principal Repaid'
      },
      // Interest Income ₹12,000 (P&L Income Cr)
      {
        id: 't3',
        transactionDate: '2026-08-15',
        headOfAccount: 'CD INTEREST',
        sourceType: 'CD_COLLECTION',
        reportClassification: 'PROFIT_AND_LOSS',
        credit: 12000,
        debit: 0,
        amount: 12000,
        particulars: 'Interest Earned'
      },
      // Penalty Income ₹1,500 (P&L Income Cr)
      {
        id: 't4',
        transactionDate: '2026-08-15',
        headOfAccount: 'CD PENALTY',
        sourceType: 'CD_COLLECTION',
        reportClassification: 'PROFIT_AND_LOSS',
        credit: 1500,
        debit: 0,
        amount: 1500,
        particulars: 'Penalty Earned'
      },
      // Operating Office Rent ₹4,000 (P&L Expense Dr)
      {
        id: 't5',
        transactionDate: '2026-08-20',
        headOfAccount: 'OFFICE RENT',
        sourceType: 'DAY_BOOK_ENTRY',
        reportClassification: 'PROFIT_AND_LOSS',
        credit: 0,
        debit: 4000,
        amount: 4000,
        particulars: 'Rent Paid'
      }
    ];

    vi.mocked(dailyFinancialTransactionService.getDailyFinancialTransactions).mockImplementation(async (params: any) => {
      if (params.toDate < '2026-08-01') return prevTxs;
      return rangeTxs;
    });

    const metrics = await FinanceCalculationEngine.getFinalStatementMetrics('2026-08-01', '2026-08-31');

    // 1. Cash calculations:
    // Opening Cash = 200,000
    // Total Inflows = 30,000 (Principal) + 12,000 (Interest) + 1,500 (Penalty) = 43,500
    // Total Outflows = 100,000 (Disbursed) + 4,000 (Rent) = 104,000
    // Closing Cash = 200,000 + 43,500 - 104,000 = 139,500
    expect(metrics.openingCash).toBe(200000);
    expect(metrics.totalInflows).toBe(43500);
    expect(metrics.totalOutflows).toBe(104000);
    expect(metrics.closingCash).toBe(139500);

    // 2. Profit & Loss:
    // Income = CD INTEREST (12,000) + CD PENALTY (1,500) = 13,500
    // Expenses = OFFICE RENT (4,000)
    // Net Profit = 13,500 - 4,000 = 9,500
    expect(metrics.totalIncome).toBe(13500);
    expect(metrics.totalExpenses).toBe(4000);
    expect(metrics.netProfit).toBe(9500);
    expect(metrics.incomeHeads).toHaveLength(2);
    expect(metrics.expenseHeads).toHaveLength(1);
    expect(metrics.expenseHeads[0].name).toBe('OFFICE RENT');

    // 3. Balance Sheet Assets:
    // Loan Principal Receivable Outstanding = 100,000 (Dr) - 30,000 (Cr) = 70,000 (Dr)
    // Closing Cash = 139,500
    // Total Assets = 70,000 + 139,500 = 209,500
    expect(metrics.totalLoanPrincipal).toBe(70000);
    expect(metrics.totalAssets).toBe(209500);

    // 4. Balance Sheet Liabilities & Capital:
    // Capital = 200,000
    // Retained Net Profit = 9,500
    // Total Liabilities & Capital = 200,000 + 9,500 = 209,500
    expect(metrics.totalCapital).toBe(200000);
    expect(metrics.totalLiabilitiesAndCapital).toBe(209500);

    // Balance Sheet Equation is perfectly in balance: Total Assets (209,500) == Total Liabilities & Capital (209,500)
    expect(metrics.totalAssets).toBe(metrics.totalLiabilitiesAndCapital);
  });
});
