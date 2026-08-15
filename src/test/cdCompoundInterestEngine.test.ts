import { describe, it, expect } from 'vitest';
import { cdCompoundInterestEngine, TOOLTIP_TEXT } from '../services/cdCompoundInterestEngine';

describe('CD Compound Interest (CI) 30-Day Cycle Engine', () => {

  // --- SCENARIO 1: CLIENT'S EXACT 75-DAY TIMELINE EXAMPLE ---
  it('Scenario 1: Calculates exact 30-day cycles + 15-day partial cycle for 75-day loan (₹10,000 @ 3%)', () => {
    const loan = {
      id: 'cd-101',
      amount: 10000,
      date: '2026-08-13',
      interest_rate: 3.0,
      status: 'Active'
    };

    // Calculate as of 75 days later (2026-10-27)
    const result = cdCompoundInterestEngine.calculateCITimeline(loan, [], '2026-10-27');

    expect(result.summary.initialPrincipal).toBe(10000);
    expect(result.summary.effectiveLoanDays).toBe(75);
    expect(result.summary.compoundInterestEarned).toBe(768.14);
    expect(result.summary.finalCompoundBalance).toBe(10768.14);
    expect(result.summary.tooltipText).toBe(TOOLTIP_TEXT);

    // Verify row-by-row structure
    expect(result.reportRows).toHaveLength(4);

    // Day 0: Loan Start
    expect(result.reportRows[0]).toMatchObject({
      date: '2026-08-13',
      period: 'Loan Start',
      days: 0,
      startBalance: 10000,
      interest: 0,
      payment: 0,
      endBalance: 10000
    });

    // Day 30: Cycle 1
    expect(result.reportRows[1]).toMatchObject({
      date: '2026-09-12',
      period: 'Cycle 1',
      days: 30,
      startBalance: 10000,
      interest: 300,
      payment: 0,
      endBalance: 10300
    });

    // Day 60: Cycle 2
    expect(result.reportRows[2]).toMatchObject({
      date: '2026-10-12',
      period: 'Cycle 2',
      days: 30,
      startBalance: 10300,
      interest: 309,
      payment: 0,
      endBalance: 10609
    });

    // Day 75: Partial Cycle (15 days)
    expect(result.reportRows[3]).toMatchObject({
      date: '2026-10-27',
      period: 'Partial Cycle',
      days: 15,
      startBalance: 10609,
      interest: 159.14,
      payment: 0,
      endBalance: 10768.14
    });
  });

  // --- SCENARIO 2: CLIENT'S EXACT PAYMENT EXAMPLE (Day 75 Payment -> Day 105 Cycle 3) ---
  it('Scenario 2: Payment on Day 75 deducts from future value and restarts 30-day cycle from remaining balance', () => {
    const loan = {
      id: 'cd-102',
      amount: 10000,
      date: '2026-08-13',
      interest_rate: 3.0,
      status: 'Active'
    };

    // Borrower pays ₹768.14 on Day 75 (2026-10-27)
    const ledgerEntries = [
      {
        entry_date: '2026-10-27',
        entry_type: 'renewal',
        credit: 768.14,
        particulars: 'Interest Paid / Renewal'
      }
    ];

    // Evaluate up to Day 105 (2026-11-26, 30 days after payment)
    const result = cdCompoundInterestEngine.calculateCITimeline(loan, ledgerEntries, '2026-11-26');

    expect(result.summary.initialPrincipal).toBe(10000);
    expect(result.summary.effectiveLoanDays).toBe(105);
    expect(result.summary.totalPrincipalPaid).toBe(768.14);
    // Total Interest: 300 + 309 + 159.14 + 300 = 1068.14
    expect(result.summary.compoundInterestEarned).toBe(1068.14);
    // Future Value on Day 105: 10,000 + 300 = 10,300
    expect(result.summary.finalCompoundBalance).toBe(10300);

    expect(result.reportRows).toHaveLength(5);

    // Row 0: Loan Start (13-Aug)
    expect(result.reportRows[0].endBalance).toBe(10000);

    // Row 1: Cycle 1 (12-Sep, 30d) -> 10,300
    expect(result.reportRows[1]).toMatchObject({
      period: 'Cycle 1',
      days: 30,
      interest: 300,
      endBalance: 10300
    });

    // Row 2: Cycle 2 (12-Oct, 30d) -> 10,609
    expect(result.reportRows[2]).toMatchObject({
      period: 'Cycle 2',
      days: 30,
      interest: 309,
      endBalance: 10609
    });

    // Row 3: Partial Cycle (27-Oct, 15d) with payment of 768.14 -> reduces balance from 10,768.14 to 10,000
    expect(result.reportRows[3]).toMatchObject({
      date: '2026-10-27',
      period: 'Partial Cycle',
      days: 15,
      startBalance: 10609,
      interest: 159.14,
      payment: 768.14,
      endBalance: 10000
    });

    // Row 4: Cycle 3 (26-Nov, 30d from payment date) -> 10,000 * 3% = 300 -> 10,300
    expect(result.reportRows[4]).toMatchObject({
      date: '2026-11-26',
      period: 'Cycle 3',
      days: 30,
      startBalance: 10000,
      interest: 300,
      payment: 0,
      endBalance: 10300
    });
  });

  // --- SCENARIO 3: RENEWAL OCCURRING AT 75 DAYS STILL PRODUCES 30d + 30d + 15d CYCLES ---
  it('Scenario 3: Renewal is treated as a financial event, not a CI calculation boundary', () => {
    const loan = {
      id: 'cd-103',
      amount: 100000,
      date: '2025-01-01',
      interest_rate: 3.0,
      status: 'Active'
    };

    // Renewal occurs on day 60 (2025-03-02) with 6000 interest payment
    const ledgerEntries = [
      { entry_date: '2025-03-02', entry_type: 'renewal', credit: 6000, particulars: 'Renewal at 60 Days' }
    ];

    const result = cdCompoundInterestEngine.calculateCITimeline(loan, ledgerEntries, '2025-03-02');

    // Should produce: Loan Start, Cycle 1 (30d), Cycle 2 (30d with payment of 6000)
    expect(result.reportRows).toHaveLength(3);
    expect(result.reportRows[1].period).toBe('Cycle 1');
    expect(result.reportRows[1].days).toBe(30);
    expect(result.reportRows[1].endBalance).toBe(103000);

    expect(result.reportRows[2].period).toBe('Cycle 2');
    expect(result.reportRows[2].days).toBe(30);
    expect(result.reportRows[2].interest).toBe(3090);
    expect(result.reportRows[2].payment).toBe(6000);
    expect(result.reportRows[2].endBalance).toBe(100090);
  });

  // --- SCENARIO 4: CLOSED LOAN FREEZES AT CLOSE DATE ---
  it('Scenario 4: Closed loan freezes simulation at closure date', () => {
    const loan = {
      id: 'cd-104',
      amount: 100000,
      date: '2025-01-01',
      interest_rate: 3.0,
      status: 'Closed',
      closed_at: '2025-01-31'
    };

    const ledgerEntries = [
      { entry_date: '2025-01-31', entry_type: 'close', credit: 103000, principal_paid: 100000, particulars: 'Loan Closed' }
    ];

    // Request target date far in the future
    const result = cdCompoundInterestEngine.calculateCITimeline(loan, ledgerEntries, '2026-01-01');

    expect(result.summary.isClosed).toBe(true);
    expect(result.summary.effectiveLoanDays).toBe(30);
    expect(result.summary.calculatedUntilDate).toBe('2025-01-31');
    expect(result.summary.finalCompoundBalance).toBe(0);
    expect(result.summary.compoundInterestEarned).toBe(3000);
  });

  // --- SCENARIO 5: LOAN DURATION < 30 DAYS (SINGLE PARTIAL CYCLE) ---
  it('Scenario 5: Loan active for only 10 days produces single partial cycle without 30-day row', () => {
    const loan = {
      id: 'cd-105',
      amount: 30000,
      date: '2026-08-01',
      interest_rate: 3.0,
      status: 'Active'
    };

    const result = cdCompoundInterestEngine.calculateCITimeline(loan, [], '2026-08-11');

    expect(result.summary.effectiveLoanDays).toBe(10);
    // Interest = 30000 * 3% * (10 / 30) = 300
    expect(result.summary.compoundInterestEarned).toBe(300);
    expect(result.summary.finalCompoundBalance).toBe(30300);
    expect(result.reportRows).toHaveLength(2); // Loan Start + Partial Cycle
    expect(result.reportRows[1].period).toBe('Partial Cycle');
    expect(result.reportRows[1].days).toBe(10);
  });

  // --- SCENARIO 6: EXACT MULTIPLE OF 30 DAYS (EXACT 2 CYCLES, NO PARTIAL CYCLE) ---
  it('Scenario 6: Loan active for exactly 60 days produces exactly 2 full cycles without partial cycle', () => {
    const loan = {
      id: 'cd-106',
      amount: 10000,
      date: '2026-08-01',
      interest_rate: 3.0,
      status: 'Active'
    };

    const result = cdCompoundInterestEngine.calculateCITimeline(loan, [], '2026-09-30');

    expect(result.summary.effectiveLoanDays).toBe(60);
    // Cycle 1: 300 -> 10,300; Cycle 2: 309 -> 10,609
    expect(result.summary.compoundInterestEarned).toBe(609);
    expect(result.summary.finalCompoundBalance).toBe(10609);
    expect(result.reportRows).toHaveLength(3); // Loan Start + Cycle 1 + Cycle 2
    expect(result.reportRows[1].period).toBe('Cycle 1');
    expect(result.reportRows[2].period).toBe('Cycle 2');
  });

});
