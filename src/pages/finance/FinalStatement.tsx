import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { FinanceSmartCalendar } from '../../components/finance/FinanceSmartCalendar';
import { dailyFinancialTransactionService } from '../../services/dailyFinancialTransactionService';
import { 
  FinanceCalculationEngine, 
  FinalStatementMetrics, 
  FinalStatementBSAccount, 
  PartnerEquityShare 
} from '../../services/FinanceCalculationEngine';
import { 
  Printer, 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Wallet,
  Building2,
  PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';
import { exportToExcelMultiSheet } from '../../utils/excel';

const formatDateOld = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const getAdaptiveCardFontSize = (amount: number, minimumFractionDigits = 2) => {
  const str = `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits })}`;
  const len = str.length;
  if (len >= 18) return 'text-[15px] sm:text-[17px] xl:text-[19px]';
  if (len >= 15) return 'text-[17px] sm:text-[19px] xl:text-[21px]';
  if (len >= 12) return 'text-[20px] sm:text-[22px] xl:text-[24px]';
  return 'text-[23px] sm:text-[26px] xl:text-[28px]';
};

const FinalStatement: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [expandedHeadNames, setExpandedHeadNames] = useState<Set<string>>(new Set());

  const [metrics, setMetrics] = useState<FinalStatementMetrics>({
    openingCash: 0,
    closingCash: 0,
    totalInflows: 0,
    totalOutflows: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalCapital: 0,
    totalCapitalContributed: 0,
    netProfit: 0,
    netWorth: 0,
    reconciliationDifference: 0,
    isBalanced: true,
    accounts: [],
    partnerShares: []
  });

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
  });

  const toggleExpandHead = (headName: string) => {
    setExpandedHeadNames(prev => {
      const next = new Set(prev);
      if (next.has(headName)) next.delete(headName);
      else next.add(headName);
      return next;
    });
  };

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
      const data = await FinanceCalculationEngine.getFinalStatementMetrics(startDate, endDate, financeMode);
      setMetrics(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load statement data');
    } finally {
      setLoading(false);
    }
  };

  const navigateToDetailedLedger = (head: string) => {
    navigate(`/finance/detailed-ledger?head=${encodeURIComponent(head)}&from=${startDate}&to=${endDate}`);
  };

  const handleExportExcel = () => {
    const summaryData = [
      { 'Metric': 'Total Assets', 'Amount': metrics.totalAssets },
      { 'Metric': 'Total Liabilities', 'Amount': metrics.totalLiabilities },
      { 'Metric': 'Capital', 'Amount': metrics.totalCapital },
      { 'Metric': 'Opening Cash', 'Amount': metrics.openingCash },
      { 'Metric': 'Closing Cash', 'Amount': metrics.closingCash },
      { 'Metric': 'Net Worth', 'Amount': metrics.netWorth },
      { 'Metric': 'Profit / Loss', 'Amount': metrics.netProfit }
    ];

    const partnerData = metrics.partnerShares.map((p: PartnerEquityShare) => ({
      'Partner Name': p.name,
      'Capital': p.capitalContributed,
      'Share': `${p.sharePercent}%`,
      'Profit Share': p.periodProfitShare,
      'Current Share': p.totalNetWorthShare
    }));

    const accountData = metrics.accounts.map((acc: FinalStatementBSAccount) => ({
      'Account Name': acc.accountName,
      'Category': acc.category,
      'Opening': acc.opening,
      'Credit': acc.credit,
      'Debit': acc.debit,
      'Net Movement': acc.netMovement,
      'Closing': acc.closing
    }));

    const sheets = [
      { name: 'Summary', data: summaryData },
      { name: 'Partner Summary', data: partnerData },
      { name: 'Business Accounts', data: accountData }
    ];

    exportToExcelMultiSheet(sheets, `Final_Statement_${startDate}_to_${endDate}`);
    toast.success('Exported to Excel!');
  };

  return (
    <div className="space-y-5 w-full select-none pb-8 px-1 text-slate-900 font-sans">
      
      {/* Header Bar & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">FINAL STATEMENT</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1.5">
            BUSINESS FINANCIAL SUMMARY
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={() => navigate(-1)} 
            variant="secondary" 
            size="sm" 
            icon={ArrowLeft} 
            className="h-[40px] min-w-[90px] justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Back
          </Button>
          <Button 
            onClick={fetchStatementData} 
            variant="secondary" 
            size="sm" 
            icon={RefreshCw} 
            className="h-[40px] min-w-[100px] justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Refresh
          </Button>
          <Button 
            onClick={() => setShowPrintPreview(true)} 
            variant="primary" 
            size="sm" 
            icon={Printer} 
            className="h-[40px] min-w-[90px] justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Print
          </Button>
          <Button 
            onClick={handleExportExcel} 
            variant="secondary" 
            size="sm" 
            icon={Download} 
            className="h-[40px] min-w-[90px] justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Excel
          </Button>
        </div>
      </div>

      {/* Row 1: Date Range Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <FinanceSmartCalendar
              label="FROM DATE"
              value={startDate}
              onChange={setStartDate}
              module="FINAL_STATEMENT"
              compact={true}
            />
          </div>
          <div className="flex-1">
            <FinanceSmartCalendar
              label="TO DATE"
              value={endDate}
              onChange={setEndDate}
              module="FINAL_STATEMENT"
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Operator Summary Cards (Clean Title + Value Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Total Assets */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] hover:border-emerald-300 transition-all bg-gradient-to-b from-emerald-50/20 to-white">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Total Assets</span>
            <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono text-emerald-700 tracking-tight leading-none ${getAdaptiveCardFontSize(metrics.totalAssets)}`}>
              ₹ {metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Total Liabilities */}
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] hover:border-amber-300 transition-all bg-gradient-to-b from-amber-50/20 to-white">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Total Liabilities</span>
            <TrendingDown className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono text-amber-700 tracking-tight leading-none ${getAdaptiveCardFontSize(metrics.totalLiabilities)}`}>
              ₹ {metrics.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Capital */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] hover:border-slate-300 transition-all bg-gradient-to-b from-slate-50/40 to-white">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Capital</span>
            <PieChart className="w-4 h-4 text-slate-500 shrink-0" />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono text-slate-900 tracking-tight leading-none ${getAdaptiveCardFontSize(metrics.totalCapital)}`}>
              ₹ {metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Net Worth */}
        <div className={`bg-white border ${metrics.netWorth >= 0 ? 'border-emerald-200 bg-gradient-to-b from-emerald-50/20 to-white' : 'border-rose-200 bg-gradient-to-b from-rose-50/20 to-white'} rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] transition-all`}>
          <div className="flex justify-between items-center">
            <span className={`text-xs font-bold uppercase tracking-wider ${metrics.netWorth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Net Worth
            </span>
            <TrendingUp className={`w-4 h-4 shrink-0 ${metrics.netWorth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono tracking-tight leading-none ${metrics.netWorth >= 0 ? 'text-emerald-700' : 'text-rose-700'} ${getAdaptiveCardFontSize(metrics.netWorth)}`}>
              ₹ {metrics.netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Opening Cash */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] hover:border-slate-300 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Opening Cash</span>
            <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono text-slate-800 tracking-tight leading-none ${getAdaptiveCardFontSize(metrics.openingCash)}`}>
              ₹ {metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Closing Cash */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] hover:border-slate-300 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Closing Cash</span>
            <Wallet className="w-4 h-4 text-slate-600 shrink-0" />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono text-slate-900 tracking-tight leading-none ${getAdaptiveCardFontSize(metrics.closingCash)}`}>
              ₹ {metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Profit / Loss */}
        <div className={`bg-white border ${metrics.netProfit >= 0 ? 'border-emerald-200 bg-gradient-to-b from-emerald-50/20 to-white' : 'border-rose-200 bg-gradient-to-b from-rose-50/20 to-white'} sm:col-span-2 rounded-xl p-4 shadow-sm flex flex-col justify-between h-[100px] transition-all`}>
          <div className="flex justify-between items-center">
            <span className={`text-xs font-bold uppercase tracking-wider ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Profit / Loss
            </span>
            <DollarSign className={`w-4 h-4 shrink-0 ${metrics.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="text-right">
            <div className={`font-black font-mono tracking-tight leading-none ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'} ${getAdaptiveCardFontSize(metrics.netProfit)}`}>
              ₹ {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 1: PARTNER SUMMARY */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-base font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            Partner Summary
          </h2>
          <span className="text-xs font-bold uppercase text-slate-500">
            {metrics.partnerShares.length} Partners
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 bg-white rounded-xl border border-slate-200">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-900"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs text-left border-collapse min-w-[650px]">
                <thead className="bg-slate-100/90 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="w-12 px-3 py-3 text-center">S.No</th>
                    <th className="px-4 py-3">Partner Name</th>
                    <th className="px-3 py-3 text-center">Role</th>
                    <th className="px-4 py-3 text-right text-slate-700">Capital</th>
                    <th className="px-3 py-3 text-right text-slate-600">Share</th>
                    <th className="px-4 py-3 text-right text-emerald-700">Profit Share</th>
                    <th className="px-4 py-3 text-right text-slate-900">Current Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white">
                  {metrics.partnerShares.map((partner: PartnerEquityShare, idx: number) => (
                    <tr key={partner.partnerId || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 uppercase">
                        {partner.name}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {partner.isMd ? (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">MD</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Partner</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                        ₹ {partner.capitalContributed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-600">
                        {partner.sharePercent}%
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${partner.periodProfitShare >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        ₹ {partner.periodProfitShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-black ${partner.totalNetWorthShare >= 0 ? 'text-slate-900' : 'text-rose-800'}`}>
                        ₹ {partner.totalNetWorthShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {metrics.partnerShares.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-400 font-bold uppercase italic">No partners found</td>
                    </tr>
                  )}
                </tbody>
                {metrics.partnerShares.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-mono font-black text-xs">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-sans font-bold uppercase text-slate-700">TOTAL</td>
                      <td className="px-4 py-3 text-right text-slate-800">₹ {metrics.totalCapitalContributed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-slate-700">100%</td>
                      <td className={`px-4 py-3 text-right ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>₹ {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-900">₹ {metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: BUSINESS ACCOUNTS TABLE */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-base font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-600" />
            Business Accounts
          </h2>
          <span className="text-xs font-bold uppercase text-slate-500">
            {metrics.accounts.length} Accounts
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 bg-white rounded-xl border border-slate-200">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-900"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto flex-1 max-h-[550px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs text-left border-collapse min-w-[750px]">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-[2px] text-slate-600 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="w-8 px-2 py-3 text-center"></th>
                    <th className="px-3 py-3">Account Name</th>
                    <th className="px-3 py-3 text-center">Category</th>
                    <th className="px-3 py-3 text-right text-slate-500 whitespace-nowrap">Opening</th>
                    <th className="px-3 py-3 text-right text-emerald-700 whitespace-nowrap">Credit</th>
                    <th className="px-3 py-3 text-right text-rose-700 whitespace-nowrap">Debit</th>
                    <th className="px-3 py-3 text-right text-slate-800 whitespace-nowrap">Net Movement</th>
                    <th className="px-3 py-3 text-right text-slate-900 whitespace-nowrap">Closing</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white text-[11px]">
                  
                  {/* Cash & Bank Row */}
                  <tr className="bg-slate-50/60 hover:bg-slate-100/80 transition-colors font-bold">
                    <td className="px-2 py-2.5 text-center">
                      <Wallet className="w-4 h-4 text-emerald-600 inline" />
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 uppercase">
                      CASH &amp; BANK
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">ASSET</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 whitespace-nowrap">
                      ₹ {metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 whitespace-nowrap">
                      ₹ {metrics.totalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-700 whitespace-nowrap">
                      ₹ {metrics.totalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                      ₹ {(metrics.totalInflows - metrics.totalOutflows).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                      ₹ {metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigate('/finance/daybook')}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-[10px] font-bold hover:underline"
                      >
                        <span>Cash Book</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>

                  {metrics.accounts.map((acc: FinalStatementBSAccount) => {
                    const isExpanded = expandedHeadNames.has(acc.accountName);
                    return (
                      <React.Fragment key={acc.accountName}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpandHead(acc.accountName)}
                              className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-700" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900 uppercase truncate max-w-[200px]" title={acc.accountName}>
                            {acc.accountName}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              acc.category === 'ASSET' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              acc.category === 'LIABILITY' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {acc.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500 whitespace-nowrap">
                            {acc.opening !== 0 ? acc.opening.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {acc.credit > 0 ? acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                            {acc.debit > 0 ? acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {acc.netMovement !== 0 ? acc.netMovement.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-black whitespace-nowrap ${acc.closing >= 0 ? 'text-slate-900' : 'text-rose-800'}`}>
                            {acc.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigateToDetailedLedger(acc.accountName)}
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-[10px] font-bold hover:underline"
                            >
                              <span>Ledger</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Sub-table */}
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={9} className="px-3 py-2 border-y border-slate-200">
                              <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 border-b pb-1">
                                  <span>TRANSACTIONS ({acc.ledgerCount} entries)</span>
                                  <button 
                                    onClick={() => navigateToDetailedLedger(acc.accountName)}
                                    className="text-slate-900 hover:underline font-bold text-[10px] inline-flex items-center gap-1"
                                  >
                                    View Full Ledger <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="overflow-x-auto max-h-[260px] overflow-y-auto scrollbar-thin">
                                  <table className="w-full text-[10px] text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                                      <tr>
                                        <th className="p-1.5 whitespace-nowrap">Date</th>
                                        <th className="p-1.5 whitespace-nowrap">Source</th>
                                        <th className="p-1.5 whitespace-nowrap">Receipt</th>
                                        <th className="p-1.5 whitespace-nowrap">Particulars</th>
                                        <th className="p-1.5 text-right text-emerald-700 whitespace-nowrap">Credit</th>
                                        <th className="p-1.5 text-right text-rose-700 whitespace-nowrap">Debit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 font-mono">
                                      {acc.entries.map((entry: any) => (
                                        <tr key={entry.id} className="hover:bg-slate-50">
                                          <td className="p-1.5 font-bold whitespace-nowrap">{formatDateOld(entry.transactionDate)}</td>
                                          <td className="p-1.5 text-slate-600 whitespace-nowrap">{entry.sourceType}</td>
                                          <td className="p-1.5 font-bold whitespace-nowrap">{entry.receiptOrVoucherNo || '—'}</td>
                                          <td className="p-1.5 font-sans text-slate-700 truncate max-w-[180px]" title={entry.particulars}>{entry.particulars || '—'}</td>
                                          <td className="p-1.5 text-right text-emerald-700 font-bold whitespace-nowrap">{entry.credit > 0 ? entry.credit.toLocaleString('en-IN') : '—'}</td>
                                          <td className="p-1.5 text-right text-rose-700 font-bold whitespace-nowrap">{entry.debit > 0 ? entry.debit.toLocaleString('en-IN') : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {metrics.accounts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-slate-400 font-bold uppercase italic">No accounts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Final Statement"
        documentTitle={`FINAL STATEMENT: ${formatDateOld(startDate)} TO ${formatDateOld(endDate)}`}
      >
        <div className="space-y-6 pb-8 font-sans">
          <div className="text-center border-b pb-3">
            <h2 className="text-lg font-black uppercase text-slate-900">Final Statement</h2>
            <p className="text-[10px] text-slate-500 uppercase font-mono mt-1">Period: {formatDateOld(startDate)} To {formatDateOld(endDate)}</p>
          </div>

          {/* Executive Summary Metrics Grid */}
          <div className="grid grid-cols-4 gap-3 border border-slate-900 p-2.5 text-center text-[10px] font-bold uppercase bg-slate-50 font-mono">
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Total Assets</span>
              <span className="text-emerald-800 font-black">₹ {metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Total Liabilities</span>
              <span className="text-amber-800 font-black">₹ {metrics.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Net Worth</span>
              <span className="text-slate-900 font-black">₹ {metrics.netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="block text-[8px] text-slate-500 font-sans">Profit / Loss</span>
              <span className={metrics.netProfit >= 0 ? 'text-emerald-800 font-black' : 'text-rose-800 font-black'}>
                ₹ {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Partner Share Print Schedule */}
          <div className="border border-slate-900 text-[10px]">
            <div className="bg-slate-100 border-b border-slate-900 px-3 py-1.5 font-bold uppercase text-slate-900">
              Partner Summary
            </div>
            <table className="w-full text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50 font-sans font-bold text-slate-700 text-[9px] uppercase">
                  <th className="p-1.5 border-r border-slate-300">Partner</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Capital</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Share</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Profit Share</th>
                  <th className="p-1.5 text-right font-black">Current Share</th>
                </tr>
              </thead>
              <tbody>
                {metrics.partnerShares.map((p: PartnerEquityShare, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-1.5 border-r border-slate-200 font-bold uppercase">{p.name} {p.isMd ? '(MD)' : ''}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right">{p.capitalContributed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right">{p.sharePercent}%</td>
                    <td className="p-1.5 border-r border-slate-200 text-right text-emerald-800 font-bold">{p.periodProfitShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-1.5 text-right font-black text-slate-900">{p.totalNetWorthShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Balance Sheet Print Table */}
          <div className="border border-slate-900 text-[10px]">
            <div className="bg-slate-100 border-b border-slate-900 px-3 py-1.5 font-bold uppercase text-slate-900 flex justify-between">
              <span>Business Accounts</span>
            </div>
            <table className="w-full text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50 font-sans font-bold text-slate-700 text-[9px] uppercase">
                  <th className="p-1.5 border-r border-slate-300">Account Name</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">Category</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Opening</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Credit</th>
                  <th className="p-1.5 border-r border-slate-300 text-right">Debit</th>
                  <th className="p-1.5 text-right font-black">Closing</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                  <td className="p-1.5 border-r border-slate-200 uppercase">CASH &amp; BANK</td>
                  <td className="p-1.5 border-r border-slate-200 text-center">ASSET</td>
                  <td className="p-1.5 border-r border-slate-200 text-right">{metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1.5 border-r border-slate-200 text-right">{metrics.totalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1.5 border-r border-slate-200 text-right">{metrics.totalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1.5 text-right font-black">{metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                {metrics.accounts.map((acc: FinalStatementBSAccount, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-1.5 border-r border-slate-200 uppercase font-bold">{acc.accountName}</td>
                    <td className="p-1.5 border-r border-slate-200 text-center">{acc.category}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right">{acc.opening.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right">{acc.credit > 0 ? acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="p-1.5 border-r border-slate-200 text-right">{acc.debit > 0 ? acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="p-1.5 text-right font-black">{acc.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default FinalStatement;
