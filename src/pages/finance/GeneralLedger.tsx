import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';
import { dailyFinancialTransactionService, DailyFinancialTransaction } from '../../services/dailyFinancialTransactionService';
import { Printer, RefreshCw, ArrowLeft, ChevronRight, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

const GeneralLedger: React.FC = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<DailyFinancialTransaction[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedHead, setSelectedHead] = useState<string | null>(null);
  const [drillSearchQuery, setDrillSearchQuery] = useState('');

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
          d.setDate(1);
          setStartDate(d.toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error(err);
        const d = new Date();
        d.setDate(1);
        setStartDate(d.toISOString().split('T')[0]);
      }
    };
    loadDefaultStartDate();
  }, []);

  useEffect(() => {
    if (startDate) {
      fetchLedgerData();
    }
  }, [startDate, endDate]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const data = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: startDate,
        toDate: endDate,
        financeMode
      });
      setAllEntries(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };

  // Group and summarize by normalized Head of Account
  const summaryData = useMemo(() => {
    const map: Record<string, { debit: number; credit: number; count: number; classification: string }> = {};

    allEntries.forEach(entry => {
      const head = entry.headOfAccount || 'UNCLASSIFIED';
      if (!map[head]) {
        map[head] = { debit: 0, credit: 0, count: 0, classification: entry.reportClassification };
      }
      map[head].debit += entry.debit || 0;
      map[head].credit += entry.credit || 0;
      map[head].count += 1;
    });

    return Object.entries(map).map(([head, data]) => {
      const balance = data.credit - data.debit;
      return {
        head,
        debit: data.debit,
        credit: data.credit,
        balance,
        count: data.count,
        classification: data.classification
      };
    }).sort((a, b) => a.head.localeCompare(b.head));
  }, [allEntries]);

  // Totals for the entire general ledger
  const overallTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    summaryData.forEach(s => {
      debit += s.debit;
      credit += s.credit;
    });
    return { debit, credit, balance: credit - debit };
  }, [summaryData]);

  // Filter entries for drill-down view modal
  const drillDownEntries = useMemo(() => {
    if (!selectedHead) return [];
    let list = allEntries.filter(e => e.headOfAccount === selectedHead);

    if (drillSearchQuery.trim()) {
      const q = drillSearchQuery.toLowerCase().trim();
      list = list.filter(e => 
        (e.particulars && e.particulars.toLowerCase().includes(q)) ||
        (e.accountOrLoanNo && e.accountOrLoanNo.toLowerCase().includes(q)) ||
        (e.customerName && e.customerName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      if (a.transactionDate !== b.transactionDate) {
        return a.transactionDate.localeCompare(b.transactionDate);
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }, [allEntries, selectedHead, drillSearchQuery]);

  // Compute live drill-down summary
  const drillTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    drillDownEntries.forEach(e => {
      debit += e.debit || 0;
      credit += e.credit || 0;
    });
    return { debit, credit, balance: credit - debit };
  }, [drillDownEntries]);

  const displayDateRange = `${new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-')} TO ${new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-')}`;

  return (
    <div className="space-y-3 w-full select-none text-slate-800 p-2 font-outfit">
      
      {/* Header */}
      <div className={`flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="text-[24px] font-bold uppercase tracking-tight text-slate-900 leading-none">General Ledger</h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase mt-1">Summary of accounts with absolute drill-down capabilities</p>
        </div>
        <div className="flex gap-1.5 items-center">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-bold text-xs h-[48px] px-3 uppercase">
            Back
          </Button>
          <Button onClick={fetchLedgerData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-bold text-xs h-[48px] px-3 uppercase">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white font-bold text-xs h-[48px] px-4 uppercase">
            Print Summary
          </Button>
        </div>
      </div>

      {/* Date Filters in One Row */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">FROM DATE</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] focus:outline-none h-[48px] font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[15px] font-bold text-slate-500 uppercase block">TO DATE</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] focus:outline-none h-[48px] font-bold"
          />
        </div>
      </div>

      {/* Summary Table */}
      <div className={showPrintPreview ? 'print:hidden' : ''}>
        <Card
          title={
            <div className="flex justify-between items-center w-full">
              <span className="text-[17px] font-bold uppercase">Accounts Summary</span>
              <span className="font-mono text-slate-500 text-sm font-bold uppercase">
                {displayDateRange}
              </span>
            </div>
          }
          subtitle="Click any row to drill down into transaction details"
          className="shadow-sm border-slate-200 rounded overflow-hidden"
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-200 rounded max-h-[550px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-[16px] divide-y divide-slate-200 table-fixed">
                  <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700">
                    <tr className="divide-x divide-slate-200">
                      <th className="px-3 py-2 text-left font-bold text-[15px] uppercase">Head of Account</th>
                      <th className="w-48 px-3 py-2 text-right font-bold text-[15px] uppercase">Credit (Cr)</th>
                      <th className="w-48 px-3 py-2 text-right font-bold text-[15px] uppercase">Debit (Dr)</th>
                      <th className="w-48 px-3 py-2 text-right font-bold text-[15px] uppercase">Balance</th>
                      <th className="w-20 px-2 py-2 text-center font-bold text-[15px] uppercase">Drill</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 divide-x divide-slate-55 font-semibold text-slate-800">
                    {summaryData.map(s => (
                      <tr 
                        key={s.head} 
                        onClick={() => setSelectedHead(s.head)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        style={{ height: '38px' }}
                      >
                        <td className="px-3 py-1.5 text-slate-900 font-bold uppercase truncate">{s.head}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-700 font-bold font-mono whitespace-nowrap">
                          {s.credit > 0 ? `${s.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-red-700 font-bold font-mono whitespace-nowrap">
                          {s.debit > 0 ? `${s.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-black font-mono whitespace-nowrap ${s.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {Math.abs(s.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {s.balance >= 0 ? 'Cr' : 'Dr'}
                        </td>
                        <td className="px-2 py-1.5 text-center text-slate-400">
                          <ChevronRight className="w-4 h-4 mx-auto" />
                        </td>
                      </tr>
                    ))}
                    {/* Overall totals */}
                    <tr className="bg-slate-50 font-black divide-x divide-slate-150 border-t-2 border-slate-200" style={{ height: '42px' }}>
                      <td className="px-3 py-2 text-slate-800 uppercase text-[15px]">Grand Total:</td>
                      <td className="px-3 py-2 text-right text-emerald-755 font-black font-mono whitespace-nowrap">
                        {overallTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right text-red-755 font-black font-mono whitespace-nowrap">
                        {overallTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-right font-black font-mono whitespace-nowrap ${overallTotals.balance >= 0 ? 'text-emerald-900' : 'text-rose-905'}`}>
                        {Math.abs(overallTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.balance >= 0 ? 'Cr' : 'Dr'}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Drill Down Modal */}
      {selectedHead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight leading-none text-slate-100">
                  Drill Down: {selectedHead}
                </h3>
                <p className="text-[12px] text-slate-350 font-semibold uppercase mt-1 leading-none">{displayDateRange}</p>
              </div>
              <button 
                onClick={() => { setSelectedHead(null); setDrillSearchQuery(''); }}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filters */}
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={drillSearchQuery}
                  onChange={(e) => setDrillSearchQuery(e.target.value)}
                  placeholder="Filter drill transactions by account or particulars..."
                  className="w-full pl-8 pr-3 bg-white border border-slate-250 rounded text-sm h-9 focus:outline-none font-bold"
                />
              </div>
              {drillSearchQuery && (
                <button
                  onClick={() => setDrillSearchQuery('')}
                  className="text-xs font-bold text-slate-500 uppercase hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
            {/* Modal Body & Table */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
              {/* Compact Ribbon for Drilldown */}
              <div className="flex gap-4 p-2 bg-slate-100 border border-slate-200 rounded text-xs font-bold uppercase items-center justify-between">
                <div>Drill Cr: <span className="text-emerald-700 font-mono">{drillTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div>Drill Dr: <span className="text-red-700 font-mono">{drillTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div>Net Balance: <span className={`${drillTotals.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'} font-mono`}>{drillTotals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Date</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Account/Loan</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Customer</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Particulars</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase">Credit (Cr)</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase">Debit (Dr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {drillDownEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold uppercase">
                          No transaction records matching filter.
                        </td>
                      </tr>
                    ) : (
                      drillDownEntries.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-1.5 font-mono text-[13px]">
                            {e.transactionDate.split('-').reverse().join('/')}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[13px] font-bold text-slate-900 uppercase">
                            {e.accountOrLoanNo || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-800 uppercase text-[13px] font-bold">
                            {e.customerName || e.accountOrLoanNo || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600 uppercase text-[13px]">
                            {e.particulars || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-600 text-[13px] font-bold">
                            {e.credit > 0 ? `${e.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-red-600 text-[13px] font-bold">
                            {e.debit > 0 ? `${e.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => { setSelectedHead(null); setDrillSearchQuery(''); }}
                className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs uppercase rounded transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="General Ledger Report"
        documentTitle={`GENERAL LEDGER SUMMARY: ${displayDateRange}`}
      >
        <div className="text-center pb-6 border-b-2 border-slate-900">
          <h2 className="finance-brand">TIRUMALA FINANCE</h2>
          <p className="mt-1 finance-header-time uppercase">GENERAL LEDGER STATEMENT OF ACCOUNT SUMMARY</p>
          <p className="text-slate-550 text-[10px] mt-0.5 uppercase">
            PERIOD: {displayDateRange}
          </p>
        </div>

        {/* Overall summary numbers */}
        <div className="grid grid-cols-3 gap-4 py-6 border-b border-slate-350 finance-caption">
          <div>
            <span className="text-slate-500 text-[9px] uppercase font-bold block">GRAND TOTAL CREDITS (Cr)</span>
            <span className="text-emerald-700 text-lg font-black font-mono">{overallTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[9px] uppercase font-bold block">GRAND TOTAL DEBITS (Dr)</span>
            <span className="text-red-700 text-lg font-black font-mono">{overallTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[9px] uppercase font-bold block">NET LEDGER VALUE</span>
            <span className="text-slate-900 text-lg font-black font-mono">
              {overallTotals.balance >= 0 ? 'Cr ' : 'Dr '}{Math.abs(overallTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Summary Table */}
        <div className="py-6">
          <table className="min-w-full divide-y divide-slate-300 finance-caption">
            <thead>
              <tr className="bg-slate-50">
                <th className="py-2 px-3 text-left font-bold text-slate-700 uppercase">Head of Account</th>
                <th className="py-2 px-3 text-right font-bold text-slate-700 uppercase">Cr</th>
                <th className="py-2 px-3 text-right font-bold text-slate-700 uppercase">Dr</th>
                <th className="py-2 px-3 text-right font-bold text-slate-700 uppercase">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summaryData.map(s => (
                <tr key={s.head}>
                  <td className="py-2 px-3 text-slate-800 font-bold uppercase">{s.head}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-600">{s.credit > 0 ? `${s.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono text-red-600">{s.debit > 0 ? `${s.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{Math.abs(s.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {s.balance >= 0 ? 'Cr' : 'Dr'}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-t border-slate-350">
                <td className="py-2.5 px-3 text-slate-900 uppercase">Grand Total:</td>
                <td className="py-2.5 px-3 text-right font-mono">{overallTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="py-2.5 px-3 text-right font-mono">{overallTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="py-2.5 px-3 text-right font-mono">{Math.abs(overallTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.balance >= 0 ? 'Cr' : 'Dr'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default GeneralLedger;
