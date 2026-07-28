import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { FinanceSmartCalendar } from '../../components/finance/FinanceSmartCalendar';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { ArrowLeft, RefreshCw, Printer, Download, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { exportToExcelMultiSheet } from '../../utils/excel';

export interface PLHeadMetric {
  name: string;
  opening: number;
  currentPeriod: number;
  total: number;
  percentage: number;
  ledgerCount: number;
  entries: DailyFinancialTransaction[];
}

interface BSAccountBalanceItem {
  accountName: string;
  opening: number;
  credit: number;
  debit: number;
  closing: number;
}

const formatDateOld = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const ProfitAndLoss: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [incomeHeads, setIncomeHeads] = useState<PLHeadMetric[]>([]);
  const [expenseHeads, setExpenseHeads] = useState<PLHeadMetric[]>([]);
  const [expandedHeadNames, setExpandedHeadNames] = useState<Set<string>>(new Set());
  const [partnerCount, setPartnerCount] = useState(1);

  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [accountBalances, setAccountBalances] = useState<BSAccountBalanceItem[]>([]);

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
  });

  const toggleExpandHead = (headName: string) => {
    setExpandedHeadNames(prev => {
      const next = new Set(prev);
      if (next.has(headName)) next.delete(headName);
      else next.add(headName);
      return next;
    });
  };

  useEffect(() => {
    const loadDefaultStartDate = async () => {
      try {
        const oldest = await dailyFinancialTransactionService.getOldestTransactionDate();
        if (oldest) {
          setStartDate(oldest);
        } else {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          setStartDate(d.toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error(err);
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        setStartDate(d.toISOString().split('T')[0]);
      }
    };
    loadDefaultStartDate();
  }, []);

  useEffect(() => {
    if (startDate) {
      fetchStatementData();
    }
  }, [startDate, endDate]);

  const fetchStatementData = async () => {
    setLoading(true);
    try {
      // 1. Calculate opening balances & cash: fetch all historical entries before startDate
      const prevDateLimit = new Date(startDate);
      prevDateLimit.setDate(prevDateLimit.getDate() - 1);
      const prevDateLimitStr = prevDateLimit.toISOString().split('T')[0];

      let prevTxs: DailyFinancialTransaction[] = [];
      if (startDate > '1970-01-01') {
        prevTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: '1970-01-01',
          toDate: prevDateLimitStr,
          financeMode
        });
      }

      // 2. Fetch current range entries & partner list
      const [txs, partners] = await Promise.all([
        dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: startDate,
          toDate: endDate,
          financeMode
        }),
        supabaseFinance.getPartners()
      ]);

      setPartnerCount(partners.length || 1);

      // Compute opening cash
      let prevCash = 0;
      prevTxs.forEach(t => {
        prevCash += (t.credit - t.debit);
      });
      setOpeningCash(prevCash);

      // Compute Profit & Loss Head Details
      const prevIncomeMap = new Map<string, number>();
      const prevExpenseMap = new Map<string, number>();

      prevTxs.forEach(t => {
        if (t.reportClassification === 'PROFIT_AND_LOSS') {
          const head = t.headOfAccount || 'UNCLASSIFIED';
          if (t.credit > 0) {
            prevIncomeMap.set(head, (prevIncomeMap.get(head) || 0) + (t.credit - t.debit));
          }
          if (t.debit > 0) {
            prevExpenseMap.set(head, (prevExpenseMap.get(head) || 0) + (t.debit - t.credit));
          }
        }
      });

      const incomeEntriesMap = new Map<string, DailyFinancialTransaction[]>();
      const expenseEntriesMap = new Map<string, DailyFinancialTransaction[]>();

      txs.forEach(t => {
        if (t.reportClassification === 'PROFIT_AND_LOSS') {
          const head = t.headOfAccount || 'UNCLASSIFIED';
          if (t.credit > 0) {
            if (!incomeEntriesMap.has(head)) incomeEntriesMap.set(head, []);
            incomeEntriesMap.get(head)!.push(t);
          }
          if (t.debit > 0) {
            if (!expenseEntriesMap.has(head)) expenseEntriesMap.set(head, []);
            expenseEntriesMap.get(head)!.push(t);
          }
        }
      });

      const allIncomeHeadNames = new Set<string>([
        ...Array.from(prevIncomeMap.keys()),
        ...Array.from(incomeEntriesMap.keys())
      ]);

      const allExpenseHeadNames = new Set<string>([
        ...Array.from(prevExpenseMap.keys()),
        ...Array.from(expenseEntriesMap.keys())
      ]);

      // Calculate total current period income & expense for percentage allocation
      let totalCurrentIncome = 0;
      allIncomeHeadNames.forEach(head => {
        const entries = incomeEntriesMap.get(head) || [];
        entries.forEach(e => totalCurrentIncome += (e.credit - e.debit));
      });

      let totalCurrentExpense = 0;
      allExpenseHeadNames.forEach(head => {
        const entries = expenseEntriesMap.get(head) || [];
        entries.forEach(e => totalCurrentExpense += (e.debit - e.credit));
      });

      const finalIncomes: PLHeadMetric[] = Array.from(allIncomeHeadNames).map(head => {
        const op = prevIncomeMap.get(head) || 0;
        const entries = incomeEntriesMap.get(head) || [];
        const curr = entries.reduce((sum, e) => sum + (e.credit - e.debit), 0);
        const tot = op + curr;
        const pct = totalCurrentIncome > 0 ? (curr / totalCurrentIncome) * 100 : 0;

        return {
          name: head,
          opening: parseFloat(op.toFixed(2)),
          currentPeriod: parseFloat(curr.toFixed(2)),
          total: parseFloat(tot.toFixed(2)),
          percentage: parseFloat(pct.toFixed(1)),
          ledgerCount: entries.length,
          entries
        };
      });

      const finalExpenses: PLHeadMetric[] = Array.from(allExpenseHeadNames).map(head => {
        const op = prevExpenseMap.get(head) || 0;
        const entries = expenseEntriesMap.get(head) || [];
        const curr = entries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
        const tot = op + curr;
        const pct = totalCurrentExpense > 0 ? (curr / totalCurrentExpense) * 100 : 0;

        return {
          name: head,
          opening: parseFloat(op.toFixed(2)),
          currentPeriod: parseFloat(curr.toFixed(2)),
          total: parseFloat(tot.toFixed(2)),
          percentage: parseFloat(pct.toFixed(1)),
          ledgerCount: entries.length,
          entries
        };
      });

      finalIncomes.sort((a, b) => b.currentPeriod - a.currentPeriod);
      finalExpenses.sort((a, b) => b.currentPeriod - a.currentPeriod);

      setIncomeHeads(finalIncomes);
      setExpenseHeads(finalExpenses);

      // Compute closing cash
      let currCredit = 0;
      let currDebit = 0;
      txs.forEach(t => {
        currCredit += t.credit;
        currDebit += t.debit;
      });
      setClosingCash(prevCash + currCredit - currDebit);

      // Compute Balance Sheet Accounts
      const bsHeads = new Set<string>();
      prevTxs.forEach(t => {
        if (t.reportClassification === 'BALANCE_SHEET') bsHeads.add(t.headOfAccount);
      });
      txs.forEach(t => {
        if (t.reportClassification === 'BALANCE_SHEET') bsHeads.add(t.headOfAccount);
      });

      const balances: BSAccountBalanceItem[] = Array.from(bsHeads).map(head => {
        let op = 0;
        prevTxs.filter(t => t.headOfAccount === head).forEach(t => {
          op += (t.credit - t.debit);
        });

        let cr = 0;
        let dr = 0;
        txs.filter(t => t.headOfAccount === head).forEach(t => {
          cr += t.credit;
          dr += t.debit;
        });

        return {
          accountName: head,
          opening: op,
          credit: cr,
          debit: dr,
          closing: op + cr - dr
        };
      });

      balances.sort((a, b) => a.accountName.localeCompare(b.accountName));
      setAccountBalances(balances);

    } catch (err) {
      console.error(err);
      toast.error('Failed to compile statement data');
    } finally {
      setLoading(false);
    }
  };

  const navigateToDetailedLedger = (head: string) => {
    navigate(`/finance/detailed-ledger?head=${encodeURIComponent(head)}&from=${startDate}&to=${endDate}`);
  };

  const handleExportExcel = () => {
    const plData = [
      ...incomeHeads.map(head => ({
        'Category': 'INCOME HEAD',
        'Head of Account': head.name,
        'Opening Balance': head.opening,
        'Current Period Amount': head.currentPeriod,
        'Total Amount': head.total,
        '% Share of Total Income': `${head.percentage}%`,
        'Ledger Count': head.ledgerCount
      })),
      { 'Category': 'TOTAL INCOME', 'Head of Account': '', 'Opening Balance': 0, 'Current Period Amount': totalIncome, 'Total Amount': totalIncome, '% Share of Total Income': '100%', 'Ledger Count': 0 },
      ...expenseHeads.map(head => ({
        'Category': 'EXPENSE HEAD',
        'Head of Account': head.name,
        'Opening Balance': head.opening,
        'Current Period Amount': head.currentPeriod,
        'Total Amount': head.total,
        '% Share of Total Expense': `${head.percentage}%`,
        'Ledger Count': head.ledgerCount
      })),
      { 'Category': 'TOTAL EXPENSE', 'Head of Account': '', 'Opening Balance': 0, 'Current Period Amount': totalExpenses, 'Total Amount': totalExpenses, '% Share of Total Expense': '100%', 'Ledger Count': 0 },
      { 'Category': 'NET PERIOD PROFIT', 'Head of Account': '', 'Opening Balance': 0, 'Current Period Amount': totalProfit, 'Total Amount': totalProfit, '% Share of Total Expense': '—', 'Ledger Count': 0 },
      { 'Category': 'PER PARTNER SHARE', 'Head of Account': '', 'Opening Balance': 0, 'Current Period Amount': shareValue, 'Total Amount': shareValue, '% Share of Total Expense': '—', 'Ledger Count': 0 }
    ];

    const bsData = [
      { 'Opening Cash': openingCash, 'Closing Cash': closingCash },
      ...accountBalances.map(item => ({
        'Account Name': item.accountName,
        'Opening Balance': item.opening,
        'Credit': item.credit,
        'Debit': item.debit,
        'Closing Balance': item.closing
      }))
    ];

    const sheets = [
      { name: 'Profit & Loss Statement', data: plData },
      { name: 'Balance Sheet Accounts', data: bsData }
    ];

    exportToExcelMultiSheet(sheets, `Profit_Loss_Statement_${startDate}_to_${endDate}`);
    toast.success('P&L Statement Exported to Excel!');
  };

  const totalIncome = useMemo(() => incomeHeads.reduce((sum, item) => sum + item.currentPeriod, 0), [incomeHeads]);
  const totalExpenses = useMemo(() => expenseHeads.reduce((sum, item) => sum + item.currentPeriod, 0), [expenseHeads]);
  const totalProfit = totalIncome - totalExpenses;
  const shareValue = partnerCount > 0 ? totalProfit / partnerCount : totalProfit;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6 print:p-0 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">Profit &amp; Loss Statement</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 uppercase font-bold text-xs">
            Back
          </Button>
          <Button onClick={fetchStatementData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 uppercase font-bold text-xs">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white uppercase font-bold text-xs">
            Print
          </Button>
          <Button onClick={handleExportExcel} variant="secondary" size="sm" icon={Download} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 uppercase font-bold text-xs">
            Excel
          </Button>
        </div>
      </div>

      {/* Top Filter & Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {/* Date Filters Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <FinanceSmartCalendar
              label="FROM"
              value={startDate}
              onChange={setStartDate}
              module="PROFIT_LOSS"
              compact={true}
            />
          </div>
          <div>
            <FinanceSmartCalendar
              label="TO"
              value={endDate}
              onChange={setEndDate}
              module="PROFIT_LOSS"
              compact={true}
            />
          </div>
        </div>

        {/* Total Income Card */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 block finance-small-label font-bold uppercase tracking-wider text-[11px]">Total Income</span>
          <span className="text-emerald-700 mt-1 font-mono font-black text-xl">{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 block finance-small-label font-bold uppercase tracking-wider text-[11px]">Total Expenses</span>
          <span className="text-rose-700 mt-1 font-mono font-black text-xl">{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Net Period Profit Card */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 block finance-small-label font-bold uppercase tracking-wider text-[11px]">Net Period Profit</span>
          <span className={`mt-1 font-mono font-black text-xl ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Per Partner Share Card */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 block finance-small-label font-bold uppercase tracking-wider text-[11px]">Partner Share ({partnerCount})</span>
          <span className="text-[#0b1329] mt-1 font-mono font-black text-xl">{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* SECTION A: PROFIT & LOSS STATEMENT (Income vs Expenses) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-slate-900 font-black uppercase text-base tracking-wide flex items-center gap-2">
            <span>Part I: Profit &amp; Loss Accounting Statement</span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {incomeHeads.length} Income Heads | {expenseHeads.length} Expense Heads
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Heads Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/90">
                <div>
                  <h3 className="text-slate-900 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    Income Heads
                  </h3>
                  <p className="text-slate-500 text-[11px] font-bold uppercase mt-0.5">{incomeHeads.length} Configured Income Heads</p>
                </div>
                <span className="font-mono font-black text-emerald-800 text-base">
                  ₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-xs text-left min-w-[650px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-[2px] text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-250">
                    <tr>
                      <th className="w-8 px-3 py-3 text-center"></th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Head Name</th>
                      <th className="px-3.5 py-3 text-right text-slate-600 whitespace-nowrap">Opening</th>
                      <th className="px-3.5 py-3 text-right text-emerald-800 whitespace-nowrap">Current Period</th>
                      <th className="px-3.5 py-3 text-right text-slate-900 whitespace-nowrap">Total</th>
                      <th className="px-3.5 py-3 text-right text-slate-600 whitespace-nowrap">% Share</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">Entries</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {incomeHeads.map((head) => {
                      const isExpanded = expandedHeadNames.has(head.name);
                      return (
                        <React.Fragment key={head.name}>
                          <tr className="odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/40 transition-colors">
                            <td className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandHead(head.name)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                                title={isExpanded ? "Collapse Entries" : "Expand Underlying Ledger Entries"}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              </button>
                            </td>
                            <td className="px-3.5 py-3 font-bold text-slate-900 uppercase whitespace-nowrap">{head.name}</td>
                            <td className="px-3.5 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {head.opening !== 0 ? head.opening.toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {head.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              {head.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">{head.percentage}%</td>
                            <td className="px-3.5 py-3 text-center font-mono font-black text-slate-800 whitespace-nowrap">{head.ledgerCount}</td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => navigateToDetailedLedger(head.name)}
                                className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 text-[11px] font-bold hover:underline"
                                title="Open Detailed Ledger"
                              >
                                <span>Ledger</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Sub-table for Underlying Ledger Entries */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={8} className="px-4 py-3 border-y border-slate-250">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
                                  <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-700 border-b pb-1.5">
                                    <span className="flex items-center gap-1.5 text-emerald-900">
                                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                      TRANSACTION BREAKDOWN
                                    </span>
                                    <button 
                                      onClick={() => navigateToDetailedLedger(head.name)}
                                      className="text-blue-700 hover:underline font-sans font-bold text-[11px] inline-flex items-center gap-1"
                                    >
                                      View Full Ledger <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin">
                                    <table className="w-full text-[11px] text-left border-collapse">
                                      <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                                        <tr>
                                          <th className="p-1.5 whitespace-nowrap">Date</th>
                                          <th className="p-1.5 whitespace-nowrap">Module</th>
                                          <th className="p-1.5 whitespace-nowrap">Receipt/Voucher</th>
                                          <th className="p-1.5 whitespace-nowrap">Loan/Acc No</th>
                                          <th className="p-1.5 whitespace-nowrap">Party/Customer</th>
                                          <th className="p-1.5 whitespace-nowrap">Particulars</th>
                                          <th className="p-1.5 text-right text-emerald-800 whitespace-nowrap">Credit</th>
                                          <th className="p-1.5 text-right text-rose-800 whitespace-nowrap">Debit</th>
                                          <th className="p-1.5 whitespace-nowrap">User</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-150 font-mono">
                                        {head.entries.map((entry) => (
                                          <tr key={entry.id} className="hover:bg-slate-50">
                                            <td className="p-1.5 font-bold whitespace-nowrap">{formatDateOld(entry.transactionDate)}</td>
                                            <td className="p-1.5 text-slate-600 whitespace-nowrap">{entry.sourceType}</td>
                                            <td className="p-1.5 font-black whitespace-nowrap">{entry.receiptOrVoucherNo || '—'}</td>
                                            <td className="p-1.5 font-bold text-blue-900 whitespace-nowrap">{entry.accountOrLoanNo || '—'}</td>
                                            <td className="p-1.5 font-sans font-medium whitespace-nowrap">{entry.customerName || entry.partnerName || '—'}</td>
                                            <td className="p-1.5 font-sans text-slate-700 truncate max-w-[180px]" title={entry.particulars}>{entry.particulars || '—'}</td>
                                            <td className="p-1.5 text-right text-emerald-700 font-bold whitespace-nowrap">{entry.credit > 0 ? entry.credit.toLocaleString('en-IN') : '—'}</td>
                                            <td className="p-1.5 text-right text-rose-700 font-bold whitespace-nowrap">{entry.debit > 0 ? entry.debit.toLocaleString('en-IN') : '—'}</td>
                                            <td className="p-1.5 font-sans text-slate-600 whitespace-nowrap">{entry.userName || 'Staff'}</td>
                                          </tr>
                                        ))}
                                        {head.entries.length === 0 && (
                                          <tr>
                                            <td colSpan={9} className="text-center py-4 text-slate-400 font-bold uppercase italic">No transactions found.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {incomeHeads.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400 font-bold uppercase italic">No transactions found.</td>
                      </tr>
                    )}
                  </tbody>
                  {incomeHeads.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100/95 backdrop-blur-[2px] text-slate-900 font-mono font-black text-xs border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="px-3.5 py-3 uppercase text-right font-sans font-bold text-slate-700">TOTAL INCOME:</td>
                        <td className="px-3.5 py-3 text-right text-emerald-800 font-black">{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Expense Heads Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/90">
                <div>
                  <h3 className="text-slate-900 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                    Expense Heads
                  </h3>
                  <p className="text-slate-500 text-[11px] font-bold uppercase mt-0.5">{expenseHeads.length} Configured Expense Heads</p>
                </div>
                <span className="font-mono font-black text-rose-800 text-base">
                  ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-xs text-left min-w-[650px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-[2px] text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-250">
                    <tr>
                      <th className="w-8 px-3 py-3 text-center"></th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Head Name</th>
                      <th className="px-3.5 py-3 text-right text-slate-600 whitespace-nowrap">Opening</th>
                      <th className="px-3.5 py-3 text-right text-rose-800 whitespace-nowrap">Current Period</th>
                      <th className="px-3.5 py-3 text-right text-slate-900 whitespace-nowrap">Total</th>
                      <th className="px-3.5 py-3 text-right text-slate-600 whitespace-nowrap">% Share</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">Entries</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {expenseHeads.map((head) => {
                      const isExpanded = expandedHeadNames.has(head.name);
                      return (
                        <React.Fragment key={head.name}>
                          <tr className="odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/40 transition-colors">
                            <td className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandHead(head.name)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                                title={isExpanded ? "Collapse Entries" : "Expand Underlying Ledger Entries"}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              </button>
                            </td>
                            <td className="px-3.5 py-3 font-bold text-slate-900 uppercase whitespace-nowrap">{head.name}</td>
                            <td className="px-3.5 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {head.opening !== 0 ? head.opening.toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                              {head.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              {head.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">{head.percentage}%</td>
                            <td className="px-3.5 py-3 text-center font-mono font-black text-slate-800 whitespace-nowrap">{head.ledgerCount}</td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => navigateToDetailedLedger(head.name)}
                                className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 text-[11px] font-bold hover:underline"
                                title="Open Detailed Ledger"
                              >
                                <span>Ledger</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Sub-table for Underlying Ledger Entries */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={8} className="px-4 py-3 border-y border-slate-250">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
                                  <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-700 border-b pb-1.5">
                                    <span className="flex items-center gap-1.5 text-rose-900">
                                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                                      UNDERLYING EXPENSE LEDGER DRILL-DOWN ({head.ledgerCount} Transactions)
                                    </span>
                                    <button 
                                      onClick={() => navigateToDetailedLedger(head.name)}
                                      className="text-blue-700 hover:underline font-sans font-bold text-[11px] inline-flex items-center gap-1"
                                    >
                                      View Full Ledger <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin">
                                    <table className="w-full text-[11px] text-left border-collapse">
                                      <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                                        <tr>
                                          <th className="p-1.5 whitespace-nowrap">Date</th>
                                          <th className="p-1.5 whitespace-nowrap">Source</th>
                                          <th className="p-1.5 whitespace-nowrap">Receipt/Voucher</th>
                                          <th className="p-1.5 whitespace-nowrap">Loan/Acc No</th>
                                          <th className="p-1.5 whitespace-nowrap">Party/Customer</th>
                                          <th className="p-1.5 whitespace-nowrap">Particulars</th>
                                          <th className="p-1.5 text-right text-emerald-800 whitespace-nowrap">Credit</th>
                                          <th className="p-1.5 text-right text-rose-800 whitespace-nowrap">Debit</th>
                                          <th className="p-1.5 whitespace-nowrap">User</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-150 font-mono">
                                        {head.entries.map((entry) => (
                                          <tr key={entry.id} className="hover:bg-slate-50">
                                            <td className="p-1.5 font-bold whitespace-nowrap">{formatDateOld(entry.transactionDate)}</td>
                                            <td className="p-1.5 text-slate-600 whitespace-nowrap">{entry.sourceType}</td>
                                            <td className="p-1.5 font-black whitespace-nowrap">{entry.receiptOrVoucherNo || '—'}</td>
                                            <td className="p-1.5 font-bold text-blue-900 whitespace-nowrap">{entry.accountOrLoanNo || '—'}</td>
                                            <td className="p-1.5 font-sans font-medium whitespace-nowrap">{entry.customerName || entry.partnerName || '—'}</td>
                                            <td className="p-1.5 font-sans text-slate-700 truncate max-w-[180px]" title={entry.particulars}>{entry.particulars || '—'}</td>
                                            <td className="p-1.5 text-right text-emerald-700 font-bold whitespace-nowrap">{entry.credit > 0 ? entry.credit.toLocaleString('en-IN') : '—'}</td>
                                            <td className="p-1.5 text-right text-rose-700 font-bold whitespace-nowrap">{entry.debit > 0 ? entry.debit.toLocaleString('en-IN') : '—'}</td>
                                            <td className="p-1.5 font-sans text-slate-600 whitespace-nowrap">{entry.userName || 'Staff'}</td>
                                          </tr>
                                        ))}
                                        {head.entries.length === 0 && (
                                          <tr>
                                            <td colSpan={9} className="text-center py-4 text-slate-400 italic">No current period transactions</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {expenseHeads.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400 italic">No expenses recorded for this date range</td>
                      </tr>
                    )}
                  </tbody>
                  {expenseHeads.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100/95 backdrop-blur-[2px] text-slate-900 font-mono font-black text-xs border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="px-3.5 py-3 uppercase text-right font-sans font-bold text-slate-700">TOTAL EXPENSES:</td>
                        <td className="px-3.5 py-3 text-right text-rose-800 font-black">{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION B: BALANCE SHEET ACCOUNTS POSITION (Separated from P&L Heads) */}
      <div className="space-y-4 pt-4">
        <div className="border-b border-slate-200 pb-2">
          <h2 className="text-slate-900 font-black uppercase text-base tracking-wide flex items-center justify-between">
            <span>Part II: Balance Sheet Accounts Position (Assets, Capital &amp; Liabilities)</span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              {accountBalances.length} Capital &amp; Asset Accounts
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : (
          <>
            {/* Cash Balances summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-500 block finance-small-label font-bold uppercase tracking-wider text-[11px]">Opening Cash Balance</span>
                <span className="text-slate-900 mt-1 font-mono font-black text-xl">{openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-500 block finance-small-label font-bold uppercase tracking-wider text-[11px]">Closing Cash Balance</span>
                <span className="text-slate-900 mt-1 font-mono font-black text-xl">{closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Balance Sheet Accounts table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/90">
                <h3 className="text-slate-900 font-bold uppercase tracking-wider text-sm">Balance Sheet Accounts</h3>
                <span className="text-slate-500 text-xs font-bold uppercase">{accountBalances.length} Accounts Listed</span>
              </div>

              {accountBalances.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No balance sheet accounts recorded.</div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-[2px] text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-250">
                      <tr>
                        <th className="px-4 py-3 text-center">S.No</th>
                        <th className="px-4 py-3 whitespace-nowrap">Account Name</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">Opening Balance</th>
                        <th className="px-4 py-3 text-right text-emerald-800 whitespace-nowrap">Credit</th>
                        <th className="px-4 py-3 text-right text-rose-800 whitespace-nowrap">Debit</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {accountBalances.map((acc, idx) => (
                        <tr 
                          key={idx} 
                          className="odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => navigateToDetailedLedger(acc.accountName)}
                        >
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-900 hover:text-blue-700 hover:underline font-bold uppercase whitespace-nowrap">{acc.accountName}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${acc.opening >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {Math.abs(acc.opening).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {acc.opening >= 0 ? 'Cr' : 'Dr'}
                          </td>
                          <td className="px-4 py-3 text-emerald-700 text-right font-mono font-bold">
                            {acc.credit > 0 ? acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-rose-700 text-right font-mono font-bold">
                            {acc.debit > 0 ? acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-black ${acc.closing >= 0 ? 'text-emerald-850' : 'text-rose-850'}`}>
                            {Math.abs(acc.closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {acc.closing >= 0 ? 'Cr' : 'Dr'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Profit & Loss Statement"
        documentTitle={`P&L STATEMENT: ${formatDateOld(startDate)} TO ${formatDateOld(endDate)}`}
      >
        <div className="space-y-6 pb-8 font-sans">
          <div className="text-center border-b pb-3">
            <h2 className="text-lg font-black uppercase text-slate-900">Profit &amp; Loss Accounting Audit Statement</h2>
            <p className="text-[10px] text-slate-500 uppercase font-mono mt-1">Period: {formatDateOld(startDate)} To {formatDateOld(endDate)}</p>
          </div>

          {/* Income vs Expenses Print Section */}
          <div className="grid grid-cols-2 gap-6 text-[10px]">
            <div>
              <div className="border-b-2 border-emerald-800 px-1 pb-1 font-bold text-emerald-900 uppercase">Incomes</div>
              <table className="w-full text-left mt-2 border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-300 font-sans font-bold text-slate-600 text-[9px] uppercase">
                    <th className="py-1">Head Name</th>
                    <th className="py-1 text-right">Current Period</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeHeads.map((head, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-1 uppercase text-slate-900 font-bold">{head.name}</td>
                      <td className="py-1 text-right text-emerald-800 font-black">{head.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-1 text-right text-slate-900 font-black">{head.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {incomeHeads.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-slate-400">No income recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="border-b-2 border-rose-800 px-1 pb-1 font-bold text-rose-900 uppercase">Expenses</div>
              <table className="w-full text-left mt-2 border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-300 font-sans font-bold text-slate-600 text-[9px] uppercase">
                    <th className="py-1">Head Name</th>
                    <th className="py-1 text-right">Current Period</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseHeads.map((head, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-1 uppercase text-slate-900 font-bold">{head.name}</td>
                      <td className="py-1 text-right text-rose-800 font-black">{head.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-1 text-right text-slate-900 font-black">{head.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {expenseHeads.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-center text-slate-400">No expenses recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary Banner */}
          <div className="grid grid-cols-4 gap-4 border border-slate-900 p-2 text-center text-[10px] font-bold uppercase bg-slate-50 font-mono">
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Total Income</span>
              <span className="text-emerald-800 font-black">{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Total Expenses</span>
              <span className="text-rose-800 font-black">{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Net Period Profit</span>
              <span className={totalProfit >= 0 ? 'text-emerald-800 font-black' : 'text-rose-800 font-black'}>{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Partner Share ({partnerCount})</span>
              <span className="text-slate-900 font-black">{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default ProfitAndLoss;
