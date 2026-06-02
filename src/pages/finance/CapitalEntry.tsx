import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinancePartner, FinanceCapitalEntry } from '../../lib/supabaseFinance';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const CapitalEntry: React.FC = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [entries, setEntries] = useState<(FinanceCapitalEntry & { partner: FinancePartner })[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'Credit' | 'Debit'>('Credit');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = await supabaseFinance.getPartners();
      setPartners(p);

      const e = await supabaseFinance.getCapitalEntries();
      setEntries(e);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load capital details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) {
      toast.error('Please select a partner');
      return;
    }
    const numAmt = Number(amount);
    if (!amount || isNaN(numAmt) || numAmt <= 0) {
      toast.error('Please enter a valid amount greater than zero');
      return;
    }

    try {
      const result = await supabaseFinance.createCapitalEntry({
        date,
        partner_id: partnerId,
        amount: numAmt,
        type,
        remarks: remarks || null
      });

      if (result) {
        toast.success(`${type === 'Credit' ? 'Deposit' : 'Withdrawal'} logged successfully`);
        setAmount('');
        setRemarks('');
        fetchData();
      } else {
        toast.error('Failed to save capital entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this capital entry?')) return;
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteCapitalEntry(id, staffName);
      if (success) {
        toast.success('Capital entry deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Deletion failed');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">CAPITAL ENTRY</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Record deposits or withdrawals by investment partners</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card title="Record Transaction" subtitle="Invest (Credit) or Withdraw (Debit) funds">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                Select Partner *
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                required
              >
                <option value="">-- Choose Partner --</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <Input
              label="Transaction Date"
              type="date"
              value={date}
              onChange={setDate}
              required
            />

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                Transaction Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('Credit')}
                  className={`py-2 px-4 rounded-lg font-bold border transition-all text-sm ${
                    type === 'Credit'
                      ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Deposit (Credit)
                </button>
                <button
                  type="button"
                  onClick={() => setType('Debit')}
                  className={`py-2 px-4 rounded-lg font-bold border transition-all text-sm ${
                    type === 'Debit'
                      ? 'bg-red-100 text-red-700 border-red-300 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Withdrawal (Debit)
                </button>
              </div>
            </div>

            <Input
              label="Amount (₹)"
              type="number"
              value={amount}
              onChange={setAmount}
              placeholder="e.g. 50000"
              required
            />

            <Input
              label="Remarks / Particulars"
              value={remarks}
              onChange={setRemarks}
              placeholder="e.g. Cash investment"
            />

            <Button type="submit" variant="success" className="w-full pt-2">
              Submit Capital Entry
            </Button>
          </form>
        </Card>

        {/* Capital Entries Ledger */}
        <Card title="Capital Entry History" subtitle="A list of recent deposits and withdrawals" className="md:col-span-2 shadow">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No capital entries logged yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Partner</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Deposit (Cr)</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Withdraw (Dr)</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                        {entry.partner?.name || 'Unknown'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500">
                        {entry.remarks || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-bold text-green-600">
                        {entry.type === 'Credit' ? `₹${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-bold text-red-600">
                        {entry.type === 'Debit' ? `₹${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm">
                        <Button
                          onClick={() => handleDelete(entry.id)}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CapitalEntry;
