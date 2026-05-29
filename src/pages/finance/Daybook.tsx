import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Calendar, Printer, FileText, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface DaybookItem {
  id: string;
  source: 'Transaction' | 'Capital';
  particulars: string;
  type: string; // 'Collection', 'Disbursement', 'Capital Credit', etc.
  cashIn: number;
  cashOut: number;
  remarks: string | null;
}

const Daybook: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  
  const [openingBalance, setOpeningBalance] = useState(0);
  const [daybookItems, setDaybookItems] = useState<DaybookItem[]>([]);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  useEffect(() => {
    fetchDaybookData();
  }, [selectedDate]);

  const fetchDaybookData = async () => {
    setLoading(true);
    try {
      // 1. Calculate Opening Balance (Net flow before selectedDate)
      // Receipts: collections & capital credits before date
      // Payments: disbursements & capital debits before date
      const allTx = await supabaseFinance.getTransactions();
      const allCapital = await supabaseFinance.getCapitalEntries();

      let opBal = 0;
      allTx.forEach(tx => {
        if (tx.date < selectedDate) {
          if (tx.type === 'Collection') {
            opBal += Number(tx.amount);
          } else if (tx.type === 'Disbursement') {
            opBal -= Number(tx.amount);
          }
        }
      });

      allCapital.forEach(cap => {
        if (cap.date < selectedDate) {
          if (cap.type === 'Credit') {
            opBal += Number(cap.amount);
          } else {
            opBal -= Number(cap.amount);
          }
        }
      });

      setOpeningBalance(opBal);

      // 2. Fetch items for selectedDate
      const items: DaybookItem[] = [];
      let inSum = 0;
      let outSum = 0;

      // Filter transactions for this date
      const dateTx = allTx.filter(tx => tx.date === selectedDate);
      dateTx.forEach(tx => {
        const amt = Number(tx.amount);
        const isCollection = tx.type === 'Collection';
        items.push({
          id: tx.id,
          source: 'Transaction',
          particulars: isCollection 
            ? `Collection Recd - ${tx.loan?.customer?.name || 'N/A'} (${tx.loan?.loan_id || 'N/A'})`
            : `Loan Disbursed - ${tx.loan?.customer?.name || 'N/A'} (${tx.loan?.loan_id || 'N/A'})`,
          type: tx.type,
          cashIn: isCollection ? amt : 0,
          cashOut: !isCollection ? amt : 0,
          remarks: tx.remarks
        });
        if (isCollection) inSum += amt;
        else outSum += amt;
      });

      // Filter capital entries for this date
      const dateCap = allCapital.filter(cap => cap.date === selectedDate);
      dateCap.forEach(cap => {
        const amt = Number(cap.amount);
        const isCredit = cap.type === 'Credit';
        items.push({
          id: cap.id,
          source: 'Capital',
          particulars: isCredit
            ? `Capital Invested by Partner - ${cap.partner?.name || 'N/A'}`
            : `Capital Withdrawn by Partner - ${cap.partner?.name || 'N/A'}`,
          type: isCredit ? 'Capital Deposit' : 'Capital Withdraw',
          cashIn: isCredit ? amt : 0,
          cashOut: !isCredit ? amt : 0,
          remarks: cap.remarks
        });
        if (isCredit) inSum += amt;
        else outSum += amt;
      });

      setDaybookItems(items);
      setTotalCashIn(inSum);
      setTotalCashOut(outSum);
      setClosingBalance(opBal + inSum - outSum);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Daybook ledger');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Finance Daybook</h1>
          <p className="text-gray-500 text-sm mt-1">Review cash inflow and outflow transactions for any specific business day</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="primary" size="sm" icon={Printer}>
            Print Daybook
          </Button>
        </div>
      </div>

      <div className="max-w-xs print:hidden">
        <Input
          label="Select Daybook Date"
          type="date"
          value={selectedDate}
          onChange={setSelectedDate}
        />
      </div>

      {/* Daybook Sheet */}
      <Card
        title={
          <div className="flex justify-between items-center w-full">
            <span>Daybook Statement</span>
            <span className="font-mono text-sm text-gray-500">
              Date: {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
        }
        subtitle="Receipts & Payments cashbook breakdown"
        className="shadow-md border-green-100"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Balance Headers */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded border">
                <span className="text-gray-500 text-xs font-semibold block uppercase">Opening Balance</span>
                <span className="text-lg font-bold text-gray-900">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-green-50 rounded border border-green-100">
                <span className="text-green-700 text-xs font-bold block uppercase">Total Receipts (+)</span>
                <span className="text-lg font-bold text-green-800">₹{totalCashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-red-50 rounded border border-red-100">
                <span className="text-red-700 text-xs font-bold block uppercase">Total Payments (-)</span>
                <span className="text-lg font-bold text-red-800">₹{totalCashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-emerald-100 rounded border border-emerald-200">
                <span className="text-emerald-800 text-xs font-black block uppercase">Closing Balance</span>
                <span className="text-xl font-black text-emerald-900">₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Particulars / Account</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Voucher Type</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase">Remarks</th>
                    <th className="px-3 py-3 text-right font-bold text-green-700 uppercase">Receipts (Cr)</th>
                    <th className="px-3 py-3 text-right font-bold text-red-700 uppercase">Payments (Dr)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {daybookItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-400 font-semibold">
                        No transactions recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    daybookItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-3 font-bold text-gray-900">{item.particulars}</td>
                        <td className="px-3 py-3 font-semibold text-gray-600 capitalize">{item.type}</td>
                        <td className="px-3 py-3 text-gray-500">{item.remarks || '-'}</td>
                        <td className="px-3 py-3 text-right font-extrabold text-green-600">
                          {item.cashIn > 0 ? `₹${item.cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-red-600">
                          {item.cashOut > 0 ? `₹${item.cashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                  {/* Total row */}
                  <tr className="bg-gray-50 font-extrabold">
                    <td colSpan={3} className="px-3 py-3 text-right text-gray-800 uppercase">Total Cash Flow:</td>
                    <td className="px-3 py-3 text-right text-green-700 text-base">₹{totalCashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right text-red-700 text-base">₹{totalCashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Print Signatures */}
            <div className="hidden print:flex justify-between items-center mt-20 pt-8 border-t text-xs">
              <div>
                <p className="font-bold text-gray-700">Cashier Signature</p>
                <p className="text-[10px] text-gray-400 mt-8">Authorized Signatory</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-700">Verified By Manager</p>
                <p className="text-[10px] text-gray-400 mt-8">Partner Audit Sign</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Print helper styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .shadow-md {
            box-shadow: none !important;
            border: none !important;
          }
          .p-6 {
            padding: 0 !important;
          }
          .shadow-md * {
            visibility: visible;
          }
          .shadow-md {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          aside, nav, header, button, input, label, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Daybook;
