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
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">CALCULATOR</span>
          </div>
          <h1 className="mt-1 finance-h1">GENERAL CALCULATOR</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            TRY ANY LEDGER'S MATH. RATE DEFAULTS COME FROM SETTINGS → LEDGERS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
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
              <span className="text-slate-900 finance-header-time uppercase">INPUTS</span>
              <span className="px-2 py-0.5 text-[9px] bg-slate-100 text-slate-800 border border-slate-200 rounded finance-input uppercase">
                {loanType}
              </span>
            </div>
          }
          subtitle={
            <span className="text-slate-400 finance-small-label uppercase">
              {LOAN_LABELS[loanType] || 'CASH DEPOSIT (CD)'}
            </span>
          }
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="space-y-4">
            
            {/* Loan Type Selector */}
            <div>
              <label className="finance-caption uppercase">
                LOAN TYPE
              </label>
              <select
                value={loanType}
                onChange={(e) => handleLoanTypeChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
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
                <label className="finance-caption uppercase">
                  PRINCIPAL (₹)
                </label>
                <input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  DATE
                </label>
                <input
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                />
              </div>
            </div>

            {/* Period Days & Interest Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="finance-caption uppercase">
                  PERIOD (DAYS)
                </label>
                <input
                  type="number"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  RATE (% / MONTH)
                </label>
                <input
                  type="number"
                  step="any"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                />
              </div>
            </div>

            {/* Overdue Rate & Amount Paid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="finance-caption uppercase">
                  OVERDUE (% / MONTH)
                </label>
                <input
                  type="number"
                  step="any"
                  value={overdue}
                  onChange={(e) => setOverdue(e.target.value)}
                  placeholder="e.g. 0.75"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  AMOUNT PAID (₹)
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="e.g. 0.00"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                />
              </div>
            </div>

            {/* Document Charges */}
            <div>
              <label className="finance-caption uppercase">
                DOCUMENT (₹)
              </label>
              <input
                type="number"
                value={documentVal}
                onChange={(e) => setDocumentVal(e.target.value)}
                placeholder="e.g. 100"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
              />
            </div>

            {/* Payout Box Banner */}
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg p-3 flex justify-between items-center finance-header-time uppercase">
              <span>PAYOUT  ₹{calculation.payout.toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-emerald-600 finance-input">= PRINCIPAL – DOCUMENT</span>
            </div>

          </div>
        </Card>

        {/* Right Column: Summary Card */}
        <Card
          title={
            <span className="text-slate-900 finance-header-time uppercase">
              SUMMARY
            </span>
          }
          subtitle={
            <span className="text-slate-400 finance-small-label uppercase">
              LIVE CALCULATION USING THE SAME ENGINE AS THE LEDGERS
            </span>
          }
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="grid grid-cols-2 gap-4">
            
            {/* Period Days Elapsed */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block finance-small-label uppercase">
                PERIOD (DAYS)
              </span>
              <span className="font-mono mt-1 text-slate-900 block finance-h1">
                {calculation.daysElapsed}
              </span>
            </div>

            {/* Calculated Interest */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block finance-small-label uppercase">
                INTEREST
              </span>
              <span className="font-mono mt-1 text-red-650 block finance-h1">
                ₹{calculation.interest.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Overdue Penalty */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block finance-small-label uppercase">
                PENALTY
              </span>
              <span className="font-mono mt-1 text-red-650 block finance-h1">
                ₹{calculation.penalty.toLocaleString('en-IN')}
              </span>
              {calculation.overdueDays > 0 && (
                <span className="text-[8px] text-red-500 block mt-0.5 finance-input uppercase">
                  {calculation.overdueDays} DAYS OVERDUE
                </span>
              )}
            </div>

            {/* Amount Paid */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block finance-small-label uppercase">
                AMOUNT PAID
              </span>
              <span className="font-mono mt-1 text-emerald-650 block finance-h1">
                ₹{(parseFloat(amountPaid) || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Total Balance */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 col-span-2">
              <span className="text-slate-400 block finance-small-label uppercase">
                TOTAL BALANCE
              </span>
              <span className="font-mono mt-1 text-slate-900 block finance-h1">
                ₹{calculation.totalBalance.toLocaleString('en-IN')}
              </span>
            </div>

            {/* For Close */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 col-span-2">
              <span className="text-slate-400 block finance-small-label uppercase">
                FOR CLOSE
              </span>
              <span className="font-mono mt-1 text-slate-900 block finance-h1">
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
          <h2 className="finance-brand">TIRUMALA FINANCE</h2>
          <p className="mt-1 finance-header-time uppercase">GENERAL CALCULATOR LEDGER SIMULATION</p>
          <p className="text-slate-600 mt-0.5 finance-small-label">
            PRINTED DATE: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Simulation Details Table */}
        <div className="my-6">
          <h3 className="mb-2 border-b border-slate-300 pb-1 finance-header-time uppercase">1. SIMULATION INPUTS</h3>
          <table className="min-w-full border border-slate-300 finance-caption">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">LOAN TYPE</td>
                <td className="px-3 py-2 finance-input uppercase">{LOAN_LABELS[loanType] || loanType}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">PRINCIPAL</td>
                <td className="px-3 py-2 font-mono finance-input">₹{(parseFloat(principal) || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">DISBURSAL DATE</td>
                <td className="px-3 py-2 finance-input">{loanDate.split('-').reverse().join('/')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">LOAN PERIOD</td>
                <td className="px-3 py-2 finance-input">{periodDays} DAYS</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">INTEREST RATE</td>
                <td className="px-3 py-2 finance-input">{rate}% / MONTH</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">OVERDUE RATE</td>
                <td className="px-3 py-2 finance-input">{overdue}% / MONTH</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">DOCUMENT CHARGES</td>
                <td className="px-3 py-2 font-mono finance-input">₹{(parseFloat(documentVal) || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">PAYOUT DISBURSED</td>
                <td className="px-3 py-2 font-mono text-emerald-700 finance-input">₹{calculation.payout.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Simulation Summary Table */}
        <div className="my-6">
          <h3 className="mb-2 border-b border-slate-300 pb-1 finance-header-time uppercase">2. CALCULATION SUMMARY</h3>
          <table className="min-w-full border border-slate-300 finance-caption">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">DAYS ELAPSED</td>
                <td className="px-3 py-2 finance-input">{calculation.daysElapsed} DAYS</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">INTEREST ACCRUED</td>
                <td className="px-3 py-2 font-mono finance-input">₹{calculation.interest.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">PENALTY CHARGED</td>
                <td className="px-3 py-2 font-mono finance-input">
                  ₹{calculation.penalty.toLocaleString('en-IN')} 
                  {calculation.overdueDays > 0 && ` (${calculation.overdueDays} days overdue)`}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">AMOUNT PAID SO FAR</td>
                <td className="px-3 py-2 font-mono finance-input">₹{(parseFloat(amountPaid) || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 finance-input">TOTAL OUTSTANDING</td>
                <td className="px-3 py-2 font-mono text-red-700 finance-input">₹{calculation.totalBalance.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 px-3 py-2 w-1/3 border-r border-slate-300 font-sans finance-input">FOR CLOSE AMOUNT</td>
                <td className="px-3 py-2 font-mono text-slate-900 finance-input">₹{calculation.forClose.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-center mt-20 pt-8 border-t border-slate-300 finance-header-time uppercase">
          <div>
            <p>CUSTOMER SIGNATURE</p>
            <p className="text-slate-400 mt-8 finance-small-label">VERIFIED INTEREST DETAILS</p>
          </div>
          <div className="text-right">
            <p>AUDITED BY FINANCE CLERK</p>
            <p className="text-slate-400 mt-8 finance-small-label">THIRUMALA GROUP OFFICIAL</p>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default GeneralCalculator;
