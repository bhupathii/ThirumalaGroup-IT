import { describe, it, expect } from 'vitest';

// Simulate the verification logic from EditLoanEntry.tsx
interface LedgerEntry {
  entry_type: string;
  account_name: string;
  debit: number;
  credit: number;
}

function verifyOpeningEntries(
  amount: number,
  interestRate: number,
  periodDays: number,
  docCharges: number,
  verEntries: LedgerEntry[]
): string[] {
  const mismatches: string[] = [];

  const expectedComm = Number(((amount * (interestRate / 100) * periodDays) / 30).toFixed(2));
  const expectedDoc = docCharges;

  // Semantic check with legacy aliases
  const commEntry = verEntries.find((e: any) => 
    e.entry_type === 'opening_commission' || 
    e.entry_type === 'Commission'
  );
  const docEntry = verEntries.find((e: any) => 
    e.entry_type === 'document_charge' || 
    (e.account_name || '').toLowerCase() === 'cd document charges a/c'
  );

  if (expectedComm > 0 && (!commEntry || Number(commEntry.credit) !== expectedComm)) {
    mismatches.push('CD Ledger Sync (Opening Commission)');
  }
  if (expectedDoc > 0 && (!docEntry || Number(docEntry.credit) !== expectedDoc)) {
    mismatches.push('CD Ledger Sync (Document Charges)');
  }

  return mismatches;
}

// Simulate the updateLoan CD sync logic in supabaseFinance.ts
function simulateCdSync(
  amount: number,
  interestRate: number,
  periodDays: number,
  docCharges: number,
  existingEntries: LedgerEntry[]
): LedgerEntry[] {
  const nextEntries = [...existingEntries];

  const commRate = interestRate;
  // NOTE: 0 is a valid business value for period_days (zero-day CD).
  // Only substitute 30 when periodDays is null/undefined, not when it is explicitly 0.
  const pDays = periodDays != null ? periodDays : 30;
  const commAmount = Number(((amount * (commRate / 100) * pDays) / 30).toFixed(2));

  // original_loan entry
  const origEntry = nextEntries.find((e: any) => e.entry_type === 'original_loan');
  if (!origEntry) {
    nextEntries.push({
      entry_type: 'original_loan',
      account_name: 'CD A/C',
      debit: amount,
      credit: 0
    });
  }

  // opening_commission entry
  const commEntry = nextEntries.find((e: any) => 
    e.entry_type === 'opening_commission' || 
    e.entry_type === 'Commission'
  );
  if (commEntry) {
    if (commAmount > 0) {
      commEntry.credit = commAmount;
    } else {
      const idx = nextEntries.indexOf(commEntry);
      nextEntries.splice(idx, 1);
    }
  } else if (commAmount > 0) {
    nextEntries.push({
      entry_type: 'opening_commission',
      account_name: 'CD COMMISSION A/C',
      debit: 0,
      credit: commAmount
    });
  }

  // document_charge entry
  const docEntry = nextEntries.find((e: any) => 
    e.entry_type === 'document_charge' || 
    (e.account_name || '').toLowerCase() === 'cd document charges a/c'
  );
  if (docEntry) {
    if (docCharges > 0) {
      docEntry.credit = docCharges;
    } else {
      const idx = nextEntries.indexOf(docEntry);
      nextEntries.splice(idx, 1);
    }
  } else if (docCharges > 0) {
    nextEntries.push({
      entry_type: 'document_charge',
      account_name: 'CD DOCUMENT CHARGES A/C',
      debit: 0,
      credit: docCharges
    });
  }

  return nextEntries;
}

