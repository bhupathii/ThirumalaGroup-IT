import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, ArrowLeft, Calendar, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
import { useNavigate } from 'react-router-dom';

interface OverdueDueItem {
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
  phone: string;
  g1Name: string;
  g1Phone: string;
  g2Name: string;
  g2Phone: string;
  partnerName: string;
}

type ReportType = 'OUTSTANDING' | 'TOTAL DUE LIST' | 'CD DUE LIST' | 'A -> B DUE LIST' | 'NPA LIST';

const DuesLedger: React.FC = () => {
  const navigate = useNavigate();
  
  const [dues, setDues] = useState<OverdueDueItem[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  
  const [activeReport, setActiveReport] = useState<ReportType>('OUTSTANDING');
  const [selectedPartner, setSelectedPartner] = useState<string>('ALL PARTNERS');
  const [loanTypeFilter, setLoanTypeFilter] = useState<'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD'>('ALL');
  
  const [searchName, setSearchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Partners
      const partnersData = await supabaseFinance.getPartners();
      setPartners(partnersData.map(p => ({ id: p.id, name: p.name })));

      // 2. Fetch Loans (without guarantor join — FK constraint was dropped; resolved in-memory below)
      const { data: loansData, error: loansError } = await supabase
        .from('finance_loans')
        .select(`
          *,
          customer:finance_customers!customer_id(*)
        `);
      if (loansError) throw loansError;

      // 3. Fetch ALL customers to resolve guarantors in-memory (bypasses missing FK)
      const { data: allCustomers, error: custError } = await supabase
        .from('finance_customers')
        .select('id, name, phone');
      if (custError) throw custError;
      const customerMap = new Map<string, { name: string; phone: string }>(
        (allCustomers || []).map((c: any) => [c.id, { name: c.name || '', phone: c.phone || '' }])
      );

      // 4. Fetch Dues (for HP/STBD/TBD)
      const { data: duesData, error: duesError } = await supabase
        .from('finance_dues')
        .select('*');
      if (duesError) throw duesError;

      // 5. Fetch CD Ledger Entries
      const { data: cdEntries, error: cdEntriesError } = await supabase
        .from('finance_cd_ledger_entries')
        .select('*');
      if (cdEntriesError) throw cdEntriesError;

      // 6. Fetch CD Interest Details
      const { data: cdInterest, error: cdInterestError } = await supabase
        .from('finance_cd_interest_details')
        .select('*');
      if (cdInterestError) throw cdInterestError;

      const ledgerSettings = await financeLedgerSettingsService.getAllLedgerSettings();

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const formatted: OverdueDueItem[] = [];

      (loansData || []).forEach((loan: any) => {
        if (loan.status !== 'Active') return; // Only process Active loans

        // Resolve guarantors in-memory
        const g1 = loan.guarantor_1_id ? customerMap.get(loan.guarantor_1_id) : null;
        const g2 = loan.guarantor_2_id ? customerMap.get(loan.guarantor_2_id) : null;

        const type = loan.loan_id.startsWith('CD') ? 'CD' : loan.loan_id.startsWith('HP') ? 'HP' : loan.loan_id.startsWith('STBD') ? 'STBD' : 'TBD';

        if (type === 'CD') {
          // CD Loan calculations
          const entries = (cdEntries || []).filter((e: any) => e.loan_id === loan.id);
          const interestDetails = (cdInterest || []).filter((d: any) => d.loan_id === loan.id);

          // Calculate current principal balance
          const disb = entries
            .filter((e: any) => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
            .reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
          const repaid = entries
            .filter((e: any) => e.entry_type === 'principal_payment' || e.account_name === 'CD A/C')
            .reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
          const principalBalance = disb - repaid;

          // Original loan date
          const disbEntry = entries
            .filter((e: any) => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
            .sort((a: any, b: any) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())[0];
          const originalLoanDateStr = disbEntry ? disbEntry.entry_date.split('T')[0] : loan.date.split('T')[0];

          // Calculate current due date
          const periodDays = loan.period_days || 30;
          const baseDueDateStr = financeCalculationService.addCalendarDays(originalLoanDateStr, periodDays);
          const totalRenewedDays = interestDetails
            .filter((d: any) => Number(d.credit) === 0)
            .reduce((sum: number, d: any) => sum + (Number(d.renewed_days) || 0), 0);
          const currentDueDateStr = financeCalculationService.addCalendarDays(baseDueDateStr, totalRenewedDays);

          // Calculate due days
          const dueDays = financeCalculationService.differenceInCalendarDays(todayStr, currentDueDateStr);
          
          // Calculate pending interest & penalty
          const interestRate = Number(loan.interest_rate) || 3;
          const penaltyRate = Number(loan.penalty_percent) || 0.75;
          const graceDays = Number(loan.grace_days) || 5;

          let pendingInterest = 0;
          let pendingPenalty = 0;
          let presentDue = 0;

          if (dueDays > 0) {
            pendingInterest = Number(((principalBalance * interestRate * dueDays) / periodDays / 100).toFixed(2));
            if (dueDays > graceDays) {
              pendingPenalty = Number(((principalBalance * penaltyRate * dueDays) / periodDays / 100).toFixed(2));
            }
            presentDue = pendingInterest + pendingPenalty;
          }

          // Total interest paid
          const interestPaid = entries
            .filter((e: any) => e.account_name === 'CD COMMISSION A/C' || e.entry_type === 'interest_payment')
            .reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);

          const isNPA = dueDays > 90;

          formatted.push({
            id: loan.id,
            loanId: loan.loan_id,
            customerName: loan.customer?.name || 'N/A',
            loanCategory: loan.loan_category || 'CD',
            loanType: 'CD',
            loanAmount: Number(loan.amount),
            currentPrincipal: principalBalance,
            loanDate: originalLoanDateStr,
            currentDueDate: currentDueDateStr,
            interestPaid,
            pendingInterest,
            penalty: pendingPenalty,
            presentDue,
            dueDays: dueDays > 0 ? dueDays : 0,
            isNPA,
            phone: loan.customer?.phone || '',
            g1Name: g1?.name || '',
            g1Phone: g1?.phone || '',
            g2Name: g2?.name || '',
            g2Phone: g2?.phone || '',
            partnerName: loan.customer?.partner_name || 'Unassigned'
          });
        } else {
          // HP/STBD/TBD loan calculations from finance_dues
          const dues = (duesData || []).filter((d: any) => d.loan_id === loan.id);
          const unpaidDues = dues.filter((d: any) => d.status !== 'Paid');
          
          const sortedUnpaid = [...unpaidDues].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          const oldestUnpaid = sortedUnpaid[0];

          const currentDueDate = oldestUnpaid ? oldestUnpaid.due_date : loan.date;
          const dueDays = oldestUnpaid ? Math.round((today.getTime() - new Date(oldestUnpaid.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          
          // Present Due = sum of (amount - paid_amount) for all dues past due
          const pastUnpaidDues = unpaidDues.filter((d: any) => d.due_date <= todayStr);
          const presentDue = pastUnpaidDues.reduce((sum: number, d: any) => sum + (Number(d.amount) - Number(d.paid_amount || 0)), 0);

          const totalPaid = dues.reduce((sum: number, d: any) => sum + Number(d.paid_amount || 0), 0);

          let penalty = 0;
          if (oldestUnpaid && dueDays > 0) {
            const cat = loan.loan_category?.trim().toUpperCase() || 'CD';
            const setting = ledgerSettings[cat] || ledgerSettings['CD'];
            if (setting) {
              penalty = financeCalculationService.calculatePenaltyFromSetting(presentDue, dueDays, setting);
            }
          }
          penalty = Math.round(penalty);

          const isNPA = oldestUnpaid && dueDays > 90;

          // Installments split estimate
          const totalLoanRepayable = dues.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
          const totalPrincipal = Number(loan.amount);
          const totalInterest = totalLoanRepayable - totalPrincipal;
          const interestRatio = totalLoanRepayable > 0 ? totalInterest / totalLoanRepayable : 0;
          const interestPaid = totalPaid * interestRatio;
          const pendingInterest = presentDue * interestRatio;

          formatted.push({
            id: loan.id,
            loanId: loan.loan_id,
            customerName: loan.customer?.name || 'N/A',
            loanCategory: loan.loan_category || 'Regular',
            loanType: type,
            loanAmount: Number(loan.amount),
            currentPrincipal: Number(loan.amount) - (totalPaid * (1 - interestRatio)),
            loanDate: loan.date,
            currentDueDate,
            interestPaid,
            pendingInterest,
            penalty,
            presentDue: presentDue + penalty,
            dueDays: dueDays > 0 ? dueDays : 0,
            isNPA,
            phone: loan.customer?.phone || '',
            g1Name: g1?.name || '',
            g1Phone: g1?.phone || '',
            g2Name: g2?.name || '',
            g2Phone: g2?.phone || '',
            partnerName: loan.customer?.partner_name || 'Unassigned'
          });
        }
      });

      setDues(formatted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dues ledger');
    } finally {
      setLoading(false);
    }
  };


  const filteredDues = useMemo(() => {
    return dues.filter(due => {
      // 1. Report Type Filter
      if (activeReport === 'OUTSTANDING') {
        if (due.presentDue <= 0 && due.dueDays <= 0) return false;
      } else if (activeReport === 'NPA LIST') {
        if (!due.isNPA) return false;
      } else if (activeReport === 'CD DUE LIST') {
        if (due.loanType !== 'CD') return false;
      } else if (activeReport === 'A -> B DUE LIST') {
        if (startDate && due.currentDueDate < startDate) return false;
        if (endDate && due.currentDueDate > endDate) return false;
      }

      // 2. Partner Filter
      if (selectedPartner !== 'ALL PARTNERS' && due.partnerName !== selectedPartner) return false;

      // 3. Loan Type Filter
      if (loanTypeFilter !== 'ALL' && due.loanType !== loanTypeFilter) return false;

      // 4. Search Filter
      if (searchName && !due.customerName.toLowerCase().includes(searchName.toLowerCase()) && !due.loanId.toLowerCase().includes(searchName.toLowerCase())) return false;

      return true;
    });
  }, [dues, activeReport, selectedPartner, loanTypeFilter, searchName, startDate, endDate]);

  const totals = useMemo(() => {
    let principal = 0;
    let interest = 0;
    let penalty = 0;
    let presentDue = 0;

    filteredDues.forEach(d => {
      principal += d.currentPrincipal;
      interest += d.pendingInterest;
      penalty += d.penalty;
      presentDue += d.presentDue;
    });

    return { principal, interest, penalty, presentDue };
  }, [filteredDues]);

  const renderReportMenu = () => {
    const options: ReportType[] = ['OUTSTANDING', 'TOTAL DUE LIST', 'CD DUE LIST', 'A -> B DUE LIST', 'NPA LIST'];
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-slate-900 finance-sidebar-link uppercase font-bold text-xs">REPORT OPTIONS</h3>
        </div>
        <div className="flex flex-col">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveReport(opt)}
              className={`text-left px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${activeReport === opt ? 'bg-[#0b1329] text-white font-bold' : 'text-slate-700 hover:bg-slate-50' } finance-header-time uppercase`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 print:p-0">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">Dues List</h1>
          <p className="finance-small-label uppercase">
            Outstanding, NPA, and Partner-wise collection lists
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print Landscape
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Partner Select Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-center p-4">
          <span className="text-slate-400 block mb-1 finance-small-label uppercase">Partner</span>
          <select
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase font-bold"
          >
            <option value="ALL PARTNERS">ALL PARTNERS</option>
            {partners.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Loan Type Select Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-center p-4">
          <span className="text-slate-400 block mb-1 finance-small-label uppercase">Loan Type</span>
          <select
            value={loanTypeFilter}
            onChange={(e) => setLoanTypeFilter(e.target.value as any)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase font-bold"
          >
            <option value="ALL">ALL TYPES</option>
            <option value="CD">CD LOANS</option>
            <option value="HP">HP LOANS</option>
            <option value="STBD">STBD LOANS</option>
            <option value="TBD">TBD LOANS</option>
          </select>
        </div>

        {/* Present Dues Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Total Present Dues</span>
          <span className="text-red-600 mt-1 finance-money">₹{totals.presentDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Records Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Eligible Accounts</span>
          <span className="text-slate-900 mt-1 finance-money">{filteredDues.length}</span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar Menu */}
        <div className="lg:col-span-1">
          {renderReportMenu()}
        </div>

        {/* Right Main Table */}
        <div className="lg:col-span-3 space-y-4">
          <Card
            title={
              <div className="flex justify-between items-center w-full">
                <span className="finance-card-title uppercase">{activeReport} ({loanTypeFilter})</span>
              </div>
            }
            className="shadow-md border-slate-150 rounded-xl overflow-hidden"
          >
            {/* Search Filters Row */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50/50">
              <div className="md:col-span-1">
                <Input
                  label="Search Account / Name"
                  placeholder="e.g. CD100, NARSIMULU"
                  value={searchName}
                  onChange={setSearchName}
                  icon={Search}
                />
              </div>

              {activeReport === 'A -> B DUE LIST' && (
                <>
                  <Input
                    label="From Date"
                    type="date"
                    value={startDate}
                    onChange={setStartDate}
                    icon={Calendar}
                  />
                  <Input
                    label="To Date"
                    type="date"
                    value={endDate}
                    onChange={setEndDate}
                    icon={Calendar}
                  />
                </>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
              </div>
            ) : filteredDues.length === 0 ? (
              <div className="text-center py-16 border-t border-slate-100">
                <p className="text-slate-400 finance-sidebar-link uppercase">No Due Accounts Found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-150 text-[11px] finance-caption">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-2 border-r finance-small-label uppercase w-8">Sl No</th>
                      <th className="p-2 border-r finance-small-label uppercase w-20">Loan No</th>
                      <th className="p-2 border-r finance-small-label uppercase">Party Name</th>
                      <th className="p-2 border-r finance-small-label uppercase w-14">Type</th>
                      <th className="p-2 border-r text-right finance-small-label uppercase w-20">Principal</th>
                      <th className="p-2 border-r text-right finance-small-label uppercase w-20">Int. Paid</th>
                      <th className="p-2 border-r text-right finance-small-label uppercase w-20">Pend. Int</th>
                      <th className="p-2 border-r text-right finance-small-label uppercase w-16">Penalty</th>
                      <th className="p-2 border-r text-right finance-small-label uppercase w-20 font-black">Present Due</th>
                      <th className="p-2 border-r finance-small-label uppercase w-20">Due Date</th>
                      <th className="p-2 border-r text-center finance-small-label uppercase w-12">Days</th>
                      <th className="p-2 finance-small-label uppercase">Contact (Borrower & Guarantors)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 font-mono">
                    {filteredDues.map((due, idx) => (
                      <tr key={due.id} className={`hover:bg-slate-50/40 ${due.isNPA ? 'bg-red-50/20' : ''}`}>
                        <td className="p-2 border-r text-slate-500 font-sans text-center">{idx + 1}</td>
                        <td className="p-2 border-r font-bold text-blue-600">{due.loanId}</td>
                        <td className="p-2 border-r text-slate-900 font-sans font-bold">{due.customerName}</td>
                        <td className="p-2 border-r text-slate-650 font-sans text-center">{due.loanType}</td>
                        <td className="p-2 border-r text-right text-slate-700">₹{Math.round(due.currentPrincipal).toLocaleString('en-IN')}</td>
                        <td className="p-2 border-r text-right text-emerald-650">₹{Math.round(due.interestPaid).toLocaleString('en-IN')}</td>
                        <td className="p-2 border-r text-right text-orange-600">₹{Math.round(due.pendingInterest).toLocaleString('en-IN')}</td>
                        <td className="p-2 border-r text-right text-red-500">₹{Math.round(due.penalty).toLocaleString('en-IN')}</td>
                        <td className="p-2 border-r text-right text-red-650 font-sans font-black">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                        <td className="p-2 border-r text-slate-600 font-sans whitespace-nowrap">{due.currentDueDate.split('-').reverse().join('/')}</td>
                        <td className="p-2 border-r text-center text-red-650 font-bold">{due.dueDays}</td>
                        <td className="p-2 font-sans text-[10px] text-slate-600 space-y-0.5 whitespace-nowrap">
                          <div><span className="font-semibold text-slate-900">B:</span> {due.phone || '—'}</div>
                          {due.g1Name && (
                            <div><span className="font-semibold text-slate-900">G1:</span> {due.g1Name} ({due.g1Phone || '—'})</div>
                          )}
                          {due.g2Name && (
                            <div><span className="font-semibold text-slate-900">G2:</span> {due.g2Name} ({due.g2Phone || '—'})</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Overall Summary Row */}
                    <tr className="bg-slate-50 font-sans font-extrabold border-t-2 border-slate-200 text-[10px]">
                      <td colSpan={4} className="p-2 border-r text-right text-slate-800 uppercase">Grand Total:</td>
                      <td className="p-2 border-r text-right text-slate-800">₹{Math.round(totals.principal).toLocaleString('en-IN')}</td>
                      <td className="p-2 border-r text-right text-slate-800"></td>
                      <td className="p-2 border-r text-right text-orange-700">₹{Math.round(totals.interest).toLocaleString('en-IN')}</td>
                      <td className="p-2 border-r text-right text-red-600">₹{Math.round(totals.penalty).toLocaleString('en-IN')}</td>
                      <td className="p-2 border-r text-right text-red-700 font-black text-xs">₹{Math.round(totals.presentDue).toLocaleString('en-IN')}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Collection Dues Report"
        documentTitle={`DUES_LIST_${activeReport}_${loanTypeFilter}`}
        orientation="landscape"
      >
        {!loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-900 pb-2">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
                <p className="text-xs uppercase text-slate-500">Collection Dues Ledger ({activeReport} - {loanTypeFilter})</p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p>Date: {new Date().toLocaleDateString('en-IN')}</p>
                <p>Partner: {selectedPartner}</p>
              </div>
            </div>

            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b-2 border-slate-850 bg-slate-100">
                  <th className="p-1 border text-center font-bold">Sl No</th>
                  <th className="p-1 border font-bold">Loan No</th>
                  <th className="p-1 border font-bold">Party Name</th>
                  <th className="p-1 border text-center font-bold">Type</th>
                  <th className="p-1 border text-right font-bold">Principal</th>
                  <th className="p-1 border text-right font-bold">Int. Paid</th>
                  <th className="p-1 border text-right font-bold">Pend. Int</th>
                  <th className="p-1 border text-right font-bold">Penalty</th>
                  <th className="p-1 border text-right font-bold">Present Due</th>
                  <th className="p-1 border font-bold">Due Date</th>
                  <th className="p-1 border text-center font-bold">Days</th>
                  <th className="p-1 border font-bold">Phone Details (Borrower & Guarantors)</th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map((due, idx) => (
                  <tr key={due.id} className="border-b">
                    <td className="p-1 border text-center">{idx + 1}</td>
                    <td className="p-1 border font-bold text-blue-800">{due.loanId}</td>
                    <td className="p-1 border font-bold">{due.customerName}</td>
                    <td className="p-1 border text-center">{due.loanType}</td>
                    <td className="p-1 border text-right">₹{Math.round(due.currentPrincipal).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-green-700">₹{Math.round(due.interestPaid).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-orange-700">₹{Math.round(due.pendingInterest).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-red-600">₹{Math.round(due.penalty).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right font-bold text-red-700">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                    <td className="p-1 border whitespace-nowrap">{due.currentDueDate.split('-').reverse().join('/')}</td>
                    <td className="p-1 border text-center text-red-600 font-bold">{due.dueDays}</td>
                    <td className="p-1 border font-sans text-[9px] leading-tight whitespace-nowrap">
                      <div><span className="font-semibold">B:</span> {due.phone || '—'}</div>
                      {due.g1Name && (
                        <div><span className="font-semibold font-sans">G1:</span> {due.g1Name} ({due.g1Phone || '—'})</div>
                      )}
                      {due.g2Name && (
                        <div><span className="font-semibold font-sans">G2:</span> {due.g2Name} ({due.g2Phone || '—'})</div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-800">
                  <td colSpan={4} className="p-1 border text-right uppercase">Total:</td>
                  <td className="p-1 border text-right">₹{Math.round(totals.principal).toLocaleString('en-IN')}</td>
                  <td className="p-1 border"></td>
                  <td className="p-1 border text-right">₹{Math.round(totals.interest).toLocaleString('en-IN')}</td>
                  <td className="p-1 border text-right">₹{Math.round(totals.penalty).toLocaleString('en-IN')}</td>
                  <td className="p-1 border text-right text-red-700">₹{Math.round(totals.presentDue).toLocaleString('en-IN')}</td>
                  <td colSpan={3} className="border"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default DuesLedger;
