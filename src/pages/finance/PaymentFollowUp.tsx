import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance, FinanceLoanPaymentFollowup } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Clock, 
  AlertTriangle, 
  ClipboardList, 
  Printer, 
  Search,
  MessageSquare,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
import { useAuth } from '../../contexts/AuthContext';

interface ActiveDueLoan {
  id: string;
  loanId: string;
  customerName: string;
  loanCategory: string;
  loanType: 'CD' | 'HP' | 'STBD' | 'TBD';
  loanAmount: number;
  currentPrincipal: number;
  loanDate: string;
  currentDueDate: string;
  pendingInterest: number;
  penalty: number;
  presentDue: number;
  dueDays: number;
  phone: string;
  g1Name: string;
  g1Phone: string;
  g2Name: string;
  g2Phone: string;
  partnerName: string;
  status: string;
  // Follow up state
  lastFollowUp?: FinanceLoanPaymentFollowup;
  nextFollowUpDate: string | null;
}

type FollowUpTab = 'ACTIVE_QUEUE' | 'TODAYS' | 'UPCOMING' | 'MISSED' | 'HISTORY';

const PaymentFollowUp: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Loading and Data States
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<ActiveDueLoan[]>([]);
  const [followUps, setFollowUps] = useState<FinanceLoanPaymentFollowup[]>([]);
  const [, setAllLoansMap] = useState<Map<string, any>>(new Map());

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<FollowUpTab>('ACTIVE_QUEUE');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState<'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD'>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL STAFF');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Follow-up Form Modal State
  const [selectedLoan, setSelectedLoan] = useState<ActiveDueLoan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [contactedPerson, setContactedPerson] = useState<'CUSTOMER' | 'GUARANTOR_1' | 'GUARANTOR_2' | 'OTHER'>('CUSTOMER');
  const [result, setResult] = useState<'ANSWERED' | 'NO_ANSWER' | 'PROMISED_PAYMENT' | 'CALL_BACK_LATER' | 'GUARANTOR_CONTACTED' | 'OTHER'>('ANSWERED');
  const [narration, setNarration] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  // Print Preview state
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Loans with borrower details
      const { data: loansData, error: loansError } = await supabase
        .from('finance_loans')
        .select(`
          *,
          customer:finance_customers!customer_id(*)
        `);
      if (loansError) throw loansError;

      // Fetch all customers for in-memory guarantor resolution
      const { data: allCustomers, error: custError } = await supabase
        .from('finance_customers')
        .select('id, name, phone');
      if (custError) throw custError;

      const customerMap = new Map<string, { name: string; phone: string }>(
        (allCustomers || []).map((c: any) => [c.id, { name: c.name || '', phone: c.phone || '' }])
      );

      // 2. Fetch Dues (for HP/STBD/TBD calculations)
      const { data: duesData, error: duesError } = await supabase
        .from('finance_dues')
        .select('*');
      if (duesError) throw duesError;

      // 3. Fetch CD Ledger Entries
      const { data: cdEntries, error: cdEntriesError } = await supabase
        .from('finance_cd_ledger_entries')
        .select('*');
      if (cdEntriesError) throw cdEntriesError;

      // 4. Fetch CD Interest Details
      const { data: cdInterest, error: cdInterestError } = await supabase
        .from('finance_cd_interest_details')
        .select('*');
      if (cdInterestError) throw cdInterestError;

      // 5. Fetch Followup records
      const fetchedFollowups = await supabaseFinance.getFollowUps();
      setFollowUps(fetchedFollowups);

      // Build customer mapping & loan map for history references
      const loanMap = new Map();
      (loansData || []).forEach((l: any) => loanMap.set(l.id, l));
      setAllLoansMap(loanMap);

      const ledgerSettings = await financeLedgerSettingsService.getAllLedgerSettings();

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const calculatedLoans: ActiveDueLoan[] = [];

      (loansData || []).forEach((loan: any) => {
        const type = loan.loan_id.startsWith('CD') ? 'CD' : loan.loan_id.startsWith('HP') ? 'HP' : loan.loan_id.startsWith('STBD') ? 'STBD' : 'TBD';
        const g1 = loan.guarantor_1_id ? customerMap.get(loan.guarantor_1_id) : null;
        const g2 = loan.guarantor_2_id ? customerMap.get(loan.guarantor_2_id) : null;

        let principalBalance = 0;
        let pendingInterest = 0;
        let penalty = 0;
        let presentDue = 0;
        let dueDays = 0;
        let currentDueDateStr = loan.date;
        let originalLoanDateStr = loan.date;

        if (type === 'CD') {
          // CD Loan calculations
          const entries = (cdEntries || []).filter((e: any) => e.loan_id === loan.id);
          const interestDetails = (cdInterest || []).filter((d: any) => d.loan_id === loan.id);

          const disb = entries
            .filter((e: any) => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
            .reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
          const repaid = entries
            .filter((e: any) => e.entry_type === 'principal_payment' || e.account_name === 'CD A/C')
            .reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
          principalBalance = disb - repaid;

          const disbEntry = entries
            .filter((e: any) => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
            .sort((a: any, b: any) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())[0];
          originalLoanDateStr = disbEntry ? disbEntry.entry_date.split('T')[0] : loan.date.split('T')[0];

          const periodDays = loan.period_days || 30;
          const baseDueDateStr = financeCalculationService.addCalendarDays(originalLoanDateStr, periodDays);
          const totalRenewedDays = interestDetails
            .filter((d: any) => Number(d.credit) === 0)
            .reduce((sum: number, d: any) => sum + (Number(d.renewed_days) || 0), 0);
          currentDueDateStr = financeCalculationService.addCalendarDays(baseDueDateStr, totalRenewedDays);

          dueDays = financeCalculationService.differenceInCalendarDays(todayStr, currentDueDateStr);
          
          const interestRate = Number(loan.interest_rate) || 3;
          const penaltyRate = Number(loan.penalty_percent) || 0.75;
          const graceDays = Number(loan.grace_days) || 5;

          if (dueDays > 0) {
            pendingInterest = Number(((principalBalance * interestRate * dueDays) / periodDays / 100).toFixed(2));
            if (dueDays > graceDays) {
              penalty = Number(((principalBalance * penaltyRate * dueDays) / periodDays / 100).toFixed(2));
            }
            presentDue = pendingInterest + penalty;
          }
        } else {
          // HP/STBD/TBD calculations
          const dues = (duesData || []).filter((d: any) => d.loan_id === loan.id);
          const unpaidDues = dues.filter((d: any) => d.status !== 'Paid');
          const sortedUnpaid = [...unpaidDues].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          const oldestUnpaid = sortedUnpaid[0];

          currentDueDateStr = oldestUnpaid ? oldestUnpaid.due_date : loan.date;
          dueDays = oldestUnpaid ? Math.round((today.getTime() - new Date(oldestUnpaid.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          
          const pastUnpaidDues = unpaidDues.filter((d: any) => d.due_date <= todayStr);
          const unpaidPresentDue = pastUnpaidDues.reduce((sum: number, d: any) => sum + (Number(d.amount) - Number(d.paid_amount || 0)), 0);

          const totalPaid = dues.reduce((sum: number, d: any) => sum + Number(d.paid_amount || 0), 0);

          if (oldestUnpaid && dueDays > 0) {
            const cat = loan.loan_category?.trim().toUpperCase() || 'CD';
            const setting = ledgerSettings[cat] || ledgerSettings['CD'];
            if (setting) {
              penalty = financeCalculationService.calculatePenaltyFromSetting(unpaidPresentDue, dueDays, setting);
            }
          }
          penalty = Math.round(penalty);

          const totalLoanRepayable = dues.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
          const totalPrincipal = Number(loan.amount);
          const totalInterest = totalLoanRepayable - totalPrincipal;
          const interestRatio = totalLoanRepayable > 0 ? totalInterest / totalLoanRepayable : 0;
          pendingInterest = unpaidPresentDue * interestRatio;

          principalBalance = Number(loan.amount) - (totalPaid * (1 - interestRatio));
          presentDue = unpaidPresentDue + penalty;
        }

        // Get this loan's follow-up history
        const loanFollowups = fetchedFollowups
          .filter((f: any) => f.loan_id === loan.id)
          .sort((a, b) => new Date(b.followed_up_at).getTime() - new Date(a.followed_up_at).getTime());

        const lastFollowUp = loanFollowups[0];
        const nextFollowUpDate = lastFollowUp ? lastFollowUp.next_follow_up_date : null;

        calculatedLoans.push({
          id: loan.id,
          loanId: loan.loan_id,
          customerName: loan.customer?.name || 'N/A',
          loanCategory: loan.loan_category || 'General',
          loanType: type,
          loanAmount: Number(loan.amount),
          currentPrincipal: principalBalance,
          loanDate: originalLoanDateStr,
          currentDueDate: currentDueDateStr,
          pendingInterest,
          penalty,
          presentDue,
          dueDays: dueDays > 0 ? dueDays : 0,
          phone: loan.customer?.phone || '',
          g1Name: g1?.name || '',
          g1Phone: g1?.phone || '',
          g2Name: g2?.name || '',
          g2Phone: g2?.phone || '',
          partnerName: loan.customer?.partner_name || 'Unassigned',
          status: loan.status,
          lastFollowUp,
          nextFollowUpDate
        });
      });

      setLoans(calculatedLoans);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load collection follow-ups data');
    } finally {
      setLoading(false);
    }
  };

  // Staff list for filter
  const staffList = useMemo(() => {
    const staffSet = new Set<string>();
    followUps.forEach(f => {
      if (f.followed_up_by) staffSet.add(f.followed_up_by);
    });
    return Array.from(staffSet);
  }, [followUps]);

  // Tab calculations
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const categorizedLoans = useMemo(() => {
    // Only Active Loans are eligible for active queues
    const activeDueLoans = loans.filter(l => l.status === 'Active' && l.presentDue > 0);

    return {
      ACTIVE_QUEUE: activeDueLoans,
      TODAYS: activeDueLoans.filter(l => l.nextFollowUpDate === todayDateStr),
      UPCOMING: activeDueLoans.filter(l => l.nextFollowUpDate && l.nextFollowUpDate > todayDateStr),
      MISSED: activeDueLoans.filter(l => l.nextFollowUpDate && l.nextFollowUpDate < todayDateStr)
    };
  }, [loans, todayDateStr]);

  // Main UI Filter Logic
  const filteredList = useMemo(() => {
    if (activeTab === 'HISTORY') return [];

    let list = categorizedLoans[activeTab as keyof typeof categorizedLoans] || [];

    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      list = list.filter(l => 
        l.loanId.toLowerCase().includes(query) || 
        l.customerName.toLowerCase().includes(query) ||
        l.phone.toLowerCase().includes(query)
      );
    }

    // Loan type
    if (loanTypeFilter !== 'ALL') {
      list = list.filter(l => l.loanType === loanTypeFilter);
    }

    return list;
  }, [categorizedLoans, activeTab, searchQuery, loanTypeFilter]);

  // Unified History Records for history tab/report
  const filteredHistory = useMemo(() => {
    if (activeTab !== 'HISTORY') return [];

    let list = [...followUps];

    // Staff filter
    if (staffFilter !== 'ALL STAFF') {
      list = list.filter(f => f.followed_up_by === staffFilter);
    }

    // Date filter
    if (dateFilter) {
      list = list.filter(f => f.follow_up_date === dateFilter);
    }

    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      list = list.filter(f => {
        const loanNo = f.loan?.loan_id || '';
        const custName = f.loan?.customer?.name || '';
        const narration = f.narration || '';
        return (
          loanNo.toLowerCase().includes(query) ||
          custName.toLowerCase().includes(query) ||
          narration.toLowerCase().includes(query)
        );
      });
    }

    // Filter by loan type
    if (loanTypeFilter !== 'ALL') {
      list = list.filter(f => {
        const loanNo = f.loan?.loan_id || '';
        const type = loanNo.startsWith('CD') ? 'CD' : loanNo.startsWith('HP') ? 'HP' : loanNo.startsWith('STBD') ? 'STBD' : 'TBD';
        return type === loanTypeFilter;
      });
    }

    return list;
  }, [followUps, activeTab, staffFilter, dateFilter, searchQuery, loanTypeFilter]);

  // Open Log Modal
  const handleOpenFollowUpModal = (loan: ActiveDueLoan) => {
    setSelectedLoan(loan);
    setContactedPerson('CUSTOMER');
    setResult('ANSWERED');
    setNarration('');
    setNextFollowUpDate('');
    setShowModal(true);
  };

  // Quick next date calculator helpers
  const handleSetQuickDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNextFollowUpDate(d.toISOString().split('T')[0]);
  };

  // Save followup record
  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    if (!narration.trim()) {
      toast.error('Please enter a narration / call summary');
      return;
    }

    setSubmitting(true);
    const staffName = user?.username || 'Staff';

    const payload = {
      loan_id: selectedLoan.id,
      follow_up_date: new Date().toISOString().split('T')[0],
      followed_up_by: staffName,
      contacted_person: contactedPerson,
      result: result,
      narration: narration.trim(),
      next_follow_up_date: nextFollowUpDate || null
    };

    try {
      const result = await supabaseFinance.createFollowUp(payload);
      if (result) {
        toast.success('Follow-up record logged successfully');
        setShowModal(false);
        fetchData();
      } else {
        toast.error('Failed to log follow-up record');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error logging follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // Get selected loan specific history (sorted)
  const selectedLoanHistory = useMemo(() => {
    if (!selectedLoan) return [];
    return followUps
      .filter(f => f.loan_id === selectedLoan.id)
      .sort((a, b) => new Date(b.followed_up_at).getTime() - new Date(a.followed_up_at).getTime());
  }, [selectedLoan, followUps]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 print:p-0 select-none">
      
      {/* Top Header Actions */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h1 className="finance-h1">Collection Follow-up Dashboard</h1>
          <p className="finance-small-label uppercase">
            Active overdue callbacks, next scheduled actions & staff accountability
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={() => setShowPrintModal(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print Landscape
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:hidden">
        <div 
          onClick={() => setActiveTab('ACTIVE_QUEUE')}
          className={`cursor-pointer bg-white p-4 rounded-xl border-2 transition-all flex flex-col justify-center ${activeTab === 'ACTIVE_QUEUE' ? 'border-[#0b1329] shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="text-slate-405 block finance-small-label uppercase">Active Due Queue</span>
          <span className="text-slate-900 mt-1 font-mono font-black text-xl">{categorizedLoans.ACTIVE_QUEUE.length} Accounts</span>
        </div>

        <div 
          onClick={() => setActiveTab('TODAYS')}
          className={`cursor-pointer bg-white p-4 rounded-xl border-2 transition-all flex flex-col justify-center ${activeTab === 'TODAYS' ? 'border-green-600 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="text-slate-405 block finance-small-label uppercase">Today's Callback Schedules</span>
          <span className="text-green-650 mt-1 font-mono font-black text-xl">{categorizedLoans.TODAYS.length} Accounts</span>
        </div>

        <div 
          onClick={() => setActiveTab('MISSED')}
          className={`cursor-pointer bg-white p-4 rounded-xl border-2 transition-all flex flex-col justify-center ${activeTab === 'MISSED' ? 'border-red-600 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="text-slate-405 block finance-small-label uppercase">Missed Callbacks (Overdue)</span>
          <span className="text-red-655 mt-1 font-mono font-black text-xl">{categorizedLoans.MISSED.length} Accounts</span>
        </div>

        <div 
          onClick={() => setActiveTab('UPCOMING')}
          className={`cursor-pointer bg-white p-4 rounded-xl border-2 transition-all flex flex-col justify-center ${activeTab === 'UPCOMING' ? 'border-blue-600 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="text-slate-405 block finance-small-label uppercase">Upcoming Callbacks</span>
          <span className="text-blue-650 mt-1 font-mono font-black text-xl">{categorizedLoans.UPCOMING.length} Accounts</span>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:hidden">
        
        {/* Left Sidebar Menu */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-slate-900 finance-sidebar-link uppercase font-bold text-xs">Navigation / Views</h3>
            </div>
            <div className="flex flex-col">
              <button
                onClick={() => setActiveTab('ACTIVE_QUEUE')}
                className={`text-left px-4 py-3 border-b border-slate-100 transition-colors flex items-center gap-2 ${activeTab === 'ACTIVE_QUEUE' ? 'bg-[#0b1329] text-white font-bold' : 'text-slate-700 hover:bg-slate-50' } finance-header-time uppercase`}
              >
                <ClipboardList className="w-4 h-4" />
                Active Due Queue
              </button>
              <button
                onClick={() => setActiveTab('TODAYS')}
                className={`text-left px-4 py-3 border-b border-slate-100 transition-colors flex items-center gap-2 ${activeTab === 'TODAYS' ? 'bg-[#0b1329] text-white font-bold' : 'text-slate-700 hover:bg-slate-50' } finance-header-time uppercase`}
              >
                <Clock className="w-4 h-4" />
                Today's Schedules
              </button>
              <button
                onClick={() => setActiveTab('MISSED')}
                className={`text-left px-4 py-3 border-b border-slate-100 transition-colors flex items-center gap-2 ${activeTab === 'MISSED' ? 'bg-[#0b1329] text-white font-bold' : 'text-slate-700 hover:bg-slate-50' } finance-header-time uppercase`}
              >
                <AlertTriangle className="w-4 h-4" />
                Missed Schedules
              </button>
              <button
                onClick={() => setActiveTab('UPCOMING')}
                className={`text-left px-4 py-3 border-b border-slate-100 transition-colors flex items-center gap-2 ${activeTab === 'UPCOMING' ? 'bg-[#0b1329] text-white font-bold' : 'text-slate-700 hover:bg-slate-50' } finance-header-time uppercase`}
              >
                <Calendar className="w-4 h-4" />
                Upcoming Schedules
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`text-left px-4 py-3 border-slate-100 last:border-none transition-colors flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-[#0b1329] text-white font-bold' : 'text-slate-700 hover:bg-slate-50' } finance-header-time uppercase`}
              >
                <History className="w-4 h-4" />
                Staff Callback Reports
              </button>
            </div>
          </div>
        </div>

        {/* Right Main Table Workspace */}
        <div className="lg:col-span-3 space-y-4">
          <Card
            title={
              <div className="flex justify-between items-center w-full">
                <span className="finance-card-title uppercase">
                  {activeTab === 'HISTORY' ? 'Staff Callbacks History Report' : `${activeTab.replace('_', ' ')} list`}
                </span>
              </div>
            }
            className="shadow-md border-slate-150 rounded-xl overflow-hidden"
          >
            {/* Filter Panel Row */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50/50">
              <div className="md:col-span-2">
                <Input
                  label="Search Account / Customer Name"
                  placeholder="e.g. CD100, NARSIMULU"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  icon={Search}
                />
              </div>

              <div className="md:col-span-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Loan Type</span>
                <select
                  value={loanTypeFilter}
                  onChange={(e) => setLoanTypeFilter(e.target.value as any)}
                  className="w-full text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-xs uppercase"
                >
                  <option value="ALL">ALL TYPES</option>
                  <option value="CD">CD Loans</option>
                  <option value="HP">HP Loans</option>
                  <option value="STBD">STBD Loans</option>
                  <option value="TBD">TBD Loans</option>
                </select>
              </div>

              {activeTab === 'HISTORY' && (
                <>
                  <div className="md:col-span-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Staff Member</span>
                    <select
                      value={staffFilter}
                      onChange={(e) => setStaffFilter(e.target.value)}
                      className="w-full text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-xs uppercase"
                    >
                      <option value="ALL STAFF">ALL STAFF</option>
                      {staffList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <Input
                      label="Follow-up Date"
                      type="date"
                      value={dateFilter}
                      onChange={setDateFilter}
                      icon={Calendar}
                    />
                  </div>
                </>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
              </div>
            ) : activeTab === 'HISTORY' ? (
              // HISTORY / REPORT LIST
              filteredHistory.length === 0 ? (
                <div className="text-center py-16 border-t border-slate-100">
                  <p className="text-slate-400 finance-sidebar-link uppercase">No Callback Records Found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-150 text-[11px] finance-caption">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-2 border-r finance-small-label uppercase w-8">Sl No</th>
                        <th className="p-2 border-r finance-small-label uppercase w-20">Loan No</th>
                        <th className="p-2 border-r finance-small-label uppercase">Party Name</th>
                        <th className="p-2 border-r finance-small-label uppercase w-24">Follow-up Date</th>
                        <th className="p-2 border-r finance-small-label uppercase w-20">Staff</th>
                        <th className="p-2 border-r finance-small-label uppercase w-28">Contacted</th>
                        <th className="p-2 border-r finance-small-label uppercase w-28">Result</th>
                        <th className="p-2 border-r finance-small-label uppercase">Narration</th>
                        <th className="p-2 finance-small-label uppercase w-24">Next Follow Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100 font-mono">
                      {filteredHistory.map((item, idx) => {
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/40">
                            <td className="p-2 border-r text-slate-500 font-sans text-center">{idx + 1}</td>
                            <td className="p-2 border-r font-bold text-blue-600">{item.loan?.loan_id || '—'}</td>
                            <td className="p-2 border-r text-slate-900 font-sans font-bold">{item.loan?.customer?.name || 'N/A'}</td>
                            <td className="p-2 border-r text-slate-600 font-sans whitespace-nowrap">{item.follow_up_date.split('-').reverse().join('/')}</td>
                            <td className="p-2 border-r text-slate-700 font-sans font-semibold">{item.followed_up_by}</td>
                            <td className="p-2 border-r text-slate-650 font-sans">{item.contacted_person}</td>
                            <td className={`p-2 border-r font-sans font-bold text-center ${item.result === 'PROMISED_PAYMENT' ? 'text-green-600' : item.result === 'NO_ANSWER' ? 'text-red-500' : 'text-slate-700'}`}>
                              {item.result.replace('_', ' ')}
                            </td>
                            <td className="p-2 border-r text-slate-600 font-sans leading-relaxed max-w-xs truncate" title={item.narration}>{item.narration}</td>
                            <td className="p-2 text-blue-600 font-sans font-bold whitespace-nowrap">
                              {item.next_follow_up_date ? item.next_follow_up_date.split('-').reverse().join('/') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              // ACTIVE & SCHEDULED QUEUES
              filteredList.length === 0 ? (
                <div className="text-center py-16 border-t border-slate-100">
                  <p className="text-slate-400 finance-sidebar-link uppercase">No outstanding accounts in this queue</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-150 text-[11px] finance-caption">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-2 border-r finance-small-label uppercase w-8">Sl No</th>
                        <th className="p-2 border-r finance-small-label uppercase w-20">Loan No</th>
                        <th className="p-2 border-r finance-small-label uppercase">Party Name</th>
                        <th className="p-2 border-r text-right finance-small-label uppercase w-20 font-black">Present Due</th>
                        <th className="p-2 border-r text-center finance-small-label uppercase w-12">Due Days</th>
                        <th className="p-2 border-r finance-small-label uppercase w-20">Current Due Date</th>
                        <th className="p-2 border-r finance-small-label uppercase">Phones (B / G1 / G2)</th>
                        <th className="p-2 border-r finance-small-label uppercase">Latest Callback Summary</th>
                        <th className="p-2 finance-small-label uppercase text-center w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100 font-mono">
                      {filteredList.map((due, idx) => (
                        <tr key={due.id} className="hover:bg-slate-50/40">
                          <td className="p-2 border-r text-slate-500 font-sans text-center">{idx + 1}</td>
                          <td className="p-2 border-r font-bold text-blue-600">{due.loanId}</td>
                          <td className="p-2 border-r text-slate-900 font-sans font-bold">{due.customerName}</td>
                          <td className="p-2 border-r text-right text-red-655 font-sans font-black">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                          <td className="p-2 border-r text-center text-red-655 font-bold">{due.dueDays}</td>
                          <td className="p-2 border-r text-slate-600 font-sans whitespace-nowrap">{due.currentDueDate.split('-').reverse().join('/')}</td>
                          <td className="p-2 border-r font-sans text-[10px] text-slate-600 space-y-0.5 whitespace-nowrap">
                            <div><span className="font-semibold text-slate-900">B:</span> {due.phone || '—'}</div>
                            {due.g1Phone && (
                              <div><span className="font-semibold text-slate-900">G1:</span> {due.g1Name} ({due.g1Phone})</div>
                            )}
                            {due.g2Phone && (
                              <div><span className="font-semibold text-slate-900">G2:</span> {due.g2Name} ({due.g2Phone})</div>
                            )}
                          </td>
                          <td className="p-2 border-r text-slate-600 font-sans max-w-xs">
                            {due.lastFollowUp ? (
                              <div className="leading-tight">
                                <div className="text-[9px] text-slate-400 font-semibold mb-0.5 flex gap-1 items-center">
                                  <span>{due.lastFollowUp.follow_up_date.split('-').reverse().join('/')}</span>
                                  <span>•</span>
                                  <span>{due.lastFollowUp.followed_up_by}</span>
                                  <span>•</span>
                                  <span className="text-indigo-600 font-bold">{due.lastFollowUp.result}</span>
                                </div>
                                <div className="truncate max-w-[200px]" title={due.lastFollowUp.narration}>
                                  {due.lastFollowUp.narration}
                                </div>
                              </div>
                            ) : (
                              <span className="italic text-gray-450">No callbacks logged</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleOpenFollowUpModal(due)}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 rounded border border-indigo-200 transition-colors font-sans font-black text-[10px] uppercase inline-flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Log Call
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </Card>
        </div>
      </div>

      {/* RECORD FOLLOW-UP MODAL */}
      {showModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-150 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0b1329] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Log Call Action / Follow-up</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                  Account: {selectedLoan.loanId} — Borrower: {selectedLoan.customerName}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-450 hover:text-white transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
              
              {/* Account Quick Metrics Summary */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-450 uppercase font-black">Present Dues</span>
                  <span className="text-xs font-black text-red-655 mt-0.5 font-mono">₹{Math.round(selectedLoan.presentDue).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-450 uppercase font-black">Days Overdue</span>
                  <span className="text-xs font-black text-red-655 mt-0.5 font-mono">{selectedLoan.dueDays} Days</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-450 uppercase font-black">Principal Balance</span>
                  <span className="text-xs font-black text-slate-900 mt-0.5 font-mono">₹{Math.round(selectedLoan.currentPrincipal).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Call Details / History Tracker per Loan */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b pb-1 mb-2">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  Callback History for {selectedLoan.loanId}
                </span>
                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {selectedLoanHistory.length === 0 ? (
                    <p className="text-slate-400 italic text-xs py-2">No previous callbacks logged for this loan.</p>
                  ) : (
                    selectedLoanHistory.map((h) => (
                      <div key={h.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-155 leading-relaxed text-xs">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-1 font-sans">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {h.followed_up_by}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {h.follow_up_date.split('-').reverse().join('/')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase rounded border border-indigo-200">
                            {h.contacted_person}
                          </span>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-black uppercase rounded border border-green-200">
                            {h.result.replace('_', ' ')}
                          </span>
                          {h.next_follow_up_date && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black uppercase rounded border border-blue-200 font-mono">
                              Next: {h.next_follow_up_date.split('-').reverse().join('/')}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 font-sans">{h.narration}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Callback Form Form Entry */}
              <form onSubmit={handleSaveFollowUp} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Contacted Person */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-450 block mb-1">Contacted Person</span>
                    <select
                      value={contactedPerson}
                      onChange={(e) => setContactedPerson(e.target.value as any)}
                      className="w-full text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-xs uppercase"
                    >
                      <option value="CUSTOMER">Customer (Borrower)</option>
                      <option value="GUARANTOR_1">Guarantor 1</option>
                      <option value="GUARANTOR_2">Guarantor 2</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  {/* Result */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-455 block mb-1">Call Result</span>
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value as any)}
                      className="w-full text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-xs uppercase"
                    >
                      <option value="ANSWERED">Answered</option>
                      <option value="NO_ANSWER">No Answer</option>
                      <option value="PROMISED_PAYMENT">Promised Payment</option>
                      <option value="CALL_BACK_LATER">Call Back Later</option>
                      <option value="GUARANTOR_CONTACTED">Guarantor Contacted</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                </div>

                {/* Narration */}
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-450 block mb-1">Call Summary / Details</span>
                  <textarea
                    rows={3}
                    placeholder="e.g. Customer promised to pay ₹12,000 on Saturday morning."
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-800 leading-relaxed"
                  />
                </div>

                {/* Next Follow Up Date & Quick Helpers */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-450 block">Schedule Next Follow-up</span>
                    <span className="text-[9px] text-indigo-600 font-extrabold uppercase">Optional Callback Reminder</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-xs uppercase h-10 w-44"
                    />

                    {/* Quick Selector Helpers */}
                    <div className="flex items-center gap-1.5 flex-1">
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(1)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        Tomorrow
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(3)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        +3 Days
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(5)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        +5 Days
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(7)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        +7 Days
                      </button>
                      {nextFollowUpDate && (
                        <button 
                          type="button"
                          onClick={() => setNextFollowUpDate('')}
                          className="h-10 px-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-black text-[9px] uppercase rounded transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-2.5 pt-3 border-t">
                  <Button 
                    type="button"
                    variant="secondary" 
                    size="sm"
                    onClick={() => setShowModal(false)}
                    className="border border-slate-200 text-slate-700 hover:bg-slate-50 finance-header-time uppercase"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    variant="primary" 
                    size="sm"
                    disabled={submitting}
                    className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase flex items-center gap-1.5"
                  >
                    {submitting ? 'Saving...' : 'Save Callback'}
                  </Button>
                </div>

              </form>

            </div>

          </div>
        </div>
      )}

      {/* PRINT PREVIEW LANDSCAPE */}
      <FinancePrintPreview
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Collection Dues Callbacks Report"
        documentTitle={`FOLLOWUPS_LIST_${activeTab}_${loanTypeFilter}`}
        orientation="landscape"
      >
        {!loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-900 pb-2">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
                <p className="text-xs uppercase text-slate-500">Collection Dues Follow-up Report ({activeTab.replace('_', ' ')} - {loanTypeFilter})</p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p>Report Date: {new Date().toLocaleDateString('en-IN')}</p>
                <p>Printed By: {user?.username || 'Staff'}</p>
              </div>
            </div>

            {activeTab === 'HISTORY' ? (
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="border-b-2 border-slate-850 bg-slate-100">
                    <th className="p-1 border text-center font-bold">Sl No</th>
                    <th className="p-1 border font-bold">Loan No</th>
                    <th className="p-1 border font-bold">Party Name</th>
                    <th className="p-1 border font-bold">Follow Date</th>
                    <th className="p-1 border font-bold">Staff Member</th>
                    <th className="p-1 border font-bold">Contacted Person</th>
                    <th className="p-1 border font-bold">Call Result</th>
                    <th className="p-1 border font-bold">Narration / Conversation</th>
                    <th className="p-1 border font-bold">Next Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-1 border text-center">{idx + 1}</td>
                      <td className="p-1 border font-bold text-blue-850">{item.loan?.loan_id || '—'}</td>
                      <td className="p-1 border font-bold">{item.loan?.customer?.name || 'N/A'}</td>
                      <td className="p-1 border">{item.follow_up_date.split('-').reverse().join('/')}</td>
                      <td className="p-1 border font-bold">{item.followed_up_by}</td>
                      <td className="p-1 border">{item.contacted_person}</td>
                      <td className="p-1 border font-bold text-indigo-700">{item.result.replace('_', ' ')}</td>
                      <td className="p-1 border max-w-xs truncate">{item.narration}</td>
                      <td className="p-1 border font-bold">{item.next_follow_up_date ? item.next_follow_up_date.split('-').reverse().join('/') : '—'}</td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center p-4 italic text-slate-400">No callbacks recorded for current filters</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="border-b-2 border-slate-850 bg-slate-100">
                    <th className="p-1 border text-center font-bold">Sl No</th>
                    <th className="p-1 border font-bold">Loan No</th>
                    <th className="p-1 border font-bold">Party Name</th>
                    <th className="p-1 border text-right font-bold">Present Due</th>
                    <th className="p-1 border text-center font-bold">Days</th>
                    <th className="p-1 border font-bold">Due Date</th>
                    <th className="p-1 border font-bold">Borrower Phone</th>
                    <th className="p-1 border font-bold">Guarantor Phones (G1 / G2)</th>
                    <th className="p-1 border font-bold">Last Callback Summary</th>
                    <th className="p-1 border font-bold">Next Call Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((due, idx) => (
                    <tr key={due.id} className="border-b">
                      <td className="p-1 border text-center">{idx + 1}</td>
                      <td className="p-1 border font-bold text-blue-855">{due.loanId}</td>
                      <td className="p-1 border font-bold">{due.customerName}</td>
                      <td className="p-1 border text-right text-red-700 font-bold">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                      <td className="p-1 border text-center font-bold">{due.dueDays}</td>
                      <td className="p-1 border">{due.currentDueDate.split('-').reverse().join('/')}</td>
                      <td className="p-1 border font-bold">{due.phone || '—'}</td>
                      <td className="p-1 border leading-tight text-[8.5px]">
                        {due.g1Phone && <div>G1: {due.g1Name} ({due.g1Phone})</div>}
                        {due.g2Phone && <div>G2: {due.g2Name} ({due.g2Phone})</div>}
                      </td>
                      <td className="p-1 border max-w-xs truncate">
                        {due.lastFollowUp ? `[${due.lastFollowUp.follow_up_date.split('-').reverse().join('/')} - ${due.lastFollowUp.followed_up_by}] ${due.lastFollowUp.result}: ${due.lastFollowUp.narration}` : 'No previous log'}
                      </td>
                      <td className="p-1 border font-bold text-indigo-700">
                        {due.nextFollowUpDate ? due.nextFollowUpDate.split('-').reverse().join('/') : '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center p-4 italic text-slate-400">No outstanding queue accounts to display</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </FinancePrintPreview>

    </div>
  );
};

// Simple Close Icon mapping
const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} 
    stroke="currentColor" 
    className="w-5 h-5"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default PaymentFollowUp;
