import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
import { useNavigate } from 'react-router-dom';

interface OverdueDueItem {
  id: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  loanId: string;
  loanCategory: string;
  customerName: string;
  aadhaar: string;
  partnerName: string;
  phone: string;
  overdueDays: number;
  isNPA: boolean;
  penalty: number;
}

type ReportType = 'OUTSTANDING' | 'TOTAL DUE LIST' | 'CD DUE LIST' | 'A -> B DUE LIST' | 'NPA LIST';

const DuesLedger: React.FC = () => {
  const navigate = useNavigate();
  
  const [dues, setDues] = useState<OverdueDueItem[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  
  const [activeReport, setActiveReport] = useState<ReportType>('OUTSTANDING');
  const [selectedPartner, setSelectedPartner] = useState<string>('ALL PARTNERS');
  
  const [searchAadhaar, setSearchAadhaar] = useState('');
  const [searchName, setSearchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Partners
      const partnersData = await supabaseFinance.getPartners();
      setPartners(partnersData.map(p => ({ id: p.id, name: p.name })));

      // 2. Fetch all dues with loan and customer details
      const { data, error } = await supabase
        .from('finance_dues')
        .select(`
          id,
          due_date,
          amount,
          paid_amount,
          status,
          loan:finance_loans(
            id,
            loan_id,
            loan_category,
            customer:finance_customers(
              name,
              phone,
              aadhaar,
              partner_name
            )
          )
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const ledgerSettings = await financeLedgerSettingsService.getAllLedgerSettings();

      const today = new Date();
      const formatted: OverdueDueItem[] = (data || []).map((d: any) => {
        const amt = Number(d.amount) || 0;
        const paid = Number(d.paid_amount) || 0;
        const pending = amt - paid;
        
        const dueDate = new Date(d.due_date);
        const diffTime = today.getTime() - dueDate.getTime();
        const overdueDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
        
        // NPA Definition: > 90 days overdue and still pending
        const isPending = d.status === 'Pending' || d.status === 'Partially Paid';
        const isNPA = isPending && overdueDays > 90;

        // Basic penalty logic: Calculate dynamically from settings
        let penalty = 0;
        if (isPending && overdueDays > 0) {
          const cat = d.loan?.loan_category?.trim().toUpperCase() || 'CD';
          const setting = ledgerSettings[cat] || ledgerSettings['CD'];
          if (setting) {
             penalty = financeCalculationService.calculatePenaltyFromSetting(pending, overdueDays, setting);
          }
        }
        penalty = Math.round(penalty);

        return {
          id: d.id,
          dueDate: d.due_date,
          amount: amt,
          paidAmount: paid,
          pendingAmount: pending,
          status: d.status,
          loanId: d.loan?.loan_id || 'N/A',
          loanCategory: d.loan?.loan_category || '',
          customerName: d.loan?.customer?.name || 'N/A',
          aadhaar: d.loan?.customer?.aadhaar || 'N/A',
          partnerName: d.loan?.customer?.partner_name || 'Unassigned',
          phone: d.loan?.customer?.phone || '',
          overdueDays: overdueDays,
          isNPA: isNPA,
          penalty: penalty
        };
      });

      setDues(formatted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dues ledger');
    } finally {
      setLoading(false);
    }
  };

  const filteredDues = useMemo(() => {
    return dues.filter(due => {
      // 1. Report Type Filter
      if (activeReport === 'OUTSTANDING') {
        if (due.status !== 'Pending' && due.status !== 'Partially Paid') return false;
      } else if (activeReport === 'NPA LIST') {
        if (!due.isNPA) return false;
      } else if (activeReport === 'CD DUE LIST') {
        if (!due.loanId.startsWith('CD') && !due.loanCategory.includes('CD')) return false;
      } else if (activeReport === 'A -> B DUE LIST') {
        if (startDate && due.dueDate < startDate) return false;
        if (endDate && due.dueDate > endDate) return false;
      }

      // 2. Partner Filter
      if (selectedPartner !== 'ALL PARTNERS' && due.partnerName !== selectedPartner) return false;

      // 3. Search Filters
      if (searchAadhaar && !due.aadhaar.includes(searchAadhaar)) return false;
      if (searchName && !due.customerName.toLowerCase().includes(searchName.toLowerCase())) return false;

      return true;
    });
  }, [dues, activeReport, selectedPartner, searchAadhaar, searchName, startDate, endDate]);

  const npaTotalAmount = useMemo(() => {
    return filteredDues.filter(d => d.isNPA).reduce((sum, d) => sum + d.pendingAmount, 0);
  }, [filteredDues]);

  const renderReportMenu = () => {
    const options: ReportType[] = ['OUTSTANDING', 'TOTAL DUE LIST', 'CD DUE LIST', 'A -> B DUE LIST', 'NPA LIST'];
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">REPORT</h3>
        </div>
        <div className="flex flex-col">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveReport(opt)}
              className={`text-left px-4 py-3 text-xs font-black uppercase tracking-wider border-b border-slate-100 last:border-0 transition-colors
                ${activeReport === opt 
                  ? 'bg-[#0b1329] text-white' 
                  : 'text-slate-700 hover:bg-slate-50'
                }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  };



  return (
    <div className="space-y-6 max-w-[1400px] mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Dues Ledger</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
            Outstanding, NPA, and Partner-wise Due Lists with Grace/Penalty already applied
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

      {/* Top Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Partners Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Partners</span>
            {partners.length === 0 ? (
              <span className="text-sm font-bold text-slate-500 uppercase">No Partners</span>
            ) : (
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="w-full text-sm font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer uppercase tracking-wider"
              >
                <option value="ALL PARTNERS">ALL PARTNERS</option>
                {partners.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-auto bg-[#0b1329] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest">
            {selectedPartner}
          </div>
        </div>

        {/* Records Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Records</span>
          <span className="text-3xl font-black text-slate-900 tracking-tight mt-1">{filteredDues.length}</span>
        </div>

        {/* NPA Total Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">NPA Total</span>
          <span className="text-3xl font-black text-red-600 tracking-tight mt-1">₹{npaTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Filter Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Filter</span>
          <span className="text-xl font-black text-slate-900 tracking-tight mt-1 uppercase">{selectedPartner}</span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Side: Report Menu */}
        <div className="xl:col-span-1">
          {renderReportMenu()}
        </div>

        {/* Right Side: Main Content */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            
            {/* Main Content Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center relative">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">{activeReport}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  {activeReport === 'A -> B DUE LIST' 
                    ? 'FILTER BY AADHAAR, CUSTOMER NAME, OR DATE RANGE'
                    : 'FILTER BY AADHAAR OR CUSTOMER NAME'}
                </p>
              </div>
              <div className="absolute top-4 right-4 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-blue-100">
                LIVE
              </div>
            </div>

            {/* Search/Filter Row */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 bg-slate-50">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Aadhaar</label>
                <input
                  type="text"
                  placeholder="SEARCH BY AADHAAR"
                  value={searchAadhaar}
                  onChange={(e) => setSearchAadhaar(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Name</label>
                <input
                  type="text"
                  placeholder="SEARCH BY NAME"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {activeReport === 'A -> B DUE LIST' && (
                <>
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Start Date (A)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">End Date (B)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Main Results Area */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : filteredDues.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center border border-dashed border-slate-200 rounded-xl p-12 w-full max-w-md bg-slate-50">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">No Records</p>
                  <p className="text-xs font-bold text-slate-500 uppercase">Try adjusting the filters above.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-white border-b border-slate-200">
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">S.No</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Customer Name</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Aadhaar</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Loan No</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Partner</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Prin. Due</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Penalty</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Total Due</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDues.map((due, idx) => (
                      <tr key={due.id} className={`transition-colors hover:bg-slate-50 ${due.isNPA ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-xs font-black text-slate-900">{due.customerName}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{due.aadhaar}</td>
                        <td className="px-4 py-3 text-xs font-bold text-blue-600">{due.loanId}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{due.partnerName}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap">
                          {new Date(due.dueDate).toLocaleDateString('en-GB')}
                          {due.overdueDays > 0 && <span className="block text-[9px] text-red-500 font-black">{due.overdueDays} days late</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-black text-slate-700 text-right">₹{due.pendingAmount.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-xs font-black text-orange-600 text-right">₹{due.penalty.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-xs font-black text-red-600 text-right">₹{(due.pendingAmount + due.penalty).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-[10px] font-black uppercase tracking-wider">
                          <span className={`px-2 py-1 rounded-full ${
                            due.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                            due.status === 'Partially Paid' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {due.status}
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

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Dues Ledger"
        documentTitle={`DUES LEDGER: ${activeReport}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Summary */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Report Type</p>
              <p className="text-sm font-black text-slate-900">{activeReport}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Partner</p>
              <p className="text-sm font-black text-slate-900">{selectedPartner}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Records</p>
              <p className="text-sm font-black text-slate-900">{filteredDues.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">NPA Total</p>
              <p className="text-sm font-black text-red-700">₹{npaTotalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {(searchAadhaar || searchName || startDate || endDate) && (
            <div className="text-xs font-bold text-slate-600 mb-4 border border-slate-200 p-2 rounded bg-slate-50">
              <span className="text-[10px] uppercase text-slate-400 mr-2">Filters Applied:</span>
              {searchAadhaar && <span className="mr-4">Aadhaar: {searchAadhaar}</span>}
              {searchName && <span className="mr-4">Name: {searchName}</span>}
              {startDate && <span className="mr-4">From: {startDate}</span>}
              {endDate && <span>To: {endDate}</span>}
            </div>
          )}

          {/* Transactions Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-900">Due List</h4>
              <span className="text-[10px] font-bold text-slate-500">{filteredDues.length} ROWS</span>
            </div>
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">S.No</th>
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Name / Aadhaar</th>
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Loan / Partner</th>
                  <th className="px-2 py-2 font-bold text-slate-800 border-r border-slate-300">Due Date</th>
                  <th className="px-2 py-2 font-bold text-slate-800 text-right border-r border-slate-300">Prin. Due</th>
                  <th className="px-2 py-2 font-bold text-slate-800 text-right border-r border-slate-300">Penalty</th>
                  <th className="px-2 py-2 font-bold text-slate-900 text-right border-r border-slate-300">Total Due</th>
                  <th className="px-2 py-2 font-bold text-slate-800">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {filteredDues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500 font-sans font-bold uppercase">No records found</td>
                  </tr>
                ) : (
                  filteredDues.map((due, idx) => (
                    <tr key={due.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-2 py-1 border-r border-slate-200 text-center">{idx + 1}</td>
                      <td className="px-2 py-1 border-r border-slate-200">
                        <div className="font-bold text-slate-900 truncate max-w-[150px]">{due.customerName}</div>
                        <div className="text-[9px] text-slate-500">{due.aadhaar}</div>
                      </td>
                      <td className="px-2 py-1 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{due.loanId}</div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[100px]">{due.partnerName}</div>
                      </td>
                      <td className="px-2 py-1 border-r border-slate-200 whitespace-nowrap">
                        {new Date(due.dueDate).toLocaleDateString('en-GB')}
                        {due.overdueDays > 0 && <span className="ml-1 text-[8px] text-red-500">({due.overdueDays}d)</span>}
                      </td>
                      <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{due.pendingAmount > 0 ? due.pendingAmount.toLocaleString('en-IN') : '-'}</td>
                      <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{due.penalty > 0 ? due.penalty.toLocaleString('en-IN') : '-'}</td>
                      <td className="px-2 py-1 text-right font-bold text-slate-900 border-r border-slate-200">₹{(due.pendingAmount + due.penalty).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1 text-[8px] uppercase tracking-wider">{due.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default DuesLedger;
