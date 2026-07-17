import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { FinanceLoanPaymentFollowup } from '../../lib/supabaseFinance';
import { 
  History, 
  Search, 
  Download, 
  Printer, 
  ChevronRight,
  X,
  Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user } = useAuth();
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
  const [isTimelinePrinting, setIsTimelinePrinting] = useState(false);

  // Detailed metrics state


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

  const handleOpenModal = (group: GroupedFollowUp) => {
    setSelectedGroup(group);
    setShowModal(true);
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

  const getResultColorClass = (result: string) => {
    const r = (result || '').toUpperCase();
    if (r === 'ANSWERED') return 'bg-emerald-50 text-emerald-700 border-emerald-250';
    if (r === 'PROMISED TO PAY') return 'bg-blue-50 text-blue-700 border-blue-250';
    if (r === 'CALL BACK') return 'bg-purple-50 text-purple-700 border-purple-250';
    if (r === 'BUSY') return 'bg-amber-50 text-amber-700 border-amber-250';
    if (r === 'NO RESPONSE' || r === 'NO ANSWER' || r === 'SWITCHED OFF') return 'bg-slate-50 text-slate-700 border-slate-250';
    if (r === 'WRONG NUMBER') return 'bg-rose-50 text-rose-700 border-rose-250';
    if (r === 'INVALID NUMBER') return 'bg-red-950/10 text-red-900 border-red-900/20';
    return 'bg-slate-50 text-slate-750 border-slate-250';
  };

  const getResultBadgeColorClass = (result: string) => {
    const r = (result || '').toUpperCase();
    if (r === 'ANSWERED') return 'bg-emerald-500 text-white ring-emerald-100';
    if (r === 'PROMISED TO PAY') return 'bg-blue-500 text-white ring-blue-100';
    if (r === 'CALL BACK') return 'bg-purple-500 text-white ring-purple-100';
    if (r === 'BUSY') return 'bg-amber-500 text-white ring-amber-100';
    if (r === 'NO RESPONSE' || r === 'NO ANSWER' || r === 'SWITCHED OFF') return 'bg-slate-400 text-white ring-slate-100';
    if (r === 'WRONG NUMBER') return 'bg-rose-500 text-white ring-rose-100';
    if (r === 'INVALID NUMBER') return 'bg-red-800 text-white ring-red-100';
    return 'bg-slate-550 text-white ring-slate-100';
  };

  const stats = useMemo(() => {
    if (!selectedGroup) return { total: 0, answered: 0, promises: 0, callbacks: 0, pendingFollowUp: 0, lastContact: '—' };
    const list = selectedGroup.all_follow_ups;
    const total = list.length;
    const answered = list.filter(l => l.result === 'ANSWERED').length;
    const promises = list.filter(l => l.result === 'PROMISED TO PAY').length;
    const callbacks = list.filter(l => l.result === 'CALL BACK').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const pendingFollowUp = list.filter(l => l.next_follow_up_date && l.next_follow_up_date >= todayStr).length;
    const lastContact = selectedGroup.latest_follow_up?.follow_up_date
      ? selectedGroup.latest_follow_up.follow_up_date.split('-').reverse().join('/')
      : '—';
    return { total, answered, promises, callbacks, pendingFollowUp, lastContact };
  }, [selectedGroup]);

  const timelinePrintContent = useMemo(() => {
    if (!selectedGroup) return null;
    return (
      <div className="p-8 text-slate-900 font-sans leading-normal uppercase font-bold text-[11px]">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-5">
          <h1 className="text-xl font-black tracking-wide">THIRUMALA FINANCE</h1>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mt-0.5">Customer Interaction History</h2>
        </div>

        {/* Customer Metadata Table */}
        <table className="w-full border-collapse border border-slate-350 mb-5 text-[11px] font-bold">
          <tbody>
            <tr>
              <td className="border border-slate-350 p-2.5 bg-slate-50 w-[18%]">CD Number</td>
              <td className="border border-slate-350 p-2.5 font-mono text-sm font-black w-[32%]">{selectedGroup.loan_number}</td>
              <td className="border border-slate-350 p-2.5 bg-slate-50 w-[18%]">Borrower</td>
              <td className="border border-slate-350 p-2.5 text-sm w-[32%]">{selectedGroup.customer_name}</td>
            </tr>
            <tr>
              <td className="border border-slate-350 p-2.5 bg-slate-50">Phone</td>
              <td className="border border-slate-350 p-2.5 font-mono">{selectedGroup.customer_phone || '—'}</td>
              <td className="border border-slate-350 p-2.5 bg-slate-50">Guarantor</td>
              <td className="border border-slate-350 p-2.5 text-[10px]">
                {[selectedGroup.latest_follow_up?.loan?.guarantor_1?.name, selectedGroup.latest_follow_up?.loan?.guarantor_2?.name].filter(Boolean).join(' / ') || '—'}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-350 p-2.5 bg-slate-50">Generated On</td>
              <td className="border border-slate-350 p-2.5 font-mono">{new Date().toLocaleString('en-IN')}</td>
              <td className="border border-slate-350 p-2.5 bg-slate-50">Generated By</td>
              <td className="border border-slate-350 p-2.5">{user?.username?.toUpperCase() || 'SYSTEM'}</td>
            </tr>
          </tbody>
        </table>

        {/* Interaction History List */}
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 border-b pb-1">Interactions (Chronological)</h3>
        <div className="space-y-3.5">
          {[...selectedGroup.all_follow_ups].reverse().map((log, idx) => {
            const dateObj = new Date(log.followed_up_at);
            const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return (
              <div key={log.id} className="border border-slate-300 rounded-xl p-3 bg-white text-[11px] space-y-2">
                <div className="flex justify-between items-center border-b pb-1.5 font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900">#{idx + 1} {log.result}</span>
                    {log.next_follow_up_date && (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px]">
                        NEXT: {log.next_follow_up_date.split('-').reverse().join('/')}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-slate-600">{dateStr} {timeStr}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 uppercase text-[10px] font-bold">
                  <div><span className="text-slate-400">Contacted:</span> <span className="text-slate-700">{log.contacted_person}</span></div>
                  <div><span className="text-slate-400">Operator:</span> <span className="text-slate-700">{log.followed_up_by}</span></div>
                  <div>
                    {log.promised_amount ? (
                      <span><span className="text-slate-400">Amount:</span> <span className="text-emerald-700">₹{log.promised_amount.toLocaleString('en-IN')}</span></span>
                    ) : null}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 font-medium leading-relaxed">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Remarks:</span>
                  {log.narration || 'No remarks recorded.'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Metrics */}
        <div className="mt-6 pt-3 border-t-2 border-slate-900 grid grid-cols-3 gap-3.5 text-center uppercase font-bold text-xs">
          <div className="bg-slate-50 p-2 rounded border border-slate-300">
            <span className="text-[9px] text-slate-400 block mb-0.5">Total Calls</span>
            <span className="text-sm font-black text-slate-900">{stats.total}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-300">
            <span className="text-[9px] text-slate-400 block mb-0.5">Last Contact</span>
            <span className="text-sm font-black text-slate-900 font-mono">{stats.lastContact}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-300">
            <span className="text-[9px] text-slate-400 block mb-0.5">Next Follow-up</span>
            <span className="text-sm font-black text-amber-700 font-mono">
              {selectedGroup.latest_follow_up?.next_follow_up_date 
                ? selectedGroup.latest_follow_up.next_follow_up_date.split('-').reverse().join('/')
                : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  }, [selectedGroup, stats, user]);

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
          <div className="bg-white rounded-2xl border border-gray-150 max-w-[90vw] w-11/12 md:w-[85vw] lg:w-[80vw] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0b1329] text-white p-4 flex justify-between items-center shrink-0">
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

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden p-6 flex flex-col bg-slate-50/40">
                  {/* Full Width: Statistics & Timeline */}
                  <div className="w-full flex flex-col overflow-hidden max-h-full">
                    {/* Quick Metrics Cards */}
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4 shrink-0 uppercase font-bold text-center text-[10px]">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <span className="text-slate-400 block mb-0.5">Total Calls</span>
                        <span className="text-base font-black text-slate-900 leading-none">{stats.total}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <span className="text-slate-400 block mb-0.5">Answered</span>
                        <span className="text-base font-black text-emerald-600 leading-none">{stats.answered}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <span className="text-slate-400 block mb-0.5">Promises</span>
                        <span className="text-base font-black text-blue-600 leading-none">{stats.promises}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <span className="text-slate-400 block mb-0.5">Callbacks</span>
                        <span className="text-base font-black text-purple-600 leading-none">{stats.callbacks}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center col-span-1">
                        <span className="text-slate-400 block mb-0.5">Pending</span>
                        <span className="text-base font-black text-amber-700 leading-none">{stats.pendingFollowUp}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center col-span-1">
                        <span className="text-slate-400 block mb-0.5">Last Call</span>
                        <span className="text-[11px] font-black text-slate-950 leading-none font-mono">{stats.lastContact}</span>
                      </div>
                    </div>

                    {/* Timeline List Scrollable Container */}
                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4 pl-1">
                      <div className="flow-root pl-1">
                        <ul role="list" className="-mb-8">
                          {selectedGroup.all_follow_ups.map((log, idx) => (
                            <li key={log.id}>
                              <div className="relative pb-8">
                                {idx !== selectedGroup.all_follow_ups.length - 1 && (
                                  <span className="absolute top-5 left-5 -ml-px h-full w-[3px] bg-slate-200" aria-hidden="true"></span>
                                )}
                                <div className="relative flex space-x-3.5">
                                  <div>
                                    <span className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm shrink-0 ${getResultBadgeColorClass(log.result)}`}>
                                      <Phone className="w-4 h-4" />
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-black uppercase border ${getResultColorClass(log.result)}`}>
                                          {log.result}
                                        </span>
                                        {log.next_follow_up_date && (
                                          <span className="text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded uppercase">
                                            Scheduled: {log.next_follow_up_date.split('-').reverse().join('/')}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-500 font-bold font-mono">
                                        {new Date(log.followed_up_at).toLocaleString('en-IN', {
                                          day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit', hour12: true
                                        })}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase">
                                      <div>
                                        <span className="text-slate-400 text-[10px] block">Contacted Person</span>
                                        <span className="text-slate-805">{log.contacted_person || '—'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] block">Operator / Staff</span>
                                        <span className="text-slate-805 uppercase">{log.followed_up_by || '—'}</span>
                                      </div>
                                    </div>

                                    {/* Remarks as Read-only Card */}
                                    <div className="text-xs text-slate-700 bg-slate-50/70 p-3.5 rounded-xl border border-slate-150 font-semibold leading-relaxed">
                                      <span className="text-[9px] text-slate-400 font-black uppercase block mb-1.5">Remarks &amp; Notes</span>
                                      {log.narration || 'No remarks recorded.'}
                                    </div>

                                    {log.promised_amount ? (
                                      <div className="text-xs text-emerald-700 font-bold bg-emerald-50/80 px-3 py-2 rounded-lg border border-emerald-200 inline-block font-mono">
                                        PROMISED AMOUNT: ₹{log.promised_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </div>
                                    ) : null}
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

            {/* Modal Footer */}
            <div className="bg-slate-50 px-4 py-3 sm:px-6 border-t border-slate-150 flex justify-between items-center shrink-0">
              <button
                onClick={() => setIsTimelinePrinting(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white hover:bg-slate-800 rounded-lg text-xs font-bold uppercase transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print Timeline
              </button>
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

      {/* Individual Customer Timeline Print Preview */}
      <FinancePrintPreview
        isOpen={isTimelinePrinting}
        onClose={() => setIsTimelinePrinting(false)}
        title="Customer Interaction Timeline"
        documentTitle={`Timeline_${selectedGroup?.loan_number || 'Report'}`}
      >
        {timelinePrintContent}
      </FinancePrintPreview>

    </div>
  );
};

export default CallHistory;
