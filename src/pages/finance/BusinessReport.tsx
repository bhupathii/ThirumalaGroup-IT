import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, ShieldAlert, Phone, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface ExpiredLoanItem {
  id: string;
  loanId: string;
  customerName: string;
  phone: string;
  disbursedDate: string;
  expiryDate: string;
  outstanding: number;
  monthsOverdue: number;
}

const BusinessReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeLoansCount: 0,
    totalDisbursed: 0,
    totalCollected: 0,
    outstandingReceivables: 0,
    overdueLoansCount: 0
  });
  const [expiredLoans, setExpiredLoans] = useState<ExpiredLoanItem[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const loans = await supabaseFinance.getLoans();
      const txs = await supabaseFinance.getTransactions();

      let activeCount = 0;
      let totalDisbursed = 0;
      let totalInterestAccrued = 0;
      const today = new Date();
      const expiredItems: ExpiredLoanItem[] = [];

      // Sum collections
      const totalCollected = txs
        .filter(t => t.type === 'Collection')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Loop through loans
      loans.forEach(loan => {
        const principal = Number(loan.amount);
        const rate = Number(loan.interest_rate);
        const duration = Number(loan.duration_months);
        const interestAmount = principal * (rate / 100) * duration;
        
        if (loan.status === 'Active') {
          activeCount++;
          totalDisbursed += principal;
          totalInterestAccrued += interestAmount;

          // Check if loan is expired (today's date exceeds loan date + duration_months)
          const loanDate = new Date(loan.date);
          const expiryDate = new Date(loanDate);
          expiryDate.setMonth(loanDate.getMonth() + duration);

          if (today >= expiryDate) {
            // Find total collected for this loan
            const loanCols = txs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
            const loanCollected = loanCols.reduce((sum, c) => sum + Number(c.amount), 0);
            const loanRepayable = principal + interestAmount;
            const outstanding = Math.max(0, loanRepayable - loanCollected);

            if (outstanding > 0) {
              const diffTime = Math.abs(today.getTime() - expiryDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const monthsOverdue = Math.floor(diffDays / 30);

              expiredItems.push({
                id: loan.id,
                loanId: loan.loan_id,
                customerName: loan.customer?.name || 'N/A',
                phone: loan.customer?.phone || '',
                disbursedDate: loan.date,
                expiryDate: expiryDate.toISOString().split('T')[0],
                outstanding,
                monthsOverdue
              });
            }
          }
        }
      });

      const totalRepayable = totalDisbursed + totalInterestAccrued;
      const outstandingReceivables = Math.max(0, totalRepayable - totalCollected);

      setStats({
        activeLoansCount: activeCount,
        totalDisbursed,
        totalCollected,
        outstandingReceivables,
        overdueLoansCount: expiredItems.length
      });

      setExpiredLoans(expiredItems);

    } catch (err) {
      console.error(err);
      toast.error('Failed to generate operational business report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Business & Expiry Report</h1>
          <p className="text-gray-500 text-sm mt-1">Track active loans completion metrics and expiring loan accounts audit</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print Report
        </Button>
      </div>

      {loading ? (
        <div className={`flex justify-center py-12 ${showPrintPreview ? 'print:hidden' : ''}`}>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : (
        <div className={`space-y-6 ${showPrintPreview ? 'print:hidden' : ''}`}>
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 text-xs font-semibold block uppercase">Active Loans Count</span>
              <span className="text-lg font-bold text-gray-900">{stats.activeLoansCount} Accounts</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 text-xs font-semibold block uppercase">Principal Disbursed</span>
              <span className="text-lg font-bold text-gray-900">₹{stats.totalDisbursed.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 text-xs font-semibold block uppercase">Outstanding Receivable</span>
              <span className="text-lg font-bold text-orange-700">₹{stats.outstandingReceivables.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-red-50 rounded border border-red-100">
              <span className="text-red-700 text-xs font-bold block uppercase">Overdue Expiries</span>
              <span className="text-lg font-extrabold text-red-800">{stats.overdueLoansCount} Overdue</span>
            </div>
          </div>

          {/* Expired / Overdue Checklist */}
          <Card
            title={
              <div className="flex items-center gap-2 text-red-800">
                <ShieldAlert className="w-5 h-5" />
                <span>Expired Active Accounts Checklist</span>
              </div>
            }
            subtitle="Active accounts whose duration months have expired but still have outstanding balances"
            className="border-red-100 bg-red-50/10"
          >
            {expiredLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No overdue expired loans found. All accounts are within duration terms!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-red-200 text-xs md:text-sm">
                  <thead>
                    <tr className="bg-red-50 text-red-950 font-bold">
                      <th className="px-3 py-3 text-left">Loan ID</th>
                      <th className="px-3 py-3 text-left">Customer Name</th>
                      <th className="px-3 py-3 text-left">Disbursed Date</th>
                      <th className="px-3 py-3 text-left">Contract Expiry</th>
                      <th className="px-3 py-3 text-center">Months Overdue</th>
                      <th className="px-3 py-3 text-right">Outstanding Bal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-red-100">
                    {expiredLoans.map(loan => (
                      <tr key={loan.id} className="hover:bg-red-50/20 font-medium">
                        <td className="px-3 py-3 font-bold text-gray-900 font-mono">{loan.loanId}</td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-gray-900">{loan.customerName}</div>
                          {loan.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {loan.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {new Date(loan.disbursedDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-red-600 font-bold">
                          {new Date(loan.expiryDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold text-xs">
                            <Clock className="w-3 h-3" /> {loan.monthsOverdue} months
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-red-600 font-black">
                          ₹{loan.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Business & Expiry Report"
        documentTitle="BUSINESS & EXPIRY REPORT"
      >
        <div className="space-y-6 mt-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 text-xs font-semibold block uppercase">Active Loans Count</span>
              <span className="text-lg font-bold text-gray-900">{stats.activeLoansCount} Accounts</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 text-xs font-semibold block uppercase">Principal Disbursed</span>
              <span className="text-lg font-bold text-gray-900">₹{stats.totalDisbursed.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 text-xs font-semibold block uppercase">Outstanding Receivable</span>
              <span className="text-lg font-bold text-orange-700">₹{stats.outstandingReceivables.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-red-50 rounded border border-red-100">
              <span className="text-red-700 text-xs font-bold block uppercase">Overdue Expiries</span>
              <span className="text-lg font-extrabold text-red-800">{stats.overdueLoansCount} Overdue</span>
            </div>
          </div>

          {/* Expired / Overdue Checklist */}
          <Card
            title={
              <div className="flex items-center gap-2 text-red-800">
                <ShieldAlert className="w-5 h-5" />
                <span>Expired Active Accounts Checklist</span>
              </div>
            }
            subtitle="Active accounts whose duration months have expired but still have outstanding balances"
            className="border-red-100 bg-red-50/10 shadow-none"
          >
            {expiredLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No overdue expired loans found. All accounts are within duration terms!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-red-200 text-xs md:text-sm">
                  <thead>
                    <tr className="bg-red-50 text-red-950 font-bold">
                      <th className="px-3 py-3 text-left">Loan ID</th>
                      <th className="px-3 py-3 text-left">Customer Name</th>
                      <th className="px-3 py-3 text-left">Disbursed Date</th>
                      <th className="px-3 py-3 text-left">Contract Expiry</th>
                      <th className="px-3 py-3 text-center">Months Overdue</th>
                      <th className="px-3 py-3 text-right">Outstanding Bal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-red-100">
                    {expiredLoans.map(loan => (
                      <tr key={loan.id} className="font-medium">
                        <td className="px-3 py-3 font-bold text-gray-900 font-mono">{loan.loanId}</td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-gray-900">{loan.customerName}</div>
                          {loan.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {loan.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {new Date(loan.disbursedDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-red-600 font-bold">
                          {new Date(loan.expiryDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold text-xs">
                            <Clock className="w-3 h-3" /> {loan.monthsOverdue} months
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-red-600 font-black">
                          ₹{loan.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default BusinessReport;
