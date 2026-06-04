import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import { supabaseFinance, FinanceCustomer } from '../../lib/supabaseFinance';
import { 
  User, 
  Phone, 
  MapPin, 
  Search, 
  Edit2, 
  Trash2, 
  Plus, 
  ArrowLeft, 
  RefreshCw, 
  Info 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Customers: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'Latest' | 'Name' | 'Customer ID'>('Latest');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getCustomers();
      setCustomers(data);
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
    const deleteToastId = toast.loading(`Deleting customer profile...`);
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteCustomer(id, staffName);
      if (success) {
        toast.success(`Customer ${name} deleted successfully`, { id: deleteToastId });
        fetchCustomers();
      } else {
        toast.error('Delete failed. Verify customer has no linked loans.', { id: deleteToastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong during deletion', { id: deleteToastId });
    }
  };

  // Search & Filtering calculations
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // 1. Search Query filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(c => {
        const cIdStr = String(c.customer_id || '').toLowerCase();
        const nameStr = (c.name || '').toLowerCase();
        const phoneStr = (c.phone || '').toLowerCase();
        const phone2Str = (c.phone2 || '').toLowerCase();
        const fatherStr = (c.father_husband_name || c.father_name || '').toLowerCase();
        const aadhaarStr = (c.aadhaar || '').toLowerCase();
        const villageStr = (c.village || '').toLowerCase();
        const mandalStr = (c.mandal || '').toLowerCase();
        const districtStr = (c.district || '').toLowerCase();
        const addressStr = (c.address || '').toLowerCase();

        return (
          cIdStr.includes(query) ||
          nameStr.includes(query) ||
          phoneStr.includes(query) ||
          phone2Str.includes(query) ||
          fatherStr.includes(query) ||
          aadhaarStr.includes(query) ||
          villageStr.includes(query) ||
          mandalStr.includes(query) ||
          districtStr.includes(query) ||
          addressStr.includes(query)
        );
      });
    }

    // 2. Sorting logic
    if (sortBy === 'Name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'Customer ID') {
      result.sort((a, b) => (Number(a.customer_id) || 0) - (Number(b.customer_id) || 0));
    } else {
      // Latest
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [customers, searchQuery, sortBy]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">CUSTOMERS</span>
          </div>
          <h1 className="finance-page-title mt-1">CUSTOMERS</h1>
          <p className="finance-page-subtitle mt-0.5">
            VIEW, SEARCH, AND MANAGE REGISTERED BORROWERS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 finance-button-text bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={fetchCustomers}
            className="inline-flex items-center gap-1.5 px-3 py-2 finance-button-text bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            REFRESH
          </button>
          <button
            onClick={() => navigate('/finance/new-customer')}
            className="inline-flex items-center gap-1.5 px-4 py-2 finance-button-text bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            NEW CUSTOMER
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="shadow-sm border-slate-150 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search box */}
          <div className="md:col-span-2 relative">
            <label className="finance-label">
              SEARCH CUSTOMERS
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, Aadhaar UID, village..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 shadow-sm"
              />
            </div>
          </div>

          {/* Sort selection */}
          <div>
            <label className="finance-label">
              SORT BY
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'Latest' | 'Name' | 'Customer ID')}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-855 focus:ring-1 focus:ring-slate-955 focus:outline-none h-9 shadow-sm"
            >
              <option value="Latest">LATEST REGISTERED</option>
              <option value="Name">CUSTOMER NAME</option>
              <option value="Customer ID">CUSTOMER ID</option>
            </select>
          </div>

        </div>
      </Card>

      {/* Main Customers List Card */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
          <p className="text-sm font-semibold text-slate-500">Loading customers database...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-150 shadow-sm space-y-4">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 max-w-fit mx-auto">
            <Info className="w-12 h-12 text-slate-350" />
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">No customers found</h2>
          <p className="finance-page-subtitle max-w-sm mx-auto leading-normal">
            No active customer profiles match your search criteria. Click below to add a new borrower.
          </p>
          <button
            onClick={() => navigate('/finance/new-customer')}
            className="inline-flex items-center gap-1.5 px-4 py-2 finance-button-text bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            ADD CUSTOMER
          </button>
        </div>
      ) : (
        <Card 
          title={<span className="text-xs font-black text-slate-900 tracking-wider uppercase">BORROWERS DATABASE</span>}
          subtitle={<span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">LIST OF ACTIVE REGISTERED CUSTOMERS</span>}
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150 text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="finance-table-header">S.No</th>
                  <th className="finance-table-header">Customer ID</th>
                  <th className="finance-table-header">Photo</th>
                  <th className="finance-table-header">Name</th>
                  <th className="finance-table-header">Father Name</th>
                  <th className="finance-table-header">Contact Info</th>
                  <th className="finance-table-header">Aadhaar UID</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-500 tracking-wider uppercase">Village/Mandal</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredCustomers.map((cust, index) => (
                  <tr key={cust.id} className="hover:bg-slate-50/20">
                    <td className="px-3 py-3 font-semibold text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-800">
                      #{cust.customer_id || '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full border overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-inner">
                        {cust.customer_photo_url ? (
                          <img
                            src={cust.customer_photo_url}
                            alt={cust.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-slate-450" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {cust.name}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700">
                      {cust.father_name || cust.father_husband_name || '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col text-slate-700">
                        <span className="font-bold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-450" />
                          {cust.phone || cust.phone_1 || 'N/A'}
                        </span>
                        {(cust.phone2 || cust.phone_2) && (
                          <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {cust.phone2 || cust.phone_2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-650">
                      {cust.aadhaar ? cust.aadhaar.replace(/(\d{4})/g, '$1 ').trim() : '—'}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-600 max-w-xs truncate">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {cust.village ? `${cust.village.toUpperCase()}` : ''}
                          {cust.mandal ? `, ${cust.mandal.toUpperCase()}` : ''}
                          {!cust.village && !cust.mandal && (cust.address || '—')}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/finance/new-customer?edit=${cust.id}`)}
                          title="Edit Customer"
                          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cust.id, cust.name)}
                          title="Delete Customer"
                          className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Customers;
