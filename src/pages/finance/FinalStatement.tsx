import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { FinanceSmartCalendar } from '../../components/finance/FinanceSmartCalendar';
import { dailyFinancialTransactionService } from '../../services/dailyFinancialTransactionService';
import { 
  FinanceCalculationEngine, 
  FinalStatementMetrics, 
  FinalStatementAccount,
  FinalStatementPLHead
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
  Wallet,
  Building2,
  ShieldCheck,
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
  const str = `${amount.toLocaleString('en-IN', { minimumFractionDigits })}`;
  const len = str.length;
  if (len >= 20) return 'text-lg sm:text-xl xl:text-2xl';
  if (len >= 16) return 'text-xl sm:text-2xl xl:text-[25px]';
  return 'text-2xl sm:text-[25px] xl:text-[27px]';
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
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalAssets: 0,
    totalLoanPrincipal: 0,
    totalLiabilities: 0,
    totalCapital: 0,
    totalLiabilitiesAndCapital: 0,
    netWorth: 0,
    incomeHeads: [],
    expenseHeads: [],
    accounts: []
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

  // Classified Balance Sheet components
  const loanPrincipalAccounts = useMemo(() => 
    metrics.accounts.filter(acc => 
      acc.category === 'ASSET' && (
        acc.accountName.toUpperCase().includes('DISBURSEMENT') ||
        acc.accountName.toUpperCase().includes('PRINCIPAL') ||
        acc.accountName.toUpperCase().includes('RECEIVABLE')
      )
    ), [metrics.accounts]);

  const bankAndOtherAssetAccounts = useMemo(() => 
    metrics.accounts.filter(acc => 
      acc.category === 'ASSET' && !loanPrincipalAccounts.some(lp => lp.accountName === acc.accountName)
    ), [metrics.accounts, loanPrincipalAccounts]);

  const capitalAccounts = useMemo(() => 
    metrics.accounts.filter(acc => acc.category === 'CAPITAL'), [metrics.accounts]);

  const liabilityAccounts = useMemo(() => 
    metrics.accounts.filter(acc => acc.category === 'LIABILITY'), [metrics.accounts]);

  const handleExportExcel = () => {
    const summaryData = [
      { 'Business Metric': 'Total Assets', 'Amount': metrics.totalAssets },
      { 'Business Metric': 'Total Liabilities', 'Amount': metrics.totalLiabilities },
      { 'Business Metric': 'Total Capital', 'Amount': metrics.totalCapital },
      { 'Business Metric': 'Net Worth', 'Amount': metrics.netWorth },
      { 'Business Metric': 'Opening Cash', 'Amount': metrics.openingCash },
      { 'Business Metric': 'Closing Cash', 'Amount': metrics.closingCash },
      { 'Business Metric': 'Total Operating Income', 'Amount': metrics.totalIncome },
      { 'Business Metric': 'Total Operating Expenses', 'Amount': metrics.totalExpenses },
      { 'Business Metric': 'Net Profit / Loss', 'Amount': metrics.netProfit }
    ];

    const plData = [
      ...metrics.incomeHeads.map(head => ({
        'Category': 'INCOME',
        'Head Name': head.name,
        'Opening Balance': head.opening,
        'Current Period': head.currentPeriod,
        'Total': head.total,
        '% Share': `${head.percentage}%`,
        'Entries': head.ledgerCount
      })),
      { 'Category': 'TOTAL INCOME', 'Head Name': '', 'Opening Balance': 0, 'Current Period': metrics.totalIncome, 'Total': metrics.totalIncome, '% Share': '100%', 'Entries': 0 },
      ...metrics.expenseHeads.map(head => ({
        'Category': 'EXPENSE',
        'Head Name': head.name,
        'Opening Balance': head.opening,
        'Current Period': head.currentPeriod,
        'Total': head.total,
        '% Share': `${head.percentage}%`,
        'Entries': head.ledgerCount
      })),
      { 'Category': 'TOTAL EXPENSES', 'Head Name': '', 'Opening Balance': 0, 'Current Period': metrics.totalExpenses, 'Total': metrics.totalExpenses, '% Share': '100%', 'Entries': 0 },
      { 'Category': 'NET PROFIT / LOSS', 'Head Name': '', 'Opening Balance': 0, 'Current Period': metrics.netProfit, 'Total': metrics.netProfit, '% Share': '—', 'Entries': 0 }
    ];

    const bsData = [
      { 'Section': 'ASSETS', 'Account Name': 'Loan Principal / Receivables', 'Amount': metrics.totalLoanPrincipal },
      { 'Section': 'ASSETS', 'Account Name': 'Cash in Hand (Closing Cash)', 'Amount': metrics.closingCash },
      ...bankAndOtherAssetAccounts.map(acc => ({
        'Section': 'ASSETS',
        'Account Name': acc.accountName,
        'Amount': Math.abs(acc.closing)
      })),
      { 'Section': 'TOTAL ASSETS', 'Account Name': '', 'Amount': metrics.totalAssets },
      ...capitalAccounts.map(acc => ({
        'Section': 'LIABILITIES & CAPITAL',
        'Account Name': acc.accountName,
        'Amount': acc.closing
      })),
      { 'Section': 'LIABILITIES & CAPITAL', 'Account Name': 'Retained Net Profit', 'Amount': metrics.netProfit },
      ...liabilityAccounts.map(acc => ({
        'Section': 'LIABILITIES & CAPITAL',
        'Account Name': acc.accountName,
        'Amount': Math.abs(acc.closing)
      })),
      { 'Section': 'TOTAL LIABILITIES & CAPITAL', 'Account Name': '', 'Amount': metrics.totalLiabilitiesAndCapital }
    ];

    const accountData = metrics.accounts.map((acc: FinalStatementAccount) => ({
      'Account Name': acc.accountName,
      'Category': acc.category,
      'Classification': acc.reportClassification,
      'Opening Balance': acc.opening,
      'Credit': acc.credit,
      'Debit': acc.debit,
      'Net Movement': acc.netMovement,
      'Closing Balance': acc.closing,
      'Entries': acc.ledgerCount
    }));

    const sheets = [
      { name: 'Financial Summary', data: summaryData },
      { name: 'Profit & Loss', data: plData },
      { name: 'Financial Position', data: bsData },
      { name: 'General Ledger Accounts', data: accountData }
    ];

    exportToExcelMultiSheet(sheets, `Final_Statement_${startDate}_to_${endDate}`);
    toast.success('Final Statement exported to Excel!');
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full select-none pb-8 px-1 sm:px-2 text-slate-900 font-sans">
      
      {/* Header Bar & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-sm gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">FINAL STATEMENT</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1 sm:mt-1.5">
            BUSINESS FINANCIAL SUMMARY
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={() => navigate(-1)} 
            variant="secondary" 
            size="sm" 
            icon={ArrowLeft} 
            className="h-[38px] min-w-[85px] justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Back
          </Button>
          <Button 
            onClick={fetchStatementData} 
            variant="secondary" 
            size="sm" 
            icon={RefreshCw} 
            className="h-[38px] min-w-[95px] justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Refresh
          </Button>
          <Button 
            onClick={() => setShowPrintPreview(true)} 
            variant="primary" 
            size="sm" 
            icon={Printer} 
            className="h-[38px] min-w-[85px] justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Print
          </Button>
          <Button 
            onClick={handleExportExcel} 
            variant="secondary" 
            size="sm" 
            icon={Download} 
            className="h-[38px] min-w-[85px] justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg uppercase font-bold text-xs shadow-sm"
          >
            Excel
          </Button>
        </div>
      </div>

      {/* Row 1: Date Range Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
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

      {/* Row 2: Top Business Summary KPI Cards (7 Important Business Totals - Responsive 4+3 Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-3.5">
        
        {/* ROW 1: 4 Cards (Total Assets, Total Liabilities, Total Capital, Net Worth) */}
        
        {/* Card 1: Total Assets */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-3 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/10 border border-emerald-200 hover:border-emerald-300 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Total Assets</span>
            <div className="p-1 rounded-md bg-emerald-100/70 text-emerald-700 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono text-emerald-800 tracking-tight leading-tight break-words tabular-nums ${getAdaptiveCardFontSize(metrics.totalAssets)}`}>
              {metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">All Business Assets</span>
          </div>
        </div>

        {/* Card 2: Total Liabilities */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-3 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/10 border border-amber-200 hover:border-amber-300 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Total Liabilities</span>
            <div className="p-1 rounded-md bg-amber-100/70 text-amber-700 shrink-0">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono text-amber-800 tracking-tight leading-tight break-words tabular-nums ${getAdaptiveCardFontSize(metrics.totalLiabilities)}`}>
              {metrics.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">External Dues</span>
          </div>
        </div>

        {/* Card 3: Total Capital */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-3 bg-gradient-to-br from-purple-50/40 via-white to-purple-50/10 border border-purple-200 hover:border-purple-300 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">Total Capital</span>
            <div className="p-1 rounded-md bg-purple-100/70 text-purple-700 shrink-0">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono text-purple-900 tracking-tight leading-tight break-words tabular-nums ${getAdaptiveCardFontSize(metrics.totalCapital)}`}>
              {metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">Contributed Capital</span>
          </div>
        </div>

        {/* Card 4: Net Worth */}
        <div className={`col-span-1 sm:col-span-1 lg:col-span-3 bg-gradient-to-br ${metrics.netWorth >= 0 ? 'from-blue-50/40 via-white to-blue-50/10 border-blue-200 hover:border-blue-300' : 'from-rose-50/40 via-white to-rose-50/10 border-rose-200 hover:border-rose-300'} border rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all`}>
          <div className="flex justify-between items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${metrics.netWorth >= 0 ? 'text-blue-800' : 'text-rose-700'}`}>
              Net Worth
            </span>
            <div className={`p-1 rounded-md shrink-0 ${metrics.netWorth >= 0 ? 'bg-blue-100/70 text-blue-700' : 'bg-rose-100/70 text-rose-700'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono tracking-tight leading-tight break-words tabular-nums ${metrics.netWorth >= 0 ? 'text-blue-900' : 'text-rose-700'} ${getAdaptiveCardFontSize(metrics.netWorth)}`}>
              {metrics.netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">Assets - Liabilities</span>
          </div>
        </div>

        {/* ROW 2: 3 Cards (Opening Cash, Closing Cash, Profit / Loss) */}
        
        {/* Card 5: Opening Cash */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-4 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/20 border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate">Opening Cash</span>
            <div className="p-1 rounded-md bg-slate-100 text-slate-600 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono text-slate-800 tracking-tight leading-tight break-words tabular-nums ${getAdaptiveCardFontSize(metrics.openingCash)}`}>
              {metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">At Start of Period</span>
          </div>
        </div>

        {/* Card 6: Closing Cash */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-4 bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/10 border border-indigo-200 hover:border-indigo-300 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 truncate">Closing Cash</span>
            <div className="p-1 rounded-md bg-indigo-100/70 text-indigo-700 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono text-indigo-950 tracking-tight leading-tight break-words tabular-nums ${getAdaptiveCardFontSize(metrics.closingCash)}`}>
              {metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">Cash in Hand</span>
          </div>
        </div>

        {/* Card 7: Profit / Loss */}
        <div className={`col-span-1 sm:col-span-2 lg:col-span-4 bg-gradient-to-br ${metrics.netProfit >= 0 ? 'from-emerald-50/50 via-white to-emerald-50/20 border-emerald-200 hover:border-emerald-300' : 'from-rose-50/50 via-white to-rose-50/20 border-rose-200 hover:border-rose-300'} border rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px] h-full transition-all`}>
          <div className="flex justify-between items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${metrics.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
              Profit / Loss
            </span>
            <div className={`p-1 rounded-md shrink-0 ${metrics.netProfit >= 0 ? 'bg-emerald-100/70 text-emerald-700' : 'bg-rose-100/70 text-rose-700'}`}>
              {metrics.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-right mt-2">
            <div className={`font-black font-mono tracking-tight leading-tight break-words tabular-nums ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'} ${getAdaptiveCardFontSize(metrics.netProfit)}`}>
              {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">Period Surplus / Deficit</span>
          </div>
        </div>

      </div>

      {/* SECTION 1: BUSINESS FINANCIAL POSITION (Balance Sheet Overview) */}
      <div className="space-y-2.5 sm:space-y-3 pt-1">
        <div className="flex items-center justify-between px-0.5 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h2 className="text-sm sm:text-base font-black uppercase text-slate-900 tracking-tight">
              BUSINESS FINANCIAL POSITION
            </h2>
          </div>
          <span className="text-xs font-bold uppercase text-slate-500">
            Assets, Liabilities &amp; Capital
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 bg-white rounded-xl border border-slate-200">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-stretch">
            
            {/* ASSETS SUMMARY BOX */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between h-full">
              <div className="p-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  Assets &amp; Receivables
                </h3>
                <span className="font-mono font-black text-blue-900 text-xs sm:text-sm">
                  {metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3.5 sm:p-4 space-y-2.5 font-mono text-xs flex-1">
                
                {/* Loan Principal Receivables */}
                <div className="p-3 rounded-lg bg-blue-50/40 border border-blue-100 flex justify-between items-center gap-2">
                  <div>
                    <div className="font-sans font-bold text-slate-900 uppercase">Loan Principal / Receivables</div>
                    <div className="text-[11px] text-slate-500 font-sans mt-0.5">Debit = Disbursed | Credit = Repaid</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-blue-900 text-sm sm:text-base tabular-nums">
                      {metrics.totalLoanPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-blue-700 font-sans font-bold">Outstanding Asset</div>
                  </div>
                </div>

                {/* Cash in Hand */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
                  <div>
                    <div className="font-sans font-bold text-slate-900 uppercase">Cash in Hand (Closing Cash)</div>
                    <div className="text-[11px] text-slate-500 font-sans mt-0.5">Opening: {metrics.openingCash.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="text-right shrink-0 font-black text-slate-900 text-sm sm:text-base tabular-nums">
                    {metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Bank & Other Assets */}
                {bankAndOtherAssetAccounts.map((acc, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
                    <div>
                      <div className="font-sans font-bold text-slate-900 uppercase">{acc.accountName}</div>
                      <div className="text-[11px] text-slate-500 font-sans mt-0.5">Asset Account</div>
                    </div>
                    <div className="text-right shrink-0 font-black text-slate-900 text-sm sm:text-base tabular-nums">
                      {Math.abs(acc.closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}

              </div>
              <div className="p-3 sm:p-3.5 bg-slate-100/80 border-t border-slate-200 flex justify-between items-center font-mono font-black text-xs">
                <span className="font-sans font-bold uppercase text-slate-700">TOTAL ASSETS</span>
                <span className="text-blue-900 text-sm sm:text-base tabular-nums">{metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* LIABILITIES & CAPITAL SUMMARY BOX */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between h-full">
              <div className="p-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  Liabilities &amp; Capital
                </h3>
                <span className="font-mono font-black text-purple-900 text-xs sm:text-sm">
                  {metrics.totalLiabilitiesAndCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3.5 sm:p-4 space-y-2.5 font-mono text-xs flex-1">
                
                {/* Capital Contributed */}
                <div className="p-3 rounded-lg bg-purple-50/40 border border-purple-100 flex justify-between items-center gap-2">
                  <div>
                    <div className="font-sans font-bold text-slate-900 uppercase">Capital Accounts</div>
                    <div className="text-[11px] text-slate-500 font-sans mt-0.5">Total Contributed Capital</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-purple-900 text-sm sm:text-base tabular-nums">
                      {metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-purple-700 font-sans font-bold">Equity / Capital</div>
                  </div>
                </div>

                {/* Net Period Profit */}
                <div className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-100 flex justify-between items-center gap-2">
                  <div>
                    <div className="font-sans font-bold text-slate-900 uppercase">Current Period Net Profit</div>
                    <div className="text-[11px] text-slate-500 font-sans mt-0.5">Total Income - Total Expenses</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-black text-sm sm:text-base tabular-nums ${metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-sans font-bold">Retained Surplus</div>
                  </div>
                </div>

                {/* Other Liabilities */}
                {liabilityAccounts.map((acc, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
                    <div>
                      <div className="font-sans font-bold text-slate-900 uppercase">{acc.accountName}</div>
                      <div className="text-[11px] text-slate-500 font-sans mt-0.5">Liability Account</div>
                    </div>
                    <div className="text-right shrink-0 font-black text-slate-900 text-sm sm:text-base tabular-nums">
                      {Math.abs(acc.closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}

              </div>
              <div className="p-3 sm:p-3.5 bg-slate-100/80 border-t border-slate-200 flex justify-between items-center font-mono font-black text-xs">
                <span className="font-sans font-bold uppercase text-slate-700">TOTAL LIABILITIES &amp; CAPITAL</span>
                <span className="text-purple-900 text-sm sm:text-base tabular-nums">{metrics.totalLiabilitiesAndCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* SECTION 2: PROFIT / LOSS SUMMARY */}
      <div className="space-y-2.5 sm:space-y-3 pt-1">
        <div className="flex items-center justify-between px-0.5 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <h2 className="text-sm sm:text-base font-black uppercase text-slate-900 tracking-tight">
              PROFIT / LOSS SUMMARY
            </h2>
          </div>
          <span className="text-xs font-bold uppercase text-slate-500">
            Operating Income vs Expenses
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 bg-white rounded-xl border border-slate-200">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-stretch">
            
            {/* Income Heads */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between h-full">
              <div className="p-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Income Heads (Interest, Penalty, etc.)
                </h3>
                <span className="font-mono font-black text-emerald-700 text-xs sm:text-sm">
                  {metrics.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 sm:p-3.5 space-y-2 font-mono text-xs flex-1 max-h-[300px] overflow-y-auto">
                {metrics.incomeHeads.map((head: FinalStatementPLHead, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-emerald-50/30 border border-emerald-100 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-sans font-bold text-slate-900 uppercase">{head.name}</span>
                      <span className="text-[10px] text-slate-500 font-sans block">{head.percentage}% of total income</span>
                    </div>
                    <span className="font-black text-emerald-700 shrink-0 tabular-nums">
                      {head.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                {metrics.incomeHeads.length === 0 && (
                  <div className="text-center py-6 text-slate-400 font-bold uppercase italic">No income recorded</div>
                )}
              </div>
              <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-mono font-black text-xs">
                <span className="font-sans font-bold uppercase text-slate-700">TOTAL INCOME</span>
                <span className="text-emerald-700 tabular-nums">{metrics.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Expense Heads */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between h-full">
              <div className="p-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                  Expense Heads (Operating Expenses)
                </h3>
                <span className="font-mono font-black text-rose-700 text-xs sm:text-sm">
                  {metrics.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 sm:p-3.5 space-y-2 font-mono text-xs flex-1 max-h-[300px] overflow-y-auto">
                {metrics.expenseHeads.map((head: FinalStatementPLHead, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-rose-50/30 border border-rose-100 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-sans font-bold text-slate-900 uppercase">{head.name}</span>
                      <span className="text-[10px] text-slate-500 font-sans block">{head.percentage}% of total expenses</span>
                    </div>
                    <span className="font-black text-rose-700 shrink-0 tabular-nums">
                      {head.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                {metrics.expenseHeads.length === 0 && (
                  <div className="text-center py-6 text-slate-400 font-bold uppercase italic">No expenses recorded</div>
                )}
              </div>
              <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-mono font-black text-xs">
                <span className="font-sans font-bold uppercase text-slate-700">TOTAL EXPENSES</span>
                <span className="text-rose-700 tabular-nums">{metrics.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* SECTION 3: GENERAL LEDGER ACCOUNT SUMMARY (BUSINESS ACCOUNTS) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-0.5 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-black uppercase text-slate-900 tracking-tight">
              GENERAL LEDGER ACCOUNT SUMMARY
            </h2>
          </div>
          <span className="text-xs font-bold uppercase text-slate-500">
            {metrics.accounts.length} Accounts Listed
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
                      {metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 whitespace-nowrap">
                      {metrics.totalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-700 whitespace-nowrap">
                      {metrics.totalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                      {(metrics.totalInflows - metrics.totalOutflows).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                      {metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

                  {metrics.accounts.map((acc: FinalStatementAccount) => {
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
                              acc.category === 'CAPITAL' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              acc.category === 'INCOME' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              acc.category === 'EXPENSE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
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

      {/* Complete Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Final Statement"
        documentTitle={`FINAL STATEMENT: ${formatDateOld(startDate)} TO ${formatDateOld(endDate)}`}
      >
        <div className="space-y-6 pb-8 font-sans text-slate-900 text-[10px]">
          
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-3">
            <h1 className="text-lg font-black uppercase text-slate-900">TIRUMALA FINANCE</h1>
            <h2 className="text-sm font-bold uppercase text-slate-700 mt-0.5">FINAL STATEMENT</h2>
            <p className="text-[10px] text-slate-500 uppercase font-mono mt-1">Period: {formatDateOld(startDate)} To {formatDateOld(endDate)}</p>
          </div>

          {/* A. FINANCIAL SUMMARY */}
          <div className="space-y-2">
            <div className="bg-slate-100 p-1.5 font-black uppercase tracking-wider text-slate-900 border-l-4 border-slate-900 text-[11px]">
              A. FINANCIAL SUMMARY
            </div>
            <div className="grid grid-cols-4 gap-2.5 border border-slate-900 p-2 text-center text-[9px] font-bold uppercase bg-slate-50 font-mono">
              <div>
                <span className="block text-[8px] text-slate-500 font-sans">Total Assets</span>
                <span className="text-blue-900 font-black">{metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-500 font-sans">Total Liabilities</span>
                <span className="text-amber-800 font-black">{metrics.totalLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-500 font-sans">Total Capital</span>
                <span className="text-purple-900 font-black">{metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-500 font-sans">Net Worth</span>
                <span className="text-slate-900 font-black">{metrics.netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-1 mt-1">
                <span className="block text-[8px] text-slate-500 font-sans">Opening Cash</span>
                <span className="text-slate-800 font-black">{metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-1 mt-1">
                <span className="block text-[8px] text-slate-500 font-sans">Closing Cash</span>
                <span className="text-slate-900 font-black">{metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-1 mt-1 col-span-2">
                <span className="block text-[8px] text-slate-500 font-sans">Profit / Loss</span>
                <span className={metrics.netProfit >= 0 ? 'text-emerald-800 font-black' : 'text-rose-800 font-black'}>
                  {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* B. PROFIT & LOSS */}
          <div className="space-y-2">
            <div className="bg-slate-100 p-1.5 font-black uppercase tracking-wider text-slate-900 border-l-4 border-slate-900 text-[11px]">
              B. PROFIT &amp; LOSS
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="border-b border-emerald-800 pb-0.5 font-bold text-emerald-900 uppercase text-[9px]">Income Accounts</div>
                <table className="w-full text-left mt-1 border-collapse font-mono text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-300 font-sans font-bold text-slate-600 uppercase">
                      <th className="py-0.5">Head</th>
                      <th className="py-0.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.incomeHeads.map((h, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-0.5 uppercase font-bold">{h.name}</td>
                        <td className="py-0.5 text-right text-emerald-800 font-bold">{h.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold bg-slate-50">
                      <td className="py-1 uppercase">TOTAL INCOME</td>
                      <td className="py-1 text-right text-emerald-800 font-black">{metrics.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div className="border-b border-rose-800 pb-0.5 font-bold text-rose-900 uppercase text-[9px]">Expense Accounts</div>
                <table className="w-full text-left mt-1 border-collapse font-mono text-[9px]">
                  <thead>
                    <tr className="border-b border-slate-300 font-sans font-bold text-slate-600 uppercase">
                      <th className="py-0.5">Head</th>
                      <th className="py-0.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.expenseHeads.map((h, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-0.5 uppercase font-bold">{h.name}</td>
                        <td className="py-0.5 text-right text-rose-800 font-bold">{h.currentPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold bg-slate-50">
                      <td className="py-1 uppercase">TOTAL EXPENSES</td>
                      <td className="py-1 text-right text-rose-800 font-black">{metrics.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-right font-mono font-black border-t pt-1 text-[10px]">
              <span className="font-sans font-bold uppercase text-slate-700 mr-2">NET PROFIT / LOSS:</span>
              <span className={metrics.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                {metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* C. BALANCE SHEET / FINANCIAL POSITION */}
          <div className="space-y-2">
            <div className="bg-slate-100 p-1.5 font-black uppercase tracking-wider text-slate-900 border-l-4 border-slate-900 text-[11px]">
              C. BALANCE SHEET / FINANCIAL POSITION
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="border-b border-blue-800 pb-0.5 font-bold text-blue-900 uppercase text-[9px]">Assets</div>
                <table className="w-full text-left mt-1 border-collapse font-mono text-[9px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-0.5 uppercase font-bold">Loan Principal / Receivables</td>
                      <td className="py-0.5 text-right text-blue-900 font-bold">{metrics.totalLoanPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-0.5 uppercase font-bold">Cash in Hand</td>
                      <td className="py-0.5 text-right font-bold">{metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {bankAndOtherAssetAccounts.map((a, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-0.5 uppercase font-bold">{a.accountName}</td>
                        <td className="py-0.5 text-right font-bold">{Math.abs(a.closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold bg-slate-50">
                      <td className="py-1 uppercase">TOTAL ASSETS</td>
                      <td className="py-1 text-right text-blue-900 font-black">{metrics.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div className="border-b border-purple-800 pb-0.5 font-bold text-purple-900 uppercase text-[9px]">Liabilities &amp; Capital</div>
                <table className="w-full text-left mt-1 border-collapse font-mono text-[9px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-0.5 uppercase font-bold">Capital</td>
                      <td className="py-0.5 text-right text-purple-900 font-bold">{metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-0.5 uppercase font-bold">Retained Net Profit</td>
                      <td className={`py-0.5 text-right font-bold ${metrics.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {liabilityAccounts.map((a, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-0.5 uppercase font-bold">{a.accountName}</td>
                        <td className="py-0.5 text-right font-bold">{Math.abs(a.closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold bg-slate-50">
                      <td className="py-1 uppercase">TOTAL LIABILITIES &amp; CAPITAL</td>
                      <td className="py-1 text-right text-purple-900 font-black">{metrics.totalLiabilitiesAndCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* D. GENERAL LEDGER ACCOUNT SUMMARY */}
          <div className="space-y-2">
            <div className="bg-slate-100 p-1.5 font-black uppercase tracking-wider text-slate-900 border-l-4 border-slate-900 text-[11px]">
              D. GENERAL LEDGER ACCOUNT SUMMARY
            </div>
            <table className="w-full text-left border-collapse font-mono text-[9px]">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50 font-sans font-bold text-slate-700 uppercase">
                  <th className="p-1 border-r border-slate-300">Account Name</th>
                  <th className="p-1 border-r border-slate-300 text-center">Category</th>
                  <th className="p-1 border-r border-slate-300 text-right">Opening</th>
                  <th className="p-1 border-r border-slate-300 text-right">Credit</th>
                  <th className="p-1 border-r border-slate-300 text-right">Debit</th>
                  <th className="p-1 border-r border-slate-300 text-right">Net Movement</th>
                  <th className="p-1 text-right font-black">Closing</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                  <td className="p-1 border-r border-slate-200 uppercase">CASH &amp; BANK</td>
                  <td className="p-1 border-r border-slate-200 text-center">ASSET</td>
                  <td className="p-1 border-r border-slate-200 text-right">{metrics.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1 border-r border-slate-200 text-right">{metrics.totalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1 border-r border-slate-200 text-right">{metrics.totalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1 border-r border-slate-200 text-right">{(metrics.totalInflows - metrics.totalOutflows).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1 text-right font-black">{metrics.closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                {metrics.accounts.map((acc: FinalStatementAccount, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-1 border-r border-slate-200 uppercase font-bold">{acc.accountName}</td>
                    <td className="p-1 border-r border-slate-200 text-center">{acc.category}</td>
                    <td className="p-1 border-r border-slate-200 text-right">{acc.opening !== 0 ? acc.opening.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="p-1 border-r border-slate-200 text-right">{acc.credit > 0 ? acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="p-1 border-r border-slate-200 text-right">{acc.debit > 0 ? acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="p-1 border-r border-slate-200 text-right">{acc.netMovement !== 0 ? acc.netMovement.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="p-1 text-right font-black">{acc.closing.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
