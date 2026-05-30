import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, Calendar, Clock, DollarSign, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface OverdueDueItem {
  id: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  loanId: string;
  customerName: string;
  phone: string;
  loanUuid: string;
}

const DuesLedger: React.FC = () => {
  const { user } = useAuth();
  const [dues, setDues] = useState<OverdueDueItem[]>([]);
  const [filteredDues, setFilteredDues] = useState<OverdueDueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Quick collection modal/fields
  const [selectedDue, setSelectedDue] = useState<OverdueDueItem | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDuesData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, overdueOnly, startDate, endDate, dues]);

  const fetchDuesData = async () => {
    setLoading(true);
    try {
      // Fetch all pending / partially paid dues from database
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
            customer:finance_customers(
              name,
              phone
            )
          )
        `)
        .in('status', ['Pending', 'Partially Paid'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const formatted: OverdueDueItem[] = (data || []).map((d: any) => {
        const amt = Number(d.amount);
        const paid = Number(d.paid_amount || 0);
        return {
          id: d.id,
          dueDate: d.due_date,
          amount: amt,
          paidAmount: paid,
          pendingAmount: amt - paid,
          status: d.status,
          loanId: d.loan?.loan_id || 'N/A',
          customerName: d.loan?.customer?.name || 'N/A',
          phone: d.loan?.customer?.phone || '',
          loanUuid: d.loan?.id || ''
        };
      });

      setDues(formatted);
      setFilteredDues(formatted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dues schedule');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...dues];
    const today = new Date().toISOString().split('T')[0];

    // 1. Overdue Only
    if (overdueOnly) {
      result = result.filter(d => d.dueDate <= today);
    }

    // 2. Date Ranges
    if (startDate) {
      result = result.filter(d => d.dueDate >= startDate);
    }
    if (endDate) {
      result = result.filter(d => d.dueDate <= endDate);
    }

    // 3. Search text
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.loanId.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.phone.includes(q)
      );
    }

    setFilteredDues(result);
  };

  const handleOpenCollect = (due: OverdueDueItem) => {
    setSelectedDue(due);
    setCollectAmount(String(due.pendingAmount));
    setCollectRemarks(`Instalment due date: ${due.dueDate}`);
  };

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue) return;
    const numAmt = Number(collectAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Operator';
      // Create collection transaction
      const tx = await supabaseFinance.createTransaction({
        loan_id: selectedDue.loanUuid,
        date: new Date().toISOString().split('T')[0],
        amount: numAmt,
        type: 'Collection',
        collected_by: staffName,
        remarks: collectRemarks || null
      }, staffName);

      if (tx) {
        toast.success(`Collected ₹${numAmt} for ${selectedDue.customerName} (${selectedDue.loanId})`);
        setSelectedDue(null);
        setCollectRemarks('');
        fetchDuesData();
      } else {
        toast.error('Collection failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dues & Overdue Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor pending/overdue instalments and execute immediate collections</p>
        </div>
        <Button onClick={() => window.print()} variant="primary" size="sm" icon={Printer}>
          Print Dues Sheet
        </Button>
      </div>

      {/* Filter Options */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100 print:hidden">
        <div className="sm:col-span-2">
          <Input
            label="Search Accounts"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by ID, Name, Phone..."
          />
        </div>
        <div>
          <Input
            label="From Due Date"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <div>
          <Input
            label="To Due Date"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
        </div>
        <div className="pb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="overdue"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="overdue" className="text-sm font-bold text-gray-700 select-none">
            Show Overdue Only
          </label>
        </div>
      </div>

      {/* Dues Collection Popup Modal */}
      {selectedDue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <p className="text-xs text-gray-500">Collect due amount for {selectedDue.customerName}</p>
            </div>
            <form onSubmit={handleCollect} className="space-y-3">
              <div className="text-xs font-semibold text-gray-600 space-y-1">
                <p>Loan ID: <span className="text-gray-900 font-bold">{selectedDue.loanId}</span></p>
                <p>Due Date: <span className="text-gray-900 font-bold">{new Date(selectedDue.dueDate).toLocaleDateString('en-IN')}</span></p>
                <p>Pending Amount: <span className="text-green-700 font-bold">₹{selectedDue.pendingAmount}</span></p>
              </div>

              <Input
                label="Amount Collected (₹)"
                type="number"
                value={collectAmount}
                onChange={setCollectAmount}
                required
              />

              <Input
                label="Remarks"
                value={collectRemarks}
                onChange={setCollectRemarks}
              />

              <div className="flex gap-2 justify-end pt-2">
                <Button type="submit" variant="success" size="sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Collect'}
                </Button>
                <Button onClick={() => setSelectedDue(null)} variant="secondary" size="sm">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dues Table list */}
      <Card title="Dues Statement List" subtitle={`${filteredDues.length} pending instalments listed`} className="shadow-md">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : filteredDues.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No pending dues found matching filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Due Date</th>
                  <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Loan ID</th>
                  <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Customer Name</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-700 uppercase">Due Amount</th>
                  <th className="px-3 py-3 text-right font-bold text-green-700 uppercase">Paid Amount</th>
                  <th className="px-3 py-3 text-right font-bold text-red-700 uppercase">Pending Amount</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase">Status</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-700 uppercase print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDues.map(due => {
                  const today = new Date().toISOString().split('T')[0];
                  const isOverdue = due.dueDate <= today;
                  return (
                    <tr key={due.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isOverdue ? (
                            <Clock className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          <span className={`font-mono font-bold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                            {new Date(due.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-bold text-gray-900 font-mono">{due.loanId}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-gray-900">{due.customerName}</div>
                        {due.phone && <div className="text-[10px] text-gray-400">{due.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">₹{due.amount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-green-600 font-bold">₹{due.paidAmount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-red-600 font-black">₹{due.pendingAmount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                           due.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {due.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap print:hidden">
                        <Button
                          onClick={() => handleOpenCollect(due)}
                          variant="success"
                          size="sm"
                          icon={DollarSign}
                        >
                          Collect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="font-extrabold text-gray-900 text-xs md:text-sm">
                  <td colSpan={3} className="px-3 py-3 text-right uppercase">Total:</td>
                  <td className="px-3 py-3 text-right">₹{filteredDues.reduce((sum, d) => sum + d.amount, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-green-700">₹{filteredDues.reduce((sum, d) => sum + d.paidAmount, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-red-700">₹{filteredDues.reduce((sum, d) => sum + d.pendingAmount, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DuesLedger;
