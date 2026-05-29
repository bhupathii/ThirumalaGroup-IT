import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Wallet, DollarSign, Users, Landmark, FileText, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import toast from 'react-hot-toast';

const FinanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({
    totalCapital: 0,
    totalDisbursed: 0,
    totalCollected: 0,
    totalPendingDues: 0,
    availableCapital: 0,
    activeLoansCount: 0,
    closedLoansCount: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaChecked, setSchemaChecked] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Partners & Capital Entries
      const partners = await supabaseFinance.getPartners();
      const capitalEntries = await supabaseFinance.getCapitalEntries();
      
      let totalCapital = 0;
      capitalEntries.forEach(entry => {
        const amount = Number(entry.amount);
        if (entry.type === 'Credit') {
          totalCapital += amount;
        } else {
          totalCapital -= amount;
        }
      });

      // 2. Fetch Loans
      const loans = await supabaseFinance.getLoans();
      let totalDisbursed = 0;
      let activeCount = 0;
      let closedCount = 0;
      
      loans.forEach(loan => {
        totalDisbursed += Number(loan.amount);
        if (loan.status === 'Active') {
          activeCount++;
        } else {
          closedCount++;
        }
      });

      // 3. Fetch Transactions
      const transactions = await supabaseFinance.getTransactions();
      let totalCollected = 0;
      transactions.forEach(tx => {
        if (tx.type === 'Collection') {
          totalCollected += Number(tx.amount);
        }
      });

      // 4. Fetch Dues
      const today = new Date().toISOString().split('T')[0];
      const { data: dues, error: duesError } = await supabaseFinance.getLoans().then(async () => {
        // Query dues from database directly
        return await require('../../lib/supabase').supabase
          .from('finance_dues')
          .select('amount, paid_amount')
          .lte('due_date', today)
          .in('status', ['Pending', 'Partially Paid']);
      }).catch(() => ({ data: null, error: new Error('Dues table check failed') }));

      let totalPendingDues = 0;
      if (dues && !duesError) {
        dues.forEach((due: any) => {
          totalPendingDues += (Number(due.amount) - Number(due.paid_amount));
        });
      }

      // Available Capital calculation
      const availableCapital = totalCapital + totalCollected - totalDisbursed;

      setMetrics({
        totalCapital,
        totalDisbursed,
        totalCollected,
        totalPendingDues,
        availableCapital,
        activeLoansCount: activeCount,
        closedLoansCount: closedCount,
      });

      setRecentTransactions(transactions.slice(0, 5));
      setSchemaChecked(true);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Check if schema exists, if not, user might need to run the migrations
      setSchemaChecked(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Schema check notification */}
      {!schemaChecked && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 text-sm">Database Schema Incomplete</h3>
              <p className="text-amber-700 text-xs mt-1">
                It looks like the finance tables do not exist or the RLS policies prevent access. 
                Please copy the SQL commands in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">supabase/migrations/20260529000000_finance_schema.sql</code> and execute them in your Supabase SQL Editor, then refresh this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Finance Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of partner investments, loan distribution, and collections</p>
        </div>
        <div className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-green-200">
          Finance Mode Active
        </div>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Available Capital */}
        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Available Capital</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                ₹{metrics.availableCapital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-gray-400 text-[10px] mt-1">Investments + Collections - Loans</p>
            </div>
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg shadow-sm">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Invested Capital */}
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-white to-green-50/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Invested Capital</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                ₹{metrics.totalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-gray-400 text-[10px] mt-1">Net Partner Credit (Investment)</p>
            </div>
            <div className="p-3 bg-green-100 text-green-700 rounded-lg shadow-sm">
              <Landmark className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Total Disbursed */}
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Disbursed Loans</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                ₹{metrics.totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-blue-600 text-xs font-bold mt-1">{metrics.activeLoansCount} Active / {metrics.closedLoansCount} Closed</p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg shadow-sm">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Total Collected */}
        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Collection Received</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                ₹{metrics.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-indigo-600 text-xs font-bold mt-1">₹{metrics.totalPendingDues.toLocaleString('en-IN')} Dues Overdue</p>
            </div>
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg shadow-sm">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Collections */}
        <Card title="Recent Transactions" subtitle="The last 5 collections or disbursements recorded" className="lg:col-span-2 shadow">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No transactions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {tx.loan?.customer?.name || 'N/A'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {tx.loan?.loan_id || 'N/A'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tx.type === 'Collection' ? 'bg-green-100 text-green-800' :
                          tx.type === 'Disbursement' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-sm font-bold text-right ${
                        tx.type === 'Collection' ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {tx.type === 'Collection' ? '+' : '-'} ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Quick Links Card */}
        <Card title="Quick Action Panel" subtitle="Jump directly to primary finance features" className="shadow">
          <div className="flex flex-col gap-3">
            <a href="/finance/loan-entry" className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-700 rounded-md">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Create New Loan</h4>
                  <p className="text-gray-500 text-xs mt-0.5">Disburse a loan & setup dues</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
            </a>

            <a href="/finance/search" className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-md">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Collect Payment</h4>
                  <p className="text-gray-500 text-xs mt-0.5">Search customer & record collection</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </a>

            <a href="/finance/partners" className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-md">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Partners & Capital</h4>
                  <p className="text-gray-500 text-xs mt-0.5">Manage partner listings & investments</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </a>

            <a href="/finance/daybook" className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-md">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Daybook Report</h4>
                  <p className="text-gray-500 text-xs mt-0.5">Check today's receipts and payments</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FinanceDashboard;
