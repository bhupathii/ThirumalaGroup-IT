import { describe, it, expect } from 'vitest';
import * as cdEngine from '../services/cdLedgerEngine';

describe('cdLedgerEngine Unit Tests', () => {

  // 1. Date Ordinal Calculations
  it('correctly calculates calendar midnight UTC and date ordinals', () => {
    const d1 = '2025-02-18';
    const d2 = '2025-03-19';
    
    const ord1 = cdEngine.dateOrdinal(d1);
    const ord2 = cdEngine.dateOrdinal(d2);
    
    expect(ord2 - ord1).toBe(29);
    expect(cdEngine.ordinalToDateStr(ord1)).toBe(d1);
    expect(cdEngine.ordinalToDateStr(ord2)).toBe(d2);
  });

  it('correctly adds calendar days', () => {
    const start = '2025-02-18';
    expect(cdEngine.addCalendarDays(start, 29)).toBe('2025-03-19');
    expect(cdEngine.addCalendarDays(start, 30)).toBe('2025-03-20');
  });

  it('correctly computes difference in calendar days', () => {
    expect(cdEngine.differenceInCalendarDays('2026-07-06', '2025-03-19')).toBe(474);
  });

  // 2. Rounding Helpers
  it('rounds money standardly (2 decimals)', () => {
    expect(cdEngine.roundMoney(123.456)).toBe(123.46);
    expect(cdEngine.roundMoney(123.454)).toBe(123.45);
    expect(cdEngine.roundMoney(123.455)).toBe(123.46);
  });

  it('rounds renewed days standardly (2 decimals)', () => {
    expect(cdEngine.roundRenewedDays(434.804)).toBe(434.80);
    expect(cdEngine.roundRenewedDays(434.805)).toBe(434.81);
  });

  it('converts exact renewed days to display days correctly', () => {
    expect(cdEngine.calculateDisplayDays(434.81)).toBe(435);
    expect(cdEngine.calculateDisplayDays(434.49)).toBe(434);
    expect(cdEngine.calculateDisplayDays(39.19)).toBe(39);
    expect(cdEngine.calculateDisplayDays(39.50)).toBe(40);
  });

  it('applies Banker\'s Rounding (round-to-even) to whole numbers', () => {
    expect(cdEngine.roundRupee(2.5)).toBe(2);
    expect(cdEngine.roundRupee(3.5)).toBe(4);
    expect(cdEngine.roundRupee(2.4)).toBe(2);
    expect(cdEngine.roundRupee(2.6)).toBe(3);
  });

  // 3. CD120 Position Verification
  it('correctly calculates CD120 positions matching verified Access values', () => {
    const loan = {
      id: 'a9c4601a-6df4-434c-9915-7f4b827c6f21',
      loan_id: 'CD120',
      customer_id: 'cust-uuid',
      date: '2025-02-18',
      amount: 750000.00,
      interest_rate: 3,
      penalty_percent: 0.75,
      period_days: 30,
      grace_days: 5,
      status: 'Active'
    };

    const interestDetails = [
      { credit: 0, renewed_days: 30 },
      { credit: 0, renewed_days: 30 },
      { credit: 0, renewed_days: 10.83 },
      { credit: 0, renewed_days: 6.67 },
      { credit: 0, renewed_days: 13.33 },
      { credit: 0, renewed_days: 28.5 },
      { credit: 0, renewed_days: 34.75 },
      { credit: 0, renewed_days: 10.5 },
      { credit: 0, renewed_days: 16.75 },
      { credit: 0, renewed_days: 9.6 },
      { credit: 0, renewed_days: 52.19 },
      { credit: 0, renewed_days: 24.75 },
      { credit: 0, renewed_days: 9.6 },
      { credit: 0, renewed_days: 14.4 },
      { credit: 0, renewed_days: 10.67 },
      { credit: 0, renewed_days: 12.27 },
      { credit: 0, renewed_days: 13.87 },
      { credit: 0, renewed_days: 10.13 },
      { credit: 0, renewed_days: 24 },
      { credit: 0, renewed_days: 24 },
      { credit: 0, renewed_days: 24 },
      { credit: 0, renewed_days: 24 },
    ];

    const ledgerEntries = [
      { entry_type: 'original_loan', entry_date: '2025-02-18', debit: 750000, credit: 0 },
      { entry_type: 'amount_paid', entry_date: '2026-06-29', debit: 0, credit: 18000 }
    ];

    const pos = cdEngine.getCDAccountPosition(loan, ledgerEntries, interestDetails, '2026-07-06');

    expect(pos.principalBalance).toBe(750000.00);
    expect(pos.lastPaymentDate).toBe('2026-06-29');
    expect(pos.currentDueDate).toBe('2026-05-27'); // Floor of baseDueDate + exactRenewedDays
    expect(pos.displayDueDays).toBe(39);
    expect(pos.exactDueDays).toBe(39.19);
    expect(pos.accruedInterest).toBe(29392.50);
    expect(pos.accruedPenalty).toBe(7348.13);
    expect(pos.todayDue).toBe(36740.63);
    expect(pos.renewalAmount).toBe(22500.00);
    expect(pos.totalToRegularize).toBe(59240.63);
    expect(pos.totalForClose).toBe(786740.63);
  });

  // 4. Chronology Guards
  it('throws CD_DATA_INTEGRITY_ERROR when loan date is after payment date', () => {
    const loan = {
      id: 'mock-uuid',
      loan_id: 'CD-MOCK',
      date: '2026-04-29',
      amount: 750000,
      interest_rate: 3,
      penalty_percent: 0.75,
      period_days: 30
    };

    const ledgerEntries = [
      { entry_type: 'original_loan', entry_date: '2026-04-29', debit: 750000, credit: 0 },
      { entry_type: 'amount_paid', entry_date: '2025-03-24', debit: 0, credit: 22500 }
    ];

    expect(() => {
      cdEngine.getCDAccountPosition(loan, ledgerEntries, [], '2026-07-06');
    }).toThrow(/CD_DATA_INTEGRITY_ERROR/);
  });

  // 5. Live Payment Allocations
  it('correctly splits Close action payment', () => {
    const mockPos: cdEngine.CDAccountPosition = {
      principalBalance: 750000,
      originalLoanDate: '2025-02-18',
      baseDueDate: '2025-03-19',
      totalRenewedDays: 434.81,
      currentDueDate: '2026-05-27',
      displayDueDays: 39,
      exactDueDays: 39.19,
      dailyInterest: 750,
      dailyPenalty: 187.5,
      accruedInterest: 29392.50,
      accruedPenalty: 7348.13,
      todayDue: 36740.63,
      renewalAmount: 22500,
      totalToRegularize: 59240.63,
      totalForClose: 786740.63,
      lastPaymentDate: '2026-06-29'
    };

    const split = cdEngine.allocateCDPayment(mockPos, 786740.63, 'Close', 30);
    expect(split.penaltyPaid).toBe(7348.13);
    expect(split.interestPaid).toBe(29392.50);
    expect(split.principalPaid).toBe(750000.00);
    expect(split.renewedDays).toBe(0);
  });

  it('correctly splits Partial payment clearing all dues', () => {
    const mockPos: cdEngine.CDAccountPosition = {
      principalBalance: 750000,
      originalLoanDate: '2025-02-18',
      baseDueDate: '2025-03-19',
      totalRenewedDays: 434.81,
      currentDueDate: '2026-05-27',
      displayDueDays: 39,
      exactDueDays: 39.19,
      dailyInterest: 750,
      dailyPenalty: 187.5,
      accruedInterest: 29392.50,
      accruedPenalty: 7348.13,
      todayDue: 36740.63,
      renewalAmount: 22500,
      totalToRegularize: 59240.63,
      totalForClose: 786740.63,
      lastPaymentDate: '2026-06-29'
    };

    // If payment is ₹40,000, it clears outstanding interest/penalty (₹36,740.63)
    // and remainder goes to principal.
    const split = cdEngine.allocateCDPayment(mockPos, 40000.00, 'Partial', 30);
    expect(split.penaltyPaid).toBe(7348.13);
    expect(split.interestPaid).toBe(29392.50);
    expect(split.principalPaid).toBe(3259.37);
    expect(split.renewedDays).toBe(39.19); // advances to the audit date exactly
  });

  it('correctly splits Overdue Renew payment (80/20)', () => {
    const mockPos: cdEngine.CDAccountPosition = {
      principalBalance: 750000,
      originalLoanDate: '2025-02-18',
      baseDueDate: '2025-03-19',
      totalRenewedDays: 434.81,
      currentDueDate: '2026-05-27',
      displayDueDays: 39,
      exactDueDays: 39.19,
      dailyInterest: 750,
      dailyPenalty: 187.5,
      accruedInterest: 29392.50,
      accruedPenalty: 7348.13,
      todayDue: 36740.63,
      renewalAmount: 22500,
      totalToRegularize: 59240.63,
      totalForClose: 786740.63,
      lastPaymentDate: '2026-06-29'
    };

    // Pay ₹22,500 on Renew:
    // Penalty bucket: roundRupee(22500 * 0.2) = 4500
    // Interest bucket: 22500 - 4500 = 18000
    // penaltyPaid = 4500, interestPaid = 18000
    // renewedDays = 18000 / 750 = 24
    const split = cdEngine.allocateCDPayment(mockPos, 22500.00, 'Renew', 30);
    expect(split.penaltyPaid).toBe(4500.00);
    expect(split.interestPaid).toBe(18000.00);
    expect(split.principalPaid).toBe(0);
    expect(split.renewedDays).toBe(24.00);
  });
});
