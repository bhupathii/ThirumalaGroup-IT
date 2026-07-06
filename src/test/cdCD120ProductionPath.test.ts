import { describe, it, expect } from 'vitest';
import { supabaseFinance } from '../lib/supabaseFinance';
import { financeCalculationService } from '../services/financeCalculationService';

const CD120_LOAN_UUID = 'a9c4601a-6df4-434c-9915-7f4b827c6f21';
const AUDIT_DATE = '2026-07-06';

describe('CD120 Production Path Integration Test', () => {
  it('loads real data from DB, runs it through the production calculator, and verifies all target values', async () => {
    // 1. Load the actual persisted loan record
    const selectedLoan = await supabaseFinance.getLoanById(CD120_LOAN_UUID);
    expect(selectedLoan).not.toBeNull();
    expect(selectedLoan!.loan_id).toBe('CD120');

    // 2. Fetch the actual ledger and interest-detail entries
    const cdLedgerEntries = await supabaseFinance.getCDLedgerEntries(CD120_LOAN_UUID);
    const cdInterestDetails = await supabaseFinance.getCDInterestDetails(CD120_LOAN_UUID);

    expect(cdLedgerEntries.length).toBeGreaterThan(0);
    expect(cdInterestDetails.length).toBeGreaterThan(0);

    // 3. Run through the real production service used by CD Ledger React component
    const pos = financeCalculationService.getCDAccountPosition(
      selectedLoan,
      cdLedgerEntries,
      cdInterestDetails,
      AUDIT_DATE
    );

    // 4. Assert all locked target values
    // Principal Balance = 750,000.00 (CD120 original amount was ₹7,50,000)
    expect(pos.principalBalance).toBe(750000.00);

    // Last Payment = 2026-06-29 (RC719)
    expect(pos.lastPaymentDate).toBe('2026-06-29');

    // Current Due Date = 2026-05-28
    expect(pos.currentDueDate).toBe('2026-05-28');

    // Display Due Days = 39
    expect(pos.displayDueDays).toBe(39);

    // Exact Due Days = 39.19
    expect(pos.exactCalculationDays).toBe(39.19);
    expect(pos.exactDueDays).toBe(39.19);

    // Accrued Interest = ₹29,392.50
    expect(pos.accruedInterest).toBe(29392.50);

    // Accrued Penalty = ₹7,348.13
    expect(pos.accruedPenalty).toBe(7348.13);

    // Today Due = ₹36,740.63
    expect(pos.todayDue).toBe(36740.63);

    // Total Renewal = ₹22,500.00
    expect(pos.renewalAmount).toBe(22500.00);
    expect(pos.totalRenewal).toBe(22500.00);

    // Total Regularize = ₹59,240.63
    expect(pos.totalToRegularize).toBe(59240.63);

    // Total Close = ₹7,86,740.63
    expect(pos.totalForClose).toBe(786740.63);
  });
});
