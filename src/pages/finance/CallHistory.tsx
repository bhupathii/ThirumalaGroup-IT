import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { FinanceLoanPaymentFollowup } from '../../lib/supabaseFinance';
import { 
  History, 
  Search, 
  Download, 
  Printer, 
  Clock, 
  ChevronRight,
  X,
  Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface GroupedFollowUp {
  loan_id: string;
  db_loan_id: string; // The database UUID
  loan_number: string;
  loan_category: string;
  customer_name: string;
  customer_phone: string;
  partner_name: string;
  latest_follow_up: FinanceLoanPaymentFollowup;
  all_follow_ups: FinanceLoanPaymentFollowup[];
}

const CallHistory: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState<FinanceLoanPaymentFollowup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState<'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD'>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  
  // Modal state
  const [selectedGroup, setSelectedGroup] = useState<GroupedFollowUp | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Detailed metrics state
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loanMetrics, setLoanMetrics] = useState<any>(null);
  const [borrowerDetails, setBorrowerDetails] = useState<any>(null);
  const [g1Details, setG1Details] = useState<any>(null);
  const [g2Details, setG2Details] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);

  // Print state
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_loan_payment_followups')
        .select(`
          *,
          loan:finance_loans(
            id,
            loan_id,
            loan_category,
            amount,
            status,
            customer_id,
            customer:finance_customers!customer_id(id, name, phone, partner_name)
          )
        `)
        .order('followed_up_at', { ascending: false });

      if (error) throw error;
      setFollowUps(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load call history logs');
    } finally {
      setLoading(false);
    }
  };

  const loadAllDetailsForGroup = async (group: GroupedFollowUp) => {
    setLoadingDetails(true);
    setLoanMetrics(null);
    setBorrowerDetails(null);
    setG1Details(null);
    setG2Details(null);
    setFinancials(null);
    try {
      // 1. Fetch the loan details including current principal, present due, etc.
      const { data: loanData, error: loanErr } = await supabase
        .from('finance_loans')
        .select('*, customer:finance_customers!customer_id(*), g1:finance_customers!guarantor1_id(*), g2:finance_customers!guarantor2_id(*)')
        .eq('id', group.db_loan_id)
        .maybeSingle();

      if (!loanErr && loanData) {
        setLoanMetrics(loanData);
        setBorrowerDetails(loanData.customer);
        setG1Details(loanData.g1);
        setG2Details(loanData.g2);
      }

      // 2. Fetch loan transactions and CD entries
      const { data: txs } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('loan_id', group.db_loan_id)
        .order('date', { ascending: true });

      let cdEntries: any[] = [];
      if (group.loan_number.toUpperCase().startsWith('CD')) {
        const { data } = await supabase
          .from('finance_cd_ledger_entries')
          .select('*')
          .eq('loan_id', group.db_loan_id)
          .order('entry_date', { ascending: true });
        cdEntries = data || [];
      }

      const collections = (txs || []).filter(t => t.type === 'Collection');
      const totalPaid = collections.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const lastColl = collections[collections.length - 1];
      const lastPaymentDate = lastColl ? lastColl.date.split('-').reverse().join('/') : '—';
      const lastReceipt = lastColl ? lastColl.receipt_no || '—' : '—';
      const operator = lastColl ? lastColl.collected_by || '—' : (txs?.[0]?.collected_by || '—');

      let interestPaid = 0;
      let penaltyPaid = 0;
      let renewalPaid = 0;

      cdEntries.forEach(e => {
        const name = (e.account_name || '').toUpperCase();
        if (name.includes('INTEREST') || name.includes('COMMISSION')) {
          interestPaid += Number(e.credit || 0);
        } else if (name.includes('PENALTY')) {
          penaltyPaid += Number(e.credit || 0);
        } else if (name.includes('RENEWAL')) {
          renewalPaid += Number(e.credit || 0);
        }
      });

      setFinancials({
        interestPaid,
        penaltyPaid,
        renewalPaid,
        totalPaid,
        lastPaymentDate,
        lastReceipt,
        operator
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenModal = (group: GroupedFollowUp) => {
    setSelectedGroup(group);
    loadAllDetailsForGroup(group);
    setShowModal(true);
  };

  const formatAddress = (details: any) => {
    if (!details) return '';
    const parts = [details.address, details.village, details.district].filter(Boolean);
    return parts.join(', ');
  };

  // Group by loan_id (using the string identifier)
  const groupedData = useMemo(() => {
    const groups: Record<string, FinanceLoanPaymentFollowup[]> = {};
    followUps.forEach(f => {
      const lid = f.loan?.loan_id || f.loan_id || 'UNKNOWN';
      if (!groups[lid]) {
        groups[lid] = [];
      }
      groups[lid].push(f);
    });

    const list: GroupedFollowUp[] = Object.keys(groups).map(loanIdStr => {
      const sorted = [...groups[loanIdStr]].sort(
        (a, b) => new Date(b.followed_up_at).getTime() - new Date(a.followed_up_at).getTime()
      );
      const latest = sorted[0];
      return {
        loan_id: loanIdStr,
        db_loan_id: latest.loan_id,
        loan_number: latest.loan?.loan_id || loanIdStr,
        loan_category: latest.loan?.loan_category || 'CD',
        customer_name: latest.loan?.customer?.name || 'N/A',
        customer_phone: latest.loan?.customer?.phone || 'N/A',
        partner_name: latest.loan?.customer?.partner_name || 'N/A',
        latest_follow_up: latest,
        all_follow_ups: sorted
      };
    });

    return list;
  }, [followUps]);

  // Extract unique staff list
  const staffList = useMemo(() => {
    const set = new Set<string>();
    followUps.forEach(f => {
      if (f.followed_up_by) set.add(f.followed_up_by);
    });
    return Array.from(set);
  }, [followUps]);

  // Filtered list
  const filteredGroups = useMemo(() => {
    return groupedData.filter(g => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchLoan = g.loan_number.toLowerCase().includes(q);
        const matchCust = g.customer_name.toLowerCase().includes(q);
        const matchPhone = g.customer_phone.toLowerCase().includes(q);
        const matchPartner = g.partner_name.toLowerCase().includes(q);
        if (!matchLoan && !matchCust && !matchPhone && !matchPartner) {
          return false;
        }
      }

      if (loanTypeFilter !== 'ALL' && g.loan_category !== loanTypeFilter) {
        return false;
      }

      if (resultFilter !== 'ALL' && g.latest_follow_up.result !== resultFilter) {
        return false;
      }

      if (staffFilter !== 'ALL' && g.latest_follow_up.followed_up_by !== staffFilter) {
        return false;
      }

      if (dateFilter && g.latest_follow_up.follow_up_date !== dateFilter) {
        return false;
      }

      return true;
    });
  }, [groupedData, searchQuery, loanTypeFilter, resultFilter, staffFilter, dateFilter]);

  const handleExportCSV = () => {
    if (filteredGroups.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Loan Number', 'Category', 'Customer Name', 'Phone', 'Partner', 'Staff Name', 'Call Date', 'Result', 'Promised Amount', 'Remarks'];
    const rows = filteredGroups.map(g => [
      g.loan_number,
      g.loan_category,
      g.customer_name,
      g.customer_phone,
      g.partner_name,
      g.latest_follow_up.followed_up_by,
      g.latest_follow_up.follow_up_date,
      g.latest_follow_up.result,
      g.latest_follow_up.promised_amount || 0,
      g.latest_follow_up.narration || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Call_History_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Call History exported successfully');
  };

  const printableContent = useMemo(() => {
    return (
      <div className="p-6 uppercase font-bold text-xs">
        <h2 className="text-center text-lg border-b pb-2 mb-4">CALL HISTORY REPORT</h2>
        <div className="flex justify-between mb-4">
          <div>DATE: {new Date().toLocaleDateString('en-IN')}</div>
          <div>TOTAL RECORD GROUPS: {filteredGroups.length}</div>
        </div>
        <table className="w-full border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 p-2 text-left">LOAN NO</th>
              <th className="border border-slate-400 p-2 text-left">CUSTOMER</th>
              <th className="border border-slate-400 p-2 text-left">PARTNER</th>
              <th className="border border-slate-400 p-2 text-left">DATE</th>
              <th className="border border-slate-400 p-2 text-left">RESULT</th>
              <th className="border border-slate-400 p-2 text-left">STAFF</th>
              <th className="border border-slate-400 p-2 text-left">REMARKS</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map(g => (
              <tr key={g.loan_id}>
                <td className="border border-slate-400 p-2 font-mono">{g.loan_number}</td>
                <td className="border border-slate-400 p-2">{g.customer_name}</td>
                <td className="border border-slate-400 p-2">{g.partner_name}</td>
                <td className="border border-slate-400 p-2">{g.latest_follow_up.follow_up_date}</td>
                <td className="border border-slate-400 p-2">{g.latest_follow_up.result}</td>
                <td className="border border-slate-400 p-2">{g.latest_follow_up.followed_up_by}</td>
                <td className="border border-slate-400 p-2 font-normal">{g.latest_follow_up.narration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [filteredGroups]);

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-slate-150 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Call History Ledger
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
            Review and search historic collection calls and customer callbacks logs
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsPrinting(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="SEARCH ID / CUSTOMER / PHONE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Loan Category */}
          <select
            value={loanTypeFilter}
            onChange={(e) => setLoanTypeFilter(e.target.value as any)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">ALL LEDGERS</option>
            <option value="CD">CD LEDGER</option>
            <option value="HP">HP LEDGER</option>
            <option value="STBD">STBD LEDGER</option>
            <option value="TBD">TBD LEDGER</option>
          </select>

          {/* Result Filter */}
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">ALL RESULTS</option>
            <option value="ANSWERED">ANSWERED</option>
            <option value="PROMISED TO PAY">PROMISED TO PAY</option>
            <option value="CALL BACK">CALL BACK</option>
            <option value="NO ANSWER">NO ANSWER</option>
            <option value="BUSY">BUSY</option>
            <option value="SWITCHED OFF">SWITCHED OFF</option>
            <option value="WRONG NUMBER">WRONG NUMBER</option>
          </select>

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">ALL STAFF</option>
            {staffList.map(staff => (
              <option key={staff} value={staff}>{staff.toUpperCase()}</option>
            ))}
          </select>

          {/* Call Date */}
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-bold uppercase text-xs">
            Loading call logs database...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold uppercase text-xs">
            No Call History records match filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-155 text-xs">
              <thead className="bg-slate-50 uppercase font-bold text-[11px] text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left">Loan ID</th>
                  <th className="px-4 py-3 text-left">Borrower Name</th>
                  <th className="px-4 py-3 text-left">Partner</th>
                  <th className="px-4 py-3 text-center">Last Call Date</th>
                  <th className="px-4 py-3 text-center">Result</th>
                  <th className="px-4 py-3 text-left">Staff Name</th>
                  <th className="px-4 py-3 text-left">Last Log Remarks</th>
                  <th className="px-4 py-3 text-center w-24">Logs count</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredGroups.map((g) => (
                  <tr 
                    key={g.loan_id} 
                    onDoubleClick={() => handleOpenModal(g)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{g.loan_number}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-900">{g.customer_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{g.customer_phone}</div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{g.partner_name}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-700">
                      {g.latest_follow_up.follow_up_date}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        g.latest_follow_up.result === 'PROMISED TO PAY' ? 'bg-green-50 text-green-700 border border-green-200' :
                        g.latest_follow_up.result === 'ANSWERED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        g.latest_follow_up.result === 'CALL BACK' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {g.latest_follow_up.result}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 uppercase">
                      {g.latest_follow_up.followed_up_by}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={g.latest_follow_up.narration}>
                      {g.latest_follow_up.narration}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold font-mono text-indigo-700 bg-indigo-50/30">
                      {g.all_follow_ups.length}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleOpenModal(g)}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900 font-bold uppercase"
                      >
                        Timeline
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Centered Large Details Modal (Requirement 6 - Replacing the Drawer) */}
      {showModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-150 max-w-[85vw] w-11/12 md:w-[80vw] lg:w-[75vw] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0b1329] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Loan Call Logs &amp; Metrics Timeline</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                  Account: {selectedGroup.loan_number} — Borrower: {selectedGroup.customer_name}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 font-sans text-xs">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900 mb-2"></div>
                  Loading Loan details &amp; metrics...
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Loan Summary & Financial Summary */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Borrower Identity Header */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-4">
                      {borrowerDetails?.customer_photo_url ? (
                        <img 
                          src={borrowerDetails.customer_photo_url} 
                          alt="Customer" 
                          className="w-20 h-20 rounded-lg object-cover border border-slate-200" 
                        />
                      ) : (
                        <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase text-center p-1">
                          No Photo
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1">
                        <div>
                          <span className="text-[9px] text-slate-450 uppercase font-black tracking-wider">Account Number</span>
                          <div className="text-base font-black text-slate-900">{selectedGroup.loan_number}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-slate-455 uppercase font-black tracking-wider">Borrower Name</span>
                            <div className="text-sm font-bold text-slate-900">{selectedGroup.customer_name}</div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-450 uppercase font-black tracking-wider">Borrower Phone</span>
                            <div className="text-xs font-bold text-[#0b1329] font-mono tracking-wide">{borrowerDetails?.phone || selectedGroup.customer_phone || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary Quick Grid */}
                    {loanMetrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-bold uppercase">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Status</span>
                          <span className="text-sm font-black text-slate-900">{loanMetrics.status || 'Active'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Loan Date</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{loanMetrics.loan_date ? loanMetrics.loan_date.split('-').reverse().join('/') : '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Due Date</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{loanMetrics.current_due_date ? loanMetrics.current_due_date.split('-').reverse().join('/') : '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Principal</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{Math.round(loanMetrics.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        
                        <div>
                          <span className="text-[10px] text-slate-400 block">Present Due</span>
                          <span className="text-sm font-black text-red-600 font-mono">{Math.round(loanMetrics.present_due || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Outstanding</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{Math.round(loanMetrics.principal_balance || loanMetrics.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Current Interest</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{Math.round(loanMetrics.pending_interest || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Current Penalty</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{Math.round(loanMetrics.penalty || 0).toLocaleString('en-IN')}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block">Interest Paid</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">{financials ? Math.round(financials.interestPaid).toLocaleString('en-IN') : '...'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Penalty Paid</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">{financials ? Math.round(financials.penaltyPaid).toLocaleString('en-IN') : '...'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Renewal Paid</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">{financials ? Math.round(financials.renewalPaid).toLocaleString('en-IN') : '...'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Total Paid</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">{financials ? Math.round(financials.totalPaid).toLocaleString('en-IN') : '...'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block">Days Due</span>
                          <span className="text-sm font-black text-red-600 font-mono">{loanMetrics.due_days || 0} Days</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Last Receipt</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{financials ? financials.lastReceipt : '...'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Last Payment</span>
                          <span className="text-sm font-black text-slate-900 font-mono">{financials ? financials.lastPaymentDate : '...'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Operator</span>
                          <span className="text-sm font-black text-slate-900">{financials ? financials.operator : '...'}</span>
                        </div>
                      </div>
                    )}

                    {/* Guarantors */}
                    {(g1Details || g2Details) && (
                      <div className="grid grid-cols-2 gap-3.5">
                        {g1Details && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs font-bold">
                            <span className="text-[9px] text-[#0b1329] uppercase font-black tracking-wider border-b pb-0.5 block">Guarantor 1</span>
                            <div>
                              <span className="text-[8px] text-slate-400 uppercase">Name:</span> {g1Details.name}
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 uppercase">Phone:</span> <span className="font-mono">{g1Details.phone || '—'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              <span className="text-[8px] text-slate-400 uppercase block">Address</span>
                              {formatAddress(g1Details)}
                            </div>
                          </div>
                        )}
                        {g2Details && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs font-bold">
                            <span className="text-[9px] text-[#0b1329] uppercase font-black tracking-wider border-b pb-0.5 block">Guarantor 2</span>
                            <div>
                              <span className="text-[8px] text-slate-400 uppercase">Name:</span> {g2Details.name}
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-400 uppercase">Phone:</span> <span className="font-mono">{g2Details.phone || '—'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              <span className="text-[8px] text-slate-400 uppercase block">Address</span>
                              {formatAddress(g2Details)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Callback History Timeline */}
                  <div className="lg:col-span-5 bg-slate-50/50 p-4 rounded-xl border border-slate-150 flex flex-col h-[550px] overflow-hidden">
                    <h4 className="text-xs font-black uppercase text-indigo-900 border-b pb-2 mb-4 tracking-wider flex items-center gap-1.5 shrink-0">
                      <Clock className="w-4 h-4" />
                      Action Timeline ({selectedGroup.all_follow_ups.length} Records)
                    </h4>
                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                      <ul role="list" className="-mb-8 pl-1">
                        {selectedGroup.all_follow_ups.map((log, idx) => (
                          <li key={log.id}>
                            <div className="relative pb-8">
                              {idx !== selectedGroup.all_follow_ups.length - 1 && (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true"></span>
                              )}
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                    log.result === 'PROMISED TO PAY' ? 'bg-green-500 text-white' :
                                    log.result === 'ANSWERED' ? 'bg-blue-500 text-white' :
                                    log.result === 'CALL BACK' ? 'bg-amber-500 text-white' :
                                    'bg-rose-500 text-white'
                                  }`}>
                                    <Phone className="w-3.5 h-3.5" />
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-slate-800 font-bold uppercase flex justify-between">
                                    <span>{log.result}</span>
                                    <span className="text-slate-400 font-mono">{log.follow_up_date}</span>
                                  </div>
                                  <div className="mt-1 text-[10px] text-slate-400 uppercase font-black flex items-center gap-2">
                                    <span>BY: {log.followed_up_by}</span>
                                    <span>•</span>
                                    <span>TO: {log.contacted_person}</span>
                                  </div>
                                  {log.promised_amount ? (
                                    <div className="mt-1.5 text-xs text-green-700 font-bold bg-green-50/50 p-1.5 rounded border border-green-200 inline-block font-mono">
                                      PROMISED AMOUNT: {log.promised_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                  ) : null}
                                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-semibold leading-normal">
                                    {log.narration || 'No remarks recorded.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-4 py-3 sm:px-6 border-t border-slate-150 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold uppercase transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Print Preview Handler */}
      <FinancePrintPreview
        isOpen={isPrinting}
        onClose={() => setIsPrinting(false)}
        title="Call History Ledger Report"
        documentTitle="CallHistoryReport"
      >
        {printableContent}
      </FinancePrintPreview>

    </div>
  );
};

export default CallHistory;
