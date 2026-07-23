import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import { supabaseFinance, FinancePartner } from '../../lib/supabaseFinance';
import { 
  ArrowLeft, 
  UserPlus, 
  RefreshCw, 
  Search, 
  Eye, 
  Edit2, 
  X, 
  Info 
} from 'lucide-react';
import toast from 'react-hot-toast';

const Partners: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [capitalEntries, setCapitalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Partner' | 'MD'>('All');
  const [villageFilter, setVillageFilter] = useState('');
  const [sortBy, setSortBy] = useState<'Latest' | 'Name' | 'Partner ID'>('Latest');

  // Selected partner details modal state
  const [selectedPartner, setSelectedPartner] = useState<FinancePartner | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getPartners();
      setPartners(data);

      const entries = await supabaseFinance.getCapitalEntries();
      setCapitalEntries(entries);
    } catch (err) {
      console.error('Error fetching partners:', err);
      toast.error('Failed to load partners data');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic unique villages filter list
  const uniqueVillages = useMemo(() => {
    const villages = partners.map(p => p.village?.trim()).filter(Boolean);
    return Array.from(new Set(villages)) as string[];
  }, [partners]);

  // Search & Filtering calculations
  const filteredPartners = useMemo(() => {
    let result = [...partners];

    // 1. Search Query filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(p => {
        const pIdStr = String(p.partner_id || '').toLowerCase();
        const nameStr = (p.name || '').toLowerCase();
        const phoneStr = (p.phone || '').toLowerCase();
        const homePhoneStr = (p.home_phone || '').toLowerCase();
        const villageStr = (p.village || '').toLowerCase();
        const addressStr = (p.address || '').toLowerCase();

        return (
          pIdStr.includes(query) ||
          nameStr.includes(query) ||
          phoneStr.includes(query) ||
          homePhoneStr.includes(query) ||
          villageStr.includes(query) ||
          addressStr.includes(query)
        );
      });
    }

    // 2. Role filter
    if (roleFilter === 'MD') {
      result = result.filter(p => p.is_md);
    } else if (roleFilter === 'Partner') {
      result = result.filter(p => !p.is_md);
    }

    // 3. Village filter
    if (villageFilter) {
      result = result.filter(p => p.village === villageFilter);
    }

    // 4. Sorting logic
    if (sortBy === 'Name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'Partner ID') {
      result.sort((a, b) => (Number(a.partner_id) || 0) - (Number(b.partner_id) || 0));
    } else {
      // Latest
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [partners, searchQuery, roleFilter, villageFilter, sortBy]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">PARTNERS</span>
          </div>
          <h1 className="mt-1 finance-h1">PARTNERS</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            VIEW, SEARCH, AND MANAGE REGISTERED PARTNERS / MDS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={() => navigate('/finance/new-partner')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <UserPlus className="w-3.5 h-3.5" />
            NEW PARTNER
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-550" />
            REFRESH
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="shadow-sm border-slate-150 rounded-xl" title={null}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Search Box */}
          <div className="relative">
            <label className="finance-caption uppercase">
              SEARCH PARTNERS
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, ID, phone, village..."
                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-slate-850 placeholder-slate-400 focus:ring-1 focus:ring-slate-950 focus:outline-none finance-header-time"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="finance-caption uppercase">
              ROLE FILTER
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'All' | 'Partner' | 'MD')}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-855 focus:ring-1 focus:ring-slate-950 focus:outline-none finance-header-time"
            >
              <option value="All">ALL ROLES</option>
              <option value="Partner">PARTNER</option>
              <option value="MD">MD (MANAGING DIRECTOR)</option>
            </select>
          </div>

          {/* Village Filter */}
          <div>
            <label className="finance-caption uppercase">
              VILLAGE
            </label>
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-955 focus:outline-none finance-header-time"
            >
              <option value="">ALL VILLAGES</option>
              {uniqueVillages.map(v => (
                <option key={v} value={v}>{v.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="finance-caption uppercase">
              SORT BY
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'Latest' | 'Name' | 'Partner ID')}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-855 focus:ring-1 focus:ring-slate-955 focus:outline-none finance-header-time"
            >
              <option value="Latest">LATEST ADDED</option>
              <option value="Name">PARTNER NAME</option>
              <option value="Partner ID">PARTNER ID</option>
            </select>
          </div>

        </div>
      </Card>

      {/* Main Partners Table Card */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
          <p className="text-slate-500 finance-section-heading">Loading financing partners list...</p>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-150 shadow-sm space-y-4">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 max-w-fit mx-auto">
            <Info className="w-12 h-12 text-slate-350" />
          </div>
          <h2 className="finance-section-heading uppercase">No partners found</h2>
          <p className="max-w-sm mx-auto finance-small-label uppercase">
            No active financing partners match your search query or filters. Click below to add a new partner.
          </p>
          <button
            onClick={() => navigate('/finance/new-partner')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <UserPlus className="w-3.5 h-3.5" />
            ADD NEW PARTNER
          </button>
        </div>
      ) : (
        <Card 
          title={<span className="text-slate-900 finance-header-time uppercase">PARTNERS REGISTRY</span>}
          subtitle={<span className="text-slate-400 finance-small-label uppercase">LIST OF ACTIVE BUSINESS PARTNERS & MDS</span>}
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150 md:text-sm finance-caption">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="finance-small-label uppercase">S.No</th>
                  <th className="finance-small-label uppercase">Partner ID</th>
                  <th className="finance-small-label uppercase">Name</th>
                  <th className="finance-small-label uppercase">Role</th>
                  <th className="finance-small-label uppercase">Phone</th>
                  <th className="finance-small-label uppercase">Home Phone</th>
                  <th className="finance-small-label uppercase">Village</th>
                  <th className="finance-small-label uppercase">Created Date</th>
                  <th className="text-right finance-small-label uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPartners.map((partner, index) => (
                  <tr key={partner.id} className="hover:bg-slate-50/20">
                    <td className="px-3 py-3 text-slate-500 finance-input">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-800 finance-input">
                      #{partner.partner_id || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-900 finance-input">
                      {partner.name}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${ partner.is_md ? 'bg-[#0b1329] text-white' : 'bg-slate-100 text-slate-800' } finance-small-label uppercase`}>
                        {partner.is_md ? 'MD' : 'Partner'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700 finance-input">
                      {partner.phone || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-700 finance-input">
                      {partner.home_phone || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600 finance-input">
                      {partner.village || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-500 finance-input">
                      {new Date(partner.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedPartner(partner)}
                          title="View Details"
                          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => navigate(`/finance/new-partner?edit=${partner.id}`)}
                          title="Edit Partner"
                          className="p-1.5 text-blue-650 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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

      {/* Details View Modal */}
      {/* Details View Modal */}
      {selectedPartner && (() => {
        const partnerTx = capitalEntries.filter(tx => tx.partner_id === selectedPartner.id);
        const totalCred = partnerTx.reduce((sum, tx) => sum + Number(tx.credit || 0), 0);
        const totalDeb = partnerTx.reduce((sum, tx) => sum + Number(tx.debit || 0), 0);
        const netBal = totalCred - totalDeb;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100">
              
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#0b1329] text-white flex justify-between items-center">
                <div>
                  <h3 className="finance-sidebar-link uppercase font-bold text-base">Partner Profile & Capital History</h3>
                  <p className="text-slate-400 finance-small-label uppercase">ID: #{selectedPartner.partner_id || 'N/A'}</p>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 md:text-sm finance-caption overflow-y-auto max-h-[75vh]">
                
                {/* Profile Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-slate-900 font-bold mb-3 uppercase tracking-wider text-xs">PARTNER MASTER DETAILS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-slate-400 finance-small-label uppercase">Partner Name</div>
                      <div className="text-slate-900 font-bold">{selectedPartner.name}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 finance-small-label uppercase">Role</div>
                      <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${ selectedPartner.is_md ? 'bg-[#0b1329] text-white' : 'bg-slate-200 text-slate-800' } uppercase`}>
                        {selectedPartner.is_md ? 'MANAGING PARTNER' : 'PARTNER'}
                      </span>
                    </div>
                    <div>
                      <div className="text-slate-400 finance-small-label uppercase">Phone</div>
                      <div className="text-slate-900 font-bold">{selectedPartner.phone || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 finance-small-label uppercase">Home Phone</div>
                      <div className="text-slate-900">{selectedPartner.home_phone || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 finance-small-label uppercase">Village</div>
                      <div className="text-slate-900">{selectedPartner.village || '—'}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="text-slate-400 finance-small-label uppercase">Address</div>
                    <div className="text-slate-700 mt-1">{selectedPartner.address || '—'}</div>
                  </div>
                </div>

                {/* Capital Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl">
                    <span className="text-emerald-700 block text-[10px] font-black uppercase">Capital Introduced (Credit)</span>
                    <span className="text-emerald-800 text-lg font-black block mt-1 font-mono">
                      ₹{totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-red-50 border border-red-150 p-4 rounded-xl">
                    <span className="text-red-700 block text-[10px] font-black uppercase">Capital Withdrawn (Debit)</span>
                    <span className="text-red-800 text-lg font-black block mt-1 font-mono">
                      ₹{totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-100 border border-slate-250 p-4 rounded-xl">
                    <span className="text-slate-700 block text-[10px] font-black uppercase">Net Capital Balance</span>
                    <span className={`text-lg font-black block mt-1 font-mono ${netBal >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                      ₹{netBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Capital History Section */}
                <div>
                  <h4 className="text-slate-900 font-bold mb-3 uppercase tracking-wider text-xs">PARTNER TRANSACTION / CAPITAL HISTORY</h4>
                  {partnerTx.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                      <p className="text-slate-400 font-medium">No capital transactions registered for this partner.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Particulars / Remarks</th>
                            <th className="px-4 py-3 text-right">Debit (Withdrawal)</th>
                            <th className="px-4 py-3 text-right">Credit (Intro)</th>
                            <th className="px-4 py-3">Entered By</th>
                            <th className="px-4 py-3">Entry Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[12px] font-medium text-slate-700">
                          {partnerTx.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono">{new Date(tx.entry_date).toLocaleDateString('en-GB')}</td>
                              <td className="px-4 py-2.5">{tx.particulars || 'Capital Entry'}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-red-600">
                                {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-emerald-600">
                                {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td className="px-4 py-2.5">{tx.created_by || 'Staff'}</td>
                              <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">
                                {tx.created_at ? new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t flex justify-end">
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="px-4 py-1.5 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors shadow-sm finance-header-time"
                >
                  CLOSE
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Partners;
