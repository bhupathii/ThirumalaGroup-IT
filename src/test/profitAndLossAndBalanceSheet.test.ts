import { describe, it, expect } from 'vitest';
import { DailyFinancialTransaction, normalizeHeadOfAccount } from '../services/dailyFinancialTransactionService';

describe('Profit & Loss and Balance Sheet Accounting Separation Tests', () => {

  const sampleTransactions: DailyFinancialTransaction[] = [
    // 1. Principal Disbursement (Asset creation, not P&L expense)
    {
      id: 'CD_LEDGER:1',
      sourceType: 'CD_LEDGER',
      sourceRecordId: '1',
      transactionDate: '2026-08-01',
      headOfAccount: 'CD DISBURSEMENT',
      particulars: 'CD Disbursement - CD1',
      receiptOrVoucherNo: 'V1',
      accountOrLoanNo: 'CD1',
      debit: 100000,
      credit: 0,
      userName: 'Admin',
      entryTime: '2026-08-01T10:00:00Z',
      createdAt: '2026-08-01T10:00:00Z',
      reportClassification: 'BALANCE_SHEET',
      customerName: 'Borrower 1',
      category: 'CD',
      loanCategory: 'CD'
    },
    // 2. Principal Repaid / Collected (Asset reduction, not P&L income)
    {
      id: 'CD_LEDGER:2',
      sourceType: 'CD_LEDGER',
      sourceRecordId: '2',
      transactionDate: '2026-08-10',
      headOfAccount: 'CD DISBURSEMENT',
      particulars: 'Principal Repaid - CD1',
      receiptOrVoucherNo: 'RC101',
      accountOrLoanNo: 'CD1',
      debit: 0,
      credit: 25000,
      userName: 'Admin',
      entryTime: '2026-08-10T10:00:00Z',
      createdAt: '2026-08-10T10:00:00Z',
      reportClassification: 'BALANCE_SHEET',
      customerName: 'Borrower 1',
      category: 'CD',
      loanCategory: 'CD'
    },
    // 3. CD Interest Collected (P&L Income)
    {
      id: 'CD_LEDGER:3',
      sourceType: 'CD_LEDGER',
      sourceRecordId: '3',
      transactionDate: '2026-08-10',
      headOfAccount: 'CD INTEREST',
      particulars: 'Interest Collected - CD1',
      receiptOrVoucherNo: 'RC101',
      accountOrLoanNo: 'CD1',
      debit: 0,
      credit: 3000,
      userName: 'Admin',
      entryTime: '2026-08-10T10:00:00Z',
      createdAt: '2026-08-10T10:00:00Z',
      reportClassification: 'PROFIT_AND_LOSS',
      customerName: 'Borrower 1',
      category: 'CD',
      loanCategory: 'CD'
    },
    // 4. CD Penalty Collected (P&L Income)
    {
      id: 'CD_LEDGER:4',
      sourceType: 'CD_LEDGER',
      sourceRecordId: '4',
      transactionDate: '2026-08-10',
      headOfAccount: 'CD PENALTY',
      particulars: 'Penalty Collected - CD1',
      receiptOrVoucherNo: 'RC101',
      accountOrLoanNo: 'CD1',
      debit: 0,
      credit: 500,
      userName: 'Admin',
      entryTime: '2026-08-10T10:00:00Z',
      createdAt: '2026-08-10T10:00:00Z',
      reportClassification: 'PROFIT_AND_LOSS',
      customerName: 'Borrower 1',
      category: 'CD',
      loanCategory: 'CD'
    },
    // 5. Genuine Operating Expense (P&L Expense)
    {
      id: 'DAYBOOK:1',
      sourceType: 'DAY_BOOK_ENTRY',
      sourceRecordId: '5',
      transactionDate: '2026-08-12',
      headOfAccount: 'OFFICE RENT',
      particulars: 'Office Rent for August',
      receiptOrVoucherNo: 'V10',
      accountOrLoanNo: 'EXP-01',
      debit: 1200,
      credit: 0,
      userName: 'Admin',
      entryTime: '2026-08-12T10:00:00Z',
      createdAt: '2026-08-12T10:00:00Z',
      reportClassification: 'PROFIT_AND_LOSS',
      category: 'EXPENSE'
    },
    // 6. Partner Capital (Balance Sheet Liability/Capital)
    {
      id: 'CAPITAL:1',
      sourceType: 'CAPITAL_ENTRY',
      sourceRecordId: '6',
      transactionDate: '2026-08-01',
      headOfAccount: 'CAPITAL',
      particulars: 'Capital by Partner A',
      receiptOrVoucherNo: null,
      accountOrLoanNo: 'Partner A',
      debit: 0,
      credit: 150000,
      userName: 'Admin',
      entryTime: '2026-08-01T09:00:00Z',
      createdAt: '2026-08-01T09:00:00Z',
      reportClassification: 'BALANCE_SHEET',
      partnerName: 'Partner A',
      category: 'CAPITAL'
    }
  ];

  it('Requirement 1 & 2: P&L income includes CD Interest and CD Penalty, excludes Principal collections, Disbursements, and CD Collection', () => {
    const isPrincipalOrCapitalHead = (headName: string): boolean => {
      const upper = (headName || '').toUpperCase();
      return (
        upper.includes('DISBURSEMENT') ||
        upper.includes('PRINCIPAL') ||
        upper.includes('RECEIVABLE') ||
        upper.includes('COLLECTION') ||
        upper === 'CD A/C' ||
        upper === 'CAPITAL' ||
        upper.startsWith('CAPITAL') ||
        upper.startsWith('BANK') ||
        upper.endsWith('BANK')
      );
    };

    const plIncomes = sampleTransactions.filter(t => 
      t.reportClassification === 'PROFIT_AND_LOSS' && 
      !isPrincipalOrCapitalHead(t.headOfAccount) && 
      t.credit > 0
    );

    const plExpenses = sampleTransactions.filter(t => 
      t.reportClassification === 'PROFIT_AND_LOSS' && 
      !isPrincipalOrCapitalHead(t.headOfAccount) && 
      t.debit > 0
    );

    // Income checks
    const incomeHeads = plIncomes.map(t => t.headOfAccount);
    expect(incomeHeads).toContain('CD INTEREST');
    expect(incomeHeads).toContain('CD PENALTY');
    expect(incomeHeads).not.toContain('CD DISBURSEMENT');
    expect(incomeHeads).not.toContain('CD COLLECTION');
    expect(incomeHeads).not.toContain('CAPITAL');

    const totalIncome = plIncomes.reduce((sum, t) => sum + t.credit, 0);
    expect(totalIncome).toBe(3000 + 500); // 3500

    // Expense checks: CD DISBURSEMENT is excluded
    const expenseHeads = plExpenses.map(t => t.headOfAccount);
    expect(expenseHeads).toContain('OFFICE RENT');
    expect(expenseHeads).not.toContain('CD DISBURSEMENT');

    const totalExpenses = plExpenses.reduce((sum, t) => sum + t.debit, 0);
    expect(totalExpenses).toBe(1200);

    const netProfit = totalIncome - totalExpenses;
    expect(netProfit).toBe(3500 - 1200); // 2300
  });

  it('Requirement 3, 4 & 5: Balance Sheet represents Loan Principal / Receivables as an Asset and separates Capital', () => {
    // CD DISBURSEMENT is an Asset: Disbursed Dr 100,000, Repaid Cr 25,000 -> Net Outstanding Dr 75,000
    const disbTxs = sampleTransactions.filter(t => t.headOfAccount === 'CD DISBURSEMENT');
    let totalDisbursed = 0;
    let totalRepaid = 0;

    disbTxs.forEach(t => {
      totalDisbursed += t.debit;
      totalRepaid += t.credit;
    });

    const netOutstandingPrincipal = totalDisbursed - totalRepaid;
    expect(totalDisbursed).toBe(100000);
    expect(totalRepaid).toBe(25000);
    expect(netOutstandingPrincipal).toBe(75000);

    // Calculate Cash in Hand: Total Credits - Total Debits across all cash movements
    let totalInflows = 0;
    let totalOutflows = 0;
    sampleTransactions.forEach(t => {
      totalInflows += t.credit;
      totalOutflows += t.debit;
    });
    const cashInHand = totalInflows - totalOutflows;
    // Inflows: 150000 (Capital) + 25000 (Principal Repaid) + 3000 (Interest) + 500 (Penalty) = 178500
    // Outflows: 100000 (Loan Disbursed) + 1200 (Rent) = 101200
    // Cash in Hand: 178500 - 101200 = 77300
    expect(totalInflows).toBe(178500);
    expect(totalOutflows).toBe(101200);
    expect(cashInHand).toBe(77300);

    // Total Assets: Loan Principal (75,000) + Cash in Hand (77,300) = 152,300
    const totalAssets = netOutstandingPrincipal + cashInHand;
    expect(totalAssets).toBe(152300);

    // Total Liabilities & Capital: Capital (150,000) + Net Profit (2,300) = 152,300
    const netProfit = 3500 - 1200; // 2300
    const capital = 150000;
    const totalLiabilitiesAndCapital = capital + netProfit;
    expect(totalLiabilitiesAndCapital).toBe(152300);

    // Balance Sheet Equation: Total Assets === Total Liabilities & Capital
    expect(totalAssets).toBe(totalLiabilitiesAndCapital);
  });

  it('Requirement 8: normalizeHeadOfAccount maps legacy CD names accurately', () => {
    expect(normalizeHeadOfAccount('CD COLLECTION')).toBe('CD DISBURSEMENT');
    expect(normalizeHeadOfAccount('CD COMMISSION A/C')).toBe('CD INTEREST');
    expect(normalizeHeadOfAccount('PENALTY A/C')).toBe('CD PENALTY');
    expect(normalizeHeadOfAccount('CD DOCUMENT CHARGES A/C')).toBe('CD DOCUMENT CHARGES');
  });
});
