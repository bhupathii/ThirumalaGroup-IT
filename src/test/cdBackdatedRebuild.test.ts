import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cdLedgerRebuildService } from '../services/cdLedgerRebuildService';
import { supabaseFinance } from '../lib/supabaseFinance';

// Initialize global state for the mock
(globalThis as any).mockState = {
  singleLoan: null as any,
  ledgerEntries: [] as any[],
  interestDetails: [] as any[],
  transactions: [] as any[],
  insertedEntries: [] as any[],
  insertedInterests: [] as any[],
  entryCounter: 0,
  interestCounter: 0,
};

const getGlobalState = () => (globalThis as any).mockState;

// Create hoisted mock definitions
vi.mock('../lib/supabase', () => {
  const mockSupabase = {
    from: (table: string) => {
      const state = (globalThis as any).mockState;
      let data: any = null;
      let count = 0;
      if (table === 'finance_loans') {
        data = state.singleLoan;
        count = state.singleLoan ? 1 : 0;
      } else if (table === 'finance_cd_ledger_entries') {
        data = state.ledgerEntries;
        count = state.ledgerEntries.length;
      } else if (table === 'finance_cd_interest_details') {
        data = state.interestDetails;
        count = state.interestDetails.length;
      } else if (table === 'finance_transactions') {
        // Sort transactions chronologically in the mock
        data = [...state.transactions].sort((a: any, b: any) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          const createDiff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          if (createDiff !== 0) return createDiff;
          return String(a.id).localeCompare(String(b.id));
        });
        count = data.length;
      }

      const queryResult = { data, error: null, count };
      const localChain: any = {
        select: () => localChain,
        eq: () => localChain,
        neq: () => localChain,
        in: () => localChain,
        order: () => {
          // Re-sort mock data whenever order is called
          if (table === 'finance_transactions') {
            queryResult.data = [...state.transactions].sort((a: any, b: any) => {
              const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
              if (dateDiff !== 0) return dateDiff;
              const createDiff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
              if (createDiff !== 0) return createDiff;
              return String(a.id).localeCompare(String(b.id));
            });
          }
          return localChain;
        },
        single: () => Promise.resolve({ data: queryResult.data, error: queryResult.error, count: queryResult.count }),
        maybeSingle: () => Promise.resolve({ data: queryResult.data, error: queryResult.error, count: queryResult.count }),
        delete: () => {
          if (table === 'finance_cd_ledger_entries') {
            state.ledgerEntries = state.ledgerEntries.filter((e: any) => e.entry_type === 'original_loan' || e.entry_type === 'opening_commission' || e.entry_type === 'document_charge');
          } else if (table === 'finance_cd_interest_details') {
            state.interestDetails = [];
          }
          return localChain;
        },
        insert: () => localChain,
        update: () => localChain,
        then: (onfulfilled: any) => {
          return Promise.resolve(queryResult).then(onfulfilled);
        },
      };
      return localChain;
    },
  };

  return {
    supabase: mockSupabase,
    default: mockSupabase,
    resolveSchemaAndTable: (tableName: string) => ({ schema: 'finance', table: tableName }),
  };
});

vi.mock('../lib/supabaseDatabase', () => {
  return {
    supabase: (globalThis as any).supabase,
    resolveSchemaAndTable: (tableName: string) => ({ schema: 'finance', table: tableName }),
  };
});

// Mock supabaseFinance methods that perform inserts
vi.spyOn(supabaseFinance, 'addCDLedgerEntry').mockImplementation(async (payload: any) => {
  const state = getGlobalState();
  state.entryCounter++;
  const entry = { ...payload, id: `entry_${state.entryCounter}` };
  state.ledgerEntries.push(entry);
  state.insertedEntries.push(entry);
  return entry;
});

vi.spyOn(supabaseFinance, 'addCDInterestDetail').mockImplementation(async (payload: any) => {
  const state = getGlobalState();
  state.interestCounter++;
  const detail = { ...payload, id: `interest_${state.interestCounter}` };
  state.interestDetails.push(detail);
  state.insertedInterests.push(detail);
  return detail;
});

