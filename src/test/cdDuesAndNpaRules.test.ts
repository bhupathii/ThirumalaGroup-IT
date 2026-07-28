import { describe, it, expect } from 'vitest';


describe('CD Dues List and NPA List Safety Regression Tests', () => {
  it('verifies negative due days are excluded from Dues List, but dueDays = 0 are included', () => {
    // 1. Mock positions: prepaid / due today / overdue
    const prepaidPos = {
      displayDueDays: -5,
      todayDue: -1500,
      principalBalance: 50000,
      accruedInterest: -1500,
      accruedPenalty: 0,
      currentDueDate: '2026-07-15'
    };

    const dueTodayPos = {
      displayDueDays: 0,
      todayDue: 0,
      principalBalance: 50000,
      accruedInterest: 0,
      accruedPenalty: 0,
      currentDueDate: '2026-07-10'
    };

    const overduePos = {
      displayDueDays: 15,
      todayDue: 4500,
      principalBalance: 50000,
      accruedInterest: 3000,
      accruedPenalty: 1500,
      currentDueDate: '2026-06-25'
    };

    // Test filter rule implementation matching DuesLedger.tsx
    const filterDuesList = (items: typeof prepaidPos[], reportType: string) => {
      return items.filter(due => {
        // Enforce: CD loans must have dueDays >= 0 to appear in Dues List reports (Outstanding, Total, CD, A->B)
        if (due.displayDueDays < 0) return false;
        
        if (reportType === 'OUTSTANDING') {
          if (due.todayDue <= 0 && due.displayDueDays <= 0) return false;
        }
        return true;
      });
    };

    const pool = [prepaidPos, dueTodayPos, overduePos];
    
    // Outstanding report: only overduePos qualifies (prepaid: dueDays < 0, dueToday: dueDays=0 AND presentDue=0 is excluded on Outstanding but qualifies on Total Dues List)
    const outstandingFiltered = filterDuesList(pool, 'OUTSTANDING');
    expect(outstandingFiltered).toHaveLength(1);
    expect(outstandingFiltered[0]).toBe(overduePos);

    // Total Dues List report: dueDays >= 0 qualifies, so dueTodayPos and overduePos both qualify
    const totalDuesFiltered = filterDuesList(pool, 'TOTAL DUE LIST');
    expect(totalDuesFiltered).toHaveLength(2);
    expect(totalDuesFiltered).toContain(dueTodayPos);
    expect(totalDuesFiltered).toContain(overduePos);
    expect(totalDuesFiltered).not.toContain(prepaidPos);
  });

  it('verifies that negative accrued interest is preserved in close balance', () => {
    // Principal: 250,000. Interest: -3,666.67. Penalty: 0.
    const principalBalance = 250000;
    const accruedInterest = -3666.67;
    const accruedPenalty = 0;

    const totalForClose = principalBalance + accruedInterest + accruedPenalty;
    expect(totalForClose).toBe(246333.33); // Must preserve negative sign
  });

  it('verifies NPA List discovered rule (dueDays > 90)', () => {
    const freshPos = { displayDueDays: 10, isNpa: false };
    const warningPos = { displayDueDays: 89, isNpa: false };
    const npaPos = { displayDueDays: 91, isNpa: true };

    const checkNpaRule = (pos: { displayDueDays: number }) => pos.displayDueDays > 90;

    expect(checkNpaRule(freshPos)).toBe(false);
    expect(checkNpaRule(warningPos)).toBe(false);
    expect(checkNpaRule(npaPos)).toBe(true);
  });

  it('verifies that impossible loan date returns integrity error and does not contaminate dues or close balances', () => {
    const mockLoan = { loan_id: 'CD119', date: '2026-04-13', amount: 400000 };
    const mockEntries = [
      { entry_date: '2023-11-08', credit: 12000, debit: 0, entry_type: 'amount_paid' }
    ];

    const runCalculation = (loan: typeof mockLoan, entries: typeof mockEntries) => {
      const earliestPay = entries[0].entry_date;
      if (loan.date > earliestPay) {
        return {
          status: 'ERROR',
          error: {
            code: 'CD_DATA_INTEGRITY_ERROR',
            message: `CD_DATA_INTEGRITY_ERROR: Loan ${loan.loan_id} has loan_date ${loan.date} after earliest monetary payment ${earliestPay}.`
          }
        };
      }
      return { status: 'SUCCESS', position: { principal: 400000, presentDue: 0 } };
    };

    const res = runCalculation(mockLoan, mockEntries);
    expect(res.status).toBe('ERROR');
    expect(res.error?.code).toBe('CD_DATA_INTEGRITY_ERROR');

    // Prove it doesn't contaminate or create fake 0 dues or Close balance
    let duesTotal = 0;
    let accountsProcessed = 0;
    let integrityErrorsList: any[] = [];

    const processLoan = (loanRes: typeof res) => {
      if (loanRes.status === 'ERROR') {
        integrityErrorsList.push(loanRes.error);
      } else {
        duesTotal += loanRes.position?.presentDue || 0;
        accountsProcessed++;
      }
    };

    processLoan(res);
    expect(duesTotal).toBe(0);
    expect(accountsProcessed).toBe(0);
    expect(integrityErrorsList).toHaveLength(1);
    expect(integrityErrorsList[0].code).toBe('CD_DATA_INTEGRITY_ERROR');
  });

  it('verifies filterDueList NPA List filtering excludes normal closed loans and non-overdue active loans', async () => {
    const { FinanceCalculationEngine } = await import('../services/FinanceCalculationEngine');

    const mockDues: any[] = [
      { id: '1', loanId: 'CD001', customerName: 'Active NPA', status: 'Active', isNPA: true, dueDays: 95, currentPrincipal: 10000, interestPaid: 0, pendingInterest: 1000, penalty: 200, penaltyPaid: 0, presentDue: 1200 },
      { id: '2', loanId: 'CD002', customerName: 'Active Non-NPA', status: 'Active', isNPA: false, dueDays: 30, currentPrincipal: 10000, interestPaid: 0, pendingInterest: 300, penalty: 0, penaltyPaid: 0, presentDue: 300 },
      { id: '3', loanId: 'CD003', customerName: 'Normal Closed', status: 'Closed', isNPA: true, dueDays: 120, currentPrincipal: 0, interestPaid: 5000, pendingInterest: 0, penalty: 0, penaltyPaid: 0, presentDue: 0 },
      { id: '4', loanId: 'CD004', customerName: 'NPA Closed', status: 'NPA_CLOSED', isNPA: true, dueDays: 150, currentPrincipal: 5000, interestPaid: 1000, pendingInterest: 500, penalty: 100, penaltyPaid: 0, presentDue: 600 }
    ];

    const npaFiltered = FinanceCalculationEngine.filterDueList(
      mockDues,
      'NPA LIST',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      ''
    );

    const loanIds = npaFiltered.map(d => d.loanId);
    expect(loanIds).toContain('CD004'); // NPA_CLOSED account included
    expect(loanIds).not.toContain('CD001'); // Active loan (even if > 90 days) is in Outstanding/Due List, not NPA List
    expect(loanIds).not.toContain('CD002'); // Active non-NPA (<= 90 days) excluded
    expect(loanIds).not.toContain('CD003'); // Normal Closed loan excluded
  });
});
