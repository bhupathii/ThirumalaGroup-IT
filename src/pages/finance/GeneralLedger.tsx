import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface LedgerEntry {
  id: string;
  date: string;
  time: string;
  accountType: string;
  accountName: string;
  particulars: string;
  credit: number;
  debit: number;
  voucherNo: string;
  user: string;
}

const GeneralLedger: React.FC = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [cashbookAccounts, setCashbookAccounts] = useState<string[]>([]);
  
  const [selectedAccountType, setSelectedAccountType] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const accountTypes = ['Loan Operations', 'Partner Capital', 'Cashbook'];

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const [txs, capitals, cbEntries, cbAccounts] = await Promise.all([
        supabaseFinance.getTransactions(),
        supabaseFinance.getCapitalEntries(),
        supabaseFinance.getCashbookEntries(),
        supabaseFinance.getCashbookAccounts()
      ]);

      const entries: LedgerEntry[] = [];

      // 1. Loans
      txs.forEach(tx => {
        const isCol = tx.type === 'Collection';
        const amt = Number(tx.amount) || 0;
        entries.push({
          id: tx.id,
          date: tx.date,
          time: tx.created_at,
          accountType: 'Loan Operations',
          accountName: isCol ? 'Loan Collections' : 'Loan Disbursements',
          particulars: `${tx.loan?.customer?.name || 'Customer'} (${tx.loan?.loan_id || 'N/A'}) - ${tx.remarks || 'No remarks'}`,
          credit: isCol ? amt : 0,
          debit: !isCol ? amt : 0,
          voucherNo: tx.id.slice(0, 8).toUpperCase(),
          user: (tx as any).staff_name || 'Admin'
        });
      });

      // 2. Capital
      capitals.forEach(cap => {
        const cred = Number(cap.credit) || 0;
        const deb = Number(cap.debit) || 0;
        entries.push({
          id: cap.id,
          date: cap.entry_date,
          time: cap.created_at,
          accountType: 'Partner Capital',
          accountName: cred > 0 ? 'Capital Deposits' : 'Capital Withdrawals',
          particulars: `${cap.partner?.name || cap.partner_name || 'Partner'} - ${cap.particulars || 'No remarks'}`,
          credit: cred,
          debit: deb,
          voucherNo: cap.id.slice(0, 8).toUpperCase(),
          user: cap.created_by || 'Admin'
        });
      });

      // 3. Cashbook
      const cbAccMap = new Map(cbAccounts.map(a => [a.id, a.account_name]));
      setCashbookAccounts(cbAccounts.map(a => a.account_name));

      cbEntries.forEach(cb => {
        entries.push({
          id: cb.id,
          date: cb.entry_date,
          time: cb.created_at,
          accountType: 'Cashbook',
          accountName: cbAccMap.get(cb.head_of_account) || 'General Cashbook',
          particulars: cb.particulars || '-',
          credit: Number(cb.credit) || 0,
          debit: Number(cb.debit) || 0,
          voucherNo: cb.id.slice(0, 8).toUpperCase(),
          user: cb.created_by || 'Admin'
        });
      });

      setAllEntries(entries);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const accountsForSelectedType = useMemo(() => {
    if (!selectedAccountType) return [];
    if (selectedAccountType === 'Loan Operations') return ['Loan Collections', 'Loan Disbursements'];
    if (selectedAccountType === 'Partner Capital') return ['Capital Deposits', 'Capital Withdrawals'];
    if (selectedAccountType === 'Cashbook') return cashbookAccounts;
    return [];
  }, [selectedAccountType, cashbookAccounts]);

  const { displayedTransactions, openingBalance, totalCredits, totalDebits, closingBalance } = useMemo(() => {
    if (!selectedAccount || !startDate || !endDate) {
      return { displayedTransactions: [], openingBalance: 0, totalCredits: 0, totalDebits: 0, closingBalance: 0 };
    }

    let opBal = 0;
    let periodCred = 0;
    let periodDeb = 0;
    const currentTxs: (LedgerEntry & { runningBalance: number })[] = [];

    // Filter to selected account
    const accountEntries = allEntries.filter(e => e.accountName === selectedAccount);

    // Calculate opening balance
    accountEntries.forEach(e => {
      if (e.date < startDate) {
        opBal += e.credit;
        opBal -= e.debit;
      }
    });

    // Get period entries
    const periodEntries = accountEntries.filter(e => e.date >= startDate && e.date <= endDate);
    periodEntries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let runBal = opBal;
    periodEntries.forEach(e => {
      periodCred += e.credit;
      periodDeb += e.debit;
      runBal += e.credit;
      runBal -= e.debit;
      currentTxs.push({ ...e, runningBalance: runBal });
    });

    return {
      displayedTransactions: currentTxs,
      openingBalance: opBal,
      totalCredits: periodCred,
      totalDebits: periodDeb,
      closingBalance: runBal
    };
  }, [allEntries, selectedAccount, startDate, endDate]);

  const handleAccountTypeClick = (type: string) => {
    setSelectedAccountType(type);
    setSelectedAccount(null); // Reset child selection
  };

  const handleAccountClick = (acc: string) => {
    setSelectedAccount(acc);
  };

  const displayDateRange = `${new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-')} TO ${new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-')}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-page-title">General Ledger</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Drill from Account Types &rarr; Accounts &rarr; Transaction Detail</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider text-xs">
            Back
          </Button>
          <Button onClick={fetchLedgerData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider text-xs">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-xs">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-sm font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
          />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-sm font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
          />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Credits</span>
          <span className="text-2xl font-black text-emerald-600 tracking-tight">₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Debits</span>
          <span className="text-2xl font-black text-red-600 tracking-tight">₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Middle Row: Account Types & Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Account Types */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Account Types</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{accountTypes.length} GROUPS</p>
            </div>
            <span className="bg-[#e0f2fe] text-[#0369a1] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-[#bae6fd]">LIVE</span>
          </div>
          <div className="p-2 flex-1">
            {accountTypes.length === 0 ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-8">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">No Account Types</span>
              </div>
            ) : (
              <div className="space-y-1">
                {accountTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => handleAccountTypeClick(type)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all border ${
                      selectedAccountType === type 
                        ? 'bg-[#0b1329] text-white border-[#0b1329] shadow-md' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accounts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[300px] md:h-auto">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Accounts</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Select an account type</p>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            {!selectedAccountType ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-8 mx-2 mt-2 mb-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Pick an account type</span>
              </div>
            ) : accountsForSelectedType.length === 0 ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-8 mx-2 mt-2 mb-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">No accounts found</span>
              </div>
            ) : (
              <div className="space-y-1">
                {accountsForSelectedType.map(acc => (
                  <button
                    key={acc}
                    onClick={() => handleAccountClick(acc)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all border ${
                      selectedAccount === acc
                        ? 'bg-[#0b1329] text-white border-[#0b1329] shadow-md' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {acc}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Row: Transaction Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Transaction Details</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              {selectedAccount ? `${selectedAccount} · ${displayDateRange}` : 'Select an account'}
            </p>
          </div>
          {selectedAccount && (
            <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider border border-slate-200">
              {displayedTransactions.length} ROWS
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : !selectedAccount ? (
          <div className="py-24 text-center border-t border-dashed border-slate-200 mx-4 my-4 rounded-xl">
            <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Pick an account to drill down</span>
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="py-24 text-center border-t border-dashed border-slate-200 mx-4 my-4 rounded-xl">
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Transactions Found</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Try adjusting the date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Particulars</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Voucher / Ref</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Credit</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Debit</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Balance</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/50">
                  <td colSpan={5} className="px-4 py-2 text-xs font-black text-slate-700 uppercase text-right">Opening Balance</td>
                  <td className="px-4 py-2 text-xs font-black text-slate-900 text-right">₹{openingBalance.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 max-w-[250px] truncate" title={tx.particulars}>{tx.particulars}</td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-slate-400">{tx.voucherNo}</td>
                    <td className="px-4 py-3 text-xs font-black text-emerald-600 text-right">{tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-4 py-3 text-xs font-black text-red-600 text-right">{tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-800 text-right">₹{tx.runningBalance.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-500">{tx.user}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={3} className="px-4 py-3 text-xs font-black text-slate-700 uppercase text-right">Closing Balance</td>
                  <td className="px-4 py-3 text-xs font-black text-emerald-600 text-right">₹{totalCredits.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs font-black text-red-600 text-right">₹{totalDebits.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-900 text-right">₹{closingBalance.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="General Ledger Report"
        documentTitle={`GENERAL LEDGER: ${selectedAccount ? selectedAccount.toUpperCase() : 'NO ACCOUNT SELECTED'}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Headers */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-900 pb-4 mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Date Range</p>
              <p className="text-sm font-black text-slate-900">{displayDateRange}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Account Details</p>
              <p className="text-sm font-black text-slate-900">{selectedAccountType ? selectedAccountType.toUpperCase() : 'N/A'} &rarr; {selectedAccount ? selectedAccount.toUpperCase() : 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Opening Balance</p>
              <p className="text-sm font-black text-slate-900">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Credits</p>
              <p className="text-sm font-black text-emerald-700">₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Debits</p>
              <p className="text-sm font-black text-red-700">₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Closing Balance</p>
              <p className="text-sm font-black text-slate-900">₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Transactions Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-900">Transactions Ledger</h4>
              <span className="text-[10px] font-bold text-slate-500">{displayedTransactions.length} ROWS</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Date</th>
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Particulars</th>
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Voucher</th>
                  <th className="px-2 py-2 font-bold text-emerald-800 text-right border-r border-slate-300">Credit</th>
                  <th className="px-2 py-2 font-bold text-red-800 text-right border-r border-slate-300">Debit</th>
                  <th className="px-2 py-2 font-bold text-slate-800 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[10px]">
                {!selectedAccount ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans font-bold uppercase">No account selected for print</td>
                  </tr>
                ) : displayedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans font-bold uppercase">No transactions in this period</td>
                  </tr>
                ) : (
                  <>
                    <tr className="border-b border-slate-300 bg-slate-50/50">
                      <td colSpan={5} className="px-2 py-2 font-black text-slate-700 uppercase text-right border-r border-slate-300">Opening Balance</td>
                      <td className="px-2 py-2 font-black text-slate-900 text-right">₹{openingBalance.toLocaleString('en-IN')}</td>
                    </tr>
                    {displayedTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-200 last:border-0">
                        <td className="px-2 py-1 border-r border-slate-200 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                        <td className="px-2 py-1 text-slate-700 truncate max-w-[200px] border-r border-slate-200">{tx.particulars}</td>
                        <td className="px-2 py-1 text-slate-500 border-r border-slate-200">{tx.voucherNo}</td>
                        <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tx.credit > 0 ? tx.credit.toLocaleString('en-IN') : ''}</td>
                        <td className="px-2 py-1 text-right text-red-700 border-r border-slate-200">{tx.debit > 0 ? tx.debit.toLocaleString('en-IN') : ''}</td>
                        <td className="px-2 py-1 text-right font-bold text-slate-900">₹{tx.runningBalance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-900 bg-slate-50">
                      <td colSpan={3} className="px-2 py-2 font-black text-slate-900 uppercase text-right border-r border-slate-300">Closing Balance</td>
                      <td className="px-2 py-2 text-right font-black text-emerald-700 border-r border-slate-300">₹{totalCredits.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-right font-black text-red-700 border-r border-slate-300">₹{totalDebits.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-right font-black text-slate-900 text-sm">₹{closingBalance.toLocaleString('en-IN')}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default GeneralLedger;
