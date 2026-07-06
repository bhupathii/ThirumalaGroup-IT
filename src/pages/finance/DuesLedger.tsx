import React, { useEffect, useState, useMemo } from 'react';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, ArrowLeft, Search } from 'lucide-react';
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
          // CD inclusive-cycle rule: loanDate = Day 1, so dueDate = loanDate + (periodDays - 1)
          const periodDays = loan.period_days || 30;
          const baseDueDateStr = financeCalculationService.addCalendarDays(originalLoanDateStr, periodDays - 1);
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

  const options: ReportType[] = ['OUTSTANDING', 'TOTAL DUE LIST', 'CD DUE LIST', 'A -> B DUE LIST', 'NPA LIST'];

  return (
    <div className="flex flex-col gap-2 w-full max-w-[100%] mx-auto px-4 pt-3 pb-4 print:p-0">

      {/* ── ROW 1: Header ───────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[15px] font-black uppercase text-slate-900 tracking-wide leading-none">Dues List</h1>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Outstanding · NPA · Partner Collection</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 text-[12px] font-bold uppercase shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1329] text-white rounded-lg hover:bg-slate-800 text-[12px] font-bold uppercase shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Landscape
          </button>
        </div>
      </div>

      {/* ── ROW 2: Filters + Summary (single horizontal bar) ────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-3">

          {/* Partner */}
          <div className="flex flex-col min-w-[160px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Partner</label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 uppercase bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer h-[34px]"
            >
              <option value="ALL PARTNERS">ALL PARTNERS</option>
              {partners.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Loan Type */}
          <div className="flex flex-col min-w-[130px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Loan Type</label>
            <select
              value={loanTypeFilter}
              onChange={(e) => setLoanTypeFilter(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 uppercase bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer h-[34px]"
            >
              <option value="ALL">ALL TYPES</option>
              <option value="CD">CD LOANS</option>
              <option value="HP">HP LOANS</option>
              <option value="STBD">STBD LOANS</option>
              <option value="TBD">TBD LOANS</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Search Account / Name</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. CD100, NARSIMULU"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-slate-800 font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]"
              />
            </div>
          </div>

          {/* A→B date filters — only shown when tab is active */}
          {activeReport === 'A -> B DUE LIST' && (
            <>
              <div className="flex flex-col min-w-[130px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">From Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]" />
              </div>
              <div className="flex flex-col min-w-[130px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">To Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]" />
              </div>
            </>
          )}

          {/* ── Summary Metrics (right side) ───────────────────────────────── */}
          <div className="flex items-stretch gap-2 ml-auto flex-wrap">
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 flex flex-col justify-center min-w-[140px]">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-wider leading-none">Total Present Dues</span>
              <span className="text-red-650 text-[17px] font-black font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                ₹{totals.presentDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex flex-col justify-center min-w-[100px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider leading-none">Accounts</span>
              <span className="text-slate-900 text-[22px] font-black font-mono tracking-tight leading-tight mt-0.5">
                {filteredDues.length}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ── ROW 3: Report Type Tabs ──────────────────────────────────────────── */}
      <div className="bg-slate-100 px-1.5 py-1 rounded-xl border border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveReport(opt)}
              className={`flex-1 min-w-[130px] text-center px-3 py-2 rounded-lg text-[12px] font-extrabold tracking-wide uppercase transition-all duration-150 ${
                activeReport === opt
                  ? 'bg-[#0b1329] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROW 4: Dues Table ────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Compact section header */}
        <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[12px] font-black uppercase text-slate-700 tracking-wide">{activeReport} — {loanTypeFilter}</span>
          <span className="text-[11px] text-slate-400 font-semibold uppercase">{filteredDues.length} records</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-slate-900"></div>
          </div>
        ) : filteredDues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 font-bold uppercase text-[13px]">No Due Accounts Found</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <table className="min-w-full divide-y divide-slate-150 finance-caption">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                <tr className="bg-slate-50">
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-center w-10 bg-slate-50 finance-small-label">Sl</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-left w-20 bg-slate-50 finance-small-label">Loan No</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Party Name</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-center w-14 bg-slate-50 finance-small-label">Type</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-32 bg-slate-50 finance-small-label">Principal</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-28 bg-slate-50 finance-small-label">Int. Paid</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-28 bg-slate-50 finance-small-label">Pend. Int</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-24 bg-slate-50 finance-small-label">Penalty</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-32 bg-slate-50 finance-small-label font-black">Present Due</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 w-28 bg-slate-50 finance-small-label">Due Date</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-800 w-16 bg-slate-50 finance-small-label">Days</th>
                  <th className="px-2 py-1.5 text-slate-800 text-left bg-slate-50 finance-small-label">Contact (B / G1 / G2)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-mono text-[13px]">
                {filteredDues.map((due, idx) => (
                  <tr key={due.id} className={`hover:bg-slate-50/40 transition-colors ${due.isNPA ? 'bg-red-50/20' : ''}`}>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-500 font-sans text-center text-[13px] font-semibold">{idx + 1}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 font-bold text-blue-650 text-[13px] whitespace-nowrap">{due.loanId}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-905 font-sans font-bold text-[13px]">{due.customerName}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600 font-sans text-center text-[13px] font-semibold">{due.loanType}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-slate-700 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.currentPrincipal).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-emerald-700 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.interestPaid).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-orange-600 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.pendingInterest).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-red-650 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.penalty).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-slate-950 font-sans text-[13px] font-bold whitespace-nowrap">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600 font-sans whitespace-nowrap text-[13px] font-semibold">{due.currentDueDate.split('-').reverse().join('/')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-center text-red-650 text-[13px] font-bold whitespace-nowrap">{due.dueDays}</td>
                    <td className="px-2 py-1.5 font-sans text-[13px] text-slate-600 space-y-0.5">
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
                {/* Grand Total Row */}
                <tr className="bg-slate-50 font-sans font-extrabold border-t-2 border-slate-200 text-[13px]">
                  <td colSpan={4} className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 uppercase">Grand Total:</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.principal).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 font-bold text-[13px]"></td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-orange-750 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.interest).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-red-650 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.penalty).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-950 font-black text-[13px] whitespace-nowrap">₹{Math.round(totals.presentDue).toLocaleString('en-IN')}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
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
            <p className="text-[13px] uppercase text-slate-500">Collection Dues Ledger ({activeReport} - {loanTypeFilter})</p>
              </div>
              <div className="text-right text-[13px] text-slate-600">
                <p>Date: {new Date().toLocaleDateString('en-IN')}</p>
                <p>Partner: {selectedPartner}</p>
              </div>
            </div>

            <table className="w-full border-collapse" style={{ tableLayout: 'auto', fontSize: '10pt' }}>
              <colgroup>
                {/* Sl   Loan    Name     Type   Principal IntPaid  PendInt  Penalty  PresentDue DueDate  Days   Phone */}
                <col style={{ width: '3%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '19%' }} />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-slate-850 bg-slate-100">
                  <th className="p-1 border text-center font-bold print-nowrap">Sl No</th>
                  <th className="p-1 border font-bold print-nowrap">Loan No</th>
                  <th className="p-1 border font-bold print-wrap">Party Name</th>
                  <th className="p-1 border text-center font-bold print-nowrap">Type</th>
                  <th className="p-1 border text-right font-bold print-nowrap">Principal</th>
                  <th className="p-1 border text-right font-bold print-nowrap">Int. Paid</th>
                  <th className="p-1 border text-right font-bold print-nowrap">Pend. Int</th>
                  <th className="p-1 border text-right font-bold print-nowrap">Penalty</th>
                  <th className="p-1 border text-right font-bold print-nowrap">Present Due</th>
                  <th className="p-1 border font-bold print-nowrap">Due Date</th>
                  <th className="p-1 border text-center font-bold print-nowrap">Days</th>
                  <th className="p-1 border font-bold print-wrap">Phone Details (Borrower &amp; Guarantors)</th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map((due, idx) => (
                  <tr key={due.id} className="border-b">
                    <td className="p-1 border text-center print-nowrap">{idx + 1}</td>
                    <td className="p-1 border font-bold text-blue-800 print-nowrap">{due.loanId}</td>
                    <td className="p-1 border font-bold print-wrap">{due.customerName}</td>
                    <td className="p-1 border text-center print-nowrap">{due.loanType}</td>
                    <td className="p-1 border text-right print-amount">₹{Math.round(due.currentPrincipal).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-green-700 print-amount">₹{Math.round(due.interestPaid).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-orange-700 print-amount">₹{Math.round(due.pendingInterest).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-red-600 print-amount">₹{Math.round(due.penalty).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right font-bold text-red-700 print-amount">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                    <td className="p-1 border print-nowrap">{due.currentDueDate.split('-').reverse().join('/')}</td>
                    <td className="p-1 border text-center text-red-600 font-bold print-nowrap">{due.dueDays}</td>
                    <td className="p-1 border font-sans text-[9.5pt] leading-snug print-wrap">
                      <div><span className="font-semibold">B:</span> {due.phone || '—'}</div>
                      {due.g1Name && (
                        <div><span className="font-semibold">G1:</span> {due.g1Name} ({due.g1Phone || '—'})</div>
                      )}
                      {due.g2Name && (
                        <div><span className="font-semibold">G2:</span> {due.g2Name} ({due.g2Phone || '—'})</div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-800 print-total">
                  <td colSpan={4} className="p-1 border text-right uppercase print-wrap">Grand Total:</td>
                  <td className="p-1 border text-right print-amount">₹{Math.round(totals.principal).toLocaleString('en-IN')}</td>
                  <td className="p-1 border print-nowrap"></td>
                  <td className="p-1 border text-right print-amount">₹{Math.round(totals.interest).toLocaleString('en-IN')}</td>
                  <td className="p-1 border text-right print-amount">₹{Math.round(totals.penalty).toLocaleString('en-IN')}</td>
                  <td className="p-1 border text-right text-red-700 print-amount">₹{Math.round(totals.presentDue).toLocaleString('en-IN')}</td>
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
