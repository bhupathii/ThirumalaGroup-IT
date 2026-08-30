import { describe, it, expect } from 'vitest';
import { FinanceCalculationEngine, naturalSortLoanId, OverdueDueItem } from '../services/FinanceCalculationEngine';

describe('Dues List Enhancements & Sorting Tests', () => {

  const sampleDues: OverdueDueItem[] = [
    {
      id: '1',
      loanId: 'CD10',
      customerName: 'Karthik B',
      loanCategory: 'CD',
      loanType: 'CD',
      loanAmount: 10000,
      currentPrincipal: 10000,
      loanDate: '2026-01-10',
      currentDueDate: '2026-02-10',
      interestPaid: 300,
      pendingInterest: 600,
      penalty: 150,
      penaltyPaid: 50,
      presentDue: 750,
      dueDays: 45,
      isNPA: false,
      phone: '9876543210',
      g1Name: 'Ramesh',
      g1Phone: '9876543211',
      g2Name: '',
      g2Phone: '',
      partnerName: 'Partner A',
      status: 'Active',
      closingAmount: 10750,
      totalPaid: 350
    },
    {
      id: '2',
      loanId: 'CD2',
      customerName: 'Anil Kumar',
      loanCategory: 'CD',
      loanType: 'CD',
      loanAmount: 20000,
      currentPrincipal: 20000,
      loanDate: '2026-01-02',
      currentDueDate: '2026-02-02',
      interestPaid: 600,
      pendingInterest: 1200,
      penalty: 300,
      penaltyPaid: 100,
      presentDue: 1500,
      dueDays: 15,
      isNPA: false,
      phone: '9876543212',
      g1Name: '',
      g1Phone: '',
      g2Name: '',
      g2Phone: '',
      partnerName: 'Partner B',
      status: 'Active',
      closingAmount: 21500,
      totalPaid: 700
    },
    {
      id: '3',
      loanId: 'CD1',
      customerName: 'Zahir Khan',
      loanCategory: 'CD',
      loanType: 'CD',
      loanAmount: 50000,
      currentPrincipal: 50000,
      loanDate: '2025-12-01',
      currentDueDate: '2026-01-01',
      interestPaid: 1500,
      pendingInterest: 3000,
      penalty: 750,
      penaltyPaid: 0,
      presentDue: 3750,
      dueDays: 75,
      isNPA: false,
      phone: '9876543213',
      g1Name: '',
      g1Phone: '',
      g2Name: '',
      g2Phone: '',
      partnerName: 'Partner A',
      status: 'Active',
      closingAmount: 53750,
      totalPaid: 1500
    },
    {
      id: '4',
      loanId: 'CD9',
      customerName: 'Bhanu Pratap',
      loanCategory: 'CD',
      loanType: 'CD',
      loanAmount: 15000,
      currentPrincipal: 15000,
      loanDate: '2026-01-09',
      currentDueDate: '2026-02-09',
      interestPaid: 450,
      pendingInterest: 900,
      penalty: 200,
      penaltyPaid: 50,
      presentDue: 1100,
      dueDays: 60,
      isNPA: false,
      phone: '9876543214',
      g1Name: '',
      g1Phone: '',
      g2Name: '',
      g2Phone: '',
      partnerName: 'Partner A',
      status: 'Active',
      closingAmount: 16100,
      totalPaid: 500
    },
    {
      id: '5',
      loanId: 'CD118',
      customerName: 'Nageshwar Rekha',
      loanCategory: 'CD',
      loanType: 'CD',
      loanAmount: 100000,
      currentPrincipal: 100000,
      loanDate: '2025-06-01',
      currentDueDate: '',
      interestPaid: 10000,
      pendingInterest: 5000,
      penalty: 2500,
      penaltyPaid: 2500,
      presentDue: 0,
      dueDays: 0,
      isNPA: true,
      phone: '9876543215',
      g1Name: '',
      g1Phone: '',
      g2Name: '',
      g2Phone: '',
      partnerName: 'Partner A',
      status: 'NPA_CLOSED',
      closingAmount: 113000,
      totalPaid: 113000
    }
  ];

  it('Requirement 7: naturalSortLoanId sorts alphanumeric CD numbers naturally', () => {
    const ids = ['CD10', 'CD11', 'CD2', 'CD9', 'CD001', 'CD098', 'CD099'];
    const sorted = [...ids].sort(naturalSortLoanId);
    
    // Natural order: CD001, CD2, CD9, CD10, CD11, CD098, CD099
    expect(sorted).toEqual(['CD001', 'CD2', 'CD9', 'CD10', 'CD11', 'CD098', 'CD099']);
    
    // Explicit pair checks
    expect(naturalSortLoanId('CD2', 'CD10')).toBeLessThan(0);
    expect(naturalSortLoanId('CD9', 'CD10')).toBeLessThan(0);
    expect(naturalSortLoanId('CD10', 'CD11')).toBeLessThan(0);
    expect(naturalSortLoanId('CD098', 'CD099')).toBeLessThan(0);
    expect(naturalSortLoanId('CD10', 'CD2')).toBeGreaterThan(0);
  });

  it('Requirement 7: Outstanding tab default sorting is by CD NUMBER naturally ascending', () => {
    const outstanding = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'OUTSTANDING',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      ''
    );

    const loanIds = outstanding.map(d => d.loanId);
    // Active loans sorted naturally: CD1, CD2, CD9, CD10 (CD118 is NPA_CLOSED so excluded)
    expect(loanIds).toEqual(['CD1', 'CD2', 'CD9', 'CD10']);
    expect(loanIds).not.toContain('CD118');
  });

  it('Requirement 4 & 5: DUE DAYS tab includes active loans only and excludes NPA closed loans', () => {
    const dueDaysList = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'DUE DAYS',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      ''
    );

    const loanIds = dueDaysList.map(d => d.loanId);
    expect(loanIds).toContain('CD1');
    expect(loanIds).toContain('CD2');
    expect(loanIds).toContain('CD9');
    expect(loanIds).toContain('CD10');
    expect(loanIds).not.toContain('CD118'); // NPA Closed excluded
  });

  it('Requirement 6: DUE DAYS tab is sortable ascending and descending by due days', () => {
    // Ascending: lowest due days -> highest due days (CD2: 15, CD10: 45, CD9: 60, CD1: 75)
    const ascList = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'DUE DAYS',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      '',
      'ASC'
    );
    expect(ascList.map(d => d.loanId)).toEqual(['CD2', 'CD10', 'CD9', 'CD1']);
    expect(ascList.map(d => d.dueDays)).toEqual([15, 45, 60, 75]);

    // Descending: highest due days -> lowest due days (CD1: 75, CD9: 60, CD10: 45, CD2: 15)
    const descList = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'DUE DAYS',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      '',
      'DESC'
    );
    expect(descList.map(d => d.loanId)).toEqual(['CD1', 'CD9', 'CD10', 'CD2']);
    expect(descList.map(d => d.dueDays)).toEqual([75, 60, 45, 15]);
  });

  it('DUE DAYS tab defaults to ascending numeric sort when no sort direction is passed', () => {
    const defaultList = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'DUE DAYS',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      ''
    );
    // Default order should be lowest due days first (CD2: 15, CD10: 45, CD9: 60, CD1: 75)
    expect(defaultList.map(d => d.loanId)).toEqual(['CD2', 'CD10', 'CD9', 'CD1']);
    expect(defaultList.map(d => d.dueDays)).toEqual([15, 45, 60, 75]);
  });

  it('DUE DAYS sorting is strictly NUMERIC, not lexicographical string sorting', () => {
    const numericTestDues: OverdueDueItem[] = [
      { ...sampleDues[0], id: 'a', loanId: 'CD100', dueDays: 100 },
      { ...sampleDues[0], id: 'b', loanId: 'CD5', dueDays: 5 },
      { ...sampleDues[0], id: 'c', loanId: 'CD1000', dueDays: 1000 },
      { ...sampleDues[0], id: 'd', loanId: 'CD20', dueDays: 20 },
      { ...sampleDues[0], id: 'e', loanId: 'CD500', dueDays: 500 },
      { ...sampleDues[0], id: 'f', loanId: 'CD45', dueDays: 45 },
    ];

    // Ascending: 5, 20, 45, 100, 500, 1000 (NOT string sorted: 100, 1000, 20, 45, 5, 500)
    const ascSorted = FinanceCalculationEngine.filterDueList(
      numericTestDues,
      'DUE DAYS',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      '',
      'ASC'
    );
    expect(ascSorted.map(d => d.dueDays)).toEqual([5, 20, 45, 100, 500, 1000]);
    expect(ascSorted.map(d => d.loanId)).toEqual(['CD5', 'CD20', 'CD45', 'CD100', 'CD500', 'CD1000']);

    // Descending: 1000, 500, 100, 45, 20, 5
    const descSorted = FinanceCalculationEngine.filterDueList(
      numericTestDues,
      'DUE DAYS',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      '',
      'DESC'
    );
    expect(descSorted.map(d => d.dueDays)).toEqual([1000, 500, 100, 45, 20, 5]);
    expect(descSorted.map(d => d.loanId)).toEqual(['CD1000', 'CD500', 'CD100', 'CD45', 'CD20', 'CD5']);
  });

  it('DUE DAYS sorting works seamlessly alongside search filters and partner filters', () => {
    // Filter by Partner A + search "B" (matches Karthik B CD10, Bhanu Pratap CD9)
    const filteredAsc = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'DUE DAYS',
      'Partner A',
      'ALL',
      'B',
      '',
      '',
      'ASC'
    );
    // CD10 (45 days), CD9 (60 days)
    expect(filteredAsc.map(d => d.loanId)).toEqual(['CD10', 'CD9']);
    expect(filteredAsc.map(d => d.dueDays)).toEqual([45, 60]);

    const filteredDesc = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'DUE DAYS',
      'Partner A',
      'ALL',
      'B',
      '',
      '',
      'DESC'
    );
    // CD9 (60 days), CD10 (45 days)
    expect(filteredDesc.map(d => d.loanId)).toEqual(['CD9', 'CD10']);
    expect(filteredDesc.map(d => d.dueDays)).toEqual([60, 45]);
  });

  it('Requirement 2 & 3: NPA LIST returns NPA closed accounts with presentDue = 0 and accurate closingAmount/totalPaid', () => {
    const npaList = FinanceCalculationEngine.filterDueList(
      sampleDues,
      'NPA LIST',
      'ALL PARTNERS',
      'ALL',
      '',
      '',
      ''
    );

    expect(npaList.length).toBe(1);
    const npaItem = npaList[0];
    expect(npaItem.loanId).toBe('CD118');
    expect(npaItem.customerName).toBe('Nageshwar Rekha');
    expect(npaItem.presentDue).toBe(0); // Requirement 2 & 3: No fake present due
    expect(npaItem.dueDays).toBe(0); // Requirement 2 & 3: No active due days
    expect(npaItem.closingAmount).toBe(113000);
    expect(npaItem.totalPaid).toBe(113000);
    expect(npaItem.loanDate).toBe('2025-06-01');
  });

  it('Requirement 1: LOAN DATE comes from the original disbursement date and computeDueListTotals totals accurately', () => {
    const totals = FinanceCalculationEngine.computeDueListTotals(sampleDues);
    expect(totals.principal).toBe(10000 + 20000 + 50000 + 15000 + 100000);
    expect(totals.interestPaid).toBe(300 + 600 + 1500 + 450 + 10000);
    expect(totals.presentDue).toBe(750 + 1500 + 3750 + 1100 + 0);
  });
});
