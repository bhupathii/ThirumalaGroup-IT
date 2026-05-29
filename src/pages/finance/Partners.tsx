import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinancePartner } from '../../lib/supabaseFinance';
import { Plus, Edit2, Trash2, User, Phone, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Partners: React.FC = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [partnerBalances, setPartnerBalances] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getPartners();
      setPartners(data);

      const entries = await supabaseFinance.getCapitalEntries();
      const balances: Record<string, number> = {};
      
      // Calculate balances (Credit is addition, Debit is withdrawal)
      entries.forEach(entry => {
        const amt = Number(entry.amount);
        if (!balances[entry.partner_id]) {
          balances[entry.partner_id] = 0;
        }
        if (entry.type === 'Credit') {
          balances[entry.partner_id] += amt;
        } else {
          balances[entry.partner_id] -= amt;
        }
      });
      setPartnerBalances(balances);
    } catch (err) {
      console.error('Error fetching partners:', err);
      toast.error('Failed to load partners data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Partner name is required');
      return;
    }

    try {
      const staffName = user?.username || 'Staff';
      if (editingId) {
        const result = await supabaseFinance.updatePartner(editingId, { name, phone }, staffName);
        if (result) {
          toast.success('Partner updated successfully');
          setEditingId(null);
        } else {
          toast.error('Failed to update partner');
        }
      } else {
        const result = await supabaseFinance.createPartner({ name, phone: phone || null });
        if (result) {
          toast.success('Partner added successfully');
        } else {
          toast.error('Failed to create partner');
        }
      }
      setName('');
      setPhone('');
      fetchData();
    } catch (err) {
      console.error('Error saving partner:', err);
      toast.error('Something went wrong');
    }
  };

  const handleEdit = (partner: FinancePartner) => {
    setEditingId(partner.id);
    setName(partner.name);
    setPhone(partner.phone || '');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this partner? All capital entries for this partner will be deleted!')) return;
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deletePartner(id, staffName);
      if (success) {
        toast.success('Partner deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete partner');
      }
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Partners Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage investment partners in Thirumala Group Finance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card title={editingId ? "Edit Partner" : "Add New Partner"} subtitle={editingId ? "Modify partner contact details" : "Register a partner for capital sharing"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Partner Name"
              value={name}
              onChange={setName}
              placeholder="e.g. John Doe"
              required
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={setPhone}
              placeholder="10-digit number"
            />
            <div className="flex gap-2 pt-2">
              <Button type="submit" variant="success" className="flex-1">
                {editingId ? "Save Changes" : "Create Partner"}
              </Button>
              {editingId && (
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setName('');
                    setPhone('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Partners List */}
        <Card title="Partner Balances & List" subtitle="List of all active partners and their total capital contributions" className="md:col-span-2 shadow">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No partners found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Partner Details</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Capital Invested</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {partners.map(partner => {
                    const balance = partnerBalances[partner.id] || 0;
                    return (
                      <tr key={partner.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-50 text-green-700 flex items-center justify-center">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{partner.name}</div>
                              {partner.phone && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" /> {partner.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-bold">
                          <span className={balance >= 0 ? "text-green-600" : "text-red-600"}>
                            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleEdit(partner)}
                              variant="secondary"
                              size="sm"
                              icon={Edit2}
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDelete(partner.id)}
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Partners;
