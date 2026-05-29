import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const HPLedger: React.FC = () => {
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = ledgerRows.filter(row => 
      (row.loanId.toLowerCase().includes(q) ||
      row.customerName.toLowerCase().includes(q) ||
      (row.phone && row.phone.includes(q)))
    );
    setFilteredRows(filtered);
  }, [searchQuery, ledgerRows]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const loans = await supabaseFinance.getLoans();
      const txs = await supabaseFinance.getTransactions();

      // Filter for Hire Purchase prefix "HP" or "H-"
      const hpLoans = loans.filter(l => 
        l.loan_id.toUpperCase().startsWith('HP') || 
        l.loan_id.toUpperCase().startsWith('H-')
      );

      const rows = hpLoans.map(loan => {
        const cols = txs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
        const totalCollected = cols.reduce((sum, c) => sum + Number(c.amount), 0);

        const principal = Number(loan.amount);
        const interestRate = Number(loan.interest_rate);
        const duration = Number(loan.duration_months);
        
        const interestAmount = principal * (interestRate / 100) * duration;
        const totalRepayable = principal + interestAmount;
        const outstanding = Math.max(0, totalRepayable - totalCollected);

        return {
          id: loan.id,
          loanId: loan.loan_id,
          customerName: loan.customer?.name || 'N/A',
          phone: loan.customer?.phone || '',
          date: loan.date,
          principal,
          interestRate,
          duration,
          interestAmount,
          totalRepayable,
          totalCollected,
          outstanding,
          status: loan.status
        };
      });

      setLedgerRows(rows);
      setFilteredRows(rows);
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile HP Ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      <div className="flex justify-between items-center border-b border-green-100 pb-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">HP (Hire Purchase) Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">Review accounts starting with the 'HP' or 'H-' identifier prefix</p>
        </div>
        <Button onClick={() => window.print()} variant="primary" size="sm" icon={Printer}>
          Print Ledger
        </Button>
      </div>

      <div className="max-w-md print:hidden">
        <Input
          label="Filter HP Accounts"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by ID, Name, Phone..."
        />
      </div>

      <Card title="HP Ledger Index" subtitle="Hire Purchase receivables summary" className="shadow-md">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No HP ledger entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Loan ID</th>
                  <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Customer</th>
                  <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Disbursed</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-700 uppercase">Principal</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-700 uppercase">Interest</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-700 uppercase">Total Repayable</th>
                  <th className="px-3 py-3 text-right font-bold text-green-700 uppercase">Collected (Cr)</th>
                  <th className="px-3 py-3 text-right font-bold text-orange-700 uppercase">Receivable (Dr)</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 font-bold text-gray-900 font-mono">{row.loanId}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-gray-900">{row.customerName}</div>
                      {row.phone && <div className="text-[10px] text-gray-400 mt-0.5">{row.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      ₹{row.principal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 font-semibold">
                      ₹{row.interestAmount.toLocaleString('en-IN')} <span className="text-[9px]">({row.interestRate}%)</span>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">
                      ₹{row.totalRepayable.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-green-600">
                      ₹{row.totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-orange-700">
                      ₹{row.outstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .shadow-md, .shadow-md * {
            visibility: visible;
          }
          .shadow-md {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border: none !important;
          }
          aside, nav, header, button, input, label, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HPLedger;
