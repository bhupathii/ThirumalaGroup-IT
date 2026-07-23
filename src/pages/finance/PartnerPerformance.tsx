
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
    const data: any[] = rows.map(row => ({
      'Partner Name': row.name,
      'Role': row.role,
      'Capital Invested': row.netCapital,
      'Loans Introduced': row.loansIntroduced,
      'Loans Active': row.activeLoans,
      'Loans Closed': row.closedLoans,
      'Principal Financed': row.principalFinanced,
      'Principal Collected': row.principalCollected,
      'Interest Earned': Math.round(row.interestEarned),
      'Penalty Earned': Math.round(row.penaltyEarned),
      'Outstanding Principal': Math.round(row.outstanding),
      'Present Due': Math.round(row.presentDue),
      'Pending Interest': Math.round(row.pendingInterest),
      'Pending Penalty': Math.round(row.pendingPenalty),
      'Recovery %': Number(row.recoveryPct.toFixed(1)),
      'Collection %': Number(row.collectionPct.toFixed(1)),
      'Yield %': Number(row.yieldPct.toFixed(1)),
      'NPA Count': row.npaCount
    }));

    // Add Grand Total Row
    data.push({
      'Partner Name': 'GRAND TOTAL',
      'Role': 'SUMMARY',
      'Capital Invested': grandTotals.netCapital,
      'Loans Introduced': grandTotals.loansIntroduced,
      'Loans Active': grandTotals.activeLoans,
      'Loans Closed': grandTotals.closedLoans,
      'Principal Financed': grandTotals.principalFinanced,
      'Principal Collected': grandTotals.principalCollected,
      'Interest Earned': Math.round(grandTotals.interestEarned),
      'Penalty Earned': Math.round(grandTotals.penaltyEarned),
      'Outstanding Principal': Math.round(grandTotals.outstanding),
      'Present Due': Math.round(grandTotals.presentDue),
      'Pending Interest': Math.round(grandTotals.pendingInterest),
      'Pending Penalty': Math.round(grandTotals.pendingPenalty),
      'Recovery %': Number(overallRecoveryPct.toFixed(1)),
      'Collection %': Number(overallCollectionPct.toFixed(1)),
      'Yield %': Number(overallYieldPct.toFixed(1)),
      'NPA Count': grandTotals.npaCount
    });

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

      const { data: fetchedCdEntries } = await supabase
        .from('finance_cd_ledger_entries')
        .select('*');
      const cdEntries = fetchedCdEntries || [];

      const perfRows: PartnerPerfRow[] = partners.map(partner => {
        const isMd = partner.is_md;

        // A. Capital Introduced in Date Range
        const pCaps = capEntries.filter(c => {
          const cDate = c.entry_date ? c.entry_date.split('T')[0] : '';
          const inDateRange = (!startDate || cDate >= startDate) && (!endDate || cDate <= endDate);
          const isPartnerMatch = c.partner_id === partner.id || 
            (c.partner_name && c.partner_name.trim().toUpperCase() === partner.name.trim().toUpperCase()) ||
            (isMd && (!c.partner_id && !c.partner_name));
          return inDateRange && isPartnerMatch;
        });

        let netCapital = 0;
        pCaps.forEach(c => { 
          netCapital += (Number(c.credit) || 0) - (Number(c.debit) || 0); 
        });

        // B. Loans Belonging to Partner
        const pLoans = allLoans.filter(l => {
          const rawPartner = ((l as any).partner_name || l.customer?.partner_name || '').trim();
          if (rawPartner) {
            return rawPartner.toUpperCase() === partner.name.trim().toUpperCase();
          }
          // Unassigned loans are managed by MD partner
          return isMd;
        });
        
        // Loans Introduced & Disbursed in Date Range
        const pLoansInRange = pLoans.filter(l => {
          const lDate = l.date ? l.date.split('T')[0] : '';
          return (!startDate || lDate >= startDate) && (!endDate || lDate <= endDate);
        });

        const loansIntroduced = pLoansInRange.length;
        let principalFinanced = 0;
        pLoansInRange.forEach(l => {
          principalFinanced += Number(l.amount) || 0;
        });

        // Active, Closed, and NPA counts directly from database loan records in date range
        let activeLoans = 0;
        let closedLoans = 0;
        let npaCount = 0;

        pLoansInRange.forEach(l => {
          const statusLower = (l.status || '').trim().toLowerCase();
          if (statusLower === 'closed') {
            closedLoans++;
          } else {
            // Default active if not closed
            activeLoans++;
          }

          // Count ONLY loans explicitly classified as NPA in database flags/status
          if ((l as any).is_npa === true || l.npa_closed === true || statusLower === 'npa') {
            npaCount++;
          }
        });

        // C. Actual Collections from Ledger Entries within date range
        let principalCollected = 0;
        let interestEarned = 0;
        let penaltyEarned = 0;

        const pLoanIds = new Set(pLoans.map(l => l.id).concat(pLoans.map(l => l.loan_id).filter(Boolean)));

        cdEntries.forEach(entry => {
          const eDate = entry.entry_date || entry.date || '';
          if (startDate && eDate < startDate) return;
          if (endDate && eDate > endDate) return;

          if (pLoanIds.has(entry.loan_id)) {
            const cr = Number(entry.credit) || 0;
            const dr = Number(entry.debit) || 0;
            const net = cr - dr;
            const acc = (entry.account_name || '').trim();

            if (acc === 'CD A/C' || acc === 'CD PRINCIPAL' || acc === 'CD Amount Paid') {
              principalCollected += net;
            } else if (acc === 'CD COMMISSION A/C' || acc === 'CD INTEREST') {
              interestEarned += net;
            } else if (acc === 'PENALTY A/C' || acc === 'CD PENALTY') {
              penaltyEarned += net;
            }
          }
        });

        // D. Dues Positions as of endDate
        let outstanding = 0;
        let presentDue = 0;
        let pendingInterest = 0;
        let pendingPenalty = 0;

        pLoans.forEach(l => {
          const due = dues.find(d => d.loan_id === l.loan_id || d.loanId === l.id || d.id === l.id);
          if (due) {
            if (l.status === 'Active') {
              outstanding += Number(due.current_principal || due.currentPrincipal || due.principal || 0);
              presentDue += Number(due.present_due || due.presentDue || due.totalPending || 0);
              pendingInterest += Number(due.pending_interest || due.pendingInterest || 0);
              pendingPenalty += Number(due.penalty || due.penaltyPending || 0);
            }
          } else if (l.status === 'Active') {
            outstanding += Number(l.amount) || 0;
          }
        });

        // E. Financial Ratios
        const recoveryPct = principalFinanced > 0 ? (principalCollected / principalFinanced) * 100 : 0;
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

  const grandTotals = rows.reduce(
    (acc, row) => ({
      netCapital: acc.netCapital + row.netCapital,
      loansIntroduced: acc.loansIntroduced + row.loansIntroduced,
      principalFinanced: acc.principalFinanced + row.principalFinanced,
      principalCollected: acc.principalCollected + row.principalCollected,
      interestEarned: acc.interestEarned + row.interestEarned,
      penaltyEarned: acc.penaltyEarned + row.penaltyEarned,
      outstanding: acc.outstanding + row.outstanding,
      presentDue: acc.presentDue + row.presentDue,
      pendingInterest: acc.pendingInterest + row.pendingInterest,
      pendingPenalty: acc.pendingPenalty + row.pendingPenalty,
      npaCount: acc.npaCount + row.npaCount,
      activeLoans: acc.activeLoans + row.activeLoans,
      closedLoans: acc.closedLoans + row.closedLoans,
    }),
    {
      netCapital: 0,
      loansIntroduced: 0,
      principalFinanced: 0,
      principalCollected: 0,
      interestEarned: 0,
      penaltyEarned: 0,
      outstanding: 0,
      presentDue: 0,
      pendingInterest: 0,
      pendingPenalty: 0,
      npaCount: 0,
      activeLoans: 0,
      closedLoans: 0,
    }
  );

  const overallRecoveryPct = grandTotals.principalFinanced > 0 ? (grandTotals.principalCollected / grandTotals.principalFinanced) * 100 : 0;
  const overallTotalColl = grandTotals.principalCollected + grandTotals.interestEarned + grandTotals.penaltyEarned;
  const overallTotalDue = overallTotalColl + grandTotals.presentDue;
  const overallCollectionPct = overallTotalDue > 0 ? (overallTotalColl / overallTotalDue) * 100 : 0;
  const overallYieldPct = grandTotals.principalFinanced > 0 ? (grandTotals.interestEarned / grandTotals.principalFinanced) * 100 : 0;

  const partnerColors = [
    { bar: 'bg-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-600' },
    { bar: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
    { bar: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600' },
    { bar: 'bg-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-600' },
    { bar: 'bg-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-600' },
  ];

  const partnerSplitData = rows.map((row, idx) => {
    const pct = grandTotals.principalFinanced > 0
      ? (row.principalFinanced / grandTotals.principalFinanced) * 100
      : 0;
    return {
      ...row,
      pct,
      pctFormatted: pct.toFixed(1) + '%',
      color: partnerColors[idx % partnerColors.length]
    };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4`}>
        <div>
          <h1 className="finance-h1">Partner Performance</h1>
          <p className="finance-small-label uppercase font-black text-slate-500">Audited Financial Report · Reconciled Ledger & Portfolio Metrics</p>
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

      {/* Date Filters + Partner Performance Split KPI Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Date Filter Box (Left - 4 Columns) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="finance-small-label uppercase font-black text-slate-500">Date Filter Range</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Selected Period</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-center">
              <label className="text-slate-400 mb-0.5 finance-small-label uppercase">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase text-xs font-bold"
              />
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-center">
              <label className="text-slate-400 mb-0.5 finance-small-label uppercase">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase text-xs font-bold"
              />
            </div>
          </div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase text-right">
            Showing business from {startDate || 'Beginning'} to {endDate}
          </div>
        </div>

        {/* Partner Performance Split Summary Card (Right - 8 Columns) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <h3 className="finance-small-label font-black text-slate-800 uppercase tracking-wider">Partner Performance Split</h3>
            </div>
            <span className="text-[11px] font-mono font-black text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              Total Financed: ₹{grandTotals.principalFinanced.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-2">
            {partnerSplitData.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color.dot}`}></span>
                    <span className="font-bold text-slate-900 uppercase truncate text-[12px]">{p.name}</span>
                    <span className="text-[9px] text-slate-400 font-semibold">({p.role})</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                    <span className="text-[11px] text-slate-500 font-bold">₹{p.principalFinanced.toLocaleString('en-IN')}</span>
                    <span className={`text-[11px] font-black px-1.5 py-0.2 rounded border ${p.color.badge}`}>
                      {p.pctFormatted}
                    </span>
                  </div>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${p.color.bar}`} 
                    style={{ width: `${Math.max(1, p.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
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
                      onClick={() => navigate('/finance/business-report', { state: { targetPartnerId: row.id } })}
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

                  {/* Grand Total Reconciliation Row */}
                  <tr className="bg-slate-100 font-sans font-black border-t-2 border-slate-300 text-xs text-slate-900">
                    <td className="px-3 py-3 font-black uppercase text-left">GRAND TOTAL:</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                      ₹{grandTotals.netCapital.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center font-bold">{grandTotals.loansIntroduced}</td>
                    <td className="px-3 py-3 text-right font-mono font-black text-blue-900 whitespace-nowrap">
                      ₹{grandTotals.principalFinanced.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                      ₹{grandTotals.principalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                      ₹{Math.round(grandTotals.interestEarned).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                      ₹{Math.round(grandTotals.penaltyEarned).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-rose-800 whitespace-nowrap">
                      ₹{Math.round(grandTotals.outstanding).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-rose-800 whitespace-nowrap">
                      ₹{Math.round(grandTotals.presentDue).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center font-black bg-emerald-100 text-emerald-900 whitespace-nowrap">
                      {overallRecoveryPct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-center font-black bg-emerald-100 text-emerald-900 whitespace-nowrap">
                      {overallCollectionPct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-center font-black bg-emerald-100 text-emerald-950 whitespace-nowrap">
                      {overallYieldPct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-center font-black text-rose-900 whitespace-nowrap">
                      {grandTotals.npaCount}
                    </td>
                    <td className="px-3 py-3 text-center font-bold whitespace-nowrap">
                      {grandTotals.activeLoans} / {grandTotals.closedLoans}
                    </td>
                  </tr>
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
                <p className="text-[12px] uppercase text-slate-700 font-bold">Partner Business & Recovery Report</p>
              </div>
              <div className="text-right text-[11px] text-slate-800 font-semibold">
                <p>Period: {startDate ? startDate.split('-').reverse().join('/') : 'Beginning'} to {endDate.split('-').reverse().join('/')}</p>
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
                
                {/* Grand Total Row in Print */}
                <tr className="border-t-2 border-slate-900 bg-slate-100 font-black">
                  <td className="p-2 uppercase border-r border-slate-300">GRAND TOTAL</td>
                  <td className="p-2 text-right border-r border-slate-300">₹{grandTotals.netCapital.toLocaleString('en-IN')}</td>
                  <td className="p-2 text-center border-r border-slate-300">{grandTotals.loansIntroduced}</td>
                  <td className="p-2 text-right border-r border-slate-300 text-blue-900">₹{grandTotals.principalFinanced.toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right border-r border-slate-300 text-green-800">₹{grandTotals.principalCollected.toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right border-r border-slate-300">₹{Math.round(grandTotals.interestEarned).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right border-r border-slate-300">₹{Math.round(grandTotals.penaltyEarned).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right border-r border-slate-300 text-rose-700">₹{Math.round(grandTotals.outstanding).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right border-r border-slate-300 text-rose-700">₹{Math.round(grandTotals.presentDue).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-center border-r border-slate-300">{overallRecoveryPct.toFixed(1)}%</td>
                  <td className="p-2 text-center border-r border-slate-300">{overallCollectionPct.toFixed(1)}%</td>
                  <td className="p-2 text-center border-r border-slate-300">{overallYieldPct.toFixed(1)}%</td>
                  <td className="p-2 text-center border-r border-slate-300 text-red-600">{grandTotals.npaCount}</td>
                  <td className="p-2 text-center border-r border-slate-300">{grandTotals.activeLoans}</td>
                  <td className="p-2 text-center">{grandTotals.closedLoans}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default PartnerPerformance;
