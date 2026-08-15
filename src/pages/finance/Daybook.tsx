import React, { useEffect, useState, useMemo } from 'react';
import { 
  Printer, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Scale, 
  BookOpen, 
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FinanceSmartCalendar } from '../../components/finance/FinanceSmartCalendar';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { supabaseFinance, FinanceCashbookAccount } from '../../lib/supabaseFinance';
import { clearFinanceCalendarCache, getAdjacentTransactionDate } from '../../services/financeCalendarService';
import { useAuth } from '../../contexts/AuthContext';

export interface DaybookRowItem extends DailyFinancialTransaction {
  runningBalance: number;
}

// Format Helper for Transaction Row Date (DD-Mon-YYYY)
export const formatRowDate = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2].padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day}-${months[monthIdx]}-${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr || '—';
};

// Format Helper for Transaction Row Time (hh:mm AM/PM)
export const formatRowTime = (timeStr?: string | null, createdAt?: string | null): string => {
  const target = timeStr || createdAt;
  if (!target) return '—';
  try {
    const timeMatch = target.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, '0');
      return `${strHours}:${minutes} ${ampm}`;
    }

    const d = new Date(target);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    }
  } catch (e) {
    // fallback
  }
  if (target.length > 8 && target.includes('T')) {
    return target.substring(11, 16);
  }
  return target;
};

