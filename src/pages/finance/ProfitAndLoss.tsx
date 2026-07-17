import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { dailyFinancialTransactionService } from '../../services/dailyFinancialTransactionService';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { ArrowLeft, RefreshCw, Printer, Download } from 'lucide-react';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { exportToExcelMultiSheet } from '../../utils/excel';

interface HeadItem {
  name: string;
  amount: number;
}

interface BSAccountBalanceItem {
  accountName: string;
  opening: number;
  credit: number;
  debit: number;
  closing: number;
}

const ProfitAndLoss: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [incomeHeads, setIncomeHeads] = useState<HeadItem[]>([]);
  const [expenseHeads, setExpenseHeads] = useState<HeadItem[]>([]);
  const [partnerCount, setPartnerCount] = useState(1);

  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [accountBalances, setAccountBalances] = useState<BSAccountBalanceItem[]>([]);

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
 });

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
      // 1. Calculate opening cash: fetch all historical entries before startDate
      const prevDateLimit = new Date(startDate);
      prevDateLimit.setDate(prevDateLimit.getDate() - 1);
      const prevDateLimitStr = prevDateLimit.toISOString().split('T')[0];

      let prevTxs: any[] = [];
      if (startDate > '1970-01-01') {
        prevTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: '1970-01-01',
          toDate: prevDateLimitStr,
          financeMode
       });
     }

      // 2. Fetch current range entries
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

      // Compute Profit & Loss details
      const incomeMap = new Map<string, number>();
      const expenseMap = new Map<string, number>();

      txs.forEach(t => {
        if (t.reportClassification === 'PROFIT_AND_LOSS') {
          const head = t.headOfAccount || 'UNCLASSIFIED';
          if (t.credit > 0) {
            incomeMap.set(head, (incomeMap.get(head) || 0) + t.credit);
         }
          if (t.debit > 0) {
            expenseMap.set(head, (expenseMap.get(head) || 0) + t.debit);
         }
       }
     });

      const finalIncomes = Array.from(incomeMap.entries()).map(([name, amount]) => ({ name, amount: parseFloat(amount.toFixed(2)) }));
      const finalExpenses = Array.from(expenseMap.entries()).map(([name, amount]) => ({ name, amount: parseFloat(amount.toFixed(2)) }));

      finalIncomes.sort((a, b) => b.amount - a.amount);
      finalExpenses.sort((a, b) => b.amount - a.amount);

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

      // Compute balance sheet accounts
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
      ...incomeHeads.map(item => ({ 'Account Type': 'Income', 'Head of Account': item.name, 'Amount': item.amount })),
      { 'Account Type': 'Total Income', 'Head of Account': '', 'Amount': totalIncome },
      ...expenseHeads.map(item => ({ 'Account Type': 'Expense', 'Head of Account': item.name, 'Amount': item.amount })),
      { 'Account Type': 'Total Expense', 'Head of Account': '', 'Amount': totalExpenses },
      { 'Account Type': 'Net Period Profit', 'Head of Account': '', 'Amount': totalProfit },
      { 'Account Type': 'Per Partner Share', 'Head of Account': '', 'Amount': shareValue }
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
      { name: 'Profit & Loss', data: plData },
      { name: 'Balance Sheet', data: bsData }
    ];

    exportToExcelMultiSheet(sheets, `PL_BalanceSheet_${startDate}_to_${endDate}`);
    toast.success('Excel Statement Exported!');
  };

  const totalIncome = useMemo(() => incomeHeads.reduce((sum, item) => sum + item.amount, 0), [incomeHeads]);
  const totalExpenses = useMemo(() => expenseHeads.reduce((sum, item) => sum + item.amount, 0), [expenseHeads]);
  const totalProfit = totalIncome - totalExpenses;
  const shareValue = totalProfit / partnerCount;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6 print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm`}>
        <div>
          <h1 className="finance-h1">P&L / Balance Sheet</h1>
          <p className="finance-small-label uppercase">
            Income vs Expenses over a date range, with balance sheet position summary
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={fetchStatementData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print
          </Button>
          <Button onClick={handleExportExcel} variant="secondary" size="sm" icon={Download} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Excel
          </Button>
        </div>
      </div>

      {/* Top Filter & Summary Row */}
      <div className={`grid grid-cols-1 sm:grid-cols-4 gap-4`}>
        {/* Date Filters Card */}
        <div className="sm:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-center">
          <div className="grid grid-cols-2 divide-x divide-slate-100 h-full">
            <div className="px-4 py-3 flex flex-col justify-center">
              <label className="text-slate-400 block mb-1 finance-small-label uppercase">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase font-bold"
              />
            </div>
            <div className="px-4 py-3 flex flex-col justify-center">
              <label className="text-slate-400 block mb-1 finance-small-label uppercase">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase font-bold"
              />
            </div>
          </div>
        </div>

        {/* Period Profit Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Period Profit</span>
          <span className="text-slate-900 mt-1 finance-money text-emerald-700">{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Per Partner Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Per-Partner Share</span>
          <span className="text-slate-900 mt-1 finance-money text-[#0b1329]">{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* SECTION A: PROFIT & LOSS (Income, Expense, Profit/Loss) at Top */}
      <div className={`space-y-4`}>
        <div className="border-b pb-2">
          <h2 className="text-slate-900 font-black uppercase text-base tracking-wide">Profit &amp; Loss Statement</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incomes Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[220px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-slate-900 finance-brand">Incomes</h2>
                    <p className="text-slate-550 mt-1 finance-small-label uppercase">{incomeHeads.length} Heads</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  {incomeHeads.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                      <p className="text-slate-400 italic text-sm">No Income recorded for this period</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-slate-100">
                        {incomeHeads.map((head, idx) => (
                          <tr 
                            key={idx} 
                            className="transition-colors hover:bg-slate-50 cursor-pointer"
                            onClick={() => navigateToDetailedLedger(head.name)}
                          >
                            <td className="px-4 py-3 text-slate-700 hover:text-blue-700 hover:underline uppercase font-bold">{head.name}</td>
                            <td className="px-4 py-3 text-emerald-600 text-right font-black font-mono">₹{head.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Expenses Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[220px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-slate-900 finance-brand">Expenses</h2>
                    <p className="text-slate-550 mt-1 finance-small-label uppercase">{expenseHeads.length} Heads</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  {expenseHeads.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                      <p className="text-slate-400 italic text-sm">No Expenses recorded for this period</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-slate-100">
                        {expenseHeads.map((head, idx) => (
                          <tr 
                            key={idx} 
                            className="transition-colors hover:bg-slate-50 cursor-pointer"
                            onClick={() => navigateToDetailedLedger(head.name)}
                          >
                            <td className="px-4 py-3 text-slate-700 hover:text-blue-700 hover:underline uppercase font-bold">{head.name}</td>
                            <td className="px-4 py-3 text-red-600 text-right font-black font-mono">₹{head.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* P&L totals summary block */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 block finance-small-label uppercase">Total Income</span>
                <span className="text-emerald-600 mt-1 finance-money">{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 block finance-small-label uppercase">Total Expenses</span>
                <span className="text-red-600 mt-1 finance-money">{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 block finance-small-label uppercase">Net Period Profit</span>
                <span className={`mt-1 finance-money ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 block finance-small-label uppercase">Partner Share ({partnerCount})</span>
                <span className="text-[#0b1329] mt-1 finance-money">{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SECTION B: BALANCE SHEET accounts and cash flow at Bottom */}
      <div className={`space-y-4`}>
        <div className="border-b pb-2">
          <h2 className="text-slate-900 font-black uppercase text-base tracking-wide">Balance Sheet Accounts Position</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : (
          <>
            {/* Cash Balances summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 block finance-small-label uppercase">Opening Cash</span>
                <span className="text-slate-900 mt-1 finance-money">{openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 block finance-small-label uppercase">Closing Cash</span>
                <span className="text-slate-900 mt-1 finance-money">{closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Balance Sheet Accounts table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-slate-900 finance-brand">Balance Sheet Accounts</h3>
                <span className="text-slate-550 mt-1 finance-small-label uppercase">{accountBalances.length} Accounts</span>
              </div>

              {accountBalances.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No balance sheet accounts found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse finance-caption">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        <th className="px-6 py-4 text-slate-400 finance-small-label uppercase">S.No</th>
                        <th className="px-6 py-4 text-slate-400 w-1/4 finance-small-label uppercase">Account Name</th>
                        <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Opening</th>
                        <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Credit</th>
                        <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Debit</th>
                        <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accountBalances.map((acc, idx) => (
                        <tr 
                          key={idx} 
                          className="transition-colors hover:bg-slate-50 cursor-pointer"
                          onClick={() => navigateToDetailedLedger(acc.accountName)}
                        >
                          <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                          <td className="px-6 py-4 text-slate-900 hover:text-blue-700 hover:underline font-bold uppercase">{acc.accountName}</td>
                          <td className={`px-6 py-4 text-right font-medium font-mono ${acc.opening >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {Math.abs(acc.opening).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {acc.opening >= 0 ? 'Cr' : 'Dr'}
                          </td>
                          <td className="px-6 py-4 text-emerald-600 text-right font-medium font-mono">
                            {acc.credit > 0 ? `₹${acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-rose-600 text-right font-medium font-mono">
                            {acc.debit > 0 ? `₹${acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className={`px-6 py-4 text-right font-black font-mono ${acc.closing >= 0 ? 'text-emerald-850' : 'text-rose-850'}`}>
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
        title="P&L / Balance Sheet"
        documentTitle={`P&L / BALANCE SHEET: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-8 pb-12">
          {/* Print Title Block */}
          <div className="text-center border-b pb-4">
            <h2 className="text-lg font-black uppercase text-slate-900">Profit &amp; Loss and Balance Sheet Accounts Summary</h2>
            <p className="text-[10px] text-slate-550 uppercase mt-1">Period: {new Date(startDate).toLocaleDateString('en-GB')} To {new Date(endDate).toLocaleDateString('en-GB')}</p>
          </div>

          {/* 1. Profit & Loss Section */}
          <div className="space-y-4">
            <div className="bg-slate-100 border-b border-slate-955 px-2 py-1 font-bold text-[11px] uppercase">
              Part I: Profit &amp; Loss Statement
            </div>
            
            <div className="grid grid-cols-2 gap-8 text-[10px]">
              {/* Income Print */}
              <div>
                <div className="border-b border-slate-900 px-1 pb-1 font-bold text-slate-700 uppercase">Incomes</div>
                <table className="w-full text-left mt-2">
                  <tbody className="font-mono">
                    {incomeHeads.length === 0 ? (
                      <tr><td colSpan={2} className="py-2 text-center text-slate-400">No Income recorded</td></tr>
                    ) : (
                      incomeHeads.map((head, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-1 uppercase text-slate-800 font-bold">{head.name}</td>
                          <td className="py-1 text-right text-slate-900 font-black">{head.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Expenses Print */}
              <div>
                <div className="border-b border-slate-900 px-1 pb-1 font-bold text-slate-700 uppercase">Expenses</div>
                <table className="w-full text-left mt-2">
                  <tbody className="font-mono">
                    {expenseHeads.length === 0 ? (
                      <tr><td colSpan={2} className="py-2 text-center text-slate-400">No Expenses recorded</td></tr>
                    ) : (
                      expenseHeads.map((head, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-1 uppercase text-slate-800 font-bold">{head.name}</td>
                          <td className="py-1 text-right text-slate-900 font-black">{head.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* P&L Print Totals */}
            <div className="grid grid-cols-4 gap-4 border border-slate-900 p-2 text-center text-[10px] font-bold uppercase bg-slate-50 font-mono">
              <div>
                <span className="block text-[8px] text-slate-550">Total Income</span>
                <span className="text-emerald-700">{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-555">Total Expenses</span>
                <span className="text-red-700">{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-550">Net Profit</span>
                <span className={totalProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}>{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-550">Share ({partnerCount})</span>
                <span className="text-slate-900">{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* 2. Balance Sheet Section */}
          <div className="space-y-4">
            <div className="bg-slate-100 border-b border-slate-955 px-2 py-1 font-bold text-[11px] uppercase">
              Part II: Balance Sheet Accounts Position
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-[10px] font-bold uppercase font-mono mb-2">
              <div className="border p-1 bg-slate-50">
                <span className="block text-[8px] text-slate-500">Opening Cash Balance</span>
                <span className="text-slate-900">{openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border p-1 bg-slate-50">
                <span className="block text-[8px] text-slate-500">Closing Cash Balance</span>
                <span className="text-slate-900">{closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Balance Sheet Print Table */}
            <div className="border border-slate-900 text-[9px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-50">
                    <th className="p-1 border-r border-slate-200">S.No</th>
                    <th className="p-1 border-r border-slate-200">Account Name</th>
                    <th className="p-1 border-r border-slate-200 text-right">Opening</th>
                    <th className="p-1 border-r border-slate-200 text-right">Credit</th>
                    <th className="p-1 border-r border-slate-200 text-right">Debit</th>
                    <th className="p-1 text-right">Closing</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {accountBalances.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-4 font-sans text-slate-400">No balances loaded</td></tr>
                  ) : (
                    accountBalances.map((acc, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="p-1 border-r border-slate-200 text-center">{idx + 1}</td>
                        <td className="p-1 text-slate-900 border-r border-slate-200 uppercase font-bold">{acc.accountName}</td>
                        <td className="p-1 text-right border-r border-slate-200">{acc.opening.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-1 text-right border-r border-slate-200">{acc.credit > 0 ? acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="p-1 text-right border-r border-slate-200">{acc.debit > 0 ? acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="p-1 text-right font-black">{acc.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default ProfitAndLoss;
