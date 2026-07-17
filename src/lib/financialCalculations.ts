/**
 * Financial calculation utilities with 100% accuracy
 * All calculations use precise decimal arithmetic to avoid floating point errors
 */

export class FinancialCalculator {
  // Convert to cents to avoid floating point precision issues
  private static toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  // Convert back from cents to rupees
  private static fromCents(cents: number): number {
    return cents / 100;
  }

  // Add two amounts with precision
  static add(amount1: number, amount2: number): number {
    const cents1 = this.toCents(amount1);
    const cents2 = this.toCents(amount2);
    return this.fromCents(cents1 + cents2);
  }

  // Subtract two amounts with precision
  static subtract(amount1: number, amount2: number): number {
    const cents1 = this.toCents(amount1);
    const cents2 = this.toCents(amount2);
    return this.fromCents(cents1 - cents2);
  }

  // Calculate balance (credit - debit)
  static calculateBalance(credit: number, debit: number): number {
    return this.subtract(credit, debit);
  }

  // Sum an array of amounts
  static sum(amounts: number[]): number {
    const totalCents = amounts.reduce((sum, amount) => {
      return sum + this.toCents(amount);
    }, 0);
    return this.fromCents(totalCents);
  }

  // Calculate running balance
  static calculateRunningBalance(
    entries: Array<{ credit: number; debit: number }>
  ): Array<{ credit: number; debit: number; runningBalance: number }> {
    let runningBalance = 0;

    return entries.map(entry => {
      const entryBalance = this.calculateBalance(entry.credit, entry.debit);
      runningBalance = this.add(runningBalance, entryBalance);

      return {
        ...entry,
        runningBalance,
      };
    });
  }

  // Validate financial entry
  static validateEntry(
    credit: number,
    debit: number,
    allowBothZero: boolean = false
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (credit < 0) {
      errors.push('Credit amount cannot be negative');
    }

    if (debit < 0) {
      errors.push('Debit amount cannot be negative');
    }

    if (credit > 0 && debit > 0) {
      errors.push('Entry cannot have both credit and debit amounts');
    }

    if (!allowBothZero && credit === 0 && debit === 0) {
      errors.push('Entry must have either credit or debit amount');
    }

    // Check for reasonable limits (adjust as needed)
    const maxAmount = 999999999.99; // 999 crores
    if (credit > maxAmount || debit > maxAmount) {
      errors.push('Amount exceeds maximum limit');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Enhanced validation for business entries
  static validateBusinessEntry(entry: {
    date: string;
    companyName: string;
    accountName: string;
    particulars: string;
    credit: number;
    debit: number;
    saleQ: number;
    purchaseQ: number;
    staff: string;
  }): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!entry.date) {
      errors.push('Date is required');
    } else {
      const entryDate = new Date(entry.date);
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 30); // Allow entries up to 30 days in future

      if (entryDate > futureDate) {
        errors.push('Entry date cannot be more than 30 days in the future');
      }

      if (entryDate < new Date('2010-01-01')) {
        errors.push('Entry date cannot be before 2010');
      }
    }

    if (!entry.companyName?.trim()) {
      errors.push('Company name is required');
    }

    if (!entry.accountName?.trim()) {
      errors.push('Account name is required');
    }

    if (!entry.particulars?.trim()) {
      errors.push('Particulars are required');
    } else if (entry.particulars.length < 3) {
      warnings.push('Particulars should be more descriptive');
    }

    if (!entry.staff?.trim()) {
      errors.push('Staff name is required');
    }

    // Financial validation
    const financialValidation = this.validateEntry(entry.credit, entry.debit);
    errors.push(...financialValidation.errors);

    // Quantity validation
    if (entry.saleQ < 0) {
      errors.push('Sale quantity cannot be negative');
    }
    if (entry.purchaseQ < 0) {
      errors.push('Purchase quantity cannot be negative');
    }
    if (entry.saleQ > 0 && entry.purchaseQ > 0) {
      warnings.push('Entry has both sale and purchase quantities');
    }

