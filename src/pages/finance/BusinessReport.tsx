import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface PartnerBusinessTotal {
  partnerId: string;
  partnerName: string;
  loanCount: number;
  actualLoan: number;
  actualPaid: number;
  actualBalance: number;
  totalLoan: number;
  totalPaid: number;
  totalBalance: number;
}

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
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');

  // Metrics
  const [mdSummary, setMdSummary] = useState({
    actualLoan: 0,
    actualPaid: 0,
    actualBalance: 0,
    totalLoan: 0,
    totalPaid: 0,
    totalBalance: 0
  });

  const [totalBusiness, setTotalBusiness] = useState<PartnerBusinessTotal[]>([]);
  const [partnerBusiness, setPartnerBusiness] = useState<PartnerBusinessRow[]>([]);
  const [partnerOutstanding, setPartnerOutstanding] = useState<PartnerOutstandingRow[]>([]);

  useEffect(() => {
    fetchBusinessData();
  }, [startDate, endDate]);

  const fetchBusinessData = async () => {
    setLoading(true);
    try {
      const [fetchedPartners, loans, txs] = await Promise.all([
        supabaseFinance.getPartners(),
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions()
      ]);

      setPartners(fetchedPartners);

      // Fetch specific dues
      const { data: rawDues } = await supabase
        .from('finance_dues')
        .select(`*, finance_loans(*, customer:finance_customers(*))`)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      const dues = rawDues || [];
      const loansInDateRange = loans.filter(l => l.date >= startDate && l.date <= endDate);

      // 1. Calculate MD Summary & Total Business Table
      // These are strictly based on loans disbursed in the date range.
      const pTotalsMap = new Map<string, PartnerBusinessTotal>();

      fetchedPartners.forEach(p => {
        pTotalsMap.set(p.name, {
          partnerId: p.id,
          partnerName: p.name,
          loanCount: 0,
          actualLoan: 0,
          actualPaid: 0,
          actualBalance: 0,
          totalLoan: 0,
          totalPaid: 0,
          totalBalance: 0
        });
      });

      loansInDateRange.forEach(loan => {
        const pName = loan.customer?.partner_name || '';
        if (pTotalsMap.has(pName)) {
          const pt = pTotalsMap.get(pName)!;
          
          const principal = Number(loan.amount);
          const interest = principal * (Number(loan.interest_rate) / 100) * Number(loan.duration_months);
          
          const loanTxs = txs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
          const paid = loanTxs.reduce((sum, t) => sum + Number(t.amount), 0);

          pt.loanCount++;
          pt.actualLoan += principal;
          pt.totalLoan += (principal + interest);
          pt.actualPaid += paid;
          pt.totalPaid += paid;
          pt.actualBalance += Math.max(0, principal - paid);
          pt.totalBalance += Math.max(0, (principal + interest) - paid);
        }
      });

      const allTotals = Array.from(pTotalsMap.values());
      // Filter out partners with 0 loans if you want, but standard is showing all or showing valid ones.
      // We will show all that have data or just all partners. Let's show all for clarity.
      setTotalBusiness(allTotals);

      // 2. MD Summary is dependent on selectedPartner
      updateDependentViews(allTotals, loansInDateRange, txs, dues, 'ALL');

    } catch (err) {
      console.error(err);
      toast.error('Failed to load business details');
    } finally {
      setLoading(false);
    }
  };

  const updateDependentViews = (totalsList: PartnerBusinessTotal[], rangeLoans: any[], allTxs: any[], rawDues: any[], pId: string) => {
    // 1. MD Summary Update
    const filteredTotals = pId === 'ALL' ? totalsList : totalsList.filter(t => t.partnerId === pId);
    
    const newMd = {
      actualLoan: filteredTotals.reduce((s, t) => s + t.actualLoan, 0),
      actualPaid: filteredTotals.reduce((s, t) => s + t.actualPaid, 0),
      actualBalance: filteredTotals.reduce((s, t) => s + t.actualBalance, 0),
      totalLoan: filteredTotals.reduce((s, t) => s + t.totalLoan, 0),
      totalPaid: filteredTotals.reduce((s, t) => s + t.totalPaid, 0),
      totalBalance: filteredTotals.reduce((s, t) => s + t.totalBalance, 0),
    };
    setMdSummary(newMd);

    // 2. Partner Business Table Update
    const pbList: PartnerBusinessRow[] = [];
    const targetPartnerName = pId === 'ALL' ? '' : totalsList.find(t => t.partnerId === pId)?.partnerName;
    const validLoans = pId === 'ALL' ? rangeLoans : rangeLoans.filter(l => l.customer?.partner_name === targetPartnerName);
    
    validLoans.forEach(loan => {
      const principal = Number(loan.amount);
      const loanTxs = allTxs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
      const paid = loanTxs.reduce((sum, t) => sum + Number(t.amount), 0);

      pbList.push({
        id: loan.id,
        date: loan.date,
        customerName: loan.customer?.name || 'Unknown',
        loanNo: loan.loan_id,
        loanType: loan.loan_type,
        loanAmount: principal,
        paid: paid,
        balance: Math.max(0, principal - paid),
        status: loan.status
      });
    });
    setPartnerBusiness(pbList);

    // 3. Partner Outstanding Table Update
    const outList: PartnerOutstandingRow[] = [];
    const validDues = pId === 'ALL' 
      ? rawDues 
      : rawDues.filter(d => d.finance_loans?.customer?.partner_name === targetPartnerName);

    validDues.forEach(due => {
      // Only show dues that are pending or partially paid
      if (due.status === 'Pending' || due.status === 'Partially Paid') {
        const principal = Number(due.principal_amount) || 0;
        const interest = Number(due.interest_amount) || 0;
        const penalty = Number(due.penalty_amount) || 0;
        const totalDue = Number(due.amount) - Number(due.paid_amount);

        outList.push({
          id: due.id,
          customerName: due.finance_loans?.customer?.name || 'Unknown',
          loanNo: due.finance_loans?.loan_id || '-',
          dueDate: due.due_date,
          principal: principal,
          interest: interest,
          penalty: penalty,
          totalDue: Math.max(0, totalDue),
          status: due.status
        });
      }
    });

    // Sort dues by due date
    outList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setPartnerOutstanding(outList);
  };

  const handlePartnerSelect = (pId: string) => {
    setSelectedPartnerId(pId);
    
    // We need to re-filter everything. But we already have totalBusiness.
    // To properly re-filter PartnerBusiness and Outstanding without re-fetching,
    // we would need loans and dues in state. 
    // For a reliable UI flow, re-fetching is safest when the dataset is complex, but to avoid 
    // network calls let's fetch again cleanly. It's fast.
    fetchBusinessDataForSelect(pId);
  };

  const fetchBusinessDataForSelect = async (pId: string) => {
    setLoading(true);
    try {
      const [loans, txs] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions()
      ]);

      const { data: rawDues } = await supabase
        .from('finance_dues')
        .select(`*, finance_loans(*, customer:finance_customers(*))`)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      const loansInDateRange = loans.filter(l => l.date >= startDate && l.date <= endDate);
      updateDependentViews(totalBusiness, loansInDateRange, txs, rawDues || [], pId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update views');
    } finally {
      setLoading(false);
    }
  };

  const selectedPartnerName = selectedPartnerId === 'ALL' 
    ? 'All Partners' 
    : partners.find(p => p.id === selectedPartnerId)?.name || 'Unknown';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Business Details</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
            Partner-wise & MD Business, Outstanding, and Disbursal Activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider text-xs">
            Back
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-xs">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center bg-slate-50">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Partners</label>
          <span className="text-xl font-black text-slate-900 tracking-tight">{partners.length} Total</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Selected</label>
          <span className="text-xl font-black text-[#0b1329] tracking-tight truncate uppercase">{selectedPartnerName}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar: Partners */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Partners</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{partners.length} Total</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto">
              <button
                onClick={() => handlePartnerSelect('ALL')}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 text-sm font-bold uppercase transition-colors ${
                  selectedPartnerId === 'ALL'
                    ? 'bg-[#0b1329] text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                All Partners
              </button>
              {partners.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                  No Partners
                </div>
              ) : (
                partners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePartnerSelect(p.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 text-sm font-bold uppercase transition-colors ${
                      selectedPartnerId === p.id
                        ? 'bg-[#0b1329] text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 space-y-6 min-w-0">
          
          {/* MD Summary */}
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">MD Summary</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Master Business Overview</p>
            </div>
            {loading ? (
              <div className="flex justify-center items-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Actual Loan</span>
                  <span className="text-xl font-black text-[#0b1329] tracking-tight">₹{mdSummary.actualLoan.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Actual Paid</span>
                  <span className="text-xl font-black text-emerald-600 tracking-tight">₹{mdSummary.actualPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Actual Balance</span>
                  <span className="text-xl font-black text-red-600 tracking-tight">₹{mdSummary.actualBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Loan</span>
                  <span className="text-xl font-black text-[#0b1329] tracking-tight">₹{mdSummary.totalLoan.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Paid</span>
                  <span className="text-xl font-black text-emerald-600 tracking-tight">₹{mdSummary.totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Balance</span>
                  <span className="text-xl font-black text-red-600 tracking-tight">₹{mdSummary.totalBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Total Business Table Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Total Business</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Partner-wise Totals</p>
              </div>
              <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-blue-100">
                {totalBusiness.length} Rows
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : totalBusiness.length === 0 ? (
              <div className="flex justify-center items-center p-6 bg-slate-50">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 px-6 py-4 rounded-xl">No Business Data</span>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">S.No</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[150px]">Partner Name</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Count</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Actual Loan</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Actual Paid</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right border-r border-slate-100">Actual Balance</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right bg-slate-100/50">Total Loan</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right bg-slate-100/50">Total Paid</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right bg-slate-100/50">Total Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {totalBusiness.map((tb, idx) => (
                      <tr 
                        key={tb.partnerId} 
                        className={`transition-colors hover:bg-slate-50 ${selectedPartnerId === tb.partnerId ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="px-3 py-2 text-xs font-bold text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs font-black text-slate-900 uppercase truncate max-w-[200px]" title={tb.partnerName}>{tb.partnerName}</td>
                        <td className="px-3 py-2 text-xs font-black text-[#0b1329] text-center bg-slate-50/50">{tb.loanCount}</td>
                        <td className="px-3 py-2 text-xs font-black text-[#0b1329] text-right">₹{tb.actualLoan.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-xs font-black text-emerald-600 text-right">₹{tb.actualPaid.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-xs font-black text-red-600 text-right border-r border-slate-100">₹{tb.actualBalance.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-xs font-black text-[#0b1329] text-right bg-slate-50">₹{tb.totalLoan.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-xs font-black text-emerald-600 text-right bg-slate-50">₹{tb.totalPaid.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-xs font-black text-red-600 text-right bg-slate-50">₹{tb.totalBalance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {/* Bottom Card A: Partner Business */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Partner · Business</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{partnerBusiness.length} Rows</p>
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
                </div>
              ) : partnerBusiness.length === 0 ? (
                <div className="flex justify-center items-center p-6 bg-slate-50">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 px-6 py-4 rounded-xl">No Business Records</span>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Loan No</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Amount</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Paid</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Balance</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerBusiness.map((b) => (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs font-bold text-slate-500">{new Date(b.date).toLocaleDateString('en-GB')}</td>
                          <td className="px-3 py-2 text-xs font-black text-slate-900 uppercase truncate max-w-[120px]" title={b.customerName}>{b.customerName}</td>
                          <td className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase">{b.loanNo}</td>
                          <td className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase">{b.loanType}</td>
                          <td className="px-3 py-2 text-xs font-black text-[#0b1329] text-right">{b.loanAmount.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-xs font-black text-emerald-600 text-right">{b.paid.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-xs font-black text-red-600 text-right">{b.balance.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                              b.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              b.status === 'Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Card B: Partner Outstanding */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Partner · Outstanding</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{partnerOutstanding.length} Rows</p>
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
                </div>
              ) : partnerOutstanding.length === 0 ? (
                <div className="flex justify-center items-center p-6 bg-slate-50">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 px-6 py-4 rounded-xl">No Outstanding Records</span>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Loan No</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Due Date</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Principal</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Interest</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Penalty</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Total Due</th>
                        <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerOutstanding.map((out) => (
                        <tr key={out.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs font-black text-slate-900 uppercase truncate max-w-[120px]" title={out.customerName}>{out.customerName}</td>
                          <td className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase">{out.loanNo}</td>
                          <td className="px-3 py-2 text-[10px] font-bold text-red-600">{new Date(out.dueDate).toLocaleDateString('en-GB')}</td>
                          <td className="px-3 py-2 text-[10px] font-bold text-slate-600 text-right">{out.principal.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-[10px] font-bold text-slate-600 text-right">{out.interest.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-[10px] font-bold text-slate-600 text-right">{out.penalty.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-xs font-black text-red-600 text-right">₹{out.totalDue.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                              out.status === 'Pending' ? 'bg-red-50 text-red-700 border-red-200' :
                              out.status === 'Partially Paid' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {out.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Business Details"
        documentTitle={`BUSINESS DETAILS: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-8 pb-12">
          {/* Print Summary Metrics */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">From Date</p>
              <p className="text-sm font-black text-slate-900">{new Date(startDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">To Date</p>
              <p className="text-sm font-black text-slate-900">{new Date(endDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Partners Count</p>
              <p className="text-sm font-black text-slate-900">{partners.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Selected</p>
              <p className="text-sm font-black text-[#0b1329] uppercase truncate">{selectedPartnerName}</p>
            </div>
          </div>

          <div className="border border-slate-900 bg-slate-50">
             <div className="bg-slate-100 border-b border-slate-900 px-4 py-2">
              <h4 className="text-[10px] font-black uppercase text-slate-900 text-center">MD Summary</h4>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-300 border-b border-slate-300">
              <div className="p-2 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Actual Loan</span>
                <span className="text-xs font-black text-slate-900">₹{mdSummary.actualLoan.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Actual Paid</span>
                <span className="text-xs font-black text-emerald-700">₹{mdSummary.actualPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Actual Balance</span>
                <span className="text-xs font-black text-red-700">₹{mdSummary.actualBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-300 bg-slate-100">
              <div className="p-2 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Loan</span>
                <span className="text-xs font-black text-slate-900">₹{mdSummary.totalLoan.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Paid</span>
                <span className="text-xs font-black text-emerald-700">₹{mdSummary.totalPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Balance</span>
                <span className="text-xs font-black text-red-700">₹{mdSummary.totalBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Total Business Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-900">Total Business (Partner-Wise)</h4>
            </div>
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-1 font-bold text-slate-800 border-r border-slate-300">Partner</th>
                  <th className="px-2 py-1 font-bold text-slate-800 text-center border-r border-slate-300">Loans</th>
                  <th className="px-2 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Act. Loan</th>
                  <th className="px-2 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Act. Paid</th>
                  <th className="px-2 py-1 font-bold text-slate-900 text-right border-r border-slate-300">Act. Bal</th>
                  <th className="px-2 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Tot. Loan</th>
                  <th className="px-2 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Tot. Paid</th>
                  <th className="px-2 py-1 font-bold text-slate-900 text-right">Tot. Bal</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {totalBusiness.map((tb, idx) => (
                  <tr key={idx} className="border-b border-slate-200 last:border-0">
                    <td className="px-2 py-1 font-bold text-slate-900 uppercase border-r border-slate-200">{tb.partnerName}</td>
                    <td className="px-2 py-1 text-center text-slate-700 border-r border-slate-200">{tb.loanCount}</td>
                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{tb.actualLoan.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tb.actualPaid.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right font-bold text-red-700 border-r border-slate-200">{tb.actualBalance.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{tb.totalLoan.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tb.totalPaid.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right font-bold text-red-700">{tb.totalBalance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Partner Business Print Table */}
             <div className="border border-slate-900">
              <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 flex justify-between">
                <h4 className="text-[9px] font-black uppercase text-slate-900">Business ({selectedPartnerName})</h4>
              </div>
              <table className="w-full text-left text-[8px]">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-50">
                    <th className="px-1 py-1 font-bold text-slate-800 border-r border-slate-300">Date</th>
                    <th className="px-1 py-1 font-bold text-slate-800 border-r border-slate-300">Cust</th>
                    <th className="px-1 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Amt</th>
                    <th className="px-1 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Paid</th>
                    <th className="px-1 py-1 font-bold text-slate-900 text-right">Bal</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {partnerBusiness.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-500 font-sans font-bold uppercase">No records</td></tr>
                  ) : (
                    partnerBusiness.map((b, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="px-1 py-1 text-slate-700 border-r border-slate-200">{new Date(b.date).toLocaleDateString('en-GB')}</td>
                        <td className="px-1 py-1 font-bold text-slate-900 uppercase border-r border-slate-200 truncate max-w-[80px]">{b.customerName}</td>
                        <td className="px-1 py-1 text-right text-slate-700 border-r border-slate-200">{b.loanAmount.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right text-emerald-700 border-r border-slate-200">{b.paid.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right font-bold text-red-700">{b.balance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Partner Outstanding Print Table */}
            <div className="border border-slate-900">
              <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 flex justify-between">
                <h4 className="text-[9px] font-black uppercase text-slate-900">Outstanding ({selectedPartnerName})</h4>
              </div>
              <table className="w-full text-left text-[8px]">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-50">
                    <th className="px-1 py-1 font-bold text-slate-800 border-r border-slate-300">Cust</th>
                    <th className="px-1 py-1 font-bold text-slate-800 border-r border-slate-300">Due Dt</th>
                    <th className="px-1 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Prin</th>
                    <th className="px-1 py-1 font-bold text-slate-800 text-right border-r border-slate-300">Int</th>
                    <th className="px-1 py-1 font-bold text-slate-900 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {partnerOutstanding.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-500 font-sans font-bold uppercase">No records</td></tr>
                  ) : (
                    partnerOutstanding.map((out, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="px-1 py-1 font-bold text-slate-900 uppercase border-r border-slate-200 truncate max-w-[80px]">{out.customerName}</td>
                        <td className="px-1 py-1 text-red-600 border-r border-slate-200">{new Date(out.dueDate).toLocaleDateString('en-GB')}</td>
                        <td className="px-1 py-1 text-right text-slate-700 border-r border-slate-200">{out.principal.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right text-slate-700 border-r border-slate-200">{out.interest.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right font-bold text-red-700">{out.totalDue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default BusinessReport;
