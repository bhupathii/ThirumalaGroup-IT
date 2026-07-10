import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { Printer, ChevronLeft, ChevronRight, ArrowLeft, Search, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';
import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import CustomCalendar from '../../components/UI/CustomCalendar';

const DailyReportFinance: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => getLocalBusinessDateISO());
  const [loading, setLoading] = useState(true);
  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
  });

  const [openingBalance, setOpeningBalance] = useState(0);
  const [transactions, setTransactions] = useState<DailyFinancialTransaction[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [reportActivityDates, setReportActivityDates] = useState<{ c_date: string }[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'CD_LEDGER' | 'CAPITAL_ENTRY' | 'DAY_BOOK_ENTRY'>('ALL');
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'UNCLASSIFIED'>('ALL');

  useEffect(() => {
    fetchDailyData();
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const fetchActivityDates = async (month: number, year: number) => {
    try {
      const dates = await dailyFinancialTransactionService.getDailyReportActivityDates({
        month,
        year,
        financeMode
      });
      setReportActivityDates(dates);
    } catch (err) {
      console.error('Failed to load daily report activity dates', err);
    }
  };

  const fetchDailyData = async () => {
    setLoading(true);
    try {
      // 1. Calculate opening balance by summing all transactions from past to yesterday
      const yesterday = new Date(selectedDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const priorTx = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: '2000-01-01',
        toDate: yesterdayStr,
        financeMode
      });
      const opBal = priorTx.reduce((sum, tx) => sum + tx.credit - tx.debit, 0);
      setOpeningBalance(opBal);

      // 2. Fetch today's transactions
      const todayTx = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: selectedDate,
        toDate: selectedDate,
        financeMode
      });

      setTransactions(todayTx);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load daily transactions log');
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = 
        tx.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.headOfAccount.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.accountOrLoanNo && tx.accountOrLoanNo.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSource = sourceFilter === 'ALL' || tx.sourceType === sourceFilter;
      const matchesClass = classificationFilter === 'ALL' || tx.reportClassification === classificationFilter;

      return matchesSearch && matchesSource && matchesClass;
    });
  }, [transactions, searchQuery, sourceFilter, classificationFilter]);

  // Compute filtered totals dynamically
  const filteredTotals = useMemo(() => {
    let credTotal = 0;
    let debTotal = 0;
    filteredTransactions.forEach(tx => {
      credTotal += tx.credit;
      debTotal += tx.debit;
    });
    return {
      credits: credTotal,
      debits: debTotal,
      net: credTotal - debTotal
    };
  }, [filteredTransactions]);

  // Total daily summary
  const dailyTotals = useMemo(() => {
    let credTotal = 0;
    let debTotal = 0;
    transactions.forEach(tx => {
      credTotal += tx.credit;
      debTotal += tx.debit;
    });
    return {
      credits: credTotal,
      debits: debTotal,
      closing: openingBalance + credTotal - debTotal
    };
  }, [transactions, openingBalance]);

  // Account level summaries
  const accountSummaries = useMemo(() => {
    const summary: Record<string, { credit: number; debit: number }> = {};
    filteredTransactions.forEach(tx => {
      if (!summary[tx.headOfAccount]) {
        summary[tx.headOfAccount] = { credit: 0, debit: 0 };
      }
      summary[tx.headOfAccount].credit += tx.credit;
      summary[tx.headOfAccount].debit += tx.debit;
    });
    return Object.entries(summary).map(([account, totals]) => ({
      account,
      credit: totals.credit,
      debit: totals.debit,
      net: totals.credit - totals.debit
    })).sort((a, b) => a.account.localeCompare(b.account));
  }, [filteredTransactions]);

  const todayReceipts = useMemo(() => {
    const receiptsMap = new Map<string, { receiptNo: string; accountNo: string; customerName: string; amount: number }>();
    transactions.forEach(tx => {
      if (tx.credit > 0 && tx.receiptOrVoucherNo) {
        const key = tx.receiptOrVoucherNo;
        const current = receiptsMap.get(key);
        if (current) {
          current.amount += tx.credit;
        } else {
          receiptsMap.set(key, {
            receiptNo: key,
            accountNo: tx.accountOrLoanNo || '—',
            customerName: tx.customerName || tx.particulars || 'CD Customer',
            amount: tx.credit
          });
        }
      }
    });
    return Array.from(receiptsMap.values()).sort((a, b) => a.receiptNo.localeCompare(b.receiptNo));
  }, [transactions]);

  const displayDate = new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  const getSourceBadgeClass = (source: string) => {
    switch (source) {
      case 'CD_LEDGER':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'CAPITAL_ENTRY':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'DAY_BOOK_ENTRY':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'CD_LEDGER':
        return 'CD LEDGER';
      case 'CAPITAL_ENTRY':
        return 'CAPITAL ENTRY';
      case 'DAY_BOOK_ENTRY':
        return 'DAY BOOK ENTRY';
      default:
        return source;
    }
  };

  const getClassificationBadgeClass = (cls: string) => {
    switch (cls) {
      case 'BALANCE_SHEET':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'PROFIT_AND_LOSS':
        return 'bg-orange-50 text-orange-700 border-orange-100';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-100 font-bold';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:hidden font-outfit">
      {/* Header Section */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">Daily Report</h1>
          <p className="finance-small-label uppercase">Unified transaction logs with classification filters and summary stats</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase font-bold">
            Back
          </Button>
          <Button onClick={handlePrevDay} variant="secondary" size="sm" icon={ChevronLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200">{''}</Button>
          <Button onClick={handleNextDay} variant="secondary" size="sm" icon={ChevronRight} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200">{''}</Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase font-bold">
            Print Log
          </Button>
        </div>
      </div>

      {/* Top Statistics summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center relative">
          <label className="text-slate-400 mb-1 finance-small-label uppercase font-black text-[9px] tracking-wider">Select Report Date</label>
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={new Date(selectedDate).toLocaleDateString('en-GB')}
              readOnly
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link font-black text-sm"
            />
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              type="button"
              className="p-1 hover:bg-slate-50 rounded text-slate-500"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
          {showCalendar && (
            <CustomCalendar
              selectedDate={selectedDate}
              onDateSelect={(d) => {
                setSelectedDate(d);
                setShowCalendar(false);
              }}
              onClose={() => setShowCalendar(false)}
              entries={reportActivityDates}
              onMonthChange={(m, y) => fetchActivityDates(m, y)}
            />
          )}
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase font-black text-[9px] tracking-wider">Opening Balance</span>
          <span className="text-slate-850 text-base font-black block font-mono mt-1">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase font-black text-[9px] tracking-wider">Credit Total (Inflow)</span>
          <span className="text-emerald-600 text-base font-black block font-mono mt-1">₹{dailyTotals.credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase font-black text-[9px] tracking-wider font-bold">Closing Balance</span>
          <span className="text-slate-900 text-base font-black block font-mono mt-1">₹{dailyTotals.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="relative">
          <label className="text-slate-400 block mb-1.5 text-[10px] font-black uppercase tracking-wider">Search Terms</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-405" />
            <input
              type="text"
              placeholder="Search particulars, account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-950 shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-slate-400 block mb-1.5 text-[10px] font-black uppercase tracking-wider">Transaction Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-950 shadow-sm"
          >
            <option value="ALL">ALL SOURCES</option>
            <option value="CD_LEDGER">CD LEDGER ENTRIES</option>
            <option value="CAPITAL_ENTRY">CAPITAL ENTRIES</option>
            <option value="DAY_BOOK_ENTRY">DAY BOOK ENTRIES</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 block mb-1.5 text-[10px] font-black uppercase tracking-wider">Report Classification</label>
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-950 shadow-sm"
          >
            <option value="ALL">ALL CLASSIFICATIONS</option>
            <option value="PROFIT_AND_LOSS">PROFIT AND LOSS</option>
            <option value="BALANCE_SHEET">BALANCE SHEET</option>
            <option value="UNCLASSIFIED">UNCLASSIFIED</option>
          </select>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            onClick={() => {
              setSearchQuery('');
              setSourceFilter('ALL');
              setClassificationFilter('ALL');
            }}
            variant="secondary"
            size="sm"
            className="text-[10px] uppercase font-bold tracking-wider"
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Normalized Transactions List */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider">Unified Transaction Log &middot; {displayDate}</h3>
                <p className="text-slate-500 mt-0.5 text-xs uppercase tracking-wider">{filteredTransactions.length} ROWS MATCHED</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-400 font-bold text-sm uppercase">No Transactions Found</p>
                <p className="text-slate-400 mt-1 text-xs uppercase">No matching entries recorded for the filters selected.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">S.No</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Head of A/C</th>
                      <th className="px-4 py-3">Particulars / Ref</th>
                      <th className="px-4 py-3 text-right">Debit (Dr)</th>
                      <th className="px-4 py-3 text-right">Credit (Cr)</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[12px] font-medium text-slate-700">
                    {filteredTransactions.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${getSourceBadgeClass(tx.sourceType)}`}>
                            {getSourceLabel(tx.sourceType)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 uppercase">{tx.headOfAccount}</div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded text-[8px] font-black uppercase border ${getClassificationBadgeClass(tx.reportClassification)}`}>
                            {tx.reportClassification.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800 font-semibold">{tx.particulars}</div>
                          <div className="text-slate-400 text-[10px] font-mono mt-0.5">REF: {tx.accountOrLoanNo || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-mono">
                          {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-mono">
                          {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[10px] font-mono">
                          <div>{tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                          <div className="text-[9px] uppercase mt-0.5 text-slate-450">{tx.userName || 'Staff'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: summaries */}
        <div className="xl:col-span-1 space-y-6">
          {/* Card 1: Filtered Account Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-slate-900 font-bold text-xs uppercase tracking-wider">Filtered Account Summary</h3>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : accountSummaries.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase">
                No accounts impacted
              </div>
            ) : (
              <div className="p-4 space-y-4 max-h-[30vh] overflow-y-auto">
                {accountSummaries.map((acc, idx) => (
                  <div key={idx} className="flex flex-col border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <span className="text-slate-900 font-bold text-xs uppercase mb-1">{acc.account}</span>
                    <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
                      <span>Inflow (Cr): <span className="text-emerald-600 font-bold">₹{acc.credit.toLocaleString('en-IN')}</span></span>
                      <span>Outflow (Dr): <span className="text-red-600 font-bold">₹{acc.debit.toLocaleString('en-IN')}</span></span>
                    </div>
                    <div className="mt-1 flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">NET FLOW</span>
                      <span className={acc.net > 0 ? "text-emerald-600 font-mono" : acc.net < 0 ? "text-red-600 font-mono" : "text-slate-500 font-mono"}>
                        {acc.net > 0 ? "+" : ""}{acc.net === 0 ? "₹0.00" : `₹${acc.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Filtered Totals box */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs font-bold space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>FILTERED DEBITS:</span>
                <span className="font-mono text-red-600">₹{filteredTotals.debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>FILTERED CREDITS:</span>
                <span className="font-mono text-emerald-600">₹{filteredTotals.credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-200 font-black">
                <span>FILTERED NET FLOW:</span>
                <span className={`font-mono ${filteredTotals.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ₹{filteredTotals.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Total Receipts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-slate-900 font-bold text-xs uppercase tracking-wider">Today's Total Receipts</h3>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : todayReceipts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase">
                No receipts generated today
              </div>
            ) : (
              <div className="p-4 space-y-3 max-h-[35vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase text-[9px]">
                      <th className="px-2 py-1.5">R.No</th>
                      <th className="px-2 py-1.5">A/C No</th>
                      <th className="px-2 py-1.5">Customer Name</th>
                      <th className="px-2 py-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium font-sans">
                    {todayReceipts.map((rc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="px-2 py-2 font-mono font-bold text-slate-800">{rc.receiptNo}</td>
                        <td className="px-2 py-2 font-mono">{rc.accountNo}</td>
                        <td className="px-2 py-2 uppercase font-bold text-slate-900">{rc.customerName}</td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-600 font-bold">₹{rc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Finance Daily Report Log"
        documentTitle={`DAILY TRANSACTION LOG: ${displayDate}`}
      >
        <div className="space-y-6 pb-12 font-sans text-xs">
          {/* Print Summary */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-slate-500 font-bold uppercase text-[9px]">Opening Balance</p>
              <p className="text-slate-900 font-black mt-1">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[9px]">Credit Total</p>
              <p className="text-emerald-700 font-black mt-1">₹{dailyTotals.credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[9px]">Debit Total</p>
              <p className="text-red-700 font-black mt-1">₹{dailyTotals.debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[9px]">Closing Balance</p>
              <p className="text-slate-900 font-black mt-1">₹{dailyTotals.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Account Summary Print */}
          {accountSummaries.length > 0 && (
            <div className="mb-6 border border-slate-400 rounded">
              <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 font-bold text-[10px] uppercase">
                Account Summary (Filtered)
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 p-3 text-[10px]">
                {accountSummaries.map((acc, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span className="text-slate-800 uppercase font-semibold">{acc.account}</span>
                    <span className={`font-mono font-bold ${acc.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {acc.net > 0 ? "+" : ""}{acc.net === 0 ? "₹0.00" : `₹${acc.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Total Receipts Print */}
          {todayReceipts.length > 0 && (
            <div className="mb-6 border border-slate-400 rounded">
              <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 font-bold text-[10px] uppercase">
                Today's Total Receipts
              </div>
              <table className="w-full text-left text-[9px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-50 font-bold text-slate-700">
                    <th className="px-2 py-1">Receipt No</th>
                    <th className="px-2 py-1">A/C No</th>
                    <th className="px-2 py-1">Customer Name</th>
                    <th className="px-2 py-1 text-right font-mono">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {todayReceipts.map((rc, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">{rc.receiptNo}</td>
                      <td className="px-2 py-1">{rc.accountNo}</td>
                      <td className="px-2 py-1 uppercase">{rc.customerName}</td>
                      <td className="px-2 py-1 text-right font-bold text-emerald-700">₹{rc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transactions Print Table */}
          <div className="border border-slate-900 rounded-sm">
            <div className="bg-slate-100 border-b border-slate-900 px-3 py-1.5 flex justify-between font-bold text-[10px] uppercase">
              <span>Transactions Log</span>
              <span>{filteredTransactions.length} ROWS</span>
            </div>
            <table className="w-full text-left text-[9px] border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50 font-bold text-slate-700">
                  <th className="px-2 py-1.5 border-r border-slate-200">S.No</th>
                  <th className="px-2 py-1.5 border-r border-slate-200">Source</th>
                  <th className="px-2 py-1.5 border-r border-slate-200">Account / Head</th>
                  <th className="px-2 py-1.5 border-r border-slate-200">Particulars / Ref</th>
                  <th className="px-2 py-1.5 text-right border-r border-slate-200">Debit (Dr)</th>
                  <th className="px-2 py-1.5 text-right">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody className="font-medium text-slate-800 divide-y divide-slate-200 font-mono">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500 font-sans uppercase text-[10px]">No transaction matches.</td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td className="px-2 py-1 border-r border-slate-200 font-sans text-slate-450">{idx + 1}</td>
                      <td className="px-2 py-1 border-r border-slate-200 font-sans">{getSourceLabel(tx.sourceType)}</td>
                      <td className="px-2 py-1 border-r border-slate-200 font-sans">
                        <div className="font-bold text-slate-900">{tx.headOfAccount}</div>
                        <div className="text-[7px] text-slate-500">[{tx.reportClassification}]</div>
                      </td>
                      <td className="px-2 py-1 border-r border-slate-200 font-sans">
                        <div>{tx.particulars}</div>
                        <div className="text-[8px] text-slate-400">REF: {tx.accountOrLoanNo || '—'}</div>
                      </td>
                      <td className="px-2 py-1 text-right text-red-700 border-r border-slate-200">{tx.debit > 0 ? tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                      <td className="px-2 py-1 text-right text-emerald-700">{tx.credit > 0 ? tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default DailyReportFinance;
