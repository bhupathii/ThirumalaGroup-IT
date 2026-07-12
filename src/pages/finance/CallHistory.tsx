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
  X
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
  
  // Drawer state
  const [selectedGroup, setSelectedGroup] = useState<GroupedFollowUp | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Print state
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch all follow-ups with loan details using getFollowUps or raw query to ensure we get everything
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
      // 1. Search Query
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

      // 2. Loan Type Filter
      if (loanTypeFilter !== 'ALL' && g.loan_category !== loanTypeFilter) {
        return false;
      }

      // 3. Result Filter (Checks latest result or any in history)
      if (resultFilter !== 'ALL' && g.latest_follow_up.result !== resultFilter) {
        return false;
      }

      // 4. Staff Filter
      if (staffFilter !== 'ALL' && g.latest_follow_up.followed_up_by !== staffFilter) {
        return false;
      }

      // 5. Date Filter
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
            <table className="min-w-full divide-y divide-slate-150 text-xs">
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
                    onDoubleClick={() => {
                      setSelectedGroup(g);
                      setShowDrawer(true);
                    }}
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
                        onClick={() => {
                          setSelectedGroup(g);
                          setShowDrawer(true);
                        }}
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

      {/* Side Timeline Drawer */}
      {showDrawer && selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 transition-opacity" onClick={() => setShowDrawer(false)}></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md">
                <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl border-l border-slate-150">
                  
                  {/* Drawer Header */}
                  <div className="bg-slate-50 px-4 py-6 sm:px-6 border-b border-slate-150">
                    <div className="flex items-start justify-between">
                      <h2 className="text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-600" />
                        Call Log Details
                      </h2>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          className="rounded-md text-slate-400 hover:text-slate-500 focus:outline-none"
                          onClick={() => setShowDrawer(false)}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3 bg-white p-3 border rounded-lg text-xs space-y-1 font-bold">
                      <div><span className="text-slate-400 uppercase">LOAN NUMBER:</span> {selectedGroup.loan_number}</div>
                      <div><span className="text-slate-400 uppercase">BORROWER:</span> {selectedGroup.customer_name}</div>
                      <div><span className="text-slate-400 uppercase">PHONE:</span> {selectedGroup.customer_phone}</div>
                      <div><span className="text-slate-400 uppercase">PARTNER:</span> {selectedGroup.partner_name}</div>
                    </div>
                  </div>

                  {/* Drawer Timeline Body */}
                  <div className="relative flex-1 px-4 py-6 sm:px-6">
                    <div className="flow-root">
                      <ul role="list" className="-mb-8">
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
                                    <Clock className="w-4 h-4" />
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-slate-800 font-bold uppercase flex justify-between">
                                    <span>
                                      {log.result}
                                    </span>
                                    <span className="text-slate-400 font-mono">
                                      {log.follow_up_date}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-400 uppercase font-black flex items-center gap-2">
                                    <span>BY: {log.followed_up_by}</span>
                                    <span>•</span>
                                    <span>TO: {log.contacted_person}</span>
                                  </div>
                                  {log.promised_amount ? (
                                    <div className="mt-1.5 text-xs text-green-700 font-bold bg-green-50/50 p-1.5 rounded border border-green-200 inline-block">
                                      PROMISED AMOUNT: ₹{log.promised_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                  ) : null}
                                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-medium leading-relaxed">
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
              </div>
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
