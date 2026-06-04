import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/Finance/FinancePrintPreview';

interface BalanceItem {
  name: string;
  amount: number;
}

const FinalStatement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  
  // Liabilities
  const [partnerCapitals, setPartnerCapitals] = useState<BalanceItem[]>([]);
  const [netProfit, setNetProfit] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);

  // Assets
  const [cashInHand, setCashInHand] = useState(0);
  const [loansReceivable, setLoansReceivable] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);

  useEffect(() => {
    fetchStatementData();
  }, []);

  const fetchStatementData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Partners & Capital Entries
      const partners = await supabaseFinance.getPartners();
      const capEntries = await supabaseFinance.getCapitalEntries();
      
      const partnerBalances: Record<string, number> = {};
      let totalCapital = 0;
      capEntries.forEach(entry => {
        const amt = Number(entry.amount);
        if (!partnerBalances[entry.partner_id]) {
          partnerBalances[entry.partner_id] = 0;
        }
        if (entry.type === 'Credit') {
          partnerBalances[entry.partner_id] += amt;
          totalCapital += amt;
        } else {
          partnerBalances[entry.partner_id] -= amt;
          totalCapital -= amt;
        }
      });

      const capitalsList = partners.map(p => ({
        name: `Capital: ${p.name}`,
        amount: partnerBalances[p.id] || 0
      }));
      setPartnerCapitals(capitalsList);

      // 2. Fetch Loans & Transactions
      const loans = await supabaseFinance.getLoans();
      const txs = await supabaseFinance.getTransactions();

      let totalDisbursed = 0;
      let totalInterestAccrued = 0;
      loans.forEach(loan => {
        const P = Number(loan.amount);
        totalDisbursed += P;
        totalInterestAccrued += P * (Number(loan.interest_rate) / 100) * Number(loan.duration_months);
      });

      let totalCollected = 0;
      txs.forEach(t => {
        if (t.type === 'Collection') {
          totalCollected += Number(t.amount);
        }
      });

      // Cash in hand = Net Capital + Collections - Disbursements
      const cash = totalCapital + totalCollected - totalDisbursed;
      setCashInHand(cash);

      // Receivable = Principal + Interest - Collections
      const totalRepayable = totalDisbursed + totalInterestAccrued;
      const receivable = Math.max(0, totalRepayable - totalCollected);
      setLoansReceivable(receivable);

      // Net profit = Interest Accrued from all loans (accrual)
      setNetProfit(totalInterestAccrued);

      // Totals
      const assetsSum = cash + receivable;
      const liabilitiesSum = totalCapital + totalInterestAccrued;

      setTotalAssets(assetsSum);
      setTotalLiabilities(liabilitiesSum);

    } catch (err) {
      console.error(err);
      toast.error('Failed to generate Balance Sheet statement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Final Statement (Balance Sheet)</h1>
          <p className="text-gray-500 text-sm mt-1">Double-entry ledger statement matching capital balances to liquid cash and receivables</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print Balance Sheet
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : (
        <div className={`space-y-6 ${showPrintPreview ? 'print:hidden' : ''}`}>
          {/* Balancing Check Badge */}
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
            Math.abs(totalAssets - totalLiabilities) < 1 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              <span className="font-extrabold text-sm">
                {Math.abs(totalAssets - totalLiabilities) < 1 
                  ? 'STATEMENT BALANCED' 
                  : `UNBALANCED STATEMENT: Difference of ₹${(totalLiabilities - totalAssets).toFixed(2)}`}
              </span>
            </div>
            <span className="font-mono font-black">₹{totalAssets.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>

          {/* Double entry columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
            {/* Liabilities */}
            <Card title="Liabilities & Capital" subtitle="Source of business funds">
              <div className="space-y-3">
                <div className="flex justify-between font-bold border-b pb-2 text-xs text-gray-400 uppercase">
                  <span>Particulars</span>
                  <span>Credit Balance (₹)</span>
                </div>
                
                {/* Partners capital */}
                {partnerCapitals.map((cap, idx) => (
                  <div key={idx} className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">{cap.name}</span>
                    <span className="text-gray-900">₹{cap.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}

                {/* Net earnings */}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span className="text-gray-700">Retained Earnings (Interest Accrued)</span>
                  <span className="text-gray-900">₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-base font-black pt-4 border-t-2 border-gray-800 text-gray-900 bg-gray-50 p-2 rounded mt-6">
                  <span>TOTAL LIABILITIES:</span>
                  <span>₹{totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </Card>

            {/* Assets */}
            <Card title="Assets & Receivables" subtitle="Application of business funds">
              <div className="space-y-3">
                <div className="flex justify-between font-bold border-b pb-2 text-xs text-gray-400 uppercase">
                  <span>Particulars</span>
                  <span>Debit Balance (₹)</span>
                </div>

                {/* Cash in Hand */}
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">Liquid Cash in Hand</span>
                  <span className="text-gray-900 font-extrabold">₹{cashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Outstanding Loans */}
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Outstanding Loan Receivables</span>
                  <span className="text-gray-900 font-bold">₹{loansReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-base font-black pt-4 border-t-2 border-gray-800 text-gray-900 bg-gray-50 p-2 rounded mt-6">
                  <span>TOTAL ASSETS:</span>
                  <span>₹{totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Final Statement (Balance Sheet)"
        documentTitle={`BALANCE SHEET STATEMENT`}
      >
        <div className="space-y-6">
          <div className={`p-4 rounded border flex items-center justify-between shadow-sm ${
            Math.abs(totalAssets - totalLiabilities) < 1 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              <span className="font-extrabold text-sm">
                {Math.abs(totalAssets - totalLiabilities) < 1 
                  ? 'STATEMENT BALANCED' 
                  : `UNBALANCED STATEMENT: Difference of ₹${(totalLiabilities - totalAssets).toFixed(2)}`}
              </span>
            </div>
            <span className="font-mono font-black">₹{totalAssets.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded p-4">
              <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Liabilities & Capital</h3>
              <div className="space-y-3">
                <div className="flex justify-between font-bold border-b pb-2 text-xs text-gray-400 uppercase">
                  <span>Particulars</span>
                  <span>Credit Balance (₹)</span>
                </div>
                {partnerCapitals.map((cap, idx) => (
                  <div key={idx} className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">{cap.name}</span>
                    <span className="text-gray-900">₹{cap.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span className="text-gray-700">Retained Earnings (Interest Accrued)</span>
                  <span className="text-gray-900">₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-4 border-t-2 border-gray-800 text-gray-900 bg-gray-50 p-2 rounded mt-6">
                  <span>TOTAL LIABILITIES:</span>
                  <span>₹{totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded p-4">
              <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Assets & Receivables</h3>
              <div className="space-y-3">
                <div className="flex justify-between font-bold border-b pb-2 text-xs text-gray-400 uppercase">
                  <span>Particulars</span>
                  <span>Debit Balance (₹)</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Liquid Cash in Hand</span>
                  <span className="text-gray-900 font-extrabold">₹{cashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Outstanding Loan Receivables</span>
                  <span className="text-gray-900 font-bold">₹{loansReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-4 border-t-2 border-gray-800 text-gray-900 bg-gray-50 p-2 rounded mt-6">
                  <span>TOTAL ASSETS:</span>
                  <span>₹{totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default FinalStatement;
