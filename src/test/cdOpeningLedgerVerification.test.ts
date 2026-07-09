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
