import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { Printer, ArrowLeft, Search, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseDatabase';

const DetailedLedgerFinance: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialHead = searchParams.get('head') || 'ALL';
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || getLocalBusinessDateISO();

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CD' | 'CAPITAL' | 'BANK' | 'SALARY' | 'EXPENSE' | 'OTHER'>('ALL');
  const [selectedHead, setSelectedHead] = useState<string>(initialHead);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [allRangeEntries, setAllRangeEntries] = useState<DailyFinancialTransaction[]>([]);
  const [allHistoryEntries, setAllHistoryEntries] = useState<DailyFinancialTransaction[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
 });

  useEffect(() => {
    const initData = async () => {
      if (!initialFrom) {
        const oldest = await dailyFinancialTransactionService.getOldestTransactionDate();
        setFromDate(oldest || getLocalBusinessDateISO());
      }
    };
    initData();
 }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchData();
   }
 }, [fromDate, toDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Calculate opening balance: fetch all historical entries before fromDate
      const prevDateLimit = new Date(fromDate);
      prevDateLimit.setDate(prevDateLimit.getDate() - 1);
      const prevDateLimitStr = prevDateLimit.toISOString().split('T')[0];

      if (fromDate > '1970-01-01') {
        await dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: '1970-01-01',
          toDate: prevDateLimitStr,
          financeMode
       });
     }

      // 2. Fetch date range entries
      const rangeTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate,
        toDate,
        financeMode
     });

      // We will store all and calculate opening balance dynamically based on filters
      setAllRangeEntries(rangeTxs);

   } catch (err) {
      console.error(err);
      toast.error('Failed to load detailed ledger entries');
   } finally {
      setLoading(false);
   }
 };

  // Extract all unique head of accounts from the range entries
  const uniqueHeads = useMemo(() => {
    const heads = new Set<string>();
    // Plus any heads from the actual entries in the current range
    allRangeEntries.forEach(t => {
      if (t.headOfAccount) heads.add(t.headOfAccount);
   });
    return Array.from(heads).sort();
 }, [allRangeEntries]);

  // Dynamically recalculate opening balance and list based on selected head and category filter
  const filteredEntries = useMemo(() => {
    // Filter current date range entries
    let rangeList = [...allRangeEntries];

    if (categoryFilter !== 'ALL') {
      rangeList = rangeList.filter(t => t.category === categoryFilter);
   }
    if (selectedHead !== 'ALL') {
      rangeList = rangeList.filter(t => t.headOfAccount === selectedHead);
   }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rangeList = rangeList.filter(t => 
        (t.particulars && t.particulars.toLowerCase().includes(q)) ||
        (t.headOfAccount && t.headOfAccount.toLowerCase().includes(q)) ||
        (t.accountOrLoanNo && t.accountOrLoanNo.toLowerCase().includes(q)) ||
        (t.customerName && t.customerName.toLowerCase().includes(q))
      );
   }

    // Sort chronologically: Oldest first to build running balance
    const sorted = rangeList.sort((a, b) => {
      if (a.transactionDate !== b.transactionDate) {
        return a.transactionDate.localeCompare(b.transactionDate);
     }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
   });

    // Compute running balance
    let currentBalance = 0; // Starts from 0
    return sorted.map(t => {
      currentBalance = currentBalance + (t.credit || 0) - (t.debit || 0);
      return {
        ...t,
        runningBalance: currentBalance
     };
   }).reverse(); // Show newest first in table
 }, [allRangeEntries, categoryFilter, selectedHead, searchQuery]);

  // Sum total credits & debits for matching filters
  const totals = useMemo(() => {
    let totalCredit = 0;
    let totalDebit = 0;

    filteredEntries.forEach(t => {
      totalCredit += t.credit || 0;
      totalDebit += t.debit || 0;
   });

    return {
      totalCredit,
      totalDebit,
      balance: totalCredit - totalDebit
   };
 }, [filteredEntries]);
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
   }
    const headers = ['Sl No', 'Date', 'Account/Loan No', 'Head of Account', 'Borrower/Partner', 'Credit (Cr)', 'Debit (Dr)', 'Running Balance', 'Particulars', 'User'];
    const rows = filteredEntries.map((entry, idx) => [
      idx + 1,
      entry.transactionDate.split('-').reverse().join('/'),
      entry.accountOrLoanNo || '',
      entry.headOfAccount,
      entry.customerName || entry.accountOrLoanNo || '',
      entry.credit,
      entry.debit,
      entry.runningBalance,
      entry.particulars || '',
      entry.userName || 'Staff'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Detailed_Ledger_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to Excel CSV!');
 };

  const categories = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'CD', label: 'CD Ledger' },
    { value: 'CAPITAL', label: 'Partner Capital' },
    { value: 'BANK', label: 'Bank Book' },
    { value: 'SALARY', label: 'Salary Ledger' },
    { value: 'EXPENSE', label: 'Expenses' },
    { value: 'OTHER', label: 'Other Daybook' }
  ];

  return (
    <div className="space-y-3 w-full select-none text-slate-800 p-2 font-outfit">
      
      {/* Header */}
      <div className={`flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm`}>
        <div>
          <h1 className="text-[24px] font-bold uppercase tracking-tight text-slate-900 leading-none">Detailed Ledger</h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase mt-1">
            COMPREHENSIVE AUDIT REPORT FOR ALL TRANSACTION HEADS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-[48px] bg-white text-slate-700 border border-slate-250 rounded hover:bg-slate-50 font-bold text-[16px] uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-[48px] bg-emerald-600 text-white border border-emerald-700 rounded hover:bg-emerald-750 font-bold text-[16px] uppercase"
          >
            <FileSpreadsheet className="w-4 h-4" />
            EXCEL
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-[48px] bg-[#0b1329] text-white border border-slate-800 rounded hover:bg-slate-800 font-bold text-[16px] uppercase"
          >
            <Printer className="w-4 h-4" />
            PRINT
          </button>
        </div>
      </div>

      {/* Date & Category Filters in One Row */}
      <div className={`grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm items-end`}>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">FROM DATE</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] focus:outline-none h-[48px] font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">TO DATE</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] focus:outline-none h-[48px] font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">Category Filter</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] focus:outline-none h-[48px] font-bold uppercase"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">Head of Account</label>
          <select
            value={selectedHead}
            onChange={(e) => setSelectedHead(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] focus:outline-none h-[48px] font-bold uppercase"
          >
            <option value="ALL">ALL HEADS</option>
            {uniqueHeads.map(h => (
              <option key={h} value={h}>{h.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">Search Transaction</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 bg-white border border-slate-250 rounded text-[16px] focus:outline-none h-[48px] font-bold"
            />
          </div>
        </div>
      </div>

      {/* Detailed Ledger Sheet */}
      <div className={showPrintPreview ? 'print:hidden' : ''}>
        <Card
          title={<span className="text-[17px] font-bold uppercase">Ledger Transactions</span>}
          subtitle={`Showing ${filteredEntries.length} entries matching filters`}
          className="shadow-sm border-slate-200 rounded"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Transactions Table */}
              <div className="overflow-x-auto border border-slate-200 rounded" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="min-w-full text-[13px] divide-y divide-slate-200">
                  <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700">
                    <tr className="divide-x divide-slate-200">
                      <th className="w-10 px-2 py-2 text-center font-bold text-[12px] uppercase whitespace-nowrap">Sl</th>
                      <th className="w-24 px-2 py-2 text-left font-bold text-[12px] uppercase whitespace-nowrap">Date</th>
                      <th className="w-20 px-2 py-2 text-left font-bold text-[12px] uppercase whitespace-nowrap">ACC NO</th>
                      <th className="w-36 px-2 py-2 text-left font-bold text-[12px] uppercase whitespace-nowrap">Head of Account</th>
                      <th className="w-40 px-2 py-2 text-left font-bold text-[12px] uppercase whitespace-nowrap">Borrower/Partner</th>
                      <th className="w-28 px-2 py-2 text-right font-bold text-[12px] uppercase whitespace-nowrap">Credit (Cr)</th>
                      <th className="w-28 px-2 py-2 text-right font-bold text-[12px] uppercase whitespace-nowrap">Debit (Dr)</th>
                      <th className="w-32 px-2 py-2 text-right font-bold text-[12px] uppercase whitespace-nowrap">Running Bal</th>
                      <th className="min-w-[140px] px-2 py-2 text-left font-bold text-[12px] uppercase">Particulars</th>
                      <th className="w-20 px-2 py-2 text-left font-bold text-[12px] uppercase whitespace-nowrap">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white divide-x divide-slate-50 font-semibold text-slate-855">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-bold uppercase">
                          No transactions found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, idx) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 divide-x divide-slate-100" style={{ height: '34px' }}>
                          <td className="px-2 py-1 text-center text-slate-400 font-mono text-[12px]">{idx + 1}</td>
                          <td className="px-2 py-1 text-slate-700 whitespace-nowrap font-mono text-[12px]">
                            {entry.transactionDate.split('-').reverse().join('/')}
                          </td>
                          <td className="px-2 py-1 font-mono text-slate-900 font-bold truncate text-[12px] max-w-[128px]">{entry.accountOrLoanNo || '—'}</td>
                          <td className="px-2 py-1 text-slate-800 uppercase truncate text-[12px] max-w-[144px]">{entry.headOfAccount}</td>
                          <td className="px-2 py-1 text-slate-700 uppercase text-[12px] break-words">{entry.customerName || entry.accountOrLoanNo || '—'}</td>
                          <td className="px-2 py-1 text-right text-emerald-700 font-bold whitespace-nowrap font-mono text-[12px]">
                            {entry.credit > 0 ? `${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-2 py-1 text-right text-red-700 font-bold whitespace-nowrap font-mono text-[12px]">
                            {entry.debit > 0 ? `${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className={`px-2 py-1 text-right font-bold whitespace-nowrap font-mono text-[12px] ${entry.runningBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                            {Math.abs(entry.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {entry.runningBalance >= 0 ? 'Cr' : 'Dr'}
                          </td>
                          <td className="px-2 py-1 text-slate-600 truncate uppercase text-[12px]" title={entry.particulars}>{entry.particulars}</td>
                          <td className="px-2 py-1 text-slate-500 uppercase truncate text-[12px]">{entry.userName || 'Staff'}</td>
                        </tr>
                      ))
                    )}
                    {/* Grand Total */}
                    <tr className="bg-slate-50 font-bold divide-x divide-slate-100 border-t border-slate-200">
                      <td colSpan={5} className="px-3 py-2 text-right text-slate-800 uppercase">Grand Total:</td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-black whitespace-nowrap font-mono">
                        {totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right text-red-700 font-black whitespace-nowrap font-mono">
                        {totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Compact Totals Strip */}
              <div className="flex flex-wrap gap-4 p-3 bg-slate-50 border border-slate-200 rounded shadow-sm text-sm font-bold uppercase items-center justify-between mt-3">
                <div>Total Cr: <span className="text-emerald-700 font-mono">{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="hidden md:block w-px h-4 bg-slate-300"></div>
                <div>Total Dr: <span className="text-red-700 font-mono">{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="hidden md:block w-px h-4 bg-slate-300"></div>
                <div>Net Balance: <span className={`${totals.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'} font-mono`}>{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Detailed Ledger Report"
        documentTitle={`DETAILED LEDGER: ${fromDate ? new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''} to ${new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
      >
        {!loading && (
          <div className="space-y-6">
            <div className="text-center pb-6 border-b-2 border-slate-900">
              <h2 className="finance-brand">TIRUMALA FINANCE</h2>
              <p className="mt-1 finance-header-time uppercase">DETAILED LEDGER TRANSACTION STATEMENT</p>
              <p className="text-slate-500 text-[10px] mt-0.5 uppercase">
                PERIOD: {fromDate ? new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''} to {new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>

            <table className="min-w-full divide-y divide-slate-300 finance-caption">
              <thead>
                <tr className="bg-slate-50">
                  <th className="py-2 px-1 text-center font-bold text-slate-700 uppercase">Sl</th>
                  <th className="py-2 px-2 text-left font-bold text-slate-700 uppercase">Date</th>
                  <th className="py-2 px-2 text-left font-bold text-slate-700 uppercase">ACC NO</th>
                  <th className="py-2 px-2 text-left font-bold text-slate-700 uppercase">Head of Account</th>
                  <th className="py-2 px-2 text-right font-bold text-slate-700 uppercase">Cr</th>
                  <th className="py-2 px-2 text-right font-bold text-slate-700 uppercase">Dr</th>
                  <th className="py-2 px-2 text-right font-bold text-slate-700 uppercase">Bal</th>
                  <th className="py-2 px-2 text-left font-bold text-slate-700 uppercase">Particulars</th>
                  <th className="py-2 px-2 text-left font-bold text-slate-700 uppercase">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntries.map((entry, idx) => (
                  <tr key={entry.id} className="text-[12px]">
                    <td className="py-1 px-1 text-center font-mono">{idx + 1}</td>
                    <td className="py-1 px-2 font-mono">{entry.transactionDate.split('-').reverse().join('/')}</td>
                    <td className="py-1 px-2 font-mono font-bold uppercase">{entry.accountOrLoanNo || '—'}</td>
                    <td className="py-1 px-2 uppercase font-medium">{entry.headOfAccount}</td>
                    <td className="py-1 px-2 text-right font-mono text-emerald-600">{entry.credit > 0 ? `${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="py-1 px-2 text-right font-mono text-red-600">{entry.debit > 0 ? `${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="py-1 px-2 text-right font-mono font-bold">{Math.abs(entry.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {entry.runningBalance >= 0 ? 'Cr' : 'Dr'}</td>
                    <td className="py-1 px-2 uppercase truncate max-w-xs">{entry.particulars || '—'}</td>
                    <td className="py-1 px-2 uppercase text-slate-500">{entry.userName || 'Staff'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summaries strip */}
            <div className="grid grid-cols-3 gap-4 py-4 border-t border-slate-350 finance-caption mt-4">
              <div>
                <span className="text-slate-500 text-[9px] uppercase font-bold block">TOTAL CREDITS (Cr)</span>
                <span className="text-emerald-700 text-lg font-black font-mono">{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] uppercase font-bold block">TOTAL DEBITS (Dr)</span>
                <span className="text-red-700 text-lg font-black font-mono">{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] uppercase font-bold block">NET LEDGER BALANCE</span>
                <span className="text-slate-900 text-lg font-black font-mono">
                  {totals.balance >= 0 ? '+' : ''}{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </FinancePrintPreview>

    </div>
  );
};

export default DetailedLedgerFinance;
