import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

const ProfitAndLoss: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [statement, setStatement] = useState({
    loansDisbursedCount: 0,
    totalDisbursedAmount: 0,
    accruedInterest: 0, // Accrual base profit
    realisedInterest: 0, // Cash base profit
    otherChargesIncome: 0,
    badDebtEstimate: 0,
    accrualNetProfit: 0,
    cashNetProfit: 0
  });

  useEffect(() => {
    fetchStatementData();
  }, [startDate, endDate]);

  const fetchStatementData = async () => {
    setLoading(true);
    try {
      const loans = await supabaseFinance.getLoans();
      const txs = await supabaseFinance.getTransactions();

      // Filter by date range
      const rangeLoans = loans.filter(l => l.date >= startDate && l.date <= endDate);
      
      let totalDisbursedAmount = 0;
      let accruedInterest = 0;

      rangeLoans.forEach(loan => {
        const principal = Number(loan.amount);
        const rate = Number(loan.interest_rate);
        const dur = Number(loan.duration_months);
        totalDisbursedAmount += principal;
        accruedInterest += principal * (rate / 100) * dur;
      });

      // Calculate Realised Interest in this range
      // For each collection transaction in this range, we find the loan's interest-to-principal ratio
      // Realised interest portion = collection amount * (interest component / total repayment component)
      const rangeTxs = txs.filter(t => t.date >= startDate && t.date <= endDate);
      let realisedInterest = 0;
      let otherChargesIncome = 0;

      rangeTxs.forEach(tx => {
        if (tx.type === 'Collection') {
          // Find the corresponding loan details
          const loan = loans.find(l => l.id === tx.loan_id);
          if (loan) {
            const P = Number(loan.amount);
            const I = P * (Number(loan.interest_rate) / 100) * Number(loan.duration_months);
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

      // Bad Debt estimate (loans that are active and overdue by 30+ days)
      const overdueLimit = new Date();
      overdueLimit.setDate(overdueLimit.getDate() - 30);
      const overdueLimitStr = overdueLimit.toISOString().split('T')[0];

      let badDebtEstimate = 0;
      // Fetch dues that are older than 30 days and unpaid
      const { data: overdueDues, error } = await supabase
        .from('finance_dues')
        .select('amount, paid_amount')
        .lt('due_date', overdueLimitStr)
        .in('status', ['Pending', 'Partially Paid']);

      if (error) {
        throw error;
      }

      if (overdueDues) {
        overdueDues.forEach((d: any) => {
          badDebtEstimate += (Number(d.amount) - Number(d.paid_amount)) * 0.1; // 10% provision for late dues
        });
      }

      setStatement({
        loansDisbursedCount: rangeLoans.length,
        totalDisbursedAmount,
        accruedInterest: parseFloat(accruedInterest.toFixed(2)),
        realisedInterest: parseFloat(realisedInterest.toFixed(2)),
        otherChargesIncome,
        badDebtEstimate: parseFloat(badDebtEstimate.toFixed(2)),
        accrualNetProfit: parseFloat((accruedInterest + otherChargesIncome - badDebtEstimate).toFixed(2)),
        cashNetProfit: parseFloat((realisedInterest + otherChargesIncome - badDebtEstimate).toFixed(2))
      });

    } catch (err) {
      console.error(err);
      toast.error('Failed to compile P&L statement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Profit & Loss Statement</h1>
          <p className="text-gray-500 text-sm mt-1">Review earned and accrued interest margins across date ranges</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print P&L
        </Button>
      </div>

      {/* Date Filters */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <Input label="From Date" type="date" value={startDate} onChange={setStartDate} />
        <Input label="To Date" type="date" value={endDate} onChange={setEndDate} />
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${showPrintPreview ? 'print:hidden' : ''}`}>
        {/* Accrual Base */}
        <Card
          title="Accrual Basis P&L"
          subtitle="Revenue recognized when loans are disbursed (recommended)"
          className="shadow-md border-t-4 border-t-emerald-500"
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="font-bold text-gray-700">Particulars</span>
                <span className="font-bold text-gray-700">Amount (₹)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-semibold">Interest Accrued on Loans ({statement.loansDisbursedCount} Loans)</span>
                <span className="font-bold text-gray-900">+ ₹{statement.accruedInterest.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-semibold">Other Charges / Penalties</span>
                <span className="font-bold text-gray-900">+ ₹{statement.otherChargesIncome.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm border-b pb-2 text-red-600">
                <span className="font-semibold">Provision for Bad Debts (Overdue Dues provision)</span>
                <span className="font-bold">- ₹{statement.badDebtEstimate.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-black pt-2 text-emerald-800 bg-emerald-50 p-3 rounded">
                <span>Net Accrued Profit:</span>
                <span>₹{statement.accrualNetProfit.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Cash Base */}
        <Card
          title="Cash Basis P&L"
          subtitle="Revenue recognized only when collections are cash received"
          className="shadow-md border-t-4 border-t-green-500"
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="font-bold text-gray-700">Particulars</span>
                <span className="font-bold text-gray-700">Amount (₹)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-semibold">Realised Interest Portion from Collections</span>
                <span className="font-bold text-gray-900">+ ₹{statement.realisedInterest.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-semibold">Other Charges / Penalties</span>
                <span className="font-bold text-gray-900">+ ₹{statement.otherChargesIncome.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm border-b pb-2 text-red-600">
                <span className="font-semibold">Provision for Bad Debts (Overdue Dues provision)</span>
                <span className="font-bold">- ₹{statement.badDebtEstimate.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-black pt-2 text-green-800 bg-green-50 p-3 rounded">
                <span>Net Cash Profit:</span>
                <span>₹{statement.cashNetProfit.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Profit & Loss Statement"
        documentTitle={`PROFIT & LOSS STATEMENT: ${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
      >
        {!loading && (
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="border border-emerald-200 rounded p-4">
              <h3 className="font-bold text-gray-900 mb-1 border-b border-emerald-200 pb-2">Accrual Basis P&L</h3>
              <p className="text-[10px] text-gray-500 mb-4">Revenue recognized when loans are disbursed (recommended)</p>
              <div className="space-y-4">
                <div className="flex justify-between border-b pb-2 text-sm">
                  <span className="font-bold text-gray-700">Particulars</span>
                  <span className="font-bold text-gray-700">Amount (₹)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Interest Accrued on Loans ({statement.loansDisbursedCount} Loans)</span>
                  <span className="font-bold text-gray-900">+ ₹{statement.accruedInterest.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Other Charges / Penalties</span>
                  <span className="font-bold text-gray-900">+ ₹{statement.otherChargesIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-2 text-red-600">
                  <span className="font-semibold">Provision for Bad Debts (Overdue Dues provision)</span>
                  <span className="font-bold">- ₹{statement.badDebtEstimate.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-lg font-black pt-2 text-emerald-800 bg-emerald-50 p-3 rounded">
                  <span>Net Accrued Profit:</span>
                  <span>₹{statement.accrualNetProfit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="border border-green-200 rounded p-4">
              <h3 className="font-bold text-gray-900 mb-1 border-b border-green-200 pb-2">Cash Basis P&L</h3>
              <p className="text-[10px] text-gray-500 mb-4">Revenue recognized only when collections are cash received</p>
              <div className="space-y-4">
                <div className="flex justify-between border-b pb-2 text-sm">
                  <span className="font-bold text-gray-700">Particulars</span>
                  <span className="font-bold text-gray-700">Amount (₹)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Realised Interest Portion from Collections</span>
                  <span className="font-bold text-gray-900">+ ₹{statement.realisedInterest.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Other Charges / Penalties</span>
                  <span className="font-bold text-gray-900">+ ₹{statement.otherChargesIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-2 text-red-600">
                  <span className="font-semibold">Provision for Bad Debts (Overdue Dues provision)</span>
                  <span className="font-bold">- ₹{statement.badDebtEstimate.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-lg font-black pt-2 text-green-800 bg-green-50 p-3 rounded">
                  <span>Net Cash Profit:</span>
                  <span>₹{statement.cashNetProfit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default ProfitAndLoss;
