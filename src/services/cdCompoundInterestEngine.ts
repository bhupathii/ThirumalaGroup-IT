/**
 * CD COMPOUND INTEREST (CI) DISPLAY ENGINE
 * ====================================================
 * TIMELINE-BASED COMPOUND INTEREST SIMULATOR
 * 
 * IMPORTANT:
 * This engine is PURELY READ-ONLY and INFORMATIONAL.
 * It NEVER modifies:
 *   - Database tables
 *   - Ledger entries
 *   - Interest Due / Penalty / Renewal calculations
 *   - Payment Splits or Closures
 *   - FinanceCalculationEngine
 *
 * SIMULATION ALGORITHM:
 * 1. Start with Outstanding = Original Loan Principal at Loan Date.
 * 2. Walk through ledger events chronologically (Disbursements, Renewals, Payments, Close/Reopen).
 * 3. For each elapsed period between events, compound the balance based on elapsed days.
 * 4. Adjust outstanding principal when a payment reduces principal.
 * 5. If loan is closed, freeze simulation at the closure date.
 * 6. Return step-by-step timeline audit rows & summary metrics for UI display & Modal drill-down.
 */

import { financeCalculationService } from './financeCalculationService';
import { getLocalBusinessDateISO } from '../utils/dateUtils';

export interface CILedgerEvent {
  date: string;
  type: 'DISBURSEMENT' | 'RENEWAL' | 'PAYMENT' | 'PRINCIPAL_REDUCTION' | 'CLOSE' | 'REOPEN' | 'TARGET_DATE';
  particulars: string;
  credit?: number;          // Total payment received
  principalPaid?: number;   // Amount allocated to principal reduction
  debit?: number;           // Additional disbursement / adjustment
  isCloseEvent?: boolean;
}

export interface CIReportRow {
  date: string;
  particulars: string;
  eventType: string;
  daysElapsed: number;
  startingBalance: number;
  outstandingPrincipal: number;
  interestAdded: number;
  paymentReceived: number;
  principalReduction: number;
  endingBalance: number;
}

export interface CISummary {
  initialPrincipal: number;
  currentOutstandingPrincipal: number;
  totalPrincipalPaid: number;
  compoundInterestEarned: number;
  finalCompoundBalance: number;
  effectiveLoanDays: number;
  isClosed: boolean;
  calculatedUntilDate: string;
  calculatedUntil: string;
  monthlyInterestRate: number;
  tooltipText: string;
}

export interface CIResult {
  summary: CISummary;
  reportRows: CIReportRow[];
}

export const TOOLTIP_TEXT = "Estimated compounded value based on actual loan timeline, renewals and principal reductions. Informational only.";