const Daybook: React.FC = () => {
  const { user } = useAuth();
  
  // Selected Business Date
  const [selectedDate, setSelectedDate] = useState(() => getLocalBusinessDateISO());
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Financial Metrics
  const [openingBalance, setOpeningBalance] = useState(0);
  const [allTransactions, setAllTransactions] = useState<DailyFinancialTransaction[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Active Mode
  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const prev = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return prev === 'itr' ? 'ITR' : 'REGULAR';
  });

  // Filter States
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Direct Cashbook Entry Inline States
  const [accounts, setAccounts] = useState<FinanceCashbookAccount[]>([]);
  const [headOfAccount, setHeadOfAccount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [particulars, setParticulars] = useState('');
  const [credit, setCredit] = useState('');
  const [debit, setDebit] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  // Load Accounts for Cashbook modal
  useEffect(() => {
    supabaseFinance.getCashbookAccounts()
      .then(accs => setAccounts(accs))
      .catch(err => console.error('Error loading cashbook accounts:', err));
  }, []);

  // Fetch Daybook Data when selectedDate, mode or refreshTrigger changes
  useEffect(() => {
    fetchDaybookJournal();
  }, [selectedDate, financeMode, refreshTrigger]);

  const fetchDaybookJournal = async () => {
    setLoading(true);
    try {
      // 1. Calculate Opening Balance (Net cash position prior to selectedDate)
      const oldestDate = await dailyFinancialTransactionService.getOldestTransactionDate();
      
      let opBal = 0;
      if (oldestDate && oldestDate < selectedDate) {
        const selectedObj = new Date(selectedDate);
        selectedObj.setDate(selectedObj.getDate() - 1);
        const priorDateStr = selectedObj.toISOString().split('T')[0];

        if (priorDateStr >= oldestDate) {
          const priorTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
            fromDate: oldestDate,
            toDate: priorDateStr,
            financeMode
          });

          priorTxs.forEach(tx => {
            opBal += (Number(tx.credit) || 0) - (Number(tx.debit) || 0);
          });
        }
      }
      setOpeningBalance(opBal);

      // 2. Fetch all transactions for selectedDate
      const todayTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: selectedDate,
        toDate: selectedDate,
        financeMode
      });

      setAllTransactions(todayTxs);
    } catch (err) {
      console.error('Error fetching Daybook journal:', err);
      toast.error('Failed to load Day Book entries');
    } finally {
      setLoading(false);
    }
  };

  // Day Overall Financial Summaries (unaffected by UI table search filters)
  const daySummary = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    allTransactions.forEach(tx => {
      cashIn += Number(tx.credit) || 0;
      cashOut += Number(tx.debit) || 0;
    });
    const netChange = cashIn - cashOut;
    const closingBalance = openingBalance + netChange;
    return {
      cashIn,
      cashOut,
      netChange,
      closingBalance,
      txCount: allTransactions.length
    };
  }, [allTransactions, openingBalance]);

  // Unique Filter Options
  const filterOptions = useMemo(() => {
    const operators = new Set<string>();
    const types = new Set<string>();
    const loanTypes = new Set<string>();

    allTransactions.forEach(tx => {
      if (tx.userName) operators.add(tx.userName);
      if (tx.headOfAccount) types.add(tx.headOfAccount);
      if (tx.loanCategory) loanTypes.add(tx.loanCategory);
      if (tx.category) loanTypes.add(tx.category);
    });

    return {
      operators: Array.from(operators).sort(),
      types: Array.from(types).sort(),
      loanTypes: Array.from(loanTypes).sort()
    };
  }, [allTransactions]);

  // Filtered Rows with Running Balance Calculation
  const filteredRows = useMemo(() => {
    let currBal = openingBalance;

    return allTransactions
      .filter(tx => {
        if (typeFilter !== 'ALL' && tx.headOfAccount !== typeFilter) return false;
        if (operatorFilter !== 'ALL' && tx.userName !== operatorFilter) return false;
        if (loanTypeFilter !== 'ALL' && tx.loanCategory !== loanTypeFilter && tx.category !== loanTypeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchReceipt = (tx.receiptOrVoucherNo || '').toLowerCase().includes(q);
          const matchCustomer = (tx.customerName || '').toLowerCase().includes(q);
          const matchLoan = (tx.accountOrLoanNo || '').toLowerCase().includes(q);
          const matchParticulars = (tx.particulars || '').toLowerCase().includes(q);
          const matchHead = (tx.headOfAccount || '').toLowerCase().includes(q);
          const matchUser = (tx.userName || '').toLowerCase().includes(q);
          if (!matchReceipt && !matchCustomer && !matchLoan && !matchParticulars && !matchHead && !matchUser) {
            return false;
          }
        }
        return true;
      })
      .map(tx => {
        currBal += (Number(tx.credit) || 0) - (Number(tx.debit) || 0);
        return {
          ...tx,
          runningBalance: currBal
        };
      });
  }, [allTransactions, openingBalance, typeFilter, operatorFilter, loanTypeFilter, searchQuery]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    filteredRows.forEach(r => {
      inSum += Number(r.credit) || 0;
      outSum += Number(r.debit) || 0;
    });
    return { inSum, outSum, net: inSum - outSum };
  }, [filteredRows]);

  // Transaction-Aware Date Navigation (Jump strictly to dates having transactions)
  const handleAdjacentDate = async (direction: 'prev' | 'next') => {
    try {
      const adjacentDate = await getAdjacentTransactionDate(selectedDate, direction, financeMode);
      if (adjacentDate) {
        setSelectedDate(adjacentDate);
      } else {
        toast(direction === 'prev' ? 'No earlier transaction date found' : 'No later transaction date found', { icon: 'ℹ️' });
      }
    } catch (e) {
      console.error('Error navigating to adjacent transaction date:', e);
    }
  };

  // Format Helper for Display Dates
  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date(isoStr);
    const dayName = !isNaN(dateObj.getTime()) ? days[dateObj.getDay()] : '';
    return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]} ${dayName ? `(${dayName})` : ''}`;
  };

  // Clear All Filters
  const handleClearFilters = () => {
    setTypeFilter('ALL');
    setOperatorFilter('ALL');
    setLoanTypeFilter('ALL');
    setSearchQuery('');
  };

  // Save Direct Cashbook Entry Handler
  const handleSaveCashbookEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const crVal = Number(credit) || 0;
    const drVal = Number(debit) || 0;

    if (!headOfAccount) {
      toast.error('Please select Head of Account');
      return;
    }
    if (!particulars.trim()) {
      toast.error('Please enter Particulars');
      return;
    }
    if (crVal < 0 || drVal < 0) {
      toast.error('Amounts cannot be negative');
      return;
    }
    if (crVal <= 0 && drVal <= 0) {
      toast.error('Please enter Cash In (Credit) or Cash Out (Debit) amount greater than 0');
      return;
    }
    if (crVal > 0 && drVal > 0) {
      toast.error('Cannot enter both Cash In and Cash Out in a single entry');
      return;
    }

    setSavingEntry(true);
    try {
      const staffName = user?.username || 'Staff';
      const selectedAccName = accounts.find(a => a.id === headOfAccount)?.account_name || headOfAccount;

      const regBookId = await supabaseFinance.getLegacyBookId('REGULAR');
      const itrBookId = await supabaseFinance.getLegacyBookId('ITR');
      const bookId = financeMode === 'ITR' ? itrBookId : regBookId;

      await supabaseFinance.createCashbookEntry({
        entry_date: selectedDate,
        account_number: accountNumber || null,
        head_of_account: selectedAccName,
        particulars: particulars.trim(),
        credit: crVal,
        debit: drVal,
        created_by: staffName,
        book_id: bookId,
        status: 'APPROVED',
        approved_by: staffName,
        approved_at: new Date().toISOString()
      });

      toast.success('Cashbook entry saved to Day Book');
      clearFinanceCalendarCache();
      setHeadOfAccount('');
      setAccountNumber('');
      setParticulars('');
      setCredit('');
      setDebit('');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error('Error saving cashbook entry:', err);
      toast.error(err.message || 'Failed to save Cashbook entry');
    } finally {
      setSavingEntry(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-[100%] mx-auto px-2 pt-1 pb-3 print:p-0 select-none">
      
      {/* ── ROW 1: Page Header & Quick Actions ───────────────────────── */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200 print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-black uppercase text-slate-900 tracking-wide leading-none">Finance Day Book Journal</h1>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                Definitive Journal
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
              Complete chronological journal of all financial transactions for the selected business day
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-xs font-extrabold uppercase shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Journal
          </button>
        </div>
      </div>

      {/* ── ROW 2: Transaction-Aware Date Selector Bar ───────────────────────── */}
      <div className={`bg-white border border-slate-200 rounded-xl shadow-2xs px-3 py-2 print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          
          {/* Calendar Picker + Transaction-Aware Navigation */}
          <div className="flex items-center gap-2">
            <div className="min-w-[215px]">
              <FinanceSmartCalendar
                label="Selected Business Date"
                value={selectedDate}
                onChange={(newDate) => {
                  if (newDate) setSelectedDate(newDate);
                }}
                module="DAY_BOOK"
                refreshTrigger={refreshTrigger}
                compact
              />
            </div>

            {/* Jump strictly to adjacent transaction dates */}
            <div className="flex items-center gap-1 mt-4">
              <button
                type="button"
                onClick={() => handleAdjacentDate('prev')}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center justify-center h-[36px] w-[36px]"
                title="Jump to Previous Transaction Date"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedDate(getLocalBusinessDateISO())}
                className={`px-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer h-[36px] flex items-center justify-center ${selectedDate === getLocalBusinessDateISO() ? 'bg-blue-100 text-blue-900 border border-blue-300' : ''}`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => handleAdjacentDate('next')}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center justify-center h-[36px] w-[36px]"
                title="Jump to Next Transaction Date"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Business Date Display */}
          <div className="flex flex-col text-right ml-auto">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Active Financial Date</span>
            <div className="text-sm font-black text-slate-900 uppercase bg-slate-50 border border-slate-300 px-3.5 py-1 rounded-lg h-[36px] flex items-center justify-center font-mono shadow-2xs">
              {formatDisplayDate(selectedDate)}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: High-Readability Summary Metrics Cards ──────────────────── */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        
        {/* Opening Balance */}
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between min-h-[62px]">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Opening Balance</span>
          <span className="text-slate-900 text-[19px] font-black font-mono tracking-tight whitespace-nowrap mt-0.5">
            {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Total Cash In (Credit) */}
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between min-h-[62px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider">Total Cash In (+)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
          </div>
          <span className="text-emerald-800 text-[19px] font-black font-mono tracking-tight whitespace-nowrap mt-0.5">
            {daySummary.cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Total Cash Out (Debit) */}
        <div className="bg-rose-50/80 border border-rose-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between min-h-[62px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-900 uppercase tracking-wider">Total Cash Out (-)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-700" />
          </div>
          <span className="text-rose-800 text-[19px] font-black font-mono tracking-tight whitespace-nowrap mt-0.5">
            {daySummary.cashOut.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Net Movement */}
        <div className={`border rounded-xl p-2.5 shadow-2xs flex flex-col justify-between min-h-[62px] ${daySummary.netChange >= 0 ? 'bg-blue-50/80 border-blue-300 text-blue-950' : 'bg-amber-50/80 border-amber-300 text-amber-950'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider">Net Movement</span>
            <Scale className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-[19px] font-black font-mono tracking-tight whitespace-nowrap mt-0.5">
            {daySummary.netChange >= 0 ? '+' : ''}{daySummary.netChange.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Closing Balance */}
        <div className="bg-indigo-50/80 border border-indigo-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between min-h-[62px]">
          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">Closing Balance</span>
          <span className="text-indigo-950 text-[19px] font-black font-mono tracking-tight whitespace-nowrap mt-0.5">
            {daySummary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Transaction Count */}
        <div className="bg-slate-900 text-white rounded-xl p-2.5 shadow-2xs flex flex-col justify-between min-h-[62px]">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Transactions</span>
          <span className="text-amber-400 text-[20px] font-black font-mono tracking-tight whitespace-nowrap mt-0.5">
            {daySummary.txCount} <span className="text-[11px] font-extrabold text-slate-300 font-sans">Entries</span>
          </span>
        </div>

      </div>

      {/* ── ROW 4: Optimized Filters Toolbar ────────────────────────────────────── */}
      <div className={`bg-white border border-slate-200 rounded-xl p-2 shadow-2xs print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Global Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt, customer name, loan no, particulars..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          {/* Type Filter */}
          <div className="min-w-[140px]">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Types</option>
              {filterOptions.types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Loan Category Filter */}
          <div className="min-w-[130px]">
            <select
              value={loanTypeFilter}
              onChange={(e) => setLoanTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Categories</option>
              <option value="CD">CD Loans</option>
              <option value="HP">HP Loans</option>
              <option value="STBD">STBD Loans</option>
              <option value="TBD">TBD Loans</option>
              <option value="CAPITAL">Capital</option>
              <option value="EXPENSE">Expense</option>
              <option value="BANK">Bank</option>
            </select>
          </div>

          {/* Operator Filter */}
          <div className="min-w-[120px]">
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Staff</option>
              {filterOptions.operators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(typeFilter !== 'ALL' || operatorFilter !== 'ALL' || loanTypeFilter !== 'ALL' || searchQuery !== '') && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}

        </div>
      </div>

      {/* ── ROW 5: Strictly Bounded 100% Desktop Viewport Table (Zero Cell Overlap) ────────── */}
      <div className={`bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        
        {/* Table Header Info Bar */}
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-100/90 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
              DAILY FINANCIAL TRANSACTIONS JOURNAL
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-900 text-white rounded font-mono">
              {filteredRows.length} {filteredRows.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono font-black text-slate-800">
            <span>Filtered In: <strong className="text-emerald-700">{filteredTotals.inSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
            <span>Filtered Out: <strong className="text-rose-700">{filteredTotals.outSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 bg-white">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto w-full" style={{ maxHeight: 'calc(100vh - 330px)' }}>
              <table className="w-full table-fixed divide-y divide-slate-200">
              <thead className="sticky top-0 z-10 bg-slate-200 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                <tr className="text-slate-950 uppercase font-black text-[10px] tracking-wider">
                  <th className="w-[3%] px-1 py-2.5 text-center border-r border-slate-300 overflow-hidden">#</th>
                  <th className="w-[8.5%] px-1.5 py-2.5 text-center border-r border-slate-300 overflow-hidden">Receipt</th>
                  <th className="w-[7.5%] px-1.5 py-2.5 text-center border-r border-slate-300 overflow-hidden">Type</th>
                  <th className="w-[8.5%] px-1.5 py-2.5 text-left border-r border-slate-300 overflow-hidden">Loan / Acc</th>
                  <th className="w-[20%] px-2 py-2.5 text-left border-r border-slate-300 overflow-hidden">Customer Name</th>
                  <th className="w-[9.5%] px-1.5 py-2.5 text-right border-r border-slate-300 text-emerald-950 bg-emerald-100/60 overflow-hidden">Cash In (Cr)</th>
                  <th className="w-[9.5%] px-1.5 py-2.5 text-right border-r border-slate-300 text-rose-950 bg-rose-100/60 overflow-hidden">Cash Out (Dr)</th>
                  <th className="w-[11%] px-1.5 py-2.5 text-right border-r border-slate-300 text-indigo-950 bg-indigo-100/60 overflow-hidden">Balance</th>
                  <th className="w-[6.5%] px-1.5 py-2.5 text-left border-r border-slate-300 overflow-hidden">Operator</th>
                  <th className="w-[8%] px-1.5 py-2.5 text-left border-r border-slate-300 overflow-hidden">Date</th>
                  <th className="w-[8%] px-2 py-2.5 text-left overflow-hidden">Particulars / Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 text-[12px]">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-12 text-center text-slate-500 font-sans text-xs font-extrabold">
                      No financial transactions match the selected date and filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isCredit = row.credit > 0;
                    const isDebit = row.debit > 0;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/90 transition-colors">
                        {/* # Index */}
                        <td className="w-[3%] px-1 py-2 text-center border-r border-slate-100 text-slate-500 font-sans text-[11px] font-bold overflow-hidden">
                          {idx + 1}
                        </td>

                        {/* Receipt */}
                        <td className="w-[8.5%] px-1.5 py-2 border-r border-slate-100 text-center overflow-hidden">
                          {row.receiptOrVoucherNo ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-950 border border-slate-300 text-[11px] font-mono font-black inline-block truncate max-w-full" title={row.receiptOrVoucherNo}>
                              {row.receiptOrVoucherNo}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans text-center block">—</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="w-[7.5%] px-1 py-2 border-r border-slate-100 text-center overflow-hidden">
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-tight truncate max-w-full text-center ${
                            row.headOfAccount.includes('INTEREST') || row.headOfAccount.includes('COMMISSION')
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : row.headOfAccount.includes('DISBURSEMENT') || row.debit > 0
                              ? 'bg-rose-50 text-rose-900 border-rose-300'
                              : row.headOfAccount.includes('CAPITAL')
                              ? 'bg-amber-50 text-amber-950 border-amber-300'
                              : 'bg-blue-50 text-blue-950 border-blue-300'
                          }`} title={row.headOfAccount}>
                            {row.headOfAccount}
                          </span>
                        </td>

                        {/* Loan / Acc No */}
                        <td className="w-[8.5%] px-1.5 py-2 border-r border-slate-100 font-mono font-bold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap" title={row.accountOrLoanNo || '—'}>
                          {row.accountOrLoanNo || '—'}
                        </td>

                        {/* Customer Name */}
                        <td className="w-[20%] px-2 py-2 border-r border-slate-100 font-sans font-extrabold text-slate-950 leading-snug overflow-hidden">
                          <div className="line-clamp-2 break-words text-[12px] whitespace-normal" title={row.customerName || '—'}>
                            {row.customerName || '—'}
                          </div>
                        </td>

                        {/* Cash In (Credit) */}
                        <td className="w-[9.5%] px-1.5 py-2 border-r border-slate-100 text-right font-mono font-black text-[12px] text-emerald-700 bg-emerald-50/20 overflow-hidden text-ellipsis whitespace-nowrap">
                          {isCredit ? row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                        </td>

                        {/* Cash Out (Debit) */}
                        <td className="w-[9.5%] px-1.5 py-2 border-r border-slate-100 text-right font-mono font-black text-[12px] text-rose-700 bg-rose-50/20 overflow-hidden text-ellipsis whitespace-nowrap">
                          {isDebit ? row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                        </td>

                        {/* Running Balance */}
                        <td className="w-[11%] px-1.5 py-2 border-r border-slate-100 text-right font-mono font-black text-[12px] text-indigo-950 bg-indigo-50/20 overflow-hidden text-ellipsis whitespace-nowrap">
                          {row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Operator */}
                        <td className="w-[6.5%] px-1.5 py-2 border-r border-slate-100 font-sans font-black text-slate-800 text-[11px] uppercase overflow-hidden text-ellipsis whitespace-nowrap" title={row.userName || 'Staff'}>
                          {row.userName || 'Staff'}
                        </td>

                        {/* Date (Date on 1st line, Time on 2nd line) */}
                        <td className="w-[8%] px-1.5 py-1.5 border-r border-slate-100 text-left overflow-hidden">
                          <div className="flex flex-col leading-tight">
                            <span className="font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap">
                              {formatRowDate(row.transactionDate || row.createdAt)}
                            </span>
                            <span className="font-mono font-medium text-slate-500 text-[10px] whitespace-nowrap">
                              {formatRowTime(row.entryTime, row.createdAt)}
                            </span>
                          </div>
                        </td>

                        {/* Particulars / Remarks */}
                        <td className="w-[8%] px-2 py-2 font-sans text-[11px] font-semibold text-slate-800 leading-snug overflow-hidden">
                          <div className="line-clamp-3 break-words whitespace-normal" title={row.particulars || '—'}>
                            {row.particulars || '—'}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}

              </tbody>
            </table>
          </div>

          {/* ── DIRECT ENTRY ROW (Straight Horizontal Input Row Directly Below Table) ── */}
          <form onSubmit={handleSaveCashbookEntry} className="bg-slate-50 border-t-2 border-slate-300 px-3 py-2 flex flex-wrap lg:flex-nowrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider whitespace-nowrap">
                ENTRY:
              </span>
            </div>

            {/* Head of Account */}
            <div className="w-full sm:w-[220px] lg:w-[22%] shrink-0">
              <select
                value={headOfAccount}
                onChange={(e) => {
                  setHeadOfAccount(e.target.value);
                  const selectedAcc = accounts.find(a => a.id === e.target.value);
                  if (selectedAcc?.account_number) setAccountNumber(selectedAcc.account_number);
                }}
                className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              >
                <option value="">-- Select Head of Account * --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} {acc.account_number ? `(${acc.account_number})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Particulars / Description */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Particulars / Description *"
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            {/* Cash In (Credit) */}
            <div className="w-28 sm:w-32 shrink-0">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Cash In (Cr)"
                value={credit}
                onChange={(e) => {
                  setCredit(e.target.value);
                  if (e.target.value) setDebit('');
                }}
                className="w-full h-8 px-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold font-mono text-emerald-900 placeholder:text-emerald-700/60 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-right"
              />
            </div>

            {/* Cash Out (Debit) */}
            <div className="w-28 sm:w-32 shrink-0">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Cash Out (Dr)"
                value={debit}
                onChange={(e) => {
                  setDebit(e.target.value);
                  if (e.target.value) setCredit('');
                }}
                className="w-full h-8 px-2.5 bg-rose-50 border border-rose-300 rounded-lg text-xs font-bold font-mono text-rose-900 placeholder:text-rose-700/60 focus:outline-none focus:ring-2 focus:ring-rose-600 text-right"
              />
            </div>

            {/* Save Button */}
            <div className="shrink-0">
              <button
                type="submit"
                disabled={savingEntry}
                className="h-8 px-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                {savingEntry ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </form>

          {/* ── JOURNAL TOTALS (Day Totals Summary Bar Below Direct Entry Row) ── */}
          <div className="bg-slate-200 border-t border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-black text-slate-900">
            <div className="flex items-center gap-2">
              <span className="uppercase text-[11px] font-sans font-black tracking-wider text-slate-950">Journal Day Totals:</span>
              <span className="text-[10px] font-sans font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                {filteredRows.length} {filteredRows.length === 1 ? 'Row' : 'Rows'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <span>Total In: <strong className="text-emerald-800 text-[12px] bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 font-mono font-black">{filteredTotals.inSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
              <span>Total Out: <strong className="text-rose-800 text-[12px] bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300 font-mono font-black">{filteredTotals.outSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
              <span>Closing Balance: <strong className="text-indigo-950 text-[12px] bg-indigo-100/90 px-2 py-0.5 rounded border border-indigo-300 font-mono font-black">{daySummary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
              <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">NET: {daySummary.netChange >= 0 ? '+' : ''}{daySummary.netChange.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </>
      )}
    </div>

      {/* ── ROW 7: Print Preview Component ───────────────────────────────────── */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Finance Day Book Journal"
        documentTitle={`DAYBOOK: ${formatDisplayDate(selectedDate)}`}
      >
        {!loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-gray-50 rounded border">
                <span className="text-gray-500 block uppercase font-bold text-[9px]">Opening Balance</span>
                <span className="text-gray-900 font-mono font-black text-sm">{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-2.5 bg-green-50 rounded border border-green-200">
                <span className="text-green-800 block uppercase font-bold text-[9px]">Total Cash In (+)</span>
                <span className="text-green-900 font-mono font-black text-sm">{daySummary.cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-2.5 bg-red-50 rounded border border-red-200">
                <span className="text-red-800 block uppercase font-bold text-[9px]">Total Cash Out (-)</span>
                <span className="text-red-900 font-mono font-black text-sm">{daySummary.cashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-2.5 bg-indigo-50 rounded border border-indigo-200">
                <span className="text-indigo-900 block uppercase font-bold text-[9px]">Closing Balance</span>
                <span className="text-indigo-950 font-mono font-black text-sm">{daySummary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <table className="min-w-full divide-y divide-gray-300 text-xs">
              <thead>
                <tr className="bg-gray-100 text-left uppercase text-[9px] font-black">
                  <th className="px-2 py-2">Receipt/Ref</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Loan/Acc</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2 text-right">Cash In</th>
                  <th className="px-2 py-2 text-right">Cash Out</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2">Operator</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Particulars</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 font-bold">{r.receiptOrVoucherNo || '-'}</td>
                    <td className="px-2 py-1.5">{r.headOfAccount}</td>
                    <td className="px-2 py-1.5">{r.accountOrLoanNo || '-'}</td>
                    <td className="px-2 py-1.5">{r.customerName || '-'}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-green-700">{r.credit > 0 ? r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-red-700">{r.debit > 0 ? r.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{r.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1.5 text-left">{r.userName || 'Staff'}</td>
                    <td className="px-2 py-1.5 text-left">
                      <div className="font-bold text-[10px] text-gray-900">{formatRowDate(r.transactionDate || r.createdAt)}</div>
                      <div className="text-[9px] text-gray-500">{formatRowTime(r.entryTime, r.createdAt)}</div>
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-gray-700">{r.particulars || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-12 pt-6 border-t text-xs">
              <div>
                <p className="font-bold">Cashier Signature</p>
                <p className="text-gray-400 mt-6 text-[10px]">Authorized Signatory</p>
              </div>
              <div className="text-right">
                <p className="font-bold">Verified By Manager</p>
                <p className="text-gray-400 mt-6 text-[10px]">Audit Sign</p>
              </div>
            </div>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default Daybook;
