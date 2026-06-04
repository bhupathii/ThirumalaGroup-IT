import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import { 
  ArrowLeft, 
  Printer 
} from 'lucide-react';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

import { financeLedgerSettingsService, DEFAULT_LEDGER_SETTINGS } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
import { FinanceLedgerSetting } from '../../lib/supabaseFinance';

const LOAN_LABELS: Record<string, string> = {
  'CD': 'CASH DEPOSIT (CD)',
  'HP': 'HIRE PURCHASE (HP)',
  'STBD': 'SHORT TERM BUSINESS DEPOSIT (STBD)',
  'TBD': 'TERM BUSINESS DEPOSIT (TBD)'
};

const GeneralCalculator: React.FC = () => {
  const navigate = useNavigate();

  // Inputs State
  const [loanType, setLoanType] = useState<string>('CD');
  const [principal, setPrincipal] = useState<string>('100000');
  const [loanDate, setLoanDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [periodDays, setPeriodDays] = useState<string>('100');
  const [rate, setRate] = useState<string>('3');
  const [overdue, setOverdue] = useState<string>('0.75');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [documentVal, setDocumentVal] = useState<string>('100');

  // Print Preview Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [ledgerSettings, setLedgerSettings] = useState<Record<string, FinanceLedgerSetting>>(DEFAULT_LEDGER_SETTINGS);

  useEffect(() => {
    const fetchSettings = async () => {
      const settings = await financeLedgerSettingsService.getAllLedgerSettings();
      setLedgerSettings(settings);
      
      // Update inputs for current loanType if they haven't been manually typed yet
      const activeSetting = settings[loanType] || DEFAULT_LEDGER_SETTINGS[loanType];
      if (activeSetting) {
        setRate(String(activeSetting.rate));
        setOverdue(String(activeSetting.overdue));
      }
    };
    fetchSettings();
  }, []);

  // Update rates when loan type changes
  const handleLoanTypeChange = (type: string) => {
    setLoanType(type);
    const defaults = ledgerSettings[type] || DEFAULT_LEDGER_SETTINGS[type];
    if (defaults) {
      setRate(String(defaults.rate));
      setOverdue(String(defaults.overdue));
    }
  };

  // Perform Live Calculation Math
  const calculation = useMemo(() => {
    const P = parseFloat(principal) || 0;
    const doc = parseFloat(documentVal) || 0;
    const ratePerMonth = parseFloat(rate) || 0;
    const overdueRatePerMonth = parseFloat(overdue) || 0;
    const paid = parseFloat(amountPaid) || 0;
    const periodLimitDays = parseInt(periodDays) || 0;

    // Days elapsed from loanDate to Today
    const loanDateObj = new Date(loanDate);
    const todayObj = new Date();
    
    // Set time portion to midnight for date diff
    loanDateObj.setHours(0, 0, 0, 0);
    todayObj.setHours(0, 0, 0, 0);

    const diffTime = todayObj.getTime() - loanDateObj.getTime();
    const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate using financeCalculationService logic
    // Interest = Principal * (Rate / 100) * (Days Elapsed / 30) (or via formula in service)
    const activeSetting = ledgerSettings[loanType] || DEFAULT_LEDGER_SETTINGS[loanType];
    
    // Create an ephemeral setting using the manual input rates (so the calculator remains a 'what if' calculator)
    const currentSetting: FinanceLedgerSetting = {
      ...activeSetting,
      rate: ratePerMonth,
      overdue: overdueRatePerMonth
    };

    const interest = financeCalculationService.calculateInterestFromSetting(P, daysElapsed, currentSetting);
    
    // Overdue Penalty: depends on Overdue %, and overdue days if available
    const overdueDays = Math.max(0, daysElapsed - periodLimitDays);
    const penalty = financeCalculationService.calculatePenaltyFromSetting(P, overdueDays, currentSetting);

    const totalBalance = P + interest + penalty - paid;
    const forClose = totalBalance;
    const payout = P - doc;

    return {
      daysElapsed,
      interest: Math.round(interest),
      penalty: Math.round(penalty),
      totalBalance: Math.round(totalBalance),
      forClose: Math.round(forClose),
      payout: Math.round(payout),
      overdueDays
    };
  }, [principal, loanDate, periodDays, rate, overdue, amountPaid, documentVal, ledgerSettings, loanType]);


  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none print:p-0">
      
      {/* Top Header Actions Bar */}
      <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 ${showPrintModal ? 'print:hidden' : 'no-print'}`}>
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">CALCULATOR</span>
          </div>
          <h1 className="finance-page-title mt-1">GENERAL CALCULATOR</h1>
          <p className="finance-page-subtitle mt-0.5">
            TRY ANY LEDGER'S MATH. RATE DEFAULTS COME FROM SETTINGS → LEDGERS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 finance-button-text bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 finance-button-text bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            PRINT
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${showPrintModal ? 'print:hidden' : 'no-print'}`}>
        
        {/* Left Column: Inputs Card */}
        <Card
          title={
            <div className="flex justify-between items-center w-full">
              <span className="text-xs font-black text-slate-900 tracking-wider uppercase">INPUTS</span>
              <span className="px-2 py-0.5 text-[9px] font-black bg-slate-100 text-slate-800 border border-slate-200 rounded uppercase tracking-wider">
                {loanType}
              </span>
            </div>
          }
          subtitle={
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
              {LOAN_LABELS[loanType] || 'CASH DEPOSIT (CD)'}
            </span>
          }
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="space-y-4">
            
            {/* Loan Type Selector */}
            <div>
              <label className="finance-label">
                LOAN TYPE
              </label>
              <select
                value={loanType}
                onChange={(e) => handleLoanTypeChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
              >
                <option value="CD">CASH DEPOSIT (CD)</option>
                <option value="HP">HIRE PURCHASE (HP)</option>
                <option value="STBD">SHORT TERM BUSINESS DEPOSIT (STBD)</option>
                <option value="TBD">TERM BUSINESS DEPOSIT (TBD)</option>
              </select>
            </div>

            {/* Principal & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="finance-label">
                  PRINCIPAL (₹)
                </label>
                <input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
                />
              </div>

              <div>
                <label className="finance-label">
                  DATE
                </label>
                <input
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
                />
              </div>
            </div>

            {/* Period Days & Interest Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="finance-label">
                  PERIOD (DAYS)
                </label>
                <input
                  type="number"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
                />
              </div>

              <div>
                <label className="finance-label">
                  RATE (% / MONTH)
                </label>
                <input
                  type="number"
                  step="any"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
                />
              </div>
            </div>

            {/* Overdue Rate & Amount Paid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="finance-label">
                  OVERDUE (% / MONTH)
                </label>
                <input
                  type="number"
                  step="any"
                  value={overdue}
                  onChange={(e) => setOverdue(e.target.value)}
                  placeholder="e.g. 0.75"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
                />
              </div>

              <div>
                <label className="finance-label">
                  AMOUNT PAID (₹)
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="e.g. 0.00"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
                />
              </div>
            </div>

            {/* Document Charges */}
            <div>
              <label className="finance-label">
                DOCUMENT (₹)
              </label>
              <input
                type="number"
                value={documentVal}
                onChange={(e) => setDocumentVal(e.target.value)}
                placeholder="e.g. 100"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm"
              />
            </div>

            {/* Payout Box Banner */}
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg p-3 flex justify-between items-center text-xs font-black uppercase tracking-widest">
              <span>PAYOUT  ₹{calculation.payout.toLocaleString('en-IN')}</span>
              <span className="text-[9px] font-bold text-emerald-600">= PRINCIPAL – DOCUMENT</span>
            </div>

          </div>
        </Card>

        {/* Right Column: Summary Card */}
        <Card
          title={
            <span className="text-xs font-black text-slate-900 tracking-wider uppercase">
              SUMMARY
            </span>
          }
          subtitle={
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
              LIVE CALCULATION USING THE SAME ENGINE AS THE LEDGERS
            </span>
          }
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="grid grid-cols-2 gap-4">
            
            {/* Period Days Elapsed */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                PERIOD (DAYS)
              </span>
              <span className="text-xl font-black font-mono tracking-tight mt-1 text-slate-900 block">
                {calculation.daysElapsed}
              </span>
            </div>

            {/* Calculated Interest */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                INTEREST
              </span>
              <span className="text-xl font-black font-mono tracking-tight mt-1 text-red-650 block">
                ₹{calculation.interest.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Overdue Penalty */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                PENALTY
              </span>
              <span className="text-xl font-black font-mono tracking-tight mt-1 text-red-650 block">
                ₹{calculation.penalty.toLocaleString('en-IN')}
              </span>
              {calculation.overdueDays > 0 && (
                <span className="text-[8px] font-bold text-red-500 uppercase tracking-wider block mt-0.5">
                  {calculation.overdueDays} DAYS OVERDUE
                </span>
              )}
            </div>

            {/* Amount Paid */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                AMOUNT PAID
              </span>
              <span className="text-xl font-black font-mono tracking-tight mt-1 text-emerald-650 block">
                ₹{(parseFloat(amountPaid) || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Total Balance */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 col-span-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                TOTAL BALANCE
              </span>
              <span className="text-xl font-black font-mono tracking-tight mt-1 text-slate-900 block">
                ₹{calculation.totalBalance.toLocaleString('en-IN')}
              </span>
            </div>

            {/* For Close */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 col-span-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                FOR CLOSE
              </span>
              <span className="text-xl font-black font-mono tracking-tight mt-1 text-slate-900 block">
                ₹{calculation.forClose.toLocaleString('en-IN')}
              </span>
            </div>

          </div>
        </Card>

      </div>

      {/* MODAL: Print Preview Panel */}
      <FinancePrintPreview
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="General Calculator"
        documentTitle="GENERAL CALCULATOR LEDGER SIMULATION"
      >
        <div className="text-center pb-6 border-b-2 border-slate-900">
          <h2 className="text-lg font-black tracking-widest uppercase">TIRUMALA FINANCE</h2>
          <p className="text-xs font-bold uppercase tracking-wider mt-1">GENERAL CALCULATOR LEDGER SIMULATION</p>
          <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
            PRINTED DATE: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Simulation Details Table */}
        <div className="my-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-slate-300 pb-1">1. SIMULATION INPUTS</h3>
          <table className="min-w-full text-xs border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">LOAN TYPE</td>
                <td className="px-3 py-2 font-semibold uppercase">{LOAN_LABELS[loanType] || loanType}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">PRINCIPAL</td>
                <td className="px-3 py-2 font-mono font-bold">₹{(parseFloat(principal) || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">DISBURSAL DATE</td>
                <td className="px-3 py-2 font-semibold">{loanDate.split('-').reverse().join('/')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">LOAN PERIOD</td>
                <td className="px-3 py-2 font-semibold">{periodDays} DAYS</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">INTEREST RATE</td>
                <td className="px-3 py-2 font-semibold">{rate}% / MONTH</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">OVERDUE RATE</td>
                <td className="px-3 py-2 font-semibold">{overdue}% / MONTH</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">DOCUMENT CHARGES</td>
                <td className="px-3 py-2 font-mono font-semibold">₹{(parseFloat(documentVal) || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">PAYOUT DISBURSED</td>
                <td className="px-3 py-2 font-mono font-bold text-emerald-700">₹{calculation.payout.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Simulation Summary Table */}
        <div className="my-6">
          <h3 className="text-xs font-black uppercase tracking-wider mb-2 border-b border-slate-300 pb-1">2. CALCULATION SUMMARY</h3>
          <table className="min-w-full text-xs border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">DAYS ELAPSED</td>
                <td className="px-3 py-2 font-semibold">{calculation.daysElapsed} DAYS</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">INTEREST ACCRUED</td>
                <td className="px-3 py-2 font-mono font-semibold">₹{calculation.interest.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">PENALTY CHARGED</td>
                <td className="px-3 py-2 font-mono font-semibold">
                  ₹{calculation.penalty.toLocaleString('en-IN')} 
                  {calculation.overdueDays > 0 && ` (${calculation.overdueDays} days overdue)`}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">AMOUNT PAID SO FAR</td>
                <td className="px-3 py-2 font-mono font-semibold">₹{(parseFloat(amountPaid) || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300">TOTAL OUTSTANDING</td>
                <td className="px-3 py-2 font-mono font-bold text-red-700">₹{calculation.totalBalance.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 font-bold px-3 py-2 w-1/3 border-r border-slate-300 font-sans">FOR CLOSE AMOUNT</td>
                <td className="px-3 py-2 font-mono font-black text-slate-900">₹{calculation.forClose.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-center mt-20 pt-8 border-t border-slate-300 text-xs font-bold uppercase tracking-wider">
          <div>
            <p>CUSTOMER SIGNATURE</p>
            <p className="text-[10px] text-slate-400 mt-8">VERIFIED INTEREST DETAILS</p>
          </div>
          <div className="text-right">
            <p>AUDITED BY FINANCE CLERK</p>
            <p className="text-[10px] text-slate-400 mt-8">THIRUMALA GROUP OFFICIAL</p>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default GeneralCalculator;
