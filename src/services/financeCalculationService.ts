import { FinanceLedgerSetting } from '../lib/supabaseFinance';
import { financeLedgerSettingsService } from './financeLedgerSettingsService';

export const financeCalculationService = {
  parseDateParts(d: string | Date | number): { year: number; month: number; day: number } {
    if (d instanceof Date) {
      const isUTCMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
      if (isUTCMidnight) {
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate()
        };
      } else {
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate()
        };
      }
    }
    if (typeof d === 'number') {
      const date = new Date(d);
      const isUTCMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
      if (isUTCMidnight) {
        return {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate()
        };
      } else {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        };
      }
    }
    if (typeof d === 'string') {
      const isoPart = d.split('T')[0];
      const parts = isoPart.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
          return { year: y, month: m, day };
        }
      }
      const date = new Date(d);
      const isUTCMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
      if (isUTCMidnight) {
        return {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate()
        };
      } else {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        };
      }
    }
    const date = new Date();
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  },

  getCalendarMidnightUTC(d: string | Date | number): number {
    const { year, month, day } = this.parseDateParts(d);
    return Date.UTC(year, month - 1, day);
  },

  differenceInCalendarDays(d1: string | Date | number, d2: string | Date | number): number {
    const utc1 = this.getCalendarMidnightUTC(d1);
    const utc2 = this.getCalendarMidnightUTC(d2);
    return Math.round((utc1 - utc2) / (24 * 60 * 60 * 1000));
  },

  addCalendarDays(d: string | Date | number, days: number): string {
    const { year, month, day } = this.parseDateParts(d);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  calculateDailyInterest(principal: number, rate: number): number {
    return (principal * (rate / 100)) / 30;
  },

  calculateExactRenewedDays(interestAmount: number, principal: number, rate: number): number {
    const dailyInterest = this.calculateDailyInterest(principal, rate);
    return dailyInterest > 0 ? Number((interestAmount / dailyInterest).toFixed(2)) : 0;
  },

  calculateDisplayDays(exactDays: number): number {
    const floor = Math.floor(exactDays);
    const frac = exactDays - floor;
    if (Number(frac.toFixed(4)) >= 0.5) {
      return floor + 1;
    }
    return floor;
  },

  advanceExactRenewalPosition(currentExactPosition: number, exactDaysAdded: number): number {
    return Number((currentExactPosition + exactDaysAdded).toFixed(2));
  },

  formatRenewedDaysDescription(exactDays: number): string {
    const rounded = Number(exactDays.toFixed(2));
    return `${rounded}-Days Renewed`;
  },

  /**
   * Banker's Rounding (round-half-to-even) to whole rupees.
   * Matches MS Access VBA Int() / Round() behaviour for CD ledger entries.
   * Always use this before writing penalty, interest, or principal credits to the DB.
   */
  roundRupee(value: number): number {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exactly 0.5 — round to nearest even (Banker's Rounding)
    return floor % 2 === 0 ? floor : floor + 1;
  },

  /**
   * Access-style integer rounding (Banker's rounding / Round(value,0))
   * specifically used for day counts and non-rupee values.
   */
  bankersRound(value: number): number {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exactly 0.5 — round to nearest even (Banker's Rounding)
    return floor % 2 === 0 ? floor : floor + 1;
  },

  /**
   * Calculates simple interest given a principal, rate per month, and days elapsed.
   */
  calculateSimpleInterest(principal: number, ratePerMonth: number, daysElapsed: number, daysPerYear: number = 365): number {
    // If rate is per month, then annual rate is ratePerMonth * 12
    // Daily rate is (ratePerMonth * 12) / daysPerYear
    // But traditionally in this system, it might just be calculated as (daysElapsed / 30)
    // Let's stick to the current formula used everywhere: principal * (rate/100) * (days/30)
    // But if we use daysPerYear, maybe: principal * (ratePerMonth * 12 / 100) * (daysElapsed / daysPerYear)
    // To remain backward compatible while adopting daysPerYear:
    return principal * (ratePerMonth / 100) * (daysElapsed / (daysPerYear / 12));
  },

  /**
   * Calculates flat EMI interest.
   */
  calculateFlatInterest(principal: number, ratePerMonth: number, durationMonths: number): number {
    return principal * (ratePerMonth / 100) * durationMonths;
  },

  /**
   * Dynamic calculate interest wrapper based on setting method
   */
  calculateInterestFromSetting(
    principal: number, 
    durationDays: number, 
    setting: FinanceLedgerSetting,
    durationMonthsFallback: number = 0
  ): number {
    switch (setting.method) {
      case 'FLAT_EMI':
        const months = durationMonthsFallback > 0 ? durationMonthsFallback : (durationDays / (setting.days_per_year / 12));
        return this.calculateFlatInterest(principal, setting.rate, months);
      case 'COMPOUND_MONTHLY':
        // A placeholder for compound monthly if needed. Currently falls back to simple in most modules.
        // P(1 + r/100)^n - P
        const n = durationMonthsFallback > 0 ? durationMonthsFallback : Math.floor(durationDays / (setting.days_per_year / 12));
        return (principal * Math.pow(1 + setting.rate / 100, n)) - principal;
      case 'SIMPLE_DAILY':
      default:
        return this.calculateSimpleInterest(principal, setting.rate, durationDays, setting.days_per_year);
    }
  },

  /**
   * Calculates penalty (overdue) interest based on setting
   */
  calculatePenaltyFromSetting(principal: number, overdueDays: number, setting: FinanceLedgerSetting): number {
    const penaltyDays = this.bankersRound(overdueDays) <= 5 ? 0 : overdueDays;
    if (penaltyDays <= 0) return 0;
    return this.calculateSimpleInterest(principal, setting.overdue, penaltyDays, setting.days_per_year);
  },

  /**
   * Get settings and calculate standard interest for a given ledger type
   */
  async calculateStandardInterest(principal: number, durationDays: number, ledgerCode: string): Promise<number> {
    const setting = await financeLedgerSettingsService.getLedgerSettings(ledgerCode);
    return this.calculateInterestFromSetting(principal, durationDays, setting);
  },

  /**
   * Complete loan calculations used by ledgers (CD, HP, etc)
   */
  getLoanCalculations(selectedLoan: any, setting: FinanceLedgerSetting | null) {
    const principal = Number(selectedLoan.amount);
    const duration = Number(selectedLoan.duration_months);

    // Calculate Interest charge and total repayable balance
    const interestAmount = setting 
      ? this.calculateInterestFromSetting(principal, duration * 30, setting, duration) 
      : (principal * (Number(selectedLoan.interest_rate) / 100) * duration);
      
    const totalRepayable = principal + interestAmount;

    // Filter collection transactions
    const collections = (selectedLoan.transactions || []).filter((t: any) => t.type === 'Collection');
    const totalCredit = collections.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

    // Disbursements transactions
    const disbursements = (selectedLoan.transactions || []).filter((t: any) => t.type === 'Disbursement');
    const totalDebit = disbursements.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

    const currentBalance = Math.max(0, totalRepayable - totalCredit);

    // Installment/dues statistics
    const totalDues = (selectedLoan.dues || []).reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const paidDues = (selectedLoan.dues || []).reduce((sum: number, d: any) => sum + Number(d.paid_amount || 0), 0);
    const pendingDues = Math.max(0, totalDues - paidDues);

    // Compile transaction list with running balance
    let runningBalance = totalRepayable;
    const processedTransactions = (selectedLoan.transactions || []).map((tx: any) => {
      let credit = 0;
      let debit = 0;
      if (tx.type === 'Collection') {
        credit = Number(tx.amount);
        runningBalance = Math.max(0, runningBalance - credit);
      } else if (tx.type === 'Disbursement') {
        debit = Number(tx.amount);
      }
      return {
        ...tx,
        credit,
        debit,
        balance: runningBalance
      };
    });

    return {
      principal,
      interestAmount,
      totalRepayable,
      totalCredit,
      totalDebit,
      currentBalance,
      totalDues,
      paidDues,
      pendingDues,
      processedTransactions
    };
  },

  /**
   * CD Ledger Specific Calculations
   */
  calculateInterest(principal: number, rate: number, interestDays: number, periodDays: number = 30): number {
    // Overdue interest uses periodDays divisor as it is a daily accrual.
    return Number(((principal * (rate / 100) * interestDays) / periodDays).toFixed(2));
  },

  calculatePenalty(principal: number, penaltyRate: number, dueDays: number, periodDays: number = 30, graceDays: number = 5): number {
    if (dueDays > graceDays) {
      // Grace period only determines WHETHER penalty applies.
      // Once dueDays > graceDays, penalty is calculated on the FULL overdue period (not dueDays - graceDays).
      return Number(((principal * (penaltyRate / 100) * dueDays) / periodDays).toFixed(2));
    }
    return 0;
  },

  calculateRenewalTotal(interest: number, penalty: number): number {
    return Number((interest + penalty).toFixed(2));
  },

  calculateCloseTotal(principal: number, interest: number, penalty: number): number {
    return Number((principal + interest + penalty).toFixed(2));
  },

  computeRenewSplit(paymentAmount: number, penaltyDue: number) {
    let penaltyPaid = Number((paymentAmount * 0.20).toFixed(2));
    let interestPaid = Number((paymentAmount * 0.80).toFixed(2));
    
    if (penaltyPaid > penaltyDue) {
      penaltyPaid = penaltyDue;
      interestPaid = Number((paymentAmount - penaltyPaid).toFixed(2));
    }
    
    return {
      penaltyPaid,
      interestPaid,
      principalPaid: 0
    };
  },

  computeCDPaymentSplit(
    paymentAmount: number,
    penaltyDue: number,
    interestDue: number,
    renewalInterestDue: number,
    principal: number,
    actionType: string,
    periodDays: number = 30,
    dueDays: number = 0
  ) {
    const pAmt = Number(paymentAmount) || 0;
    const penDue = Number(penaltyDue) || 0;
    const intDue = Number(interestDue) || 0;
    const renDue = Number(renewalInterestDue) || 0;
    const prin = Number(principal) || 0;
    const days = Number(periodDays) || 30;

    const totalDues = penDue + intDue;
    const isClosing = actionType === 'Close' || pAmt >= (totalDues + prin);

    let penaltyPaid = 0;
    let interestPaid = 0;
    let principalPaid = 0;
    let renewedDays = 0;

    if (isClosing) {
      penaltyPaid = this.roundRupee(penDue);
      interestPaid = this.roundRupee(intDue);
      principalPaid = Number(Math.max(0, pAmt - penaltyPaid - interestPaid).toFixed(2));
      renewedDays = 0;
    } else if (pAmt >= totalDues && actionType === 'Partial') {
      // Partial payment that clears all outstanding dues
      penaltyPaid = this.roundRupee(penDue);
      interestPaid = this.roundRupee(intDue);
      principalPaid = Number(Math.max(0, pAmt - penaltyPaid - interestPaid).toFixed(2));
      renewedDays = dueDays; // next due date becomes the payment date
    } else {
      // Renewal or under-paying Partial payment: 80/20 bucket allocation
      // Buckets are rounded to nearest whole rupee using Banker's Rounding
      const penaltyBucket = this.roundRupee(pAmt * 0.20);
      const interestBucket = pAmt - penaltyBucket;

      if (penDue > 0) {
        if (penDue < penaltyBucket) {
          penaltyPaid = this.roundRupee(penDue);
          interestPaid = pAmt - penaltyPaid;
        } else {
          penaltyPaid = penaltyBucket;
          interestPaid = interestBucket;
        }
      } else {
        penaltyPaid = 0;
        interestPaid = pAmt;
      }
      principalPaid = 0;

      // dailyInterest = Principal * interestRate / 100 / 30
      const dailyInterestValue = renDue / days;
      const rate = prin > 0 ? (dailyInterestValue * 30 * 100) / prin : 0;
      renewedDays = this.calculateExactRenewedDays(interestPaid, prin, rate);
    }

    return {
      penaltyPaid,
      overdueInterestPaid: isClosing || (pAmt >= totalDues && actionType === 'Partial') ? interestPaid : 0,
      renewalInterestPaid: !(isClosing || (pAmt >= totalDues && actionType === 'Partial')) ? interestPaid : 0,
      interestPaid,
      principalPaid,
      renewedDays,
      remaining: 0
    };
  },

  calculateCDCloseAmount(principal: number, pendingInterest: number, pendingPenalty: number): number {
    return Number((principal + pendingInterest + pendingPenalty).toFixed(2));
  },

  calculateCDOutstandingDues(
    principal: number,
    originalLoanDateStr: string,
    periodDays: number,
    interestRate: number,
    penaltyRate: number,
    graceDays: number,
    totalRenewedDays: number,
    paymentDate: string
  ) {
    const dueDays = this.differenceInCalendarDays(paymentDate, this.addCalendarDays(originalLoanDateStr, periodDays - 1)) - totalRenewedDays;
    const rawDueDays = dueDays;
    let pendingInterest = 0;
    if (rawDueDays > 0) {
      pendingInterest = Number(((principal * interestRate * rawDueDays) / periodDays / 100).toFixed(2));
    }
    let penalty = 0;
    if (rawDueDays > graceDays) {
      penalty = Number(((principal * penaltyRate * rawDueDays) / periodDays / 100).toFixed(2));
    }
    const presentDue = Number((pendingInterest + penalty).toFixed(2));
    const closeAmount = Number((principal + presentDue).toFixed(2));
    return {
      dueDays: Math.max(0, rawDueDays),
      rawDueDays,
      pendingInterest,
      penalty,
      presentDue,
      closeAmount
    };
  },

  applyPaymentSplit(
    amountPaying: number,
    interestDue: number,
    penaltyDue: number,
    principalBalance: number
  ) {
    const total = amountPaying;
    const totalDues = penaltyDue + interestDue;
    let penaltyPaid = 0;
    let interestPaid = 0;
    let principalPaid = 0;
    let remaining = 0;

    if (total >= totalDues) {
      // Clears all dues; remainder goes to principal
      penaltyPaid = penaltyDue;
      interestPaid = interestDue;
      const afterDues = Number((total - totalDues).toFixed(2));
      principalPaid = Number(Math.min(afterDues, principalBalance).toFixed(2));
      remaining = Number((afterDues - principalPaid).toFixed(2));
    } else {
      // Business rule: 20% Penalty / 80% Interest
      if (penaltyDue > 0) {
        penaltyPaid = Number((total * 0.20).toFixed(2));
        interestPaid = Number((total * 0.80).toFixed(2));
        if (penaltyPaid > penaltyDue) {
          penaltyPaid = penaltyDue;
          interestPaid = Number((total - penaltyPaid).toFixed(2));
        }
      } else {
        interestPaid = total;
      }
      remaining = 0;
    }

    return {
      penaltyPaid: Number(penaltyPaid.toFixed(2)),
      interestPaid: Number(interestPaid.toFixed(2)),
      principalPaid: Number(principalPaid.toFixed(2)),
      remaining: Number(remaining.toFixed(2))
    };
  },

  /**
   * Calculates STBD penalty per installment.
   * Rate is 0.2% per day of delay on the entire monthly installment amount for each installment late by more than 6 days.
   */
  calculateSTBDPenalty(
    installmentAmount: number,
    ipaid: number,
    startDateStr: string | Date,
    currentDateStr: string | Date,
    payingInsts: number
  ): number {
    let penalty = 0;
    const startDate = new Date(startDateStr);
    const currentDate = new Date(currentDateStr);
    
    for (let i = 1; i <= payingInsts; i++) {
      const monthsToAdd = i + this.bankersRound(ipaid);
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + monthsToAdd);
      
      const diffTime = currentDate.getTime() - dueDate.getTime();
      const dueDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (dueDays > 6) {
        penalty += this.roundRupee(installmentAmount * 0.002 * dueDays);
      }
    }
    return penalty;
  },

  /**
   * Calculates HP penalty per installment.
   * Rate is 0.2% per day of delay on the entire monthly installment amount for each installment late by more than 5 days.
   */
  calculateHPPenalty(
    installmentAmount: number,
    ipaid: number,
    startDateStr: string | Date,
    currentDateStr: string | Date,
    payingInsts: number
  ): number {
    let penalty = 0;
    const startDate = new Date(startDateStr);
    const currentDate = new Date(currentDateStr);
    
    for (let i = 1; i <= payingInsts; i++) {
      const monthsToAdd = i + this.bankersRound(ipaid);
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + monthsToAdd);
      
      const diffTime = currentDate.getTime() - dueDate.getTime();
      const dueDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (dueDays > 5) {
        penalty += this.roundRupee(installmentAmount * 0.002 * dueDays);
      }
    }
    return penalty;
  },

  /**
   * Compute STBD payment split credit allocations.
   */
  computeSTBDPaymentSplit(
    principal: number,
    period: number,
    payingInsts: number,
    discount: number = 0,
    penaltyPaid: number = 0
  ) {
    const principalPaid = this.roundRupee((principal / period) * payingInsts);
    const commissionPaid = this.roundRupee((principal * 0.03) * payingInsts) - discount;
    
    return {
      principalPaid,
      commissionPaid,
      penaltyPaid
    };
  },

  /**
   * Compute HP payment split credit allocations.
   */
  computeHPPaymentSplit(
    principal: number,
    _period: number,
    payingInsts: number,
    installmentAmount: number,
    discount: number = 0,
    penaltyPaid: number = 0
  ) {
    const commissionPaid = this.roundRupee((principal * 0.02) * payingInsts) - discount;
    const principalPaid = this.roundRupee(installmentAmount * payingInsts) - commissionPaid;
    
    return {
      principalPaid,
      commissionPaid,
      penaltyPaid
    };
  },

  /**
   * Compute TBD payment split credit allocations.
   */
  computeTBDPaymentSplit(
    principal: number,
    _period: number,
    payingInsts: number,
    installmentAmount: number,
    discount: number = 0,
    penaltyPaid: number = 0
  ) {
    const commissionPaid = this.roundRupee((principal * 0.03) * payingInsts) - discount;
    const principalPaid = this.roundRupee(installmentAmount * payingInsts) - commissionPaid;
    
    return {
      principalPaid,
      commissionPaid,
      penaltyPaid
    };
  },

  calculateNextDueDate(paymentDate: string | Date | number, periodDays: number = 10): string {
    return this.addCalendarDays(paymentDate, periodDays);
  },

  getNextReceiptNumber(latestReceiptNo: string | null): string {
    if (!latestReceiptNo) {
      return 'RC001';
    }
    const match = latestReceiptNo.match(/RC(\d+)/i);
    if (!match) {
      return 'RC001';
    }
    const num = parseInt(match[1], 10);
    const nextNum = num + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `RC${padded}`;
  }
};

