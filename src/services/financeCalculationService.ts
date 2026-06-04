import { FinanceLedgerSetting } from '../lib/supabaseFinance';
import { financeLedgerSettingsService } from './financeLedgerSettingsService';

export const financeCalculationService = {
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
    if (overdueDays <= 0) return 0;
    return this.calculateSimpleInterest(principal, setting.overdue, overdueDays, setting.days_per_year);
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
  }
};