describe('CD Backdated Payment Chronological Rebuild Regression Tests', () => {
  beforeEach(() => {
    const state = getGlobalState();
    state.singleLoan = {
      id: 'loan_cd127_mock',
      loan_id: 'CD127',
      customer_id: 'cust_srinivas',
      amount: 250000,
      interest_rate: 2,
      penalty_percent: 0.75,
      period_days: 30,
      date: '2025-12-05',
      status: 'Active',
      book_id: 'book_mock'
    };
    state.ledgerEntries = [
      { id: 'orig', loan_id: 'loan_cd127_mock', entry_type: 'original_loan', debit: 250000, entry_date: '2025-12-05' }
    ];
    state.interestDetails = [];
    state.transactions = [
      { id: 'disb', loan_id: 'loan_cd127_mock', type: 'Disbursement', amount: 250000, date: '2025-12-05' }
    ];
    state.insertedEntries = [];
    state.insertedInterests = [];
    state.entryCounter = 0;
    state.interestCounter = 0;
    vi.clearAllMocks();
  });

  it('correctly handles backdated payment insertion and removes stale penalties on chronological rebuild', async () => {
    const state = getGlobalState();

    // 1. Setup initial timeline with a gap (missing May payment)
    const initialCollections = [
      { id: 'tx1', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-01-05', receipt_no: 'RC1', remarks: 'Renewal', created_at: '2026-01-05T00:00:00Z' },
      { id: 'tx2', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-02-05', receipt_no: 'RC2', remarks: 'Renewal', created_at: '2026-02-05T00:00:00Z' },
      { id: 'tx3', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-03-06', receipt_no: 'RC3', remarks: 'Renewal', created_at: '2026-03-06T00:00:00Z' },
      { id: 'tx4', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-04-06', receipt_no: 'RC4', remarks: 'Renewal', created_at: '2026-04-06T00:00:00Z' },
      { id: 'tx5', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-06-03', receipt_no: 'RC5', remarks: 'Renewal', created_at: '2026-06-03T00:00:00Z' }, // delayed (April to June)
      { id: 'tx6', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-07-04', receipt_no: 'RC6', remarks: 'Renewal', created_at: '2026-07-04T00:00:00Z' }
    ];
    state.transactions.push(...initialCollections);

    // 2. Perform rebuild on initial timeline
    let rebuildRes = await cdLedgerRebuildService.rebuildCDLoanLifecycle('loan_cd127_mock', 'FULL_RECALCULATE');
    expect(rebuildRes.success).toBe(true);

    // Confirm that delayed timeline generated penalties for RC5 and RC6
    const rc5PenaltyBefore = state.insertedEntries.find((e: any) => e.receipt_no === 'RC5' && e.entry_type === 'penalty_payment');
    const rc6PenaltyBefore = state.insertedEntries.find((e: any) => e.receipt_no === 'RC6' && e.entry_type === 'penalty_payment');
    expect(rc5PenaltyBefore).toBeDefined();
    expect(rc5PenaltyBefore.credit).toBeGreaterThan(0);
    expect(rc6PenaltyBefore).toBeDefined();
    expect(rc6PenaltyBefore.credit).toBeGreaterThan(0);

    // Clear tracking arrays for the next step
    state.insertedEntries = [];
    state.insertedInterests = [];
    state.entryCounter = 0;
    state.interestCounter = 0;

    // 3. Insert backdated payment for May
    const backdatedTx = { id: 'tx7', loan_id: 'loan_cd127_mock', type: 'Collection', amount: 5000, date: '2026-05-07', receipt_no: 'RC7', remarks: 'Renewal', created_at: '2026-05-07T00:00:00Z' };
    state.transactions.push(backdatedTx);

    // 4. Run rebuild in FULL_RECALCULATE mode
    rebuildRes = await cdLedgerRebuildService.rebuildCDLoanLifecycle('loan_cd127_mock', 'FULL_RECALCULATE');
    expect(rebuildRes.success).toBe(true);

    // Assert that stale penalties for RC5 (June) and RC6 (July) are now removed (credit === 0 / undefined for penalty rows)
    const rc5PenaltyAfter = state.insertedEntries.find((e: any) => e.receipt_no === 'RC5' && e.entry_type === 'penalty_payment');
    const rc6PenaltyAfter = state.insertedEntries.find((e: any) => e.receipt_no === 'RC6' && e.entry_type === 'penalty_payment');
    expect(rc5PenaltyAfter).toBeUndefined();
    expect(rc6PenaltyAfter).toBeUndefined();

    // Verify RC7 (backdated payment) has 30 renewed days and no penalty
    const rc7Interest = state.insertedEntries.find((e: any) => e.receipt_no === 'RC7' && e.entry_type === 'interest_payment');
    const rc7Penalty = state.insertedEntries.find((e: any) => e.receipt_no === 'RC7' && e.entry_type === 'penalty_payment');
    expect(rc7Interest).toBeDefined();
    expect(rc7Interest.credit).toBe(5000);
    expect(rc7Penalty).toBeUndefined();

    // Verify RC5 has 30 renewed days now that the gap is filled
    const rc5Interest = state.insertedEntries.find((e: any) => e.receipt_no === 'RC5' && e.entry_type === 'interest_payment');
    expect(rc5Interest).toBeDefined();
    expect(rc5Interest.credit).toBe(5000);

    // 5. Test rebuild idempotency
    state.entryCounter = 0;
    state.interestCounter = 0;
    const snapshot1 = JSON.stringify(state.ledgerEntries);
    const snapshot2 = JSON.stringify(state.interestDetails);

    rebuildRes = await cdLedgerRebuildService.rebuildCDLoanLifecycle('loan_cd127_mock', 'FULL_RECALCULATE');
    expect(rebuildRes.success).toBe(true);

    expect(JSON.stringify(state.ledgerEntries)).toBe(snapshot1);
    expect(JSON.stringify(state.interestDetails)).toBe(snapshot2);
  });
});