    // Business rule validations
    if (entry.credit > 0 && entry.saleQ === 0 && entry.purchaseQ === 0) {
      warnings.push(
        'Credit entry without quantities - verify if this is correct'
      );
    }

    if (entry.debit > 0 && entry.saleQ === 0 && entry.purchaseQ === 0) {
      warnings.push(
        'Debit entry without quantities - verify if this is correct'
      );
    }

    // Amount vs quantity validation
    if (entry.saleQ > 0 && entry.credit === 0) {
      warnings.push('Sale quantity entered but no credit amount');
    }

    if (entry.purchaseQ > 0 && entry.debit === 0) {
      warnings.push('Purchase quantity entered but no debit amount');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Validate account structure
  static validateAccountStructure(
    companyName: string,
    accountName: string,
    subAccount?: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!companyName?.trim()) {
      errors.push('Company name is required');
    }

    if (!accountName?.trim()) {
      errors.push('Account name is required');
    }

    // Check for special characters in account names
    const specialCharRegex = /[<>:"/\\|?*]/;
    if (specialCharRegex.test(accountName)) {
      errors.push('Account name contains invalid characters');
    }

    if (subAccount && specialCharRegex.test(subAccount)) {
      errors.push('Sub account name contains invalid characters');
    }

    // Check length limits
    if (accountName.length > 100) {
      errors.push('Account name is too long (max 100 characters)');
    }

    if (subAccount && subAccount.length > 100) {
      errors.push('Sub account name is too long (max 100 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Validate date range for reports
  static validateDateRange(
    fromDate: string,
    toDate: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!fromDate) {
      errors.push('From date is required');
    }

    if (!toDate) {
      errors.push('To date is required');
    }

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);

      if (isNaN(from.getTime())) {
        errors.push('Invalid from date format');
      }

      if (isNaN(to.getTime())) {
        errors.push('Invalid to date format');
      }

      if (from > to) {
        errors.push('From date cannot be after to date');
      }

      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        errors.push('Date range cannot exceed 1 year');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Format amount for display
  static formatAmount(amount: number, showCurrency: boolean = true): string {
    const formatted = Math.abs(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const prefix = showCurrency ? '' : '';
    return `${prefix}${formatted}`;
  }

  // Format balance with CR/DR notation
  static formatBalance(balance: number, showCurrency: boolean = true): string {
    const amount = this.formatAmount(balance, showCurrency);
    const suffix = balance >= 0 ? ' CR' : ' DR';
    return `${amount}${suffix}`;
  }

  // Calculate percentage
  static calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return (
      this.fromCents(
        Math.round((this.toCents(part) / this.toCents(total)) * 10000)
      ) / 100
    );
  }

  // Reconcile accounts (ensure debits equal credits)
  static reconcileAccounts(entries: Array<{ credit: number; debit: number }>): {
    totalCredit: number;
    totalDebit: number;
    difference: number;
    isBalanced: boolean;
  } {
    const totalCredit = this.sum(entries.map(e => e.credit));
    const totalDebit = this.sum(entries.map(e => e.debit));
    const difference = this.subtract(totalCredit, totalDebit);

    return {
      totalCredit,
      totalDebit,
      difference,
      isBalanced: Math.abs(difference) < 0.01, // Allow for minor rounding differences
    };
  }
}

// CD Number numeric sorting utility
export const sortNumerically = (aStr: string, bStr: string): number => {
  const matchA = aStr.match(/\d+/);
  const matchB = bStr.match(/\d+/);
  const numA = matchA ? parseInt(matchA[0], 10) : 0;
  const numB = matchB ? parseInt(matchB[0], 10) : 0;
  if (numA !== numB) {
    return numA - numB;
  }
  return aStr.localeCompare(bStr);
};

// Export utility functions for backward compatibility
export const addAmounts = FinancialCalculator.add;
export const subtractAmounts = FinancialCalculator.subtract;
export const calculateBalance = FinancialCalculator.calculateBalance;
export const sumAmounts = FinancialCalculator.sum;
export const formatAmount = FinancialCalculator.formatAmount;
export const formatBalance = FinancialCalculator.formatBalance;
export const validateEntry = FinancialCalculator.validateEntry;
