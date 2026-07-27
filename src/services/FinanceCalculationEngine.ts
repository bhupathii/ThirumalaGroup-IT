import { supabaseFinance } from '../lib/supabaseFinance';
import { supabase } from '../lib/supabase';
import { financeCalculationService } from './financeCalculationService';

/**
 * Finance Calculation Engine
 * 
 * Single source of truth for all financial math in the system.
 * Replaces duplicated local map/reduce logic across reports.
 */

export interface LoanMetrics {
  loanId: string;
  principalFinanced: number;
  principalCollected: number;
  interestEarned: number;
  penaltyEarned: number;
  outstanding: number;
  presentDue: number;
  pendingInterest: number;
  pendingPenalty: number;
  status: string;
}

export interface OverdueDueItem {
  id: string;
  loanId: string;
  customerName: string;
  loanCategory: string;
  loanType: 'CD' | 'HP' | 'STBD' | 'TBD';
  loanAmount: number;
  currentPrincipal: number;
  loanDate: string;
  currentDueDate: string;
  interestPaid: number;
  pendingInterest: number;
  penalty: number;
  presentDue: number;
  dueDays: number;
  isNPA: boolean;
  penaltyPaid: number;
  phone: string;
  g1Name: string;
  g1Phone: string;
  g2Name: string;
  g2Phone: string;
  partnerName: string;
  status: string;
  customer_id?: string;
  guarantor_1_id?: string;
  guarantor_2_id?: string;
}

export interface PartnerMetrics {
  partnerId: string;
  partnerName: string;
  role: string;
  netCapital: number;
  loansIntroduced: number;
  activeLoans: number;
  closedLoans: number;
  npaCount: number;
  
  // Period Metrics (based on fromDate/toDate)
  periodPrincipalFinanced: number;
  periodPrincipalCollected: number;
  periodInterestEarned: number;
  periodPenaltyEarned: number;

  // Lifetime Metrics
  lifetimePrincipalFinanced: number;
  lifetimePrincipalCollected: number;
  lifetimeInterestEarned: number;
  lifetimePenaltyEarned: number;

  // Dues & Outstanding
  outstanding: number;
  presentDue: number;
  pendingInterest: number;
  pendingPenalty: number;

  // Ratios
  recoveryPct: number;
  collectionPct: number;
  yieldPct: number;
}

export class FinanceCalculationEngine {
  
  /**
   * Evaluates if a loan is considered active/NPA for outstanding calculations
   */
  static isActiveOrNpa(status: string, isNpaFlag: boolean = false): boolean {
    const s = (status || '').trim().toUpperCase();
    return s === 'ACTIVE' || s === 'NPA' || s === 'NPA_CLOSED' || s === 'NPA CLOSED' || isNpaFlag;
  }

  /**
   * Computes standardized metrics for a single loan.
   */
  static computeLoanMetrics(loan: any, dues: any[]): LoanMetrics {
    const due = dues.find(d => d.loan_id === loan.loan_id || d.loanId === loan.id || d.id === loan.id);
    const p = Number(loan.amount) || 0;
    
    const isActive = this.isActiveOrNpa(loan.status, loan.npa_closed === true || (loan as any).is_npa === true);
    
    const outstanding = isActive 
      ? (due ? Number(due.current_principal || due.currentPrincipal || due.principal || 0) : p)
      : 0;

    const presentDue = isActive && due ? Number(due.present_due || due.presentDue || due.totalPending || 0) : 0;
    const pendingInterest = isActive && due ? Number(due.pending_interest || due.pendingInterest || due.interestPending || 0) : 0;
    const pendingPenalty = isActive && due ? Number(due.penalty || due.penaltyPending || 0) : 0;
    
    const interestEarned = due ? Number(due.interest_paid || 0) : 0;
    const penaltyEarned = due ? Number(due.penalty_paid || 0) : 0;
    const principalCollected = due ? Number(due.principal_paid || 0) : 0;

    return {
      loanId: loan.id,
      principalFinanced: p,
      principalCollected,
      interestEarned,
      penaltyEarned,
      outstanding,
      presentDue,
      pendingInterest,
      pendingPenalty,
      status: loan.status
    };
  }

