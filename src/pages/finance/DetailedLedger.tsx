import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { Printer, ArrowLeft, Calendar, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

const DetailedLedgerFinance: React.FC = () => {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => getLocalBusinessDateISO());
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CD' | 'CAPITAL' | 'BANK' | 'SALARY' | 'EXPENSE' | 'OTHER'>('ALL');
  const [selectedHead, setSelectedHead] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [allRangeEntries, setAllRangeEntries] = useState<DailyFinancialTransaction[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
  });

  useEffect(() => {
    fetchData();
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
    allRangeEntries.forEach(t => {
      if (t.headOfAccount) heads.add(t.headOfAccount);
    });
    return Array.from(heads).sort();
  }, [allRangeEntries]);

  // Dynamically recalculate opening balance and list based on selected head and category filter
  const filteredEntries = useMemo(() => {
    // Filter current date range entries
    let result = [...allRangeEntries];

    if (categoryFilter !== 'ALL') {
      result = result.filter(t => t.category === categoryFilter);
    }

    if (selectedHead !== 'ALL') {
      result = result.filter(t => t.headOfAccount === selectedHead);
    }

    // Apply search filter
    const query = searchQuery.toLowerCase().trim();
    let finalResult = [...result];
    if (query) {
      finalResult = finalResult.filter(entry => {
        const head = (entry.headOfAccount || '').toLowerCase();
        const accNo = (entry.accountOrLoanNo || '').toLowerCase();
        const part = (entry.particulars || '').toLowerCase();
        const usr = (entry.userName || '').toLowerCase();
        const customer = (entry.customerName || '').toLowerCase();
        const dateStr = entry.transactionDate.split('-').reverse().join('/');
        return (
          head.includes(query) ||
          accNo.includes(query) ||
          part.includes(query) ||
          usr.includes(query) ||
          customer.includes(query) ||
          entry.transactionDate.includes(query) ||
          dateStr.includes(query)
        );
      });
    }

    // Add running balance onto chronological list
    let running = 0; // We'll compute it from transaction list
    const mapped = finalResult.map((entry) => {
      // Calculate running balance incrementally
      running = running + entry.credit - entry.debit;
      return {
        ...entry,
        runningBalance: running
      };
    });

    return mapped;
  }, [allRangeEntries, categoryFilter, selectedHead, searchQuery]);

  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    filteredEntries.forEach(entry => {
      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    });

    return {
      totalDebit,
      totalCredit,
      balance: totalCredit - totalDebit
    };
  }, [filteredEntries]);

  const categories = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'CD', label: 'CD Loans' },
    { value: 'CAPITAL', label: 'Capital' },
    { value: 'BANK', label: 'Bank accounts' },
    { value: 'SALARY', label: 'Salary A/c' },
    { value: 'EXPENSE', label: 'Expenses' },
    { value: 'OTHER', label: 'Other Daybook' }
  ];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>REPORTS</span>
            <span>/</span>
            <span className="text-slate-600">DETAILED LEDGER</span>
          </div>
          <h1 className="mt-1 finance-h1">Detailed Ledger</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            Comprehensive audit report for all financial transaction heads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            PRINT
          </button>
        </div>
      </div>

      {/* Date & Category Filters */}
      <div className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl ${showPrintPreview ? 'print:hidden' : ''}`}>
        <Input
          label="FROM DATE"
          type="date"
          value={fromDate}
          onChange={setFromDate}
          icon={Calendar}
        />
        <Input
          label="TO DATE"
          type="date"
          value={toDate}
          onChange={setToDate}
          icon={Calendar}
        />
        <div className="flex flex-col justify-end">
          <label className="text-slate-500 mb-1 finance-small-label uppercase">Category Filter</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:ring-1 focus:ring-green-500 focus:border-green-500 finance-input"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="text-slate-500 mb-1 finance-small-label uppercase">Head of Account</label>
          <select
            value={selectedHead}
            onChange={(e) => setSelectedHead(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:ring-1 focus:ring-green-500 focus:border-green-500 finance-input"
          >
            <option value="ALL">All Heads</option>
            {uniqueHeads.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <Input
          label="SEARCH TRANSACTION"
          type="text"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by loan, head, particulars..."
          icon={Search}
        />
      </div>

      {/* Detailed Ledger Sheet */}
      <div className={showPrintPreview ? 'print:hidden' : ''}>
        <Card
          title={
            <div className="flex justify-between items-center w-full">
              <span className="finance-card-title uppercase">Ledger Transactions</span>
              <span className="font-mono text-slate-500 text-right finance-small-label uppercase">
                {new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to {new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
          }
          subtitle={`Showing ${filteredEntries.length} entries matching filters`}
          className="shadow-md border-slate-150 rounded-xl"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 shadow-xs">
                  <span className="text-red-700 block finance-header-time uppercase">Total Debits (Dr)</span>
                  <span className="text-red-800 finance-brand">₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 shadow-xs">
                  <span className="text-green-700 block finance-header-time uppercase">Total Credits (Cr)</span>
                  <span className="text-green-800 finance-brand">₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`p-4 rounded-xl border shadow-xs ${totals.balance >= 0 ? 'bg-emerald-100 border-emerald-250' : 'bg-rose-100 border-rose-250'}`}>
                  <span className={`${totals.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'} block finance-header-time uppercase`}>Net Balance</span>
                  <span className={`${totals.balance >= 0 ? 'text-emerald-950' : 'text-rose-950'} finance-brand`}>
                    {totals.balance >= 0 ? '+' : ''}₹{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="min-w-full divide-y divide-slate-150 finance-caption">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="finance-small-label uppercase">Sl No</th>
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="finance-small-label uppercase">Account/Loan No</th>
                      <th className="finance-small-label uppercase">Head of Account</th>
                      <th className="finance-small-label uppercase">Borrower/Partner</th>
                      <th className="text-right finance-small-label uppercase">Debit (Dr)</th>
                      <th className="text-right finance-small-label uppercase">Credit (Cr)</th>
                      <th className="text-right finance-small-label uppercase">Running Bal</th>
                      <th className="finance-small-label uppercase">Particulars</th>
                      <th className="finance-small-label uppercase">User</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-400 finance-input">
                          No transactions found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, idx) => (
                        <tr key={entry.id} className="hover:bg-slate-50/30">
                          <td className="px-3 py-3 text-slate-500 finance-input">{idx + 1}</td>
                          <td className="px-3 py-3 text-slate-650 whitespace-nowrap finance-input">
                            {entry.transactionDate.split('-').reverse().join('/')}
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-900 font-black">{entry.accountOrLoanNo || '—'}</td>
                          <td className="px-3 py-3 text-slate-800 font-semibold uppercase">{entry.headOfAccount}</td>
                          <td className="px-3 py-3 text-slate-700 finance-input uppercase">{entry.customerName || entry.accountOrLoanNo || '—'}</td>
                          <td className="px-3 py-3 text-right text-rose-600 font-medium whitespace-nowrap finance-input">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap finance-input">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className={`px-3 py-3 text-right font-semibold whitespace-nowrap finance-input ${entry.runningBalance >= 0 ? 'text-emerald-850' : 'text-rose-850'}`}>
                            ₹{Math.abs(entry.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {entry.runningBalance >= 0 ? 'Cr' : 'Dr'}
                          </td>
                          <td className="px-3 py-3 text-slate-700 max-w-xs break-words finance-input">{entry.particulars}</td>
                          <td className="px-3 py-3 text-slate-500 finance-input uppercase">{entry.userName || 'Staff'}</td>
                        </tr>
                      ))
                    )}
                    {/* Grand Total */}
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={5} className="px-3 py-3.5 text-right text-slate-800 finance-input uppercase">Grand Total:</td>
                      <td className="px-3 py-3.5 text-right text-rose-700 font-bold whitespace-nowrap finance-input">
                        ₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3.5 text-right text-emerald-700 font-bold whitespace-nowrap finance-input">
                        ₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
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
        documentTitle={`DETAILED LEDGER: ${new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
      >
        {!loading && (
          <div className="space-y-6">
            {/* Headers */}
            <div className="flex justify-between items-end border-b border-slate-900 pb-2">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
                <p className="text-[13px] uppercase text-slate-500">Detailed Ledger Statement</p>
              </div>
              <div className="text-right text-[13px] text-slate-650">
                <p>Period: {fromDate.split('-').reverse().join('/')} to {toDate.split('-').reverse().join('/')}</p>
                <p>Category: {categoryFilter} | Head: {selectedHead}</p>
              </div>
            </div>

            {/* Print Summary */}
            <div className="grid grid-cols-3 gap-4 border p-3 rounded">
              <div>
                <span className="text-[13px] text-slate-500 uppercase block">Total Debits</span>
                <span className="text-sm font-bold text-red-700">₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[13px] text-slate-500 uppercase block">Total Credits</span>
                <span className="text-sm font-bold text-green-700">₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[13px] text-slate-500 uppercase block">Net Balance</span>
                <span className={`text-sm font-bold ${totals.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  ₹{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Print Table */}
            <table className="w-full border-collapse" style={{ tableLayout: 'auto', fontSize: '9pt' }}>
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100">
                  <th className="p-1.5 text-left border">Sl</th>
                  <th className="p-1.5 text-left border">Date</th>
                  <th className="p-1.5 text-left border">Account/Loan</th>
                  <th className="p-1.5 text-left border">Head of Account</th>
                  <th className="p-1.5 text-left border">Borrower/Partner</th>
                  <th className="p-1.5 text-right border">Debit</th>
                  <th className="p-1.5 text-right border">Credit</th>
                  <th className="p-1.5 text-right border">Running Bal</th>
                  <th className="p-1.5 text-left border">Particulars</th>
                  <th className="p-1.5 text-left border">User</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, idx) => (
                  <tr key={entry.id} className="border-b">
                    <td className="p-1.5 border">{idx + 1}</td>
                    <td className="p-1.5 border whitespace-nowrap">{entry.transactionDate.split('-').reverse().join('/')}</td>
                    <td className="p-1.5 border font-mono font-bold">{entry.accountOrLoanNo || '—'}</td>
                    <td className="p-1.5 border uppercase">{entry.headOfAccount}</td>
                    <td className="p-1.5 border uppercase">{entry.customerName || entry.accountOrLoanNo || '—'}</td>
                    <td className="p-1.5 border text-right text-red-650">{entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="p-1.5 border text-right text-green-650">{entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="p-1.5 border text-right font-semibold">₹{Math.abs(entry.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {entry.runningBalance >= 0 ? 'Cr' : 'Dr'}</td>
                    <td className="p-1.5 border">{entry.particulars}</td>
                    <td className="p-1.5 border text-slate-500 uppercase">{entry.userName || 'Staff'}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-800">
                  <td colSpan={5} className="p-1.5 text-right border uppercase">Grand Total:</td>
                  <td className="p-1.5 text-right border text-red-700">₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1.5 text-right border text-green-700">₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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

export default DetailedLedgerFinance;
