import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, ArrowLeft, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';
import { exportToExcel } from '../../utils/excel';

interface BSAccountBalanceItem {
  accountName: string;
  opening: number;
  credit: number;
  debit: number;
  closing: number;
}

const FinalStatement: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [partnerCount, setPartnerCount] = useState(1);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [creditTotal, setCreditTotal] = useState(0);
  const [debitTotal, setDebitTotal] = useState(0);
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

      let prevTxs: DailyFinancialTransaction[] = [];
      if (startDate > '1970-01-01') {
        prevTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: '1970-01-01',
          toDate: prevDateLimitStr,
          financeMode
       });
     }

      // 2. Fetch date range entries
      const rangeTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: startDate,
        toDate: endDate,
        financeMode
     });

      const partners = await supabaseFinance.getPartners();
      setPartnerCount(partners.length || 1);

      // Compute cash balances (net system flows)
      let prevCash = 0;
      prevTxs.forEach(t => {
        prevCash += (t.credit - t.debit);
     });
      setOpeningCash(prevCash);

      let currCredit = 0;
      let currDebit = 0;
      rangeTxs.forEach(t => {
        currCredit += t.credit;
        currDebit += t.debit;
     });
      setCreditTotal(currCredit);
      setDebitTotal(currDebit);
      setClosingCash(prevCash + currCredit - currDebit);

      // 3. Compute balance sheet account balances
      const bsHeads = new Set<string>();
      prevTxs.forEach(t => {
        if (t.reportClassification === 'BALANCE_SHEET') bsHeads.add(t.headOfAccount);
     });
      rangeTxs.forEach(t => {
        if (t.reportClassification === 'BALANCE_SHEET') bsHeads.add(t.headOfAccount);
     });

      const balances: BSAccountBalanceItem[] = Array.from(bsHeads).map(head => {
        let op = 0;
        prevTxs.filter(t => t.headOfAccount === head).forEach(t => {
          op += (t.credit - t.debit);
       });

        let cr = 0;
        let dr = 0;
        rangeTxs.filter(t => t.headOfAccount === head).forEach(t => {
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
      toast.error('Failed to compile Final Statement');
   } finally {
      setLoading(false);
   }
 };

  const navigateToDetailedLedger = (head: string) => {
    navigate(`/finance/detailed-ledger?head=${encodeURIComponent(head)}&from=${startDate}&to=${endDate}`);
  };

  const handleExportExcel = () => {
    const data = [
      { 'Opening Cash': openingCash, 'Closing Cash': closingCash, 'Credit Total': creditTotal, 'Debit Total': debitTotal, 'Net Growth': grandTotal, 'Share Value': shareValue },
      ...accountBalances.map(item => ({
        'Account Name': item.accountName,
        'Opening Balance': item.opening,
        'Credit': item.credit,
        'Debit': item.debit,
        'Closing Balance': item.closing
      }))
    ];
    exportToExcel(data, `Final_Statement_${startDate}_to_${endDate}`);
    toast.success('Excel Statement Exported!');
  };

  const grandTotal = creditTotal - debitTotal;
  const shareValue = grandTotal / partnerCount;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6 print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm`}>
        <div>
          <h1 className="finance-h1">Final Statement</h1>
          <p className="finance-small-label uppercase">
            Net worth snapshot with share value for each partner
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

      {/* Top Filter & Share Row */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden`}>
        {/* Date Filters */}
        <div className="flex-1 grid grid-cols-3 divide-x divide-slate-100 border-b md:border-b-0 md:border-r border-slate-100">
          <div className="px-6 py-4 flex flex-col justify-center">
            <label className="text-slate-400 mb-1 finance-small-label uppercase">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
            />
          </div>
          <div className="px-6 py-4 flex flex-col justify-center">
            <label className="text-slate-400 mb-1 finance-small-label uppercase">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
            />
          </div>
          <div className="px-6 py-4 flex flex-col justify-center bg-slate-50">
            <label className="text-slate-400 mb-1 finance-small-label uppercase">Partners</label>
            <span className="text-slate-900 finance-h1">{partnerCount}</span>
          </div>
        </div>

        {/* Share Value Highlight */}
        <div className="w-full md:w-64 px-6 py-4 flex flex-col justify-center bg-[#0b1329]">
          <span className="text-blue-300 mb-1 block finance-small-label uppercase">Share Value</span>
          <span className={`${shareValue >= 0 ? 'text-emerald-400' : 'text-red-400'} finance-money`}>
            {shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Summary Cards Row 1 */}
      <div className={`grid grid-cols-1 sm:grid-cols-4 gap-4`}>
        {/* Credit Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Credit Total</span>
          <span className="text-emerald-600 mt-1 finance-money">{creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        
        {/* Debit Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Debit Total</span>
          <span className="text-red-600 mt-1 finance-money">{debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Opening Cash */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Opening Cash</span>
          <span className="text-slate-900 mt-1 finance-money">{openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Closing Cash */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Closing Cash</span>
          <span className="text-slate-900 mt-1 finance-money">{closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Account Balances Table */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]`}>
        {/* Table Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 relative">
          <div>
            <h2 className="text-slate-900 finance-brand">Balance Sheet Accounts</h2>
            <p className="text-slate-500 mt-1 finance-small-label uppercase">{accountBalances.length} Accounts</p>
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
              <p className="text-slate-900 mb-2 finance-sidebar-link uppercase">No Accounts</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[600px] finance-caption">
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

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Final Statement"
        documentTitle={`FINAL STATEMENT: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Summary Metrics */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center text-[11px]">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Opening Cash</p>
              <p className="text-slate-900 finance-sidebar-link font-bold">{openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-550 text-[10px] mt-0.5 uppercase">Closing Cash</p>
              <p className="text-slate-900 finance-sidebar-link font-bold">{closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Grand Total</p>
              <p className="text-slate-900 finance-sidebar-link font-bold">{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-550 text-[10px] mt-0.5 uppercase">Share Value ({partnerCount})</p>
              <p className="text-[#0b1329] finance-sidebar-link font-bold">{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          {/* Account Balances Print Table */}
          <div className="border border-slate-900 text-[10px]">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-slate-900 finance-small-label uppercase font-black">Balance Sheet Accounts Position</h4>
              <span className="text-slate-500 finance-small-label">{accountBalances.length} ACCOUNTS</span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="p-2 border-r border-slate-300 text-slate-800">S.No</th>
                  <th className="p-2 border-r border-slate-300 text-slate-800">Account Name</th>
                  <th className="p-2 border-r border-slate-300 text-slate-800 text-right">Opening</th>
                  <th className="p-2 border-r border-slate-300 text-slate-800 text-right">Credit</th>
                  <th className="p-2 border-r border-slate-300 text-slate-850 text-right">Debit</th>
                  <th className="p-2 text-right text-slate-900">Closing</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {accountBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-550 font-sans finance-input uppercase">No records found</td>
                  </tr>
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
      </FinancePrintPreview>
    </div>
  );
};

export default FinalStatement;