describe('CD Opening Ledger Row Verification Regression Tests', () => {
  it('passes verification when expected commission matches the persisted opening commission row', () => {
    const entries: LedgerEntry[] = [
      { entry_type: 'opening_commission', account_name: 'CD COMMISSION A/C', debit: 0, credit: 5000 },
      { entry_type: 'document_charge', account_name: 'CD DOCUMENT CHARGES A/C', debit: 0, credit: 250 }
    ];

    const mismatches = verifyOpeningEntries(250000, 2, 30, 250, entries);
    expect(mismatches.length).toBe(0);
  });

  it('passes verification with legacy aliases (Commission and CD DOCUMENT CHARGES A/C)', () => {
    const entries: LedgerEntry[] = [
      { entry_type: 'Commission', account_name: 'CD COMMISSION A/C', debit: 0, credit: 5000 },
      { entry_type: 'some_other_type', account_name: 'CD DOCUMENT CHARGES A/C', debit: 0, credit: 250 }
    ];

    const mismatches = verifyOpeningEntries(250000, 2, 30, 250, entries);
    expect(mismatches.length).toBe(0);
  });

  it('fails verification with genuine opening commission mismatch', () => {
    const entries: LedgerEntry[] = [
      { entry_type: 'opening_commission', account_name: 'CD COMMISSION A/C', debit: 0, credit: 4000 },
      { entry_type: 'document_charge', account_name: 'CD DOCUMENT CHARGES A/C', debit: 0, credit: 250 }
    ];

    const mismatches = verifyOpeningEntries(250000, 2, 30, 250, entries);
    expect(mismatches).toContain('CD Ledger Sync (Opening Commission)');
  });

  it('fails verification with genuine document charge mismatch', () => {
    const entries: LedgerEntry[] = [
      { entry_type: 'opening_commission', account_name: 'CD COMMISSION A/C', debit: 0, credit: 5000 },
      { entry_type: 'document_charge', account_name: 'CD DOCUMENT CHARGES A/C', debit: 0, credit: 150 }
    ];

    const mismatches = verifyOpeningEntries(250000, 2, 30, 250, entries);
    expect(mismatches).toContain('CD Ledger Sync (Document Charges)');
  });

  it('fails verification when expected rows are entirely missing from the entries array', () => {
    const entries: LedgerEntry[] = [];
    const mismatches = verifyOpeningEntries(250000, 2, 30, 250, entries);
    expect(mismatches).toContain('CD Ledger Sync (Opening Commission)');
    expect(mismatches).toContain('CD Ledger Sync (Document Charges)');
  });
});

describe('CD Auto-Heal Save Safety Audits', () => {
  it('does not create duplicate rows when legacy aliases already exist', () => {
    const legacyEntries: LedgerEntry[] = [
      { entry_type: 'original_loan', account_name: 'CD A/C', debit: 250000, credit: 0 },
      { entry_type: 'Commission', account_name: 'CD COMMISSION A/C', debit: 0, credit: 5000 },
      { entry_type: 'some_other_type', account_name: 'CD DOCUMENT CHARGES A/C', debit: 0, credit: 250 }
    ];

    const synced = simulateCdSync(250000, 2, 30, 250, legacyEntries);

    // Assert counts of rows by semantic type are exactly 1
    const commCount = synced.filter(e => e.entry_type === 'opening_commission' || e.entry_type === 'Commission').length;
    const docCount = synced.filter(e => e.entry_type === 'document_charge' || (e.account_name || '').toLowerCase() === 'cd document charges a/c').length;
    const origCount = synced.filter(e => e.entry_type === 'original_loan').length;

    expect(commCount).toBe(1);
    expect(docCount).toBe(1);
    expect(origCount).toBe(1);
    expect(synced.length).toBe(3);
  });

  it('correctly creates exactly one missing opening row when they are genuinely missing (CD127-style)', () => {
    const emptyEntries: LedgerEntry[] = [];

    const synced = simulateCdSync(250000, 2, 30, 250, emptyEntries);

    const commCount = synced.filter(e => e.entry_type === 'opening_commission' || e.entry_type === 'Commission').length;
    const docCount = synced.filter(e => e.entry_type === 'document_charge' || (e.account_name || '').toLowerCase() === 'cd document charges a/c').length;
    const origCount = synced.filter(e => e.entry_type === 'original_loan').length;

    expect(commCount).toBe(1);
    expect(docCount).toBe(1);
    expect(origCount).toBe(1);
    expect(synced.length).toBe(3);
  });

  it('remains perfectly idempotent over multiple saves (double save)', () => {
    const initialEntries: LedgerEntry[] = [];

    const save1 = simulateCdSync(250000, 2, 30, 250, initialEntries);
    const save2 = simulateCdSync(250000, 2, 30, 250, save1);

    expect(save2.length).toBe(3);
    expect(save1).toEqual(save2);
  });
});
