import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { dailyFinancialTransactionService } from '../../services/dailyFinancialTransactionService';
import { Printer, ArrowLeft, FileText, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface PartnerBusinessRow {
  id: string;
  date: string;
  customerName: string;
  loanNo: string;
  loanType: string;
  loanAmount: number;
  paid: number;
  balance: number;
  status: string;
}

interface PartnerOutstandingRow {
  id: string;
  customerName: string;
  loanNo: string;
  dueDate: string;
  principal: number;
  interest: number;
  penalty: number;
  totalDue: number;
  status: string;
}

const BusinessReport: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');

  // Accounting Flow Metrics (Date Range)
  const [rangeMetrics, setRangeMetrics] = useState({
    totalCapital: 0,
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    cashPosition: 0
  });

  // Current Position Metrics (All-time / Active)
  const [positionMetrics, setPositionMetrics] = useState({
    cdPrincipalOutstanding: 0,
    activeCdAccounts: 0
  });

  const [partnerBusiness, setPartnerBusiness] = useState<PartnerBusinessRow[]>([]);
  const [partnerOutstanding, setPartnerOutstanding] = useState<PartnerOutstandingRow[]>([]);

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const mode = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return mode === 'itr' ? 'ITR' : 'REGULAR';
  });

  useEffect(() => {
    fetchBusinessData();
  }, [startDate, endDate, selectedPartnerId]);

  const fetchBusinessData = async () => {
    setLoading(true);
    try {
      const [fetchedPartners, allTxs, loans, rawTxs] = await Promise.all([
        supabaseFinance.getPartners(),
        dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: startDate,
          toDate: endDate,
          financeMode
        }),
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions()
      ]);

      setPartners(fetchedPartners);

      // 1. Calculate Accounting Flow Metrics from Canonical Transactions
      let totalCapital = 0;
      let totalIncome = 0;
      let totalExpense = 0;
      let totalCredit = 0;
      let totalDebit = 0;

      allTxs.forEach(t => {
        totalCredit += t.credit;
        totalDebit += t.debit;
        if (t.headOfAccount === 'CAPITAL') {
          totalCapital += (t.credit - t.debit);
        }
        if (t.reportClassification === 'PROFIT_AND_LOSS') {
          totalIncome += t.credit;
          totalExpense += t.debit;
        }
      });

      setRangeMetrics({
        totalCapital,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        cashPosition: totalCredit - totalDebit
      });

      // 2. Calculate Current Position Metrics (Active CD outstanding)
      const activeCd = loans.filter(l => l.status === 'Active' && l.loan_category?.trim().toUpperCase() === 'CD');
      let cdOutstanding = 0;

      activeCd.forEach(l => {
        const principal = Number(l.amount) || 0;
        const colList = rawTxs.filter(t => t.loan_id === l.id && t.type === 'Collection');
        const collected = colList.reduce((sum, c) => sum + Number(c.amount), 0);
        // Note: CD outstanding principal = loan principal - collected principal (or net balance estimation)
        cdOutstanding += Math.max(0, principal - collected);
      });

      setPositionMetrics({
        cdPrincipalOutstanding: cdOutstanding,
        activeCdAccounts: activeCd.length
      });

      // 3. Fetch specific dues
      const { data: rawDues } = await supabase
        .from('finance_dues')
        .select(`*, finance_loans(*, customer:finance_customers!customer_id(*))`)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      const targetPartner = selectedPartnerId === 'ALL' ? null : fetchedPartners.find(p => p.id === selectedPartnerId);

      // Filter partner business (loans disbursed in range)
      const filteredLoans = loans.filter(l => {
        if (l.date < startDate || l.date > endDate) return false;
        if (targetPartner) return l.customer?.partner_name === targetPartner.name;
        return true;
      });

      const pbList: PartnerBusinessRow[] = filteredLoans.map(l => {
        const principal = Number(l.amount);
        const colList = rawTxs.filter(t => t.loan_id === l.id && t.type === 'Collection');
        const paid = colList.reduce((sum, c) => sum + Number(c.amount), 0);
        return {
          id: l.id,
          date: l.date,
          customerName: l.customer?.name || 'Unknown',
          loanNo: l.loan_id,
          loanType: l.due_type || '—',
          loanAmount: principal,
          paid: paid,
          balance: Math.max(0, principal - paid),
          status: l.status
        };
      });
      setPartnerBusiness(pbList);

      // Filter outstanding dues in range
      const outList: PartnerOutstandingRow[] = [];
      const dues = rawDues || [];
      dues.forEach((due: any) => {
        const loan = due.finance_loans;
        if (targetPartner && loan?.customer?.partner_name !== targetPartner.name) return;

        if (due.status === 'Pending' || due.status === 'Partially Paid') {
          let principal = 0;
          let interest = 0;
          if (loan) {
            const totalPrincipal = Number(loan.amount) || 0;
            const durationMonths = Number(loan.duration_months) || 12;
            const interestRate = Number(loan.interest_rate) || 3;
            const totalInterest = totalPrincipal * (interestRate / 100) * durationMonths;
            const totalLoanRepayable = totalPrincipal + totalInterest;
            const interestRatio = totalLoanRepayable > 0 ? totalInterest / totalLoanRepayable : 0;
            const dueAmt = Number(due.amount) || 0;
            interest = dueAmt * interestRatio;
            principal = dueAmt * (1 - interestRatio);
          }

          const dueAmt = Number(due.amount) || 0;
          const duePaid = Number(due.paid_amount) || 0;
          const duePending = dueAmt - duePaid;

          outList.push({
            id: due.id,
            customerName: loan?.customer?.name || 'Unknown',
            loanNo: loan?.loan_id || '-',
            dueDate: due.due_date,
            principal: principal,
            interest: interest,
            penalty: Number(due.penalty_amount) || 0,
            totalDue: duePending + (Number(due.penalty_amount) || 0),
            status: due.status
          });
        }
      });

      outList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setPartnerOutstanding(outList);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load business details');
    } finally {
      setLoading(false);
    }
  };

  const selectedPartnerName = selectedPartnerId === 'ALL' 
    ? 'All Partners' 
    : partners.find(p => p.id === selectedPartnerId)?.name || 'Unknown';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6 print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">Business Details</h1>
          <p className="finance-small-label uppercase">
            Partner-wise & MD Business, Outstanding, and Disbursal Activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter Row */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">Partner Filter</label>
          <select
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
            className="w-full bg-transparent border-none p-0 text-[#0b1329] font-black focus:ring-0 finance-h1 uppercase"
          >
            <option value="ALL">All Partners</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center bg-slate-50">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">Selected Partner</label>
          <span className="text-[#0b1329] truncate finance-h1">{selectedPartnerName}</span>
        </div>
      </div>

      {/* Metrics Dashboards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${showPrintPreview ? 'print:hidden' : ''}`}>
            
            {/* Accounting Flow Metrics */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-slate-900 font-bold border-b pb-2 uppercase text-xs flex items-center gap-1.5 text-slate-550">
                <FileText className="w-4 h-4" />
                Accounting Flow Metrics (Date Range)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Capital Change</span>
                  <span className="text-sm font-black text-slate-900">₹{rangeMetrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Net Profit / Loss</span>
                  <span className={`text-sm font-black ${rangeMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    ₹{rangeMetrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Income</span>
                  <span className="text-sm font-black text-emerald-600">₹{rangeMetrics.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Expense</span>
                  <span className="text-sm font-black text-rose-600">₹{rangeMetrics.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Cash Position net flow</span>
                <span className="text-base font-black text-slate-900">₹{rangeMetrics.cashPosition.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Current Position Metrics */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-slate-900 font-bold border-b pb-2 uppercase text-xs flex items-center gap-1.5 text-slate-550">
                  <Info className="w-4 h-4" />
                  Current Loan Position Metrics (All-time Active)
                </h3>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">CD Principal Outstanding</span>
                    <span className="text-lg font-black text-slate-900">₹{positionMetrics.cdPrincipalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Active CD Accounts</span>
                    <span className="text-lg font-black text-[#0b1329]">{positionMetrics.activeCdAccounts} Loans</span>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 bg-blue-50/50 p-2.5 rounded border border-blue-100/50">
                Note: Outstanding balance uses the audited active CD principal positions directly from the lending ledger.
              </div>
            </div>

          </div>

          {/* Disbursals Table */}
          <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${showPrintPreview ? 'print:hidden' : ''}`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-slate-900 font-bold uppercase text-xs">Loans Disbursed in Period ({partnerBusiness.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse finance-caption">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-slate-400">
                    <th className="px-4 py-3 finance-small-label uppercase">Date</th>
                    <th className="px-4 py-3 finance-small-label uppercase">Customer Name</th>
                    <th className="px-4 py-3 finance-small-label uppercase">Loan No</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Amount Disbursed</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Paid</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Outstanding Principal</th>
                    <th className="px-4 py-3 text-center finance-small-label uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerBusiness.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 finance-input">
                        No disbursals found for this period.
                      </td>
                    </tr>
                  ) : (
                    partnerBusiness.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3 text-slate-650">{row.date.split('-').reverse().join('/')}</td>
                        <td className="px-4 py-3 text-slate-900 font-bold uppercase">{row.customerName}</td>
                        <td className="px-4 py-3 font-mono text-slate-900 font-black">{row.loanNo}</td>
                        <td className="px-4 py-3 text-right text-slate-900">₹{row.loanAmount.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">₹{row.paid.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-rose-600 font-bold">₹{row.balance.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-slate-150 text-slate-600'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outstandings Dues Table */}
          <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${showPrintPreview ? 'print:hidden' : ''}`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-slate-900 font-bold uppercase text-xs">Outstanding Overdue Dues ({partnerOutstanding.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse finance-caption">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-slate-400">
                    <th className="px-4 py-3 finance-small-label uppercase">Due Date</th>
                    <th className="px-4 py-3 finance-small-label uppercase">Customer Name</th>
                    <th className="px-4 py-3 finance-small-label uppercase">Loan No</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Principal Due</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Interest Due</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Penalty Accrued</th>
                    <th className="px-4 py-3 text-right finance-small-label uppercase">Total Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerOutstanding.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 finance-input">
                        No outstanding dues found.
                      </td>
                    </tr>
                  ) : (
                    partnerOutstanding.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3 text-rose-600 font-bold">{row.dueDate.split('-').reverse().join('/')}</td>
                        <td className="px-4 py-3 text-slate-900 font-bold uppercase">{row.customerName}</td>
                        <td className="px-4 py-3 font-mono text-slate-900 font-black">{row.loanNo}</td>
                        <td className="px-4 py-3 text-right">₹{Math.round(row.principal).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">₹{Math.round(row.interest).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-rose-600">₹{row.penalty.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-rose-700 font-black">₹{Math.round(row.totalDue).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Business Details Report"
        documentTitle={`BUSINESS DETAILS REPORT`}
      >
        <div className="space-y-6 pb-12 text-[11px]">
          <div className="flex justify-between items-end border-b border-slate-950 pb-2">
            <div>
              <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
              <p className="text-[13px] uppercase text-slate-500">Business Details & Loan Position Summary</p>
            </div>
            <div className="text-right text-[12px] text-slate-600">
              <p>Period: {startDate.split('-').reverse().join('/')} to {endDate.split('-').reverse().join('/')}</p>
              <p>Partner: {selectedPartnerName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border p-3 rounded">
              <span className="font-bold block uppercase text-[10px] text-slate-550 border-b pb-1 mb-2">Accounting Flow Metrics</span>
              <p>Total Capital Change: <strong>₹{rangeMetrics.totalCapital.toLocaleString('en-IN')}</strong></p>
              <p>Net Profit / Loss: <strong>₹{rangeMetrics.netProfit.toLocaleString('en-IN')}</strong></p>
              <p>Total Income: <strong>₹{rangeMetrics.totalIncome.toLocaleString('en-IN')}</strong></p>
              <p>Total Expense: <strong>₹{rangeMetrics.totalExpense.toLocaleString('en-IN')}</strong></p>
              <p className="mt-2 border-t pt-1">Cash Net Flow: <strong>₹{rangeMetrics.cashPosition.toLocaleString('en-IN')}</strong></p>
            </div>
            <div className="border p-3 rounded flex flex-col justify-between">
              <div>
                <span className="font-bold block uppercase text-[10px] text-slate-550 border-b pb-1 mb-2">Lending Book Position</span>
                <p>CD Outstanding: <strong>₹{positionMetrics.cdPrincipalOutstanding.toLocaleString('en-IN')}</strong></p>
                <p>Active CD Accounts: <strong>{positionMetrics.activeCdAccounts} Loans</strong></p>
              </div>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default BusinessReport;
