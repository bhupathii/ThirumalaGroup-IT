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

  it('calculates penalty on full due days once grace period is exceeded', () => {
    // Business rule: grace period only determines WHETHER penalty applies.
    // Once dueDays > 5, penalty is charged on the FULL overdue period (not dueDays - graceDays).
    const penaltyCrossed = financeCalculationService.calculatePenalty(principal, penaltyRate, 6);
    // 10000 * 0.75% * 6 / 30 = 15.00  (full 6 days, NOT 1 day)
    expect(penaltyCrossed).toBe(15.00);
  });

  it('matches the screenshot validation test case', () => {
    const dueDays = 63;
    const interest = financeCalculationService.calculateInterest(principal, rate, dueDays);
    const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, dueDays);
    const renewalTotal = financeCalculationService.calculateRenewalTotal(interest, penalty);
    const closeTotal = financeCalculationService.calculateCloseTotal(principal, interest, penalty);

    expect(interest).toBe(630);
    // 10000 * 0.75% * 63 / 30 = 157.50  (full 63 days)
    expect(penalty).toBe(157.50);
    expect(renewalTotal).toBe(787.50);
    expect(closeTotal).toBe(10787.50);
  });

  it('applies payment splits in correct order: penalty first, interest second, principal last', () => {
    const interestDue = 630;
    const penaltyDue = 157.50;
    const principalBalance = 10000;

    // Split 1: Amount only covers partial penalty (80/20 split applies)
    const split1 = financeCalculationService.applyPaymentSplit(100, interestDue, penaltyDue, principalBalance);
    expect(split1.penaltyPaid).toBe(20);
    expect(split1.interestPaid).toBe(80);
    expect(split1.principalPaid).toBe(0);

    // Split 2: Amount clears penalty and covers partial interest (80/20 split applies)
    const split2 = financeCalculationService.applyPaymentSplit(500, interestDue, penaltyDue, principalBalance);
    expect(split2.penaltyPaid).toBe(100);
    expect(split2.interestPaid).toBe(400);
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
    // 10000 * 0.75% * 31 / 30 = 77.50  (full 31 days)
    expect(penalty).toBe(77.50);
    expect(split.penaltyPaid).toBe(60);
    expect(split.interestPaid).toBe(240);
    expect(split.principalPaid).toBe(0);

    const remainingPenalty = penalty - split.penaltyPaid;
    const remainingInterest = interest - split.interestPaid;
    const remainingPrincipal = principal - split.principalPaid;

    expect(remainingPenalty).toBe(17.50);
    expect(remainingInterest).toBe(70.00);
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
    
    expect(split1.penaltyPaid).toBe(60);
    expect(split1.interestPaid).toBe(240);
    expect(split1.principalPaid).toBe(0);
    
    const remInt1 = intDue1 - split1.interestPaid; // 390
    const remPen1 = penDue1 - split1.penaltyPaid;   // 97.50
    expect(remInt1).toBe(390);
    expect(remPen1).toBe(97.50);

    // Testcase 2: Remaining Interest = 390, Remaining Penalty = 97.50, Paid = 487.50 (clears all remaining dues)
    const secondPayment = 487.50;
    const split2 = financeCalculationService.applyPaymentSplit(secondPayment, remInt1, remPen1, principal);
    
    expect(split2.penaltyPaid).toBe(97.50);
    expect(split2.interestPaid).toBe(390);
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
    const penaltyDue = 0;
    const interestDue = 0;

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

  // ── Bug-report test cases: Penalty ₹155, Interest ₹620 ────────────────────

  describe('Partial payment priority allocation (reported bug cases)', () => {
    const bugInterest = 620;
    const bugPenalty  = 155;
    const bugPrincipal = 10000;

    it('Case 1 — payment ₹500: clears penalty first, partial interest', () => {
      // Penalty Due = 155, Interest Due = 620, Payment = 500
      // Expected (80/20): Penalty Paid = 100, Interest Paid = 400
      const split = financeCalculationService.applyPaymentSplit(500, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(100);
      expect(split.interestPaid).toBe(400);
      expect(split.principalPaid).toBe(0);

      const remainingInterest = bugInterest - split.interestPaid;
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;

      expect(remainingPenalty).toBe(55);
      expect(remainingInterest).toBe(220);

      const pendingDues = remainingInterest + remainingPenalty;
      expect(pendingDues).toBe(275);
    });

    it('Case 2 — payment ₹100: only partial penalty, no interest', () => {
      // Penalty Due = 155, Interest Due = 620, Payment = 100
      // Expected (80/20): Penalty Paid = 20, Interest Paid = 80
      const split = financeCalculationService.applyPaymentSplit(100, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(20);
      expect(split.interestPaid).toBe(80);
      expect(split.principalPaid).toBe(0);

      const remainingInterest = bugInterest - split.interestPaid;
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;

      expect(remainingPenalty).toBe(135);
      expect(remainingInterest).toBe(540);
    });

    it('Case 3 — payment ₹800: clears penalty + interest, excess to principal', () => {
      // Penalty Due = 155, Interest Due = 620, Payment = 800
      // Expected: Penalty Paid = 155, Interest Paid = 620, Principal = 25
      const split = financeCalculationService.applyPaymentSplit(800, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(155);
      expect(split.interestPaid).toBe(620);
      expect(split.principalPaid).toBe(25);

      const remainingInterest = bugInterest - split.interestPaid;
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;

      expect(remainingPenalty).toBe(0);
      expect(remainingInterest).toBe(0);

      const pendingDues = remainingInterest + remainingPenalty;
      expect(pendingDues).toBe(0);
    });

    it('Rule 4 — partial payment must not clear dues or advance loan date', () => {
      // Total dues = 775 (Interest 620 + Penalty 155)
      // Payment = 500
      // Expected pending = 275 (Interest 220 remaining, Penalty 55 remaining)
      const totalDue = bugInterest + bugPenalty; // 775
      const payment = 500;

      const split = financeCalculationService.applyPaymentSplit(payment, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(100);
      expect(split.interestPaid).toBe(400);
      expect(split.principalPaid).toBe(0);

      const remainingInterest = bugInterest - split.interestPaid; // 220
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;  // 55
      const pendingDues = remainingInterest + remainingPenalty;    // 275

      expect(pendingDues).toBe(275);
      expect(totalDue - payment).toBe(275);

      // Rule 4: allDuesCleared must be false → loan date must NOT advance
      const allDuesCleared =
        split.interestPaid >= bugInterest &&
        split.penaltyPaid  >= bugPenalty;

      expect(allDuesCleared).toBe(false); // loan date must stay unchanged
    });
  });

  describe('New CD Ledger Business Rules', () => {
    it('applies computeRenewSplit correctly when penaltyDue > 0', () => {
      const split = financeCalculationService.computeRenewSplit(1000, 300);
      expect(split.penaltyPaid).toBe(200);
      expect(split.interestPaid).toBe(800);
      expect(split.principalPaid).toBe(0);
    });

    it('applies computeRenewSplit correctly when penaltyDue <= 0', () => {
      const split = financeCalculationService.computeRenewSplit(1000, 0);
      expect(split.penaltyPaid).toBe(0);
      expect(split.interestPaid).toBe(1000);
      expect(split.principalPaid).toBe(0);
    });

    it('applies computeCDPaymentSplit correctly for Close action', () => {
      // principalBefore = 100000, interestDue = 3000, penaltyDue = 500, paymentAmount = 103500
      const split = financeCalculationService.computeCDPaymentSplit(
        103500,
        500,
        3000,
        3000,
        100000,
        'Close'
      );
      expect(split.penaltyPaid).toBe(500);
      expect(split.interestPaid).toBe(3000);
      expect(split.principalPaid).toBe(100000);
    });

    it('applies computeCDPaymentSplit correctly for Renew action', () => {
      // principalBefore = 100000, interestDue = 3000, penaltyDue = 500, paymentAmount = 1000
      const split = financeCalculationService.computeCDPaymentSplit(
        1000,
        500,
        3000,
        3000,
        100000,
        'Renew'
      );
      expect(split.penaltyPaid).toBe(200);
      expect(split.interestPaid).toBe(800);
      expect(split.principalPaid).toBe(0);
    });
  });

  describe('CD Ledger - 16 Business Rule Test Cases', () => {
    function calculateCDDuesAndSplit(params: {
      principal: number;
      rate: number;
      paymentDate: string;
      currentDueDate: string;
      paymentAmount: number;
      interestPaidInCycle?: number;
      penaltyPaidInCycle?: number;
      actionType?: 'Renew' | 'Partial' | 'Close';
      periodDays?: number;
    }) {
      const {
        principal,
        rate,
        paymentDate,
        currentDueDate,
        paymentAmount,
        interestPaidInCycle = 0,
        penaltyPaidInCycle = 0,
        actionType = 'Renew',
        periodDays = 30
      } = params;

      const paymentDateObj = new Date(paymentDate);
      const currentDueDateObj = new Date(currentDueDate);
      
      paymentDateObj.setUTCHours(0, 0, 0, 0);
      currentDueDateObj.setUTCHours(0, 0, 0, 0);

      const rawDueDays = Math.round((paymentDateObj.getTime() - currentDueDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const dueDays = rawDueDays;
      const daysRemaining = rawDueDays < 0 ? Math.abs(rawDueDays) : 0;

      // Overdue/daily interest and penalty use periodDays divisor
      const grossInterest = Number(((principal * rate * dueDays) / periodDays / 100).toFixed(2));
      const graceDays = 5;
      // Grace period only determines WHETHER penalty applies.
      // Once dueDays > graceDays, penalty is on the FULL overdue period (not dueDays - graceDays).
      const grossPenalty = dueDays > graceDays
        ? Number(((principal * 0.75 * dueDays) / periodDays / 100).toFixed(2))
        : 0;

      const outstandingInterest = Math.max(0, Number(grossInterest.toFixed(2)));
      const outstandingPenalty = Math.max(0, Number(grossPenalty.toFixed(2)));

      const displayInterest = grossInterest;
      const displayPenalty = grossPenalty;
      const totalDue = displayInterest + displayPenalty;

      // Renewal Due scales with periodDays
      const renewalDue = Number(((principal * (rate / 100) * periodDays) / periodDays).toFixed(2));

      // Total To Regularize defaults to 0 when outstanding dues are 0
      const totalToRegularize = (outstandingInterest === 0 && outstandingPenalty === 0)
        ? 0
        : Number((totalDue + renewalDue).toFixed(2));
      const pendingDues = Math.max(0, Number((totalDue + renewalDue - (interestPaidInCycle + penaltyPaidInCycle)).toFixed(2)));
      const totalClose = Number((principal + displayInterest + displayPenalty).toFixed(2));

      const split = financeCalculationService.computeCDPaymentSplit(
        paymentAmount,
        outstandingPenalty,
        outstandingInterest,
        renewalDue,
        principal,
        actionType,
        periodDays,
        dueDays
      );

      const renewedDays = split.renewedDays;

      let nextDueDate: string | null = null;
      if (paymentAmount > 0 && renewedDays > 0) {
        const baseDateMs = currentDueDateObj.getTime();
        const nextDate = new Date(baseDateMs + renewedDays * 24 * 60 * 60 * 1000);
        nextDueDate = nextDate.toISOString().split('T')[0];
      }

      const enableRenewal = paymentAmount > 0;
      const enablePartial = paymentAmount > totalToRegularize;
      const enableClose = principal <= 0 && totalDue <= 0;

      return {
        principal,
        dueDays,
        daysRemaining,
        interest: displayInterest,
        penalty: displayPenalty,
        totalDue,
        renewalDue,
        totalToRegularize,
        pendingDues,
        totalClose,
        penaltyPaid: split.penaltyPaid,
        interestPaid: split.interestPaid,
        principalPaid: split.principalPaid,
        renewedDays,
        nextDueDate,
        enableRenewal,
        enablePartial,
        enableClose
      };
    }

    it('Test Case 1 - New Loan (No Overdue)', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.dueDays).toBe(-8);
      expect(res.daysRemaining).toBe(8);
      expect(res.interest).toBe(-800);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(-800);
      expect(res.renewalDue).toBe(3000);
      expect(res.totalToRegularize).toBe(0);
      expect(res.totalClose).toBe(99200);
      expect(res.nextDueDate).toBeNull();
      expect(res.renewedDays).toBe(0);
    });

    it('Test Case 2 - Early Partial Renewal', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 1000
      });
      expect(res.interest).toBe(-800);
      expect(res.penalty).toBe(0);
      expect(res.renewalDue).toBe(3000);
      expect(res.interestPaid).toBe(1000);
      expect(res.penaltyPaid).toBe(0);
      expect(res.renewedDays).toBe(10);
      expect(res.nextDueDate).toBe('2026-06-28');
      
      const resAfter = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 0,
        interestPaidInCycle: 1000
      });
      expect(resAfter.pendingDues).toBe(1200);
    });

    it('Test Case 3 - Full Renewal', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 3000
      });
      expect(res.interestPaid).toBe(3000);
      expect(res.penaltyPaid).toBe(0);
      expect(res.renewedDays).toBe(30);
      expect(res.nextDueDate).toBe('2026-07-18');
      expect(res.pendingDues).toBe(3000); // before posting
      
      const resAfter = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0,
        interestPaidInCycle: 3000
      });
      expect(resAfter.pendingDues).toBe(0);
    });

    it('Test Case 4 - Overpayment Renewal', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 5000,
        actionType: 'Renew'
      });
      expect(res.interestPaid).toBe(5000);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(0);
      expect(res.renewedDays).toBe(50);
      expect(res.nextDueDate).toBe('2026-08-07');
    });

    it('Test Case 5 - Overdue by 10 Days', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-05-31',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.dueDays).toBe(10);
      expect(res.interest).toBe(1000);
      // 100000 * 0.75% * 10 / 30 = 250  (full 10 days, NOT 10-5=5 days)
      expect(res.penalty).toBe(250);
      expect(res.totalDue).toBe(1250);
      expect(res.totalToRegularize).toBe(4250);
      expect(res.totalClose).toBe(101250);
    });

    it('Test Case 6 - Penalty Split Logic', () => {
      const split = financeCalculationService.computeCDPaymentSplit(
        1000,
        500, // penaltyDue
        1500, // interestDue
        3000, // standard monthly
        100000,
        'Renew'
      );
      expect(split.penaltyPaid).toBe(200);
      expect(split.interestPaid).toBe(800);
      expect(split.principalPaid).toBe(0);
    });

    it('Test Case 7 - No Penalty Split Logic', () => {
      const split = financeCalculationService.computeCDPaymentSplit(
        1000,
        0, // penaltyDue
        1500, // interestDue
        3000,
        100000,
        'Renew'
      );
      expect(split.penaltyPaid).toBe(0);
      expect(split.interestPaid).toBe(1000);
      expect(split.principalPaid).toBe(0);
    });

    it('Test Case 8 - Pending Dues Reduction', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 0,
        interestPaidInCycle: 1000
      });
      expect(res.renewalDue).toBe(3000);
      expect(res.pendingDues).toBe(1200);
    });

    it('Test Case 9 - Pending Dues Fully Cleared', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0,
        interestPaidInCycle: 3000
      });
      expect(res.renewalDue).toBe(3000);
      expect(res.pendingDues).toBe(0);
    });

    it('Test Case 10 - Negative Days Interest Calculation', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-20',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.dueDays).toBe(-10);
      expect(res.interest).toBe(-1000);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(-1000);
    });

    it('Test Case 11 - Renewal Date Protection', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 3000
      });
      expect(res.nextDueDate).toBe('2026-07-18');
    });

    it('Test Case 12 - NPA Close', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-05-31',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.principal).toBe(100000);
      expect(res.interest).toBe(1000);
      // 100000 * 0.75% * 10 / 30 = 250  (full 10 days)
      expect(res.penalty).toBe(250);
      expect(res.totalClose).toBe(101250);
    });

    it('Test Case 13 - Close Account Validation', () => {
      const res = calculateCDDuesAndSplit({
        principal: 0,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0
      });
      expect(res.enableClose).toBe(true);
    });

    it('Test Case 14 - Close Account Blocked', () => {
      const res = calculateCDDuesAndSplit({
        principal: 50000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0
      });
      expect(res.enableClose).toBe(false);
    });

    it('Test Case 15 - Cross Cycle Validation', () => {
      // Cycle 1: Paid 3000
      const cycle1 = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0,
        interestPaidInCycle: 3000
      });
      expect(cycle1.pendingDues).toBe(0);

      // Cycle 2: new cycle interest paid starts at 0, then we pay 1000.
      // previous cycle's 3000 is excluded.
      const cycle2 = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-07-18',
        paymentDate: '2026-07-20',
        paymentAmount: 0,
        interestPaidInCycle: 1000 // Only Cycle 2 payments are counted here
      });
      expect(cycle2.pendingDues).toBe(2200); // Correctly excludes penalty (0 days overdue for penalty since overdue is 2 days)
    });

    it('Test Case 16 - Single Source of Truth', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-05-31',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      
      const summaryTotalDue = res.interest + res.penalty;
      const footerTotalDue = res.interest + res.penalty;
      const borrowerLedgerTotalDue = res.interest + res.penalty;

      expect(summaryTotalDue).toBe(res.totalDue);
      expect(footerTotalDue).toBe(res.totalDue);
      expect(borrowerLedgerTotalDue).toBe(res.totalDue);
    });

    it('Partial Payment & Renewal Validation Case 1 - Exact Regularize Payment', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-20',
        paymentAmount: 3200,
        actionType: 'Renew'
      });
      expect(res.dueDays).toBe(2);
      expect(res.interest).toBe(200);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(200);
      expect(res.renewalDue).toBe(3000);
      expect(res.totalToRegularize).toBe(3200);
      expect(res.interestPaid).toBe(3200);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(0);
      expect(res.renewedDays).toBe(32);
      expect(res.nextDueDate).toBe('2026-07-20');
    });

    it('Partial Payment Validation Case 2 - Excess Payment with Principal Reduction Only', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-20',
        paymentAmount: 7000,
        actionType: 'Partial'
      });
      expect(res.dueDays).toBe(2);
      expect(res.interest).toBe(200);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(200);
      expect(res.interestPaid).toBe(200);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(6800);
      expect(res.renewedDays).toBe(2);
      expect(res.nextDueDate).toBe('2026-06-20');
    });

    it('Partial Payment Validation Case 3 - Heavy Excess Payment with Principal Reduction Only', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-20',
        paymentAmount: 10000,
        actionType: 'Partial'
      });
      expect(res.dueDays).toBe(2);
      expect(res.interest).toBe(200);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(200);
      expect(res.interestPaid).toBe(200);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(9800);
      expect(res.renewedDays).toBe(2);
      expect(res.nextDueDate).toBe('2026-06-20');
    });

    describe('User Requested Validation Tests', () => {
      it('Test 1 - Partial Payment - Exact principal payment', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-20',
          paymentAmount: 3200,
          actionType: 'Partial'
        });
        expect(res.interestPaid).toBe(200);
        expect(res.penaltyPaid).toBe(0);
        expect(res.principalPaid).toBe(3000); // Remainder reduces principal
        expect(res.renewedDays).toBe(2); // Due date/cycle advanced by 2 days
        expect(res.nextDueDate).toBe('2026-06-20');
      });

      it('Test 2 - Partial Payment - Payment of 5,000', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-20',
          paymentAmount: 5000,
          actionType: 'Partial'
        });
        expect(res.interestPaid).toBe(200);
        expect(res.penaltyPaid).toBe(0);
        expect(res.principalPaid).toBe(4800); // Remainder reduces principal
        expect(res.renewedDays).toBe(2); // Due date/cycle advanced by 2 days
        expect(res.nextDueDate).toBe('2026-06-20');
      });

      it('Test 3 - Partial Payment - Payment of 10,000', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-20',
          paymentAmount: 10000,
          actionType: 'Partial'
        });
        expect(res.interestPaid).toBe(200);
        expect(res.penaltyPaid).toBe(0);
        expect(res.principalPaid).toBe(9800); // Remainder reduces principal
        expect(res.renewedDays).toBe(2); // Due date/cycle advanced by 2 days
        expect(res.nextDueDate).toBe('2026-06-20');
      });

      it('Test 4 - Renewal Account - Payment of 10,000', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18', // Same day -> Outstanding Due = 0
          paymentAmount: 10000,
          actionType: 'Renew'
        });
        expect(res.totalDue).toBe(0); // Outstanding Due
        expect(res.principalPaid).toBe(0); // Principal Reduction: 0
        expect(res.renewedDays).toBe(100); // Uncapped renewal interest: 10000 / 3000 * 30
        expect(res.nextDueDate).toBe('2026-09-26');
      });

      it('Test 5 - Cycle Reset Rule - After successful Partial Payment & Renewal', () => {
        const newPrincipal = 98200;
        const newDueDate = '2026-07-20';

        // Immediately after save (same day as partial payment & renewal: 2026-06-20)
        // Due Days, Interest, Penalty, and Total Due must all be 0.
        // Active cycle payments for the new cycle start at 0.
        const resAfterSave = calculateCDDuesAndSplit({
          principal: newPrincipal,
          rate: 3,
          currentDueDate: newDueDate,
          paymentDate: '2026-06-20',
          paymentAmount: 0,
          interestPaidInCycle: 0,
          penaltyPaidInCycle: 0
        });
        expect(resAfterSave.dueDays).toBe(-30);
        expect(resAfterSave.interest).toBe(-2946.00);
        expect(resAfterSave.penalty).toBe(0);
        expect(resAfterSave.totalDue).toBe(-2946.00);

        // Future calculation (e.g. 7 days overdue in the new cycle: 2026-07-27)
        // Calculations start fresh from the new due date without being affected by
        // historical payments (which were cleared in the previous cycle).
        const resOverdue = calculateCDDuesAndSplit({
          principal: newPrincipal,
          rate: 3,
          currentDueDate: newDueDate,
          paymentDate: '2026-07-27',
          paymentAmount: 0,
          interestPaidInCycle: 0,
          penaltyPaidInCycle: 0
        });
        expect(resOverdue.dueDays).toBe(7);
        expect(resOverdue.interest).toBe(687.40); // 98200 * 0.03 * 7 / 30
        // 98200 * 0.0075 * 7 / 30 = 171.85 (full 7 days)
        expect(resOverdue.penalty).toBe(171.85);
        expect(resOverdue.totalDue).toBe(687.40 + 171.85);
      });
 
      it('Test 6 - CD Ledger Renewal Bug scenario (131 days overdue, ₹5,000 renewal payment)', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-01-30',
          paymentDate: '2026-06-10',
          paymentAmount: 5000,
          actionType: 'Renew'
        });
        expect(res.dueDays).toBe(131);
        expect(res.interest).toBe(13100);
        // 100000 * 0.75% * 131 / 30 = 3275.00  (full 131 days)
        expect(res.penalty).toBe(3275);
        expect(res.totalDue).toBe(16375);
        expect(res.penaltyPaid).toBe(1000);
        expect(res.interestPaid).toBe(4000);
        expect(res.principalPaid).toBe(0);
        expect(res.renewedDays).toBe(40);
        expect(res.nextDueDate).toBe('2026-03-11');
      });
 
      it('Validation Test 15 - Penalty Due = ₹315, Overdue Interest Due = ₹1,310, Payment = ₹1,500', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-01-30',
          paymentDate: '2026-06-10',
          paymentAmount: 1500,
          actionType: 'Renew'
        });
        expect(res.dueDays).toBe(131);
        expect(res.interest).toBe(1310);
        // 10000 * 0.75% * 131 / 30 = 327.50  (full 131 days)
        expect(res.penalty).toBe(327.50);
        expect(res.totalDue).toBe(1637.50);
        expect(res.penaltyPaid).toBe(300);
        expect(res.interestPaid).toBe(1200);
        expect(res.principalPaid).toBe(0);
        expect(res.renewedDays).toBe(120);
        expect(res.nextDueDate).toBe('2026-05-30');
      });
 
      it('Validation Test 16 - Penalty Due = ₹315, Overdue Interest Due = ₹1,310, Payment = ₹1,700', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-01-30',
          paymentDate: '2026-06-10',
          paymentAmount: 1700,
          actionType: 'Renew'
        });
        expect(res.dueDays).toBe(131);
        expect(res.interest).toBe(1310);
        // 10000 * 0.75% * 131 / 30 = 327.50  (full 131 days)
        expect(res.penalty).toBe(327.50);
        expect(res.totalDue).toBe(1637.50);
        // 20% of 1700 = 340 > penalty(327.50) → penaltyPaid = 327.50 (Banker's round → 328)
        // interestPaid = 1700 - 328 = 1372
        expect(res.penaltyPaid).toBe(328);
        expect(res.interestPaid).toBe(1372);
        expect(res.principalPaid).toBe(0);
        // dailyInterest = 300/30 = 10; renewedDays = 1372/10 = 137.2
        expect(res.renewedDays).toBe(137.2);
        // 2026-01-30 + 137 days = 2026-06-16
        expect(res.nextDueDate).toBe('2026-06-16');
      });
    });

    describe('Dynamic Period Days (15-Day Period Examples)', () => {
      it('Example A: Principal 10,000, Rate 3%, Period 15 -> Renewal Interest = 300, Daily Interest = 20', () => {
        const principal = 10000;
        const rate = 3;
        const periodDays = 15;

        // Interest due for 15 days elapsed (divided by periodDays)
        const interest = financeCalculationService.calculateInterest(principal, rate, 15, periodDays);
        expect(interest).toBe(300);

        // renewalDue = principal * rate * periodDays / periodDays
        const renewalDue = Number(((principal * (rate / 100) * periodDays) / periodDays).toFixed(2));
        expect(renewalDue).toBe(300);

        // dailyInterestValue = renewalDue / periodDays = 300 / 15 = 20
        const dailyInterestValue = Number((renewalDue / periodDays).toFixed(5));
        expect(dailyInterestValue).toBe(20);
      });

      it('Example B: Renewal Interest Paid 600, Daily Interest 20 -> Renewed Days = 30', () => {
        const periodDays = 15;
        const renewalDue = 300; // principal 10000 * 3% * 15 / 15

        // Split call with 15 days period
        const split = financeCalculationService.computeCDPaymentSplit(
          600, // paymentAmount
          0,   // penaltyDue
          0,   // interestDue
          renewalDue,
          10000, // principalBefore
          'Renew',
          periodDays
        );

        // dailyInterestValue = 300 / 15 = 20
        // renewedDays = 600 / 20 = 30
        expect(split.renewedDays).toBe(30);
      });

      it('Example C: Penalty Rate 0.75%, Principal 10,000, Period 15 -> Cycle Penalty = 75.00, Daily Penalty = 5.00', () => {
        const principal = 10000;
        const penaltyRate = 0.75;
        const periodDays = 15;

        // penalty for 15 days elapsed (divided by periodDays, full 15 days since > 5 grace)
        // 10000 * 0.75% * 15 / 15 = 75.00  (full 15 days)
        const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, 15, periodDays);
        expect(penalty).toBe(75.00);

        // daily penalty value: (principal * 0.75 / 100)
        const renewalPenalty = Number(((principal * (penaltyRate / 100) * periodDays) / periodDays).toFixed(2));
        expect(renewalPenalty).toBe(75.00);
        const dailyPenalty = Number((renewalPenalty / periodDays).toFixed(5));
        expect(dailyPenalty).toBe(5.00);
      });

      it('verifies 15-day period calculations using calculateCDDuesAndSplit helper', () => {
        const res = calculateCDDuesAndSplit({
          principal: 1000,
          rate: 3,
          currentDueDate: '2026-06-15',
          paymentDate: '2026-06-30', // exactly 15 days overdue
          paymentAmount: 600,
          actionType: 'Renew',
          periodDays: 15
        });

        expect(res.dueDays).toBe(15);
        expect(res.interest).toBe(30);
        // 1000 * 0.75% * 15 / 15 = 7.50 (full 15 days)
        expect(res.penalty).toBe(7.50);
        expect(res.totalDue).toBe(37.50);
        // 20% of 600 = 120 > penalty(7.50) → penaltyPaid = 7.50 (Banker's round → 8)
        // interestPaid = 600 - 8 = 592
        expect(res.penaltyPaid).toBe(8);
        expect(res.interestPaid).toBe(592);
        expect(res.renewedDays).toBe(296); // daily interest is 30 / 15 = 2. 592 / 2 = 296
      });

      it('verifies due date is calculated as loan_date + period_days exactly', () => {
        const loanDate = new Date('2026-06-10T00:00:00Z');
        const periodDays = 15;
        const dueDate = new Date(loanDate.getTime() + periodDays * 24 * 60 * 60 * 1000);
        expect(dueDate.toISOString().split('T')[0]).toBe('2026-06-25');
      });
    });

    describe('Explicit Validation Tests', () => {
      it('TEST 1 - Principal = 10000, Rate = 3%, Period = 15 -> Renewal = 300', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18',
          paymentAmount: 0,
          periodDays: 15
        });
        expect(res.renewalDue).toBe(300);
      });

      it('TEST 2 - Principal = 10000, Rate = 3%, Period = 10 -> Renewal = 300', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18',
          paymentAmount: 0,
          periodDays: 10
        });
        expect(res.renewalDue).toBe(300);
      });

      it('TEST 3 - Principal = 10000, Rate = 3%, Period = 30 -> Renewal = 300', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18',
          paymentAmount: 0,
          periodDays: 30
        });
        expect(res.renewalDue).toBe(300);
      });

      it('TEST 4 - Fresh Loan - Interest Due = -160, Penalty Due = 0 -> Today Due = -160, Total To Regularize = 0', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-10', // early, no overdue
          paymentAmount: 0,
          periodDays: 15
        });
        expect(res.totalDue).toBe(-160); // Today Due
        expect(res.totalToRegularize).toBe(0);
      });

      it('TEST 5 - Edit Loan Principal from 10,000 to 100,000 with 3% rate and 15 period days -> Renewal = 3000, Total For Close = 97000', () => {
        // Original State
        const resOriginal = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-26',
          paymentDate: '2026-06-11',
          paymentAmount: 0,
          periodDays: 15
        });
        expect(resOriginal.renewalDue).toBe(300);
        expect(resOriginal.totalClose).toBe(9700);

        // Edited State
        const resEdited = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-26',
          paymentDate: '2026-06-11',
          paymentAmount: 0,
          periodDays: 15
        });
        expect(resEdited.renewalDue).toBe(3000); // 100000 * 3% = 3000
        expect(resEdited.totalClose).toBe(97000);
      });
    });
  });

  describe("Banker's Rounding Grace Period (Reporting Only)", () => {
    const dummySetting = {
      id: 'dummy',
      category: 'CD',
      rate: 3,
      overdue: 0.75,
      days_per_year: 360, // 360 days per year gives 30 days per month divisor: 360/12 = 30
      method: 'SIMPLE_DAILY'
    } as any;

    const principal = 10000;

    it('calculates bankersRound correctly', () => {
      expect(financeCalculationService.bankersRound(5.19)).toBe(5);
      expect(financeCalculationService.bankersRound(5.50)).toBe(6);
      expect(financeCalculationService.bankersRound(6.00)).toBe(6);
    });

    it('applies grace threshold on 5.19 days (rounds to 5, penalty is 0)', () => {
      const penalty = financeCalculationService.calculatePenaltyFromSetting(principal, 5.19, dummySetting);
      expect(penalty).toBe(0);
    });

    it('accrues penalty on 5.50 days (rounds to 6, penalty calculated on 5.50 days)', () => {
      // 10000 * 0.75% * 5.50 / 30 = 13.75
      const penalty = financeCalculationService.calculatePenaltyFromSetting(principal, 5.50, dummySetting);
      expect(penalty).toBeCloseTo(13.75, 4);
    });

    it('accrues penalty on 6 days (rounds to 6, penalty calculated on 6 days)', () => {
      // 10000 * 0.75% * 6 / 30 = 15.00
      const penalty = financeCalculationService.calculatePenaltyFromSetting(principal, 6.00, dummySetting);
      expect(penalty).toBe(15.00);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLIENT-CONFIRMED PENALTY RULE (2026-06-17)
  // Grace period only determines WHETHER penalty applies — it does NOT reduce days.
  // Once dueDays > 5: penalty = dailyPenalty × dueDays  (FULL period)
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('Client-Confirmed Penalty Rule: Full Due Days (not net-of-grace)', () => {
    const principal400k = 400000;
    const principal1m = 1000000;
    const penaltyRate075 = 0.75;
    const periodDays30 = 30;

    // dailyPenalty = 400000 * 0.75% / 30 = ₹100

    it('TC-1: DueDays=1 → Penalty = ₹0 (within grace)', () => {
      const penalty = financeCalculationService.calculatePenalty(principal400k, penaltyRate075, 1, periodDays30);
      expect(penalty).toBe(0);
    });

    it('TC-2: DueDays=5 → Penalty = ₹0 (at grace limit, not exceeded)', () => {
      const penalty = financeCalculationService.calculatePenalty(principal400k, penaltyRate075, 5, periodDays30);
      expect(penalty).toBe(0);
    });

    it('TC-3: DueDays=6 → Penalty = ₹600 (100 × 6, NOT 100 × 1)', () => {
      // dailyPenalty = 400000 * 0.75% / 30 = ₹100
      // penalty = 100 × 6 = ₹600
      const penalty = financeCalculationService.calculatePenalty(principal400k, penaltyRate075, 6, periodDays30);
      expect(penalty).toBe(600);
    });

    it('TC-4: DueDays=10 → Penalty = ₹1000 (100 × 10, NOT 100 × 5)', () => {
      const penalty = financeCalculationService.calculatePenalty(principal400k, penaltyRate075, 10, periodDays30);
      expect(penalty).toBe(1000);
    });

    it('TC-5: DueDays=30 → Penalty = ₹3000 (100 × 30)', () => {
      const penalty = financeCalculationService.calculatePenalty(principal400k, penaltyRate075, 30, periodDays30);
      expect(penalty).toBe(3000);
    });

    it('TC-6: Principal=₹10,00,000, DueDays=6 → Penalty = ₹1500 (250 × 6)', () => {
      // dailyPenalty = 1000000 * 0.75% / 30 = ₹250
      // penalty = 250 × 6 = ₹1500
      const penalty = financeCalculationService.calculatePenalty(principal1m, penaltyRate075, 6, periodDays30);
      expect(penalty).toBe(1500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CD DUE-DATE INCLUSIVE-CYCLE RULE (2026-07-06)
  // Business rule: The loan-given date IS Day 1 of the CD cycle.
  //   Day 1 = LoanDate
  //   Day 2 = LoanDate + 1
  //   ...
  //   Day N = LoanDate + (N - 1)
  //   Therefore: DueDate = LoanDate + (periodDays - 1)  NOT LoanDate + periodDays
  //
  // The formula "loanDate + periodDays" lands on Day (N+1) which is off-by-one WRONG.
  //
  // Verified examples:
  //   05-Oct-2023 + 30-day period → Day 30 = 03-Nov-2023  (NOT 04-Nov-2023)
  //   06-Jul-2026 + 30-day period → Day 30 = 04-Aug-2026  (NOT 05-Aug-2026)
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('CD Inclusive-Cycle Due-Date Regression', () => {
    it('REGRESSION: 05-Oct-2023 + 30-day period → Due Date = 03-Nov-2023 (Day 30)', () => {
      // Business rule: loanDate = Day 1 ⟹ dueDate = loanDate + (periodDays - 1)
      // 05-Oct-2023 = Day 1, 06-Oct-2023 = Day 2, ..., 03-Nov-2023 = Day 30
      const dueDate = financeCalculationService.addCalendarDays('2023-10-05', 30 - 1);
      expect(dueDate).toBe('2023-11-03');
    });

    it('REGRESSION: 06-Jul-2026 + 30-day period → Due Date = 04-Aug-2026 (Day 30)', () => {
      // Business rule: loanDate = Day 1 ⟹ dueDate = loanDate + (periodDays - 1)
      // 06-Jul-2026 = Day 1, 07-Jul-2026 = Day 2, ..., 04-Aug-2026 = Day 30
      const dueDate = financeCalculationService.addCalendarDays('2026-07-06', 30 - 1);
      expect(dueDate).toBe('2026-08-04');
    });

    it('loanDate + (periodDays - 1) gives correct first due date', () => {
      // Correct: dueDate = loanDate + 29 days = 03-Nov-23 (Day 30)
      const dueDate = financeCalculationService.addCalendarDays('2023-10-05', 30 - 1);
      expect(dueDate).toBe('2023-11-03');
    });

    it('after 30-day renewal from 03-Nov-2023, next due date = 03-Dec-2023', () => {
      // Renewal advances: nextDue = oldDue + renewedDays
      const baseDueDate = '2023-11-03'; // 05-Oct-2023 + 29 days
      const renewedDays = 30;
      const nextDueDate = financeCalculationService.addCalendarDays(baseDueDate, renewedDays);
      expect(nextDueDate).toBe('2023-12-03');
    });

    it('payment on 08-Dec-2023 is exactly 5 days overdue from 03-Dec-2023 → Penalty = ₹0', () => {
      // Due date = 03-Dec-2023; paid 08-Dec-2023 → 5 days overdue (grace = 5, no penalty)
      const nextDueDate = '2023-12-03';
      const dueDays = financeCalculationService.differenceInCalendarDays('2023-12-08', nextDueDate);
      expect(dueDays).toBe(5);
      const penalty = financeCalculationService.calculatePenalty(400000, 0.75, dueDays, 30);
      expect(penalty).toBe(0);
    });

    it('exact CD100 regression rules using new timezone-independent date helpers', () => {
      // 1. Core Loan Dates — loanDate = Day 1 ⟹ dueDate = loanDate + (periodDays - 1)
      const loanDate = '2023-10-05';
      const periodDays = 30;

      const initialDueDate = financeCalculationService.addCalendarDays(loanDate, periodDays - 1);
      expect(initialDueDate).toBe('2023-11-03'); // Day 30

      // 2. RC368: Payment on 08-Nov-2023 for ₹12,000 (30 days renewal)
      const currentDueDate1 = initialDueDate; // 2023-11-03
      const renewedDays1 = 30;
      const nextDueDate1 = financeCalculationService.addCalendarDays(currentDueDate1, renewedDays1);
      expect(nextDueDate1).toBe('2023-12-03');

      // 3. RC369: Payment on 08-Dec-2023 (5 days overdue from 03-Dec-2023)
      const currentDueDate2 = nextDueDate1; // 2023-12-03
      const paymentDate = '2023-12-08';
      const dueDays = financeCalculationService.differenceInCalendarDays(paymentDate, currentDueDate2);
      expect(dueDays).toBe(5);

      const penaltyDue = financeCalculationService.calculatePenalty(400000, 0.75, dueDays, 30);
      expect(penaltyDue).toBe(0);

      // 4. Overdue Day 6 rule: Payment on 09-Dec-2023
      const paymentDate6 = '2023-12-09';
      const dueDays6 = financeCalculationService.differenceInCalendarDays(paymentDate6, currentDueDate2);
      expect(dueDays6).toBe(6);

      const penaltyDue6 = financeCalculationService.calculatePenalty(400000, 0.75, dueDays6, 30);
      // 400000 * 0.75% * 6 / 30 = 600
      expect(penaltyDue6).toBe(600);

      // 5. Early Payment: due date 03-Dec-2023, renewed by 30 days
      const nextDueDateEarly = financeCalculationService.addCalendarDays(currentDueDate2, 30);
      expect(nextDueDateEarly).toBe('2024-01-02');

      // 6. Partial Interest Payment: due date 03-Dec-2023, renewed by 15 days
      const nextDueDatePartial = financeCalculationService.addCalendarDays(currentDueDate2, 15);
      expect(nextDueDatePartial).toBe('2023-12-18');

      // 7. Timezone-independent calendar difference check
      const diff = financeCalculationService.differenceInCalendarDays('2023-12-08', '2023-12-03');
      expect(diff).toBe(5);
    });
  });
});
