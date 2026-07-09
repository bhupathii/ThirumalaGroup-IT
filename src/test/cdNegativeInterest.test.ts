import { describe, it, expect } from 'vitest';
import { getCDAccountPosition } from '../services/cdLedgerEngine';

describe('CD Negative Interest Regression Tests', () => {
  it('correctly calculates and preserves negative accrued interest when renewed past current date', () => {
    const loan = {
      amount: 250000,
      interest_rate: 2,
      penalty_rate: 3,
      period_days: 30,
      grace_days: 5,
      date: '2025-12-05'
    };

    const ledgerEntries = [
      { entry_type: 'original_loan', entry_date: '2025-12-05', debit: 250000, credit: 0 }
    ];

    // Interest details show renewal of 60 days (extended current due date to 2026-02-03)
    const interestDetails = [
      { receipt_no: 'RC1183', credit: 0, renewed_days: 60, row_type: 'Renewal', entry_date: '2026-01-05' }
    ];

    // Evaluate position as of 2026-01-05 (which is 29 days BEFORE the due date of 2026-02-03)
    // baseDueDate = 2026-01-03. With 60 renewed days, currentDueDate = 2026-03-04 (or similar depending on display days).
    const pos = getCDAccountPosition(loan, ledgerEntries, interestDetails, '2026-01-05');

    // Due days/days past due is negative
    expect(pos.exactDueDays).toBeLessThan(0);
    // Accrued interest is negative and not clamped to 0
    expect(pos.accruedInterest).toBeLessThan(0);
    // Penalty remains 0 (not negative)
    expect(pos.accruedPenalty).toBe(0);
    // Total close is principal balance + negative interest
    expect(pos.totalForClose).toBe(pos.principalBalance + pos.accruedInterest);
    expect(pos.totalForClose).toBeLessThan(pos.principalBalance);
  });
});