  /**
   * Filters a list of OverdueDueItems according to standardized business rules.
   */
  static filterDueList(
    dues: OverdueDueItem[],
    activeReport: 'OUTSTANDING' | 'TOTAL DUE LIST' | 'CD DUE LIST' | 'A -> B DUE LIST' | 'NPA LIST',
    selectedPartner: string,
    loanTypeFilter: 'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD',
    searchName: string,
    startDate: string,
    endDate: string
  ): OverdueDueItem[] {
    return dues.filter(due => {
      // 1. Report Type Filter
      if (activeReport === 'OUTSTANDING') {
        const isActive = due.status === 'Active';
        const isOverdue = due.presentDue > 0 || due.pendingInterest > 0 || due.penalty > 0 || due.dueDays > 0;
        if (!isActive || !isOverdue) return false;
      } else if (activeReport === 'TOTAL DUE LIST') {
        // Show all accounts in ledgers
      } else if (activeReport === 'CD DUE LIST') {
        const isActive = due.status === 'Active';
        if (due.loanType !== 'CD' || !isActive) return false;
      } else if (activeReport === 'A -> B DUE LIST') {
        const isActive = due.status === 'Active';
        if (!isActive) return false;
      } else if (activeReport === 'NPA LIST') {
        // Thirumala Finance NPA Definition: Accounts explicitly closed under NPA (e.g. status = NPA_CLOSED, NPA CLOSED, NPA)
        const cleanStatus = (due.status || '').trim().toUpperCase();
        const isNpaClosed = cleanStatus === 'NPA_CLOSED' || cleanStatus === 'NPA CLOSED' || cleanStatus === 'NPA';
        if (!isNpaClosed) return false;
      }

      // 2. Date Filters for all reports
      if (due.currentDueDate) {
        if (startDate && due.currentDueDate < startDate) return false;
        if (endDate && due.currentDueDate > endDate) return false;
      }

      // 3. Partner Filter
      if (selectedPartner !== 'ALL PARTNERS' && due.partnerName !== selectedPartner) return false;

      // 4. Loan Type Filter
      if (loanTypeFilter !== 'ALL' && due.loanType !== loanTypeFilter) return false;

      // 5. Search Filter
      if (searchName) {
        const search = searchName.toLowerCase();
        if (!due.customerName.toLowerCase().includes(search) && !due.loanId.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (activeReport === 'OUTSTANDING') {
        if (a.currentDueDate !== b.currentDueDate) {
          return a.currentDueDate.localeCompare(b.currentDueDate);
        }
        const numA = Number(a.loanId.replace(/\\D/g, '')) || 0;
        const numB = Number(b.loanId.replace(/\\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.loanId.localeCompare(b.loanId);
      } else if (activeReport === 'A -> B DUE LIST') {
        return a.customerName.localeCompare(b.customerName);
      } else {
        const numA = Number(a.loanId.replace(/\\D/g, '')) || 0;
        const numB = Number(b.loanId.replace(/\\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.loanId.localeCompare(b.loanId);
      }
    });
  }

  /**
   * Computes totals across a filtered due list.
   */
  static computeDueListTotals(filteredDues: OverdueDueItem[]) {
    let principal = 0, interestPaid = 0, interest = 0;
    let penaltyPaid = 0, penalty = 0, presentDue = 0, amountToClose = 0;

    filteredDues.forEach(d => {
      principal += d.currentPrincipal;
      interestPaid += d.interestPaid;
      interest += d.pendingInterest;
      penaltyPaid += d.penaltyPaid;
      penalty += d.penalty;
      presentDue += d.presentDue;
      amountToClose += d.currentPrincipal + d.pendingInterest + d.penalty;
    });

    return { principal, interestPaid, interest, penaltyPaid, penalty, presentDue, amountToClose };
  }

  /**
   * Translates raw Non-CD database records into standardized OverdueDueItems.
   */
  static buildNonCdDueItem(
    loan: any,
    borrowerMap: Map<string, any>,
    dueEntries: any[],
    ledgerSettings: any[],
    targetDate: string
  ): OverdueDueItem {
    const borrower = borrowerMap.get(loan.customer_id) || {};
    const g1 = borrowerMap.get(loan.guarantor_1_id) || {};
    const g2 = borrowerMap.get(loan.guarantor_2_id) || {};

    const loanType = loan.loan_id.startsWith('HP') ? 'HP' : (loan.loan_id.startsWith('STBD') ? 'STBD' : 'TBD');
    const phone = borrower.phone || borrower.phone_1 || borrower.phone_2 || '';
    const g1_name = g1.name || '';
    const g1_phone = g1.phone || g1.phone_1 || g1.phone_2 || '';
    const g2_name = g2.name || '';
    const g2_phone = g2.phone || g2.phone_1 || g2.phone_2 || '';

    const loanDues = dueEntries.filter(d => d.loan_id === loan.id);
    const totalRepayable = loanDues.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalPaid = loanDues.reduce((sum, d) => sum + Number(d.paid_amount || 0), 0);

    let currentPrincipal = Number(loan.amount);
    if (totalRepayable > 0) {
      currentPrincipal = Number(loan.amount) - (totalPaid * (1.0 - ((totalRepayable - Number(loan.amount)) / totalRepayable)));
    }

    let interestPaid = 0;
    if (totalRepayable > 0) {
      interestPaid = totalPaid * ((totalRepayable - Number(loan.amount)) / totalRepayable);
    }

    const overdueDues = loanDues.filter(d => d.due_date <= targetDate && d.status !== 'Paid');
    const presentDuePrincipalAndInterest = overdueDues.reduce((sum, d) => sum + Number(d.amount - (d.paid_amount || 0)), 0);

    let pendingInterest = 0;
    if (totalRepayable > 0) {
      pendingInterest = presentDuePrincipalAndInterest * ((totalRepayable - Number(loan.amount)) / totalRepayable);
    }

    const unpaidDues = loanDues.filter(d => d.status !== 'Paid');
    const oldestDueDateStr = unpaidDues.reduce((min, d) => !min || d.due_date < min ? d.due_date : min, null as string | null);
    const dueDaysRaw = oldestDueDateStr ? financeCalculationService.differenceInCalendarDays(targetDate, oldestDueDateStr) : 0;
    const dueDays = Math.max(0, dueDaysRaw);
    const isNpa = dueDaysRaw > 90;

    const categorySetting = (ledgerSettings || []).find(s => s.code === loan.loan_category) || 
                            (ledgerSettings || []).find(s => s.code === loanType) || 
                            { overdue: 24, days_per_year: 365 };

    let penalty = 0;
    if (dueDays > 5) {
      const daysPerMonth = categorySetting.days_per_year / 12.0;
      penalty = Math.round(presentDuePrincipalAndInterest * (categorySetting.overdue / 100.0) * (dueDays / daysPerMonth));
    }

    return {
      id: loan.id,
      loanId: loan.loan_id,
      customerName: borrower.name || '',
      loanCategory: loan.loan_category || loanType,
      loanType: loanType as any,
      loanAmount: Number(loan.amount),
      currentPrincipal: currentPrincipal,
      loanDate: loan.date.split('T')[0],
      currentDueDate: oldestDueDateStr || loan.date.split('T')[0],
      interestPaid: interestPaid,
      pendingInterest: pendingInterest,
      penalty: penalty,
      penaltyPaid: 0,
      presentDue: presentDuePrincipalAndInterest + penalty,
      dueDays: dueDays,
      isNPA: isNpa,
      phone,
      g1Name: g1_name,
      g1Phone: g1_phone,
      g2Name: g2_name,
      g2Phone: g2_phone,
      partnerName: borrower.partner_name || 'Unassigned',
      status: loan.status,
      customer_id: loan.customer_id,
      guarantor_1_id: loan.guarantor_1_id,
      guarantor_2_id: loan.guarantor_2_id
    };
  }

  /**
   * Analyzes all loans and computes exact mathematical totals for ALL partners.
   * This prevents N+1 queries by fetching data once.
   */
  static async computeAllPartnersMetrics(
    partners: { id: string; name: string; is_md: boolean }[],
    fromDate: string, 
    toDate: string
  ): Promise<PartnerMetrics[]> {
    
    const allLoans = await supabaseFinance.getLoans();
    const { dues } = await supabaseFinance.getDuesLedgerSummary(toDate);
    const { data: capEntries } = await supabase.from('finance_capital_entries').select('*');
    const { data: cdEntries } = await supabase.from('finance_cd_ledger_entries').select('*');

    return partners.map(partner => {
      const partnerId = partner.id;
      const partnerName = partner.name;
      const isMd = partner.is_md;

      // 1. Filter Loans to Partner
      const pLoans = allLoans.filter(l => {
        if (l.partner_id) return l.partner_id === partnerId;
        if ((l.customer as any)?.partner_id) return (l.customer as any).partner_id === partnerId;
        
        const pName = partnerName.trim().toUpperCase();
        const rawPartner = ((l as any).partner_name || l.customer?.partner_name || '').trim().toUpperCase();
        if (rawPartner) return rawPartner === pName;
        
        return isMd; // Unassigned fall to MD
      });

    const pLoanIds = new Set(pLoans.map(l => l.id).concat(pLoans.map(l => l.loan_id).filter(Boolean)));

    // 2. Loan Counts & Statuses
    let activeLoans = 0, closedLoans = 0, npaCount = 0;
    pLoans.forEach(l => {
      const s = (l.status || '').trim().toUpperCase();
      if (s === 'CLOSED') closedLoans++; else activeLoans++;
      if (s === 'NPA' || s === 'NPA_CLOSED' || s === 'NPA CLOSED' || l.npa_closed === true || (l as any).is_npa === true) {
        npaCount++;
      }
    });

    // 3. Loans in Period
    const pLoansInRange = pLoans.filter(l => {
      const lDate = l.date ? l.date.split('T')[0] : '';
      return (!fromDate || lDate >= fromDate) && (!toDate || lDate <= toDate);
    });

    const loansIntroduced = pLoansInRange.length;
    const periodPrincipalFinanced = pLoansInRange.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const lifetimePrincipalFinanced = pLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    // 4. Capital in Period
    let netCapital = 0;
    (capEntries || []).forEach(c => {
      const cDate = c.entry_date ? c.entry_date.split('T')[0] : '';
      if ((!fromDate || cDate >= fromDate) && (!toDate || cDate <= toDate)) {
        const isMatch = c.partner_id === partnerId || 
          (c.partner_name && c.partner_name.trim().toUpperCase() === partnerName.trim().toUpperCase()) ||
          (isMd && (!c.partner_id && !c.partner_name));
        
        if (isMatch) {
          netCapital += (Number(c.credit) || 0) - (Number(c.debit) || 0);
        }
      }
    });

    // 5. Ledger Collections
    let periodPrincipalCollected = 0, periodInterestEarned = 0, periodPenaltyEarned = 0;
    let lifetimePrincipalCollected = 0, lifetimeInterestEarned = 0, lifetimePenaltyEarned = 0;

    (cdEntries || []).forEach(entry => {
      if (!pLoanIds.has(entry.loan_id)) return;
      
      const cr = Number(entry.credit) || 0;
      const dr = Number(entry.debit) || 0;
      const net = cr - dr;
      const acc = (entry.account_name || '').trim();

      const isPrincipal = acc === 'CD A/C' || acc === 'CD PRINCIPAL' || acc === 'CD Amount Paid';
      const isInterest = acc === 'CD COMMISSION A/C' || acc === 'CD INTEREST';
      const isPenalty = acc === 'PENALTY A/C' || acc === 'CD PENALTY';

      if (isPrincipal) lifetimePrincipalCollected += net;
      if (isInterest) lifetimeInterestEarned += net;
      if (isPenalty) lifetimePenaltyEarned += net;

      const eDate = entry.entry_date || entry.date || '';
      if ((!fromDate || eDate >= fromDate) && (!toDate || eDate <= toDate)) {
        if (isPrincipal) periodPrincipalCollected += net;
        if (isInterest) periodInterestEarned += net;
        if (isPenalty) periodPenaltyEarned += net;
      }
    });

    // 6. Outstanding & Dues
    let outstanding = 0, presentDue = 0, pendingInterest = 0, pendingPenalty = 0;
    
    pLoans.forEach(l => {
      const due = dues.find(d => d.loan_id === l.loan_id || d.loanId === l.id || d.id === l.id);
      if (this.isActiveOrNpa(l.status, l.npa_closed === true || (l as any).is_npa === true)) {
        if (due) {
          outstanding += Number(due.current_principal || due.currentPrincipal || due.principal || 0);
          presentDue += Number(due.present_due || due.presentDue || due.totalPending || 0);
          pendingInterest += Number(due.pending_interest || due.pendingInterest || 0);
          pendingPenalty += Number(due.penalty || due.penaltyPending || 0);
        } else {
          outstanding += Number(l.amount) || 0;
        }
      }
    });

    // 7. Ratios
    const recoveryPct = lifetimePrincipalFinanced > 0 ? (lifetimePrincipalCollected / lifetimePrincipalFinanced) * 100 : 0;
    const lifetimeTotalCollected = lifetimePrincipalCollected + lifetimeInterestEarned + lifetimePenaltyEarned;
    const totalLifetimeDue = lifetimeTotalCollected + presentDue; 
    const collectionPct = totalLifetimeDue > 0 ? (lifetimeTotalCollected / totalLifetimeDue) * 100 : 0;
    const yieldPct = outstanding > 0 ? (periodInterestEarned / outstanding) * 100 : 0;

      return {
        partnerId,
        partnerName,
        role: isMd ? 'MD' : 'Partner',
        netCapital,
        loansIntroduced,
        activeLoans,
        closedLoans,
        npaCount,
        periodPrincipalFinanced,
        periodPrincipalCollected,
        periodInterestEarned,
        periodPenaltyEarned,
        lifetimePrincipalFinanced,
        lifetimePrincipalCollected,
        lifetimeInterestEarned,
        lifetimePenaltyEarned,
        outstanding,
        presentDue,
        pendingInterest,
        pendingPenalty,
        recoveryPct,
        collectionPct,
        yieldPct
      };
    });
  }

}
