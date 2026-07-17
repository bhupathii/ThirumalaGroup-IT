
import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { dailyFinancialTransactionService } from '../../services/dailyFinancialTransactionService';
import { exportToExcel } from '../../utils/excel';

interface PartnerPerfRow {
  id: string;
  name: string;
  role: string;
  netCapital: number;
  loansIntroduced: number;
  principalFinanced: number;
  principalCollected: number;
  interestEarned: number;
  penaltyEarned: number;
  outstanding: number;
  presentDue: number;
  pendingInterest: number;
  pendingPenalty: number;
  recoveryPct: number;
  collectionPct: number;
  yieldPct: number;
  npaCount: number;
  activeLoans: number;
  closedLoans: number;
}

const PartnerPerformance: React.FC = () => {
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PartnerPerfRow[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    const loadDefaultStartDate = async () => {
      try {
        const oldest = await dailyFinancialTransactionService.getOldestTransactionDate();
        if (oldest) {
          setStartDate(oldest);
        } else {
          setStartDate('2024-01-01');
        }
      } catch (err) {
        console.error(err);
        setStartDate('2024-01-01');
      }
    };
    loadDefaultStartDate();
  }, []);

  useEffect(() => {
    if (startDate) {
      fetchPerformanceData();
    }
  }, [startDate, endDate]);

  const handleExportExcel = () => {
    const data = rows.map(row => ({
      'Partner Name': row.name,
      'Role': row.role,
      'Capital Invested': row.netCapital,
      'Loans Introduced': row.loansIntroduced,
      'Loans Active': row.activeLoans,
      'Loans Closed': row.closedLoans,
      'Principal Financed': row.principalFinanced,
      'Principal Collected': row.principalCollected,
      'Interest Earned': row.interestEarned,
      'Penalty Earned': row.penaltyEarned,
      'Outstanding Principal': row.outstanding,
      'Present Due': row.presentDue,
      'Pending Interest': row.pendingInterest,
      'Pending Penalty': row.pendingPenalty,
      'Recovery %': row.recoveryPct,
      'Collection %': row.collectionPct,
      'Yield %': row.yieldPct,
      'NPA Count': row.npaCount
    }));
    exportToExcel(data, `Partner_Performance_${startDate}_to_${endDate}`);
    toast.success('Excel Statement Exported!');
  };

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const partners = await supabaseFinance.getPartners();
      
      const { data: fetchedCapEntries } = await supabase
        .from('finance_capital_entries')
        .select('*');
      
      const capEntries = fetchedCapEntries || [];
      const { dues } = await supabaseFinance.getDuesLedgerSummary(endDate);
      const allLoans = await supabaseFinance.getLoans();



      const perfRows: PartnerPerfRow[] = partners.map(partner => {
        const pCaps = capEntries.filter(c => c.partner_id === partner.id && c.entry_date >= startDate && c.entry_date <= endDate);
        let cr = 0, dr = 0;
        pCaps.forEach(c => { 
          cr += Number(c.credit) || 0; 
          dr += Number(c.debit) || 0; 
        });
        const netCapital = cr - dr;

        const pLoans = allLoans.filter(l => l.customer?.partner_name === partner.name && l.date >= startDate && l.date <= endDate);
        
        let loansIntroduced = pLoans.length;
        let principalFinanced = 0;
        let principalCollected = 0;
        let interestEarned = 0;
        let penaltyEarned = 0;
        let outstanding = 0;
        let presentDue = 0;
        let pendingInterest = 0;
        let pendingPenalty = 0;
        let activeLoans = 0;
        let closedLoans = 0;
        let npaCount = 0;

        pLoans.forEach(l => {
          const p = Number(l.amount) || 0;
          principalFinanced += p;
          if (l.status === 'Active') activeLoans++;
          if (l.status === 'Closed') closedLoans++;

          const due = dues.find(d => d.loan_id === l.loan_id || d.loanId === l.id);
          if (due && due.is_npa) {
            npaCount++;
          }

           const loanOutstanding = l.status === 'Closed' ? 0 : (due ? Number(due.current_principal || due.principal || 0) : p);
          outstanding += loanOutstanding;
          principalCollected += (p - loanOutstanding);

          const loanPInt = due ? Number(due.pending_interest || due.interestPending || 0) : 0;
          const loanPPen = due ? Number(due.penalty || due.penaltyPending || 0) : 0;
          const loanTDue = due ? Number(due.present_due || due.totalPending || 0) : 0;

          pendingInterest += loanPInt;
          pendingPenalty += loanPPen;
          presentDue += loanTDue;

          interestEarned += due ? Number(due.interest_paid || 0) : 0;
          penaltyEarned += due ? Number(due.penalty_paid || 0) : 0;
        });

        const recoveryPct = principalFinanced > 0 ? Math.min(100, (principalCollected / principalFinanced) * 100) : 0;
        const totalCollected = principalCollected + interestEarned + penaltyEarned;
        const totalDue = totalCollected + presentDue;
        const collectionPct = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;
        const yieldPct = principalFinanced > 0 ? (interestEarned / principalFinanced) * 100 : 0;

        return {
          id: partner.id,
          name: partner.name,
          role: partner.is_md ? 'MD' : 'Partner',
          netCapital,
          loansIntroduced,
          principalFinanced,
          principalCollected,
          interestEarned,
          penaltyEarned,
          outstanding,
          presentDue,
          pendingInterest,
          pendingPenalty,
          recoveryPct,
          collectionPct,
          yieldPct,
          npaCount,
          activeLoans,
          closedLoans
        };
      });

      perfRows.sort((a, b) => b.principalFinanced - a.principalFinanced);
      setRows(perfRows);

    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze partner performance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4`}>
        <div>
          <h1 className="finance-h1">Partner Performance</h1>
          <p className="finance-small-label uppercase font-black text-slate-500">Review business metrics, recovery percentages, and portfolios</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPerformanceData} variant="secondary" size="sm" icon={RefreshCw}>
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
            Print
          </Button>
          <Button onClick={handleExportExcel} variant="secondary" size="sm" icon={Download}>
            Excel
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
          />
        </div>
      </div>

      {loading ? (
        <div className={`flex justify-center py-12`}>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : (
        <div className={`space-y-6`}>
          <Card title="Partner Portfolio Registry" subtitle="Comprehensive business generated per partner in selected period." className="shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider whitespace-nowrap">Partner Name</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap">Capital</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap">Introduced</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-blue-800">Financed</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-emerald-800">Collected</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-emerald-800">Int Earned</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-emerald-800">Pen Earned</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-rose-800">Outstanding</th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-rose-800">Present Due</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-emerald-800">Recovery %</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-emerald-800">Collection %</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-emerald-900">Yield %</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-rose-800">NPA</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap">Act / Cls</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr 
                      key={row.id} 
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      onClick={() => navigate('/finance/business-report', { state: { targetPartnerId: row.id } })} // Optional quick jump
                    >
                      <td className="px-3 py-3 text-slate-900 font-bold uppercase whitespace-nowrap text-xs">
                        {row.name} <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded font-normal">{row.role}</span>
                      </td>
                      <td className={`px-3 py-3 text-right font-medium font-mono text-xs whitespace-nowrap ${row.netCapital >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        ₹{row.netCapital.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700 text-xs whitespace-nowrap">{row.loansIntroduced}</td>
                      <td className="px-3 py-3 text-right text-blue-700 font-black font-mono text-xs whitespace-nowrap">₹{row.principalFinanced.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-emerald-700 font-black font-mono text-xs whitespace-nowrap">₹{row.principalCollected.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-emerald-700 font-bold font-mono text-xs whitespace-nowrap">₹{Math.round(row.interestEarned).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-emerald-700 font-bold font-mono text-xs whitespace-nowrap">₹{Math.round(row.penaltyEarned).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-rose-700 font-black font-mono text-xs whitespace-nowrap">₹{Math.round(row.outstanding).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-rose-700 font-black font-mono text-xs whitespace-nowrap">₹{Math.round(row.presentDue).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-center text-emerald-800 font-black bg-emerald-50/50 text-xs whitespace-nowrap">
                        {row.recoveryPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-800 font-black bg-emerald-50/50 text-xs whitespace-nowrap">
                        {row.collectionPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-900 font-black bg-emerald-50/50 text-xs whitespace-nowrap">
                        {row.yieldPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-center text-rose-800 font-black text-xs whitespace-nowrap">
                        {row.npaCount}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-800 font-bold text-xs whitespace-nowrap">{row.activeLoans} / {row.closedLoans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Partner Performance Report"
        documentTitle="PARTNER PERFORMANCE REPORT"
      >
        {!loading && (
          <div className="space-y-6 mt-6 text-[10px]">
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
              <div>
                <p className="text-[12px] uppercase text-slate-700 font-bold">Partner Business & Recovery</p>
              </div>
              <div className="text-right text-[11px] text-slate-800 font-semibold">
                <p>Period: {startDate.split('-').reverse().join('/')} to {endDate.split('-').reverse().join('/')}</p>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[9px]">
                  <th className="p-2 text-left border-r border-slate-300">Partner Name</th>
                  <th className="p-2 text-right border-r border-slate-300">Capital</th>
                  <th className="p-2 text-center border-r border-slate-300">Intr.</th>
                  <th className="p-2 text-right border-r border-slate-300">Financed</th>
                  <th className="p-2 text-right border-r border-slate-300">Collected</th>
                  <th className="p-2 text-right border-r border-slate-300">Int Earned</th>
                  <th className="p-2 text-right border-r border-slate-300">Pen Earned</th>
                  <th className="p-2 text-right border-r border-slate-300">Outstanding</th>
                  <th className="p-2 text-right border-r border-slate-300">Present Due</th>
                  <th className="p-2 text-center border-r border-slate-300">Rec. %</th>
                  <th className="p-2 text-center border-r border-slate-300">Coll. %</th>
                  <th className="p-2 text-center border-r border-slate-300">Yield %</th>
                  <th className="p-2 text-center border-r border-slate-300 text-red-700">NPA</th>
                  <th className="p-2 text-center border-r border-slate-300">Act.</th>
                  <th className="p-2 text-center">Cls.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="p-2 uppercase font-bold border-r border-slate-300">{row.name}</td>
                    <td className="p-2 text-right border-r border-slate-300">₹{row.netCapital.toLocaleString('en-IN')}</td>
                    <td className="p-2 text-center border-r border-slate-300">{row.loansIntroduced}</td>
                    <td className="p-2 text-right border-r border-slate-300 font-bold text-blue-700">₹{row.principalFinanced.toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right border-r border-slate-300">₹{row.principalCollected.toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right border-r border-slate-300">₹{Math.round(row.interestEarned).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right border-r border-slate-300">₹{Math.round(row.penaltyEarned).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right border-r border-slate-300 text-rose-700 font-bold">₹{Math.round(row.outstanding).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right border-r border-slate-300 text-rose-700 font-bold">₹{Math.round(row.presentDue).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black">{row.recoveryPct.toFixed(1)}%</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black">{row.collectionPct.toFixed(1)}%</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black">{row.yieldPct.toFixed(1)}%</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-red-600">{row.npaCount}</td>
                    <td className="p-2 text-center border-r border-slate-300">{row.activeLoans}</td>
                    <td className="p-2 text-center">{row.closedLoans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default PartnerPerformance;
