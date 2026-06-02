import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceCustomer } from '../../lib/supabaseFinance';
import { User, Phone, MapPin, Search, Edit, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Customers: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [filtered, setFiltered] = useState<FinanceCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(customers);
      return;
    }
    const q = search.toLowerCase();
    const filteredList = customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.aadhaar && c.aadhaar.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
    setFiltered(filteredList);
  }, [search, customers]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getCustomers();
      setCustomers(data);
      setFiltered(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customers list');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer ${name}? This will fail if they have active loans.`)) {
      return;
    }
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteCustomer(id, staffName);
      if (success) {
        toast.success(`Customer ${name} deleted successfully`);
        fetchCustomers();
      } else {
        toast.error('Delete failed. Verify customer has no linked loans.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Customers Registry</h1>
          <p className="text-gray-500 text-sm mt-1">Directory of all registered borrowers in the system</p>
        </div>
        <Button
          onClick={() => navigate('/finance/new-customer')}
          variant="success"
          size="sm"
          icon={Plus}
        >
          Add Customer
        </Button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md bg-white rounded-xl shadow-sm border border-gray-150 p-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone number, Aadhaar UID..."
          className="w-full bg-transparent pl-10 pr-4 py-2.5 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none"
        />
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
      </div>

      {/* Customer Registry Card */}
      <Card title="Borrowers Database" subtitle={`${filtered.length} total profiles registered`} className="shadow">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No customer profiles found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Father/Husband Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Aadhaar UID</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((cust) => (
                  <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full border overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                        {cust.customer_photo_url ? (
                          <img
                            src={cust.customer_photo_url}
                            alt={cust.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                      {cust.name}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-650">
                      {cust.father_husband_name || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> {cust.phone || 'N/A'}</span>
                        {cust.phone2 && <span className="text-[10px] text-gray-400 mt-0.5">{cust.phone2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                      {cust.aadhaar || '-'}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-550 max-w-xs truncate">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{cust.address || '-'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-xs">
                      <div className="flex justify-end gap-2">
                        {/* We don't have separate edit customer page, but we can direct them to Aadhaar search or loan edit, 
                            or delete here if allowed */}
                        <Button
                          onClick={() => handleDelete(cust.id, cust.name)}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Customers;