export const cdCompoundInterestEngine = {
  /**
   * Calculates Compound Interest (CI) timeline for a CD loan.
   * 
   * @param loan Basic loan details (id, amount, date, interest_rate, status, closed_at)
   * @param ledgerEntries Raw ledger entries or payment logs
   * @param asOfDate Target date for calculation (defaults to today or loan closed_at)
   */
  calculateCITimeline(
    loan: {
      id: string;
      loan_id?: string;
      amount: number;
      date: string;
      interest_rate: number;
      status?: string;
      closed_at?: string | null;
    },
    ledgerEntries: any[] = [],
    asOfDate?: string
  ): CIResult {
    const initialPrincipal = Number(loan.amount) || 0;
    const monthlyRate = Number(loan.interest_rate) || 0;
    const loanStartDate = (loan.date || '').split('T')[0];

    if (!loanStartDate || initialPrincipal <= 0) {
      return this.emptyResult(initialPrincipal, monthlyRate, loanStartDate);
    }

    // Determine target calculation end date
    const isClosed = (loan.status || '').toLowerCase() === 'closed';
    let endDate = (asOfDate || '').split('T')[0];

    if (isClosed && loan.closed_at) {
      endDate = (loan.closed_at || '').split('T')[0];
    } else if (!endDate) {
      endDate = getLocalBusinessDateISO();
    }

    // Ensure endDate is at or after loanStartDate
    if (endDate < loanStartDate) {
      endDate = loanStartDate;
    }

    // 1. Build chronological event stream
    const events: CILedgerEvent[] = [];

    // Add initial disbursement
    events.push({
      date: loanStartDate,
      type: 'DISBURSEMENT',
      particulars: 'Original Loan Disbursement',
      debit: initialPrincipal
    });

    // Extract events from ledger entries
    (ledgerEntries || []).forEach(e => {
      const eDate = (e.entry_date || e.date || '').split('T')[0];
      if (!eDate || eDate < loanStartDate || (isClosed && eDate > endDate)) return;

      const typeLower = (e.entry_type || e.type || '').toLowerCase();
      const partLower = (e.particulars || e.account_name || '').toLowerCase();
      const credit = Number(e.credit) || 0;
      const debit = Number(e.debit) || 0;

      if (typeLower === 'renewal' || partLower.includes('renewal')) {
        const principalPaid = Number(e.principal_paid) || 0;
        events.push({
          date: eDate,
          type: 'RENEWAL',
          particulars: e.particulars || 'Loan Renewal',
          credit,
          principalPaid
        });
      } else if (
        typeLower === 'principal_payment' || 
        typeLower === 'amount_paid' || 
        typeLower === 'partial_payment' ||
        partLower.includes('principal paid') ||
        partLower.includes('amount paid')
      ) {
        // Payment with principal reduction
        const principalPaid = Number(e.principal_paid) || Number(e.principal_amount) || (typeLower === 'principal_payment' ? credit : 0);
        events.push({
          date: eDate,
          type: 'PAYMENT',
          particulars: e.particulars || 'Payment Received',
          credit,
          principalPaid
        });
      } else if (typeLower === 'interest_payment' || typeLower === 'penalty_payment') {
        // Interest-only payment (principal unchanged)
        events.push({
          date: eDate,
          type: 'PAYMENT',
          particulars: e.particulars || 'Interest Payment Received',
          credit,
          principalPaid: 0
        });
      } else if (typeLower === 'close' || partLower.includes('loan closed')) {
        events.push({
          date: eDate,
          type: 'CLOSE',
          particulars: 'Loan Closed',
          credit,
          principalPaid: credit,
          isCloseEvent: true
        });
      } else if ((typeLower === 'disbursement' || typeLower === 'original_loan') && eDate > loanStartDate) {
        events.push({
          date: eDate,
          type: 'DISBURSEMENT',
          particulars: e.particulars || 'Additional Disbursement',
          debit
        });
      }
    });

    // Add target end date event if not already present
    const hasEndDateEvent = events.some(e => e.date === endDate);
    if (!hasEndDateEvent) {
      events.push({
        date: endDate,
        type: 'TARGET_DATE',
        particulars: isClosed ? 'Loan Closed Value' : 'Compounded Value to Date',
        credit: 0,
        principalPaid: 0
      });
    }

    // Sort events strictly by date, breaking ties by event priority
    const priorityMap: Record<string, number> = {
      'DISBURSEMENT': 1,
      'RENEWAL': 2,
      'PAYMENT': 3,
      'PRINCIPAL_REDUCTION': 4,
      'CLOSE': 5,
      'TARGET_DATE': 6
    };

    events.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (priorityMap[a.type] || 99) - (priorityMap[b.type] || 99);
    });

    // 2. Timeline Walk Simulation
    let outstandingPrincipal = initialPrincipal;
    let compoundedBalance = initialPrincipal;
    let accumulatedInterest = 0;
    let totalPrincipalPaid = 0;
    let lastDate = loanStartDate;
    let totalDaysSimulated = 0;

    const reportRows: CIReportRow[] = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const daysElapsed = Math.max(0, financeCalculationService.differenceInCalendarDays(ev.date, lastDate));
      
      const startingBalance = compoundedBalance;
      let interestAdded = 0;

      // Compound balance for elapsed days
      if (daysElapsed > 0 && outstandingPrincipal > 0 && monthlyRate > 0) {
        // Compound growth formula over days elapsed:
        // Future Value = Current Balance * (1 + (monthlyRate/100)) ^ (daysElapsed / 30)
        const compoundingFactor = Math.pow(1 + monthlyRate / 100, daysElapsed / 30);
        const newBalance = startingBalance * compoundingFactor;
        interestAdded = Number((newBalance - startingBalance).toFixed(2));
        accumulatedInterest += interestAdded;
        compoundedBalance = Number(newBalance.toFixed(2));
        totalDaysSimulated += daysElapsed;
      }

      // Process Event Financial Adjustments
      let creditReceived = ev.credit || 0;
      let principalReduction = ev.principalPaid || 0;

      if (ev.type === 'DISBURSEMENT') {
        // Initial row or additional disbursement
        if (i > 0 && ev.debit) {
          outstandingPrincipal += ev.debit;
          compoundedBalance += ev.debit;
        }
      } else if (ev.type === 'RENEWAL' || ev.type === 'PAYMENT') {
        if (principalReduction > 0) {
          totalPrincipalPaid += principalReduction;
          outstandingPrincipal = Math.max(0, outstandingPrincipal - principalReduction);
          compoundedBalance = Math.max(0, compoundedBalance - principalReduction);
        }
      } else if (ev.type === 'CLOSE') {
        if (principalReduction > 0) {
          totalPrincipalPaid += principalReduction;
          outstandingPrincipal = 0;
        }
      }

      const endingBalance = compoundedBalance;

      // Include in report if days elapsed > 0 or financial transaction occurred
      if (daysElapsed > 0 || creditReceived > 0 || principalReduction > 0 || ev.type === 'DISBURSEMENT' || ev.type === 'TARGET_DATE') {
        reportRows.push({
          date: ev.date,
          particulars: ev.particulars,
          eventType: ev.type,
          daysElapsed,
          startingBalance: Number(startingBalance.toFixed(2)),
          outstandingPrincipal: Number(outstandingPrincipal.toFixed(2)),
          interestAdded: Number(interestAdded.toFixed(2)),
          paymentReceived: Number(creditReceived.toFixed(2)),
          principalReduction: Number(principalReduction.toFixed(2)),
          endingBalance: Number(endingBalance.toFixed(2))
        });
      }

      lastDate = ev.date;

      // Stop simulation if loan closed or outstanding principal becomes 0
      if (ev.isCloseEvent) {
        break;
      }
    }

    const finalCompoundBalance = Number(compoundedBalance.toFixed(2));
    const compoundInterestEarned = Number(accumulatedInterest.toFixed(2));

    return {
      summary: {
        initialPrincipal: Number(initialPrincipal.toFixed(2)),
        currentOutstandingPrincipal: Number(outstandingPrincipal.toFixed(2)),
        totalPrincipalPaid: Number(totalPrincipalPaid.toFixed(2)),
        compoundInterestEarned,
        finalCompoundBalance,
        effectiveLoanDays: totalDaysSimulated,
        isClosed,
        calculatedUntilDate: lastDate,
        calculatedUntil: lastDate,
        monthlyInterestRate: monthlyRate,
        tooltipText: TOOLTIP_TEXT
      },
      reportRows
    };
  },

  emptyResult(initialPrincipal: number, monthlyRate: number, loanStartDate: string): CIResult {
    const calcDate = loanStartDate || getLocalBusinessDateISO();
    return {
      summary: {
        initialPrincipal: Number(initialPrincipal.toFixed(2)),
        currentOutstandingPrincipal: Number(initialPrincipal.toFixed(2)),
        totalPrincipalPaid: 0,
        compoundInterestEarned: 0,
        finalCompoundBalance: Number(initialPrincipal.toFixed(2)),
        effectiveLoanDays: 0,
        isClosed: false,
        calculatedUntilDate: calcDate,
        calculatedUntil: calcDate,
        monthlyInterestRate: monthlyRate,
        tooltipText: TOOLTIP_TEXT
      },
      reportRows: []
    };
  }
};
