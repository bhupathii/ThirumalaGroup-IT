import { describe, it, expect } from 'vitest';
import { cdCompoundInterestEngine, TOOLTIP_TEXT } from '../services/cdCompoundInterestEngine';

describe('CD Compound Interest (CI) Display Engine', () => {

  // --- LOAN A: NO PAYMENTS ---
  it('Scenario A: Loan with no payments compounds accurately using standard formula', () => {
    const loan = {
      id: 'loan-a',
      amount: 100000,
      date: '2025-01-01',
      interest_rate: 3.0,
      status: 'Active'
    };

    // Calculate as of 60 days later (2025-03-02)
    const result = cdCompoundInterestEngine.calculateCITimeline(loan, [], '2025-03-02');

    expect(result.summary.initialPrincipal).toBe(100000);
    expect(result.summary.effectiveLoanDays).toBe(60);
    
    // Formula check: 100,000 * (1 + 0.03)^(60/30) = 100,000 * (1.03)^2 = 106,090
    // Interest earned = 6,090
    expect(result.summary.compoundInterestEarned).toBe(6090);
    expect(result.summary.finalCompoundBalance).toBe(106090);
    expect(result.summary.tooltipText).toBe(TOOLTIP_TEXT);
  });

  // --- LOAN B: RENEWED TWICE ---
  it('Scenario B: Loan renewed twice continues compounding across renewal dates seamlessly', () => {
    const loan = {
      id: 'loan-b',
      amount: 100000,
      date: '2025-01-01',
      interest_rate: 3.0,
      status: 'Active'
    };

    const ledgerEntries = [
      { entry_date: '2025-01-31', entry_type: 'renewal', credit: 3000, principal_paid: 0, particulars: '1st Renewal' },
      { entry_date: '2025-03-02', entry_type: 'renewal', credit: 3000, principal_paid: 0, particulars: '2nd Renewal' }
    ];

    const result = cdCompoundInterestEngine.calculateCITimeline(loan, ledgerEntries, '2025-04-01');

    expect(result.summary.initialPrincipal).toBe(100000);
    expect(result.summary.currentOutstandingPrincipal).toBe(100000);
    expect(result.summary.effectiveLoanDays).toBe(90);
    // 90 days at 3% monthly compounding: 100,000 * (1.03)^3 = 109,272.70
    expect(result.summary.finalCompoundBalance).toBeCloseTo(109272.70, 1);
  });

  // --- LOAN C: PRINCIPAL REDUCED ---
  it('Scenario C: Loan with principal reduction produces lower CI than Loan A', () => {
    const loanA = { id: 'loan-a', amount: 100000, date: '2025-01-01', interest_rate: 3.0, status: 'Active' };
    const loanC = { id: 'loan-c', amount: 100000, date: '2025-01-01', interest_rate: 3.0, status: 'Active' };

    // Loan C receives a 50,000 principal reduction on day 30
    const ledgerEntriesC = [
      { entry_date: '2025-01-31', entry_type: 'principal_payment', credit: 50000, principal_paid: 50000, particulars: 'Principal Reduction' }
    ];

    const resultA = cdCompoundInterestEngine.calculateCITimeline(loanA, [], '2025-03-02');
    const resultC = cdCompoundInterestEngine.calculateCITimeline(loanC, ledgerEntriesC, '2025-03-02');

    expect(resultC.summary.totalPrincipalPaid).toBe(50000);
    expect(resultC.summary.currentOutstandingPrincipal).toBe(50000);
    // CI for Loan C should be significantly lower than Loan A due to principal reduction
    expect(resultC.summary.finalCompoundBalance).toBeLessThan(resultA.summary.finalCompoundBalance);
  });

  // --- LOAN D: INTEREST-ONLY PAYMENTS ---
  it('Scenario D: Interest-only payments keep principal unchanged and CI compounds from same outstanding', () => {
    const loan = {
      id: 'loan-d',
      amount: 100000,
      date: '2025-01-01',
      interest_rate: 3.0,
      status: 'Active'
    };

    const ledgerEntries = [
      { entry_date: '2025-01-31', entry_type: 'interest_payment', credit: 3000, principal_paid: 0, particulars: 'Interest Only Paid' }
    ];

    const result = cdCompoundInterestEngine.calculateCITimeline(loan, ledgerEntries, '2025-03-02');

    expect(result.summary.currentOutstandingPrincipal).toBe(100000);
    expect(result.summary.totalPrincipalPaid).toBe(0);
    expect(result.summary.finalCompoundBalance).toBe(106090);
  });

  // --- LOAN E: CLOSED LOAN ---
  it('Scenario E: Closed loan freezes simulation compounding at the close date', () => {
    const loan = {
      id: 'loan-e',
      amount: 100000,
      date: '2025-01-01',
      interest_rate: 3.0,
      status: 'Closed',
      closed_at: '2025-01-31'
    };

    const ledgerEntries = [
      { entry_date: '2025-01-31', entry_type: 'close', credit: 103000, principal_paid: 100000, particulars: 'Loan Closed' }
    ];

    // Request target date far in the future (2026-01-01)
    const result = cdCompoundInterestEngine.calculateCITimeline(loan, ledgerEntries, '2026-01-01');

    expect(result.summary.isClosed).toBe(true);
    expect(result.summary.effectiveLoanDays).toBe(30);
    expect(result.summary.calculatedUntilDate).toBe('2025-01-31');
    // Growth should freeze at 30 days: 100,000 * 1.03 = 103,000
    expect(result.summary.finalCompoundBalance).toBe(103000);
  });

});
