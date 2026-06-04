import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface AccountBalanceItem {
  accountName: string;
  credit: number;
  debit: number;
  balance: number;
  result: 'CR' | 'DR' | 'NIL';
}

const FinalStatement: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [partnerCount, setPartnerCount] = useState(1);
  const [openingCash, setOpeningCash] = useState(0);
  const [creditTotal, setCreditTotal] = useState(0);
  const [debitTotal, setDebitTotal] = useState(0);
  const [capital, setCapital] = useState(0);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceItem[]>([]);

  useEffect(() => {
    fetchStatementData();
  }, [startDate, endDate]);

  const fetchStatementData = async () => {
    setLoading(true);
    try {
      const [cashbookEntries, capitalEntries, partners] = await Promise.all([
        supabaseFinance.getCashbookEntries(),
        supabaseFinance.getCapitalEntries(),
        supabaseFinance.getPartners()
      ]);

      setPartnerCount(partners.length || 1); // Avoid division by zero

      // 1. Calculate Opening Cash (All entries before startDate)
      let prevCredit = 0;
      let prevDebit = 0;
      
      const previousEntries = cashbookEntries.filter(c => c.entry_date < startDate);
      previousEntries.forEach(entry => {
        prevCredit += Number(entry.credit) || 0;
        prevDebit += Number(entry.debit) || 0;
      });
      setOpeningCash(prevCredit - prevDebit);

      // 2. Calculate Current Date Range Values
      const currentEntries = cashbookEntries.filter(c => c.entry_date >= startDate && c.entry_date <= endDate);
      
      let currCredit = 0;
      let currDebit = 0;
      const accountMap = new Map<string, { credit: number, debit: number }>();

      currentEntries.forEach(entry => {
        const credit = Number(entry.credit) || 0;
        const debit = Number(entry.debit) || 0;
        currCredit += credit;
        currDebit += debit;

        const head = entry.head_of_account || 'Miscellaneous';
        const existing = accountMap.get(head) || { credit: 0, debit: 0 };
        accountMap.set(head, { 
          credit: existing.credit + credit, 
          debit: existing.debit + debit 
        });
      });

      setCreditTotal(currCredit);
      setDebitTotal(currDebit);

      // Format Account Balances
      const balances: AccountBalanceItem[] = Array.from(accountMap.entries()).map(([name, data]) => {
        const balance = data.credit - data.debit;
        return {
          accountName: name,
          credit: data.credit,
          debit: data.debit,
          balance: Math.abs(balance),
          result: balance > 0 ? 'CR' : balance < 0 ? 'DR' : 'NIL'
        };
      });

      // Sort alphabetically by account name
      balances.sort((a, b) => a.accountName.localeCompare(b.accountName));
      setAccountBalances(balances);

      // 3. Calculate Capital within date range
      const currentCapitalEntries = capitalEntries.filter(c => c.entry_date >= startDate && c.entry_date <= endDate);
      let capSum = 0;
      currentCapitalEntries.forEach(entry => {
        const credit = Number(entry.credit) || 0;
        const debit = Number(entry.debit) || 0;
        capSum += (credit - debit);
      });
      setCapital(capSum);

    } catch (err) {
      console.error(err);
      toast.error('Failed to compile Final Statement');
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = creditTotal - debitTotal;
  const closingCash = openingCash + grandTotal;
  const shareValue = grandTotal / partnerCount;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-page-title">Final Statement</h1>
          <p className="finance-page-subtitle">
            Net worth snapshot with share value for each partner
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

      {/* Top Filter & Share Row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden">
        {/* Date Filters */}
        <div className="flex-1 grid grid-cols-3 divide-x divide-slate-100 border-b md:border-b-0 md:border-r border-slate-100">
          <div className="px-6 py-4 flex flex-col justify-center">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
            />
          </div>
          <div className="px-6 py-4 flex flex-col justify-center">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
            />
          </div>
          <div className="px-6 py-4 flex flex-col justify-center bg-slate-50">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Partners</label>
            <span className="text-xl font-black text-slate-900 tracking-tight">{partnerCount}</span>
          </div>
        </div>

        {/* Share Value Highlight */}
        <div className="w-full md:w-64 px-6 py-4 flex flex-col justify-center bg-[#0b1329]">
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1 block">Share Value</span>
          <span className={`text-3xl font-black tracking-tight ${shareValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Summary Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Credit Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Credit Total</span>
          <span className="text-2xl font-black text-emerald-600 tracking-tight mt-1">₹{creditTotal.toLocaleString('en-IN')}</span>
        </div>
        
        {/* Debit Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Debit Total</span>
          <span className="text-2xl font-black text-red-600 tracking-tight mt-1">₹{debitTotal.toLocaleString('en-IN')}</span>
        </div>

        {/* Opening Cash */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Opening Cash</span>
          <span className="text-2xl font-black text-slate-900 tracking-tight mt-1">₹{openingCash.toLocaleString('en-IN')}</span>
        </div>

        {/* Closing Cash */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Closing Cash</span>
          <span className="text-2xl font-black text-slate-900 tracking-tight mt-1">₹{closingCash.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Summary Cards Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Capital */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Capital</span>
          <span className={`text-2xl font-black tracking-tight mt-1 ${capital >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ₹{Math.abs(capital).toLocaleString('en-IN')} {capital < 0 ? '(DR)' : ''}
          </span>
        </div>
        
        {/* Grand Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Grand Total</span>
          <span className={`text-2xl font-black tracking-tight mt-1 ${grandTotal >= 0 ? 'text-[#0b1329]' : 'text-red-600'}`}>
            ₹{grandTotal.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Accounts Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Accounts</span>
          <span className="text-2xl font-black text-slate-900 tracking-tight mt-1">{accountBalances.length}</span>
        </div>
      </div>

      {/* Account Balances Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Table Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 relative">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Account Balances</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{accountBalances.length} Accounts</p>
          </div>
          <div className="absolute top-4 right-4 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-blue-100">
            LIVE
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex-1 flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : accountBalances.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center border border-dashed border-slate-200 rounded-xl p-12 w-full max-w-md bg-slate-50">
              <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">No Accounts</p>
              <p className="text-xs font-bold text-slate-500 uppercase">No cashbook entries found for this date range.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">S.No</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider w-1/3">Account Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Credit</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Debit</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Balance</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountBalances.map((acc, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900 uppercase">{acc.accountName}</td>
                    <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">
                      {acc.credit > 0 ? `₹${acc.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-red-600 text-right">
                      {acc.debit > 0 ? `₹${acc.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-slate-800 text-right">
                      ₹{acc.balance.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                        acc.result === 'CR' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        acc.result === 'DR' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {acc.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Final Statement"
        documentTitle={`FINAL STATEMENT: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Summary Metrics */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Opening Cash</p>
              <p className="text-sm font-black text-slate-900">₹{openingCash.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Closing Cash</p>
              <p className="text-sm font-black text-slate-900">₹{closingCash.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Grand Total</p>
              <p className="text-sm font-black text-slate-900">₹{grandTotal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Share Value ({partnerCount})</p>
              <p className="text-sm font-black text-[#0b1329]">₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 border-b border-slate-300 pb-6 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Credit Total</p>
              <p className="text-xs font-black text-emerald-700">₹{creditTotal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Debit Total</p>
              <p className="text-xs font-black text-red-700">₹{debitTotal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Capital (Net)</p>
              <p className={`text-xs font-black ${capital >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                ₹{Math.abs(capital).toLocaleString('en-IN')} {capital < 0 ? '(DR)' : '(CR)'}
              </p>
            </div>
          </div>

          {/* Account Balances Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-900">Account Balances</h4>
              <span className="text-[10px] font-bold text-slate-500">{accountBalances.length} ACCOUNTS</span>
            </div>
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">S.No</th>
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Account Name</th>
                  <th className="px-2 py-2 font-bold text-slate-800 text-right border-r border-slate-300">Credit</th>
                  <th className="px-2 py-2 font-bold text-slate-800 text-right border-r border-slate-300">Debit</th>
                  <th className="px-2 py-2 font-bold text-slate-900 text-right border-r border-slate-300">Balance</th>
                  <th className="px-2 py-2 font-bold text-slate-800 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {accountBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans font-bold uppercase">No records found</td>
                  </tr>
                ) : (
                  accountBalances.map((acc, idx) => (
                    <tr key={idx} className="border-b border-slate-200 last:border-0">
                      <td className="px-2 py-1 border-r border-slate-200 text-center">{idx + 1}</td>
                      <td className="px-2 py-1 font-bold text-slate-900 uppercase border-r border-slate-200">{acc.accountName}</td>
                      <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{acc.credit > 0 ? acc.credit.toLocaleString('en-IN') : '-'}</td>
                      <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{acc.debit > 0 ? acc.debit.toLocaleString('en-IN') : '-'}</td>
                      <td className="px-2 py-1 text-right font-bold text-slate-900 border-r border-slate-200">₹{acc.balance.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1 text-center font-bold">{acc.result}</td>
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

export default FinalStatement;
