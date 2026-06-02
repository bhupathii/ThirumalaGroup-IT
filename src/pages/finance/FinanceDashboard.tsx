import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  FileText, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Plus,
  BookOpen,
  Edit,
  UserPlus,
  Users,
  ShieldAlert,
  Calculator,
  Search,
  Book,
  ArrowRight,
  TrendingDown,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RecentLoanItem {
  id: string;
  loan_id: string;
  customerName: string;
  amount: number;
  date: string;
  due_type: string;
  status: string;
}

const FinanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    disbursedAllTime: 0,
    loansCount: 0,
    outstanding: 0,
    collectedToday: 0,
    overdueLoansCount: 0,
  });
  const [recentLoans, setRecentLoans] = useState<RecentLoanItem[]>([]);
  const [schemaChecked, setSchemaChecked] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Loans
      const loans = await supabaseFinance.getLoans();
      const loansCount = loans.length;
      
      let disbursedAllTime = 0;
      loans.forEach(loan => {
        disbursedAllTime += Number(loan.amount);
      });

      // 2. Fetch Transactions
      const transactions = await supabaseFinance.getTransactions();
      
      // Calculate collected today
      const todayStr = new Date().toISOString().split('T')[0];
      const collectedToday = transactions
        .filter(tx => tx.type === 'Collection' && tx.date === todayStr)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      // Sum of all collections
      const totalCollected = transactions
        .filter(tx => tx.type === 'Collection')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      // 3. Outstanding calculation (Disbursed + flat interest - collections)
      let totalRepayableAllLoans = 0;
      loans.forEach(loan => {
        const principal = Number(loan.amount);
        const rate = Number(loan.interest_rate);
        const duration = Number(loan.duration_months);
        const interestAmount = principal * (rate / 100) * duration;
        totalRepayableAllLoans += (principal + interestAmount);
      });
      const outstanding = Math.max(0, totalRepayableAllLoans - totalCollected);

      // 4. Overdue Loans Count (Active loans with past due date dues that are not fully paid)
      const { data: dues, error: duesError } = await supabase
        .from('finance_dues')
        .select('loan_id')
        .lt('due_date', todayStr)
        .in('status', ['Pending', 'Partially Paid']);

      let overdueLoansCount = 0;
      if (dues && !duesError) {
        // Get unique loan_ids
        const uniqueOverdueLoanIds = new Set(dues.map((d: any) => d.loan_id));
        overdueLoansCount = uniqueOverdueLoanIds.size;
      }

      setMetrics({
        disbursedAllTime,
        loansCount,
        outstanding,
        collectedToday,
        overdueLoansCount,
      });

      // Formatted recent loans (latest 8 disbursals)
      const formattedRecent = loans.slice(0, 8).map(loan => ({
        id: loan.id,
        loan_id: loan.loan_id,
        customerName: loan.customer?.name || 'N/A',
        amount: Number(loan.amount),
        date: loan.date,
        due_type: loan.due_type,
        status: loan.status
      }));
      setRecentLoans(formattedRecent);
      setSchemaChecked(true);
    } catch (error) {
      console.error('Error loading finance dashboard metrics:', error);
      setSchemaChecked(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const quickActions = [
    { label: 'NEW LOAN', path: '/finance/loan-entry', icon: FileText },
    { label: 'EDIT LOAN', path: '/finance/edit-loan-entry', icon: Edit },
    { label: 'NEW CUSTOMER', path: '/finance/new-customer', icon: UserPlus },
    { label: 'NEW GUARANTOR', path: '/finance/new-guarantor', icon: ShieldAlert },
    { label: 'CASH BOOK', path: '/finance/cash-book', icon: BookOpen },
    { label: 'CAPITAL', path: '/finance/capital-entry', icon: DollarSign },
    { label: 'SEARCH', path: '/finance/search', icon: Search },
    { label: 'CALCULATOR', path: '/finance/calculator', icon: Calculator },
    { label: 'CD LEDGER', path: '/finance/cd-ledger', icon: Book },
    { label: 'HP LEDGER', path: '/finance/hp-ledger', icon: Book },
    { label: 'STBD LEDGER', path: '/finance/stbd-ledger', icon: Book },
    { label: 'TBD LEDGER', path: '/finance/tbd-ledger', icon: Book },
  ];

  const reportLinks = [
    { label: 'DAY BOOK', path: '/finance/daybook' },
    { label: 'DAILY REPORT', path: '/finance/new-customers' },
    { label: 'GENERAL LEDGER', path: '/finance/general-ledger' },
    { label: 'DUES LIST', path: '/finance/dues-ledger' },
    { label: 'PROFIT & LOSS', path: '/finance/pl' },
    { label: 'FINAL STATEMENT', path: '/finance/final-statement' },
    { label: 'BUSINESS DETAILS', path: '/finance/business-report' },
    { label: 'PARTNER PERFORMANCE', path: '/finance/partner-performance' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Schema Alert Notification */}
      {!schemaChecked && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 text-sm">Database Schema Incomplete</h3>
              <p className="text-amber-700 text-xs mt-1">
                It looks like the finance tables do not exist or the RLS policies prevent access. 
                Please copy the SQL commands in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">supabase/migrations/20260529000000_finance_schema.sql</code> and execute them in your Supabase SQL Editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Top Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">DASHBOARD</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">OVERVIEW OF TODAY'S CHITFUND OPERATIONS</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/finance/loan-entry"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            NEW LOAN
          </Link>
          <Link
            to="/finance/cash-book"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-slate-850 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            CASH BOOK
          </Link>
        </div>
      </div>

      {/* Today at a glance metric cards */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">TODAY AT A GLANCE</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Disbursed All-Time */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-32 relative overflow-hidden">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DISBURSED (ALL-TIME)</p>
              <h3 className="text-2xl font-black text-slate-900 mt-2 font-sans">
                ₹{metrics.disbursedAllTime.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              {metrics.loansCount} LOANS ON BOOK
            </div>
            <div className="absolute right-4 top-4 p-2 bg-slate-50 text-slate-400 rounded-lg border border-slate-100">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          {/* Card 2: Outstanding */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-32 relative overflow-hidden">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OUTSTANDING</p>
              <h3 className="text-2xl font-black text-red-650 mt-2 font-sans">
                ₹{metrics.outstanding.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              PRINCIPAL + ACCRUED INTEREST
            </div>
            <div className="absolute right-4 top-4 p-2 bg-red-50 text-red-500 rounded-lg border border-red-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Collected Today */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-32 relative overflow-hidden">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COLLECTED TODAY</p>
              <h3 className="text-2xl font-black text-emerald-650 mt-2 font-sans">
                ₹{metrics.collectedToday.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              DEBIT SIDE OF CASHBOOK
            </div>
            <div className="absolute right-4 top-4 p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Overdue Loans */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-32 relative overflow-hidden">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OVERDUE LOANS</p>
              <h3 className="text-2xl font-black text-amber-650 mt-2 font-sans">
                {metrics.overdueLoansCount}
              </h3>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              PAST DUE DATE
            </div>
            <div className="absolute right-4 top-4 p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">QUICK ACTIONS</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, idx) => (
            <Link
              key={idx}
              to={action.path}
              className="bg-white border border-slate-150 rounded-xl p-4 shadow-sm hover:border-slate-350 hover:shadow-md transition-all flex flex-col items-start gap-4"
            >
              <div className="p-2 border border-slate-150 rounded-lg bg-slate-50 text-slate-700">
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-slate-900 tracking-wider">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content grid: Recent Loans and Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Loans */}
        <div className="lg:col-span-2">
          <Card 
            title="RECENT LOANS" 
            subtitle="MOST RECENT 8 DISBURSALS" 
            className="shadow border-slate-150 rounded-xl h-full flex flex-col justify-between"
            headerActions={
              recentLoans.length > 0 ? (
                <Link
                  to="/finance/search"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  VIEW ALL <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : undefined
            }
          >
            {recentLoans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">NO LOANS YET</p>
                <p className="text-slate-400 text-xs font-bold max-w-xs uppercase tracking-wider">
                  START BY CREATING YOUR FIRST LOAN ENTRY.
                </p>
                <Link
                  to="/finance/loan-entry"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-[#0b1329] text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                  CREATE LOAN
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-150">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-widest">Loan ID</th>
                      <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-widest">Customer Name</th>
                      <th className="px-3 py-3 text-right text-[10px] font-bold text-slate-450 uppercase tracking-widest">Amount</th>
                      <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-widest">Mode</th>
                      <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-widest">Disbursed Date</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-450 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {recentLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-xs font-bold text-slate-900 font-mono">
                          {loan.loan_id}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-xs font-bold text-slate-900">
                          {loan.customerName}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-xs font-black text-slate-900">
                          ₹{loan.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {loan.due_type}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-500">
                          {new Date(loan.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            loan.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Reports Navigation Card */}
        <div>
          <Card title="REPORTS" subtitle="PRINTABLE STATEMENTS" className="shadow border-slate-150 rounded-xl">
            <ul className="divide-y divide-slate-100">
              {reportLinks.map((report, idx) => (
                <li key={idx} className="first:pt-0 last:pb-0 py-3">
                  <Link
                    to={report.path}
                    className="flex items-center justify-between group transition-all"
                  >
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider group-hover:text-blue-600">
                      {report.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
