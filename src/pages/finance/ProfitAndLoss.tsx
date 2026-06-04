import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, RefreshCw, Printer } from 'lucide-react';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface HeadItem {
  name: string;
  amount: number;
}

const ProfitAndLoss: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [incomeHeads, setIncomeHeads] = useState<HeadItem[]>([]);
  const [expenseHeads, setExpenseHeads] = useState<HeadItem[]>([]);
  const [partnerCount, setPartnerCount] = useState(1);

  useEffect(() => {
    fetchStatementData();
  }, [startDate, endDate]);

  const fetchStatementData = async () => {
    setLoading(true);
    try {
      const [loans, txs, cashbookEntries, partners, ledgerSettings] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions(),
        supabaseFinance.getCashbookEntries(),
        supabaseFinance.getPartners(),
        financeLedgerSettingsService.getAllLedgerSettings()
      ]);

      setPartnerCount(partners.length || 1); // Avoid division by zero

      // 1. Transactions Logic (Interest & Other Charges)
      const rangeTxs = txs.filter(t => t.date >= startDate && t.date <= endDate);
      let realisedInterest = 0;
      let otherChargesIncome = 0;

      rangeTxs.forEach(tx => {
        if (tx.type === 'Collection') {
          const loan = loans.find(l => l.id === tx.loan_id);
          if (loan) {
            const P = Number(loan.amount);
            const cat = loan.loan_category?.trim().toUpperCase() || 'CD';
            const setting = ledgerSettings[cat] || ledgerSettings['CD'];
            const I = setting ? financeCalculationService.calculateInterestFromSetting(P, Number(loan.duration_months) * 30, setting, Number(loan.duration_months)) : (P * (Number(loan.interest_rate) / 100) * Number(loan.duration_months));
            const totalRepayable = P + I;
            if (totalRepayable > 0) {
              const interestRatio = I / totalRepayable;
              realisedInterest += Number(tx.amount) * interestRatio;
            }
          }
        } else if (tx.type === 'Interest Charge' || tx.type === 'Other') {
          otherChargesIncome += Number(tx.amount);
        }
      });

      // 2. Bad Debt Estimate
      const overdueLimit = new Date();
      overdueLimit.setDate(overdueLimit.getDate() - 30);
      const overdueLimitStr = overdueLimit.toISOString().split('T')[0];

      let badDebtEstimate = 0;
      const { data: overdueDues } = await supabase
        .from('finance_dues')
        .select('amount, paid_amount')
        .lt('due_date', overdueLimitStr)
        .in('status', ['Pending', 'Partially Paid']);

      if (overdueDues) {
        overdueDues.forEach((d: any) => {
          badDebtEstimate += (Number(d.amount) - Number(d.paid_amount)) * 0.1; // 10% provision
        });
      }

      // 3. Cashbook Logic
      const rangeCashbook = cashbookEntries.filter(c => c.entry_date >= startDate && c.entry_date <= endDate);
      
      const incomeMap = new Map<string, number>();
      const expenseMap = new Map<string, number>();

      if (realisedInterest > 0) incomeMap.set('Realised Interest', realisedInterest);
      if (otherChargesIncome > 0) incomeMap.set('Other Charges', otherChargesIncome);
      if (badDebtEstimate > 0) expenseMap.set('Bad Debt Provision', badDebtEstimate);

      rangeCashbook.forEach(entry => {
        const credit = Number(entry.credit);
        const debit = Number(entry.debit);
        const head = entry.head_of_account || 'Miscellaneous';

        if (credit > 0) {
          incomeMap.set(head, (incomeMap.get(head) || 0) + credit);
        }
        if (debit > 0) {
          expenseMap.set(head, (expenseMap.get(head) || 0) + debit);
        }
      });

      // Format arrays
      const finalIncomes = Array.from(incomeMap.entries()).map(([name, amount]) => ({ name, amount: parseFloat(amount.toFixed(2)) }));
      const finalExpenses = Array.from(expenseMap.entries()).map(([name, amount]) => ({ name, amount: parseFloat(amount.toFixed(2)) }));

      // Sort by amount descending
      finalIncomes.sort((a, b) => b.amount - a.amount);
      finalExpenses.sort((a, b) => b.amount - a.amount);

      setIncomeHeads(finalIncomes);
      setExpenseHeads(finalExpenses);

    } catch (err) {
      console.error(err);
      toast.error('Failed to compile P&L statement');
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = useMemo(() => incomeHeads.reduce((sum, item) => sum + item.amount, 0), [incomeHeads]);
  const totalExpenses = useMemo(() => expenseHeads.reduce((sum, item) => sum + item.amount, 0), [expenseHeads]);
  const totalProfit = totalIncome - totalExpenses;
  const shareValue = totalProfit / partnerCount;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Profit & Loss</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
            Income vs Expenses over a date range, with per-partner share
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider text-xs">
            Back
          </Button>
          <Button onClick={fetchStatementData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider text-xs">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-xs">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter & Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Date Filters Card */}
        <div className="sm:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-center">
          <div className="grid grid-cols-2 divide-x divide-slate-100 h-full">
            <div className="px-4 py-3 flex flex-col justify-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
              />
            </div>
            <div className="px-4 py-3 flex flex-col justify-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
              />
            </div>
          </div>
        </div>

        {/* Period Profit Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Period Profit</span>
          <span className="text-3xl font-black text-slate-900 tracking-tight mt-1">₹{totalProfit.toLocaleString('en-IN')}</span>
        </div>

        {/* Per Partner Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Per-Partner</span>
          <span className="text-3xl font-black text-slate-900 tracking-tight mt-1">₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Main Middle Section: Incomes and Expenses */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Incomes Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Incomes</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{incomeHeads.length} Heads</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              {incomeHeads.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center border border-dashed border-slate-200 rounded-xl p-12 w-full max-w-sm bg-slate-50">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">No Income</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    {incomeHeads.map((head, idx) => (
                      <tr key={idx} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 uppercase">{head.name}</td>
                        <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">₹{head.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Expenses Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Expenses</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{expenseHeads.length} Heads</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              {expenseHeads.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center border border-dashed border-slate-200 rounded-xl p-12 w-full max-w-sm bg-slate-50">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">No Expenses</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    {expenseHeads.map((head, idx) => (
                      <tr key={idx} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 uppercase">{head.name}</td>
                        <td className="px-4 py-3 text-sm font-black text-red-600 text-right">₹{head.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Bottom Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Income</span>
          <span className="text-2xl font-black text-emerald-600 tracking-tight mt-1">₹{totalIncome.toLocaleString('en-IN')}</span>
        </div>
        
        {/* Total Expenses */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Expenses</span>
          <span className="text-2xl font-black text-red-600 tracking-tight mt-1">₹{totalExpenses.toLocaleString('en-IN')}</span>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Profit</span>
          <span className="text-2xl font-black text-[#0b1329] tracking-tight mt-1">₹{totalProfit.toLocaleString('en-IN')}</span>
        </div>

        {/* Share Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Share Value</span>
          <span className="text-2xl font-black text-[#0b1329] tracking-tight mt-1">₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Profit & Loss"
        documentTitle={`P&L: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Summary */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">From Date</p>
              <p className="text-sm font-black text-slate-900">{new Date(startDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">To Date</p>
              <p className="text-sm font-black text-slate-900">{new Date(endDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Period Profit</p>
              <p className="text-sm font-black text-slate-900">₹{totalProfit.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Share ({partnerCount})</p>
              <p className="text-sm font-black text-slate-900">₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Income Print */}
            <div>
              <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 mb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-900">Incomes</h4>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="font-mono">
                  {incomeHeads.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center py-4 text-slate-500 font-sans font-bold uppercase">No Incomes</td>
                    </tr>
                  ) : (
                    incomeHeads.map((head, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="py-1 uppercase text-slate-800">{head.name}</td>
                        <td className="py-1 text-right text-slate-900 font-bold">{head.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Expenses Print */}
            <div>
              <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 mb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-900">Expenses</h4>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="font-mono">
                  {expenseHeads.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center py-4 text-slate-500 font-sans font-bold uppercase">No Expenses</td>
                    </tr>
                  ) : (
                    expenseHeads.map((head, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="py-1 uppercase text-slate-800">{head.name}</td>
                        <td className="py-1 text-right text-slate-900 font-bold">{head.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Totals Print */}
          <div className="grid grid-cols-4 gap-4 pt-6 border-t border-slate-900 mt-6">
            <div className="text-center bg-slate-50 p-2 border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Income</span>
              <span className="text-sm font-black text-slate-900">₹{totalIncome.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-center bg-slate-50 p-2 border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Expenses</span>
              <span className="text-sm font-black text-slate-900">₹{totalExpenses.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-center bg-slate-100 p-2 border border-slate-900">
              <span className="text-[9px] font-bold text-slate-600 uppercase block">Total Profit</span>
              <span className="text-sm font-black text-slate-900">₹{totalProfit.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-center bg-slate-100 p-2 border border-slate-900">
              <span className="text-[9px] font-bold text-slate-600 uppercase block">Share Value</span>
              <span className="text-sm font-black text-slate-900">₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default ProfitAndLoss;
