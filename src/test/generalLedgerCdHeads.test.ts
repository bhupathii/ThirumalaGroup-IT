import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sharedMockFrom } = vi.hoisted(() => {
  return { sharedMockFrom: vi.fn() };
});

vi.mock('../lib/supabase', () => {
  const mockSchema = vi.fn().mockReturnValue({
    from: sharedMockFrom
  });
  return {
    supabase: {
      schema: mockSchema,
      from: sharedMockFrom
    }
  };
});

vi.mock('../lib/supabaseDatabase', () => {
  const mockSchema = vi.fn().mockReturnValue({
    from: sharedMockFrom
  });
  return {
    supabase: {
      schema: mockSchema,
      from: sharedMockFrom
    }
  };
});

import { dailyFinancialTransactionService, normalizeHeadOfAccount, extractLoanPaymentSplits } from '../services/dailyFinancialTransactionService';

describe('General Ledger CD Accounting Heads and Separation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Requirement 1 & 2 & 3 & 4: Head normalization maps CD principal and collection to CD DISBURSEMENT, interest to CD INTEREST, penalty to CD PENALTY', () => {
    expect(normalizeHeadOfAccount('CD COLLECTION')).toBe('CD DISBURSEMENT');
    expect(normalizeHeadOfAccount('CD PRINCIPAL')).toBe('CD DISBURSEMENT');
    expect(normalizeHeadOfAccount('CD A/C')).toBe('CD DISBURSEMENT');
    expect(normalizeHeadOfAccount('CD DISBURSEMENT')).toBe('CD DISBURSEMENT');
    expect(normalizeHeadOfAccount('CD COMMISSION A/C')).toBe('CD INTEREST');
    expect(normalizeHeadOfAccount('CD INTEREST')).toBe('CD INTEREST');
    expect(normalizeHeadOfAccount('PENALTY A/C')).toBe('CD PENALTY');
    expect(normalizeHeadOfAccount('CD PENALTY')).toBe('CD PENALTY');
  });

  it('Requirement 7, 8, 9: extractLoanPaymentSplits correctly parses payment components from remarks or defaults safely', () => {
    // Case 1: Structured string with Principal, Interest, and Penalty
    const txMulti = {
      amount: 3600,
      remarks: 'CD Renewal - RC1001 (Prin: 3000, Comm: 500, Pen: 100)'
    };
    const splitMulti = extractLoanPaymentSplits(txMulti, 'CD');
    expect(splitMulti.principal).toBe(3000);
    expect(splitMulti.interest).toBe(500);
    expect(splitMulti.penalty).toBe(100);
    expect(splitMulti.docCharges).toBe(0);
    expect(splitMulti.principal + splitMulti.interest + splitMulti.penalty).toBe(3600);

    // Case 2: Structured string with Principal Paid and Interest Paid
    const txPrinInt = {
      amount: 11000,
      remarks: 'Principal Paid: ₹10,000.00 / Interest Paid: ₹1,000.00 - RC2002'
    };
    const splitPrinInt = extractLoanPaymentSplits(txPrinInt, 'CD');
    expect(splitPrinInt.principal).toBe(10000);
    expect(splitPrinInt.interest).toBe(1000);
    expect(splitPrinInt.penalty).toBe(0);
    expect(splitPrinInt.principal + splitPrinInt.interest).toBe(11000);

    // Case 3: Exclusive Interest Payment
    const txInterestOnly = {
      amount: 500,
      remarks: 'Interest Paid - Renewal Payment - RC3003'
    };
    const splitInterest = extractLoanPaymentSplits(txInterestOnly, 'CD');
    expect(splitInterest.interest).toBe(500);
    expect(splitInterest.principal).toBe(0);
    expect(splitInterest.penalty).toBe(0);

    // Case 4: Exclusive Penalty Payment
    const txPenaltyOnly = {
      amount: 100,
      remarks: 'Penalty Paid - Partial Payment - RC4004'
    };
    const splitPenalty = extractLoanPaymentSplits(txPenaltyOnly, 'CD');
    expect(splitPenalty.penalty).toBe(100);
    expect(splitPenalty.principal).toBe(0);
    expect(splitPenalty.interest).toBe(0);

    // Case 5: Unstructured / General Payment (Safety Rule 3 & 4: Principal is credited against CD DISBURSEMENT, NOT income)
    const txGeneric = {
      amount: 5000,
      remarks: 'Loan Collection - CD118'
    };
    const splitGeneric = extractLoanPaymentSplits(txGeneric, 'CD');
    expect(splitGeneric.principal).toBe(5000);
    expect(splitGeneric.interest).toBe(0);
    expect(splitGeneric.penalty).toBe(0);
  });

  const createMockChain = (data: any) => {
    const chain: any = {
      select: vi.fn().mockImplementation(() => chain),
      neq: vi.fn().mockImplementation(() => chain),
      eq: vi.fn().mockImplementation(() => chain),
      gte: vi.fn().mockImplementation(() => chain),
      lte: vi.fn().mockImplementation(() => chain),
      or: vi.fn().mockImplementation(() => chain),
      order: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      range: vi.fn().mockResolvedValue({ data, error: null }),
      then: vi.fn().mockImplementation((resolve) => resolve({ data, error: null })),
      catch: vi.fn().mockImplementation(() => chain)
    };
    return chain;
  };

  it('Requirement 3, 4, 5, 6, 7, 11, 12, 13: General Ledger separates CD entries and produces accurate head-wise totals', async () => {
    const mockCdLedgerEntries = [
      // Loan Disbursement: ₹10,000 Dr
      {
        id: 'cd-entry-1',
        entry_date: '2026-08-01',
        loan_id: 'loan-1',
        account_name: 'CD A/C',
        debit: 10000,
        credit: 0,
        entry_type: 'original_loan',
        receipt_no: null,
        particulars: 'Loan Disbursed - CD001',
        loan: { loan_id: 'CD001', loan_category: 'CD', partner_name: 'Partner A' },
        customer: { name: 'Customer One' }
      },
      // Payment 1: Customer pays ₹3,600 (Prin ₹3,000, Int ₹500, Pen ₹100)
      {
        id: 'cd-entry-2',
        entry_date: '2026-08-15',
        loan_id: 'loan-1',
        account_name: 'PENALTY A/C',
        debit: 0,
        credit: 100,
        entry_type: 'penalty_payment',
        receipt_no: 'RC101',
        particulars: 'Penalty Paid - RC101',
        loan: { loan_id: 'CD001', loan_category: 'CD', partner_name: 'Partner A' },
        customer: { name: 'Customer One' }
      },
      {
        id: 'cd-entry-3',
        entry_date: '2026-08-15',
        loan_id: 'loan-1',
        account_name: 'CD COMMISSION A/C',
        debit: 0,
        credit: 500,
        entry_type: 'interest_payment',
        receipt_no: 'RC101',
        particulars: 'Interest Paid - RC101',
        loan: { loan_id: 'CD001', loan_category: 'CD', partner_name: 'Partner A' },
        customer: { name: 'Customer One' }
      },
      {
        id: 'cd-entry-4',
        entry_date: '2026-08-15',
        loan_id: 'loan-1',
        account_name: 'CD A/C',
        debit: 0,
        credit: 3000,
        entry_type: 'principal_payment',
        receipt_no: 'RC101',
        particulars: 'Principal Adjusted - RC101',
        loan: { loan_id: 'CD001', loan_category: 'CD', partner_name: 'Partner A' },
        customer: { name: 'Customer One' }
      }
    ];

    sharedMockFrom.mockImplementation((table: string) => {
      if (table === 'finance_cashbook_accounts') {
        return createMockChain([]);
      }
      if (table === 'finance_cd_ledger_entries') {
        return createMockChain(mockCdLedgerEntries);
      }
      return createMockChain([]);
    });

    const txs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
      financeMode: 'REGULAR'
    });

    // Verify CD COLLECTION is NOT present
    const collectionHeads = txs.filter(t => t.headOfAccount === 'CD COLLECTION');
    expect(collectionHeads.length).toBe(0);

    // Verify CD DISBURSEMENT entries (Disbursement ₹10k Dr, Principal repayment ₹3k Cr)
    const disbTxs = txs.filter(t => t.headOfAccount === 'CD DISBURSEMENT');
    expect(disbTxs.length).toBe(2);
    const disbDebit = disbTxs.reduce((sum, t) => sum + t.debit, 0);
    const disbCredit = disbTxs.reduce((sum, t) => sum + t.credit, 0);
    expect(disbDebit).toBe(10000);
    expect(disbCredit).toBe(3000);
    // Net Principal Outstanding = Debit - Credit = 7000 Dr
    expect(disbDebit - disbCredit).toBe(7000);

    // Verify CD INTEREST entries (Interest collected ₹500 Cr)
    const intTxs = txs.filter(t => t.headOfAccount === 'CD INTEREST');
    expect(intTxs.length).toBe(1);
    expect(intTxs[0].credit).toBe(500);
    expect(intTxs[0].debit).toBe(0);
    expect(intTxs[0].reportClassification).toBe('PROFIT_AND_LOSS');

    // Verify CD PENALTY entries (Penalty collected ₹100 Cr)
    const penTxs = txs.filter(t => t.headOfAccount === 'CD PENALTY');
    expect(penTxs.length).toBe(1);
    expect(penTxs[0].credit).toBe(100);
    expect(penTxs[0].debit).toBe(0);
    expect(penTxs[0].reportClassification).toBe('PROFIT_AND_LOSS');

    // Verify Total Cash Received from payment = Prin ₹3,000 + Int ₹500 + Pen ₹100 = ₹3,600
    const paymentTxs = txs.filter(t => t.receiptOrVoucherNo === 'RC101');
    const totalCredit = paymentTxs.reduce((sum, t) => sum + t.credit, 0);
    expect(totalCredit).toBe(3600);
  });
});
