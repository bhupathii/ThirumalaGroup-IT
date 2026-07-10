import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, RefreshCw, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface PartnerPerfRow {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  totalCredit: number;
  totalDebit: number;
  netCapital: number;
  txCount: number;
  lastEntryDate: string;
}

const PartnerPerformance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PartnerPerfRow[]>([]);
  const [capitalEntries, setCapitalEntries] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    netCapital: 0,
    txCount: 0
  });
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const partners = await supabaseFinance.getPartners();
      
      const { data: fetchedCapEntries } = await supabase
        .from('finance_capital_entries')
        .select('*');

      const capEntries = fetchedCapEntries || [];
      setCapitalEntries(capEntries);

      let totalNetCapital = 0;
      let totalTxCount = 0;

      const perfRows: PartnerPerfRow[] = partners.map(partner => {
        const partnerTxs = capEntries.filter(c => c.partner_id === partner.id);
        
        let cr = 0;
        let dr = 0;
        let lastDate = '—';
        let latestTime = 0;

        partnerTxs.forEach(t => {
          cr += Number(t.credit) || 0;
          dr += Number(t.debit) || 0;
          
          const tTime = new Date(t.entry_date).getTime();
          if (tTime > latestTime) {
            latestTime = tTime;
            lastDate = t.entry_date;
          }
        });

        const net = cr - dr;
        totalNetCapital += net;
        totalTxCount += partnerTxs.length;

        return {
          id: partner.id,
          name: partner.name,
          phone: partner.phone,
          role: partner.is_md ? 'MD' : 'Partner',
          totalCredit: cr,
          totalDebit: dr,
          netCapital: net,
          txCount: partnerTxs.length,
          lastEntryDate: lastDate
        };
      });

      perfRows.sort((a, b) => b.netCapital - a.netCapital);

      setRows(perfRows);
      setTotals({
        netCapital: totalNetCapital,
        txCount: totalTxCount
      });

    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze partner performance');
    } finally {
      setLoading(false);
    }
  };

  // TODO: Partner profit sharing ratios are not finalized by the client yet.
  // When business rules are finalized, implement profit ratio calculation here.

  // Drilldown entries
  const drillDownEntries = useMemo(() => {
    if (!selectedPartnerId) return [];
    return capitalEntries
      .filter(c => c.partner_id === selectedPartnerId)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }, [capitalEntries, selectedPartnerId]);

  const selectedPartner = useMemo(() => {
    if (!selectedPartnerId) return null;
    return rows.find(r => r.id === selectedPartnerId);
  }, [rows, selectedPartnerId]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">Partner Performance</h1>
          <p className="finance-small-label uppercase font-black text-slate-500">Review capital contributions and transaction logs per partner</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPerformanceData} variant="secondary" size="sm" icon={RefreshCw}>
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
            Print Statement
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={`flex justify-center py-12 ${showPrintPreview ? 'print:hidden' : ''}`}>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : (
        <div className={`space-y-6 ${showPrintPreview ? 'print:hidden' : ''}`}>
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border shadow-xs">
              <span className="text-slate-500 block finance-header-time uppercase">Total Capital Pools</span>
              <span className="text-slate-900 finance-brand">₹{totals.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-xs">
              <span className="text-blue-700 block finance-header-time uppercase">Total Transactions</span>
              <span className="text-blue-800 finance-brand">{totals.txCount} Entries</span>
            </div>
          </div>

          <Card title="Partner Capital Registry" subtitle="Factual net contributions and ledger status. Click row to view ledger details." className="shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
                <thead>
                  <tr className="bg-gray-150 text-slate-400">
                    <th className="finance-small-label uppercase">Partner Name</th>
                    <th className="finance-small-label uppercase">Role</th>
                    <th className="text-right finance-small-label uppercase">Total Credit</th>
                    <th className="text-right finance-small-label uppercase">Total Debit</th>
                    <th className="text-right finance-small-label uppercase">Net Capital</th>
                    <th className="text-center finance-small-label uppercase">Tx Count</th>
                    <th className="finance-small-label uppercase">Last Entry Date</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedPartnerId(row.id)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 text-gray-900 font-bold uppercase finance-input">
                        {row.name}
                        {row.phone && <div className="text-gray-400 finance-small-label font-normal">{row.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-semibold uppercase">{row.role}</td>
                      <td className="px-3 py-3 text-right text-emerald-600 font-medium">₹{row.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right text-rose-650 font-medium">₹{row.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className={`px-3 py-3 text-right font-black ${row.netCapital >= 0 ? 'text-emerald-850' : 'text-rose-850'}`}>
                        ₹{row.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700">{row.txCount}</td>
                      <td className="px-3 py-3 text-slate-650 font-mono">{row.lastEntryDate.split('-').reverse().join('/')}</td>
                      <td className="px-3 py-3 text-slate-400 text-center"><ChevronRight className="w-4 h-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Drill Down Modal */}
      {selectedPartnerId && selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full h-[75vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">
                  Capital History: {selectedPartner.name} ({selectedPartner.role})
                </h3>
                <p className="text-xs text-slate-500 font-semibold uppercase mt-0.5">Net capital: ₹{selectedPartner.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <button 
                onClick={() => setSelectedPartnerId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="min-w-full divide-y divide-slate-150 finance-caption">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="finance-small-label uppercase">Sl</th>
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="text-right finance-small-label uppercase">Credit (Cr)</th>
                      <th className="text-right finance-small-label uppercase">Debit (Dr)</th>
                      <th className="finance-small-label uppercase">Particulars</th>
                      <th className="finance-small-label uppercase">Entered By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {drillDownEntries.map((e, idx) => (
                      <tr key={e.id} className="hover:bg-slate-50/20">
                        <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-slate-650 font-mono">{e.entry_date.split('-').reverse().join('/')}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">
                          {Number(e.credit) > 0 ? `₹${Number(e.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-600 font-medium">
                          {Number(e.debit) > 0 ? `₹${Number(e.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 finance-input">{e.particulars}</td>
                        <td className="px-3 py-2.5 text-slate-500 uppercase">{e.created_by || 'Staff'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Partner Performance Sheet"
        documentTitle="PARTNER PERFORMANCE REPORT"
      >
        {!loading && (
          <div className="space-y-6 mt-6 text-[10px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-slate-900">
                  <th className="p-2 text-left">Partner Name</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-right">Total Credit</th>
                  <th className="p-2 text-right">Total Debit</th>
                  <th className="p-2 text-right">Net Capital</th>
                  <th className="p-2 text-center">Tx Count</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-2 uppercase font-bold">{row.name}</td>
                    <td className="p-2 uppercase font-semibold">{row.role}</td>
                    <td className="p-2 text-right">₹{row.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">₹{row.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-black">₹{row.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-center">{row.txCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default PartnerPerformance;
