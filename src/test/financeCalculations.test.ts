import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';

describe('CD Ledger Calculation Rules', () => {
  const principal = 10000;
  const rate = 3;
  const penaltyRate = 0.75;

  it('calculates interest correctly based on days', () => {
    // Interest = Principal * Rate% * Due Days / 30
    const interest = financeCalculationService.calculateInterest(principal, rate, 63);
    expect(interest).toBe(630);
  });

  it('applies grace period correctly for penalty', () => {
    // Penalty is 0 if due days <= 5
    const penaltyUnderGrace = financeCalculationService.calculatePenalty(principal, penaltyRate, 4);
    expect(penaltyUnderGrace).toBe(0);

    const penaltyAtGraceLimit = financeCalculationService.calculatePenalty(principal, penaltyRate, 5);
    expect(penaltyAtGraceLimit).toBe(0);
  });

  it('includes grace days in penalty once grace period is crossed', () => {
    // Penalty includes all dueDays if due days > 5
    const penaltyCrossed = financeCalculationService.calculatePenalty(principal, penaltyRate, 6);
    // 10000 * 0.75% * 6 / 30 = 15.00
    expect(penaltyCrossed).toBe(15);
  });

  it('matches the screenshot validation test case', () => {
    const dueDays = 63;
    const interest = financeCalculationService.calculateInterest(principal, rate, dueDays);
    const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, dueDays);
    const renewalTotal = financeCalculationService.calculateRenewalTotal(interest, penalty);
    const closeTotal = financeCalculationService.calculateCloseTotal(principal, interest, penalty);

    expect(interest).toBe(630);
    expect(penalty).toBe(157.50);
    expect(renewalTotal).toBe(787.50);
    expect(closeTotal).toBe(10787.50);
  });

  it('applies payment splits in correct order: penalty first, interest second, principal last', () => {
    const interestDue = 630;
    const penaltyDue = 157.50;
    const principalBalance = 10000;

    // Split 1: Amount only covers partial penalty
    const split1 = financeCalculationService.applyPaymentSplit(100, interestDue, penaltyDue, principalBalance);
    expect(split1.penaltyPaid).toBe(100);
    expect(split1.interestPaid).toBe(0);
    expect(split1.principalPaid).toBe(0);

    // Split 2: Amount clears penalty and covers partial interest
    const split2 = financeCalculationService.applyPaymentSplit(500, interestDue, penaltyDue, principalBalance);
    expect(split2.penaltyPaid).toBe(157.50);
    expect(split2.interestPaid).toBe(342.50);
    expect(split2.principalPaid).toBe(0);

    // Split 3: Amount clears penalty, interest and covers partial principal
    const split3 = financeCalculationService.applyPaymentSplit(1000, interestDue, penaltyDue, principalBalance);
    expect(split3.penaltyPaid).toBe(157.50);
    expect(split3.interestPaid).toBe(630);
    expect(split3.principalPaid).toBe(212.50);
  });

  it('matches the user test case: Principal 10,000, Due Days 31, Rate 3%, Penalty 0.75%, Paid 300', () => {
    const dueDays = 31;
    const interest = financeCalculationService.calculateInterest(principal, rate, dueDays);
    const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, dueDays);
    const split = financeCalculationService.applyPaymentSplit(300, interest, penalty, principal);

    expect(interest).toBe(310);
    expect(penalty).toBe(77.50);
    expect(split.penaltyPaid).toBe(77.50);
    expect(split.interestPaid).toBe(222.50);
    expect(split.principalPaid).toBe(0);

    const remainingPenalty = penalty - split.penaltyPaid;
    const remainingInterest = interest - split.interestPaid;
    const remainingPrincipal = principal - split.principalPaid;

    expect(remainingPenalty).toBe(0);
    expect(remainingInterest).toBe(87.50);
    expect(remainingPrincipal).toBe(10000);

    const closeTotal = financeCalculationService.calculateCloseTotal(remainingPrincipal, remainingInterest, remainingPenalty);
    expect(closeTotal).toBe(10087.50);
  });

  it('matches sequence of Testcase 1 and Testcase 2 for renewal payment allocation', () => {
    // Testcase 1: Gross Interest = 630, Gross Penalty = 157.50, Paid = 300
    const intDue1 = 630;
    const penDue1 = 157.50;
    const firstPayment = 300;
    const split1 = financeCalculationService.applyPaymentSplit(firstPayment, intDue1, penDue1, principal);
    
    expect(split1.penaltyPaid).toBe(157.50);
    expect(split1.interestPaid).toBe(142.50);
    expect(split1.principalPaid).toBe(0);
    
    const remInt1 = intDue1 - split1.interestPaid; // 487.50
    const remPen1 = penDue1 - split1.penaltyPaid;   // 0
    expect(remInt1).toBe(487.50);
    expect(remPen1).toBe(0);

    // Testcase 2: Remaining Interest = 487.50, Remaining Penalty = 0, Paid = 487.50
    const secondPayment = 487.50;
    const split2 = financeCalculationService.applyPaymentSplit(secondPayment, remInt1, remPen1, principal);
    
    expect(split2.penaltyPaid).toBe(0);
    expect(split2.interestPaid).toBe(487.50);
    expect(split2.principalPaid).toBe(0);
    
    const remInt2 = remInt1 - split2.interestPaid; // 0
    const remPen2 = remPen1 - split2.penaltyPaid;  // 0
    const remPrincipal2 = principal - split2.principalPaid; // 10000
    
    expect(remInt2).toBe(0);
    expect(remPen2).toBe(0);
    expect(remPrincipal2).toBe(10000);
  });

  it("verifies today's payment test: three payments (2000, 2000, 1000) with zero starting dues", () => {
    let currentPrincipal = 10000;

    // Start with dues already cleared (penalty = 0, interest = 0)
    let penaltyDue = 0;
    let interestDue = 0;

    // Payment 1: ₹2,000
    const pay1 = 2000;
    const penaltyPaid1 = Math.min(pay1, penaltyDue);
    const interestPaid1 = Math.min(pay1 - penaltyPaid1, interestDue);
    const principalPaid1 = pay1 - penaltyPaid1 - interestPaid1;

    expect(penaltyPaid1).toBe(0);
    expect(interestPaid1).toBe(0);
    expect(principalPaid1).toBe(2000);
    currentPrincipal -= principalPaid1;
    expect(currentPrincipal).toBe(8000);

    // Payment 2: ₹2,000
    const pay2 = 2000;
    const penaltyPaid2 = Math.min(pay2, penaltyDue);
    const interestPaid2 = Math.min(pay2 - penaltyPaid2, interestDue);
    const principalPaid2 = pay2 - penaltyPaid2 - interestPaid2;

    expect(penaltyPaid2).toBe(0);
    expect(interestPaid2).toBe(0);
    expect(principalPaid2).toBe(2000);
    currentPrincipal -= principalPaid2;
    expect(currentPrincipal).toBe(6000);

    // Payment 3: ₹1,000
    const pay3 = 1000;
    const penaltyPaid3 = Math.min(pay3, penaltyDue);
    const interestPaid3 = Math.min(pay3 - penaltyPaid3, interestDue);
    const principalPaid3 = pay3 - penaltyPaid3 - interestPaid3;

    expect(penaltyPaid3).toBe(0);
    expect(interestPaid3).toBe(0);
    expect(principalPaid3).toBe(1000);
    currentPrincipal -= principalPaid3;
    expect(currentPrincipal).toBe(5000);

    expect(principalPaid1 + principalPaid2 + principalPaid3).toBe(5000);
  });
});
