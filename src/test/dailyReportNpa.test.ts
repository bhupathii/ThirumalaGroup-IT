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

import { dailyFinancialTransactionService } from '../services/dailyFinancialTransactionService';

describe('Daily Report & Daybook NPA Records Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      single: vi.fn().mockResolvedValue({ data, error: null }),
      range: vi.fn().mockResolvedValue({ data, error: null }),
      then: vi.fn().mockImplementation((resolve) => resolve({ data, error: null })),
      catch: vi.fn().mockImplementation(() => chain)
    };
    return chain;
  };

  it('includes NPA records in daily transactions when queried by date', async () => {
    sharedMockFrom.mockImplementation((table: string) => {
      if (table === 'finance_cashbook_accounts') {
        return createMockChain([]);
      }
      if (table === 'finance_books') {
        return createMockChain({ id: 'book-1' });
      }
      if (table === 'finance_cd_ledger_entries') {
        return createMockChain([]);
      }
      if (table === 'finance_transactions') {
        return createMockChain([]);
      }
      if (table === 'finance_capital_entries') {
        return createMockChain([]);
      }
      if (table === 'finance_cashbook_entries') {
        return createMockChain([]);
      }
      if (table === 'finance_npa_records') {
        return createMockChain([
          {
            id: 'npa-rec-1',
            customer_name: 'NAGESHWAR REKHA',
            settlement_amount: 113000,
            loan_type: 'CD',
            reason: 'NPA SETTLEMENT RC2474',
            closed_by: 'ADMIN',
            closed_at: '2026-08-15T10:30:00.000Z',
            loan_id: 'CD118'
          }
        ]);
      }
      return createMockChain([]);
    });

    const txs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
      fromDate: '2026-08-15',
      toDate: '2026-08-15',
      financeMode: 'REGULAR'
    });

    expect(txs.length).toBe(1);
    const npaTx = txs[0];
    expect(npaTx.id).toBe('NPA_RECORD_CASH:npa-rec-1');
    expect(npaTx.transactionDate).toBe('2026-08-15');
    expect(npaTx.accountOrLoanNo).toBe('CD118');
    expect(npaTx.customerName).toBe('NAGESHWAR REKHA');
    expect(npaTx.credit).toBe(113000);
    expect(npaTx.debit).toBe(0);
    expect(npaTx.headOfAccount).toBe('CD DISBURSEMENT');
    expect(npaTx.receiptOrVoucherNo).toBe('RC2474');
  });
});
